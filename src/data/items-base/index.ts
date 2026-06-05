// Загрузка всех базовых шаблонов предметов из JSON файлов (ленивая batch загрузка)
import { applyOverlay } from '../translationOverlay';
import { asset } from '../../utils/asset';

export interface ItemBaseData {
  name: string;
  source: string;
  page?: number;
  type?: string;
  rarity?: string;
  reqAttune?: boolean | string | any[];
  weight?: number;
  value?: number;
  entries?: any[];
  entriesTemplate?: any[];
  [key: string]: any;
}

export const ALL_ITEMS_BASE: ItemBaseData[] = [];

let _initialized = false;
let _initializing: Promise<void> | null = null;

export async function init(): Promise<void> {
  if (_initialized) return;
  if (_initializing) return _initializing;

  _initializing = (async () => {
    const mod = await import('../_bundles/items-base.json');
    // Клонируем исходный JSON: оверлей переводов мутирует объекты на месте, а
    // кешированный импорт должен оставаться английским для смены языка в рантайме.
    const items = structuredClone(mod.default ?? mod) as ItemBaseData[];

    for (const data of items) {
      if (data && typeof data === 'object' && data.name) {
        ALL_ITEMS_BASE.push(data as ItemBaseData);
      }
    }

    ALL_ITEMS_BASE.sort((a, b) => a.name.localeCompare(b.name));
    await applyOverlay('items-base', ALL_ITEMS_BASE, i => i.name);
    _initialized = true;
  })();

  return _initializing;
}

/** Сброс для повторной загрузки под другую локаль (см. registry.reloadForLocale). */
export function reset(): void {
  _initialized = false;
  _initializing = null;
  ALL_ITEMS_BASE.length = 0;
}

export function getItemBaseByName(name: string): ItemBaseData | undefined {
  const lc = name.toLowerCase();
  return ALL_ITEMS_BASE.find(i => i.name.toLowerCase() === lc || (i as any)._origName?.toLowerCase() === lc);
}

export function getItemBaseImageUrl(name: string): string {
  // Resolve back to the English name (overlay preserves it as _origName) so
  // translated names don't collapse to underscores and 404 the image.
  const item = getItemBaseByName(name);
  const baseName = (item as { _origName?: string } | undefined)?._origName ?? item?.name ?? name;
  const filename = baseName.replace(/[^a-zA-Z0-9]/g, '_');
  return asset(`/images/items-base/${filename}.webp`);
}
