// Персистентность КАМПАНИЙ (host-side, десктоп-онли). Кампания = именованная
// партия, которую ГМ сохраняет, чтобы в следующий раз продолжить с тем же составом
// игроков и персонажей. Хранится в appData/campaigns.json. Импортируется ТОЛЬКО из
// online-кода (ленивого под isTauri), поэтому @tauri-apps/* не попадает в веб-бандл.
//
// Запись атомарная (tmp + rename) и сериализована очередью — как в fileCharacterStore.

import { appDataDir, join } from '@tauri-apps/api/path';
import { exists, mkdir, readTextFile, rename, writeTextFile } from '@tauri-apps/plugin-fs';
import type { PartyMember, SheetMode } from './party';

const FILE_NAME = 'campaigns.json';
const TMP_NAME = 'campaigns.json.tmp';

/** Запомненный участник кампании (игрок + его персонаж на момент прошлой сессии). */
export interface CampaignMember {
  /** Имя игрока — ключ матчинга при переподключении (стабильный clientId — в LP4). */
  displayName: string;
  characterId?: string;
  characterName?: string;
  mode?: SheetMode;
  /** Последний известный полный лист — чтобы показать оффлайн-карточку до возврата игрока. */
  snapshot?: unknown;
}

export interface Campaign {
  id: string;
  name: string;
  gmName?: string;
  createdAt: string;
  lastPlayedAt: string;
  members: CampaignMember[];
}

interface CampaignStorage {
  campaigns: Campaign[];
}

const EMPTY: CampaignStorage = { campaigns: [] };

let dirPromise: Promise<string> | null = null;
let queue: Promise<unknown> = Promise.resolve();

function dir(): Promise<string> {
  if (!dirPromise) {
    dirPromise = (async () => {
      const d = await appDataDir();
      await mkdir(d, { recursive: true });
      return d;
    })();
  }
  return dirPromise;
}

async function read(): Promise<CampaignStorage> {
  try {
    const path = await join(await dir(), FILE_NAME);
    if (!(await exists(path))) return { ...EMPTY };
    const raw = await readTextFile(path);
    if (!raw.trim()) return { ...EMPTY };
    const parsed = JSON.parse(raw) as CampaignStorage;
    return { campaigns: Array.isArray(parsed.campaigns) ? parsed.campaigns : [] };
  } catch (error) {
    console.error('Ошибка чтения кампаний:', error);
    return { ...EMPTY };
  }
}

async function write(storage: CampaignStorage): Promise<void> {
  const d = await dir();
  const path = await join(d, FILE_NAME);
  const tmp = await join(d, TMP_NAME);
  await writeTextFile(tmp, JSON.stringify(storage, null, 2));
  await rename(tmp, path);
}

function enqueue<T>(op: () => Promise<T>): Promise<T> {
  const run = queue.then(op, op);
  queue = run.then(() => undefined, () => undefined);
  return run;
}

/** Все кампании, свежие сверху (по lastPlayedAt). */
export async function listCampaigns(): Promise<Campaign[]> {
  const { campaigns } = await read();
  return [...campaigns].sort((a, b) => (b.lastPlayedAt ?? '').localeCompare(a.lastPlayedAt ?? ''));
}

/** Создать/обновить кампанию (upsert по id). */
export function saveCampaign(campaign: Campaign): Promise<void> {
  return enqueue(async () => {
    const storage = await read();
    const idx = storage.campaigns.findIndex((c) => c.id === campaign.id);
    if (idx >= 0) storage.campaigns[idx] = campaign;
    else storage.campaigns.push(campaign);
    await write(storage);
  });
}

export function deleteCampaign(id: string): Promise<void> {
  return enqueue(async () => {
    const storage = await read();
    await write({ campaigns: storage.campaigns.filter((c) => c.id !== id) });
  });
}

/** Свежий id кампании. */
export function newCampaignId(): string {
  return (crypto.randomUUID?.() ?? `c_${Date.now()}_${Math.random().toString(36).slice(2)}`);
}

// ── Слияние сохранённого и живого состава ──────────────────────────────────
export interface RosterSnapshot {
  characterName?: string;
  characterId?: string;
  mode?: SheetMode;
  data: unknown;
}

/** Состав для ОТОБРАЖЕНИЯ: сохранённые участники кампании (оффлайн, с последним
 *  листом) + живые поверх по совпадению имени; новые живые игроки добавляются.
 *  Без активной кампании — просто живой состав. */
export function mergeRosterForDisplay(
  liveMembers: PartyMember[],
  liveSnapshots: Record<string, RosterSnapshot>,
  campaign: Campaign | null,
): { members: PartyMember[]; snapshots: Record<string, RosterSnapshot> } {
  if (!campaign) return { members: liveMembers, snapshots: liveSnapshots };
  const members: PartyMember[] = [];
  const snapshots: Record<string, RosterSnapshot> = {};

  const liveByName = new Map<string, PartyMember>();
  for (const m of liveMembers) if (m.role === 'player') liveByName.set(m.displayName, m);

  const gm = liveMembers.find((m) => m.role === 'gm');
  if (gm) members.push(gm);

  const usedLive = new Set<string>();
  for (const cm of campaign.members) {
    const live = liveByName.get(cm.displayName);
    if (live) {
      usedLive.add(live.id);
      members.push(live);
      snapshots[live.id] = liveSnapshots[live.id] ?? {
        characterName: cm.characterName, characterId: cm.characterId, mode: cm.mode, data: cm.snapshot ?? null,
      };
    } else {
      const id = `saved:${cm.displayName}`;
      members.push({ id, displayName: cm.displayName, role: 'player', online: false });
      snapshots[id] = { characterName: cm.characterName, characterId: cm.characterId, mode: cm.mode, data: cm.snapshot ?? null };
    }
  }
  for (const m of liveMembers) {
    if (m.role !== 'player' || usedLive.has(m.id)) continue;
    members.push(m);
    if (liveSnapshots[m.id]) snapshots[m.id] = liveSnapshots[m.id];
  }
  return { members, snapshots };
}

/** Обновлённый список участников кампании из живого состава (по имени), сохраняя
 *  оффлайн-участников и их прошлые данные. */
export function collectCampaignMembers(
  liveMembers: PartyMember[],
  liveSnapshots: Record<string, RosterSnapshot>,
  prev: CampaignMember[],
): CampaignMember[] {
  const byName = new Map<string, CampaignMember>();
  for (const cm of prev) byName.set(cm.displayName, { ...cm });
  for (const m of liveMembers) {
    if (m.role !== 'player') continue;
    const snap = liveSnapshots[m.id];
    const existing = byName.get(m.displayName);
    byName.set(m.displayName, {
      displayName: m.displayName,
      characterId: snap?.characterId ?? existing?.characterId,
      characterName: snap?.characterName ?? existing?.characterName,
      mode: snap?.mode ?? existing?.mode,
      snapshot: snap?.data ?? existing?.snapshot,
    });
  }
  return [...byName.values()];
}
