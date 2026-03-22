// Загрузка JSON предысторий (5etools формат) (ленивая загрузка с batch)
const modules = import.meta.glob('./backgrounds/*.json');

export interface JsonBackgroundData {
  name: string;
  source: string;
  page?: number;
  edition?: string;
  ability?: any[];
  feats?: any[];
  skillProficiencies?: any[];
  toolProficiencies?: any[];
  startingEquipment?: any[];
  entries: any[];
  fluff?: string[];
  [key: string]: any;
}

export const ALL_JSON_BACKGROUNDS: JsonBackgroundData[] = [];

let _initialized = false;
let _initializing: Promise<void> | null = null;

// Batch loading для dev-сервера: загружаем по 5 файлов с паузами
const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 50;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function init(): Promise<void> {
  if (_initialized) return;
  if (_initializing) return _initializing;

  _initializing = (async () => {
    const entries = Object.entries(modules);

    // Загружаем батчами для предотвращения перегрузки dev-сервера
    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);

      // Загружаем batch параллельно
      const results = await Promise.all(
        batch.map(async ([, loader]) => {
          try {
            const mod = await (loader as () => Promise<any>)();
            return mod.default ?? mod;
          } catch (e) {
            console.warn('Failed to load background:', e);
            return null;
          }
        })
      );

      // Добавляем успешно загруженные
      for (const data of results) {
        if (data && typeof data === 'object' && data.name) {
          ALL_JSON_BACKGROUNDS.push(data as JsonBackgroundData);
        }
      }

      // Пауза перед следующим batch (кроме последнего)
      if (i + BATCH_SIZE < entries.length) {
        await delay(BATCH_DELAY_MS);
      }
    }

    // Resolve _copy references: inherit fields from parent background
    // Multiple passes to handle chained copies (A -> B -> C)
    for (let pass = 0; pass < 3; pass++) {
      for (const bg of ALL_JSON_BACKGROUNDS) {
        if (!bg._copy) continue;
        // Try exact match first, then fallback to name-only match
        const parent = ALL_JSON_BACKGROUNDS.find(
          p => p.name === bg._copy.name && p.source === bg._copy.source
        ) ?? ALL_JSON_BACKGROUNDS.find(
          p => p.name === bg._copy.name && p !== bg
        );
        if (parent) {
          const copyFields = [
            'ability', 'feats', 'skillProficiencies', 'toolProficiencies',
            'languageProficiencies', 'startingEquipment', 'entries', 'edition',
          ];
          for (const field of copyFields) {
            if (bg[field] === undefined && parent[field] !== undefined) {
              bg[field] = parent[field];
            }
          }
        }
      }
    }

    ALL_JSON_BACKGROUNDS.sort((a, b) => a.name.localeCompare(b.name));
    _initialized = true;
  })();

  return _initializing;
}

export function getJsonBackgroundByName(name: string): JsonBackgroundData | undefined {
  return ALL_JSON_BACKGROUNDS.find(b => b.name.toLowerCase() === name.toLowerCase());
}
