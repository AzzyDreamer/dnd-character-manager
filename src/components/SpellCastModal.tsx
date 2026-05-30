import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Character, CharacterSpell } from '../types';
import type { SpellData } from '../data/spells';
import { SCHOOL_NAMES } from '../data/spells';
import { Wand2, X, Zap, Shield, Heart, Sparkles, Target, Dices } from 'lucide-react';
import { ClickableAttackBonus, ClickableDamage, useDiceRoll } from './DiceRollProvider';
import type { DiceRollResult } from '../utils/diceRoller';
import { rollDice, evalConsoleExpression } from '../utils/diceRoller';
import {
  buildSpellAttackExpr,
  buildDamageExpression,
  getSpellAttackBonus,
  getEffectiveSpellDC,
  isRitualSpell,
  getAvailableSlots,
  translateSaveAbility,
  translateDamageType,
} from '../utils/spellCasting';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];

function getSpellMeta(spellData: SpellData, t: (key: string, opts?: any) => string) {
  const castingTime = spellData.time
    ?.map(tm => `${tm.number} ${t(`meta.timeUnits.${tm.unit}`, { defaultValue: tm.unit })}`)
    .join(', ');
  const range = spellData.range?.distance?.amount
    ? t('meta.rangeFeet', { amount: spellData.range.distance.amount })
    : spellData.range?.type === 'touch' ? t('meta.rangeTouch')
      : spellData.range?.type === 'self' ? t('meta.rangeSelf')
        : spellData.range?.type || '';
  const components = spellData.components
    ? [
        spellData.components.v ? t('meta.componentV') : '',
        spellData.components.s ? t('meta.componentS') : '',
        spellData.components.m ? t('meta.componentM') : '',
      ].filter(Boolean).join(', ')
    : '';
  const duration = spellData.duration
    ?.map(d => {
      if (d.type === 'instant') return t('meta.durationInstant');
      if (d.concentration) return t('meta.durationConcentration', { amount: d.duration?.amount || '', type: d.duration?.type || '' });
      return d.type;
    })
    .join(', ');
  return { castingTime, range, components, duration };
}

interface SpellCastModalProps {
  character: Character;
  spell: CharacterSpell;
  spellData: SpellData;
  onClose: () => void;
}

export const SpellCastModal: React.FC<SpellCastModalProps> = ({
  character, spell, spellData, onClose,
}) => {
  const { t } = useTranslation('spells');
  const { roll } = useDiceRoll();

  const isCantrip = spell.level === 0;
  const ritual = isRitualSpell(spellData);
  const hasAttack = !!spellData.spellAttack?.length;
  const hasSave = !!spellData.savingThrow?.length;
  const conditions = spellData.conditionInflict;

  const [selectedSlotLevel, setSelectedSlotLevel] = useState(spell.level);
  const [isRitualCast, setIsRitualCast] = useState(false);
  const [attackResult, setAttackResult] = useState<DiceRollResult | null>(null);
  const [damageResult, setDamageResult] = useState<DiceRollResult | null>(null);

  const meta = getSpellMeta(spellData, t);

  // Available slots
  const slots = useMemo(() =>
    isCantrip ? [] : getAvailableSlots(character.spellcasting?.spellSlots, spell.level),
    [character, spell.level, isCantrip]
  );

  // Damage expression
  const damageInfo = useMemo(
    () => buildDamageExpression(spellData, character, isCantrip ? spell.level : selectedSlotLevel),
    [spellData, character, selectedSlotLevel, isCantrip, spell.level]
  );

  const attackBonus = getSpellAttackBonus(character);
  const spellDC = getEffectiveSpellDC(character);

  const canCast = isCantrip || slots.length > 0 || isRitualCast;

  const handleCast = () => {
    if (!canCast) return;

    // Roll attack (always simple 1d20+N)
    if (hasAttack) {
      const attackExpr = buildSpellAttackExpr(character);
      const result = rollDice(attackExpr);
      if (result.rolls.length > 0) {
        roll(attackExpr); // toast
        setAttackResult(result);
      }
    } else {
      setAttackResult(null);
    }

    // Roll damage/healing (may be compound like 2d6+1d6+3)
    if (damageInfo) {
      const simple = rollDice(damageInfo.expression);
      if (simple.rolls.length > 0) {
        // Simple expression — use standard roll + toast
        roll(damageInfo.expression);
        setDamageResult(simple);
      } else {
        // Compound expression — use console evaluator
        const consoleResult = evalConsoleExpression(damageInfo.expression);
        if (!consoleResult.isError && typeof consoleResult.total === 'number') {
          // Parse breakdown for individual rolls
          const allRolls: number[] = [];
          const rollMatches = consoleResult.breakdown.matchAll(/\[([^\]]+)\]/g);
          for (const m of rollMatches) {
            for (const v of m[1].split(',')) {
              const n = parseInt(v.trim(), 10);
              if (!isNaN(n)) allRolls.push(n);
            }
          }
          setDamageResult({
            expression: damageInfo.expression,
            rolls: allRolls,
            modifier: consoleResult.total - allRolls.reduce((a, b) => a + b, 0),
            total: consoleResult.total,
          });
        }
      }
    } else {
      setDamageResult(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-bg-panel-solid border border-border-default rounded-xl w-full max-w-lg shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border-default flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medieval text-gold">{spell.name}</h2>
            <div className="text-xs text-text-muted mt-0.5">
              {isCantrip ? t('common.cantrip') : t(`spellLevelLabels.${spell.level}`)}
              {spellData.school && ` • ${t(`schoolLabels.${spellData.school}`, { defaultValue: SCHOOL_NAMES[spellData.school] || spellData.school })}`}
              {ritual && ` • ${t('common.ritual')}`}
            </div>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Meta info */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {meta.castingTime && <div><span className="text-text-muted">{t('meta.castingTime')}</span><span className="text-text-primary">{meta.castingTime}</span></div>}
            {meta.range && <div><span className="text-text-muted">{t('meta.range')}</span><span className="text-text-primary">{meta.range}</span></div>}
            {meta.components && <div><span className="text-text-muted">{t('meta.components')}</span><span className="text-text-primary">{meta.components}</span></div>}
            {meta.duration && <div><span className="text-text-muted">{t('meta.duration')}</span><span className="text-text-primary">{meta.duration}</span></div>}
          </div>

          {/* Slot selection (leveled spells only) */}
          {!isCantrip && (
            <div>
              <div className="text-xs text-text-muted uppercase tracking-wider mb-2">{t('cast.spellSlot')}</div>
              <div className="flex flex-wrap gap-1.5">
                {slots.map(slot => {
                  const isSelected = slot.level === selectedSlotLevel && !isRitualCast;
                  const hasSlots = slot.available > 0;
                  return (
                    <button
                      key={slot.level}
                      onClick={() => { setSelectedSlotLevel(slot.level); setIsRitualCast(false); }}
                      disabled={!hasSlots}
                      className={`px-3 py-1.5 rounded text-xs font-medium transition-all border ${
                        isSelected
                          ? 'bg-gold/20 text-gold border-gold/40'
                          : hasSlots
                          ? 'bg-bg-secondary text-text-secondary border-border-default hover:bg-bg-tertiary hover:text-text-primary'
                          : 'bg-bg-secondary/50 text-text-muted/40 border-border-default/50 cursor-not-allowed'
                      }`}
                    >
                      {ROMAN[slot.level - 1]}
                      <span className="ml-1 opacity-60">{slot.available}/{slot.total}</span>
                    </button>
                  );
                })}
              </div>

              {/* Ritual option */}
              {ritual && (
                <label className="flex items-center gap-2 mt-2 cursor-pointer text-sm text-text-secondary hover:text-text-primary transition-colors">
                  <input
                    type="checkbox"
                    checked={isRitualCast}
                    onChange={(e) => setIsRitualCast(e.target.checked)}
                    className="accent-gold w-4 h-4"
                  />
                  <Sparkles size={14} className="text-purple-400" />
                  {t('cast.ritualOption')}
                </label>
              )}
            </div>
          )}

          {/* Spell Attack */}
          {hasAttack && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-bg-secondary/50 border border-border-default">
              <Target size={16} className="text-green-400 flex-shrink-0" />
              <span className="text-sm text-text-secondary">{t('cast.attackRoll')}</span>
              <div className="ml-auto">
                <ClickableAttackBonus
                  bonus={attackBonus}
                  className="text-green-400 font-bold text-lg"
                />
              </div>
            </div>
          )}

          {/* Saving Throw DC */}
          {hasSave && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-bg-secondary/50 border border-border-default">
              <Shield size={16} className="text-blue-400 flex-shrink-0" />
              <span className="text-sm text-text-secondary">{t('cast.savingThrow')}</span>
              <span className="ml-auto text-sm">
                <span className="text-gold font-bold text-lg mr-1.5">{t('cast.dcLabel', { dc: spellDC })}</span>
                <span className="text-text-muted">
                  {spellData.savingThrow!.map(s => translateSaveAbility(s)).join(', ')}
                </span>
              </span>
            </div>
          )}

          {/* Damage / Healing */}
          {damageInfo && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-bg-secondary/50 border border-border-default">
              {damageInfo.isHealing
                ? <Heart size={16} className="text-green-400 flex-shrink-0" />
                : <Zap size={16} className="text-red-400 flex-shrink-0" />
              }
              <span className="text-sm text-text-secondary">
                {damageInfo.isHealing ? t('cast.healing') : t('cast.damage')}
              </span>
              <div className="ml-auto flex items-center gap-2">
                <ClickableDamage
                  damage={damageInfo.expression}
                  className="text-text-primary font-bold text-lg"
                />
                {damageInfo.type && !damageInfo.isHealing && (
                  <span className="text-xs text-text-muted">
                    {translateDamageType(damageInfo.type)}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Conditions */}
          {conditions && conditions.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <span>{t('cast.conditions')}</span>
              {conditions.map(c => (
                <span key={c} className="px-2 py-0.5 rounded bg-purple-900/30 text-purple-300 border border-purple-500/20">
                  {c}
                </span>
              ))}
            </div>
          )}

          {/* Roll Results */}
          {(attackResult || damageResult) && (
            <div className="p-3 rounded-lg bg-bg-secondary border border-gold/30 space-y-2">
              <div className="flex items-center gap-2 text-xs text-gold uppercase tracking-wider font-medium">
                <Dices size={14} />
                {t('cast.result')}
              </div>

              {attackResult && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary flex items-center gap-2">
                    <Target size={14} className="text-green-400" />
                    {t('cast.attack')}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text-muted">
                      [{attackResult.rolls.join(', ')}]{attackResult.modifier !== 0
                        ? `${attackResult.modifier >= 0 ? '+' : ''}${attackResult.modifier}`
                        : ''}
                    </span>
                    <span className={`font-bold text-lg ${
                      attackResult.rolls[0] === 20 ? 'text-green-400' :
                      attackResult.rolls[0] === 1 ? 'text-red-400' :
                      'text-text-primary'
                    }`}>
                      {attackResult.total}
                    </span>
                  </div>
                </div>
              )}

              {damageResult && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary flex items-center gap-2">
                    {damageInfo?.isHealing
                      ? <Heart size={14} className="text-green-400" />
                      : <Zap size={14} className="text-red-400" />
                    }
                    {damageInfo?.isHealing ? t('cast.healing') : t('cast.damage')}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text-muted">
                      [{damageResult.rolls.join(', ')}]{damageResult.modifier !== 0
                        ? `${damageResult.modifier >= 0 ? '+' : ''}${damageResult.modifier}`
                        : ''}
                    </span>
                    <span className={`font-bold text-lg ${
                      damageInfo?.isHealing ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {damageResult.total}
                    </span>
                    {damageInfo?.type && !damageInfo.isHealing && (
                      <span className="text-xs text-text-muted">
                        {translateDamageType(damageInfo.type)}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {attackResult && attackResult.rolls[0] === 20 && (
                <div className="text-xs text-green-400 font-medium text-center pt-1 border-t border-border-default">
                  {t('cast.criticalHit')}
                </div>
              )}
              {attackResult && attackResult.rolls[0] === 1 && (
                <div className="text-xs text-red-400 font-medium text-center pt-1 border-t border-border-default">
                  {t('cast.criticalMiss')}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border-default flex items-center justify-between">
          <div className="text-xs text-text-muted">
            {isCantrip
              ? t('cast.cantripNoSlot')
              : isRitualCast
              ? t('cast.ritualNoSlot')
              : t('cast.slotOfLevel', { roman: ROMAN[selectedSlotLevel - 1] })}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded text-sm text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleCast}
              disabled={!canCast}
              className="px-5 py-2 rounded-lg bg-gold/20 text-gold border border-gold/40 font-medium text-sm hover:bg-gold/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Wand2 size={16} />
              {t('contextMenu.cast')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
