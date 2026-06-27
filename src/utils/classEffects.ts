import type { Character, AbilityScores, InventoryItem } from '../types';
import { getAbilityModifier } from './dnd';
import { getClassById, findSubclass } from '../data/classes';
import { resolveCanonicalRace } from '../data/species';
import { FEAT_STAT_EFFECTS } from './featEffects';
import { getTransformACBonus, getTransformHpPerLevel, getTransformUnarmoredFormulas } from './transformationEffects';
import { getActiveAbilityFloors, getActiveACBonus, stripActiveOverlays } from './activatedEffects';
import { applyWildShapeAbilityOverride, getWildShapeAC } from './wildShape';
import { applyKindredAbilityOverride, getKindredAC } from './kindredForm';
import { getEquippedArmor, isWearingArmor, isWearingHeavyArmor, isWieldingShield } from './equipment';
import i18n from '../i18n';

// ── Effect definitions ──

export interface StatEffect {
  level?: number;                        // minimum level required (default: 1)
  hpPerLevel?: number;                   // +N HP per level
  hpFlat?: number;                       // flat HP bonus when effect first applies
  acFormula?: (keyof AbilityScores)[];   // custom AC = 10 + sum of these ability mods (requires no armor)
  acRequiresNoShield?: boolean;          // AC formula also requires no shield (Monk)
  acBonus?: number;                      // flat AC bonus (e.g. Forge cleric +1 in heavy armor)
  acBonusRequiresHeavyArmor?: boolean;   // AC bonus applies only while wearing heavy armor
  speedBonus?: number;                   // flat speed bonus
  speedRequiresNoHeavyArmor?: boolean;   // speed bonus disabled in heavy armor (Barbarian Fast Movement)
  speedRequiresNoArmorOrShield?: boolean; // speed bonus disabled with any armor or shield (Monk)
  resistances?: string[];                // permanent damage resistances
  immunities?: string[];                 // permanent damage immunities (e.g. Storm sorcerer L18)
  senses?: { darkvision?: number; blindsight?: number; tremorsense?: number; truesight?: number }; // permanent senses (max-merged)
  // Additional movement speeds; −1 = «равна скорости ходьбы» (Roving: climb/swim)
  moveSpeeds?: { fly?: number; swim?: number; climb?: number };
  savingThrowProficiencies?: (keyof AbilityScores)[];  // saving throw proficiencies gained
  allSavingThrows?: boolean;             // proficiency in ALL saving throws
  // Flat bonus to ALL saving throws equal to an ability modifier (e.g. Paladin Aura
  // of Protection: +Cha mod, min +1). Applied live in the saving-throw display.
  saveBonusAbility?: keyof AbilityScores;
  saveBonusMin?: number;                 // floor for the save bonus (Aura: 1)
  // Flat bonus to initiative equal to an ability modifier (e.g. Gloom Stalker
  // Dread Ambusher: +Wis mod).
  initiativeBonusAbility?: keyof AbilityScores;
  // Add proficiency bonus to initiative (Watchers paladin Aura of the Sentinel).
  initiativeAddProficiency?: boolean;
  // Advantage on initiative rolls (Champion, Assassin, Feral Instinct…) — shown
  // as a tooltip note; advantage itself is not a numeric stat.
  initiativeAdvantage?: boolean;
  // Resistance to N damage types of the player's choice (Draconic Elemental
  // Affinity, Storm Soul…). Prompted via a picker when the effect activates.
  resistanceChoice?: { count: number; from: string[] };
  // Saving-throw proficiency choice (e.g. Hag Form: Str/Int/Cha).
  saveProfChoice?: { count: number; from: (keyof AbilityScores)[] };
}

// ── Class-level effects (keyed by classId) ──

export const CLASS_EFFECTS: Record<string, StatEffect[]> = {
  barbarian: [
    { level: 1, acFormula: ['dexterity', 'constitution'] },                       // Unarmored Defense
    { level: 5, speedBonus: 10, speedRequiresNoHeavyArmor: true },               // Fast Movement (not in heavy armor)
    { level: 7, initiativeAdvantage: true },                                      // Feral Instinct
  ],
  gunslinger: [
    { level: 1, initiativeAdvantage: true },                                      // Quick Draw
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
  ranger: [
    { level: 6, speedBonus: 10, speedRequiresNoHeavyArmor: true, moveSpeeds: { climb: -1, swim: -1 } },  // Roving (not in heavy armor)
  ],
  rogue: [
    { level: 15, savingThrowProficiencies: ['wisdom', 'charisma'] },             // Slippery Mind
  ],
};

// ── Subclass effects (keyed by "classId:subclassId") ──
// Only always-on passive effects are wired here. Activated forms (Bladesong,
// Rage of the Gods…), aura buffs for allies, and per-rest choices stay as text.

export const SUBCLASS_EFFECTS: Record<string, StatEffect[]> = {
  'artificer:alchemist': [
    { level: 15, resistances: ['acid', 'poison'] },      // Chemical Mastery
  ],
  'barbarian:storm-herald': [
    { level: 6, resistanceChoice: { count: 1, from: ['fire', 'lightning', 'cold'] } },  // Storm Soul (по выбранной среде)
  ],
  'bard:adventurers': [
    { level: 3, acFormula: ['dexterity', 'charisma'] },  // Talented Adventurer (unarmored defense)
  ],
  'bard:dance': [
    { level: 3, acFormula: ['dexterity', 'charisma'] },  // Dazzling Footwork (unarmored defense)
  ],
  'cleric:eldritch': [
    { level: 6, resistances: ['psychic'] },              // Otherworldly Calm
  ],
  'cleric:forge': [
    { level: 6, resistances: ['fire'], acBonus: 1, acBonusRequiresHeavyArmor: true },  // Soul of the Forge
    { level: 17, immunities: ['fire'] },                 // Saint of Forge and Fire
  ],
  'cleric:knowledge': [
    { level: 6, savingThrowProficiencies: ['intelligence'] },  // Unfettered Mind
  ],
  'cleric:twilight': [
    { level: 3, senses: { darkvision: 300 } },           // Eyes of Night
  ],
  'cleric:war': [
    { level: 17, resistances: ['bludgeoning', 'piercing', 'slashing'] },  // Avatar of Battle (nonmagical)
  ],
  'fighter:champion': [
    { level: 3, initiativeAdvantage: true },             // Remarkable Athlete
  ],
  'fighter:nightwatcher': [
    { level: 3, senses: { darkvision: 60 }, initiativeAdvantage: true },  // Ever Vigilant
  ],
  'fighter:psi-warrior': [
    { level: 10, resistances: ['psychic'] },             // Guarded Mind
  ],
  'fighter:samurai': [
    { level: 7, savingThrowProficiencies: ['wisdom'] },  // Elegant Courtier
  ],
  'monk:elements': [
    // Elemental Epitome: тип можно менять после отдыха — начальный выбор
    { level: 17, resistanceChoice: { count: 1, from: ['acid', 'cold', 'fire', 'lightning', 'thunder'] } },
  ],
  'monk:shadow': [
    { level: 3, senses: { darkvision: 60 } },            // Shadow Arts
  ],
  'paladin:ancients': [
    { level: 7, resistances: ['necrotic', 'psychic', 'radiant'] },  // Aura of Warding
  ],
  'paladin:glory': [
    { level: 7, speedBonus: 10 },                        // Aura of Alacrity
  ],
  'paladin:noble-genie': [
    { level: 3, acFormula: ['dexterity', 'charisma'] },  // Genie's Splendor (unarmored defense)
  ],
  'paladin:watchers': [
    { level: 7, initiativeAddProficiency: true },        // Aura of the Sentinel
  ],
  'druid:land': [
    { level: 10, resistanceChoice: { count: 1, from: ['cold', 'fire', 'lightning', 'poison'] } },  // Nature's Ward (по выбранной земле)
  ],
  'ranger:drakewarden': [
    { level: 7, resistanceChoice: { count: 1, from: ['acid', 'cold', 'fire', 'lightning', 'poison'] } },  // Bond of Fang and Scale
  ],
  'ranger:green-reaper': [
    { level: 7, resistances: ['poison'] },               // Poison Control
  ],
  'ranger:gloom-stalker': [
    { level: 3, initiativeBonusAbility: 'wisdom', senses: { darkvision: 60 } },  // Dread Ambusher + Umbral Sight
    { level: 7, savingThrowProficiencies: ['wisdom'] },  // Iron Mind
  ],
  'ranger:vermin-lord': [
    { level: 7, savingThrowProficiencies: ['constitution'] },  // Filth and Fortitude
  ],
  'ranger:winter-walker': [
    { level: 3, resistances: ['cold'] },                 // Frigid Explorer
  ],
  'rogue:assassin': [
    { level: 3, initiativeAdvantage: true },             // Assassinate
  ],
  'rogue:scion-of-the-three': [
    { level: 3, resistanceChoice: { count: 1, from: ['psychic', 'poison', 'necrotic'] } },  // Dread Allegiance (по божеству)
  ],
  'rogue:scout': [
    { level: 9, speedBonus: 10 },                        // Superior Mobility
    { level: 13, initiativeAdvantage: true },            // Ambush Master
  ],
  'rogue:swashbuckler': [
    { level: 3, initiativeBonusAbility: 'charisma' },    // Rakish Audacity
  ],
  'sorcerer:aberrant-mind': [
    { level: 6, resistances: ['psychic'] },              // Psychic Defenses
  ],
  'sorcerer:apocalypse': [
    { level: 6, resistances: ['force'] },                // Bear Witness
  ],
  'sorcerer:draconic': [
    { level: 3, hpFlat: 3, hpPerLevel: 1, acFormula: ['dexterity', 'charisma'] },  // Draconic Resilience
    { level: 6, resistanceChoice: { count: 1, from: ['acid', 'cold', 'fire', 'lightning', 'poison'] } },  // Elemental Affinity
  ],
  'sorcerer:haunted': [
    { level: 6, resistances: ['necrotic'] },             // Deathly Pallor
  ],
  'sorcerer:shadow': [
    { level: 3, senses: { darkvision: 120 } },           // Eyes of the Dark
  ],
  'sorcerer:storm': [
    { level: 6, resistances: ['lightning', 'thunder'] }, // Heart of the Storm
    { level: 18, immunities: ['lightning', 'thunder'] }, // Wind Soul
  ],
  'sorcerer:wretched': [
    { level: 3, hpFlat: 1, hpPerLevel: 1, resistances: ['necrotic'] },  // Wretched Curse
  ],
  'warlock:celestial': [
    { level: 6, resistances: ['radiant'] },  // Radiant Soul
  ],
  'warlock:fathomless': [
    { level: 6, resistances: ['cold'] },                 // Oceanic Soul
  ],
  'warlock:fiend': [
    // Fiendish Resilience: тип меняется после отдыха — начальный выбор, дальше можно менять вручную
    { level: 10, resistanceChoice: { count: 1, from: ['acid', 'cold', 'fire', 'force', 'lightning', 'necrotic', 'poison', 'psychic', 'radiant', 'thunder'] } },
  ],
  'warlock:genie': [
    { level: 6, resistanceChoice: { count: 1, from: ['bludgeoning', 'thunder', 'fire', 'cold'] } },  // Elemental Gift (по виду патрона)
  ],
  'warlock:first-vampire': [
    { level: 3, senses: { darkvision: 60 } },            // Nocturnal Predator
    { level: 14, resistances: ['necrotic'] },            // Eternal Night
  ],
  'warlock:great-old-one': [
    { level: 10, resistances: ['psychic'] },             // Thought Shield
  ],
  'warlock:parasite': [
    // Physical Specimen (L3) — выбираемые за отдых бенефиты, не моделируются
    { level: 6, initiativeAdvantage: true },             // Symbiotic Sentinel
  ],
  'warlock:undead': [
    { level: 10, resistances: ['necrotic'] },            // Necrotic Husk
  ],
  'wizard:sangromancer': [
    { level: 6, hpFlat: 6, hpPerLevel: 1 },              // Sanguine Vigor
  ],
  'wizard:war': [
    { level: 3, initiativeBonusAbility: 'intelligence' }, // Tactical Wit
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
  // Дары трансформаций с ростом HP за уровень (Bestial Vigor)
  bonus += getTransformHpPerLevel(char);
  return bonus;
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

  // Transformation boon formulas (e.g. Hag Form: AC = 13 + Dex; shield allowed).
  for (const formula of getTransformUnarmoredFormulas(char)) {
    let ac = formula.base;
    for (const ability of formula.abilities) {
      ac += getAbilityModifier(char.abilityScores[ability]);
    }
    if (bestAC === null || ac > bestAC) {
      bestAC = ac;
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
  // Хранимый стат: как и resolveAC, срезаем живые оверлеи (Дикий облик,
  // floor-формы), чтобы ЛОВ зверя не запекалась в initiative.
  return getInitiativeBreakdown(stripActiveOverlays(char)).reduce((sum, p) => sum + p.value, 0);
}

/**
 * Get flat HP bonus to apply when a subclass is first selected.
 * Sums hpFlat from subclass effects already active at the given level
 * (later-level hpFlat, e.g. Sanguine Vigor at L6, is applied by
 * applyLevelUpEffects when that level is reached).
 */
export function getSubclassHpFlatBonus(classId: string, subclassId: string, atLevel: number = 20): number {
  const key = `${classId}:${subclassId}`;
  const effects = SUBCLASS_EFFECTS[key];
  if (!effects) return 0;
  let flat = 0;
  for (const e of effects) {
    if (e.hpFlat && (e.level ?? 1) <= atLevel) flat += e.hpFlat;
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
  key: 'armor' | 'base' | 'ability' | 'shield' | 'feat' | 'item' | 'prof' | 'class' | 'state' | 'form';
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
  for (const formula of getTransformUnarmoredFormulas(char)) {
    const parts: StatPart[] = [{ key: 'base', value: formula.base }];
    for (const ability of formula.abilities) {
      parts.push({ key: 'ability', ability, value: getAbilityModifier(char.abilityScores[ability]) });
    }
    consider(parts);
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
  // Дикий облик: КД зверя целиком заменяет расчёт (экипировка слита с формой).
  // Для Луны getWildShapeAC уже вернул max(КД зверя, 13 + Мдр).
  const formAC = getWildShapeAC(inputChar);
  if (formAC !== null) return [{ key: 'form', value: formAC }];
  // Kindred Form ликантропа: КД зверя (экипировка падает при превращении)
  const kindredAC = getKindredAC(inputChar);
  if (kindredAC !== null) return [{ key: 'form', value: kindredAC }];

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

  // Flat AC bonuses from class/subclass features (e.g. Forge cleric +1 in heavy armor)
  let classAc = 0;
  const heavyArmor = isWearingHeavyArmor(char);
  for (const e of getActiveEffects(char)) {
    if (e.acBonus && (!e.acBonusRequiresHeavyArmor || heavyArmor)) classAc += e.acBonus;
  }
  // Flat AC bonuses from transformation boons (e.g. Shadowsteel Absorption, unarmored only)
  classAc += getTransformACBonus(char, wearingArmor);
  if (classAc) parts.push({ key: 'class', value: classAc });

  const itemAc = getEquippedItemBonuses(char).bonusAc;
  if (itemAc) parts.push({ key: 'item', value: itemAc });

  // Живой бонус от активных эффектов (Песнь клинка +Инт, Chitinous Shell +2).
  // Не входит в resolveAC — хранимый armorClass остаётся чистым от состояний.
  const stateAc = getActiveACBonus(char, char.abilityScores);
  if (stateAc) parts.push({ key: 'state', value: stateAc });

  return parts;
}

/**
 * Resolve the STORED AC for a character. Active effects (Bladesong, hybrid-form
 * ability floors…) are stripped first, so writers (level-up, sync, boon grants)
 * never bake activated state into the stored stat.
 */
export function resolveAC(inputChar: Character): number {
  return getACBreakdown(stripActiveOverlays(inputChar)).reduce((sum, p) => sum + p.value, 0);
}

/**
 * AC as displayed on the sheet: sum of the live breakdown, INCLUDING active
 * effects. Always equals the tooltip formula from getACBreakdown.
 */
export function resolveDisplayAC(inputChar: Character): number {
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
    if (e.initiativeAddProficiency) {
      parts.push({ key: 'prof', value: char.proficiencyBonus });
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

/** Add permanent damage resistances, skipping duplicates. Mutates char. */
export function addResistances(char: Character, types: string[], modifier: 'resistance' | 'immunity' | 'vulnerability' = 'resistance'): void {
  const existing = char.damageResistances ?? [];
  for (const type of types) {
    const alreadyHas = existing.some(r => r.type === type && r.modifier === modifier);
    if (!alreadyHas) {
      existing.push({ type, modifier });
    }
  }
  char.damageResistances = existing;
}

/** Merge permanent senses into the character (keeps the larger range). Mutates char. */
export function applySenses(char: Character, senses: NonNullable<StatEffect['senses']>): void {
  const current = { ...(char.senses ?? {}) };
  for (const [key, value] of Object.entries(senses)) {
    if (typeof value !== 'number') continue;
    const k = key as keyof NonNullable<Character['senses']>;
    if ((current[k] ?? 0) < value) current[k] = value;
  }
  char.senses = current;
}

/**
 * Merge additional movement speeds into the character (keeps the faster one).
 * −1 = «равна скорости ходьбы»; сравнивается по разрешённому значению. Mutates char.
 */
export function applyMoveSpeeds(char: Character, speeds: NonNullable<StatEffect['moveSpeeds']>): void {
  const walk = char.speed;
  const resolve = (v: number | undefined) => (v === -1 ? walk : (v ?? 0));
  const current = { ...(char.speeds ?? {}) };
  for (const [key, value] of Object.entries(speeds)) {
    if (typeof value !== 'number') continue;
    const k = key as keyof NonNullable<Character['speeds']>;
    if (resolve(value) >= resolve(current[k]) && resolve(value) > 0) {
      current[k] = value;
    }
  }
  char.speeds = current;
}

/** Resolve a stored movement speed (−1 → текущая скорость ходьбы). */
export function resolveMoveSpeed(char: Character, kind: 'fly' | 'swim' | 'climb'): number {
  const v = char.speeds?.[kind];
  if (v == null || v === 0) return 0;
  return v === -1 ? char.speed : v;
}

/** Apply a single permanent stat effect (resists/immunities/saves/senses). Mutates char. */
function applyPermanentEffect(char: Character, e: StatEffect): void {
  if (e.resistances) addResistances(char, e.resistances, 'resistance');
  if (e.immunities) addResistances(char, e.immunities, 'immunity');
  if (e.senses) applySenses(char, e.senses);
  if (e.moveSpeeds) applyMoveSpeeds(char, e.moveSpeeds);

  if (e.savingThrowProficiencies) {
    for (const ability of e.savingThrowProficiencies) {
      if (char.savingThrows[ability]) {
        char.savingThrows[ability].proficient = true;
      }
    }
  }

  if (e.allSavingThrows) {
    for (const ability of Object.keys(char.savingThrows) as (keyof AbilityScores)[]) {
      char.savingThrows[ability].proficient = true;
    }
  }
}

/**
 * Apply permanent effects (resistances, immunities, saving throw proficiencies,
 * senses, later-level flat HP) gained at a new level.
 * Called during level-up after building the updated character.
 * `skipHpFlat` is set when the subclass was just selected on this same level-up —
 * its flat HP was already added via getSubclassHpFlatBonus.
 * Mutates the character object in place.
 */
export function applyLevelUpEffects(char: Character, newLevel: number, opts?: { skipHpFlat?: boolean }): void {
  const newEffects = getNewEffectsAtLevel(char, newLevel);

  for (const e of newEffects) {
    applyPermanentEffect(char, e);

    if (e.hpFlat && !opts?.skipHpFlat) {
      char.hitPoints = {
        ...char.hitPoints,
        max: char.hitPoints.max + e.hpFlat,
        current: char.hitPoints.current + e.hpFlat,
      };
    }
  }
}

/**
 * Apply all permanent subclass effects already due at the given level.
 * Called once when a subclass is first selected (covers effects whose level
 * is below the selection level, e.g. darkvision wired at L3 data level).
 * Flat HP is handled separately via getSubclassHpFlatBonus.
 */
export function applySubclassSelectionEffects(char: Character, atLevel: number): void {
  const subKey = getSubclassKey(char);
  if (!subKey) return;
  for (const e of SUBCLASS_EFFECTS[subKey] ?? []) {
    if ((e.level ?? 1) <= atLevel) {
      applyPermanentEffect(char, e);
    }
  }
}

/**
 * Idempotently re-apply the permanent parts (resistances, immunities, saving
 * throw proficiencies, senses) of ALL class/subclass/species effects active at
 * the character's current level. Used by the effect-sync pass so existing
 * characters pick up newly wired effects without re-levelling. HP and speed are
 * deliberately not touched here (they are acquisition-time adjustments).
 */
export function syncPermanentClassEffects(char: Character): void {
  for (const e of getActiveEffects(char)) {
    applyPermanentEffect(char, e);
  }
}

/** Does any active class/subclass effect grant advantage on initiative rolls? */
export function hasInitiativeAdvantage(char: Character): boolean {
  return getActiveEffects(char).some(e => e.initiativeAdvantage);
}

// ── Player choices unlocked by effects (resistance / save proficiency) ──

export interface PendingStatChoice {
  kind: 'resistance' | 'saveProf';
  count: number;
  from: string[];
}

/**
 * Stat choices unlocked at exactly `newLevel` — or, when the subclass was just
 * selected on this level-up, all subclass choices due at or below it.
 * The character must already have the (new) subclass set.
 */
export function getPendingStatChoicesAtLevel(
  char: Character,
  newLevel: number,
  opts?: { subclassJustSelected?: boolean },
): PendingStatChoice[] {
  const out: PendingStatChoice[] = [];
  const collect = (e: StatEffect) => {
    if (e.resistanceChoice) out.push({ kind: 'resistance', count: e.resistanceChoice.count, from: e.resistanceChoice.from });
    if (e.saveProfChoice) out.push({ kind: 'saveProf', count: e.saveProfChoice.count, from: e.saveProfChoice.from });
  };
  if (opts?.subclassJustSelected) {
    const subKey = getSubclassKey(char);
    if (subKey) {
      for (const e of SUBCLASS_EFFECTS[subKey] ?? []) {
        if ((e.level ?? 1) <= newLevel) collect(e);
      }
    }
    for (const e of CLASS_EFFECTS[char.classId] ?? []) {
      if ((e.level ?? 1) === newLevel) collect(e);
    }
  } else {
    for (const e of getNewEffectsAtLevel(char, newLevel)) collect(e);
  }
  return out;
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

    // Firearms are a category of their own: being proficient with Simple/Martial/
    // Ranged Martial weapons does NOT grant firearm proficiency. They require an
    // explicit Firearms proficiency (Gunslinger, the Gunner feat, etc.).
    if (item.raw?.firearm === true) {
      const firearmsStr = i18n.t('weaponCategories.firearms', { ns: 'game' });
      // Match the localized category and the literal 'Firearms' pushed by feat effects.
      if (weaponProfs.some(p => p === firearmsStr || p === 'Firearms')) return true;
    } else {
      // Check broad category first (if weaponCategory is known)
      const simpleStr = i18n.t('weaponCategories.simple', { ns: 'game' });
      const martialStr = i18n.t('weaponCategories.martial', { ns: 'game' });
      const rangedMartialStr = i18n.t('weaponCategories.rangedMartial', { ns: 'game' });
      const typeCode = typeof item.raw?.type === 'string' ? item.raw.type.split('|')[0] : '';
      const isRangedWeapon = typeCode === 'R';
      if (item.weaponCategory === 'simple' && weaponProfs.some(p => p === simpleStr)) return true;
      if (item.weaponCategory === 'martial' && weaponProfs.some(p => p === martialStr)) return true;
      // "Ranged Martial Weapons" proficiency (e.g. Gunslinger) covers non-firearm
      // martial ranged weapons (longbow, heavy crossbow, …) — type 'R', category 'martial'.
      if (item.weaponCategory === 'martial' && isRangedWeapon && weaponProfs.some(p => p === rangedMartialStr)) return true;
    }

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
 * Get effective ability scores after applying equipped item overrides and
 * active transformation forms.
 * Handles ability.static (set to fixed value, e.g. Gauntlets of Ogre Power → STR 19)
 * and hybrid-form floors (Hybrid Bear Form → STR becomes 20 unless higher).
 * Uses the higher of base score and override (per D&D rules).
 */
export function getEffectiveAbilityScores(char: Character): AbilityScores {
  const base = { ...char.abilityScores };

  if (char.equipment && char.inventory) {
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
  }

  // Активные эффекты с floor-заменой характеристик (гибридные формы ликантропа)
  for (const [key, floor] of Object.entries(getActiveAbilityFloors(char))) {
    const k = key as keyof AbilityScores;
    if (typeof floor === 'number' && floor > base[k]) {
      base[k] = floor;
    }
  }

  // Дикий облик: СИЛ/ЛОВ/ТЕЛ зверя заменяют свои полностью (даже если ниже).
  // Kindred Form (Полиморф): заменяются все шесть. Формы взаимоисключающие.
  return applyKindredAbilityOverride(char, applyWildShapeAbilityOverride(char, base));
}
