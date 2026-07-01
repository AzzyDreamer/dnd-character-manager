import type { ItemCategory, ItemRarity, EquipmentSlot } from '../../types';
import i18n from '../../i18n';
import { applyOverlay } from '../translationOverlay';
import { asset } from '../../utils/asset';
import {
  TYPE_TO_CATEGORY,
  TYPE_TO_EQUIP_SLOT,
  RARITY_MAP,
  getDamageTypeName,
  getPropertyName,
  getMasteryName,
  getWeaponCategoryName,
  getIconPlaceholder,
  type RawItemData,
} from './constants';

// Re-export constants and i18n getters
export {
  getCategoryName,
  getRarityName,
  RARITY_COLORS,
  RARITY_BG_COLORS,
  getEquipmentSlotName,
  EQUIPMENT_SLOT_ICONS,
  getDamageTypeName,
  getPropertyName,
  getMasteryName,
} from './constants';

// === Загрузка всех предметов из единого бандла (scripts/bundle-data.mjs) ===

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

export async function init(): Promise<void> {
  if (_itemsInitialized) return;
  if (_itemsInitializing) return _itemsInitializing;

  _itemsInitializing = (async () => {
    const mod = await import('../_bundles/items.json');
    // Клонируем исходный JSON: оверлей переводов мутирует объекты на месте, а
    // кешированный импорт должен оставаться английским для смены языка в рантайме.
    const items = structuredClone(mod.default ?? mod) as ItemData[];

    for (const data of items) {
      if (data && typeof data === 'object' && data.name) {
        ALL_ITEMS.push(data as ItemData);
      }
    }

    ALL_ITEMS.sort((a, b) => a.name.localeCompare(b.name));
    await applyOverlay('items', ALL_ITEMS, i => i.name);
    _itemsInitialized = true;
  })();

  return _itemsInitializing;
}

/**
 * Сброс для повторной загрузки под другую локаль (см. registry.reloadForLocale).
 * Помимо ALL_ITEMS чистим кеш шаблонов: он строится из переведённых названий
 * items/items-base, поэтому registry пересоберёт его через buildAllTemplatesCache.
 */
export function reset(): void {
  _itemsInitialized = false;
  _itemsInitializing = null;
  ALL_ITEMS.length = 0;
  _allTemplatesCache = null;
  _loadingPromise = null;
  _staticTemplates = null;
}

export function getItemByName(name: string, source?: string): ItemData | undefined {
  const lc = name.toLowerCase();
  const matches = (i: ItemData) => i.name.toLowerCase() === lc || (i as any)._origName?.toLowerCase() === lc;
  if (source) {
    return ALL_ITEMS.find(i => matches(i) && i.source === source);
  }
  return ALL_ITEMS.find(matches);
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
  icon?: string;
  iconPlaceholder: string;
  // Сырые данные для деталей
  raw: RawItemData;
}

// === Генерация описания из свойств ===

function buildDescription(raw: RawItemData): string {
  const parts: string[] = [];
  const typeCode = (typeof raw.type === 'string' ? raw.type.split('|')[0] : '') ?? '';

  // Оружие — урон и свойства
  if (raw.weapon || typeCode === 'M' || typeCode === 'R') {
    const dmgParts: string[] = [];
    if (raw.dmg1 && raw.dmgType) {
      dmgParts.push(`${raw.dmg1} ${getDamageTypeName(raw.dmgType)}`);
    }
    if (raw.dmg2) {
      dmgParts.push(i18n.t('itemDesc.versatile', { ns: 'game', dmg: raw.dmg2 }));
    }
    if (dmgParts.length > 0) parts.push(dmgParts.join(', '));

    if (raw.weaponCategory) {
      parts.push(getWeaponCategoryName(raw.weaponCategory));
    }

    if (raw.property && raw.property.length > 0) {
      const props = raw.property
        .filter((p: any) => typeof p === 'string')
        .map((p: string) => {
          const code = p.split('|')[0];
          return getPropertyName(code);
        })
        .filter(Boolean);
      if (props.length > 0) parts.push(props.join(', '));
    }

    if (raw.range) {
      parts.push(i18n.t('itemDesc.range', { ns: 'game', range: raw.range }));
    }

    if (raw.mastery && raw.mastery.length > 0) {
      const masteries = raw.mastery
        .filter((m: any) => typeof m === 'string')
        .map((m: string) => {
          const code = m.split('|')[0];
          return getMasteryName(code);
        })
        .filter(Boolean);
      if (masteries.length > 0) parts.push(i18n.t('itemDesc.mastery', { ns: 'game', list: masteries.join(', ') }));
    }

    if (raw.bonusWeapon) {
      parts.push(i18n.t('itemDesc.bonus', { ns: 'game', bonus: raw.bonusWeapon }));
    }
  }

  // Доспехи — КД
  if (['LA', 'MA', 'HA', 'S'].includes(typeCode)) {
    if (typeCode === 'S') {
      parts.push(i18n.t('itemDesc.acShield', { ns: 'game', ac: raw.ac ?? 2 }));
    } else if (typeCode === 'LA') {
      parts.push(i18n.t('itemDesc.acLight', { ns: 'game', ac: raw.ac }));
    } else if (typeCode === 'MA') {
      parts.push(i18n.t('itemDesc.acMedium', { ns: 'game', ac: raw.ac }));
    } else if (typeCode === 'HA') {
      parts.push(i18n.t('itemDesc.acHeavy', { ns: 'game', ac: raw.ac }));
    }

    if (raw.strength) {
      parts.push(i18n.t('itemDesc.reqStrength', { ns: 'game', str: raw.strength }));
    }

    if (raw.stealth) {
      parts.push(i18n.t('itemDesc.stealthDisadvantage', { ns: 'game' }));
    }
  }

  // Записи из entries — только строки. Объекты (таблицы, вложенные записи)
  // в этом коротком описании не разворачиваем, иначе получаем "[object Object]";
  // полный контент рендерится через EntryRenderer в детальном виде.
  if (raw.entries && raw.entries.length > 0) {
    parts.push(...raw.entries.filter((e: any) => typeof e === 'string'));
  }

  // Настройка
  if (raw.reqAttune) {
    if (typeof raw.reqAttune === 'string') {
      parts.push(i18n.t('itemDesc.reqAttuneText', { ns: 'game', text: raw.reqAttune }));
    } else {
      parts.push(i18n.t('itemDesc.reqAttune', { ns: 'game' }));
    }
  }

  return parts.join('. ');
}

// === Генерация типа для отображения ===

function buildDisplayType(raw: RawItemData): string {
  const typeCode = (typeof raw.type === 'string' ? raw.type.split('|')[0] : '') ?? '';

  if (raw.weapon || typeCode === 'M' || typeCode === 'R') {
    const cat = raw.weaponCategory
      ? getWeaponCategoryName(raw.weaponCategory)
      : i18n.t('itemDisplayTypes.weapon', { ns: 'game' });
    const ranged = typeCode === 'R' ? i18n.t('itemDisplayTypes.rangedSuffix', { ns: 'game' }) : '';
    return cat + ranged;
  }

  switch (typeCode) {
    case 'LA': return i18n.t('itemDisplayTypes.LA', { ns: 'game' });
    case 'MA': return i18n.t('itemDisplayTypes.MA', { ns: 'game' });
    case 'HA': return i18n.t('itemDisplayTypes.HA', { ns: 'game' });
    case 'S': return i18n.t('itemDisplayTypes.S', { ns: 'game' });
    case 'P': return i18n.t('itemDisplayTypes.P', { ns: 'game' });
    case 'SC': return i18n.t('itemDisplayTypes.SC', { ns: 'game' });
    case 'WD': return i18n.t('itemDisplayTypes.WD', { ns: 'game' });
    case 'RD': return i18n.t('itemDisplayTypes.WD', { ns: 'game' });
    case 'RG': return i18n.t('itemDisplayTypes.RG', { ns: 'game' });
    case 'A': return i18n.t('itemDisplayTypes.A', { ns: 'game' });
    case 'AT': return i18n.t('itemDisplayTypes.AT', { ns: 'game' });
    case 'G': return i18n.t('itemDisplayTypes.G', { ns: 'game' });
    case 'W': return i18n.t('itemDisplayTypes.W', { ns: 'game' });
    default: return i18n.t('itemDisplayTypes.default', { ns: 'game' });
  }
}

// === Определение слота экипировки ===

function resolveEquipSlot(raw: RawItemData): EquipmentSlot | undefined {
  // Явный слот из JSON (с маппингом legacy → accessory)
  if (raw.equipSlot) {
    const slot = raw.equipSlot as string;
    if (slot === 'amulet' || slot === 'ring1' || slot === 'ring2') return 'accessory1';
    return slot as EquipmentSlot;
  }

  const typeCode = (typeof raw.type === 'string' ? raw.type.split('|')[0] : '') ?? '';

  // Для стандартных типов (включая RG, WD, RD, SCF → accessory1)
  if (TYPE_TO_EQUIP_SLOT[typeCode]) return TYPE_TO_EQUIP_SLOT[typeCode];

  // Wondrous items — определяем слот по названию
  if (typeCode === 'W' || raw.wondrous) {
    const n = raw.name.toLowerCase();
    if (n.includes('cloak') || n.includes('mantle') || n.includes('cape')) return 'cloak';
    if (n.includes('helm') || n.includes('headband') || n.includes('circlet') || n.includes('hat') || n.includes('crown')) return 'helmet';
    if (n.includes('boots') || n.includes('slippers') || n.includes('shoes')) return 'boots';
    if (n.includes('gloves') || n.includes('gauntlets') || n.includes('bracers')) return 'gloves';
    return 'accessory1';
  }

  return undefined;
}

// === Определение категории ===

function resolveCategory(raw: RawItemData): ItemCategory {
  const typeCode = (typeof raw.type === 'string' ? raw.type.split('|')[0] : '') ?? '';

  // Wondrous items — определяем по equipSlot
  if (typeCode === 'W' && raw.equipSlot) {
    const slot = raw.equipSlot as string;
    if (slot === 'helmet') return 'helmet';
    if (slot === 'boots') return 'boots';
    if (slot === 'gloves') return 'gloves';
    if (slot === 'cloak') return 'cloak';
    if (slot === 'amulet') return 'amulet'; // legacy support for JSON data
  }

  return TYPE_TO_CATEGORY[typeCode] ?? 'misc';
}

// === Конвертация JSON → ItemTemplate ===

function getItemImageUrl(name: string): string {
  const filename = name.replace(/[^a-zA-Z0-9]/g, '_');
  return asset(`/images/items-base/${filename}.webp`);
}

function toItemTemplate(raw: RawItemData): ItemTemplate {
  const name = raw.name;
  // ID строим из английского имени (_origName), а не из переведённого name:
  // под RU локалью slug([^a-z0-9]) вырезал бы всю кириллицу, схлопывая десятки
  // предметов в один пустой/одинаковый id → дубликаты React-ключей ломают
  // выделение и поиск/фильтры в модалке добавления. _origName задаёт overlay.
  const idBase = (raw as { _origName?: string })._origName ?? name;
  const id = idBase.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

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
    // Image files are named after the English item name; use _origName when the
    // overlay has translated raw.name so the icon path stays valid under i18n.
    icon: getItemImageUrl((raw as { _origName?: string })._origName ?? name),
    iconPlaceholder: getIconPlaceholder(raw),
    raw,
  };
}

// === Проверка: можно ли предмет экипировать в offhand ===

export function canEquipInOffhand(template: ItemTemplate): boolean {
  const raw = template.raw;
  const typeCode = (typeof raw.type === 'string' ? raw.type.split('|')[0] : '') ?? '';

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

// === Тип брони из raw данных ===

const ARMOR_TYPE_MAP: Record<string, 'light' | 'medium' | 'heavy' | 'shield'> = {
  'LA': 'light',
  'MA': 'medium',
  'HA': 'heavy',
  'S': 'shield',
};

export function getArmorType(template: ItemTemplate): 'light' | 'medium' | 'heavy' | 'shield' | undefined {
  const typeCode = (typeof template.raw.type === 'string' ? template.raw.type.split('|')[0] : '') ?? '';
  return ARMOR_TYPE_MAP[typeCode];
}

export function getWeaponCategory(template: ItemTemplate): 'simple' | 'martial' | undefined {
  const raw = template.raw;
  if (raw.weaponCategory === 'simple') return 'simple';
  if (raw.weaponCategory === 'martial') return 'martial';
  return undefined;
}

export function getWeaponMastery(template: ItemTemplate): string[] | undefined {
  const raw = template.raw;
  if (!raw.mastery || raw.mastery.length === 0) return undefined;
  return raw.mastery.filter((m: any) => typeof m === 'string').map((m: string) => m.split('|')[0]);
}

export function getArmorAC(template: ItemTemplate): number | undefined {
  const typeCode = (typeof template.raw.type === 'string' ? template.raw.type.split('|')[0] : '') ?? '';
  if (['LA', 'MA', 'HA', 'S'].includes(typeCode)) {
    return template.raw.ac;
  }
  return undefined;
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
];

// Статические шаблоны (оружие/броня/снаряжение из локальных JSON).
// Считаем лениво и мемоизируем: toItemTemplate → buildDescription дёргает i18n.t,
// а вызывать его на верхнем уровне модуля нельзя — i18n к этому моменту может быть
// ещё не готов (ломает HMR и порядок инициализации). Сбрасывается в reset().
let _staticTemplates: ItemTemplate[] | null = null;
export function getStaticItemTemplates(): ItemTemplate[] {
  return _staticTemplates ?? (_staticTemplates = ALL_RAW.map(toItemTemplate));
}

// Все шаблоны предметов (статические + items-base + items корневые)
let _allTemplatesCache: ItemTemplate[] | null = null;
let _loadingPromise: Promise<ItemTemplate[]> | null = null;

/**
 * Load all item templates using the same approach as Glossary:
 * 1. First load items-base (155 files — fast) and report progress
 * 2. Then load root items (1700+ files) and merge
 */
/**
 * Build the full templates cache synchronously.
 * Call AFTER both items-base and items init() have completed (e.g. from registry).
 */
export function buildAllTemplatesCache(itemsBaseMod: { ALL_ITEMS_BASE: any[] }): void {
  if (_allTemplatesCache) return;

  // Пересобираем статические шаблоны из сырых данных (а не переиспользуем
  // ITEM_TEMPLATES), чтобы описания/типы строились под текущую локаль — нужно
  // для смены языка в рантайме (см. registry.reloadForLocale + reset).
  const staticTemplates = ALL_RAW.map(toItemTemplate);
  const seen = new Set(staticTemplates.map(t => t.name.toLowerCase()));
  const allTemplates = [...staticTemplates];

  for (const raw of itemsBaseMod.ALL_ITEMS_BASE) {
    const key = raw.name.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      allTemplates.push(toItemTemplate(raw as unknown as RawItemData));
    }
  }

  for (const raw of ALL_ITEMS) {
    const key = raw.name.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      allTemplates.push(toItemTemplate(raw as unknown as RawItemData));
    }
  }

  allTemplates.sort((a, b) => a.name.localeCompare(b.name));
  _allTemplatesCache = allTemplates;
}

export function loadAllItemTemplates(onProgress?: (items: ItemTemplate[]) => void): Promise<ItemTemplate[]> {
  if (_allTemplatesCache) {
    onProgress?.(_allTemplatesCache);
    return Promise.resolve(_allTemplatesCache);
  }
  if (_loadingPromise) return _loadingPromise;

  _loadingPromise = (async () => {
    // Пересобираем статические шаблоны из сырых данных под текущую локаль
    // (см. buildAllTemplatesCache).
    const staticTemplates = ALL_RAW.map(toItemTemplate);
    const seen = new Set(staticTemplates.map(t => t.name.toLowerCase()));
    const allTemplates = [...staticTemplates];

    // Phase 1: load items-base (155 files — fast, base weapons/armor/gear)
    try {
      const itemsBase = await import('../items-base');
      await itemsBase.init();
      for (const raw of itemsBase.ALL_ITEMS_BASE) {
        const key = raw.name.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          allTemplates.push(toItemTemplate(raw as unknown as RawItemData));
        }
      }
      allTemplates.sort((a, b) => a.name.localeCompare(b.name));
      onProgress?.(allTemplates);
    } catch (e) {
      console.warn('Failed to load items-base:', e);
    }

    // Phase 2: load root items (1700+ magic items with descriptions)
    await init();
    for (const raw of ALL_ITEMS) {
      const key = raw.name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        allTemplates.push(toItemTemplate(raw as unknown as RawItemData));
      }
    }

    allTemplates.sort((a, b) => a.name.localeCompare(b.name));
    _allTemplatesCache = allTemplates;
    onProgress?.(allTemplates);
    return allTemplates;
  })();

  return _loadingPromise;
}

export function getAllItemTemplatesSync(): ItemTemplate[] {
  return _allTemplatesCache ?? getStaticItemTemplates();
}

export async function getAllItemTemplates(): Promise<ItemTemplate[]> {
  return _allTemplatesCache ?? loadAllItemTemplates();
}

// Получить шаблон предмета по ID
export function getItemTemplate(id: string): ItemTemplate | undefined {
  return (_allTemplatesCache ?? getStaticItemTemplates()).find(item => item.id === id);
}

// Получить предметы по категории
export function getItemsByCategory(category: ItemCategory): ItemTemplate[] {
  return (_allTemplatesCache ?? getStaticItemTemplates()).filter(item => item.category === category);
}
