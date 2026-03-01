// Загрузка всех заклинаний из JSON файлов (ленивая batch загрузка)
// НЕ используем { eager: true } — это убивает Vite dev server

const spellModules = import.meta.glob('./*.json');

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
  foundryImg?: string;
  fluff?: { images?: { type: string; href: { type: string; url?: string; path?: string }; width?: number; height?: number; credit?: string }[] };
  [key: string]: any;
}

export const ALL_SPELLS: SpellData[] = [];

let _initialized = false;
let _initializing: Promise<void> | null = null;

// Batch loading для dev-сервера
const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 30;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function init(): Promise<void> {
  if (_initialized) return;
  if (_initializing) return _initializing;

  _initializing = (async () => {
    const entries = Object.entries(spellModules);

    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);

      const results = await Promise.all(
        batch.map(async ([, loader]) => {
          try {
            const mod = await (loader as () => Promise<any>)();
            return mod.default ?? mod;
          } catch (e) {
            console.warn('Failed to load spell:', e);
            return null;
          }
        })
      );

      for (const data of results) {
        if (data && typeof data === 'object' && data.name && data.entries) {
          ALL_SPELLS.push(data as SpellData);
        }
      }

      if (i + BATCH_SIZE < entries.length) {
        await delay(BATCH_DELAY_MS);
      }
    }

    ALL_SPELLS.sort((a, b) => {
      if (a.level !== b.level) return a.level - b.level;
      return a.name.localeCompare(b.name);
    });
    _initialized = true;
  })();

  return _initializing;
}

export function getSpellByName(name: string): SpellData | undefined {
  return ALL_SPELLS.find(s => s.name.toLowerCase() === name.toLowerCase());
}

export function getSpellsByLevel(level: number): SpellData[] {
  return ALL_SPELLS.filter(s => s.level === level);
}

// Маппинг русских имён классов на английские (JSON заклинаний хранит английские имена)
const CLASS_NAME_EN: Record<string, string> = {
  'Варвар': 'Barbarian', 'Бард': 'Bard', 'Жрец': 'Cleric',
  'Друид': 'Druid', 'Воин': 'Fighter', 'Монах': 'Monk',
  'Паладин': 'Paladin', 'Следопыт': 'Ranger', 'Плут': 'Rogue',
  'Чародей': 'Sorcerer', 'Колдун': 'Warlock', 'Волшебник': 'Wizard',
  'Изобретатель': 'Artificer', 'Стрелок': 'Gunslinger', 'Охотник на Монстров': 'Monster Hunter',
};

export function getSpellsByClass(className: string): SpellData[] {
  const en = CLASS_NAME_EN[className] || className;
  return ALL_SPELLS.filter(s =>
    s.classes?.fromClassList?.some(c => c.name.toLowerCase() === en.toLowerCase()) ||
    s.classes?.fromSubclass?.some(sc => sc.class.name.toLowerCase() === en.toLowerCase())
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
  const imageName = spell.name.replace(/[^a-zA-Z0-9]/g, '_');
  return `/src/data/spells/images/${imageName}.webp`;
}
