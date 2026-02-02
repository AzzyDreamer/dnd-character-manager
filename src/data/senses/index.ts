// Загрузка всех чувств из JSON файлов
const modules = import.meta.glob('./*.json', { eager: true });

export interface SenseData {
  name: string;
  source: string;
  page?: number;
  srd52?: boolean;
  entries: any[];
  [key: string]: any;
}

const ALL_SENSES: SenseData[] = [];

for (const path of Object.keys(modules)) {
  const mod = modules[path] as any;
  const data = mod.default ?? mod;
  if (data && typeof data === 'object' && data.name) {
    ALL_SENSES.push(data as SenseData);
  }
}

ALL_SENSES.sort((a, b) => a.name.localeCompare(b.name));

export { ALL_SENSES };

export function getSenseByName(name: string): SenseData | undefined {
  return ALL_SENSES.find(s => s.name.toLowerCase() === name.toLowerCase());
}
