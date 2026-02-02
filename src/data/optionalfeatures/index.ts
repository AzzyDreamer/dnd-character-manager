// Загрузка всех опциональных способностей из JSON файлов
const modules = import.meta.glob('./*.json', { eager: true });

export interface OptionalFeatureData {
  name: string;
  source: string;
  page?: number;
  featureType?: string[];
  prerequisite?: any[];
  entries: any[];
  [key: string]: any;
}

const ALL_OPTIONAL_FEATURES: OptionalFeatureData[] = [];

for (const path of Object.keys(modules)) {
  const mod = modules[path] as any;
  const data = mod.default ?? mod;
  if (data && typeof data === 'object' && data.name) {
    ALL_OPTIONAL_FEATURES.push(data as OptionalFeatureData);
  }
}

ALL_OPTIONAL_FEATURES.sort((a, b) => a.name.localeCompare(b.name));

export { ALL_OPTIONAL_FEATURES };

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
