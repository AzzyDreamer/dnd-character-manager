// Загрузка всех чувств из единого бандла (scripts/bundle-data.mjs).
import { applyOverlay } from '../translationOverlay';
import { asset } from '../../utils/asset';

export interface SenseData {
  name: string;
  source: string;
  page?: number;
  srd52?: boolean;
  entries: any[];
  [key: string]: any;
}

export const ALL_SENSES: SenseData[] = [];

let _initialized = false;
let _initializing: Promise<void> | null = null;

export async function init(): Promise<void> {
  if (_initialized) return;
  if (_initializing) return _initializing;

  _initializing = (async () => {
    const mod = await import('../_bundles/senses.json');
    // Клонируем исходный JSON: оверлей переводов мутирует объекты на месте, а
    // кешированный импорт должен оставаться английским для смены языка в рантайме.
    const items = structuredClone(mod.default ?? mod) as SenseData[];
    for (const data of items) {
      if (data && typeof data === 'object' && data.name) {
        ALL_SENSES.push(data as SenseData);
      }
    }
    ALL_SENSES.sort((a, b) => a.name.localeCompare(b.name));
    await applyOverlay('senses', ALL_SENSES, s => s.name);
    _initialized = true;
  })();

  return _initializing;
}

/** Сброс для повторной загрузки под другую локаль (см. registry.reloadForLocale). */
export function reset(): void {
  _initialized = false;
  _initializing = null;
  ALL_SENSES.length = 0;
}

export function getSenseByName(name: string): SenseData | undefined {
  const lc = name.toLowerCase();
  return ALL_SENSES.find(s => s.name.toLowerCase() === lc || (s as any)._origName?.toLowerCase() === lc);
}

export function getSenseImageUrl(name: string): string {
  // Resolve back to the English name (overlay preserves it as _origName) so
  // translated names don't 404 the image.
  const sense = getSenseByName(name);
  const baseName = (sense as { _origName?: string } | undefined)?._origName ?? sense?.name ?? name;
  return asset(`/images/senses/${baseName}.webp`);
}
