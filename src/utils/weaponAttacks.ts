import type { Character } from '../types';
import { getAbilityModifier, formatModifier } from './dnd';
import { getDamageTypeName, getPropertyName } from '../data/items/constants';
import { getEffectiveAbilityScores } from './classEffects';
import i18n from '../i18n';

function parseItemBonus(val: any): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') { const n = parseInt(val, 10); return isNaN(n) ? 0 : n; }
  return 0;
}

/** Extract weapon stats from raw item JSON data (fallback when not in static WEAPON_STATS table) */
function statsFromRaw(raw: Record<string, any>): WeaponStats | null {
  if (!raw.dmg1) return null;
  const dmgTypeCode = raw.dmgType ?? '';
  const damageType = getDamageTypeName(dmgTypeCode);
  const properties = (raw.property ?? [])
    .filter((p: any) => typeof p === 'string')
    .map((p: string) => getPropertyName(p.split('|')[0]))
    .filter(Boolean);
  return { damage: raw.dmg1, damageType, properties };
}

interface WeaponStats {
  damage: string;
  damageType: string;
  properties: string[];
}

// Внутреннее представление: коды типов урона и свойств (переводятся при отдаче)
interface WeaponStatsInternal {
  damage: string;
  damageTypeCode: string;    // 'B', 'S', 'P'
  propertyCodes: string[];   // ['L'], ['F', 'L', 'T'], etc.
}

// Статическая таблица характеристик PHB оружия (только английские ключи, коды свойств)
const WEAPON_STATS_INTERNAL: Record<string, WeaponStatsInternal> = {
  // Простое рукопашное
  'club':            { damage: '1d4',  damageTypeCode: 'B', propertyCodes: ['L'] },
  'dagger':          { damage: '1d4',  damageTypeCode: 'P', propertyCodes: ['F', 'L', 'T'] },
  'greatclub':       { damage: '1d8',  damageTypeCode: 'B', propertyCodes: ['2H'] },
  'handaxe':         { damage: '1d6',  damageTypeCode: 'S', propertyCodes: ['L', 'T'] },
  'javelin':         { damage: '1d6',  damageTypeCode: 'P', propertyCodes: ['T'] },
  'light hammer':    { damage: '1d4',  damageTypeCode: 'B', propertyCodes: ['L', 'T'] },
  'mace':            { damage: '1d6',  damageTypeCode: 'B', propertyCodes: [] },
  'quarterstaff':    { damage: '1d6',  damageTypeCode: 'B', propertyCodes: ['V'] },
  'sickle':          { damage: '1d4',  damageTypeCode: 'S', propertyCodes: ['L'] },
  'spear':           { damage: '1d6',  damageTypeCode: 'P', propertyCodes: ['T', 'V'] },

  // Простое дальнобойное
  'light crossbow':  { damage: '1d8',  damageTypeCode: 'P', propertyCodes: ['AM', '2H'] },
  'dart':            { damage: '1d4',  damageTypeCode: 'P', propertyCodes: ['F', 'T'] },
  'shortbow':        { damage: '1d6',  damageTypeCode: 'P', propertyCodes: ['AM', '2H'] },
  'sling':           { damage: '1d4',  damageTypeCode: 'B', propertyCodes: ['AM'] },

  // Воинское рукопашное
  'battleaxe':       { damage: '1d8',  damageTypeCode: 'S', propertyCodes: ['V'] },
  'flail':           { damage: '1d8',  damageTypeCode: 'B', propertyCodes: [] },
  'glaive':          { damage: '1d10', damageTypeCode: 'S', propertyCodes: ['H', 'R', '2H'] },
  'greataxe':        { damage: '1d12', damageTypeCode: 'S', propertyCodes: ['H', '2H'] },
  'greatsword':      { damage: '2d6',  damageTypeCode: 'S', propertyCodes: ['H', '2H'] },
  'halberd':         { damage: '1d10', damageTypeCode: 'S', propertyCodes: ['H', 'R', '2H'] },
  'lance':           { damage: '1d12', damageTypeCode: 'P', propertyCodes: ['R'] },
  'longsword':       { damage: '1d8',  damageTypeCode: 'S', propertyCodes: ['V'] },
  'maul':            { damage: '2d6',  damageTypeCode: 'B', propertyCodes: ['H', '2H'] },
  'morningstar':     { damage: '1d8',  damageTypeCode: 'P', propertyCodes: [] },
  'pike':            { damage: '1d10', damageTypeCode: 'P', propertyCodes: ['H', 'R', '2H'] },
  'rapier':          { damage: '1d8',  damageTypeCode: 'P', propertyCodes: ['F'] },
  'scimitar':        { damage: '1d6',  damageTypeCode: 'S', propertyCodes: ['F', 'L'] },
  'shortsword':      { damage: '1d6',  damageTypeCode: 'P', propertyCodes: ['F', 'L'] },
  'trident':         { damage: '1d6',  damageTypeCode: 'P', propertyCodes: ['T', 'V'] },
  'war pick':        { damage: '1d8',  damageTypeCode: 'P', propertyCodes: [] },
  'warhammer':       { damage: '1d8',  damageTypeCode: 'B', propertyCodes: ['V'] },
  'whip':            { damage: '1d4',  damageTypeCode: 'S', propertyCodes: ['F', 'R'] },

  // Воинское дальнобойное
  'blowgun':         { damage: '1',    damageTypeCode: 'P', propertyCodes: ['AM'] },
  'hand crossbow':   { damage: '1d6',  damageTypeCode: 'P', propertyCodes: ['AM', 'L'] },
  'heavy crossbow':  { damage: '1d10', damageTypeCode: 'P', propertyCodes: ['AM', 'H', '2H'] },
  'longbow':         { damage: '1d8',  damageTypeCode: 'P', propertyCodes: ['AM', 'H', '2H'] },
  'musket':          { damage: '1d12', damageTypeCode: 'P', propertyCodes: ['AM', '2H'] },
  'pistol':          { damage: '1d10', damageTypeCode: 'P', propertyCodes: ['AM'] },
};

// Маппинг русских названий оружия → английские (для поиска по имени из инвентаря)
const RU_TO_EN_WEAPON: Record<string, string> = {
  'дубинка': 'club',
  'кинжал': 'dagger',
  'большая дубина': 'greatclub',
  'ручной топор': 'handaxe',
  'метательное копьё': 'javelin',
  'лёгкий молот': 'light hammer',
  'булава': 'mace',
  'боевой посох': 'quarterstaff',
  'серп': 'sickle',
  'копьё': 'spear',
  'лёгкий арбалет': 'light crossbow',
  'дротик': 'dart',
  'короткий лук': 'shortbow',
  'праща': 'sling',
  'боевой топор': 'battleaxe',
  'цеп': 'flail',
  'глефа': 'glaive',
  'секира': 'greataxe',
  'двуручный меч': 'greatsword',
  'алебарда': 'halberd',
  'копьё рыцарское': 'lance',
  'длинный меч': 'longsword',
  'молот': 'maul',
  'моргенштерн': 'morningstar',
  'пика': 'pike',
  'рапира': 'rapier',
  'скимитар': 'scimitar',
  'короткий меч': 'shortsword',
  'трезубец': 'trident',
  'боевая кирка': 'war pick',
  'боевой молот': 'warhammer',
  'кнут': 'whip',
  'духовая трубка': 'blowgun',
  'ручной арбалет': 'hand crossbow',
  'тяжёлый арбалет': 'heavy crossbow',
  'длинный лук': 'longbow',
  'мушкет': 'musket',
  'пистолет': 'pistol',
};

// Дальнобойное оружие (для определения использования DEX)
const RANGED_KEYWORDS = ['bow', 'crossbow', 'sling', 'dart', 'blowgun', 'musket', 'pistol'];

function isRanged(name: string): boolean {
  const lower = name.toLowerCase();
  // Нормализуем русское имя в английское для проверки
  const enName = RU_TO_EN_WEAPON[lower] ?? lower;
  return RANGED_KEYWORDS.some(kw => enName.includes(kw));
}

function isFinesse(stats: WeaponStatsInternal): boolean {
  return stats.propertyCodes.includes('F');
}

/** Translate internal stats to user-facing format */
function translateStats(internal: WeaponStatsInternal): WeaponStats {
  return {
    damage: internal.damage,
    damageType: getDamageTypeName(internal.damageTypeCode),
    properties: internal.propertyCodes.map(c => getPropertyName(c)),
  };
}

function lookupWeaponStats(name: string): { internal: WeaponStatsInternal; translated: WeaponStats } | undefined {
  const lower = name.toLowerCase();
  // Нормализуем русское имя в английское
  const enName = RU_TO_EN_WEAPON[lower] ?? lower;

  // Точное совпадение
  if (WEAPON_STATS_INTERNAL[enName]) {
    const internal = WEAPON_STATS_INTERNAL[enName];
    return { internal, translated: translateStats(internal) };
  }
  // Частичное совпадение
  for (const [key, val] of Object.entries(WEAPON_STATS_INTERNAL)) {
    if (enName.includes(key) || key.includes(enName)) {
      return { internal: val, translated: translateStats(val) };
    }
  }
  return undefined;
}

export interface WeaponAttack {
  name: string;
  slot: 'mainhand' | 'offhand' | 'rangedMainhand' | 'rangedOffhand';
  attackBonus: number;
  attackBonusFormatted: string;
  damage: string;
  damageType: string;
  properties: string[];
  isRanged: boolean;
  image: string;
}

export function getUnarmedStrike(inputCharacter: Character): WeaponAttack {
  const character = { ...inputCharacter, abilityScores: getEffectiveAbilityScores(inputCharacter) };
  const strMod = getAbilityModifier(character.abilityScores.strength);
  const attackBonus = character.proficiencyBonus + strMod;
  // Monk: martial arts die + DEX or STR
  const isMonk = character.classId === 'monk';
  let damage: string;
  let abilityMod: number;
  if (isMonk) {
    const dexMod = getAbilityModifier(character.abilityScores.dexterity);
    abilityMod = Math.max(strMod, dexMod);
    const monkBonus = character.proficiencyBonus + abilityMod;
    const martialDie = character.level >= 17 ? '1d12' : character.level >= 11 ? '1d10' : character.level >= 5 ? '1d8' : '1d6';
    damage = abilityMod >= 0 ? `${martialDie} + ${abilityMod}` : `${martialDie} - ${Math.abs(abilityMod)}`;
    return {
      name: i18n.t('weapons.unarmedStrike', { ns: 'game' }),
      slot: 'mainhand',
      attackBonus: monkBonus,
      attackBonusFormatted: formatModifier(monkBonus),
      damage,
      damageType: getDamageTypeName('B'),
      properties: [],
      isRanged: false,
      image: '/images/Unarmed_Strike.webp',
    };
  }
  damage = strMod >= 0 ? `1 + ${strMod}` : `1 - ${Math.abs(strMod)}`;
  return {
    name: i18n.t('weapons.unarmedStrike', { ns: 'game' }),
    slot: 'mainhand',
    attackBonus,
    attackBonusFormatted: formatModifier(attackBonus),
    damage,
    damageType: getDamageTypeName('B'),
    properties: [],
    isRanged: false,
    image: '/images/Unarmed_Strike.webp',
  };
}

export function getEquippedWeaponAttacks(inputCharacter: Character): WeaponAttack[] {
  const character = { ...inputCharacter, abilityScores: getEffectiveAbilityScores(inputCharacter) };
  const attacks: WeaponAttack[] = [];
  const slots = ['mainhand', 'offhand', 'rangedMainhand', 'rangedOffhand'] as const;

  for (const slot of slots) {
    const itemId = character.equipment[slot];
    if (!itemId) continue;

    const item = character.inventory.find(i => i.id === itemId);
    if (!item || item.category !== 'weapon') continue;

    const looked = lookupWeaponStats(item.name);
    let stats: WeaponStats | null = looked?.translated ?? (item.raw ? statsFromRaw(item.raw) : null);
    const internal = looked?.internal;
    const ranged = slot === 'rangedMainhand' || slot === 'rangedOffhand' || isRanged(item.name) || item.raw?.type === 'R';
    const isOffhand = slot === 'offhand' || slot === 'rangedOffhand';

    // Универсальное оружие: если offhand пустой — двуручный хват (dmg2)
    if (stats && slot === 'mainhand' && !character.equipment.offhand && item.raw?.dmg2) {
      const isVersatile = (item.raw?.property ?? []).some((p: any) => typeof p === 'string' && p.startsWith('V'));
      if (isVersatile) {
        stats = { ...stats, damage: item.raw.dmg2 };
      }
    }
    const attackImage = isOffhand
      ? (ranged ? '/images/Off-Hand_Attack_Ranged.webp' : '/images/Off-Hand_Attack_Melee.webp')
      : (ranged ? '/images/Ranged_Attack.webp' : '/images/Main_Hand_Attack.webp');

    if (!stats) {
      const wb = parseItemBonus(item.raw?.bonusWeapon);
      const ab = character.proficiencyBonus + wb;
      attacks.push({
        name: item.name,
        slot,
        attackBonus: ab,
        attackBonusFormatted: formatModifier(ab),
        damage: '?',
        damageType: '?',
        properties: [],
        isRanged: ranged,
        image: attackImage,
      });
      continue;
    }

    const strMod = getAbilityModifier(character.abilityScores.strength);
    const dexMod = getAbilityModifier(character.abilityScores.dexterity);

    let abilityMod: number;
    if (ranged) {
      abilityMod = dexMod;
    } else if (internal && isFinesse(internal)) {
      abilityMod = Math.max(strMod, dexMod);
    } else {
      abilityMod = strMod;
    }

    // Parse magic weapon bonus (+1, +2, +3)
    const weaponBonus = parseItemBonus(item.raw?.bonusWeapon);

    const attackBonus = character.proficiencyBonus + abilityMod + weaponBonus;
    const totalDamageMod = abilityMod + weaponBonus;
    const damageStr = totalDamageMod >= 0
      ? `${stats.damage} + ${totalDamageMod}`
      : `${stats.damage} - ${Math.abs(totalDamageMod)}`;

    attacks.push({
      name: item.name,
      slot,
      attackBonus,
      attackBonusFormatted: formatModifier(attackBonus),
      damage: damageStr,
      damageType: stats.damageType,
      properties: stats.properties,
      isRanged: ranged,
      image: attackImage,
    });
  }

  return attacks;
}

// ── Weapon Mastery Actions ──

export interface MasteryAction {
  id: string;
  name: string;
  description: string;
  image: string;
  weaponName: string;
}

interface MasteryInfo {
  name: string;
  description: string;
  image: string;
}

const MASTERY_DATA: Record<string, MasteryInfo> = {
  Cleave: {
    name: 'Cleave',
    description: 'If you hit a creature with a melee attack roll using this weapon, you can make a melee attack roll with the weapon against a second creature within 5 feet of the first that is also within your reach. On a hit, the second creature takes the weapon\'s damage, but don\'t add your ability modifier to that damage unless that modifier is negative. You can make this extra attack only once per turn.',
    image: '/images/mastery/Cleave.webp',
  },
  Graze: {
    name: 'Graze',
    description: 'If your attack roll with this weapon misses a creature, you can deal damage to that creature equal to the ability modifier you used to make the attack roll. This damage is the same type dealt by the weapon, and the damage can be increased only by increasing the ability modifier.',
    image: '/images/mastery/Tenacity.webp',
  },
  Nick: {
    name: 'Nick',
    description: 'When you make the extra attack of the Light property, you can make it as part of the Attack action instead of as a Bonus Action. You can make this extra attack only once per turn.',
    image: '/images/mastery/Lacerate.webp',
  },
  Push: {
    name: 'Push',
    description: 'If you hit a creature with this weapon, you can push the creature up to 10 feet straight away from you if it is Large or smaller.',
    image: '/images/mastery/Concussive_Smash.webp',
  },
  Sap: {
    name: 'Sap',
    description: 'If you hit a creature with this weapon, that creature has Disadvantage on its next attack roll before the start of your next turn.',
    image: '/images/mastery/Weakening_Strike.webp',
  },
  Slow: {
    name: 'Slow',
    description: 'If you hit a creature with this weapon and deal damage to it, you can reduce its Speed by 10 feet until the start of your next turn. If the creature is hit more than once by weapons that have this property, the Speed reduction doesn\'t exceed 10 feet.',
    image: '/images/mastery/Crippling_Strike.webp',
  },
  Topple: {
    name: 'Topple',
    description: 'If you hit a creature with this weapon, you can force the creature to make a Constitution saving throw (DC 8 + the ability modifier used to make the attack roll + your Proficiency Bonus). On a failed save, the creature has the Prone condition.',
    image: '/images/mastery/Topple.webp',
  },
  Vex: {
    name: 'Vex',
    description: 'If you hit a creature with this weapon and deal damage to the creature, you have Advantage on your next attack roll against that creature before the end of your next turn.',
    image: '/images/mastery/Prepare.webp',
  },
};

export function getMasteryInfo(masteryCode: string): MasteryInfo | undefined {
  return MASTERY_DATA[masteryCode];
}

// Mastery по базовому типу оружия (для предметов без собственного поля mastery)
const BASE_WEAPON_MASTERY: Record<string, string[]> = {
  club: ['Sap'],
  dagger: ['Nick'],
  greatclub: ['Push'],
  handaxe: ['Vex'],
  javelin: ['Slow'],
  'light hammer': ['Nick'],
  mace: ['Sap'],
  quarterstaff: ['Topple'],
  sickle: ['Nick'],
  spear: ['Sap'],
  'light crossbow': ['Slow'],
  dart: ['Vex'],
  shortbow: ['Vex'],
  sling: ['Slow'],
  battleaxe: ['Topple'],
  flail: ['Sap'],
  glaive: ['Graze'],
  greataxe: ['Cleave'],
  greatsword: ['Graze'],
  halberd: ['Cleave'],
  lance: ['Topple'],
  longsword: ['Sap'],
  maul: ['Topple'],
  morningstar: ['Sap'],
  pike: ['Push'],
  rapier: ['Vex'],
  scimitar: ['Nick'],
  shortsword: ['Vex'],
  trident: ['Topple'],
  'war pick': ['Sap'],
  warhammer: ['Push'],
  whip: ['Slow'],
  blowgun: ['Vex'],
  'hand crossbow': ['Vex'],
  'heavy crossbow': ['Push'],
  longbow: ['Slow'],
  musket: ['Slow'],
  pistol: ['Vex'],
};

/** Resolve mastery codes for an item, falling back to base weapon type */
function resolveItemMastery(item: { name: string; mastery?: string[]; raw?: any }): string[] | undefined {
  if (item.mastery && item.mastery.length > 0) return item.mastery;

  // Try baseItem field (e.g. "longsword|phb")
  const baseItem = item.raw?.baseItem;
  if (typeof baseItem === 'string') {
    const baseName = baseItem.split('|')[0].toLowerCase();
    if (BASE_WEAPON_MASTERY[baseName]) return BASE_WEAPON_MASTERY[baseName];
  }

  // Try matching item name against known weapon names (normalize Russian names)
  const lowerName = item.name.toLowerCase();
  const enName = RU_TO_EN_WEAPON[lowerName] ?? lowerName;
  if (BASE_WEAPON_MASTERY[enName]) return BASE_WEAPON_MASTERY[enName];

  // Partial match: check if item name contains a base weapon name
  for (const [weaponName, mastery] of Object.entries(BASE_WEAPON_MASTERY)) {
    if (enName.includes(weaponName) || weaponName.includes(enName)) {
      return mastery;
    }
  }

  return undefined;
}

export function getEquippedMasteryActions(character: Character): MasteryAction[] {
  const actions: MasteryAction[] = [];
  const seen = new Set<string>();
  const slots = ['mainhand', 'offhand', 'rangedMainhand', 'rangedOffhand'] as const;

  for (const slot of slots) {
    const itemId = character.equipment[slot];
    if (!itemId) continue;

    const item = character.inventory.find(i => i.id === itemId);
    if (!item || item.category !== 'weapon') continue;

    const masteryCodes = resolveItemMastery(item);
    if (!masteryCodes) continue;

    for (const masteryCode of masteryCodes) {
      if (seen.has(masteryCode)) continue;
      seen.add(masteryCode);

      const info = MASTERY_DATA[masteryCode];
      if (!info) continue;

      actions.push({
        id: masteryCode,
        name: info.name,
        description: info.description,
        image: info.image,
        weaponName: item.name,
      });
    }
  }

  return actions;
}
