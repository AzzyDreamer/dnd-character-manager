// Загрузка всех черт из JSON файлов (ленивая batch загрузка)
import { applyOverlay } from '../translationOverlay';
import { asset } from '../../utils/asset';

export interface FeatData {
  name: string;
  source: string;
  page?: number;
  category?: string;
  prerequisite?: any[];
  ability?: any[];
  entries: any[];
  repeatable?: boolean;
  repeatableHidden?: boolean;
  [key: string]: any;
}

export const ALL_FEATS: FeatData[] = [];

let _initialized = false;
let _initializing: Promise<void> | null = null;

export async function init(): Promise<void> {
  if (_initialized) return;
  if (_initializing) return _initializing;

  _initializing = (async () => {
    const mod = await import('../_bundles/feats.json');
    const items = (mod.default ?? mod) as FeatData[];

    for (const data of items) {
      if (data && typeof data === 'object' && data.name) {
        ALL_FEATS.push(data as FeatData);
      }
    }

    ALL_FEATS.sort((a, b) => a.name.localeCompare(b.name));
    await applyOverlay('feats', ALL_FEATS, f => f.name);
    _initialized = true;
  })();

  return _initializing;
}

export function getFeatByName(name: string): FeatData | undefined {
  const lc = name.toLowerCase();
  return ALL_FEATS.find(f => f.name.toLowerCase() === lc || (f as any)._origName?.toLowerCase() === lc);
}

export function getFeatImageUrl(name: string): string {
  const filename = name.replace(/[^a-zA-Z0-9]/g, '_');
  return asset(`/images/feats/${filename}.webp`);
}

export function getFeatsByCategory(category: string): FeatData[] {
  return ALL_FEATS.filter(f => f.category === category);
}

import i18n from '../../i18n';

export function getFeatCategoryName(code: string): string {
  return i18n.t(`featCategories.${code}`, { ns: 'game' });
}

// Объект-прокси для обратной совместимости с Glossary.tsx (constants.FEAT_CATEGORY_NAMES[code])
export const FEAT_CATEGORY_NAMES: Record<string, string> = new Proxy({} as Record<string, string>, {
  get(_target, prop: string) {
    return i18n.t(`featCategories.${prop}`, { ns: 'game' });
  },
});
