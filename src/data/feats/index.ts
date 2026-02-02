// Загрузка всех черт из JSON файлов
const featModules = import.meta.glob('./*.json', { eager: true });

export interface FeatData {
  name: string;
  source: string;
  page?: number;
  category?: string; // "G" = General, "OF" = Origin Feat, etc.
  prerequisite?: any[];
  ability?: any[];
  entries: any[];
  repeatable?: boolean;
  repeatableHidden?: boolean;
  [key: string]: any;
}

const ALL_FEATS: FeatData[] = [];

for (const path of Object.keys(featModules)) {
  const mod = featModules[path] as any;
  const data = mod.default ?? mod;
  if (data && typeof data === 'object' && data.name) {
    ALL_FEATS.push(data as FeatData);
  }
}

ALL_FEATS.sort((a, b) => a.name.localeCompare(b.name));

export { ALL_FEATS };

export function getFeatByName(name: string): FeatData | undefined {
  return ALL_FEATS.find(f => f.name.toLowerCase() === name.toLowerCase());
}

export function getFeatsByCategory(category: string): FeatData[] {
  return ALL_FEATS.filter(f => f.category === category);
}

export const FEAT_CATEGORY_NAMES: Record<string, string> = {
  G: 'Общая черта',
  OF: 'Черта происхождения',
  EP: 'Эпическое благо',
  FS: 'Боевой стиль',
};
