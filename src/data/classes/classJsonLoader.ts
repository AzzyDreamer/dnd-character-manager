// Загрузка JSON данных классов для Glossary (ленивая batch загрузка)
const classModules = import.meta.glob('./*/*.json');

export interface ClassJsonData {
  id: string;
  name: string;
  source: string;
  page?: number;
  hitDie: string;
  primaryAbility?: string[];
  savingThrows?: string[];
  spellcaster?: boolean;
  description?: string;
  proficiencies?: any;
  startingEquipment?: any;
  multiclassing?: any;
  levelTable?: any[];
  classFeatures?: any[];
  subclassIds?: string[];
  [key: string]: any;
}

export const ALL_CLASS_DATA: ClassJsonData[] = [];

let _initialized = false;
let _initializing: Promise<void> | null = null;

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 30;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function init(): Promise<void> {
  if (_initialized) return;
  if (_initializing) return _initializing;

  _initializing = (async () => {
    const entries = Object.entries(classModules);

    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);

      const results = await Promise.all(
        batch.map(async ([, loader]) => {
          try {
            const mod = await (loader as () => Promise<any>)();
            return mod.default ?? mod;
          } catch (e) {
            console.warn('Failed to load class data:', e);
            return null;
          }
        })
      );

      for (const data of results) {
        if (data && typeof data === 'object' && data.name && data.hitDie) {
          ALL_CLASS_DATA.push(data as ClassJsonData);
        }
      }

      if (i + BATCH_SIZE < entries.length) {
        await delay(BATCH_DELAY_MS);
      }
    }

    ALL_CLASS_DATA.sort((a, b) => a.name.localeCompare(b.name));
    _initialized = true;
  })();

  return _initializing;
}

export function getClassDataByName(name: string): ClassJsonData | undefined {
  return ALL_CLASS_DATA.find(c => c.name.toLowerCase() === name.toLowerCase());
}

export function getClassImageUrl(id: string): string {
  return `/images/classes/${id}.webp`;
}
