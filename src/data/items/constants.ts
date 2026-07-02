import type { ItemCategory, ItemRarity, EquipmentSlot } from '../../types';
import i18n from '../../i18n';
import { getItemPropertyByCode } from '../itemproperties';

// i18n-backed name getters
export const getCategoryName = (key: ItemCategory): string => {
  return i18n.t(`categories.${key}`, { ns: 'game' });
};

export const getRarityName = (key: ItemRarity): string => {
  return i18n.t(`rarity.${key}`, { ns: 'game' });
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

export const getEquipmentSlotName = (key: EquipmentSlot): string => {
  return i18n.t(`equipmentSlots.${key}`, { ns: 'game' });
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
  'AdvEq': 'misc', // Grim Hollow Advanced Equipment (щитоподобные конвертированы в S при импорте)
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

export const getDamageTypeName = (key: string): string => {
  return i18n.t(`damageTypes.${key}`, { ns: 'game' });
};

// Перевод по ПОЛНОМУ имени типа урона ("fire", "necrotic", …) — в отличие от
// getDamageTypeName, который ждёт однобуквенный код 5etools ("F", "N"). Нужен
// для устойчивостей на листе персонажа, где типы хранятся полными именами.
export const getDamageTypeFullName = (key: string): string => {
  return i18n.t(`damageTypesFull.${key}`, { ns: 'game', defaultValue: key });
};

export const getPropertyName = (key: string): string => {
  // Base PHB property codes live in the i18n weaponProperties map. Anything not
  // there (Ammunition "A", Reload "RLD", Range "Rng", and homebrew firearm codes
  // like "GC:VSS-F" whose ':' i18next treats as a namespace separator) is
  // resolved from the item-property data instead, which also carries the RU
  // overlay. Falls back to the raw code if nothing matches.
  const fromI18n = i18n.t(`weaponProperties.${key}`, { ns: 'game', defaultValue: '' });
  if (fromI18n) return fromI18n;
  const prop = getItemPropertyByCode(key);
  return prop?.name ?? key;
};

export const getMasteryName = (key: string): string => {
  return i18n.t(`weaponMastery.${key}`, { ns: 'game' });
};

export const getWeaponCategoryName = (key: string): string => {
  return i18n.t(`weaponCategories.${key}`, { ns: 'game' });
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
    case 'AdvEq': return '⚙️';
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
