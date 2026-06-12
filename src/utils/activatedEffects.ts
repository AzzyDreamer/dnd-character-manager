// Активируемые состояния (формы, стойки, ярость): реестр ACTIVATED_EFFECTS и
// живые оверлеи статов. Ключевой принцип: активируемое НИКОГДА не вшивается в
// хранимые статы (armorClass, speed, damageResistances, abilityScores) — только
// живые дельты на этапе отображения/расчёта. Активация списывает ресурс,
// деактивация — нет; отдыхи снимают все активные эффекты.
//
// Формулировки эффектов соответствуют фактическим текстам фич в бандле данных
// (XPHB 2024 + Grim Hollow), а не редакции 2014.
import type { Character, AbilityScores, DamageResistanceEntry } from '../types';
import { getAbilityModifier } from './dnd';
import { getClassById, findSubclass } from '../data/classes';
import { isWearingArmor, isWearingHeavyArmor, isWearingMediumOrHeavyArmor, isWieldingShield } from './equipment';

// ── Types ──

export interface ActiveStatDelta {
  /** Минимальный уровень персонажа для этой части эффекта (Wrath of the Sea L10+) */
  minLevel?: number;
  // КД
  acBonus?: number;                          // Chitinous Shell: +2
  acBonusAbility?: keyof AbilityScores;      // Bladesong: +мод Инт
  acBonusMin?: number;                       // Bladesong: минимум +1
  // Скорость ходьбы
  speedBonus?: number;                       // Bladesong: +10; Chitinous Shell: −10
  // Доп. скорости; −1 = «равна скорости ходьбы» (Angelic Wings)
  moveSpeeds?: { fly?: number; swim?: number; climb?: number };
  // Резисты/иммунитеты — ЖИВОЙ оверлей, не пишутся в damageResistances
  resistances?: string[];                    // Rage: ['bludgeoning','piercing','slashing']
  resistAllExcept?: string[];                // монах L18: всё, кроме ['force']
  immunities?: string[];
  // Характеристики: floor («становится N, если была ниже»)
  abilityFloor?: Partial<AbilityScores>;
  // Не-числовое — пометки в чипе/тултипах (i18n-ключи game:activeEffects.notes.*)
  notes?: string[];
}

export type ActivatedEffectSource =
  | { type: 'class'; classId: string; level: number }
  | { type: 'subclass'; classId: string; subclassId: string; level: number }
  | { type: 'transformBoon'; boonNameEn: string }       // владение даром в optionalFeatures
  | { type: 'feat'; nameEn: string };

export type EffectDuration =
  | { type: 'minutes' | 'hours'; amount: number }
  | { type: 'untilShortRest' | 'untilLongRest' }
  | { type: 'manual' };

export interface ActivatedEffectDef {
  key: string;                               // стабильный ключ (persisted!)
  source: ActivatedEffectSource;
  // Условия активации:
  requiresNoArmor?: boolean;
  requiresNoShield?: boolean;                // Bladesong
  requiresNoHeavyArmor?: boolean;            // Rage, Chitinous Shell, Angelic Wings
  requiresNoMediumHeavyArmor?: boolean;      // Bladesong (лёгкая броня разрешена)
  // Стоимость:
  resourceKey?: string;                      // ключ resourceTrackers ('rages', 'wildShape', …)
  resourceCost?: number;                     // Superior Defense: 3 очка фокуса (по умолчанию 1)
  concentration?: boolean;                   // занимает concentratingOn (задел, в каталоге нет)
  // Длительность (по умолчанию manual):
  duration?: EffectDuration;
  // Дар, продлевающий длительность (Corrosive Membrane: Ooze Form 1 мин → 10 мин)
  durationOverrides?: { whenOwned: string; duration: EffectDuration }[];
  // Одновременность: активна максимум одна из группы
  exclusiveGroup?: string;
  // Эффект снимается состоянием Incapacitated (Rage, Bladesong, Superior Defense…)
  endsIfIncapacitated?: boolean;
  // Связанные эффекты «пока активна родительская форма» — включаются автоматически,
  // если дар во владении (Iron Pelt при гибридной форме и т.п.)
  linked?: { key: string; whenOwned: string }[];
  // Эффект существует только как linked-дополнение (не показывается тумблером)
  linkedOnly?: boolean;
  effects: ActiveStatDelta;
}

// ── Каталог ──

const HYBRID_LINKED = [
  { key: 'iron-pelt', whenOwned: 'Iron Pelt' },
  { key: 'shapeshifters-savagery', whenOwned: "Shapeshifter's Savagery" },
  { key: 'savage-instincts', whenOwned: 'Savage Instincts' },
  { key: 'hybrid-form-affinity', whenOwned: 'Hybrid Form Affinity' },
];

export const ACTIVATED_EFFECTS: Record<string, ActivatedEffectDef> = {
  // ── Классы и подклассы ──
  rage: {
    key: 'rage',
    source: { type: 'class', classId: 'barbarian', level: 1 },
    requiresNoHeavyArmor: true,
    resourceKey: 'rages',
    duration: { type: 'manual' },
    endsIfIncapacitated: true,
    effects: {
      resistances: ['bludgeoning', 'piercing', 'slashing'],
      notes: ['advStrChecksSaves', 'rageDamage', 'noConcentrationNoSpells', 'rageDuration'],
    },
  },
  bladesong: {
    key: 'bladesong',
    source: { type: 'subclass', classId: 'wizard', subclassId: 'bladesinger', level: 3 },
    requiresNoMediumHeavyArmor: true,
    requiresNoShield: true,
    resourceKey: 'bladesong',
    duration: { type: 'minutes', amount: 1 },
    endsIfIncapacitated: true,
    effects: {
      acBonusAbility: 'intelligence',
      acBonusMin: 1,
      speedBonus: 10,
      notes: ['advAcrobatics', 'concentrationSaveBonus', 'endsTwoHandedAttack'],
    },
  },
  'form-of-dread': {
    key: 'form-of-dread',
    source: { type: 'subclass', classId: 'warlock', subclassId: 'undead', level: 3 },
    resourceKey: 'formOfDread',
    duration: { type: 'minutes', amount: 1 },
    effects: {
      notes: ['tempHp1d10PlusLevel', 'fearOnHit', 'immuneFrightened'],
    },
  },
  'giants-might': {
    key: 'giants-might',
    source: { type: 'subclass', classId: 'fighter', subclassId: 'rune-knight', level: 3 },
    resourceKey: 'giantsMight',
    duration: { type: 'minutes', amount: 1 },
    effects: {
      notes: ['sizeLarge', 'advStrChecksSaves', 'giantsMightDamage'],
    },
  },
  'symbiotic-entity': {
    key: 'symbiotic-entity',
    source: { type: 'subclass', classId: 'druid', subclassId: 'spores', level: 3 },
    resourceKey: 'wildShape',
    duration: { type: 'minutes', amount: 10 },
    effects: {
      notes: ['tempHp4PerLevel', 'haloSporesDouble', 'meleeExtraNecrotic'],
    },
  },
  'wrath-of-the-sea': {
    key: 'wrath-of-the-sea',
    source: { type: 'subclass', classId: 'druid', subclassId: 'sea', level: 3 },
    resourceKey: 'wildShape',
    duration: { type: 'minutes', amount: 10 },
    endsIfIncapacitated: true,
    effects: {
      notes: ['emanationColdPush'],
    },
    // Stormborn (L10): полёт и резисты, пока эманация активна
    linked: [{ key: 'stormborn', whenOwned: '' }],
  },
  stormborn: {
    key: 'stormborn',
    source: { type: 'subclass', classId: 'druid', subclassId: 'sea', level: 10 },
    linkedOnly: true,
    effects: {
      minLevel: 10,
      resistances: ['cold', 'lightning', 'thunder'],
      moveSpeeds: { fly: -1 },
    },
  },
  'superior-defense': {
    key: 'superior-defense',
    source: { type: 'class', classId: 'monk', level: 18 },
    resourceKey: 'focusPoints',
    resourceCost: 3,
    duration: { type: 'minutes', amount: 1 },
    endsIfIncapacitated: true,
    effects: {
      resistAllExcept: ['force'],
    },
  },
  // ── Аватары паладина L20 ──
  'invincible-conqueror': {
    key: 'invincible-conqueror',
    source: { type: 'subclass', classId: 'paladin', subclassId: 'conquest', level: 20 },
    resourceKey: 'invincibleConqueror',
    duration: { type: 'minutes', amount: 1 },
    effects: {
      resistAllExcept: [],
      notes: ['extraAttack', 'critRange19'],
    },
  },
  'exalted-champion': {
    key: 'exalted-champion',
    source: { type: 'subclass', classId: 'paladin', subclassId: 'crown', level: 20 },
    resourceKey: 'exaltedChampion',
    duration: { type: 'hours', amount: 1 },
    effects: {
      resistances: ['bludgeoning', 'piercing', 'slashing'],
      notes: ['nonmagicalOnly', 'allyWisSaveAura'],
    },
  },
  'avenging-angel': {
    key: 'avenging-angel',
    source: { type: 'subclass', classId: 'paladin', subclassId: 'vengeance', level: 20 },
    resourceKey: 'avengingAngel',
    duration: { type: 'minutes', amount: 10 },
    effects: {
      moveSpeeds: { fly: 60 },
      notes: ['hover', 'frightfulAura'],
    },
  },
  // ── Гибридные формы ликантропа (Grim Hollow) ──
  'hybrid-wolf-form': {
    key: 'hybrid-wolf-form',
    source: { type: 'transformBoon', boonNameEn: 'Hybrid Wolf Form' },
    duration: { type: 'manual' },
    exclusiveGroup: 'transform-form',
    linked: HYBRID_LINKED,
    effects: {
      abilityFloor: { strength: 18 },
      speedBonus: 10,
      notes: ['dashBonusAction', 'noSpellsInForm'],
    },
  },
  'hybrid-bear-form': {
    key: 'hybrid-bear-form',
    source: { type: 'transformBoon', boonNameEn: 'Hybrid Bear Form' },
    duration: { type: 'manual' },
    exclusiveGroup: 'transform-form',
    linked: HYBRID_LINKED,
    effects: {
      abilityFloor: { strength: 20 },
      moveSpeeds: { climb: -1 },
      notes: ['noSpellsInForm'],
    },
  },
  'hybrid-rat-form': {
    key: 'hybrid-rat-form',
    source: { type: 'transformBoon', boonNameEn: 'Hybrid Rat Form' },
    duration: { type: 'manual' },
    exclusiveGroup: 'transform-form',
    linked: HYBRID_LINKED,
    effects: {
      abilityFloor: { dexterity: 18 },
      notes: ['hideDisengageBonusAction', 'stealthExpertise', 'noSpellsInForm'],
    },
  },
  // Дары «пока ты в гибридной форме» — linked-дополнения, без своих тумблеров
  'iron-pelt': {
    key: 'iron-pelt',
    source: { type: 'transformBoon', boonNameEn: 'Iron Pelt' },
    linkedOnly: true,
    effects: {
      resistances: ['bludgeoning', 'piercing', 'slashing'],
      notes: ['magicSilverIgnores'],
    },
  },
  'shapeshifters-savagery': {
    key: 'shapeshifters-savagery',
    source: { type: 'transformBoon', boonNameEn: "Shapeshifter's Savagery" },
    linkedOnly: true,
    effects: {
      notes: ['clawBiteExtraD8', 'immuneCharmedFrightened'],
    },
  },
  'savage-instincts': {
    key: 'savage-instincts',
    source: { type: 'transformBoon', boonNameEn: 'Savage Instincts' },
    linkedOnly: true,
    effects: {
      notes: ['bloodiedExtraD8'],
    },
  },
  'hybrid-form-affinity': {
    key: 'hybrid-form-affinity',
    source: { type: 'transformBoon', boonNameEn: 'Hybrid Form Affinity' },
    linkedOnly: true,
    effects: {
      notes: ['speakAndCastInForm', 'allyWisAura'],
    },
  },
  // ── Прочие активируемые дары трансформаций ──
  'ooze-form': {
    key: 'ooze-form',
    source: { type: 'transformBoon', boonNameEn: 'Ooze Form' },
    duration: { type: 'minutes', amount: 1 },
    durationOverrides: [{ whenOwned: 'Corrosive Membrane', duration: { type: 'minutes', amount: 10 } }],
    linked: [
      { key: 'slimy-mien', whenOwned: 'Slimy Mien' },
      { key: 'corrosive-membrane', whenOwned: 'Corrosive Membrane' },
    ],
    effects: {
      notes: ['amorphous', 'immuneGrappledRestrained'],
    },
  },
  'slimy-mien': {
    key: 'slimy-mien',
    source: { type: 'transformBoon', boonNameEn: 'Slimy Mien' },
    linkedOnly: true,
    effects: {
      notes: ['immuneCharmed', 'blindsightPlus30'],
    },
  },
  'corrosive-membrane': {
    key: 'corrosive-membrane',
    source: { type: 'transformBoon', boonNameEn: 'Corrosive Membrane' },
    linkedOnly: true,
    effects: {
      notes: ['acidSheen'],
    },
  },
  'writhing-tendrils': {
    key: 'writhing-tendrils',
    source: { type: 'transformBoon', boonNameEn: 'Writhing Tendrils' },
    duration: { type: 'manual' },
    linked: [{ key: 'poison-tendrils-aura', whenOwned: 'Poison Tendrils' }],
    effects: {
      notes: ['tendrilsPush'],
    },
  },
  'poison-tendrils-aura': {
    key: 'poison-tendrils-aura',
    source: { type: 'transformBoon', boonNameEn: 'Poison Tendrils' },
    linkedOnly: true,
    effects: {
      notes: ['poisonAura3d6'],
    },
  },
  // Аберрантные мутации (Aberrant Mutation): одна активна одновременно
  'chitinous-shell': {
    key: 'chitinous-shell',
    source: { type: 'transformBoon', boonNameEn: 'Aberrant Mutation' },
    requiresNoHeavyArmor: true,
    duration: { type: 'minutes', amount: 1 },
    exclusiveGroup: 'aberrant-mutation',
    effects: {
      acBonus: 2,
      speedBonus: -10,
    },
  },
  'slimy-form': {
    key: 'slimy-form',
    source: { type: 'transformBoon', boonNameEn: 'Aberrant Mutation' },
    duration: { type: 'minutes', amount: 1 },
    exclusiveGroup: 'aberrant-mutation',
    effects: {
      resistances: ['acid', 'fire', 'cold'],
      notes: ['advEscapeGrapple', 'dashBonusAction'],
    },
  },
  'angelic-wings': {
    key: 'angelic-wings',
    source: { type: 'transformBoon', boonNameEn: 'Angelic Wings' },
    requiresNoHeavyArmor: true,
    duration: { type: 'hours', amount: 1 },
    effects: {
      moveSpeeds: { fly: -1 },
    },
  },
  'incorporeal-movement': {
    key: 'incorporeal-movement',
    source: { type: 'transformBoon', boonNameEn: 'Incorporeal Movement' },
    duration: { type: 'manual' },
    effects: {
      resistAllExcept: ['force'],
      notes: ['moveThroughObjects', 'lightlyObscured', 'untilNextTurn'],
    },
  },
  'bow-celestial-judgement': {
    key: 'bow-celestial-judgement',
    source: { type: 'transformBoon', boonNameEn: 'Bow of Celestial Judgement' },
    duration: { type: 'minutes', amount: 1 },
    linked: [{ key: 'bow-celestial-domination', whenOwned: 'Bow of Celestial Domination' }],
    effects: {
      resistances: ['necrotic'],
      notes: ['radiantShot'],
    },
  },
  'bow-celestial-domination': {
    key: 'bow-celestial-domination',
    source: { type: 'transformBoon', boonNameEn: 'Bow of Celestial Domination' },
    linkedOnly: true,
    effects: {
      immunities: ['necrotic'],
      notes: ['tempHp15PerTurn'],
    },
  },
};

// Маппинг legacy-поля activeTransformForm (nameEn дара) → ключ реестра
export const LEGACY_TRANSFORM_FORM_KEYS: Record<string, string> = {
  'Hybrid Wolf Form': 'hybrid-wolf-form',
  'Hybrid Bear Form': 'hybrid-bear-form',
  'Hybrid Rat Form': 'hybrid-rat-form',
};

/** Сигнатура перевода, совместимая с i18next TFunction. */
export type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

/** Локализованное имя эффекта по ключу реестра (ns game). */
export function getEffectName(key: string, tg: TranslateFn): string {
  return tg(`activeEffects.names.${key}`, { defaultValue: key });
}

// ── Доступность и активность ──

function getSubclassId(char: Character): string | null {
  if (!char.subclass || !char.classId) return null;
  const classDef = getClassById(char.classId);
  if (!classDef) return null;
  return findSubclass(classDef, char.subclass)?.id ?? null;
}

function ownsBoon(char: Character, boonNameEn: string): boolean {
  return (char.optionalFeatures ?? []).some(f => (f.nameEn ?? f.name) === boonNameEn);
}

/** Доступен ли эффект персонажу по источнику (класс+уровень / подкласс / дар / черта). */
export function isEffectAvailable(char: Character, def: ActivatedEffectDef): boolean {
  const s = def.source;
  switch (s.type) {
    case 'class':
      return char.classId === s.classId && char.level >= s.level;
    case 'subclass':
      return char.classId === s.classId && char.level >= s.level && getSubclassId(char) === s.subclassId;
    case 'transformBoon':
      return ownsBoon(char, s.boonNameEn);
    case 'feat':
      return (char.feats ?? []).some(f => (f.nameEn ?? f.name) === s.nameEn);
  }
}

/** Все эффекты, доступные персонажу для ручной активации (без linkedOnly). */
export function getAvailableEffects(char: Character): ActivatedEffectDef[] {
  return Object.values(ACTIVATED_EFFECTS).filter(def => !def.linkedOnly && isEffectAvailable(char, def));
}

/** Выполнены ли условия активации (броня/щит). */
export function isEffectConditionMet(char: Character, def: ActivatedEffectDef): boolean {
  if (def.requiresNoArmor && isWearingArmor(char)) return false;
  if (def.requiresNoHeavyArmor && isWearingHeavyArmor(char)) return false;
  if (def.requiresNoMediumHeavyArmor && isWearingMediumOrHeavyArmor(char)) return false;
  if (def.requiresNoShield && isWieldingShield(char)) return false;
  return true;
}

export interface ActiveEffectEntry {
  key: string;
  activatedAt: string;
  expiresAt?: string;
}

/**
 * Записи активных эффектов: persisted activeEffects + legacy activeTransformForm
 * (до миграции в effectSync лист должен работать как раньше). Отфильтрованы по
 * существованию в реестре и доступности источника (снятый дар = эффект пропал).
 */
export function getActiveEffectEntries(char: Character): ActiveEffectEntry[] {
  const entries: ActiveEffectEntry[] = [...(char.activeEffects ?? [])];
  // Legacy: гибридная форма, ещё не мигрированная в activeEffects
  const legacyKey = char.activeTransformForm ? LEGACY_TRANSFORM_FORM_KEYS[char.activeTransformForm] : undefined;
  if (legacyKey && !entries.some(e => e.key === legacyKey)) {
    entries.push({ key: legacyKey, activatedAt: char.updatedAt ?? new Date().toISOString() });
  }
  return entries.filter(e => {
    const def = ACTIVATED_EFFECTS[e.key];
    return !!def && isEffectAvailable(char, def);
  });
}

/** Активен ли эффект с данным ключом. */
export function hasActiveEffect(char: Character, key: string): boolean {
  return getActiveEffectEntries(char).some(e => e.key === key);
}

/** Истёк ли эффект по expiresAt (для подсветки в UI; удаляется в sync). */
export function isEffectExpired(entry: ActiveEffectEntry, now: Date = new Date()): boolean {
  return !!entry.expiresAt && new Date(entry.expiresAt).getTime() <= now.getTime();
}

export interface ResolvedActiveEffect {
  def: ActivatedEffectDef;
  /** Ключ родительского эффекта, если этот включён как linked */
  linkedFrom?: string;
}

/**
 * Развёрнутый список действующих эффектов: активные записи + их linked-эффекты
 * (если дар во владении; пустой whenOwned = всегда, напр. Stormborn по уровню).
 * Эффекты с невыполненными условиями (надели тяжёлую броню в ярости) исключаются.
 */
export function getResolvedActiveEffects(char: Character): ResolvedActiveEffect[] {
  const out: ResolvedActiveEffect[] = [];
  for (const entry of getActiveEffectEntries(char)) {
    const def = ACTIVATED_EFFECTS[entry.key];
    if (!def || !isEffectConditionMet(char, def)) continue;
    out.push({ def });
    for (const link of def.linked ?? []) {
      const linkedDef = ACTIVATED_EFFECTS[link.key];
      if (!linkedDef) continue;
      if (link.whenOwned && !ownsBoon(char, link.whenOwned)) continue;
      if (!isEffectAvailable(char, linkedDef)) continue;
      if (!isEffectConditionMet(char, linkedDef)) continue;
      out.push({ def: linkedDef, linkedFrom: def.key });
    }
  }
  return out;
}

/** Дельты действующих эффектов с учётом minLevel. */
export function getActiveDeltas(char: Character): ActiveStatDelta[] {
  return getResolvedActiveEffects(char)
    .map(r => r.def.effects)
    .filter(d => char.level >= (d.minLevel ?? 1));
}

// ── Живые оверлеи статов ──

/**
 * Копия персонажа без активируемых оверлеев — для расчёта ХРАНИМЫХ производных
 * статов (resolveAC в sync/левел-апе). Гарантия «ничего не бейкается».
 */
export function stripActiveOverlays(char: Character): Character {
  if (!char.activeEffects?.length && !char.activeTransformForm && !char.wildShape?.active && !char.kindredForm?.active) return char;
  return {
    ...char,
    activeEffects: undefined,
    activeTransformForm: undefined,
    wildShape: char.wildShape ? { ...char.wildShape, active: undefined } : undefined,
    // Хиты не трогаем — это копия только для расчёта хранимых производных статов
    kindredForm: undefined,
  };
}

/** Части КД от активных эффектов (для getACBreakdown; key = 'state'). */
export function getActiveACBonus(char: Character, scores: AbilityScores): number {
  let total = 0;
  for (const d of getActiveDeltas(char)) {
    if (d.acBonus) total += d.acBonus;
    if (d.acBonusAbility) {
      total += Math.max(d.acBonusMin ?? 0, getAbilityModifier(scores[d.acBonusAbility]));
    }
  }
  return total;
}

/** Живой сдвиг скорости ходьбы от активных эффектов (не пишется в char.speed). */
export function getActiveSpeedAdjust(char: Character): number {
  let total = 0;
  for (const d of getActiveDeltas(char)) {
    if (d.speedBonus) total += d.speedBonus;
  }
  return total;
}

/** Floor-модификаторы характеристик активных форм (Сила становится 18/20…). */
export function getActiveAbilityFloors(char: Character): Partial<AbilityScores> {
  const floors: Partial<AbilityScores> = {};
  for (const d of getActiveDeltas(char)) {
    for (const [key, value] of Object.entries(d.abilityFloor ?? {})) {
      const k = key as keyof AbilityScores;
      if (typeof value === 'number' && value > (floors[k] ?? 0)) floors[k] = value;
    }
  }
  return floors;
}

/** Доп. скорости от активных эффектов; −1 = «равна скорости ходьбы». */
export function getActiveMoveSpeeds(char: Character): { fly?: number; swim?: number; climb?: number } {
  const out: { fly?: number; swim?: number; climb?: number } = {};
  const walk = char.speed;
  const resolve = (v: number | undefined) => (v === -1 ? walk : (v ?? 0));
  for (const d of getActiveDeltas(char)) {
    for (const [key, value] of Object.entries(d.moveSpeeds ?? {})) {
      const k = key as 'fly' | 'swim' | 'climb';
      if (typeof value === 'number' && resolve(value) > resolve(out[k])) out[k] = value;
    }
  }
  return out;
}

const ALL_DAMAGE_TYPES = [
  'acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic',
  'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder',
];

export interface EffectiveResistanceEntry extends DamageResistanceEntry {
  /** Временная (от активного эффекта): не редактируется и не сохраняется */
  temporary?: boolean;
  /** Ключ эффекта-источника (для тултипа «от: Ярость») */
  sourceKey?: string;
}

/**
 * Хранимые резисты + временные от активных эффектов. Временные не пишутся в
 * damageResistances; дубликаты с хранимыми не добавляются, иммунитет от эффекта
 * вытесняет временный резист того же типа.
 */
export function getEffectiveResistances(char: Character): EffectiveResistanceEntry[] {
  const stored: EffectiveResistanceEntry[] = [...(char.damageResistances ?? [])];
  const temp: EffectiveResistanceEntry[] = [];

  const has = (type: string, modifier: string) =>
    stored.some(r => r.type === type && r.modifier === modifier) ||
    temp.some(r => r.type === type && r.modifier === modifier);

  const add = (type: string, modifier: 'resistance' | 'immunity', sourceKey: string) => {
    if (has(type, modifier)) return;
    temp.push({ type, modifier, temporary: true, sourceKey });
  };

  for (const r of getResolvedActiveEffects(char)) {
    const d = r.def.effects;
    if (char.level < (d.minLevel ?? 1)) continue;
    const sourceKey = r.linkedFrom ?? r.def.key;
    for (const type of d.resistances ?? []) add(type, 'resistance', sourceKey);
    if (d.resistAllExcept) {
      for (const type of ALL_DAMAGE_TYPES) {
        if (!d.resistAllExcept.includes(type)) add(type, 'resistance', sourceKey);
      }
    }
    for (const type of d.immunities ?? []) add(type, 'immunity', sourceKey);
  }

  // Иммунитет вытесняет временный резист того же типа (Bow of Celestial Domination)
  const filteredTemp = temp.filter(t =>
    t.modifier !== 'resistance' ||
    !temp.some(o => o.type === t.type && o.modifier === 'immunity'),
  );

  return [...stored, ...filteredTemp];
}

// ── Жизненный цикл ──

/** Фактическая длительность эффекта с учётом durationOverrides (Corrosive Membrane). */
export function getEffectDuration(char: Character, def: ActivatedEffectDef): EffectDuration {
  for (const o of def.durationOverrides ?? []) {
    if (ownsBoon(char, o.whenOwned)) return o.duration;
  }
  return def.duration ?? { type: 'manual' };
}

export interface ActivationResult {
  char: Character;
  /** Ключи эффектов той же exclusiveGroup, снятые при активации */
  replaced: string[];
}

/**
 * Активировать эффект: снять конкурентов из exclusiveGroup, списать ресурс,
 * проставить expiresAt. Условия и достаточность ресурса проверяет вызывающий
 * (UI показывает причину недоступности). Возвращает НОВЫЙ объект персонажа.
 */
export function activateEffect(char: Character, key: string, resourceMax?: number): ActivationResult {
  const def = ACTIVATED_EFFECTS[key];
  if (!def) return { char, replaced: [] };

  const replaced: string[] = [];
  let effects = [...(char.activeEffects ?? [])];

  if (def.exclusiveGroup) {
    effects = effects.filter(e => {
      const other = ACTIVATED_EFFECTS[e.key];
      if (other?.exclusiveGroup === def.exclusiveGroup) {
        replaced.push(e.key);
        return false;
      }
      return true;
    });
  }

  const now = new Date();
  const duration = getEffectDuration(char, def);
  let expiresAt: string | undefined;
  if (duration.type === 'minutes') expiresAt = new Date(now.getTime() + duration.amount * 60_000).toISOString();
  if (duration.type === 'hours') expiresAt = new Date(now.getTime() + duration.amount * 3_600_000).toISOString();

  effects.push({ key, activatedAt: now.toISOString(), ...(expiresAt ? { expiresAt } : {}) });

  const updated: Character = {
    ...char,
    activeEffects: effects,
    // Legacy-поле больше не используется; активация формы переводит на новую модель
    activeTransformForm: undefined,
    updatedAt: now.toISOString(),
  };

  // Списание ресурса через существующий механизм трекеров
  if (def.resourceKey) {
    const cost = def.resourceCost ?? 1;
    const tracker = char.resourceTrackers?.[def.resourceKey];
    const max = tracker?.max ?? resourceMax ?? cost;
    const current = tracker?.current ?? max;
    updated.resourceTrackers = {
      ...(char.resourceTrackers ?? {}),
      [def.resourceKey]: { current: Math.max(0, current - cost), max },
    };
  }

  return { char: updated, replaced };
}

/** Деактивировать эффект (ресурс не возвращается). Возвращает НОВЫЙ объект. */
export function deactivateEffect(char: Character, key: string): Character {
  const legacyMatches = !!char.activeTransformForm &&
    LEGACY_TRANSFORM_FORM_KEYS[char.activeTransformForm] === key;
  return {
    ...char,
    activeEffects: (char.activeEffects ?? []).filter(e => e.key !== key),
    activeTransformForm: legacyMatches ? undefined : char.activeTransformForm,
    updatedAt: new Date().toISOString(),
  };
}

/** Снять все активные эффекты (отдых), включая Дикий облик. Возвращает НОВЫЙ объект. */
export function clearAllActiveEffects(char: Character): Character {
  if (!char.activeEffects?.length && !char.activeTransformForm && !char.wildShape?.active) return char;
  return {
    ...char,
    activeEffects: undefined,
    activeTransformForm: undefined,
    wildShape: char.wildShape ? { ...char.wildShape, active: undefined } : undefined,
  };
}

/** Снять эффекты, прерываемые состоянием Incapacitated (Rage, Bladesong, Дикий облик…). Мутирует копию. */
export function removeIncapacitatedEffects(char: Character): Character {
  const remaining = (char.activeEffects ?? []).filter(e => !ACTIVATED_EFFECTS[e.key]?.endsIfIncapacitated);
  const wildShapeActive = !!char.wildShape?.active;
  if (remaining.length === (char.activeEffects ?? []).length && !wildShapeActive) return char;
  return {
    ...char,
    activeEffects: remaining.length ? remaining : undefined,
    wildShape: char.wildShape ? { ...char.wildShape, active: undefined } : undefined,
  };
}

/**
 * Идемпотентная чистка для effectSync: миграция legacy activeTransformForm в
 * activeEffects и удаление просроченных записей. Мутирует переданный объект
 * (sync работает со structuredClone). Возвращает true, если что-то изменилось.
 */
export function syncActiveEffects(char: Character, now: Date = new Date()): boolean {
  let changed = false;

  // 1) Миграция activeTransformForm → activeEffects
  if (char.activeTransformForm) {
    const key = LEGACY_TRANSFORM_FORM_KEYS[char.activeTransformForm];
    const def = key ? ACTIVATED_EFFECTS[key] : undefined;
    if (def && isEffectAvailable(char, def)) {
      const effects = [...(char.activeEffects ?? [])];
      if (!effects.some(e => e.key === key)) {
        effects.push({ key, activatedAt: now.toISOString() });
      }
      char.activeEffects = effects;
    }
    char.activeTransformForm = undefined;
    changed = true;
  }

  // 2) Удаление просроченных и осиротевших (источник утрачен / ключ неизвестен)
  if (char.activeEffects?.length) {
    const kept = char.activeEffects.filter(e => {
      const def = ACTIVATED_EFFECTS[e.key];
      if (!def || !isEffectAvailable(char, def)) return false;
      return !isEffectExpired(e, now);
    });
    if (kept.length !== char.activeEffects.length) {
      char.activeEffects = kept.length ? kept : undefined;
      changed = true;
    }
  }

  return changed;
}
