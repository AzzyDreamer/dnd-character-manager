// Загрузка всех состояний и болезней из JSON файлов
const modules = import.meta.glob('./*.json', { eager: true });

export interface ConditionDiseaseData {
  name: string;
  source: string;
  page?: number;
  srd52?: boolean;
  entries: any[];
  [key: string]: any;
}

const ALL_CONDITIONS: ConditionDiseaseData[] = [];

for (const path of Object.keys(modules)) {
  const mod = modules[path] as any;
  const data = mod.default ?? mod;
  if (data && typeof data === 'object' && data.name) {
    ALL_CONDITIONS.push(data as ConditionDiseaseData);
  }
}

ALL_CONDITIONS.sort((a, b) => a.name.localeCompare(b.name));

export { ALL_CONDITIONS };

export function getConditionByName(name: string): ConditionDiseaseData | undefined {
  return ALL_CONDITIONS.find(c => c.name.toLowerCase() === name.toLowerCase());
}
