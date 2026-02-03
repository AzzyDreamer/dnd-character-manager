// Загрузка всех чувств из JSON файлов (ленивая загрузка)
const modules = import.meta.glob('./*.json');

export interface SenseData {
  name: string;
  source: string;
  page?: number;
  srd52?: boolean;
  entries: any[];
  [key: string]: any;
}

export const ALL_SENSES: SenseData[] = [];

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
        ALL_SENSES.push(data as SenseData);
      }
    }
    ALL_SENSES.sort((a, b) => a.name.localeCompare(b.name));
    _initialized = true;
  })();

  return _initializing;
}

export function getSenseByName(name: string): SenseData | undefined {
  return ALL_SENSES.find(s => s.name.toLowerCase() === name.toLowerCase());
}
