// Загрузка всех видов (рас) из JSON файлов (ленивая batch загрузка)
const speciesModules = import.meta.glob('./*.json');

export interface SpeciesData {
  name: string;
  source: string;
  page?: number;
  edition?: string;
  size?: string[];
  speed?: number | { walk?: number; fly?: boolean | number; swim?: number; climb?: number; burrow?: number };
  darkvision?: number;
  traitTags?: string[];
  entries: any[];
  ability?: any[];
  languageProficiencies?: any[];
  additionalSpells?: any[];
  resist?: string[];
  hasFluff?: boolean;
  hasFluffImages?: boolean;
  lineage?: string;
  soundClip?: { type: string; path: string };
  [key: string]: any;
}

export const ALL_SPECIES: SpeciesData[] = [];

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
    const entries = Object.entries(speciesModules);

    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);

      const results = await Promise.all(
        batch.map(async ([, loader]) => {
          try {
            const mod = await (loader as () => Promise<any>)();
            return mod.default ?? mod;
          } catch (e) {
            console.warn('Failed to load species:', e);
            return null;
          }
        })
      );

      for (const data of results) {
        if (Array.isArray(data)) {
          if (data[0] && typeof data[0] === 'object' && data[0].name) {
            ALL_SPECIES.push(data[0] as SpeciesData);
          }
        } else if (data && typeof data === 'object' && data.name) {
          ALL_SPECIES.push(data as SpeciesData);
        }
      }

      if (i + BATCH_SIZE < entries.length) {
        await delay(BATCH_DELAY_MS);
      }
    }

    ALL_SPECIES.sort((a, b) => a.name.localeCompare(b.name));
    _initialized = true;
  })();

  return _initializing;
}

export function getSpeciesByName(name: string): SpeciesData | undefined {
  return ALL_SPECIES.find(s => s.name.toLowerCase() === name.toLowerCase());
}

export function getSpeciesBySource(source: string): SpeciesData[] {
  return ALL_SPECIES.filter(s => s.source === source);
}

export const SIZE_NAMES: Record<string, string> = {
  T: 'Крошечный',
  S: 'Маленький',
  M: 'Средний',
  L: 'Большой',
  H: 'Огромный',
  G: 'Гигантский',
};
