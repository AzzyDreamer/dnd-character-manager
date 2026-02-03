// Загрузка JSON предысторий (5etools формат) (ленивая загрузка)
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

export async function init(): Promise<void> {
  if (_initialized) return;
  if (_initializing) return _initializing;

  _initializing = (async () => {
    const entries = Object.entries(modules);
    for (const [, loader] of entries) {
      const mod = await (loader as () => Promise<any>)();
      const data = mod.default ?? mod;
      if (data && typeof data === 'object' && data.name) {
        ALL_JSON_BACKGROUNDS.push(data as JsonBackgroundData);
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
