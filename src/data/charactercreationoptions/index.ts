// Загрузка всех опций создания персонажа из JSON файлов (ленивая batch загрузка)
import { applyOverlay } from '../translationOverlay';
const modules = import.meta.glob('./*.json');

export interface CharacterCreationOptionData {
  name: string;
  source: string;
  page?: number;
  optionType?: string[];
  entries: any[];
  hasFluffImages?: boolean;
  fluff?: any;
  [key: string]: any;
}

export const ALL_CHARACTER_CREATION_OPTIONS: CharacterCreationOptionData[] = [];

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
            console.warn('Failed to load character creation option:', e);
            return null;
          }
        })
      );

      for (const data of results) {
        if (data && typeof data === 'object' && data.name) {
          ALL_CHARACTER_CREATION_OPTIONS.push(data as CharacterCreationOptionData);
        }
      }

      if (i + BATCH_SIZE < entries.length) {
        await delay(BATCH_DELAY_MS);
      }
    }

    ALL_CHARACTER_CREATION_OPTIONS.sort((a, b) => a.name.localeCompare(b.name));
    await applyOverlay('charactercreationoptions', ALL_CHARACTER_CREATION_OPTIONS, c => c.name);
    _initialized = true;
  })();

  return _initializing;
}

export function getCharacterCreationOptionByName(name: string): CharacterCreationOptionData | undefined {
  return ALL_CHARACTER_CREATION_OPTIONS.find(o => o.name.toLowerCase() === name.toLowerCase());
}

export const OPTION_TYPE_NAMES: Record<string, string> = {
  'SG': 'Сверхъестественный Дар',
  'CS': 'Секрет Персонажа',
  'DG': 'Тёмный Дар',
  'RF:B': 'Региональная Особенность',
  'Transformation': 'Трансформация',
};
