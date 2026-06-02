// Загрузка всех опциональных способностей из JSON файлов (ленивая batch загрузка)
import { applyOverlay } from '../translationOverlay';

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
    const mod = await import('../_bundles/optionalfeatures.json');
    const items = (mod.default ?? mod) as OptionalFeatureData[];

    for (const data of items) {
      if (data && typeof data === 'object' && data.name) {
        ALL_OPTIONAL_FEATURES.push(data as OptionalFeatureData);
      }
    }

    ALL_OPTIONAL_FEATURES.sort((a, b) => a.name.localeCompare(b.name));
    await applyOverlay('optionalfeatures', ALL_OPTIONAL_FEATURES, f => f.name);
    _initialized = true;
  })();

  return _initializing;
}

export function getOptionalFeatureByName(name: string): OptionalFeatureData | undefined {
  const lc = name.toLowerCase();
  return ALL_OPTIONAL_FEATURES.find(f => f.name.toLowerCase() === lc || (f as any)._origName?.toLowerCase() === lc);
}

// Grim Hollow трансформации: префикс кода featureType → название трансформации
// (например, "AH:TB" = Aberrant Horror + Transformation Boon).
const TRANSFORMATION_NAMES: Record<string, string> = {
  AH: 'Чуждый ужас',
  F: 'Фея',
  Fi: 'Исчадие',
  H: 'Карга',
  L: 'Лич',
  Ly: 'Ликантроп',
  O: 'Слизь',
  P: 'Первобытный',
  SG: 'Гуль Теневой стали',
  Ser: 'Серафим',
  Spec: 'Призрак',
  V: 'Вампир',
};
// Суффикс кода: TB = дар трансформации (boon), TF = изъян трансформации (flaw)
const TRANSFORMATION_KIND: Record<string, string> = {
  TB: 'Дар трансформации',
  TF: 'Изъян трансформации',
};

export const FEATURE_TYPE_NAMES: Record<string, string> = {
  EI: 'Воззвание',
  MM: 'Метамагия',
  MV: 'Манёвр',
  'MV:B': 'Манёвр',
  'MV:G': 'Манёвр',
  AS: 'Боевой стиль',
  'FS:F': 'Боевой стиль',
  OG: 'Пакт',
  ED: 'Элементальная дисциплина',
  PB: 'Заклинание пакта',
  AI: 'Инфузия искусника',
  'EI:UA2022WL': 'Воззвание (UA)',
};

// Автозаполнение кодов трансформаций Grim Hollow вида "<префикс>:TB|TF"
// → «<Трансформация>: Дар/Изъян трансформации» (иначе в UI висел сырой код «AH:TB»).
for (const [prefix, tName] of Object.entries(TRANSFORMATION_NAMES)) {
  for (const [suffix, kind] of Object.entries(TRANSFORMATION_KIND)) {
    FEATURE_TYPE_NAMES[`${prefix}:${suffix}`] = `${tName}: ${kind}`;
  }
}
