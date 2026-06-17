// Тонкий клиент над командами/событиями Tauri party-модуля. Статические импорты
// @tauri-apps/* здесь безопасны: src/online/* грузится ТОЛЬКО динамически под
// isTauri() (см. App.tsx), поэтому в веб-бандл этот код не попадает —
// инвариант проверяет scripts/check-web-imports.mjs.

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { decodePartyCode, encodePartyCode, generateSecret } from './protocol';

export interface PartyCode {
  ip: string;
  code: string;
}

export interface HostResult {
  port: number;
  ips: string[];
  secret: string;
  /** Готовые коды партии по каждому локальному IP — пользователь шарит один из них. */
  codes: PartyCode[];
}

/** Поднять хост: Rust биндит порт (с фоллбэком) и возвращает фактический порт + IP.
 *  `displayName` — имя ГМ (хост), `partyName` — имя партии (пустое → дефолт по имени ГМ). */
export async function hostParty(opts: {
  port?: number;
  displayName: string;
  partyName?: string;
}): Promise<HostResult> {
  const secret = generateSecret();
  const info = await invoke<{ port: number; ips: string[] }>('party_host_start', {
    port: opts.port ?? null,
    code: secret,
    displayName: opts.displayName,
    partyName: opts.partyName ?? '',
  });
  const codes = info.ips.map((ip) => ({ ip, code: encodePartyCode(ip, info.port, secret) }));
  return { port: info.port, ips: info.ips, secret, codes };
}

/** Подключиться по коду партии. Бросает при reject (неверный код/версия). */
export async function joinParty(opts: { code: string; displayName: string }): Promise<void> {
  const { host, port, secret } = decodePartyCode(opts.code);
  await invoke('party_join', { host, port, code: secret, displayName: opts.displayName });
}

export type Visibility = 'party' | 'gm' | 'hidden';

/** Опубликовать снимок листа в партию. `data` — полный объект персонажа.
 *  Видимость: `party` (все), `gm` (только ГМ), `hidden` (никто — снимок снимается). */
export async function shareCharacter(opts: {
  id: string;
  name: string;
  visibility: Visibility;
  data: unknown;
}): Promise<void> {
  await invoke('party_share', {
    characterId: opts.id,
    characterName: opts.name,
    visibility: opts.visibility,
    data: opts.visibility === 'hidden' ? null : opts.data,
  });
}

/** Перестать делиться листом (снимает снимок у всех, кто его видел). */
export async function unshareCharacter(id: string, name: string): Promise<void> {
  await invoke('party_share', { characterId: id, characterName: name, visibility: 'hidden', data: null });
}

export async function sendPartyMessage(data: unknown): Promise<void> {
  await invoke('party_send', { msg: JSON.stringify(data) });
}

export async function leaveParty(): Promise<void> {
  await invoke('party_leave');
}

export type PartyStatusState = 'hosting' | 'connected' | 'rejected' | 'closed' | 'error';

export interface PartyStatus {
  state: PartyStatusState;
  reason?: string;
  selfId?: string;
  port?: number;
}

export interface PartyPeer {
  event: 'join' | 'leave';
  id: string;
  displayName?: string;
}

export type PartyRole = 'gm' | 'player';

export interface PartyMember {
  id: string;
  displayName: string;
  role: PartyRole;
  online: boolean;
}

/** Снимок состава партии (хост = источник истины), приходит как `party://state`. */
export interface PartyStateSnapshot {
  partyName: string;
  gmId: string;
  members: PartyMember[];
}

export interface PartyMessage {
  from?: string;
  data: unknown;
}

/** Снимок чужого листа, пришедший по `party://snapshot`. `data: null` — снят. */
export interface PartySnapshot {
  from: string;
  characterId?: string;
  characterName?: string;
  data: unknown | null;
}

/** Запись игрового лога (LP3), приходит по `party://event`. Хост штампует id/ts/актора. */
export interface PartyLogEvent {
  id: number;
  ts: number;
  from: string;
  actor: string;
  kind: string;
  payload: unknown;
}

export interface PartyEventHandlers {
  onStatus?: (status: PartyStatus) => void;
  onState?: (state: PartyStateSnapshot) => void;
  onSnapshot?: (snapshot: PartySnapshot) => void;
  onEvent?: (event: PartyLogEvent) => void;
  onPeer?: (peer: PartyPeer) => void;
  onMessage?: (msg: PartyMessage) => void;
  onError?: (err: { message: string }) => void;
}

/** Подписка на все party-события; возвращает функцию отписки. */
export async function subscribeParty(handlers: PartyEventHandlers): Promise<UnlistenFn> {
  const unlisteners: UnlistenFn[] = [];
  if (handlers.onStatus) {
    unlisteners.push(await listen('party://status', (e) => handlers.onStatus!(e.payload as PartyStatus)));
  }
  if (handlers.onState) {
    unlisteners.push(await listen('party://state', (e) => handlers.onState!(e.payload as PartyStateSnapshot)));
  }
  if (handlers.onSnapshot) {
    unlisteners.push(await listen('party://snapshot', (e) => handlers.onSnapshot!(e.payload as PartySnapshot)));
  }
  if (handlers.onEvent) {
    unlisteners.push(await listen('party://event', (e) => handlers.onEvent!(e.payload as PartyLogEvent)));
  }
  if (handlers.onPeer) {
    unlisteners.push(await listen('party://peer', (e) => handlers.onPeer!(e.payload as PartyPeer)));
  }
  if (handlers.onMessage) {
    unlisteners.push(await listen('party://message', (e) => handlers.onMessage!(e.payload as PartyMessage)));
  }
  if (handlers.onError) {
    unlisteners.push(await listen('party://error', (e) => handlers.onError!(e.payload as { message: string })));
  }
  return () => unlisteners.forEach((u) => u());
}
