import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Braces, ShieldAlert } from 'lucide-react';
import type { Character, AbilityScores } from '../types';
import { getAbilityShort, recalcDerivedStats, getConHpAdjustment } from '../utils/dnd';
import { resolveAC, computeInitiative } from '../utils/classEffects';
import { isManuallyEdited } from '../utils/manualEdit';

interface FullEditPanelProps {
  character: Character;
  /** Уже проставляет скрытую пометку и вызывает onUpdate. */
  onCommit: (updated: Character) => void;
  onOpenJson: () => void;
}

const ABILITY_KEYS: (keyof AbilityScores)[] = [
  'strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma',
];

const fieldClass =
  'w-full bg-bg-primary border border-border-default rounded px-2 py-1 text-sm text-text-primary outline-none focus:border-gold/50';

const NumField: React.FC<{ label: string; value: number; onChange: (v: number) => void }> = ({
  label, value, onChange,
}) => (
  <label className="flex flex-col gap-1">
    <span className="text-[10px] uppercase tracking-wider text-text-muted">{label}</span>
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value === '' ? 0 : parseInt(e.target.value, 10) || 0)}
      className={`${fieldClass} text-center font-bold tabular-nums`}
    />
  </label>
);

export const FullEditPanel: React.FC<FullEditPanelProps> = ({ character, onCommit, onOpenJson }) => {
  const { t } = useTranslation('character');

  // Commit an ability-score / proficiency change AND recompute the derived stored
  // stats that depend on it: AC, initiative, spell save DC / attack, and Con→HP.
  // (Saves and skills are computed live at render, so they update on their own.)
  // The AC/initiative/speed/HP fields below stay direct manual overrides.
  const commitDerived = (updated: Character) => {
    const next: Character = { ...updated };
    const conHp = getConHpAdjustment(
      character.abilityScores.constitution,
      next.abilityScores.constitution,
      next.level,
    );
    if (conHp !== 0) {
      next.hitPoints = {
        ...next.hitPoints,
        max: next.hitPoints.max + conHp,
        current: next.hitPoints.current + conHp,
      };
    }
    recalcDerivedStats(next);
    next.armorClass = resolveAC(next);
    next.initiative = computeInitiative(next);
    onCommit(next);
  };

  const setAbility = (key: keyof AbilityScores, v: number) =>
    commitDerived({ ...character, abilityScores: { ...character.abilityScores, [key]: v } });

  const setHp = (patch: Partial<Character['hitPoints']>) =>
    onCommit({ ...character, hitPoints: { ...character.hitPoints, ...patch } });

  const editedDate = character.manualEdit
    ? new Date(character.manualEdit.lastAt).toLocaleString()
    : '';

  return (
    <div className="glass-panel p-4 border border-amber-500/40 bg-amber-500/5">
      {/* Header + warning */}
      <div className="flex items-center gap-2 mb-1">
        <Pencil className="text-amber-400" size={18} />
        <h2 className="text-lg font-medieval text-amber-300">{t('sheet.fullEdit.title')}</h2>
      </div>
      <p className="text-xs text-text-muted flex items-center gap-1.5 mb-3">
        <ShieldAlert size={13} className="text-amber-400/80 shrink-0" />
        {t('sheet.fullEdit.warning')}
      </p>

      {/* Identity row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <label className="flex flex-col gap-1 col-span-2">
          <span className="text-[10px] uppercase tracking-wider text-text-muted">{t('sheet.fullEdit.name')}</span>
          <input
            type="text"
            value={character.name}
            onChange={(e) => onCommit({ ...character, name: e.target.value })}
            className={fieldClass}
          />
        </label>
        <NumField label={t('sheet.fullEdit.level')} value={character.level}
          onChange={(v) => onCommit({ ...character, level: v })} />
        <NumField label={t('sheet.fullEdit.profBonus')} value={character.proficiencyBonus}
          onChange={(v) => commitDerived({ ...character, proficiencyBonus: v })} />
      </div>

      {/* Ability scores */}
      <div className="mb-3">
        <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1.5">
          {t('sheet.fullEdit.abilityScores')}
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {ABILITY_KEYS.map((key) => (
            <NumField
              key={key}
              label={getAbilityShort(key)}
              value={character.abilityScores[key]}
              onChange={(v) => setAbility(key, v)}
            />
          ))}
        </div>
      </div>

      {/* Combat + HP */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
        <NumField label={t('sheet.fullEdit.ac')} value={character.armorClass}
          onChange={(v) => onCommit({ ...character, armorClass: v })} />
        <NumField label={t('sheet.fullEdit.initiative')} value={character.initiative}
          onChange={(v) => onCommit({ ...character, initiative: v })} />
        <NumField label={t('sheet.fullEdit.speed')} value={character.speed}
          onChange={(v) => onCommit({ ...character, speed: v })} />
        <NumField label={t('sheet.fullEdit.maxHp')} value={character.hitPoints.max}
          onChange={(v) => setHp({ max: v })} />
        <NumField label={t('sheet.fullEdit.currentHp')} value={character.hitPoints.current}
          onChange={(v) => setHp({ current: v })} />
        <NumField label={t('sheet.fullEdit.tempHp')} value={character.hitPoints.temporary}
          onChange={(v) => setHp({ temporary: v })} />
      </div>

      {/* Footer: raw JSON + authenticity mark */}
      <div className="flex items-center justify-between gap-3 pt-3 border-t border-amber-500/20">
        <button
          onClick={onOpenJson}
          className="px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30
            hover:bg-amber-500/25 transition-all text-sm font-medium flex items-center gap-2 cursor-pointer"
        >
          <Braces size={15} />
          {t('sheet.fullEdit.editJson')}
        </button>
        {isManuallyEdited(character) && (
          <span className="text-[11px] text-amber-400/70 flex items-center gap-1.5 text-right">
            <ShieldAlert size={12} className="shrink-0" />
            {t('sheet.fullEdit.editedMark', { count: character.manualEdit!.count, date: editedDate })}
          </span>
        )}
      </div>
    </div>
  );
};
