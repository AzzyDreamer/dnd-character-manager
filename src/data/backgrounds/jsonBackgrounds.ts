// Загрузка JSON предысторий (5etools формат)
const modules = import.meta.glob('./backgrounds/*.json', { eager: true });

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

const ALL_JSON_BACKGROUNDS: JsonBackgroundData[] = [];

for (const path of Object.keys(modules)) {
  const mod = modules[path] as any;
  const data = mod.default ?? mod;
  if (data && typeof data === 'object' && data.name) {
    ALL_JSON_BACKGROUNDS.push(data as JsonBackgroundData);
  }
}

ALL_JSON_BACKGROUNDS.sort((a, b) => a.name.localeCompare(b.name));

export { ALL_JSON_BACKGROUNDS };

export function getJsonBackgroundByName(name: string): JsonBackgroundData | undefined {
  return ALL_JSON_BACKGROUNDS.find(b => b.name.toLowerCase() === name.toLowerCase());
}
