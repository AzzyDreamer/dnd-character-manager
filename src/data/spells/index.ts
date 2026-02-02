// Загрузка всех заклинаний из JSON файлов
const spellModules = import.meta.glob('./*.json', { eager: true });

export interface SpellData {
  name: string;
  source: string;
  page?: number;
  level: number;
  school: string;
  time?: { number: number; unit: string }[];
  range?: { type: string; distance?: { type: string; amount?: number } };
  components?: { v?: boolean; s?: boolean; m?: string | boolean | { text: string; cost?: number; consume?: boolean } };
  duration?: { type: string; duration?: { type: string; amount: number }; concentration?: boolean }[];
  entries: any[];
  entriesHigherLevel?: any[];
  damageInflict?: string[];
  savingThrow?: string[];
  miscTags?: string[];
  areaTags?: string[];
  classes?: {
    fromClassList?: { name: string; source: string }[];
    fromSubclass?: { class: { name: string; source: string }; subclass: { name: string; shortName: string; source: string; subSubclass?: string } }[];
  };
  races?: { name: string; source: string; baseName?: string; baseSource?: string }[];
  backgrounds?: { name: string; source: string }[];
  feats?: { name: string; source: string }[];
  optionalfeatures?: { name: string; source: string; featureType?: string[] }[];
  scalingLevelDice?: any;
  hasFluff?: boolean;
  hasFluffImages?: boolean;
  // Изображения
  foundryImg?: string;
  fluff?: { images?: { type: string; href: { type: string; url?: string; path?: string }; width?: number; height?: number; credit?: string }[] };
  [key: string]: any;
}

const ALL_SPELLS: SpellData[] = [];

for (const path of Object.keys(spellModules)) {
  const mod = spellModules[path] as any;
  const data = mod.default ?? mod;
  if (data && typeof data === 'object' && data.name && data.entries) {
    ALL_SPELLS.push(data as SpellData);
  }
}

ALL_SPELLS.sort((a, b) => {
  if (a.level !== b.level) return a.level - b.level;
  return a.name.localeCompare(b.name);
});

export { ALL_SPELLS };

export function getSpellByName(name: string): SpellData | undefined {
  return ALL_SPELLS.find(s => s.name.toLowerCase() === name.toLowerCase());
}

export function getSpellsByLevel(level: number): SpellData[] {
  return ALL_SPELLS.filter(s => s.level === level);
}

export function getSpellsByClass(className: string): SpellData[] {
  return ALL_SPELLS.filter(s =>
    s.classes?.fromClassList?.some(c => c.name.toLowerCase() === className.toLowerCase()) ||
    s.classes?.fromSubclass?.some(sc => sc.class.name.toLowerCase() === className.toLowerCase())
  );
}

export function getSpellsBySchool(school: string): SpellData[] {
  return ALL_SPELLS.filter(s => s.school === school);
}

export const SCHOOL_NAMES: Record<string, string> = {
  A: 'Ограждение',
  C: 'Вызов',
  D: 'Прорицание',
  E: 'Очарование',
  V: 'Воплощение',
  I: 'Иллюзия',
  N: 'Некромантия',
  T: 'Преобразование',
};

export function getSpellImagePath(spell: SpellData): string {
  // Используем локальное изображение из папки images
  const imageName = spell.name.replace(/[^a-zA-Z0-9]/g, '_');
  return `/src/data/spells/images/${imageName}.webp`;
}
