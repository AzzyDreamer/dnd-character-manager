import type { Character } from '../types';
import { getTransformSpeedAdjust } from './transformationEffects';
import { getActiveSpeedAdjust } from './activatedEffects';
import { getWildShapeWalkSpeed } from './wildShape';
import { getKindredWalkSpeed } from './kindredForm';
import { getItemWalkSpeedEffect } from './itemEffects';

// ── Condition mechanics ──
//
// Keyed by the canonical English condition name (lowercase). `speedZero` marks
// conditions that reduce speed to 0; `effectKeys` are i18n keys (under
// character:sheet.conditions.effects.*) describing the mechanical effects shown
// on the condition chip. Only the standard PHB conditions carry mechanics;
// diseases and homebrew states fall through with no entry.

export interface ConditionMechanics {
  speedZero?: boolean;
  /** Breaks/incapacitates: no actions; also breaks Concentration. */
  incapacitated?: boolean;
  effectKeys: string[];
}

export const CONDITION_MECHANICS: Record<string, ConditionMechanics> = {
  blinded: { effectKeys: ['cantSee', 'attackDisadv', 'attackedAdv'] },
  charmed: { effectKeys: ['cantTargetCharmer', 'charmerSocialAdv'] },
  deafened: { effectKeys: ['cantHear'] },
  frightened: { effectKeys: ['checkAttackDisadv', 'cantMoveCloser'] },
  grappled: { speedZero: true, effectKeys: ['speedZero', 'attackDisadvOthers'] },
  incapacitated: { incapacitated: true, effectKeys: ['noActions', 'concentrationBroken'] },
  invisible: { effectKeys: ['attackAdv', 'attackedDisadv'] },
  paralyzed: { speedZero: true, incapacitated: true, effectKeys: ['speedZero', 'noActions', 'failStrDexSaves', 'attackedAdv', 'critWithin5'] },
  petrified: { speedZero: true, incapacitated: true, effectKeys: ['speedZero', 'noActions', 'failStrDexSaves', 'attackedAdv', 'resistAll'] },
  poisoned: { effectKeys: ['attackCheckDisadv'] },
  prone: { effectKeys: ['attackDisadv', 'meleeAttackedAdv', 'rangedAttackedDisadv', 'crawlHalfSpeed'] },
  restrained: { speedZero: true, effectKeys: ['speedZero', 'attackDisadv', 'attackedAdv', 'dexSaveDisadv'] },
  stunned: { speedZero: true, incapacitated: true, effectKeys: ['speedZero', 'noActions', 'failStrDexSaves', 'attackedAdv'] },
  unconscious: { speedZero: true, incapacitated: true, effectKeys: ['speedZero', 'noActions', 'prone', 'failStrDexSaves', 'attackedAdv', 'critWithin5'] },
};

export function getConditionMechanics(name: string): ConditionMechanics | undefined {
  return CONDITION_MECHANICS[name.toLowerCase()];
}

/** Does any active condition reduce the character's speed to 0? */
export function hasSpeedZeroCondition(char: Character): boolean {
  return (char.conditions ?? []).some(c => getConditionMechanics(c)?.speedZero);
}

/** Current exhaustion level, clamped to 0–6. */
export function getExhaustionLevel(char: Character): number {
  return Math.max(0, Math.min(6, char.exhaustion ?? 0));
}

/**
 * Flat penalty applied to every d20 test from Exhaustion (2024): −2 per level.
 * Returns a non-positive number. Applied live to attacks, saves, skills and
 * initiative — never baked into stored stats.
 */
export function getExhaustionD20Penalty(char: Character): number {
  return -2 * getExhaustionLevel(char);
}

/**
 * Effective speed after conditions, exhaustion, transformation boons/flaws,
 * activated effects and equipped items. `baseSpeed` already includes class/feat
 * bonuses (the stored `character.speed`); transformation deltas (Fzeg Bloodline
 * +10, Sluggish −5×стадия), activated-state deltas (Rage forms, Bladesong +10,
 * Chitinous Shell −10) and item effects (Boots of Striding «минимум 30»,
 * штраф Силы брони −10) are applied live and never baked into the stored stat.
 * Speed-zeroing conditions win outright; Exhaustion subtracts 5 ft per level
 * (floored at 0).
 */
export function getEffectiveSpeed(char: Character): number {
  if (hasSpeedZeroCondition(char)) return 0;
  // Дикий облик / Kindred Form: скорость ходьбы зверя заменяет свою (бонусы
  // гуманоидной формы не применяются); истощение продолжает действовать.
  const beastWalk = getWildShapeWalkSpeed(char) ?? getKindredWalkSpeed(char);
  if (beastWalk !== null) {
    return Math.max(0, beastWalk - 5 * getExhaustionLevel(char));
  }
  const itemWalk = getItemWalkSpeedEffect(char);
  const reduced = Math.max(char.speed, itemWalk.floor)
    + getTransformSpeedAdjust(char)
    + getActiveSpeedAdjust(char)
    + itemWalk.adjust
    - 5 * getExhaustionLevel(char);
  return Math.max(0, reduced);
}
