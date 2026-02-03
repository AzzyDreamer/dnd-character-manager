// Загрузка всех опциональных способностей из JSON файлов (ленивая загрузка)
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

export async function init(): Promise<void> {
  if (_initialized) return;
  if (_initializing) return _initializing;

  _initializing = (async () => {
    const entries = Object.entries(modules);
    for (const [, loader] of entries) {
      const mod = await (loader as () => Promise<any>)();
      const data = mod.default ?? mod;
      if (data && typeof data === 'object' && data.name) {
        ALL_OPTIONAL_FEATURES.push(data as OptionalFeatureData);
      }
    }
    ALL_OPTIONAL_FEATURES.sort((a, b) => a.name.localeCompare(b.name));
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
