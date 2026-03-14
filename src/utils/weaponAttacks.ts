import type { Character } from '../types';
import { getAbilityModifier, formatModifier } from './dnd';

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
  return stats.properties.some(p => p === 'фехтовальное' || p === 'finesse');
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
  slot: 'mainhand' | 'offhand';
  attackBonus: number;
  attackBonusFormatted: string;
  damage: string;
  damageType: string;
  properties: string[];
}

export function getEquippedWeaponAttacks(character: Character): WeaponAttack[] {
  const attacks: WeaponAttack[] = [];
  const slots = ['mainhand', 'offhand'] as const;

  for (const slot of slots) {
    const itemId = character.equipment[slot];
    if (!itemId) continue;

    const item = character.inventory.find(i => i.id === itemId);
    if (!item || item.category !== 'weapon') continue;

    const stats = lookupWeaponStats(item.name);
    if (!stats) {
      // Оружие не найдено в таблице — показываем без расчёта
      attacks.push({
        name: item.name,
        slot,
        attackBonus: character.proficiencyBonus,
        attackBonusFormatted: formatModifier(character.proficiencyBonus),
        damage: '?',
        damageType: '?',
        properties: [],
      });
      continue;
    }

    const strMod = getAbilityModifier(character.abilityScores.strength);
    const dexMod = getAbilityModifier(character.abilityScores.dexterity);

    let abilityMod: number;
    if (isRanged(item.name)) {
      abilityMod = dexMod;
    } else if (isFinesse(stats)) {
      abilityMod = Math.max(strMod, dexMod);
    } else {
      abilityMod = strMod;
    }

    const attackBonus = character.proficiencyBonus + abilityMod;
    const damageStr = abilityMod >= 0
      ? `${stats.damage} + ${abilityMod}`
      : `${stats.damage} - ${Math.abs(abilityMod)}`;

    attacks.push({
      name: item.name,
      slot,
      attackBonus,
      attackBonusFormatted: formatModifier(attackBonus),
      damage: damageStr,
      damageType: stats.damageType,
      properties: stats.properties,
    });
  }

  return attacks;
}
