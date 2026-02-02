// Загрузка всех видов (рас) из JSON файлов
const speciesModules = import.meta.glob('./*.json', { eager: true });

export interface SpeciesData {
  name: string;
  source: string;
  page?: number;
  edition?: string;
  size?: string[];
  speed?: number | { walk?: number; fly?: boolean | number; swim?: number; climb?: number; burrow?: number };
  darkvision?: number;
  traitTags?: string[];
  entries: any[];
  ability?: any[];
  languageProficiencies?: any[];
  additionalSpells?: any[];
  resist?: string[];
  hasFluff?: boolean;
  hasFluffImages?: boolean;
  lineage?: string;
  soundClip?: { type: string; path: string };
  [key: string]: any;
}

const ALL_SPECIES: SpeciesData[] = [];

for (const path of Object.keys(speciesModules)) {
  const mod = speciesModules[path] as any;
  const data = mod.default ?? mod;
  // Некоторые файлы содержат массив [data, fluff] — берём первый элемент
  if (Array.isArray(data)) {
    if (data[0] && typeof data[0] === 'object' && data[0].name) {
      ALL_SPECIES.push(data[0] as SpeciesData);
    }
  } else if (data && typeof data === 'object' && data.name) {
    ALL_SPECIES.push(data as SpeciesData);
  }
}

ALL_SPECIES.sort((a, b) => a.name.localeCompare(b.name));

export { ALL_SPECIES };

export function getSpeciesByName(name: string): SpeciesData | undefined {
  return ALL_SPECIES.find(s => s.name.toLowerCase() === name.toLowerCase());
}

export function getSpeciesBySource(source: string): SpeciesData[] {
  return ALL_SPECIES.filter(s => s.source === source);
}

export const SIZE_NAMES: Record<string, string> = {
  T: 'Крошечный',
  S: 'Маленький',
  M: 'Средний',
  L: 'Большой',
  H: 'Огромный',
  G: 'Гигантский',
};
