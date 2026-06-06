import type { Character, AbilityScores, InventoryItem } from '../types';
import { getAbilityModifier } from './dnd';
import { getClassById, findSubclass } from '../data/classes';
import { resolveCanonicalRace } from '../data/species';
import { FEAT_STAT_EFFECTS } from './featEffects';
import i18n from '../i18n';

// ── Effect definitions ──

export interface StatEffect {
  level?: number;                        // minimum level required (default: 1)
  hpPerLevel?: number;                   // +N HP per level
  hpFlat?: number;                       // flat HP bonus when effect first applies
  acFormula?: (keyof AbilityScores)[];   // custom AC = 10 + sum of these ability mods (requires no armor)
  acRequiresNoShield?: boolean;          // AC formula also requires no shield (Monk)
  speedBonus?: number;                   // flat speed bonus
  speedRequiresNoHeavyArmor?: boolean;   // speed bonus disabled in heavy armor (Barbarian Fast Movement)
  speedRequiresNoArmorOrShield?: boolean; // speed bonus disabled with any armor or shield (Monk)
  resistances?: string[];                // permanent damage resistances
  savingThrowProficiencies?: (keyof AbilityScores)[];  // saving throw proficiencies gained
  allSavingThrows?: boolean;             // proficiency in ALL saving throws
  // Flat bonus to ALL saving throws equal to an ability modifier (e.g. Paladin Aura
  // of Protection: +Cha mod, min +1). Applied live in the saving-throw display.
  saveBonusAbility?: keyof AbilityScores;
  saveBonusMin?: number;                 // floor for the save bonus (Aura: 1)
  // Flat bonus to initiative equal to an ability modifier (e.g. Gloom Stalker
  // Dread Ambusher: +Wis mod).
  initiativeBonusAbility?: keyof AbilityScores;
}

// ── Class-level effects (keyed by classId) ──

export const CLASS_EFFECTS: Record<string, StatEffect[]> = {
  barbarian: [
    { level: 1, acFormula: ['dexterity', 'constitution'] },                       // Unarmored Defense
    { level: 5, speedBonus: 10, speedRequiresNoHeavyArmor: true },               // Fast Movement (not in heavy armor)
  ],
  monk: [
    { level: 1, acFormula: ['dexterity', 'wisdom'], acRequiresNoShield: true },   // Unarmored Defense (no armor, no shield)
    { level: 2, speedBonus: 10, speedRequiresNoArmorOrShield: true },             // Unarmored Movement (no armor, no shield)
    { level: 6, speedBonus: 5, speedRequiresNoArmorOrShield: true },              // +15 total
    { level: 10, speedBonus: 5, speedRequiresNoArmorOrShield: true },             // +20 total
    { level: 14, speedBonus: 5, speedRequiresNoArmorOrShield: true, allSavingThrows: true },  // +25 + Disciplined Survivor
    { level: 18, speedBonus: 5, speedRequiresNoArmorOrShield: true },             // +30 total
  ],
  paladin: [
    { level: 6, saveBonusAbility: 'charisma', saveBonusMin: 1 },                  // Aura of Protection: +Cha mod (min +1) to all saves
  ],
};

// ── Subclass effects (keyed by "classId:subclassId") ──

export const SUBCLASS_EFFECTS: Record<string, StatEffect[]> = {
  'sorcerer:draconic': [
    { level: 3, hpFlat: 3, hpPerLevel: 1, acFormula: ['dexterity', 'charisma'] },  // Draconic Resilience
    // Elemental Affinity (L6): resistance to chosen type — applied via level-up choice UI
  ],
  'warlock:celestial': [
    { level: 6, resistances: ['radiant'] },  // Radiant Soul
  ],
  'ranger:gloom-stalker': [
    { level: 3, initiativeBonusAbility: 'wisdom' },      // Dread Ambusher: +Wis mod to initiative
    { level: 7, savingThrowProficiencies: ['wisdom'] },  // Iron Mind
  ],
};

// ── Species effects (keyed by species name) ──

export const SPECIES_EFFECTS: Record<string, StatEffect[]> = {
  'Dwarf': [
    { level: 1, hpPerLevel: 1 },  // Dwarven Toughness
  ],
};

// ── Helper: resolve subclass key from character ──

function getSubclassKey(char: Character): string | null {
  if (!char.subclass || !char.classId) return null;
  const classDef = getClassById(char.classId);
  if (!classDef) return null;
  if (!char.subclass) return null;
  const subDef = findSubclass(classDef, char.subclass);
  if (!subDef) return null;
  return `${char.classId}:${subDef.id}`;
}

// ── Helper: collect all active effects for a character ──

function getActiveEffects(char: Character): StatEffect[] {
  const effects: StatEffect[] = [];

  // Class effects
  const classEffects = CLASS_EFFECTS[char.classId];
  if (classEffects) {
    for (const e of classEffects) {
      if (char.level >= (e.level ?? 1)) {
        effects.push(e);
      }
    }
  }

  // Subclass effects
  const subKey = getSubclassKey(char);
  if (subKey) {
    const subEffects = SUBCLASS_EFFECTS[subKey];
    if (subEffects) {
      for (const e of subEffects) {
        if (char.level >= (e.level ?? 1)) {
          effects.push(e);
        }
      }
    }
  }

  // Species effects — keyed by canonical English name; resolve in case stored race is localized.
  const speciesEffects = SPECIES_EFFECTS[resolveCanonicalRace(char.race, char.raceSource)];
  if (speciesEffects) {
    for (const e of speciesEffects) {
      if (char.level >= (e.level ?? 1)) {
        effects.push(e);
      }
    }
  }

  return effects;
}

// ── Helper: collect NEW effects gained at a specific level ──

function getNewEffectsAtLevel(char: Character, newLevel: number): StatEffect[] {
  const effects: StatEffect[] = [];

  const classEffects = CLASS_EFFECTS[char.classId];
  if (classEffects) {
    for (const e of classEffects) {
      if ((e.level ?? 1) === newLevel) effects.push(e);
    }
  }

  const subKey = getSubclassKey(char);
  if (subKey) {
    const subEffects = SUBCLASS_EFFECTS[subKey];
    if (subEffects) {
      for (const e of subEffects) {
        if ((e.level ?? 1) === newLevel) effects.push(e);
      }
    }
  }

  return effects;
}

// ── Public API ──

/**
 * Returns the per-level HP bonus from class, subclass, and species features.
 * Used during level-up to add extra HP each level.
 */
export function getOngoingClassHpBonus(char: Character): number {
  let bonus = 0;
  const effects = getActiveEffects(char);
  for (const e of effects) {
    if (e.hpPerLevel) bonus += e.hpPerLevel;
  }
  return bonus;
}

/**
 * Get the equipped armor item (if any) from the armor slot.
 */
function getEquippedArmor(char: Character) {
  const armorSlotId = char.equipment?.armor;
  if (!armorSlotId) return null;
  const armorItem = char.inventory?.find(i => i.id === armorSlotId);
  if (!armorItem) return null;
  // Only count actual armor (not other items in the slot)
  if (armorItem.armorType && armorItem.armorType !== 'shield') return armorItem;
  if (armorItem.category === 'armor') return armorItem;
  return null;
}

/**
 * Check if character is wearing armor.
 */
function isWearingArmor(char: Character): boolean {
  return getEquippedArmor(char) !== null;
}

/**
 * Check if character is wearing heavy armor.
 */
function isWearingHeavyArmor(char: Character): boolean {
  const armor = getEquippedArmor(char);
  return armor?.armorType === 'heavy';
}

/**
 * Check if character is wielding a shield.
 */
function isWieldingShield(char: Character): boolean {
  const offhandId = char.equipment?.offhand;
  if (!offhandId) return false;
  const item = char.inventory?.find(i => i.id === offhandId);
  return item?.armorType === 'shield' || item?.category === 'shield';
}

/**
 * Calculate custom AC based on class/subclass AC formulas (Unarmored Defense).
 * Returns the best custom AC, or null if no custom formula applies.
 * Checks per-effect conditions: all require no armor, some also require no shield.
 */
export function getCustomAC(char: Character): number | null {
  // All Unarmored Defense formulas require no armor
  if (isWearingArmor(char)) return null;

  const effects = getActiveEffects(char);
  const hasShield = isWieldingShield(char);
  let bestAC: number | null = null;

  for (const e of effects) {
    if (e.acFormula) {
      // Monk: requires no shield; Barbarian/Draconic: shield allowed
      if (e.acRequiresNoShield && hasShield) continue;

      let ac = 10;
      for (const ability of e.acFormula) {
        ac += getAbilityModifier(char.abilityScores[ability]);
      }
      if (bestAC === null || ac > bestAC) {
        bestAC = ac;
      }
    }
  }

  // Feat-based unarmored formulas (e.g. Dragon Hide: AC = 13 + Dex; shield allowed).
  for (const feat of char.feats ?? []) {
    const fe = FEAT_STAT_EFFECTS[feat.nameEn ?? feat.name];
    if (fe?.unarmoredACBase != null) {
      let ac = fe.unarmoredACBase;
      for (const ability of fe.unarmoredACAbilities ?? []) {
        ac += getAbilityModifier(char.abilityScores[ability]);
      }
      if (bestAC === null || ac > bestAC) {
        bestAC = ac;
      }
    }
  }

  return bestAC;
}

/**
 * Calculate the total speed bonus from class/subclass features.
 * Respects armor conditions:
 * - Barbarian Fast Movement: disabled in heavy armor
 * - Monk Unarmored Movement: disabled with any armor or shield
 */
export function getClassSpeedBonus(char: Character): number {
  let bonus = 0;
  const heavyArmor = isWearingHeavyArmor(char);
  const anyArmor = isWearingArmor(char);
  const hasShield = isWieldingShield(char);
  const effects = getActiveEffects(char);
  for (const e of effects) {
    if (e.speedBonus) {
      if (e.speedRequiresNoHeavyArmor && heavyArmor) continue;
      if (e.speedRequiresNoArmorOrShield && (anyArmor || hasShield)) continue;
      bonus += e.speedBonus;
    }
  }
  return bonus;
}

/**
 * Flat bonus added to ALL saving throws from class/subclass features
 * (e.g. Paladin Aura of Protection: +Cha modifier, minimum +1).
 * Computed live in the saving-throw display alongside item bonuses.
 */
export function getClassFeatureSaveBonus(char: Character): number {
  const scores = getEffectiveAbilityScores(char);
  let bonus = 0;
  for (const e of getActiveEffects(char)) {
    if (e.saveBonusAbility) {
      const mod = getAbilityModifier(scores[e.saveBonusAbility]);
      bonus += Math.max(e.saveBonusMin ?? 0, mod);
    }
  }
  return bonus;
}

/**
 * Single source of truth for a character's initiative:
 *   Dex modifier
 *   + proficiency bonus if Alert (2024)
 *   + ability-modifier bonuses from class/subclass features
 *     (e.g. Gloom Stalker Dread Ambusher: +Wis modifier).
 * Initiative is a stored stat, so call this wherever it can change
 * (level-up, feat/ASI selection).
 */
export function computeInitiative(char: Character): number {
  return getInitiativeBreakdown(char).reduce((sum, p) => sum + p.value, 0);
}

/**
 * Get flat HP bonus to apply when a subclass is first selected.
 * Returns the hpFlat value from matching subclass effects.
 */
export function getSubclassHpFlatBonus(classId: string, subclassId: string): number {
  const key = `${classId}:${subclassId}`;
  const effects = SUBCLASS_EFFECTS[key];
  if (!effects) return 0;
  let flat = 0;
  for (const e of effects) {
    if (e.hpFlat) flat += e.hpFlat;
  }
  return flat;
}

/**
 * Calculate AC from equipped armor based on armor type.
 * Light: armorAC + DEX mod
 * Medium: armorAC + DEX mod (max 2)
 * Heavy: armorAC (no DEX)
 */
function getArmorBasedAC(char: Character): number | null {
  const armor = getEquippedArmor(char);
  if (!armor || !armor.armorAC) return null;

  const dexMod = getAbilityModifier(char.abilityScores.dexterity);

  switch (armor.armorType) {
    case 'light':
      return armor.armorAC + dexMod;
    case 'medium': {
      // Medium Armor Master raises the medium-armor Dex cap from +2 to +3.
      // (Below Dex 16 the modifier is ≤2 anyway, so the feat's "Dex 16+" clause is implicit.)
      const hasMediumArmorMaster = (char.feats ?? []).some(f => (f.nameEn ?? f.name) === 'Medium Armor Master');
      return armor.armorAC + Math.min(dexMod, hasMediumArmorMaster ? 3 : 2);
    }
    case 'heavy':
      return armor.armorAC;
    default:
      return null;
  }
}

/**
 * Get shield AC bonus if a shield is equipped.
 */
function getShieldBonus(char: Character): number {
  const offhandId = char.equipment?.offhand;
  if (!offhandId) return 0;
  const item = char.inventory?.find(i => i.id === offhandId);
  if (!item || (item.armorType !== 'shield' && item.category !== 'shield')) return 0;
  return item.armorAC ?? 2;
}

// ── Stat breakdowns (for tooltips) ──

/** One labelled component of a computed stat (AC, initiative, …). */
export interface StatPart {
  key: 'armor' | 'base' | 'ability' | 'shield' | 'feat' | 'item' | 'prof';
  value: number;
  ability?: keyof AbilityScores;  // set when key === 'ability'
}

/**
 * Best Unarmored Defense formula (class/subclass + feat) as labelled parts.
 * Mirrors getCustomAC's selection but keeps the components for display.
 */
function getBestUnarmoredFormulaParts(char: Character): { parts: StatPart[]; total: number } | null {
  if (isWearingArmor(char)) return null;
  const hasShield = isWieldingShield(char);
  let best: { parts: StatPart[]; total: number } | null = null;
  const consider = (parts: StatPart[]) => {
    const total = parts.reduce((s, p) => s + p.value, 0);
    if (!best || total > best.total) best = { parts, total };
  };

  for (const e of getActiveEffects(char)) {
    if (e.acFormula) {
      if (e.acRequiresNoShield && hasShield) continue;
      const parts: StatPart[] = [{ key: 'base', value: 10 }];
      for (const ability of e.acFormula) {
        parts.push({ key: 'ability', ability, value: getAbilityModifier(char.abilityScores[ability]) });
      }
      consider(parts);
    }
  }
  for (const feat of char.feats ?? []) {
    const fe = FEAT_STAT_EFFECTS[feat.nameEn ?? feat.name];
    if (fe?.unarmoredACBase != null) {
      const parts: StatPart[] = [{ key: 'base', value: fe.unarmoredACBase }];
      for (const ability of fe.unarmoredACAbilities ?? []) {
        parts.push({ key: 'ability', ability, value: getAbilityModifier(char.abilityScores[ability]) });
      }
      consider(parts);
    }
  }
  return best;
}

/**
 * AC as an ordered list of labelled parts. `resolveAC` is just the sum of these,
 * so the breakdown shown in tooltips always matches the displayed AC.
 * Considers: armor (by type) or Unarmored Defense / natural-armor feat formula,
 * shield, flat feat bonuses (Defense), and magic-item bonuses.
 */
export function getACBreakdown(inputChar: Character): StatPart[] {
  const char = { ...inputChar, abilityScores: getEffectiveAbilityScores(inputChar) };
  const dexMod = getAbilityModifier(char.abilityScores.dexterity);
  const parts: StatPart[] = [];

  const armor = getEquippedArmor(char);
  const armorAC = getArmorBasedAC(char);
  if (armor && armorAC !== null) {
    parts.push({ key: 'armor', value: armor.armorAC ?? 0 });
    // Heavy armor grants no Dex; light/medium add the (capped) Dex actually used.
    if (armor.armorType !== 'heavy') {
      parts.push({ key: 'ability', ability: 'dexterity', value: armorAC - (armor.armorAC ?? 0) });
    }
  } else {
    const formula = getBestUnarmoredFormulaParts(char);
    if (formula && formula.total > 10 + dexMod) {
      parts.push(...formula.parts);
    } else {
      parts.push({ key: 'base', value: 10 });
      parts.push({ key: 'ability', ability: 'dexterity', value: dexMod });
    }
  }

  const shield = getShieldBonus(char);
  if (shield) parts.push({ key: 'shield', value: shield });

  let featAc = 0;
  const wearingArmor = isWearingArmor(char);
  for (const feat of char.feats ?? []) {
    const effect = FEAT_STAT_EFFECTS[feat.nameEn ?? feat.name];
    // Defense and similar bonuses only apply while wearing armor.
    if (effect?.acBonus && (!effect.acBonusRequiresArmor || wearingArmor)) featAc += effect.acBonus;
  }
  if (featAc) parts.push({ key: 'feat', value: featAc });

  const itemAc = getEquippedItemBonuses(char).bonusAc;
  if (itemAc) parts.push({ key: 'item', value: itemAc });

  return parts;
}

/**
 * Resolve the full AC for a character (sum of the AC breakdown). Considers
 * equipped armor, Unarmored Defense formulas, shield, feat and item bonuses.
 */
export function resolveAC(inputChar: Character): number {
  return getACBreakdown(inputChar).reduce((sum, p) => sum + p.value, 0);
}

/** Initiative as labelled parts. `computeInitiative` is the sum of these. */
export function getInitiativeBreakdown(char: Character): StatPart[] {
  const scores = getEffectiveAbilityScores(char);
  const parts: StatPart[] = [
    { key: 'ability', ability: 'dexterity', value: getAbilityModifier(scores.dexterity) },
  ];
  if ((char.feats ?? []).some(f => (f.nameEn ?? f.name) === 'Alert')) {
    parts.push({ key: 'prof', value: char.proficiencyBonus });
  }
  for (const e of getActiveEffects(char)) {
    if (e.initiativeBonusAbility) {
      parts.push({ key: 'ability', ability: e.initiativeBonusAbility, value: getAbilityModifier(scores[e.initiativeBonusAbility]) });
    }
  }
  return parts;
}

/**
 * Same as resolveAC but accepts classId directly for character creation
 * (before the character object is fully built).
 */
export function resolveACForCreation(
  classId: string,
  abilityScores: AbilityScores,
): number {
  const standardAC = 10 + getAbilityModifier(abilityScores.dexterity);
  const classEffects = CLASS_EFFECTS[classId];
  if (!classEffects) return standardAC;

  let bestAC = standardAC;
  for (const e of classEffects) {
    if (e.acFormula && (e.level ?? 1) <= 1) {
      let ac = 10;
      for (const ability of e.acFormula) {
        ac += getAbilityModifier(abilityScores[ability]);
      }
      if (ac > bestAC) bestAC = ac;
    }
  }
  return bestAC;
}

/**
 * Get the subclass ID from a subclass name for a given class.
 */
export function getSubclassIdByName(classId: string, subclassName: string): string | null {
  const classDef = getClassById(classId);
  if (!classDef) return null;
  const subDef = findSubclass(classDef, subclassName);
  return subDef?.id ?? null;
}

/**
 * Apply permanent resistances and saving throw proficiencies gained at a new level.
 * Called during level-up after building the updated character.
 * Mutates the character object in place.
 */
export function applyLevelUpEffects(char: Character, newLevel: number): void {
  const newEffects = getNewEffectsAtLevel(char, newLevel);

  for (const e of newEffects) {
    // Apply permanent resistances
    if (e.resistances) {
      const existing = char.damageResistances ?? [];
      for (const type of e.resistances) {
        const alreadyHas = existing.some(r => r.type === type && r.modifier === 'resistance');
        if (!alreadyHas) {
          existing.push({ type, modifier: 'resistance' });
        }
      }
      char.damageResistances = existing;
    }

    // Apply saving throw proficiencies
    if (e.savingThrowProficiencies) {
      for (const ability of e.savingThrowProficiencies) {
        if (char.savingThrows[ability]) {
          char.savingThrows[ability].proficient = true;
        }
      }
    }

    // Apply all saving throw proficiencies
    if (e.allSavingThrows) {
      for (const ability of Object.keys(char.savingThrows) as (keyof AbilityScores)[]) {
        char.savingThrows[ability].proficient = true;
      }
    }
  }
}

// ── Proficiency checks ──

// English weapon name → localized proficiency name
function getWeaponProficiencyName(weaponKey: string): string {
  return i18n.t(`weaponProficiencies.${weaponKey}`, { ns: 'game' });
}

/**
 * Check if a character is proficient with an item.
 * D&D 5e rules:
 * - Armor: light, medium, heavy, shields, all
 * - Weapons: simple, martial, or specific weapon names
 */
export function hasItemProficiency(char: Character, item: InventoryItem): boolean {
  const proficiencies = char.proficiencies;

  // Armor proficiency check
  if (item.armorType) {
    const armorProfs = proficiencies.armor;
    const allArmorStr = i18n.t('armorProficiencies.all', { ns: 'game' });
    const hasAll = armorProfs.some(p => p === allArmorStr);

    const lightStr = i18n.t('armorProficiencies.light', { ns: 'game' });
    const mediumStr = i18n.t('armorProficiencies.medium', { ns: 'game' });
    const heavyStr = i18n.t('armorProficiencies.heavy', { ns: 'game' });
    const shieldStr = i18n.t('armorProficiencies.shield', { ns: 'game' });

    switch (item.armorType) {
      case 'light':
        return hasAll || armorProfs.some(p => p === lightStr);
      case 'medium':
        return hasAll || armorProfs.some(p => p === mediumStr);
      case 'heavy':
        return hasAll || armorProfs.some(p => p === heavyStr);
      case 'shield':
        return armorProfs.some(p => p === shieldStr || p.startsWith(shieldStr.split(/\s/)[0]));
      default:
        return true;
    }
  }

  // Weapon proficiency check
  if (item.category === 'weapon') {
    const weaponProfs = proficiencies.weapons;

    // Check broad category first (if weaponCategory is known)
    const simpleStr = i18n.t('weaponCategories.simple', { ns: 'game' });
    const martialStr = i18n.t('weaponCategories.martial', { ns: 'game' });
    if (item.weaponCategory === 'simple' && weaponProfs.some(p => p === simpleStr)) return true;
    if (item.weaponCategory === 'martial' && weaponProfs.some(p => p === martialStr)) return true;

    // Check specific weapon name: translate English item name and compare
    const profName = getWeaponProficiencyName(item.name.toLowerCase());
    if (profName && weaponProfs.some(p => p === profName)) return true;

    // Fallback: direct name comparison (for items already matching or exact match)
    if (weaponProfs.some(p => p.toLowerCase() === item.name.toLowerCase())) return true;

    // If weaponCategory is not set (old items), don't block equipping
    if (!item.weaponCategory) return true;

    return false;
  }

  // Non-armor, non-weapon items always count as proficient
  return true;
}

/**
 * Check if equipped armor is non-proficient (for AC penalty rules).
 * When wearing armor without proficiency:
 * - No AC bonus from the armor
 * - Disadvantage on STR/DEX checks and saving throws
 * - Cannot cast spells
 */
export function isWearingNonProficientArmor(char: Character): boolean {
  const armor = getEquippedArmor(char);
  if (!armor) return false;
  return !hasItemProficiency(char, armor);
}

/**
 * Parse a bonus string like "+1", "+2", "+3" to a number.
 */
function parseBonusString(val: any): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const n = parseInt(val, 10);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

export interface EquippedItemBonuses {
  bonusAc: number;
  bonusSavingThrow: number;
  bonusSpellAttack: number;
  bonusSpellSaveDc: number;
}

/**
 * Sum up bonuses from all equipped items.
 * Items with reqAttune only contribute if item.attuned === true.
 */
export function getEquippedItemBonuses(char: Character): EquippedItemBonuses {
  const result: EquippedItemBonuses = { bonusAc: 0, bonusSavingThrow: 0, bonusSpellAttack: 0, bonusSpellSaveDc: 0 };
  if (!char.equipment || !char.inventory) return result;

  const equippedIds = new Set(
    Object.values(char.equipment).filter((id): id is string => !!id)
  );

  for (const item of char.inventory) {
    if (!equippedIds.has(item.id)) continue;
    if (!item.raw) continue;
    // Items requiring attunement only give bonuses when attuned
    if (item.raw.reqAttune && !item.attuned) continue;

    result.bonusAc += parseBonusString(item.raw.bonusAc);
    result.bonusSavingThrow += parseBonusString(item.raw.bonusSavingThrow);
    result.bonusSpellAttack += parseBonusString(item.raw.bonusSpellAttack);
    result.bonusSpellSaveDc += parseBonusString(item.raw.bonusSpellSaveDc);
  }

  return result;
}

const ABILITY_ABBR_TO_FULL: Record<string, keyof AbilityScores> = {
  str: 'strength', dex: 'dexterity', con: 'constitution',
  int: 'intelligence', wis: 'wisdom', cha: 'charisma',
};

/**
 * Get effective ability scores after applying equipped item overrides.
 * Handles ability.static (set to fixed value, e.g. Gauntlets of Ogre Power → STR 19)
 * Uses the higher of base score and item override (per D&D rules).
 */
export function getEffectiveAbilityScores(char: Character): AbilityScores {
  const base = { ...char.abilityScores };
  if (!char.equipment || !char.inventory) return base;

  const equippedIds = new Set(
    Object.values(char.equipment).filter((id): id is string => !!id)
  );

  for (const item of char.inventory) {
    if (!equippedIds.has(item.id)) continue;
    if (!item.raw?.ability) continue;
    if (item.raw.reqAttune && !item.attuned) continue;

    const ability = item.raw.ability;

    // ability.static: { str: 19 } → set score to value (if higher than current)
    if (ability.static) {
      for (const [abbr, val] of Object.entries(ability.static)) {
        const key = ABILITY_ABBR_TO_FULL[abbr];
        if (key && typeof val === 'number' && val > base[key]) {
          base[key] = val;
        }
      }
    }
  }

  return base;
}
