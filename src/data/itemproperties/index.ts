// Загрузка всех свойств предметов из единого бандла (scripts/bundle-data.mjs).
import { applyOverlay } from '../translationOverlay';

export interface ItemPropertyData {
  name: string;
  abbreviation: string;
  source: string;
  page?: number;
  category?: string;
  srd52?: boolean;
  basicRules2024?: boolean;
  entries: any[];
  [key: string]: any;
}

export const ALL_ITEM_PROPERTIES: ItemPropertyData[] = [];

let _initialized = false;
let _initializing: Promise<void> | null = null;

export async function init(): Promise<void> {
  if (_initialized) return;
  if (_initializing) return _initializing;

  _initializing = (async () => {
    const mod = await import('../_bundles/itemproperties.json');
    // Клонируем исходный JSON: оверлей переводов мутирует объекты на месте, а
    // кешированный импорт должен оставаться английским для смены языка в рантайме.
    const items = structuredClone(mod.default ?? mod) as ItemPropertyData[];
    for (const data of items) {
      if (data && typeof data === 'object' && data.name && data.abbreviation) {
        ALL_ITEM_PROPERTIES.push(data as ItemPropertyData);
      }
    }
    ALL_ITEM_PROPERTIES.sort((a, b) => a.name.localeCompare(b.name));
    await applyOverlay('itemproperties', ALL_ITEM_PROPERTIES, p => p.name);
    _initialized = true;
  })();

  return _initializing;
}

/** Сброс для повторной загрузки под другую локаль (см. registry.reloadForLocale). */
export function reset(): void {
  _initialized = false;
  _initializing = null;
  ALL_ITEM_PROPERTIES.length = 0;
}

const PREFERRED_SOURCES = ['XPHB', 'XDMG', 'PHB'];

/**
 * Lookup item property by abbreviation (case-insensitive).
 * If `source` is provided, prefers exact match; otherwise falls back to PREFERRED_SOURCES order.
 *
 * Real-world data uses:
 *   - {@itemProperty L|XPHB|Light}     — exact source
 *   - {@itemProperty L||light}         — empty source (Thri-kreen, Giff)
 *   - {@itemProperty 2h|XPHB|Two-Handed} — lowercase code (Great Weapon Fighting)
 *   - {@itemProperty LD|PHB|loading}   — legacy PHB source
 */
export function getItemPropertyByCode(code: string, source?: string): ItemPropertyData | undefined {
  const lc = code.toLowerCase();
  const matches = ALL_ITEM_PROPERTIES.filter(p => p.abbreviation.toLowerCase() === lc);
  if (!matches.length) return undefined;
  if (matches.length === 1) return matches[0];
  if (source) {
    const exact = matches.find(p => p.source === source);
    if (exact) return exact;
  }
  for (const src of PREFERRED_SOURCES) {
    const m = matches.find(p => p.source === src);
    if (m) return m;
  }
  return matches[0];
}

/** Lookup by full name (used if a tag accidentally passes the display name instead of code). */
export function getItemPropertyByName(name: string): ItemPropertyData | undefined {
  const lc = name.toLowerCase();
  return ALL_ITEM_PROPERTIES.find(
    p => p.name.toLowerCase() === lc || (p as any)._origName?.toLowerCase() === lc
  );
}
