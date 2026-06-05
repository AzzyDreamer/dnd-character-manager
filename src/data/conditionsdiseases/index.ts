// Загрузка всех состояний и болезней из JSON файлов (ленивая загрузка)
import { applyOverlay } from '../translationOverlay';
import { asset } from '../../utils/asset';

export interface ConditionDiseaseData {
  name: string;
  source: string;
  page?: number;
  srd52?: boolean;
  entries: any[];
  [key: string]: any;
}

export const ALL_CONDITIONS: ConditionDiseaseData[] = [];

let _initialized = false;
let _initializing: Promise<void> | null = null;

export async function init(): Promise<void> {
  if (_initialized) return;
  if (_initializing) return _initializing;

  _initializing = (async () => {
    const mod = await import('../_bundles/conditionsdiseases.json');
    // Клонируем исходный JSON: оверлей переводов мутирует объекты на месте, а
    // кешированный импорт должен оставаться английским для смены языка в рантайме.
    const items = structuredClone(mod.default ?? mod) as ConditionDiseaseData[];
    for (const data of items) {
      if (data && typeof data === 'object' && data.name) {
        ALL_CONDITIONS.push(data as ConditionDiseaseData);
      }
    }
    ALL_CONDITIONS.sort((a, b) => a.name.localeCompare(b.name));
    await applyOverlay('conditionsdiseases', ALL_CONDITIONS, c => c.name);
    _initialized = true;
  })();

  return _initializing;
}

/** Сброс для повторной загрузки под другую локаль (см. registry.reloadForLocale). */
export function reset(): void {
  _initialized = false;
  _initializing = null;
  ALL_CONDITIONS.length = 0;
}

export function getConditionByName(name: string): ConditionDiseaseData | undefined {
  const lc = name.toLowerCase();
  return ALL_CONDITIONS.find(c => c.name.toLowerCase() === lc || (c as any)._origName?.toLowerCase() === lc);
}

export function getConditionImageUrl(name: string): string {
  // Resolve back to the English name (overlay preserves it as _origName) so
  // translated names don't collapse to underscores and 404 the image.
  const cond = getConditionByName(name);
  const baseName = (cond as { _origName?: string } | undefined)?._origName ?? cond?.name ?? name;
  const filename = baseName.replace(/[^a-zA-Z0-9]/g, '_');
  return asset(`/images/conditionsdiseases/${filename}.webp`);
}
