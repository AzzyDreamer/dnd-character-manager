import type { Character, SpellSlots } from '../types';
import { getAbilityModifier } from './dnd';
import { getEffectiveAbilityScores, getEquippedItemBonuses } from './classEffects';
import { parseScaledDamage, scaleDiceExpression } from './scaleDamage';
import i18n from '../i18n';

// ─── Damage dice extraction ───

/** Extract {@damage XdY+Z} expressions from spell entries (recursive) */
export function extractDamageDice(entries: any[]): string[] {
  const results: string[] = [];
  const regex = /\{@damage\s+([^}]+)\}/g;

  function walk(node: any) {
    if (typeof node === 'string') {
      let m;
      while ((m = regex.exec(node)) !== null) {
        results.push(m[1].trim());
      }
    } else if (Array.isArray(node)) {
      for (const child of node) walk(child);
    } else if (typeof node === 'object' && node !== null) {
      if (node.entries) walk(node.entries);
    }
  }

  walk(entries);
  return results;
}

/** Extract {@dice XdY} expressions (for healing, etc.) */
export function extractHealingDice(entries: any[]): string[] {
  const results: string[] = [];
  const regex = /\{@dice\s+([^}]+)\}/g;

  function walk(node: any) {
    if (typeof node === 'string') {
      let m;
      while ((m = regex.exec(node)) !== null) {
        results.push(m[1].trim());
      }
    } else if (Array.isArray(node)) {
      for (const child of node) walk(child);
    } else if (typeof node === 'object' && node !== null) {
      if (node.entries) walk(node.entries);
    }
  }

  walk(entries);
  return results;
}

// ─── Cantrip scaling ───

/** Get cantrip damage dice for character level */
export function getScaledCantripDamage(
  scalingLevelDice: { label?: string; scaling: Record<string, string> } | undefined,
  characterLevel: number,
): string | null {
  if (!scalingLevelDice?.scaling) return null;
  const thresholds = Object.keys(scalingLevelDice.scaling)
    .map(Number)
    .sort((a, b) => a - b);
  let result: string | null = null;
  for (const t of thresholds) {
    if (characterLevel >= t) {
      result = scalingLevelDice.scaling[String(t)];
    }
  }
  return result;
}

// ─── Upcasting ───

/** Get bonus dice per upcast level from entriesHigherLevel */
export function getUpcastBonusDice(
  entriesHigherLevel: any[] | undefined,
  baseLevel: number,
  castLevel: number,
): string | null {
  if (!entriesHigherLevel || castLevel <= baseLevel) return null;

  // Search for {@scaledamage BASE|RANGE|BONUS} or {@scaledice BASE|RANGE|BONUS}
  const text = JSON.stringify(entriesHigherLevel);
  const match = text.match(/\{@(?:scaledamage|scaledice)\s+([^}]+)\}/);
  if (!match) return null;

  const parts = parseScaledDamage(match[1]);
  if (!parts) return null;

  const effectiveCast = Math.min(castLevel, parts.range[1]);
  const levelDiff = effectiveCast - baseLevel;
  if (levelDiff <= 0) return null;

  return scaleDiceExpression(parts.perLevel, levelDiff) || null;
}

// ─── Spell attack & DC ───

/** Build spell attack dice expression: 1d20+bonus */
export function buildSpellAttackExpr(character: Character): string {
  if (!character.spellcasting) return '1d20';
  const itemBonuses = getEquippedItemBonuses(character);
  const totalBonus = character.spellcasting.spellAttackBonus + itemBonuses.bonusSpellAttack;
  return `1d20${totalBonus >= 0 ? '+' : ''}${totalBonus}`;
}

/** Get total spell attack bonus number */
export function getSpellAttackBonus(character: Character): number {
  if (!character.spellcasting) return 0;
  const itemBonuses = getEquippedItemBonuses(character);
  return character.spellcasting.spellAttackBonus + itemBonuses.bonusSpellAttack;
}

/** Get effective spell save DC */
export function getEffectiveSpellDC(character: Character): number {
  if (!character.spellcasting) return 10;
  const itemBonuses = getEquippedItemBonuses(character);
  return character.spellcasting.spellSaveDC + itemBonuses.bonusSpellSaveDc;
}

// ─── Ritual ───

export function isRitualSpell(spellData: any): boolean {
  return spellData?.meta?.ritual === true;
}

// ─── Healing ───

export function isHealingSpell(spellData: any): boolean {
  return spellData?.miscTags?.includes('HL') === true;
}

// ─── Spell slots ───

const SLOT_KEYS: (keyof SpellSlots)[] = [
  'level1', 'level2', 'level3', 'level4', 'level5',
  'level6', 'level7', 'level8', 'level9',
];

export interface SlotInfo {
  level: number;
  available: number;
  total: number;
  key: keyof SpellSlots;
}

/** Get slot info for each level from minLevel with total > 0 */
export function getAvailableSlots(spellSlots: SpellSlots | undefined, minLevel: number): SlotInfo[] {
  if (!spellSlots) return [];
  const result: SlotInfo[] = [];
  for (let i = minLevel; i <= 9; i++) {
    const key = SLOT_KEYS[i - 1];
    const slot = spellSlots[key];
    if (slot.total > 0) {
      result.push({ level: i, available: slot.total - slot.used, total: slot.total, key });
    }
  }
  return result;
}

/** Consume one spell slot at the given level, return updated character */
export function consumeSpellSlot(character: Character, slotLevel: number): Character {
  if (!character.spellcasting?.spellSlots) return character;
  const key = SLOT_KEYS[slotLevel - 1];
  const slot = character.spellcasting.spellSlots[key];
  if (slot.used >= slot.total) return character; // no slots left

  return {
    ...character,
    spellcasting: {
      ...character.spellcasting,
      spellSlots: {
        ...character.spellcasting.spellSlots,
        [key]: { ...slot, used: slot.used + 1 },
      },
    },
  };
}

// ─── Composite damage expression ───

export interface DamageInfo {
  expression: string;
  type: string;       // "fire", "force", etc. or healing type
  isHealing: boolean;
}

/** Build the full damage/healing dice expression for a spell at a given cast level */
export function buildDamageExpression(
  spellData: any,
  character: Character,
  castLevel: number,
): DamageInfo | null {
  const isCantrip = spellData.level === 0;
  const healing = isHealingSpell(spellData);
  const damageType = healing
    ? i18n.t('healingType', { ns: 'game' })
    : (spellData.damageInflict?.[0] ?? '');

  let baseDice: string | null = null;

  if (isCantrip && spellData.scalingLevelDice) {
    baseDice = getScaledCantripDamage(spellData.scalingLevelDice, character.level);
  }

  if (!baseDice) {
    // Extract from entries
    const damageDice = extractDamageDice(spellData.entries);
    const healDice = healing ? extractHealingDice(spellData.entries) : [];
    baseDice = damageDice[0] ?? healDice[0] ?? null;
  }

  if (!baseDice) return null;

  let expression = baseDice;

  // Upcast bonus
  if (!isCantrip && castLevel > spellData.level) {
    const upcastBonus = getUpcastBonusDice(spellData.entriesHigherLevel, spellData.level, castLevel);
    if (upcastBonus) {
      expression = `${expression}+${upcastBonus}`;
    }
  }

  // Agonizing Blast (CHA mod for warlock cantrips)
  if (isCantrip) {
    const hasAgonizingBlast = (character.optionalFeatures ?? []).some(
      f => f.name === 'Agonizing Blast' && f.featureType === 'EI'
    );
    if (hasAgonizingBlast && spellData.damageInflict) {
      const effScores = getEffectiveAbilityScores(character);
      const chaMod = getAbilityModifier(effScores.charisma);
      if (chaMod !== 0) {
        expression = `${expression}${chaMod >= 0 ? '+' : ''}${chaMod}`;
      }
    }
  }

  // Add spellcasting ability mod for healing spells that mention it
  if (healing && character.spellcasting) {
    const abilityMod = getAbilityModifier(
      getEffectiveAbilityScores(character)[character.spellcasting.ability]
    );
    // Most healing spells say "+your spellcasting ability modifier"
    const entriesText = JSON.stringify(spellData.entries).toLowerCase();
    if (entriesText.includes('spellcasting ability modifier') || entriesText.includes('ability modifier')) {
      expression = `${expression}${abilityMod >= 0 ? '+' : ''}${abilityMod}`;
    }
  }

  return { expression, type: damageType, isHealing: healing };
}

// ─── Save ability name translation ───

export function translateSaveAbility(ability: string): string {
  const key = ability.toLowerCase();
  const translated = i18n.t(`abilities.${key}`, { ns: 'game' });
  // If key not found, i18next returns the key path — fall back to original
  return translated !== `abilities.${key}` ? translated : ability;
}

// ─── Damage type translation ───

export function translateDamageType(type: string): string {
  const key = type.toLowerCase();
  const translated = i18n.t(`damageTypesFull.${key}`, { ns: 'game' });
  return translated !== `damageTypesFull.${key}` ? translated : type;
}
