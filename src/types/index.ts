// Базовые типы для 5etools данных

export interface TimeUnit {
  number: number;
  unit: string;
}

export interface Distance {
  type: string;
  amount: number;
}

export interface Range {
  type: string;
  distance: Distance;
}

export interface Components {
  v?: boolean; // Вербальный компонент
  s?: boolean; // Соматический компонент
  m?: string | boolean; // Материальный компонент
}

export interface Duration {
  type: string;
  concentration?: boolean;
}

export interface HigherLevelEntry {
  type: string;
  name: string;
  entries: string[];
}

export interface ScalingLevelDice {
  label: string;
  scaling: {
    [level: string]: string;
  };
}

export interface ClassReference {
  name: string;
  source: string;
}

export interface SubclassReference {
  class: ClassReference;
  subclass: {
    name: string;
    shortName: string;
    source: string;
    subSubclass?: string;
  };
}

export interface Classes {
  fromClassList?: ClassReference[];
  fromSubclass?: SubclassReference[];
}

export interface RaceReference {
  name: string;
  source: string;
  baseName?: string;
  baseSource?: string;
}

export interface OptionalFeature {
  name: string;
  source: string;
  featureType?: string[];
}

export interface Background {
  name: string;
  source: string;
}

export interface Feat {
  name: string;
  source: string;
}

// Заклинание
export interface Spell {
  name: string;
  source: string;
  page: number;
  srd52?: boolean;
  basicRules2024?: boolean;
  level: number; // 0 для заговоров
  school: string; // "V" = Evocation и т.д.
  time: TimeUnit[];
  range: Range;
  components: Components;
  duration: Duration[];
  entries: string[];
  entriesHigherLevel?: HigherLevelEntry[];
  scalingLevelDice?: ScalingLevelDice;
  damageInflict?: string[];
  savingThrow?: string[];
  miscTags?: string[];
  areaTags?: string[];
  classes?: Classes;
  races?: RaceReference[];
  optionalfeatures?: OptionalFeature[];
  backgrounds?: Background[];
  feats?: Feat[];
}

// Характеристики персонажа
export interface AbilityScores {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
}

// Навыки
export type SkillName =
  | 'acrobatics'
  | 'animalHandling'
  | 'arcana'
  | 'athletics'
  | 'deception'
  | 'history'
  | 'insight'
  | 'intimidation'
  | 'investigation'
  | 'medicine'
  | 'nature'
  | 'perception'
  | 'performance'
  | 'persuasion'
  | 'religion'
  | 'sleightOfHand'
  | 'stealth'
  | 'survival';

export interface Skills {
  [key: string]: {
    proficient: boolean;
    expertise?: boolean;
  };
}

// Категории предметов
export type ItemCategory =
  | 'weapon'
  | 'armor'
  | 'shield'
  | 'helmet'
  | 'boots'
  | 'gloves'
  | 'cloak'
  | 'amulet'
  | 'ring'
  | 'potion'
  | 'scroll'
  | 'wand'
  | 'ammunition'
  | 'tool'
  | 'treasure'
  | 'misc';

// Редкость предметов
export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'very_rare' | 'legendary' | 'artifact';

// Слоты экипировки (как в BG3)
export type EquipmentSlot =
  | 'helmet'
  | 'armor'
  | 'gloves'
  | 'boots'
  | 'cloak'
  | 'amulet'
  | 'ring1'
  | 'ring2'
  | 'mainhand'
  | 'offhand';

// Предмет инвентаря (с поддержкой сетки)
export interface InventoryItem {
  id: string;
  name: string;
  type: string;
  category: ItemCategory;
  quantity: number;
  weight?: number;
  description?: string;
  equipped?: boolean;
  attuned?: boolean;
  // Свойства для сетки инвентаря
  gridWidth: number;  // Ширина предмета в клетках (1-2)
  gridHeight: number; // Высота предмета в клетках (1-2)
  gridX?: number;     // Позиция X в сетке рюкзака
  gridY?: number;     // Позиция Y в сетке рюкзака
  // Слот экипировки
  equipSlot?: EquipmentSlot;
  // Визуальные свойства
  rarity: ItemRarity;
  icon?: string;      // Путь к иконке (загрузится позже)
  iconPlaceholder: string; // Эмодзи или символ-заглушка для иконки
}

// Экипировка персонажа (надетые предметы)
export interface Equipment {
  helmet?: string;    // id предмета
  armor?: string;
  gloves?: string;
  boots?: string;
  cloak?: string;
  amulet?: string;
  ring1?: string;
  ring2?: string;
  mainhand?: string;
  offhand?: string;
}

// Заклинание персонажа
export interface CharacterSpell {
  spellId: string;
  name: string;
  level: number;
  prepared?: boolean;
  alwaysPrepared?: boolean;
}

// Слоты заклинаний
export interface SpellSlots {
  level1: { total: number; used: number };
  level2: { total: number; used: number };
  level3: { total: number; used: number };
  level4: { total: number; used: number };
  level5: { total: number; used: number };
  level6: { total: number; used: number };
  level7: { total: number; used: number };
  level8: { total: number; used: number };
  level9: { total: number; used: number };
}

// Основная структура персонажа
export interface Character {
  id: string;
  name: string;
  race: string;
  class: string;
  classId: string;
  subclass?: string;
  level: number;
  background: string;
  alignment?: string;
  
  // Характеристики
  abilityScores: AbilityScores;
  
  // HP
  hitPoints: {
    current: number;
    max: number;
    temporary: number;
  };
  
  // Хиты кости
  hitDice: {
    total: number;
    used: number;
    type: string; // "d6", "d8", "d10", "d12"
  };
  
  // Спасброски
  savingThrows: {
    strength: { proficient: boolean };
    dexterity: { proficient: boolean };
    constitution: { proficient: boolean };
    intelligence: { proficient: boolean };
    wisdom: { proficient: boolean };
    charisma: { proficient: boolean };
  };
  
  // Навыки
  skills: Skills;
  
  // Владения
  proficiencies: {
    armor: string[];
    weapons: string[];
    tools: string[];
    languages: string[];
  };
  
  // Боевые характеристики
  armorClass: number;
  initiative: number;
  speed: number;
  proficiencyBonus: number;
  
  // Заклинания
  spellcasting?: {
    ability: 'intelligence' | 'wisdom' | 'charisma';
    spellSaveDC: number;
    spellAttackBonus: number;
    spells: CharacterSpell[];
    spellSlots?: SpellSlots;
    cantripsKnown?: number;
    spellsKnown?: number;
  };
  
  // Инвентарь и экипировка
  inventory: InventoryItem[];
  equipment: Equipment;
  currency: {
    copper: number;
    silver: number;
    electrum: number;
    gold: number;
    platinum: number;
  };
  
  // Особенности и черты
  features: {
    id: string;
    name: string;
    description: string;
    source: string;
  }[];
  
  // Заметки
  notes?: string;
  
  // Метаданные
  createdAt: string;
  updatedAt: string;
}

// Тип для хранилища персонажей
export interface CharacterStorage {
  characters: Character[];
  activeCharacterId: string | null;
}
