// Загрузка JSON данных подклассов для Glossary (ленивая batch загрузка)
const subclassModules = import.meta.glob('./*/subclasses/*.json');

export interface SubclassJsonData {
  id: string;
  name: string;
  classId: string;
  description: string;
  shortDescription?: string;
  source: string;
  level: number;
  features: {
    name: string;
    level: number;
    source: string;
    description: string;
    details?: any;
    spells?: any[];
    spellList?: any[];
  }[];
  [key: string]: any;
}

export const ALL_SUBCLASS_DATA: SubclassJsonData[] = [];

let _initialized = false;
let _initializing: Promise<void> | null = null;

const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 30;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function init(): Promise<void> {
  if (_initialized) return;
  if (_initializing) return _initializing;

  _initializing = (async () => {
    const entries = Object.entries(subclassModules);

    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);

      const results = await Promise.all(
        batch.map(async ([, loader]) => {
          try {
            const mod = await (loader as () => Promise<any>)();
            return mod.default ?? mod;
          } catch (e) {
            console.warn('Failed to load subclass data:', e);
            return null;
          }
        })
      );

      for (const data of results) {
        if (data && typeof data === 'object' && data.name && data.classId) {
          ALL_SUBCLASS_DATA.push(data as SubclassJsonData);
        }
      }

      if (i + BATCH_SIZE < entries.length) {
        await delay(BATCH_DELAY_MS);
      }
    }

    ALL_SUBCLASS_DATA.sort((a, b) => {
      const cmp = a.classId.localeCompare(b.classId);
      return cmp !== 0 ? cmp : a.name.localeCompare(b.name);
    });
    _initialized = true;
  })();

  return _initializing;
}

export function getSubclassesByClass(classId: string): SubclassJsonData[] {
  return ALL_SUBCLASS_DATA.filter(s => s.classId === classId);
}

export function getSubclassById(classId: string, subclassId: string): SubclassJsonData | undefined {
  return ALL_SUBCLASS_DATA.find(s => s.classId === classId && s.id === subclassId);
}
