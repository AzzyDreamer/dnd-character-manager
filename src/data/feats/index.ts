// Загрузка всех черт из JSON файлов (ленивая batch загрузка)
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
    const entries = Object.entries(featModules);

    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);

      const results = await Promise.all(
        batch.map(async ([, loader]) => {
          try {
            const mod = await (loader as () => Promise<any>)();
            return mod.default ?? mod;
          } catch (e) {
            console.warn('Failed to load feat:', e);
            return null;
          }
        })
      );

      for (const data of results) {
        if (data && typeof data === 'object' && data.name) {
          ALL_FEATS.push(data as FeatData);
        }
      }

      if (i + BATCH_SIZE < entries.length) {
        await delay(BATCH_DELAY_MS);
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
  O: 'Черта происхождения',
  EB: 'Эпическое благо',
  FS: 'Боевой стиль',
};
