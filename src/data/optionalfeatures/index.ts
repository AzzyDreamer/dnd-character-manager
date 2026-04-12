// Загрузка всех опциональных способностей из JSON файлов (ленивая batch загрузка)
import { applyOverlay } from '../translationOverlay';
const modules = import.meta.glob('./*.json');

export interface OptionalFeatureData {
  name: string;
  source: string;
  page?: number;
  featureType?: string[];
  prerequisite?: any[];
  entries: any[];
  [key: string]: any;
}

export const ALL_OPTIONAL_FEATURES: OptionalFeatureData[] = [];

let _initialized = false;
let _initializing: Promise<void> | null = null;

// Batch loading для dev-сервера
const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 30;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function init(): Promise<void> {
  if (_initialized) return;
  if (_initializing) return _initializing;

  _initializing = (async () => {
    const entries = Object.entries(modules);

    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);

      const results = await Promise.all(
        batch.map(async ([, loader]) => {
          try {
            const mod = await (loader as () => Promise<any>)();
            return mod.default ?? mod;
          } catch (e) {
            console.warn('Failed to load optional feature:', e);
            return null;
          }
        })
      );

      for (const data of results) {
        if (data && typeof data === 'object' && data.name) {
          ALL_OPTIONAL_FEATURES.push(data as OptionalFeatureData);
        }
      }

      if (i + BATCH_SIZE < entries.length) {
        await delay(BATCH_DELAY_MS);
      }
    }

    ALL_OPTIONAL_FEATURES.sort((a, b) => a.name.localeCompare(b.name));
    await applyOverlay('optionalfeatures', ALL_OPTIONAL_FEATURES, f => f.name);
    _initialized = true;
  })();

  return _initializing;
}

export function getOptionalFeatureByName(name: string): OptionalFeatureData | undefined {
  return ALL_OPTIONAL_FEATURES.find(f => f.name.toLowerCase() === name.toLowerCase());
}

export const FEATURE_TYPE_NAMES: Record<string, string> = {
  EI: 'Воззвание',
  MM: 'Метамагия',
  MV: 'Манёвр',
  AS: 'Боевой стиль',
  OG: 'Пакт',
  ED: 'Элементальная дисциплина',
  PB: 'Заклинание пакта',
  AI: 'Инфузия искусника',
  'EI:UA2022WL': 'Воззвание (UA)',
};
