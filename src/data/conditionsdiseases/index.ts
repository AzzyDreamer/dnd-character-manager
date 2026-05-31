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
    const items = (mod.default ?? mod) as ConditionDiseaseData[];
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

export function getConditionByName(name: string): ConditionDiseaseData | undefined {
  const lc = name.toLowerCase();
  return ALL_CONDITIONS.find(c => c.name.toLowerCase() === lc || (c as any)._origName?.toLowerCase() === lc);
}

export function getConditionImageUrl(name: string): string {
  const filename = name.replace(/[^a-zA-Z0-9]/g, '_');
  return asset(`/images/conditionsdiseases/${filename}.webp`);
}
