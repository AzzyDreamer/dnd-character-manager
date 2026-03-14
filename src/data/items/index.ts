import type { ItemCategory, ItemRarity, EquipmentSlot } from '../../types';
import {
  TYPE_TO_CATEGORY,
  TYPE_TO_EQUIP_SLOT,
  RARITY_MAP,
  DAMAGE_TYPE_NAMES,
  PROPERTY_NAMES,
  MASTERY_NAMES,
  WEAPON_CATEGORY_NAMES,
  getIconPlaceholder,
  type RawItemData,
} from './constants';

// Re-export constants
export {
  CATEGORY_NAMES,
  RARITY_NAMES,
  RARITY_COLORS,
  RARITY_BG_COLORS,
  EQUIPMENT_SLOT_NAMES,
  EQUIPMENT_SLOT_ICONS,
  DAMAGE_TYPE_NAMES,
  PROPERTY_NAMES,
  MASTERY_NAMES,
} from './constants';

// === Ленивая загрузка всех предметов из корневых JSON (1700+ файлов с описаниями) ===
const itemModules = import.meta.glob('./*.json');

export interface ItemData {
  name: string;
  source: string;
  page?: number;
  type?: string;
  rarity?: string;
  reqAttune?: boolean | string | any[];
  weight?: number;
  value?: number;
  entries?: any[];
  [key: string]: any;
}

export const ALL_ITEMS: ItemData[] = [];

let _itemsInitialized = false;
let _itemsInitializing: Promise<void> | null = null;

const ITEMS_BATCH_SIZE = 50;
const ITEMS_BATCH_DELAY_MS = 10;

export async function init(): Promise<void> {
  if (_itemsInitialized) return;
  if (_itemsInitializing) return _itemsInitializing;

  _itemsInitializing = (async () => {
    const entries = Object.entries(itemModules);

    for (let i = 0; i < entries.length; i += ITEMS_BATCH_SIZE) {
      const batch = entries.slice(i, i + ITEMS_BATCH_SIZE);

      const results = await Promise.all(
        batch.map(async ([, loader]) => {
          try {
            const mod = await (loader as () => Promise<any>)();
            return mod.default ?? mod;
          } catch (e) {
            console.warn('Failed to load item:', e);
            return null;
          }
        })
      );

      for (const data of results) {
        if (data && typeof data === 'object' && data.name) {
          ALL_ITEMS.push(data as ItemData);
        }
      }

      if (i + ITEMS_BATCH_SIZE < entries.length) {
        await new Promise(r => setTimeout(r, ITEMS_BATCH_DELAY_MS));
      }
    }

    ALL_ITEMS.sort((a, b) => a.name.localeCompare(b.name));
    _itemsInitialized = true;
  })();

  return _itemsInitializing;
}

export function getItemByName(name: string, source?: string): ItemData | undefined {
  if (source) {
    return ALL_ITEMS.find(i => i.name.toLowerCase() === name.toLowerCase() && i.source === source);
  }
  return ALL_ITEMS.find(i => i.name.toLowerCase() === name.toLowerCase());
}

// === Import all JSON item files ===

// Weapons
import dagger from './weapons/dagger.json';
import shortsword from './weapons/shortsword.json';
import longsword from './weapons/longsword.json';
import greatsword from './weapons/greatsword.json';
import rapier from './weapons/rapier.json';
import scimitar from './weapons/scimitar.json';
import handaxe from './weapons/handaxe.json';
import battleaxe from './weapons/battleaxe.json';
import greataxe from './weapons/greataxe.json';
import mace from './weapons/mace.json';
import warhammer from './weapons/warhammer.json';
import quarterstaff from './weapons/quarterstaff.json';
import spear from './weapons/spear.json';
import javelin from './weapons/javelin.json';
import halberd from './weapons/halberd.json';
import longbow from './weapons/longbow.json';
import shortbow from './weapons/shortbow.json';
import lightCrossbow from './weapons/light-crossbow.json';
import handCrossbow from './weapons/hand-crossbow.json';
import trident from './weapons/trident.json';
import flail from './weapons/flail.json';

// Armor
import leather from './armor/leather.json';
import studdedLeather from './armor/studded-leather.json';
import chainShirt from './armor/chain-shirt.json';
import scaleMail from './armor/scale-mail.json';
import breastplate from './armor/breastplate.json';
import halfPlate from './armor/half-plate.json';
import chainMail from './armor/chain-mail.json';
import splint from './armor/splint.json';
import plate from './armor/plate.json';
import shield from './armor/shield.json';

// Gear
import potionOfHealing from './gear/potion-of-healing.json';
import potionOfGreaterHealing from './gear/potion-of-greater-healing.json';
import potionOfSuperiorHealing from './gear/potion-of-superior-healing.json';
import arrows from './gear/arrows.json';
import bolts from './gear/bolts.json';
import torch from './gear/torch.json';
import ropeHempen from './gear/rope-hempen.json';
import thievesTools from './gear/thieves-tools.json';
import healersKit from './gear/healers-kit.json';
import rations from './gear/rations.json';
import waterskin from './gear/waterskin.json';
import backpack from './gear/backpack.json';

// Magic items
import flameTongue from './magic/flame-tongue-longsword.json';
import cloakOfProtection from './magic/cloak-of-protection.json';
import bootsOfElvenkind from './magic/boots-of-elvenkind.json';
import ringOfProtection from './magic/ring-of-protection.json';
import gauntletsOfOgrePower from './magic/gauntlets-of-ogre-power.json';
import bagOfHolding from './magic/bag-of-holding.json';
import wandOfMagicMissiles from './magic/wand-of-magic-missiles.json';
import amuletOfHealth from './magic/amulet-of-health.json';

// === ItemTemplate (processed form) ===

export interface ItemTemplate {
  id: string;
  name: string;
  type: string;
  category: ItemCategory;
  description: string;
  weight?: number;
  value?: number;
  equipSlot?: EquipmentSlot;
  rarity: ItemRarity;
  iconPlaceholder: string;
  // Сырые данные для деталей
  raw: RawItemData;
}

// === Генерация описания из свойств ===

function buildDescription(raw: RawItemData): string {
  const parts: string[] = [];
  const typeCode = raw.type?.split('|')[0] ?? '';

  // Оружие — урон и свойства
  if (raw.weapon || typeCode === 'M' || typeCode === 'R') {
    const dmgParts: string[] = [];
    if (raw.dmg1 && raw.dmgType) {
      dmgParts.push(`${raw.dmg1} ${DAMAGE_TYPE_NAMES[raw.dmgType] ?? raw.dmgType}`);
    }
    if (raw.dmg2) {
      dmgParts.push(`универсальное ${raw.dmg2}`);
    }
    if (dmgParts.length > 0) parts.push(dmgParts.join(', '));

    if (raw.weaponCategory) {
      parts.push(WEAPON_CATEGORY_NAMES[raw.weaponCategory] ?? raw.weaponCategory);
    }

    if (raw.property && raw.property.length > 0) {
      const props = raw.property
        .map(p => {
          const code = p.split('|')[0];
          return PROPERTY_NAMES[code] ?? code;
        })
        .filter(Boolean);
      if (props.length > 0) parts.push(props.join(', '));
    }

    if (raw.range) {
      parts.push(`Дальность: ${raw.range} фт.`);
    }

    if (raw.mastery && raw.mastery.length > 0) {
      const masteries = raw.mastery
        .map(m => {
          const code = m.split('|')[0];
          return MASTERY_NAMES[code] ?? code;
        })
        .filter(Boolean);
      if (masteries.length > 0) parts.push(`Мастерство: ${masteries.join(', ')}`);
    }

    if (raw.bonusWeapon) {
      parts.push(`Бонус: ${raw.bonusWeapon}`);
    }
  }

  // Доспехи — КД
  if (['LA', 'MA', 'HA', 'S'].includes(typeCode)) {
    if (typeCode === 'S') {
      parts.push(`КД +${raw.ac ?? 2}`);
    } else if (typeCode === 'LA') {
      parts.push(`КД ${raw.ac} + модификатор Ловкости`);
    } else if (typeCode === 'MA') {
      parts.push(`КД ${raw.ac} + модификатор Ловкости (макс. 2)`);
    } else if (typeCode === 'HA') {
      parts.push(`КД ${raw.ac}`);
    }

    if (raw.strength) {
      parts.push(`Требуется Сила ${raw.strength}`);
    }

    if (raw.stealth) {
      parts.push('Помеха Скрытности');
    }
  }

  // Записи из entries
  if (raw.entries && raw.entries.length > 0) {
    parts.push(...raw.entries);
  }

  // Настройка
  if (raw.reqAttune) {
    if (typeof raw.reqAttune === 'string') {
      parts.push(`Требуется настройка: ${raw.reqAttune}`);
    } else {
      parts.push('Требуется настройка');
    }
  }

  return parts.join('. ');
}

// === Генерация типа для отображения ===

function buildDisplayType(raw: RawItemData): string {
  const typeCode = raw.type?.split('|')[0] ?? '';

  if (raw.weapon || typeCode === 'M' || typeCode === 'R') {
    const cat = raw.weaponCategory
      ? (WEAPON_CATEGORY_NAMES[raw.weaponCategory] ?? raw.weaponCategory)
      : 'Оружие';
    const ranged = typeCode === 'R' ? ' (дальнобойное)' : '';
    return cat + ranged;
  }

  switch (typeCode) {
    case 'LA': return 'Лёгкий доспех';
    case 'MA': return 'Средний доспех';
    case 'HA': return 'Тяжёлый доспех';
    case 'S': return 'Щит';
    case 'P': return 'Зелье';
    case 'SC': return 'Свиток';
    case 'WD': return 'Жезл';
    case 'RD': return 'Жезл';
    case 'RG': return 'Кольцо';
    case 'A': return 'Боеприпас';
    case 'AT': return 'Инструменты';
    case 'G': return 'Снаряжение';
    case 'W': return 'Волшебный предмет';
    default: return 'Предмет';
  }
}

// === Определение слота экипировки ===

function resolveEquipSlot(raw: RawItemData): EquipmentSlot | undefined {
  // Явный слот из JSON
  if (raw.equipSlot) {
    return raw.equipSlot as EquipmentSlot;
  }

  const typeCode = raw.type?.split('|')[0] ?? '';

  // Для колец
  if (typeCode === 'RG') return 'ring1';

  // Для стандартных типов
  return TYPE_TO_EQUIP_SLOT[typeCode];
}

// === Определение категории ===

function resolveCategory(raw: RawItemData): ItemCategory {
  const typeCode = raw.type?.split('|')[0] ?? '';

  // Wondrous items — определяем по equipSlot
  if (typeCode === 'W' && raw.equipSlot) {
    const slot = raw.equipSlot as string;
    if (slot === 'helmet') return 'helmet';
    if (slot === 'boots') return 'boots';
    if (slot === 'gloves') return 'gloves';
    if (slot === 'cloak') return 'cloak';
    if (slot === 'amulet') return 'amulet';
  }

  return TYPE_TO_CATEGORY[typeCode] ?? 'misc';
}

// === Конвертация JSON → ItemTemplate ===

function toItemTemplate(raw: RawItemData): ItemTemplate {
  const name = raw.name;
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  return {
    id,
    name,
    type: buildDisplayType(raw),
    category: resolveCategory(raw),
    description: buildDescription(raw),
    weight: raw.weight,
    value: raw.value,
    equipSlot: resolveEquipSlot(raw),
    rarity: RARITY_MAP[raw.rarity ?? 'none'] ?? 'common',
    iconPlaceholder: getIconPlaceholder(raw),
    raw,
  };
}

// === Проверка: можно ли предмет экипировать в offhand ===

export function canEquipInOffhand(template: ItemTemplate): boolean {
  const raw = template.raw;
  const typeCode = raw.type?.split('|')[0] ?? '';

  // Щиты всегда идут в offhand
  if (typeCode === 'S') return true;

  // Оружие без свойства Two-Handed можно держать во второй руке
  if (raw.weapon || typeCode === 'M' || typeCode === 'R') {
    const hasTwoHanded = raw.property?.some(p => p.startsWith('2H')) ?? false;
    return !hasTwoHanded;
  }

  return false;
}

// === Проверка: двуручное ли оружие ===

export function isTwoHanded(template: ItemTemplate): boolean {
  const raw = template.raw;
  return raw.property?.some(p => p.startsWith('2H')) ?? false;
}

// === Проверка: лёгкое ли оружие ===

export function isLightWeapon(template: ItemTemplate): boolean {
  const raw = template.raw;
  return raw.property?.some(p => p.startsWith('L')) ?? false;
}

// === Все предметы ===

const ALL_RAW: RawItemData[] = [
  // Weapons
  dagger, shortsword, longsword, greatsword, rapier, scimitar,
  handaxe, battleaxe, greataxe, mace, warhammer, quarterstaff,
  spear, javelin, halberd, longbow, shortbow,
  lightCrossbow as unknown as RawItemData,
  handCrossbow as unknown as RawItemData,
  trident, flail,
  // Armor
  leather, studdedLeather, chainShirt, scaleMail,
  breastplate, halfPlate, chainMail, splint, plate, shield,
  // Gear
  potionOfHealing, potionOfGreaterHealing, potionOfSuperiorHealing,
  arrows, bolts, torch, ropeHempen, thievesTools,
  healersKit, rations, waterskin, backpack,
  // Magic
  flameTongue as unknown as RawItemData,
  cloakOfProtection as unknown as RawItemData,
  bootsOfElvenkind as unknown as RawItemData,
  ringOfProtection as unknown as RawItemData,
  gauntletsOfOgrePower as unknown as RawItemData,
  bagOfHolding as unknown as RawItemData,
  wandOfMagicMissiles as unknown as RawItemData,
  amuletOfHealth as unknown as RawItemData,
];

export const ITEM_TEMPLATES: ItemTemplate[] = ALL_RAW.map(toItemTemplate);

// Получить шаблон предмета по ID
export function getItemTemplate(id: string): ItemTemplate | undefined {
  return ITEM_TEMPLATES.find(item => item.id === id);
}

// Получить предметы по категории
export function getItemsByCategory(category: ItemCategory): ItemTemplate[] {
  return ITEM_TEMPLATES.filter(item => item.category === category);
}
