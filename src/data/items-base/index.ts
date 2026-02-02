// Загрузка всех базовых шаблонов предметов из JSON файлов
const modules = import.meta.glob('./*.json', { eager: true });

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

const ALL_ITEMS_BASE: ItemBaseData[] = [];

for (const path of Object.keys(modules)) {
  const mod = modules[path] as any;
  const data = mod.default ?? mod;
  if (data && typeof data === 'object' && data.name) {
    ALL_ITEMS_BASE.push(data as ItemBaseData);
  }
}

ALL_ITEMS_BASE.sort((a, b) => a.name.localeCompare(b.name));

export { ALL_ITEMS_BASE };

export function getItemBaseByName(name: string): ItemBaseData | undefined {
  return ALL_ITEMS_BASE.find(i => i.name.toLowerCase() === name.toLowerCase());
}
