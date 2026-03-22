import type { ItemCategory, ItemRarity, EquipmentSlot } from '../../types';

// Названия категорий на русском
export const CATEGORY_NAMES: Record<ItemCategory, string> = {
  weapon: 'Оружие',
  armor: 'Доспехи',
  shield: 'Щиты',
  helmet: 'Шлемы',
  boots: 'Обувь',
  gloves: 'Перчатки',
  cloak: 'Плащи',
  amulet: 'Амулеты',
  ring: 'Кольца',
  potion: 'Зелья',
  scroll: 'Свитки',
  wand: 'Жезлы',
  ammunition: 'Боеприпасы',
  tool: 'Инструменты',
  treasure: 'Сокровища',
  misc: 'Разное',
};

// Названия редкости на русском
export const RARITY_NAMES: Record<ItemRarity, string> = {
  common: 'Обычный',
  uncommon: 'Необычный',
  rare: 'Редкий',
  very_rare: 'Очень редкий',
  legendary: 'Легендарный',
  artifact: 'Артефакт',
};

// Цвета рамок по редкости (как в BG3)
export const RARITY_COLORS: Record<ItemRarity, string> = {
  common: '#9ca3af',
  uncommon: '#22c55e',
  rare: '#3b82f6',
  very_rare: '#a855f7',
  legendary: '#f59e0b',
  artifact: '#ef4444',
};

export const RARITY_BG_COLORS: Record<ItemRarity, string> = {
  common: 'rgba(156, 163, 175, 0.15)',
  uncommon: 'rgba(34, 197, 94, 0.15)',
  rare: 'rgba(59, 130, 246, 0.15)',
  very_rare: 'rgba(168, 85, 247, 0.15)',
  legendary: 'rgba(245, 158, 11, 0.15)',
  artifact: 'rgba(239, 68, 68, 0.15)',
};

// Названия слотов экипировки
export const EQUIPMENT_SLOT_NAMES: Record<EquipmentSlot, string> = {
  helmet: 'Шлем',
  armor: 'Доспех',
  gloves: 'Перчатки',
  boots: 'Обувь',
  cloak: 'Плащ',
  accessory1: 'Аксессуар 1',
  accessory2: 'Аксессуар 2',
  accessory3: 'Аксессуар 3',
  mainhand: 'Основная рука',
  offhand: 'Вторая рука',
  rangedMainhand: 'Дальний бой',
  rangedOffhand: 'Дальний (2)',
};

// Иконки-заглушки для слотов
export const EQUIPMENT_SLOT_ICONS: Record<EquipmentSlot, string> = {
  helmet: '⛑️',
  armor: '🛡️',
  gloves: '🧤',
  boots: '👢',
  cloak: '🧥',
  accessory1: '✨',
  accessory2: '✨',
  accessory3: '✨',
  mainhand: '⚔️',
  offhand: '🛡️',
  rangedMainhand: '🏹',
  rangedOffhand: '🏹',
};

// === Маппинг кодов 5etools ===

// Тип предмета → категория
export const TYPE_TO_CATEGORY: Record<string, ItemCategory> = {
  'M': 'weapon',
  'R': 'weapon',
  'LA': 'armor',
  'MA': 'armor',
  'HA': 'armor',
  'S': 'shield',
  'P': 'potion',
  'SC': 'scroll',
  'WD': 'wand',
  'RD': 'wand',
  'RG': 'ring',
  'G': 'misc',
  'A': 'ammunition',
  'AT': 'tool',
  'W': 'misc', // Wondrous — определяется по equipSlot
};

// Тип предмета → слот экипировки по умолчанию
export const TYPE_TO_EQUIP_SLOT: Record<string, EquipmentSlot> = {
  'M': 'mainhand',
  'R': 'rangedMainhand',
  'LA': 'armor',
  'MA': 'armor',
  'HA': 'armor',
  'S': 'offhand',
  'RG': 'accessory1',
  'WD': 'accessory1',
  'RD': 'accessory1',
  'SCF': 'accessory1',
};

// Редкость 5etools → наша
export const RARITY_MAP: Record<string, ItemRarity> = {
  'none': 'common',
  'common': 'common',
  'uncommon': 'uncommon',
  'rare': 'rare',
  'very rare': 'very_rare',
  'legendary': 'legendary',
  'artifact': 'artifact',
};

// Тип урона
export const DAMAGE_TYPE_NAMES: Record<string, string> = {
  'S': 'рубящий',
  'P': 'колющий',
  'B': 'дробящий',
  'F': 'огонь',
  'C': 'холод',
  'L': 'молния',
  'T': 'яд',
  'R': 'радиация',
  'N': 'некротический',
  'A': 'кислота',
  'Y': 'психический',
  'O': 'силовое поле',
};

// Свойства оружия
export const PROPERTY_NAMES: Record<string, string> = {
  'F': 'Фехтовальное',
  'L': 'Лёгкое',
  'H': 'Тяжёлое',
  '2H': 'Двуручное',
  'V': 'Универсальное',
  'T': 'Метательное',
  'AM': 'Боеприпас',
  'LD': 'Перезарядка',
  'R': 'Досягаемость',
  'S': 'Особое',
};

// Мастерство оружия
export const MASTERY_NAMES: Record<string, string> = {
  'Cleave': 'Рассечение',
  'Graze': 'Вскользь',
  'Nick': 'Порез',
  'Push': 'Толчок',
  'Sap': 'Оглушение',
  'Slow': 'Замедление',
  'Topple': 'Опрокидывание',
  'Vex': 'Досада',
};

// Категория оружия
export const WEAPON_CATEGORY_NAMES: Record<string, string> = {
  'simple': 'Простое оружие',
  'martial': 'Боевое оружие',
};

// Иконки-заглушки по типу предмета
export function getIconPlaceholder(raw: RawItemData): string {
  const typeCode = (typeof raw.type === 'string' ? raw.type.split('|')[0] : '') ?? '';

  if (raw.weapon || typeCode === 'M' || typeCode === 'R') {
    if (raw.sword) return '🗡️';
    if (raw.axe) return '🪓';
    if (raw.hammer || raw.mace) return '🔨';
    if (raw.staff) return '🪄';
    if (raw.crossbow) return '🏹';
    if (raw.spear) return '🔱';
    if (raw.dagger) return '🔪';
    if (typeCode === 'R') return '🏹';
    return '⚔️';
  }

  switch (typeCode) {
    case 'LA': case 'MA': case 'HA': return '🛡️';
    case 'S': return '🛡️';
    case 'P': return '🧪';
    case 'SC': return '📜';
    case 'WD': case 'RD': return '🪄';
    case 'RG': return '💍';
    case 'A': return '🏹';
    case 'AT': return '🔧';
    default: break;
  }

  // Wondrous items — по слоту
  if (raw.equipSlot) {
    return EQUIPMENT_SLOT_ICONS[raw.equipSlot as EquipmentSlot] ?? '✨';
  }

  return '📦';
}

// Интерфейс сырых данных JSON
export interface RawItemData {
  name: string;
  source?: string;
  page?: number;
  srd52?: boolean;
  basicRules2024?: boolean;
  edition?: string;
  type?: string;
  rarity?: string;
  reqAttune?: boolean | string;
  weight?: number;
  value?: number;
  weaponCategory?: string;
  property?: string[];
  range?: string;
  mastery?: string[];
  dmg1?: string;
  dmg2?: string;
  dmgType?: string;
  ac?: number;
  strength?: string;
  stealth?: boolean;
  bonusWeapon?: string;
  entries?: string[];
  equipSlot?: string;
  // Флаги типа оружия
  sword?: boolean;
  axe?: boolean;
  hammer?: boolean;
  mace?: boolean;
  staff?: boolean;
  crossbow?: boolean;
  spear?: boolean;
  dagger?: boolean;
  weapon?: boolean;
  [key: string]: unknown;
}
