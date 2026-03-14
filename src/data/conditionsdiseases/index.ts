// Загрузка всех состояний и болезней из JSON файлов (ленивая загрузка)
const modules = import.meta.glob('./*.json');

export interface ConditionDiseaseData {
  name: string;
  source: string;
  page?: number;
  srd52?: boolean;
  entries: any[];
  [key: string]: any;
}

export const ALL_CONDITIONS: ConditionDiseaseData[] = [];

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
        ALL_CONDITIONS.push(data as ConditionDiseaseData);
      }
    }
    ALL_CONDITIONS.sort((a, b) => a.name.localeCompare(b.name));
    _initialized = true;
  })();

  return _initializing;
}

export function getConditionByName(name: string): ConditionDiseaseData | undefined {
  return ALL_CONDITIONS.find(c => c.name.toLowerCase() === name.toLowerCase());
}

export function getConditionImageUrl(name: string): string {
  const filename = name.replace(/[^a-zA-Z0-9]/g, '_');
  return `/images/conditionsdiseases/${filename}.webp`;
}
