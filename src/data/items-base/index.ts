// Загрузка всех базовых шаблонов предметов из JSON файлов (ленивая загрузка)
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

export async function init(): Promise<void> {
  if (_initialized) return;
  if (_initializing) return _initializing;

  _initializing = (async () => {
    const entries = Object.entries(modules);
    for (const [, loader] of entries) {
      const mod = await (loader as () => Promise<any>)();
      const data = mod.default ?? mod;
      if (data && typeof data === 'object' && data.name) {
        ALL_ITEMS_BASE.push(data as ItemBaseData);
      }
    }
    ALL_ITEMS_BASE.sort((a, b) => a.name.localeCompare(b.name));
    _initialized = true;
  })();

  return _initializing;
}

export function getItemBaseByName(name: string): ItemBaseData | undefined {
  return ALL_ITEMS_BASE.find(i => i.name.toLowerCase() === name.toLowerCase());
}
