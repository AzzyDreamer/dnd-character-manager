import type { Character, AbilityScores, DamageResistanceEntry } from '../types';
import { getAbilityModifier } from './dnd';
import type { FeatData } from '../data/feats';

// ── Stat effect definitions ──

export interface FeatStatEffect {
  hpPerLevel?: number;         // e.g. Tough: +2 HP per character level
  hpFlat?: number;             // e.g. Boon of Fortitude: +40 HP
  acBonus?: number;            // e.g. Defense: +1 AC
  speedBonus?: number;         // e.g. Speedy: +10, Boon of Speed: +30
  initiativeAddProficiency?: boolean; // e.g. Alert: add proficiency bonus to initiative
}

/** Feats with special stat modifications that can't be read from JSON fields */
export const FEAT_STAT_EFFECTS: Record<string, FeatStatEffect> = {
  'Tough': { hpPerLevel: 2 },
  'Boon of Fortitude': { hpFlat: 40 },
  'Alert': { initiativeAddProficiency: true },
  'Defense': { acBonus: 1 },
  'Speedy': { speedBonus: 10 },
  'Boon of Speed': { speedBonus: 30 },
};

/**
 * Apply immediate stat effects when a feat is selected.
 * Mutates the character object in place.
 */
export function applyFeatStatEffects(char: Character, featName: string): void {
  const effect = FEAT_STAT_EFFECTS[featName];
  if (!effect) return;

  if (effect.hpPerLevel) {
    const bonus = effect.hpPerLevel * char.level;
    char.hitPoints = {
      ...char.hitPoints,
      max: char.hitPoints.max + bonus,
      current: char.hitPoints.current + bonus,
    };
  }

  if (effect.hpFlat) {
    char.hitPoints = {
      ...char.hitPoints,
      max: char.hitPoints.max + effect.hpFlat,
      current: char.hitPoints.current + effect.hpFlat,
    };
  }

  if (effect.acBonus) {
    char.armorClass += effect.acBonus;
  }

  if (effect.speedBonus) {
    char.speed += effect.speedBonus;
  }

  if (effect.initiativeAddProficiency) {
    char.initiative = getAbilityModifier(char.abilityScores.dexterity) + char.proficiencyBonus;
  }
}

/**
 * Returns the per-level HP bonus from feats like Tough.
 * Used during level-up to add extra HP.
 */
export function getOngoingFeatHpBonus(char: Character): number {
  let bonus = 0;
  for (const feat of char.feats ?? []) {
    const effect = FEAT_STAT_EFFECTS[feat.name];
    if (effect?.hpPerLevel) {
      bonus += effect.hpPerLevel;
    }
  }
  return bonus;
}

// ── Proficiency extraction from feat JSON data ──

export interface ExtractedProficiencies {
  armor: string[];
  weapons: string[];
  tools: string[];
  languages: string[];
  skills: string[];           // skill keys (e.g. 'athletics', 'perception')
  savingThrows: string[];     // ability keys (e.g. 'strength', 'dexterity')
  expertise: string[];        // skill keys for expertise
  // Choice configs (need UI)
  skillChoiceCount?: number;
  skillChoiceFrom?: string[]; // skill keys, or empty = any
  savingThrowChoiceCount?: number;
  savingThrowChoiceFrom?: string[];
  toolChoiceCount?: number;
  languageChoiceCount?: number;
  expertiseChoiceCount?: number;
  allSkills?: boolean;        // Boon of Skill: proficiency in all skills
}

const SKILL_KEY_MAP: Record<string, string> = {
  'athletics': 'athletics',
  'acrobatics': 'acrobatics',
  'sleight of hand': 'sleightOfHand',
  'stealth': 'stealth',
  'arcana': 'arcana',
  'history': 'history',
  'investigation': 'investigation',
  'nature': 'nature',
  'religion': 'religion',
  'animal handling': 'animalHandling',
  'insight': 'insight',
  'medicine': 'medicine',
  'perception': 'perception',
  'survival': 'survival',
  'deception': 'deception',
  'intimidation': 'intimidation',
  'performance': 'performance',
  'persuasion': 'persuasion',
};

const ABILITY_SHORT_MAP: Record<string, string> = {
  'str': 'strength', 'dex': 'dexterity', 'con': 'constitution',
  'int': 'intelligence', 'wis': 'wisdom', 'cha': 'charisma',
};

export function extractFeatProficiencies(feat: FeatData): ExtractedProficiencies {
  const result: ExtractedProficiencies = {
    armor: [], weapons: [], tools: [], languages: [],
    skills: [], savingThrows: [], expertise: [],
  };

  // Armor proficiencies
  if (feat.armorProficiencies) {
    for (const entry of feat.armorProficiencies) {
      if (entry.light) result.armor.push('Light armor');
      if (entry.medium) result.armor.push('Medium armor');
      if (entry.heavy) result.armor.push('Heavy armor');
      if (entry.shield) result.armor.push('Shields');
    }
  }

  // Weapon proficiencies
  if (feat.weaponProficiencies) {
    for (const entry of feat.weaponProficiencies) {
      if (entry.martial) result.weapons.push('Martial weapons');
      if (entry.simple) result.weapons.push('Simple weapons');
      if (entry.firearms) result.weapons.push('Firearms');
      if (entry.improvised) result.weapons.push('Improvised weapons');
    }
  }

  // Tool proficiencies (fixed)
  if (feat.toolProficiencies) {
    for (const entry of feat.toolProficiencies) {
      for (const [key, value] of Object.entries(entry)) {
        if (key === 'any') {
          result.toolChoiceCount = (result.toolChoiceCount ?? 0) + (value as number);
        } else if (key === 'anyMusicalInstrument') {
          result.toolChoiceCount = (result.toolChoiceCount ?? 0) + (value as number);
        } else if (value === true) {
          // Capitalize tool name
          result.tools.push(key.charAt(0).toUpperCase() + key.slice(1));
        }
      }
    }
  }

  // Language proficiencies
  if (feat.languageProficiencies) {
    for (const entry of feat.languageProficiencies) {
      for (const [key, value] of Object.entries(entry)) {
        if (key === 'any') {
          result.languageChoiceCount = (result.languageChoiceCount ?? 0) + (value as number);
        } else if (value === true) {
          result.languages.push(key.charAt(0).toUpperCase() + key.slice(1));
        }
      }
    }
  }

  // Skill proficiencies
  if (feat.skillProficiencies) {
    for (const entry of feat.skillProficiencies) {
      if (entry.choose) {
        const from = entry.choose.from?.map((s: string) => SKILL_KEY_MAP[s] || s).filter(Boolean) ?? [];
        result.skillChoiceCount = (result.skillChoiceCount ?? 0) + (entry.choose.count ?? 1);
        result.skillChoiceFrom = from.length > 0 ? from : undefined;
      } else {
        // Fixed skills (e.g. Boon of Skill gives all)
        for (const key of Object.keys(entry)) {
          if (entry[key] === true) {
            const mapped = SKILL_KEY_MAP[key];
            if (mapped) result.skills.push(mapped);
          }
        }
        // If all 18 skills are present, mark as allSkills
        if (result.skills.length >= 18) {
          result.allSkills = true;
        }
      }
    }
  }

  // Skill/Tool/Language combined proficiencies
  if (feat.skillToolLanguageProficiencies) {
    for (const entry of feat.skillToolLanguageProficiencies) {
      if (entry.choose) {
        for (const choice of entry.choose) {
          const from = choice.from || [];
          const count = choice.count || 1;
          // Check what types are available
          const hasSkill = from.includes('anySkill');
          const hasTool = from.includes('anyTool');
          if (hasSkill && hasTool) {
            result.skillChoiceCount = (result.skillChoiceCount ?? 0) + count;
            // These can be skills OR tools — we'll handle this in UI
          } else if (hasSkill) {
            result.skillChoiceCount = (result.skillChoiceCount ?? 0) + count;
          } else if (hasTool) {
            result.toolChoiceCount = (result.toolChoiceCount ?? 0) + count;
          }
        }
      }
    }
  }

  // Saving throw proficiencies
  if (feat.savingThrowProficiencies) {
    for (const entry of feat.savingThrowProficiencies) {
      if (entry.choose) {
        const from = entry.choose.from?.map((s: string) => ABILITY_SHORT_MAP[s] || s).filter(Boolean) ?? [];
        result.savingThrowChoiceCount = (result.savingThrowChoiceCount ?? 0) + (entry.choose.count ?? 1);
        result.savingThrowChoiceFrom = from;
      } else {
        for (const [key, value] of Object.entries(entry)) {
          if (value === true) {
            const mapped = ABILITY_SHORT_MAP[key] || key;
            result.savingThrows.push(mapped);
          }
        }
      }
    }
  }

  // Expertise
  if (feat.expertise) {
    for (const entry of feat.expertise) {
      if (entry.anyProficientSkill) {
        result.expertiseChoiceCount = (result.expertiseChoiceCount ?? 0) + (entry.anyProficientSkill as number);
      }
    }
  }

  return result;
}

// ── Resistance extraction ──

export interface ExtractedResistances {
  fixed: string[];           // Fixed resistance types (e.g. ['fire', 'cold'])
  choiceFrom?: string[];     // Available types to choose from
  choiceCount?: number;      // How many to choose
}

export function extractFeatResistances(feat: FeatData): ExtractedResistances {
  const result: ExtractedResistances = { fixed: [] };
  if (!feat.resist) return result;

  for (const entry of feat.resist) {
    if (typeof entry === 'string') {
      result.fixed.push(entry);
    } else if (typeof entry === 'object' && entry.choose) {
      result.choiceFrom = entry.choose.from || [];
      result.choiceCount = entry.choose.count || 1;
    }
  }

  return result;
}

// ── Spell config extraction ──

export interface FeatSpellConfig {
  /** Pre-set spells that are automatically granted */
  fixedSpells: { name: string; level: number }[];
  /** Spell choices the user needs to make */
  choices: {
    count: number;
    level: number;
    filterClass?: string;
    filterSchools?: string[];  // school codes: I, N, D, E, etc.
  }[];
  /** Available spellcasting ability options */
  abilityOptions?: string[];  // e.g. ['int', 'wis', 'cha']
  /** Fixed spellcasting ability */
  fixedAbility?: string;
  /** Multiple options (e.g. Magic Initiate: choose Cleric OR Druid OR Wizard) */
  classOptions?: { name: string; className: string }[];
}

export function extractFeatSpellConfig(feat: FeatData): FeatSpellConfig | null {
  if (!feat.additionalSpells || feat.additionalSpells.length === 0) return null;

  // Check if there are multiple named options (like Magic Initiate)
  const hasNamedOptions = feat.additionalSpells.some((s: any) => s.name);

  if (hasNamedOptions) {
    // Multiple class options (e.g. Magic Initiate)
    const classOptions: FeatSpellConfig['classOptions'] = [];
    for (const spellSet of feat.additionalSpells) {
      if (spellSet.name) {
        const classMatch = spellSet.name.match(/(\w+)\s+Spells?/);
        const className = classMatch ? classMatch[1] : spellSet.name;
        classOptions.push({ name: spellSet.name, className });
      }
    }

    // Parse first option to get structure
    const first = feat.additionalSpells[0];
    const config = parseSingleSpellSet(first);
    config.classOptions = classOptions;
    return config;
  }

  // Single spell set
  return parseSingleSpellSet(feat.additionalSpells[0]);
}

function parseSingleSpellSet(spellSet: any): FeatSpellConfig {
  const config: FeatSpellConfig = {
    fixedSpells: [],
    choices: [],
  };

  // Ability
  if (spellSet.ability) {
    if (spellSet.ability === 'inherit') {
      // Inherit from class spellcasting
    } else if (spellSet.ability.choose) {
      config.abilityOptions = spellSet.ability.choose;
    } else if (typeof spellSet.ability === 'string') {
      config.fixedAbility = spellSet.ability;
    }
  }

  // Innate spells (daily uses)
  if (spellSet.innate) {
    for (const [, levelData] of Object.entries(spellSet.innate)) {
      const ld = levelData as any;
      if (ld.daily) {
        for (const [, spells] of Object.entries(ld.daily)) {
          for (const spell of spells as any[]) {
            if (typeof spell === 'string') {
              // Fixed spell like "misty step" or "invisibility|xphb"
              const name = spell.split('|')[0];
              // Try to determine level from name (we'll resolve at runtime)
              config.fixedSpells.push({ name, level: -1 }); // level resolved later
            } else if (typeof spell === 'object' && spell.choose) {
              // Choice: "level=1|school=I;N" or "level=1|class=Cleric"
              const parsed = parseSpellFilter(spell.choose);
              config.choices.push({ count: spell.count || 1, ...parsed });
            }
          }
        }
      }
    }
  }

  // Known spells (cantrips/leveled)
  if (spellSet.known) {
    for (const [, levelData] of Object.entries(spellSet.known)) {
      for (const spellEntry of levelData as any[]) {
        if (typeof spellEntry === 'string') {
          const name = spellEntry.split('|')[0];
          config.fixedSpells.push({ name, level: -1 });
        } else if (typeof spellEntry === 'object' && spellEntry.choose) {
          const parsed = parseSpellFilter(spellEntry.choose);
          config.choices.push({ count: spellEntry.count || 1, ...parsed });
        }
      }
    }
  }

  return config;
}

function parseSpellFilter(filter: string): { level: number; filterClass?: string; filterSchools?: string[] } {
  const result: { level: number; filterClass?: string; filterSchools?: string[] } = { level: 0 };

  const parts = filter.split('|');
  for (const part of parts) {
    const [key, value] = part.split('=');
    if (key === 'level') {
      result.level = parseInt(value) || 0;
    } else if (key === 'class') {
      result.filterClass = value;
    } else if (key === 'school') {
      result.filterSchools = value.split(';');
    }
  }

  return result;
}

// ── Apply proficiencies to character ──

export function applyFeatProficiencies(
  char: Character,
  profs: ExtractedProficiencies,
  choices?: {
    skills?: string[];
    savingThrows?: string[];
    tools?: string[];
    languages?: string[];
    expertise?: string[];
  },
): void {
  // Armor
  for (const a of profs.armor) {
    if (!char.proficiencies.armor.includes(a)) {
      char.proficiencies.armor.push(a);
    }
  }

  // Weapons
  for (const w of profs.weapons) {
    if (!char.proficiencies.weapons.includes(w)) {
      char.proficiencies.weapons.push(w);
    }
  }

  // Tools (fixed)
  for (const t of profs.tools) {
    if (!char.proficiencies.tools.includes(t)) {
      char.proficiencies.tools.push(t);
    }
  }
  // Tools (chosen)
  for (const t of choices?.tools ?? []) {
    if (!char.proficiencies.tools.includes(t)) {
      char.proficiencies.tools.push(t);
    }
  }

  // Languages (fixed)
  for (const l of profs.languages) {
    if (!char.proficiencies.languages.includes(l)) {
      char.proficiencies.languages.push(l);
    }
  }
  // Languages (chosen)
  for (const l of choices?.languages ?? []) {
    if (!char.proficiencies.languages.includes(l)) {
      char.proficiencies.languages.push(l);
    }
  }

  // Skills (fixed)
  if (profs.allSkills) {
    for (const key of Object.keys(SKILL_KEY_MAP).map(k => SKILL_KEY_MAP[k])) {
      if (!char.skills[key]) {
        char.skills[key] = { proficient: true };
      } else {
        char.skills[key].proficient = true;
      }
    }
  } else {
    for (const sk of profs.skills) {
      if (!char.skills[sk]) {
        char.skills[sk] = { proficient: true };
      } else {
        char.skills[sk].proficient = true;
      }
    }
  }
  // Skills (chosen)
  for (const sk of choices?.skills ?? []) {
    if (!char.skills[sk]) {
      char.skills[sk] = { proficient: true };
    } else {
      char.skills[sk].proficient = true;
    }
  }

  // Saving throws (fixed)
  for (const st of profs.savingThrows) {
    const key = st as keyof typeof char.savingThrows;
    if (char.savingThrows[key]) {
      char.savingThrows[key].proficient = true;
    }
  }
  // Saving throws (chosen)
  for (const st of choices?.savingThrows ?? []) {
    const key = st as keyof typeof char.savingThrows;
    if (char.savingThrows[key]) {
      char.savingThrows[key].proficient = true;
    }
  }

  // Expertise (chosen)
  for (const sk of choices?.expertise ?? []) {
    if (char.skills[sk]) {
      char.skills[sk].expertise = true;
    }
  }
}

// ── Apply resistances to character ──

export function applyFeatResistances(
  char: Character,
  resistances: ExtractedResistances,
  chosenTypes?: string[],
): void {
  const allTypes = [...resistances.fixed, ...(chosenTypes ?? [])];
  const existing = char.damageResistances ?? [];

  for (const type of allTypes) {
    const alreadyHas = existing.some(r => r.type === type && r.modifier === 'resistance');
    if (!alreadyHas) {
      existing.push({ type, modifier: 'resistance' });
    }
  }

  char.damageResistances = existing;
}
