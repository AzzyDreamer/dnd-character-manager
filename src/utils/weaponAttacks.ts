import type { Character } from '../types';
import { getAbilityModifier, formatModifier } from './dnd';
import { DAMAGE_TYPE_NAMES, PROPERTY_NAMES } from '../data/items/constants';
import { getEffectiveAbilityScores } from './classEffects';

function parseItemBonus(val: any): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') { const n = parseInt(val, 10); return isNaN(n) ? 0 : n; }
  return 0;
}

/** Extract weapon stats from raw item JSON data (fallback when not in static WEAPON_STATS table) */
function statsFromRaw(raw: Record<string, any>): WeaponStats | null {
  if (!raw.dmg1) return null;
  const dmgTypeCode = raw.dmgType ?? '';
  const damageType = DAMAGE_TYPE_NAMES[dmgTypeCode] ?? dmgTypeCode;
  const properties = (raw.property ?? [])
    .filter((p: any) => typeof p === 'string')
    .map((p: string) => PROPERTY_NAMES[p.split('|')[0]] ?? p.split('|')[0])
    .filter(Boolean);
  return { damage: raw.dmg1, damageType, properties };
}

interface WeaponStats {
  damage: string;
  damageType: string;
  properties: string[];
}

// Статическая таблица характеристик PHB оружия
const WEAPON_STATS: Record<string, WeaponStats> = {
  // Простое рукопашное
  'club': { damage: '1d4', damageType: 'дробящий', properties: ['лёгкое'] },
  'дубинка': { damage: '1d4', damageType: 'дробящий', properties: ['лёгкое'] },
  'dagger': { damage: '1d4', damageType: 'колющий', properties: ['фехтовальное', 'лёгкое', 'метательное'] },
  'кинжал': { damage: '1d4', damageType: 'колющий', properties: ['фехтовальное', 'лёгкое', 'метательное'] },
  'greatclub': { damage: '1d8', damageType: 'дробящий', properties: ['двуручное'] },
  'большая дубина': { damage: '1d8', damageType: 'дробящий', properties: ['двуручное'] },
  'handaxe': { damage: '1d6', damageType: 'рубящий', properties: ['лёгкое', 'метательное'] },
  'ручной топор': { damage: '1d6', damageType: 'рубящий', properties: ['лёгкое', 'метательное'] },
  'javelin': { damage: '1d6', damageType: 'колющий', properties: ['метательное'] },
  'метательное копьё': { damage: '1d6', damageType: 'колющий', properties: ['метательное'] },
  'light hammer': { damage: '1d4', damageType: 'дробящий', properties: ['лёгкое', 'метательное'] },
  'лёгкий молот': { damage: '1d4', damageType: 'дробящий', properties: ['лёгкое', 'метательное'] },
  'mace': { damage: '1d6', damageType: 'дробящий', properties: [] },
  'булава': { damage: '1d6', damageType: 'дробящий', properties: [] },
  'quarterstaff': { damage: '1d6', damageType: 'дробящий', properties: ['универсальное'] },
  'боевой посох': { damage: '1d6', damageType: 'дробящий', properties: ['универсальное'] },
  'sickle': { damage: '1d4', damageType: 'рубящий', properties: ['лёгкое'] },
  'серп': { damage: '1d4', damageType: 'рубящий', properties: ['лёгкое'] },
  'spear': { damage: '1d6', damageType: 'колющий', properties: ['метательное', 'универсальное'] },
  'копьё': { damage: '1d6', damageType: 'колющий', properties: ['метательное', 'универсальное'] },

  // Простое дальнобойное
  'light crossbow': { damage: '1d8', damageType: 'колющий', properties: ['боеприпасы', 'двуручное'] },
  'лёгкий арбалет': { damage: '1d8', damageType: 'колющий', properties: ['боеприпасы', 'двуручное'] },
  'dart': { damage: '1d4', damageType: 'колющий', properties: ['фехтовальное', 'метательное'] },
  'дротик': { damage: '1d4', damageType: 'колющий', properties: ['фехтовальное', 'метательное'] },
  'shortbow': { damage: '1d6', damageType: 'колющий', properties: ['боеприпасы', 'двуручное'] },
  'короткий лук': { damage: '1d6', damageType: 'колющий', properties: ['боеприпасы', 'двуручное'] },
  'sling': { damage: '1d4', damageType: 'дробящий', properties: ['боеприпасы'] },
  'праща': { damage: '1d4', damageType: 'дробящий', properties: ['боеприпасы'] },

  // Воинское рукопашное
  'battleaxe': { damage: '1d8', damageType: 'рубящий', properties: ['универсальное'] },
  'боевой топор': { damage: '1d8', damageType: 'рубящий', properties: ['универсальное'] },
  'flail': { damage: '1d8', damageType: 'дробящий', properties: [] },
  'цеп': { damage: '1d8', damageType: 'дробящий', properties: [] },
  'glaive': { damage: '1d10', damageType: 'рубящий', properties: ['тяжёлое', 'досягаемость', 'двуручное'] },
  'глефа': { damage: '1d10', damageType: 'рубящий', properties: ['тяжёлое', 'досягаемость', 'двуручное'] },
  'greataxe': { damage: '1d12', damageType: 'рубящий', properties: ['тяжёлое', 'двуручное'] },
  'секира': { damage: '1d12', damageType: 'рубящий', properties: ['тяжёлое', 'двуручное'] },
  'greatsword': { damage: '2d6', damageType: 'рубящий', properties: ['тяжёлое', 'двуручное'] },
  'двуручный меч': { damage: '2d6', damageType: 'рубящий', properties: ['тяжёлое', 'двуручное'] },
  'halberd': { damage: '1d10', damageType: 'рубящий', properties: ['тяжёлое', 'досягаемость', 'двуручное'] },
  'алебарда': { damage: '1d10', damageType: 'рубящий', properties: ['тяжёлое', 'досягаемость', 'двуручное'] },
  'lance': { damage: '1d12', damageType: 'колющий', properties: ['досягаемость'] },
  'копьё рыцарское': { damage: '1d12', damageType: 'колющий', properties: ['досягаемость'] },
  'longsword': { damage: '1d8', damageType: 'рубящий', properties: ['универсальное'] },
  'длинный меч': { damage: '1d8', damageType: 'рубящий', properties: ['универсальное'] },
  'maul': { damage: '2d6', damageType: 'дробящий', properties: ['тяжёлое', 'двуручное'] },
  'молот': { damage: '2d6', damageType: 'дробящий', properties: ['тяжёлое', 'двуручное'] },
  'morningstar': { damage: '1d8', damageType: 'колющий', properties: [] },
  'моргенштерн': { damage: '1d8', damageType: 'колющий', properties: [] },
  'pike': { damage: '1d10', damageType: 'колющий', properties: ['тяжёлое', 'досягаемость', 'двуручное'] },
  'пика': { damage: '1d10', damageType: 'колющий', properties: ['тяжёлое', 'досягаемость', 'двуручное'] },
  'rapier': { damage: '1d8', damageType: 'колющий', properties: ['фехтовальное'] },
  'рапира': { damage: '1d8', damageType: 'колющий', properties: ['фехтовальное'] },
  'scimitar': { damage: '1d6', damageType: 'рубящий', properties: ['фехтовальное', 'лёгкое'] },
  'скимитар': { damage: '1d6', damageType: 'рубящий', properties: ['фехтовальное', 'лёгкое'] },
  'shortsword': { damage: '1d6', damageType: 'колющий', properties: ['фехтовальное', 'лёгкое'] },
  'короткий меч': { damage: '1d6', damageType: 'колющий', properties: ['фехтовальное', 'лёгкое'] },
  'trident': { damage: '1d6', damageType: 'колющий', properties: ['метательное', 'универсальное'] },
  'трезубец': { damage: '1d6', damageType: 'колющий', properties: ['метательное', 'универсальное'] },
  'war pick': { damage: '1d8', damageType: 'колющий', properties: [] },
  'боевая кирка': { damage: '1d8', damageType: 'колющий', properties: [] },
  'warhammer': { damage: '1d8', damageType: 'дробящий', properties: ['универсальное'] },
  'боевой молот': { damage: '1d8', damageType: 'дробящий', properties: ['универсальное'] },
  'whip': { damage: '1d4', damageType: 'рубящий', properties: ['фехтовальное', 'досягаемость'] },
  'кнут': { damage: '1d4', damageType: 'рубящий', properties: ['фехтовальное', 'досягаемость'] },

  // Воинское дальнобойное
  'blowgun': { damage: '1', damageType: 'колющий', properties: ['боеприпасы'] },
  'духовая трубка': { damage: '1', damageType: 'колющий', properties: ['боеприпасы'] },
  'hand crossbow': { damage: '1d6', damageType: 'колющий', properties: ['боеприпасы', 'лёгкое'] },
  'ручной арбалет': { damage: '1d6', damageType: 'колющий', properties: ['боеприпасы', 'лёгкое'] },
  'heavy crossbow': { damage: '1d10', damageType: 'колющий', properties: ['боеприпасы', 'тяжёлое', 'двуручное'] },
  'тяжёлый арбалет': { damage: '1d10', damageType: 'колющий', properties: ['боеприпасы', 'тяжёлое', 'двуручное'] },
  'longbow': { damage: '1d8', damageType: 'колющий', properties: ['боеприпасы', 'тяжёлое', 'двуручное'] },
  'длинный лук': { damage: '1d8', damageType: 'колющий', properties: ['боеприпасы', 'тяжёлое', 'двуручное'] },
  'musket': { damage: '1d12', damageType: 'колющий', properties: ['боеприпасы', 'двуручное'] },
  'мушкет': { damage: '1d12', damageType: 'колющий', properties: ['боеприпасы', 'двуручное'] },
  'pistol': { damage: '1d10', damageType: 'колющий', properties: ['боеприпасы'] },
  'пистолет': { damage: '1d10', damageType: 'колющий', properties: ['боеприпасы'] },
};

// Дальнобойное оружие (для определения использования DEX)
const RANGED_KEYWORDS = ['лук', 'арбалет', 'праща', 'дротик', 'духовая', 'bow', 'crossbow', 'sling', 'dart', 'blowgun', 'musket', 'мушкет', 'pistol', 'пистолет'];

function isRanged(name: string): boolean {
  const lower = name.toLowerCase();
  return RANGED_KEYWORDS.some(kw => lower.includes(kw));
}

function isFinesse(stats: WeaponStats): boolean {
  return stats.properties.some(p => p.toLowerCase() === 'фехтовальное' || p.toLowerCase() === 'finesse');
}

function lookupWeaponStats(name: string): WeaponStats | undefined {
  const lower = name.toLowerCase();
  // Точное совпадение
  if (WEAPON_STATS[lower]) return WEAPON_STATS[lower];
  // Частичное совпадение
  for (const [key, val] of Object.entries(WEAPON_STATS)) {
    if (lower.includes(key) || key.includes(lower)) return val;
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
      name: 'Безоружный удар',
      slot: 'mainhand',
      attackBonus: monkBonus,
      attackBonusFormatted: formatModifier(monkBonus),
      damage,
      damageType: 'дробящий',
      properties: [],
      isRanged: false,
      image: '/images/Unarmed_Strike.webp',
    };
  }
  damage = strMod >= 0 ? `1 + ${strMod}` : `1 - ${Math.abs(strMod)}`;
  return {
    name: 'Безоружный удар',
    slot: 'mainhand',
    attackBonus,
    attackBonusFormatted: formatModifier(attackBonus),
    damage,
    damageType: 'дробящий',
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

    let stats = lookupWeaponStats(item.name) ?? (item.raw ? statsFromRaw(item.raw) : null);
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
    } else if (isFinesse(stats)) {
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
  club: ['Sap'], дубинка: ['Sap'],
  dagger: ['Nick'], кинжал: ['Nick'],
  greatclub: ['Push'], 'большая дубина': ['Push'],
  handaxe: ['Vex'], 'ручной топор': ['Vex'],
  javelin: ['Slow'], 'метательное копьё': ['Slow'],
  'light hammer': ['Nick'], 'лёгкий молот': ['Nick'],
  mace: ['Sap'], булава: ['Sap'],
  quarterstaff: ['Topple'], 'боевой посох': ['Topple'],
  sickle: ['Nick'], серп: ['Nick'],
  spear: ['Sap'], копьё: ['Sap'],
  'light crossbow': ['Slow'], 'лёгкий арбалет': ['Slow'],
  dart: ['Vex'], дротик: ['Vex'],
  shortbow: ['Vex'], 'короткий лук': ['Vex'],
  sling: ['Slow'], праща: ['Slow'],
  battleaxe: ['Topple'], 'боевой топор': ['Topple'],
  flail: ['Sap'], цеп: ['Sap'],
  glaive: ['Graze'], глефа: ['Graze'],
  greataxe: ['Cleave'], секира: ['Cleave'],
  greatsword: ['Graze'], 'двуручный меч': ['Graze'],
  halberd: ['Cleave'], алебарда: ['Cleave'],
  lance: ['Topple'], 'копьё рыцарское': ['Topple'],
  longsword: ['Sap'], 'длинный меч': ['Sap'],
  maul: ['Topple'], молот: ['Topple'],
  morningstar: ['Sap'], моргенштерн: ['Sap'],
  pike: ['Push'], пика: ['Push'],
  rapier: ['Vex'], рапира: ['Vex'],
  scimitar: ['Nick'], скимитар: ['Nick'],
  shortsword: ['Vex'], 'короткий меч': ['Vex'],
  trident: ['Topple'], трезубец: ['Topple'],
  'war pick': ['Sap'], 'боевая кирка': ['Sap'],
  warhammer: ['Push'], 'боевой молот': ['Push'],
  whip: ['Slow'], кнут: ['Slow'],
  blowgun: ['Vex'], 'духовая трубка': ['Vex'],
  'hand crossbow': ['Vex'], 'ручной арбалет': ['Vex'],
  'heavy crossbow': ['Push'], 'тяжёлый арбалет': ['Push'],
  longbow: ['Slow'], 'длинный лук': ['Slow'],
  musket: ['Slow'], мушкет: ['Slow'],
  pistol: ['Vex'], пистолет: ['Vex'],
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

  // Try matching item name against known weapon names
  const lowerName = item.name.toLowerCase();
  if (BASE_WEAPON_MASTERY[lowerName]) return BASE_WEAPON_MASTERY[lowerName];

  // Partial match: check if item name contains a base weapon name
  for (const [weaponName, mastery] of Object.entries(BASE_WEAPON_MASTERY)) {
    if (lowerName.includes(weaponName) || weaponName.includes(lowerName)) {
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
