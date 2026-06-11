// Трансформации Grim Hollow (GrimHollowPG24): стадии 1–4, дары (TB) и изъяны (TF).
// Конфиг стадий — какие дары фиксированы, сколько на выбор, какой изъян; таблица
// TRANSFORM_STAT_EFFECTS — пассивные числовые эффекты даров/изъянов для листа.
// Активируемые формы (Ooze Form, Hybrid-формы, Angelic Wings…) статов не меняют
// и остаются текстом.
import type { Character, AbilityScores } from '../types';

// ── Stage configuration ──

export interface TransformationStage {
  /** Boons granted automatically at this stage */
  fixed: string[];
  /** Number of boons the player picks from `options` */
  choose: number;
  /** Boon options to pick from (English names) */
  options: string[];
  /** Flaw gained automatically at this stage */
  flaw: string;
}

export interface TransformationConfig {
  /** featureType prefix used by boons/flaws of this transformation (e.g. "V" → "V:TB") */
  code: string;
  /** Canonical English name of the charactercreationoption */
  name: string;
  stages: TransformationStage[]; // index 0 = Stage 1
}

export const TRANSFORMATIONS: Record<string, TransformationConfig> = {
  'Aberrant Horror': {
    code: 'AH', name: 'Aberrant Horror',
    stages: [
      { fixed: ['Aberrant Form', 'Aberrant Mutation'], choose: 0, options: [], flaw: 'Unstable Form' },
      { fixed: [], choose: 1, options: ['Efficient Killer', 'Writhing Tendrils'], flaw: 'Hideous Appearance (Aberrant Horror)' },
      { fixed: [], choose: 1, options: ['Terrifying Visage', 'Constricting Tendrils'], flaw: 'Unstable Existence' },
      { fixed: [], choose: 1, options: ['Eldritch Aberration', 'Poison Tendrils'], flaw: 'Entropic Abomination' },
    ],
  },
  'Fey': {
    code: 'F', name: 'Fey',
    stages: [
      { fixed: ['Fey Form'], choose: 1, options: ['Servant of the Spring Court', 'Servant of the Summer Court', 'Servant of the Autumn Court', 'Servant of the Winter Court'], flaw: 'Planar Binding (Fey)' },
      { fixed: [], choose: 1, options: ['Two-Faced', 'Magic Tricks'], flaw: "Queen's Command" },
      { fixed: [], choose: 1, options: ['Illusionary Cloak', 'Tooth and Claw', 'Dreams and Nightmares'], flaw: 'Weakened Constitution' },
      { fixed: [], choose: 1, options: ['Greater Magic Tricks', 'Twilight Glamour'], flaw: 'Seasonally Affected' },
    ],
  },
  'Fiend': {
    code: 'Fi', name: 'Fiend',
    stages: [
      { fixed: ['Fiendish Soul'], choose: 1, options: ['Infernal Smite', 'Devilish Contractor'], flaw: 'Fiend Bound' },
      { fixed: [], choose: 1, options: ['Daemonic Brand', 'Enhanced Contract'], flaw: 'Fiend Form' },
      { fixed: [], choose: 1, options: ['Devilish Subcontractor', 'Overwhelming Brand'], flaw: 'Pull of the Netherworld' },
      { fixed: [], choose: 1, options: ['Abyssal Resistance', 'Infernal Summons', 'Ultimate Brand'], flaw: 'True Name' },
    ],
  },
  'Hag': {
    code: 'H', name: 'Hag',
    stages: [
      { fixed: ['Hag Form'], choose: 1, options: ['The Green Sisterhood', 'The Red Sisterhood', 'The Sea Sisterhood'], flaw: 'Hideous Appearance (Hag)' },
      { fixed: [], choose: 1, options: ['Adept of the Green Sisterhood', 'Adept of the Red Sisterhood', 'Adept of the Sea Sisterhood'], flaw: 'Iron Sensitivity' },
      { fixed: [], choose: 1, options: ['Master of the Green Sisterhood', 'Master of the Red Sisterhood', 'Master of the Sea Sisterhood'], flaw: "Purity's Pain" },
      { fixed: [], choose: 1, options: ['Evil Eye', "Grandmother's Curse"], flaw: "Arch-Crone's Hunger" },
    ],
  },
  'Lich': {
    code: 'L', name: 'Lich',
    stages: [
      { fixed: ['Undead Form'], choose: 1, options: ['Memori Lichdom', 'Lich Magica'], flaw: 'Soul Vessel' },
      { fixed: [], choose: 1, options: ['Acolyte of Undeath', 'Binding Curse', 'Corrupting Magic'], flaw: 'Hideous Appearance (Lich)' },
      { fixed: [], choose: 1, options: ['Eldritch Concentration', 'Master of Undeath', 'Unholy Healing'], flaw: 'Necromantic Dystrophia' },
      { fixed: [], choose: 1, options: ['Eldritch Omniscience', 'Soul-Shattering Attack', 'Lord of Undeath'], flaw: 'Weight of the Ages' },
    ],
  },
  'Lycanthrope': {
    code: 'Ly', name: 'Lycanthrope',
    stages: [
      { fixed: [], choose: 1, options: ['Hybrid Wolf Form', 'Hybrid Bear Form', 'Hybrid Rat Form'], flaw: 'Lust for the Hunt' },
      { fixed: [], choose: 1, options: ["Hunter's Focus", 'Iron Pelt', 'Kindred Form'], flaw: 'Silver Sensitivity' },
      { fixed: [], choose: 1, options: ['Bestial Vigor', "Shapeshifter's Savagery"], flaw: 'Frayed Thoughts' },
      { fixed: [], choose: 1, options: ['Hybrid Form Affinity', 'Savage Instincts'], flaw: 'Ultimate Predator' },
    ],
  },
  'Ooze': {
    code: 'O', name: 'Ooze',
    stages: [
      { fixed: ['Ooze Form'], choose: 1, options: ['Mutable Corpus', 'Slimy Mien'], flaw: 'Sluggish' },
      { fixed: [], choose: 1, options: ['Elastic Limbs', 'Viscous Durability'], flaw: 'Melted Appearance' },
      { fixed: [], choose: 1, options: ['Corrosive Membrane', 'Engulf'], flaw: 'Physical Deterioration' },
      { fixed: [], choose: 1, options: ['Legion of Slime', 'Mimic Object'], flaw: 'Slippery Ego' },
    ],
  },
  'Primordial': {
    code: 'P', name: 'Primordial',
    stages: [
      { fixed: ['Primordial Form', 'Elemental Affinity'], choose: 0, options: [], flaw: 'Planar Binding (Primordial)' },
      { fixed: [], choose: 1, options: ['Dual Nature', 'Elemental Surge'], flaw: 'Roiling Elements' },
      { fixed: [], choose: 1, options: ['Aura of Awakening', 'Primeval Body', 'Master of Many'], flaw: 'Elemental Imbalance' },
      { fixed: [], choose: 1, options: ['Primordial Aura', 'Elemental Mastery'], flaw: 'Primordial Chaos' },
    ],
  },
  'Seraph': {
    code: 'Ser', name: 'Seraph',
    stages: [
      { fixed: ['Celestial Form'], choose: 1, options: ['Angelic Wings', 'Holy Strikes'], flaw: 'Planar Binding (Seraph)' },
      { fixed: [], choose: 1, options: ['Divine Clemency', 'Sacred Retribution'], flaw: 'Blinding Radiance' },
      { fixed: [], choose: 1, options: ['Cleanse Affliction', 'Protective Wings', 'Bow of Celestial Judgement'], flaw: 'Beacon to Darkness' },
      { fixed: [], choose: 1, options: ['Aura of Holy Purge', 'Aura of Righteous Mercy', 'Bow of Celestial Domination'], flaw: 'Seraph Corruption' },
    ],
  },
  'Shadowsteel Ghoul': {
    code: 'SG', name: 'Shadowsteel Ghoul',
    stages: [
      { fixed: [], choose: 1, options: ['Shadowsteel Curser', 'Shadowsteel Weapon'], flaw: 'Debilitating Magic' },
      { fixed: [], choose: 2, options: ['Magic Resistance', 'Shadowsteel Absorption', 'Shadowsteel Caster', 'Shadowsteel Weapon Master'], flaw: 'Friendless' },
      { fixed: ['Cursed Claw'], choose: 0, options: [], flaw: 'Healing Resistance' },
      { fixed: [], choose: 1, options: ['Shadowsteel Arcane Vessel', 'Shadowsteel Fury'], flaw: 'Shadowsteel Explosion' },
    ],
  },
  'Specter': {
    code: 'Spec', name: 'Specter',
    stages: [
      { fixed: ['Spectral Form'], choose: 1, options: ['Ghastly Touch', 'Incorporeal Movement'], flaw: 'Drawn to Darkness' },
      { fixed: [], choose: 1, options: ['Ethereal Phasing', 'Haunting Flight'], flaw: 'Untethered from Life' },
      { fixed: [], choose: 1, options: ['Draining Flight', 'Paralyzing Touch'], flaw: 'Fraying Reality' },
      { fixed: [], choose: 1, options: ['Call of Unmaking', 'Possession'], flaw: 'Pull of Oblivion' },
    ],
  },
  'Vampire': {
    code: 'V', name: 'Vampire',
    stages: [
      { fixed: ['Fanged Bite'], choose: 1, options: ['Soman Bloodline', 'Strigoi Bloodline', 'Fzeg Bloodline'], flaw: 'The Sanguine Curse' },
      { fixed: [], choose: 2, options: ['Eyes of the Night', 'Grave-Touched Soul', 'Inhuman Reflexes', 'Undead Resilience'], flaw: 'Greater Sanguine Curse' },
      { fixed: [], choose: 2, options: ["Beguiler's Charm", 'Improved Fanged Bite', 'Mist Form', 'Sangromancy Specialist'], flaw: 'Supreme Sanguine Curse' },
      { fixed: ['Regeneration'], choose: 1, options: ['Final Soman Bloodline', 'Final Strigoi Bloodline', 'Final Fzeg Bloodline'], flaw: 'Ultimate Sanguine Curse' },
    ],
  },
};

/** Find the transformation config for a stored charCreationOption name (EN canonical). */
export function getTransformationConfig(name: string): TransformationConfig | undefined {
  return TRANSFORMATIONS[name];
}

// ── Passive stat effects of boons/flaws ──

export interface TransformStatEffect {
  /** Fixed ability score increases, clamped to `abilityCap` (default 20) */
  abilityBonuses?: Partial<AbilityScores>;
  abilityCap?: number;
  /** Bestial Vigor: +HP equal to character level at acquisition, then +1/level */
  hpPerCharLevel?: boolean;
  speedBonus?: number;
  /** Speed delta per transformation stage (Sluggish: −5/stage). Applied live. */
  speedPerStage?: number;
  acBonus?: number;
  acBonusRequiresNoArmor?: boolean;
  /** Unarmored AC formula (Hag Form: 13 + Dex). Resolved live in resolveAC. */
  unarmoredACBase?: number;
  unarmoredACAbilities?: (keyof AbilityScores)[];
  resistances?: string[];
  immunities?: string[];
  vulnerabilities?: string[];
  senses?: { darkvision?: number; blindsight?: number; tremorsense?: number; truesight?: number };
  /** If the sense is already present, ADD the value instead of max-merging (Eyes of the Night) */
  sensesStack?: boolean;
  /** Skill proficiencies; upgraded to expertise if already proficient */
  skillProficiencies?: string[];
  /** Additional movement speeds; −1 = «равна скорости ходьбы» */
  moveSpeeds?: { fly?: number; swim?: number; climb?: number };
  /** Resistance to N damage types of the player's choice (Fiendish Soul, Viscous Durability…) */
  resistanceChoice?: { count: number; from: string[] };
  /** Saving-throw proficiency choice (Hag Form: Str/Int/Cha) */
  saveProfChoice?: { count: number; from: (keyof AbilityScores)[] };
  /** Lose N points in one ability of the player's choice (Debilitating Magic: −2) */
  abilityPenaltyChoice?: { amount: number };
}

/**
 * Пассивные always-on эффекты даров/изъянов. Условные ("while in hybrid form",
 * "while manifested"), реактивные и выборы за отдых здесь сознательно отсутствуют.
 */
export const TRANSFORM_STAT_EFFECTS: Record<string, TransformStatEffect> = {
  // — Vampire —
  'Soman Bloodline': { abilityBonuses: { strength: 1, dexterity: 1 }, abilityCap: 19, moveSpeeds: { climb: -1 } },
  'Strigoi Bloodline': { abilityBonuses: { dexterity: 2 }, abilityCap: 20, skillProficiencies: ['stealth'] },
  'Fzeg Bloodline': { abilityBonuses: { strength: 2 }, abilityCap: 20, speedBonus: 10 },
  'Final Soman Bloodline': { abilityBonuses: { strength: 1, dexterity: 1 }, abilityCap: 20 },
  'Final Strigoi Bloodline': { abilityBonuses: { dexterity: 2 }, abilityCap: 20 },
  'Final Fzeg Bloodline': { abilityBonuses: { strength: 2 }, abilityCap: 20, speedBonus: 10, resistances: ['bludgeoning', 'piercing', 'slashing'] },
  'Eyes of the Night': { senses: { darkvision: 60 }, sensesStack: true },
  'Grave-Touched Soul': { resistances: ['necrotic'] },
  // — Seraph —
  'Celestial Form': { resistances: ['radiant'] },
  // — Specter —
  'Spectral Form': { resistances: ['necrotic'] },
  // — Lich: Undead Form — без числовых пассивов (тип существа/возраст)
  // — Fiend —
  'Fiendish Soul': { resistanceChoice: { count: 1, from: ['acid', 'cold', 'fire'] } },
  // — Fey —
  'Fey Form': { resistanceChoice: { count: 1, from: ['acid', 'cold', 'fire', 'lightning', 'psychic', 'thunder'] } },  // выбор за долгий отдых — начальный
  // — Hag —
  'Hag Form': { unarmoredACBase: 13, unarmoredACAbilities: ['dexterity'], saveProfChoice: { count: 1, from: ['strength', 'intelligence', 'charisma'] } },
  'The Green Sisterhood': { senses: { darkvision: 60 }, sensesStack: true },
  'The Red Sisterhood': { senses: { darkvision: 60 }, skillProficiencies: ['deception', 'persuasion'] },
  'The Sea Sisterhood': { senses: { darkvision: 60 }, moveSpeeds: { swim: -1 } },
  // — Specter —
  'Haunting Flight': { moveSpeeds: { fly: -1 } },
  // — Ooze —
  'Ooze Form': { senses: { blindsight: 30 }, sensesStack: true },
  'Elastic Limbs': { moveSpeeds: { climb: -1 } },
  'Viscous Durability': { immunities: ['acid'], resistanceChoice: { count: 1, from: ['cold', 'fire', 'lightning'] } },
  'Sluggish': { speedPerStage: -5 },
  'Physical Deterioration': { vulnerabilities: ['radiant'] },
  // — Primordial — (резисты по выбранной стихии: Воздух→молния, Земля→дробящий, Огонь→огонь, Вода→холод)
  'Primordial Form': { abilityBonuses: { constitution: 1 }, abilityCap: 20 },
  'Elemental Affinity': { resistanceChoice: { count: 1, from: ['lightning', 'bludgeoning', 'fire', 'cold'] } },
  'Dual Nature': { resistanceChoice: { count: 1, from: ['lightning', 'bludgeoning', 'fire', 'cold'] } },
  'Master of Many': { resistanceChoice: { count: 1, from: ['lightning', 'bludgeoning', 'fire', 'cold'] } },
  'Elemental Mastery': { resistanceChoice: { count: 1, from: ['lightning', 'bludgeoning', 'fire', 'cold'] } },
  'Primeval Body': { resistanceChoice: { count: 1, from: ['bludgeoning', 'cold', 'fire', 'lightning'] } },
  // — Aberrant Horror —
  'Poison Tendrils': { resistances: ['poison'] },
  // — Lycanthrope —
  'Bestial Vigor': { hpPerCharLevel: true },
  // — Shadowsteel Ghoul —
  'Shadowsteel Absorption': { acBonus: 1, acBonusRequiresNoArmor: true },
  'Debilitating Magic': { abilityPenaltyChoice: { amount: 2 } },
};

/** Vulnerability granted by Seasonally Affected, derived from the chosen Fey court boon. */
const SEASONAL_VULNERABILITY: Record<string, string> = {
  'Servant of the Spring Court': 'necrotic',
  'Servant of the Summer Court': 'cold',
  'Servant of the Autumn Court': 'radiant',
  'Servant of the Winter Court': 'fire',
};

// ── Активируемые гибридные формы (ликантроп) ──

export interface HybridFormEffect {
  /** Характеристика становится N, если была ниже («Your Strength score becomes 20 unless it was higher») */
  abilityFloor?: Partial<AbilityScores>;
  /** Бонус к скорости ходьбы, пока форма активна (волк +10) */
  speedBonus?: number;
}

export const HYBRID_FORM_EFFECTS: Record<string, HybridFormEffect> = {
  'Hybrid Wolf Form': { abilityFloor: { strength: 18 }, speedBonus: 10 },
  'Hybrid Bear Form': { abilityFloor: { strength: 20 } },
  'Hybrid Rat Form': { abilityFloor: { dexterity: 18 } },
};

/** Активная гибридная форма персонажа (только если дар всё ещё во владении). */
export function getActiveHybridForm(char: Character): string | null {
  const form = char.activeTransformForm;
  if (!form || !HYBRID_FORM_EFFECTS[form]) return null;
  const owned = (char.optionalFeatures ?? []).some(f => (f.nameEn ?? f.name) === form);
  return owned ? form : null;
}

/** Floor-модификаторы характеристик активной гибридной формы. */
export function getHybridAbilityFloors(char: Character): Partial<AbilityScores> {
  const form = getActiveHybridForm(char);
  return form ? (HYBRID_FORM_EFFECTS[form].abilityFloor ?? {}) : {};
}

// ── Character helpers ──

/** Current transformation stage (0 = трансформация выбрана, но стадия не взята). */
export function getTransformationStage(char: Character): number {
  return (char.charCreationOption as { stage?: number } | undefined)?.stage ?? 0;
}

/** All owned transformation boon/flaw entries (featureType "<code>:TB|TF"). */
export function getOwnedTransformFeatures(char: Character): { name: string; nameEn: string; featureType: string }[] {
  return (char.optionalFeatures ?? [])
    .filter(f => /:(TB|TF)$/.test(f.featureType))
    .map(f => ({ name: f.name, nameEn: f.nameEn ?? f.name, featureType: f.featureType }));
}

/** Active passive effects from owned boons/flaws. */
export function getActiveTransformEffects(char: Character): TransformStatEffect[] {
  const owned = getOwnedTransformFeatures(char);
  const effects: TransformStatEffect[] = [];
  for (const f of owned) {
    const e = TRANSFORM_STAT_EFFECTS[f.nameEn];
    if (e) effects.push(e);
    // Seasonally Affected: уязвимость зависит от выбранного двора
    if (f.nameEn === 'Seasonally Affected') {
      const court = owned.find(o => SEASONAL_VULNERABILITY[o.nameEn]);
      if (court) effects.push({ vulnerabilities: [SEASONAL_VULNERABILITY[court.nameEn]] });
    }
  }
  return effects;
}

/** Live speed adjustment from transformation boons/flaws (not baked into char.speed). */
export function getTransformSpeedAdjust(char: Character): number {
  const stage = getTransformationStage(char);
  let total = 0;
  for (const e of getActiveTransformEffects(char)) {
    if (e.speedBonus) total += e.speedBonus;
    if (e.speedPerStage) total += e.speedPerStage * stage;
  }
  // Активная гибридная форма (волк: +10)
  const form = getActiveHybridForm(char);
  if (form && HYBRID_FORM_EFFECTS[form].speedBonus) {
    total += HYBRID_FORM_EFFECTS[form].speedBonus!;
  }
  return total;
}

/** Live flat AC bonus from transformation boons (e.g. Shadowsteel Absorption). */
export function getTransformACBonus(char: Character, wearingArmor: boolean): number {
  let total = 0;
  for (const e of getActiveTransformEffects(char)) {
    if (e.acBonus && (!e.acBonusRequiresNoArmor || !wearingArmor)) total += e.acBonus;
  }
  return total;
}

/** Unarmored AC formulas granted by transformation boons (e.g. Hag Form 13+Dex). */
export function getTransformUnarmoredFormulas(char: Character): { base: number; abilities: (keyof AbilityScores)[] }[] {
  const out: { base: number; abilities: (keyof AbilityScores)[] }[] = [];
  for (const e of getActiveTransformEffects(char)) {
    if (e.unarmoredACBase != null) {
      out.push({ base: e.unarmoredACBase, abilities: e.unarmoredACAbilities ?? [] });
    }
  }
  return out;
}

/** Ongoing per-level HP bonus from boons (Bestial Vigor: +1/level). */
export function getTransformHpPerLevel(char: Character): number {
  let total = 0;
  for (const e of getActiveTransformEffects(char)) {
    if (e.hpPerCharLevel) total += 1;
  }
  return total;
}

// ── Apply / remove baked effects when boons are gained or lost ──

type OptFeatureEntry = NonNullable<Character['optionalFeatures']>[number];

function addResist(char: Character, types: string[], modifier: 'resistance' | 'immunity' | 'vulnerability'): void {
  const existing = char.damageResistances ?? [];
  for (const type of types) {
    if (!existing.some(r => r.type === type && r.modifier === modifier)) {
      existing.push({ type, modifier });
    }
  }
  char.damageResistances = existing;
}

function removeResist(char: Character, types: string[], modifier: 'resistance' | 'immunity' | 'vulnerability'): void {
  if (!char.damageResistances) return;
  char.damageResistances = char.damageResistances.filter(
    r => !(types.includes(r.type) && r.modifier === modifier),
  );
}

/**
 * Bake the permanent effects of a newly gained boon/flaw into the character:
 * ability score increases (cap-clamped; actual deltas recorded on the entry for
 * exact reversal), flat HP, resistances/immunities/vulnerabilities, senses and
 * skill proficiencies. Live effects (speed, AC) are computed at render time.
 * Mutates char and entry.
 */
export function applyTransformFeatureEffects(char: Character, entry: OptFeatureEntry): void {
  const e = TRANSFORM_STAT_EFFECTS[entry.nameEn ?? entry.name];

  // Seasonally Affected: derived vulnerability (court chosen at stage 1)
  if ((entry.nameEn ?? entry.name) === 'Seasonally Affected') {
    const owned = getOwnedTransformFeatures(char);
    const court = owned.find(o => SEASONAL_VULNERABILITY[o.nameEn]);
    if (court) addResist(char, [SEASONAL_VULNERABILITY[court.nameEn]], 'vulnerability');
  }

  if (!e) return;

  if (e.abilityBonuses) {
    const cap = e.abilityCap ?? 20;
    const applied: Partial<AbilityScores> = {};
    const newScores = { ...char.abilityScores };
    for (const [key, bonus] of Object.entries(e.abilityBonuses)) {
      const k = key as keyof AbilityScores;
      if (!bonus) continue;
      const target = Math.min(cap, newScores[k] + bonus);
      const delta = Math.max(0, target - newScores[k]);
      if (delta > 0) {
        newScores[k] += delta;
        applied[k] = delta;
      }
    }
    char.abilityScores = newScores;
    if (Object.keys(applied).length > 0) entry.abilityBonuses = applied;
  }

  if (e.hpPerCharLevel) {
    const flat = char.level;
    char.hitPoints = {
      ...char.hitPoints,
      max: char.hitPoints.max + flat,
      current: char.hitPoints.current + flat,
    };
    entry.hpFlatApplied = flat;
  }

  if (e.resistances) addResist(char, e.resistances, 'resistance');
  if (e.immunities) addResist(char, e.immunities, 'immunity');
  if (e.vulnerabilities) addResist(char, e.vulnerabilities, 'vulnerability');

  if (e.senses) {
    const current = { ...(char.senses ?? {}) };
    for (const [key, value] of Object.entries(e.senses)) {
      if (typeof value !== 'number') continue;
      const k = key as keyof NonNullable<Character['senses']>;
      if (e.sensesStack && (current[k] ?? 0) > 0) {
        current[k] = (current[k] ?? 0) + value;
      } else if ((current[k] ?? 0) < value) {
        current[k] = value;
      }
    }
    char.senses = current;
  }

  if (e.skillProficiencies) {
    const skills = { ...char.skills };
    for (const sk of e.skillProficiencies) {
      const existing = skills[sk];
      if (existing?.proficient) {
        // Already proficient → upgrade to expertise (Strigoi, Red Sisterhood)
        skills[sk] = { ...existing, expertise: true };
      } else {
        skills[sk] = { proficient: true, expertise: existing?.expertise };
      }
    }
    char.skills = skills;
  }

  if (e.moveSpeeds) {
    const walk = char.speed;
    const resolve = (v: number | undefined) => (v === -1 ? walk : (v ?? 0));
    const current = { ...(char.speeds ?? {}) };
    for (const [key, value] of Object.entries(e.moveSpeeds)) {
      if (typeof value !== 'number') continue;
      const k = key as keyof NonNullable<Character['speeds']>;
      if (resolve(value) >= resolve(current[k]) && resolve(value) > 0) current[k] = value;
    }
    char.speeds = current;
  }
}

/**
 * Reverse the baked effects of a removed boon/flaw (stage decrease). Ability and
 * HP deltas are reversed exactly from what was recorded on the entry; resist
 * entries are dropped (re-added by other sources on the next level-up/sync);
 * senses and skill upgrades are left in place — корректируются вручную.
 * Mutates char.
 */
export function removeTransformFeatureEffects(char: Character, entry: OptFeatureEntry): void {
  const e = TRANSFORM_STAT_EFFECTS[entry.nameEn ?? entry.name];

  if ((entry.nameEn ?? entry.name) === 'Seasonally Affected') {
    removeResist(char, Object.values(SEASONAL_VULNERABILITY), 'vulnerability');
  }

  if (entry.abilityBonuses) {
    const newScores = { ...char.abilityScores };
    for (const [key, delta] of Object.entries(entry.abilityBonuses)) {
      const k = key as keyof AbilityScores;
      if (delta) newScores[k] -= delta;
    }
    char.abilityScores = newScores;
  }

  if (entry.hpFlatApplied) {
    char.hitPoints = {
      ...char.hitPoints,
      max: Math.max(1, char.hitPoints.max - entry.hpFlatApplied),
      current: Math.max(1, Math.min(char.hitPoints.current, char.hitPoints.max - entry.hpFlatApplied)),
    };
  }

  if (e?.resistances) removeResist(char, e.resistances, 'resistance');
  if (e?.immunities) removeResist(char, e.immunities, 'immunity');
  if (e?.vulnerabilities) removeResist(char, e.vulnerabilities, 'vulnerability');

  // Выбранные игроком резисты/спасброски этого дара
  if (entry.chosenResistances?.length) removeResist(char, entry.chosenResistances, 'resistance');
  if (entry.chosenSaveProficiencies?.length) {
    for (const ability of entry.chosenSaveProficiencies) {
      const k = ability as keyof AbilityScores;
      if (char.savingThrows[k]) char.savingThrows[k] = { proficient: false };
    }
  }
}

/** Pending player choices required by a boon/flaw (resist / save prof / ability penalty). */
export function getTransformFeatureChoices(nameEn: string): Pick<TransformStatEffect, 'resistanceChoice' | 'saveProfChoice' | 'abilityPenaltyChoice'> {
  const e = TRANSFORM_STAT_EFFECTS[nameEn];
  if (!e) return {};
  return {
    resistanceChoice: e.resistanceChoice,
    saveProfChoice: e.saveProfChoice,
    abilityPenaltyChoice: e.abilityPenaltyChoice,
  };
}

/** Apply the player's choices for a boon/flaw and record them on the entry for reversal. Mutates char & entry. */
export function applyTransformFeatureChoices(
  char: Character,
  entry: OptFeatureEntry,
  choices: { resistances?: string[]; saveProficiencies?: string[]; abilityPenalty?: keyof AbilityScores },
): void {
  const e = TRANSFORM_STAT_EFFECTS[entry.nameEn ?? entry.name];

  if (choices.resistances?.length) {
    addResist(char, choices.resistances, 'resistance');
    entry.chosenResistances = [...(entry.chosenResistances ?? []), ...choices.resistances];
  }

  if (choices.saveProficiencies?.length) {
    const applied: string[] = [];
    for (const ability of choices.saveProficiencies) {
      const k = ability as keyof AbilityScores;
      if (char.savingThrows[k] && !char.savingThrows[k].proficient) {
        char.savingThrows[k] = { proficient: true };
        applied.push(ability);
      }
    }
    if (applied.length) entry.chosenSaveProficiencies = [...(entry.chosenSaveProficiencies ?? []), ...applied];
  }

  if (choices.abilityPenalty && e?.abilityPenaltyChoice) {
    const k = choices.abilityPenalty;
    const amount = e.abilityPenaltyChoice.amount;
    char.abilityScores = { ...char.abilityScores, [k]: char.abilityScores[k] - amount };
    // Отрицательная дельта в abilityBonuses — откат вернёт очки обратно
    entry.abilityBonuses = { ...(entry.abilityBonuses ?? {}), [k]: (entry.abilityBonuses?.[k] ?? 0) - amount };
  }
}
