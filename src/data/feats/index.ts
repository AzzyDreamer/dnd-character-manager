// Загрузка всех черт из JSON файлов (ленивая загрузка)
const featModules = import.meta.glob('./*.json');

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
    const entries = Object.entries(featModules);
    for (const [, loader] of entries) {
      const mod = await (loader as () => Promise<any>)();
      const data = mod.default ?? mod;
      if (data && typeof data === 'object' && data.name) {
        ALL_FEATS.push(data as FeatData);
      }
    }
    ALL_FEATS.sort((a, b) => a.name.localeCompare(b.name));
    _initialized = true;
  })();

  return _initializing;
}

export function getFeatByName(name: string): FeatData | undefined {
  return ALL_FEATS.find(f => f.name.toLowerCase() === name.toLowerCase());
}

export function getFeatsByCategory(category: string): FeatData[] {
  return ALL_FEATS.filter(f => f.category === category);
}

export const FEAT_CATEGORY_NAMES: Record<string, string> = {
  G: 'Общая черта',
  OF: 'Черта происхождения',
  EP: 'Эпическое благо',
  FS: 'Боевой стиль',
};
