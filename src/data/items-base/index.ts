// Загрузка всех базовых шаблонов предметов из JSON файлов (ленивая batch загрузка)
import { applyOverlay } from '../translationOverlay';
const modules = import.meta.glob('./*.json');

export interface ItemBaseData {
  name: string;
  source: string;
  page?: number;
  type?: string;
  rarity?: string;
  reqAttune?: boolean | string | any[];
  weight?: number;
  value?: number;
  entries?: any[];
  entriesTemplate?: any[];
  [key: string]: any;
}

export const ALL_ITEMS_BASE: ItemBaseData[] = [];

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
            console.warn('Failed to load item-base:', e);
            return null;
          }
        })
      );

      for (const data of results) {
        if (data && typeof data === 'object' && data.name) {
          ALL_ITEMS_BASE.push(data as ItemBaseData);
        }
      }

      if (i + BATCH_SIZE < entries.length) {
        await delay(BATCH_DELAY_MS);
      }
    }

    ALL_ITEMS_BASE.sort((a, b) => a.name.localeCompare(b.name));
    await applyOverlay('items-base', ALL_ITEMS_BASE, i => i.name);
    _initialized = true;
  })();

  return _initializing;
}

export function getItemBaseByName(name: string): ItemBaseData | undefined {
  return ALL_ITEMS_BASE.find(i => i.name.toLowerCase() === name.toLowerCase());
}

export function getItemBaseImageUrl(name: string): string {
  const filename = name.replace(/[^a-zA-Z0-9]/g, '_');
  return `/images/items-base/${filename}.webp`;
}
