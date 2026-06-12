// Загрузка статблоков существ (бестиарий для Дикого облика) — ленивая batch загрузка
import { applyOverlay } from '../translationOverlay';
import { asset } from '../../utils/asset';

export interface CreatureAction {
  name: string;
  entries: any[];
}

export interface CreatureData {
  name: string;
  source: string;
  page?: number;
  size?: string[];                 // ['T'|'S'|'M'|'L'|'H'|'G']
  type: string | { type: string; tags?: string[] };
  ac: (number | { ac: number; from?: string[] })[];
  hp?: { average?: number; formula?: string };
  speed?: { walk?: number; fly?: number; swim?: number; climb?: number; burrow?: number; canHover?: boolean };
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
  skill?: Record<string, string>;  // { perception: '+5' }
  save?: Record<string, string>;
  senses?: string[];
  passive?: number;
  cr?: string | { cr: string; xp?: number };
  trait?: CreatureAction[];
  action?: CreatureAction[];
  bonus?: CreatureAction[];
  reaction?: CreatureAction[];
  resist?: any[];
  immune?: any[];
  vulnerable?: any[];
  conditionImmune?: any[];
  languages?: string[];
  _origName?: string;
  [key: string]: any;
}

export const ALL_CREATURES: CreatureData[] = [];

let _initialized = false;
let _initializing: Promise<void> | null = null;

export async function init(): Promise<void> {
  if (_initialized) return;
  if (_initializing) return _initializing;

  _initializing = (async () => {
    const mod = await import('../_bundles/creatures.json');
    // Клонируем исходный JSON: оверлей переводов мутирует объекты на месте, а
    // кешированный импорт должен оставаться английским для смены языка в рантайме.
    const items = structuredClone(mod.default ?? mod) as CreatureData[];

    for (const data of items) {
      if (data && typeof data === 'object' && data.name) {
        ALL_CREATURES.push(data);
      }
    }

    ALL_CREATURES.sort((a, b) => a.name.localeCompare(b.name));
    await applyOverlay('creatures', ALL_CREATURES, c => c.name);
    _initialized = true;
  })();

  return _initializing;
}

/** Сброс для повторной загрузки под другую локаль (см. registry.reloadForLocale). */
export function reset(): void {
  _initialized = false;
  _initializing = null;
  ALL_CREATURES.length = 0;
}

export function getCreatureByName(name: string): CreatureData | undefined {
  const lc = name.toLowerCase();
  return ALL_CREATURES.find(c => c.name.toLowerCase() === lc || c._origName?.toLowerCase() === lc);
}

/** CR в число для сравнений: '1/4' → 0.25, '2' → 2, объектная форма → cr.cr. */
export function crToNumber(cr: CreatureData['cr']): number {
  const raw = typeof cr === 'object' && cr !== null ? cr.cr : cr;
  if (raw === undefined || raw === null) return NaN;
  const s = String(raw).trim();
  const slash = s.indexOf('/');
  if (slash > 0) {
    const num = Number(s.slice(0, slash));
    const den = Number(s.slice(slash + 1));
    return den ? num / den : NaN;
  }
  return Number(s);
}

/** CR для отображения: '1/4', '2'. */
export function crToString(cr: CreatureData['cr']): string {
  const raw = typeof cr === 'object' && cr !== null ? cr.cr : cr;
  return raw === undefined || raw === null ? '—' : String(raw);
}

export function getCreatureAC(c: CreatureData): number {
  const first = c.ac?.[0];
  if (typeof first === 'number') return first;
  if (first && typeof first === 'object') return first.ac;
  return 10;
}

// Имя файла токена: как в feats (не-алфанумерика → '_'), но прежде снимаем
// диакритику, чтобы 'Rothé' искал Rothe.webp, а не Roth_.webp.
export function getCreatureImageUrl(name: string): string {
  const creature = getCreatureByName(name);
  const baseName = creature?._origName ?? creature?.name ?? name;
  const filename = baseName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '_');
  return asset(`/images/creatures/${filename}.webp`);
}

const SIZE_NAMES: Record<string, string> = {
  T: 'Tiny', S: 'Small', M: 'Medium', L: 'Large', H: 'Huge', G: 'Gargantuan',
};

export function getCreatureTypeName(c: CreatureData): string {
  return typeof c.type === 'object' && c.type !== null ? c.type.type : String(c.type ?? '');
}

function formatSpeed(speed: CreatureData['speed']): string {
  if (!speed) return '30 ft.';
  const parts: string[] = [];
  if (speed.walk !== undefined) parts.push(`${speed.walk} ft.`);
  if (speed.climb) parts.push(`Climb ${speed.climb} ft.`);
  if (speed.swim) parts.push(`Swim ${speed.swim} ft.`);
  if (speed.fly) parts.push(`Fly ${speed.fly} ft.${speed.canHover ? ' (hover)' : ''}`);
  if (speed.burrow) parts.push(`Burrow ${speed.burrow} ft.`);
  return parts.join(', ');
}

/**
 * Мини-статблок для тултипа {@creature …}: строка-шапка + сводка статов +
 * черты/действия как именованные 5etools-энтри (их понимает entryRenderer).
 */
export function creatureToEntries(c: CreatureData): any[] {
  const size = (c.size ?? []).map(s => SIZE_NAMES[s] ?? s).join(' or ');
  const header = `{@i ${[size, getCreatureTypeName(c)].filter(Boolean).join(' ')}, CR ${crToString(c.cr)}}`;
  const mod = (v: number) => `${v} (${v >= 10 ? '+' : ''}${Math.floor((v - 10) / 2)})`;
  const entries: any[] = [
    header,
    `{@b AC} ${getCreatureAC(c)}  {@b HP} ${c.hp?.average ?? '—'}${c.hp?.formula ? ` (${c.hp.formula})` : ''}  {@b Speed} ${formatSpeed(c.speed)}`,
    `{@b STR} ${mod(c.str)}  {@b DEX} ${mod(c.dex)}  {@b CON} ${mod(c.con)}  {@b INT} ${mod(c.int)}  {@b WIS} ${mod(c.wis)}  {@b CHA} ${mod(c.cha)}`,
  ];
  for (const group of [c.trait, c.action, c.bonus, c.reaction]) {
    for (const a of group ?? []) {
      entries.push({ type: 'entries', name: a.name, entries: a.entries });
    }
  }
  return entries;
}
