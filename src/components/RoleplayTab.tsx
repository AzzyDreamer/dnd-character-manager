import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { Character } from '../types';
import { User, BookOpen, Eye, Heart, Compass, Link2, AlertTriangle } from 'lucide-react';

// ─── Alignment grid (i18n ключи) ───

const ALIGNMENTS = [
  ['lawfulGood', 'neutralGood', 'chaoticGood'],
  ['lawfulNeutral', 'trueNeutral', 'chaoticNeutral'],
  ['lawfulEvil', 'neutralEvil', 'chaoticEvil'],
] as const;

const ALIGNMENT_COLORS: Record<string, string> = {
  lawfulGood: 'border-blue-400/50 bg-blue-900/20 text-blue-300',
  neutralGood: 'border-emerald-400/50 bg-emerald-900/20 text-emerald-300',
  chaoticGood: 'border-yellow-400/50 bg-yellow-900/20 text-yellow-300',
  lawfulNeutral: 'border-sky-400/50 bg-sky-900/20 text-sky-300',
  trueNeutral: 'border-gray-400/50 bg-gray-800/30 text-gray-300',
  chaoticNeutral: 'border-orange-400/50 bg-orange-900/20 text-orange-300',
  lawfulEvil: 'border-purple-400/50 bg-purple-900/20 text-purple-300',
  neutralEvil: 'border-red-400/50 bg-red-900/20 text-red-300',
  chaoticEvil: 'border-rose-400/50 bg-rose-900/20 text-rose-300',
};

// ─── Textarea field ───

const RpField: React.FC<{
  label: string;
  icon: React.ReactNode;
  value: string;
  placeholder: string;
  cancelLabel: string;
  saveLabel: string;
  onChange: (val: string) => void;
}> = ({ label, icon, value, placeholder, cancelLabel, saveLabel, onChange }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const startEdit = () => {
    setDraft(value);
    setEditing(true);
  };

  const save = () => {
    setEditing(false);
    if (draft !== value) onChange(draft);
  };

  return (
    <div className="glass-panel p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <h3 className="text-sm font-medieval text-gold">{label}</h3>
      </div>
      {editing ? (
        <div className="space-y-2">
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder={placeholder}
            autoFocus
            rows={4}
            className="w-full px-3 py-2 bg-bg-secondary border border-border-default rounded-lg text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-gold/50 resize-y transition-colors"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setEditing(false)}
              className="px-3 py-1 text-xs text-text-muted hover:text-text-primary transition-colors"
            >
              {cancelLabel}
            </button>
            <button
              onClick={save}
              className="px-3 py-1 text-xs bg-gold/20 text-gold border border-gold/30 rounded hover:bg-gold/30 transition-colors"
            >
              {saveLabel}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={startEdit}
          className="w-full text-left min-h-[3rem] rounded-lg border border-border-default bg-bg-secondary/30 px-3 py-2 hover:bg-bg-secondary/60 transition-colors"
        >
          {value ? (
            <p className="text-sm text-text-secondary whitespace-pre-wrap">{value}</p>
          ) : (
            <p className="text-sm text-text-muted/40 italic">{placeholder}</p>
          )}
        </button>
      )}
    </div>
  );
};

// ─── Alignment picker ───

const AlignmentPicker: React.FC<{
  value?: string;
  onChange: (val: string | undefined) => void;
}> = ({ value, onChange }) => {
  const { t } = useTranslation('character');

  return (
    <div className="glass-panel p-4">
      <div className="flex items-center gap-2 mb-3">
        <Compass size={14} className="text-gold" />
        <h3 className="text-sm font-medieval text-gold">{t('roleplay.alignment')}</h3>
      </div>
      <div className="grid grid-cols-3 gap-1.5 max-w-sm mx-auto">
        {ALIGNMENTS.flat().map(a => {
          const selected = value === a;
          const colors = selected
            ? ALIGNMENT_COLORS[a]
            : 'border-border-default bg-bg-secondary/30 text-text-muted hover:bg-bg-secondary/60';
          const displayName = t(`creation.alignments.${a}`);
          const shortName = t(`creation.alignmentsShort.${a}`);
          return (
            <button
              key={a}
              onClick={() => onChange(selected ? undefined : a)}
              className={`px-2 py-2 rounded-lg border text-xs font-medium transition-all ${colors}`}
              title={displayName}
            >
              <div className="font-bold text-sm">{shortName}</div>
              <div className="text-[9px] opacity-70 mt-0.5 leading-tight">{displayName}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ─── Main component ───

export const RoleplayTab: React.FC<{
  character: Character;
  onUpdate: (character: Character) => void;
}> = ({ character, onUpdate }) => {
  const { t } = useTranslation('character');

  const update = useCallback(
    (fields: Partial<Character>) => {
      onUpdate({ ...character, ...fields, updatedAt: new Date().toISOString() });
    },
    [character, onUpdate],
  );

  return (
    <div className="space-y-4">
      <AlignmentPicker
        value={character.alignment}
        onChange={v => update({ alignment: v })}
      />

      <RpField
        label={t('roleplay.appearance')}
        icon={<Eye size={14} className="text-gold" />}
        value={character.appearance ?? ''}
        placeholder={t('roleplay.appearancePlaceholder')}
        cancelLabel={t('roleplay.cancel')}
        saveLabel={t('roleplay.save')}
        onChange={v => update({ appearance: v || undefined })}
      />

      <RpField
        label={t('roleplay.backstory')}
        icon={<BookOpen size={14} className="text-gold" />}
        value={character.backstory ?? ''}
        placeholder={t('roleplay.backstoryPlaceholder')}
        cancelLabel={t('roleplay.cancel')}
        saveLabel={t('roleplay.save')}
        onChange={v => update({ backstory: v || undefined })}
      />

      <RpField
        label={t('roleplay.personalityTraits')}
        icon={<User size={14} className="text-gold" />}
        value={character.personalityTraits ?? ''}
        placeholder={t('roleplay.personalityTraitsPlaceholder')}
        cancelLabel={t('roleplay.cancel')}
        saveLabel={t('roleplay.save')}
        onChange={v => update({ personalityTraits: v || undefined })}
      />

      <RpField
        label={t('roleplay.ideals')}
        icon={<Heart size={14} className="text-gold" />}
        value={character.ideals ?? ''}
        placeholder={t('roleplay.idealsPlaceholder')}
        cancelLabel={t('roleplay.cancel')}
        saveLabel={t('roleplay.save')}
        onChange={v => update({ ideals: v || undefined })}
      />

      <RpField
        label={t('roleplay.bonds')}
        icon={<Link2 size={14} className="text-gold" />}
        value={character.bonds ?? ''}
        placeholder={t('roleplay.bondsPlaceholder')}
        cancelLabel={t('roleplay.cancel')}
        saveLabel={t('roleplay.save')}
        onChange={v => update({ bonds: v || undefined })}
      />

      <RpField
        label={t('roleplay.flaws')}
        icon={<AlertTriangle size={14} className="text-gold" />}
        value={character.flaws ?? ''}
        placeholder={t('roleplay.flawsPlaceholder')}
        cancelLabel={t('roleplay.cancel')}
        saveLabel={t('roleplay.save')}
        onChange={v => update({ flaws: v || undefined })}
      />
    </div>
  );
};
