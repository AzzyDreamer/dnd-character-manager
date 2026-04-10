import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Character } from '../types';
import { getSkillName, SKILL_ABILITIES, getAbilityName, type AbilityScores } from '../utils/dnd';
import { Star, X, Check } from 'lucide-react';

interface ExpertisePickerModalProps {
  character: Character;
  count: number;
  onConfirm: (skills: string[]) => void;
  onCancel: () => void;
}

/**
 * Modal for choosing skills to gain Expertise (double proficiency bonus).
 * Only proficient skills without existing expertise are available.
 */
export const ExpertisePickerModal: React.FC<ExpertisePickerModalProps> = ({
  character,
  count,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation('character');
  const [selected, setSelected] = useState<string[]>([]);

  // Get proficient skills that don't already have expertise
  const availableSkills = useMemo(() => {
    return Object.entries(character.skills ?? {})
      .filter(([, data]) => data.proficient && !data.expertise)
      .map(([key]) => key)
      .sort((a, b) => getSkillName(a).localeCompare(getSkillName(b), 'ru'));
  }, [character.skills]);

  const toggleSkill = (key: string) => {
    setSelected(prev => {
      if (prev.includes(key)) {
        return prev.filter(s => s !== key);
      }
      if (prev.length >= count) return prev;
      return [...prev, key];
    });
  };

  const canConfirm = selected.length === count;

  // Group by ability for nicer display
  const groupedSkills = useMemo(() => {
    const groups: Record<string, string[]> = {};
    for (const sk of availableSkills) {
      const ability = SKILL_ABILITIES[sk] as keyof AbilityScores | undefined;
      const groupName = ability ? getAbilityName(ability) : t('expertisePicker.groupOther');
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(sk);
    }
    return groups;
  }, [availableSkills]);

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6">
      <div className="w-full max-w-lg max-h-[85vh] bg-bg-panel-solid rounded-xl border border-purple-500/40 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="shrink-0 border-b border-purple-500/30 bg-bg-panel-solid/95 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-medieval text-purple-300 flex items-center gap-3">
                <Star className="text-purple-400" size={24} />
                {t('expertisePicker.title')}
              </h1>
              <p className="text-sm text-text-secondary mt-1">
                {t('expertisePicker.subtitle', { count })}
              </p>
            </div>
            <button
              onClick={onCancel}
              className="p-2 rounded-lg border border-border-default text-text-secondary hover:text-text-primary hover:border-border-hover transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Skill list */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {Object.entries(groupedSkills).map(([groupName, skills]) => (
              <div key={groupName}>
                <div className="text-xs text-text-muted uppercase tracking-wider mb-2">{groupName}</div>
                <div className="grid grid-cols-2 gap-2">
                  {skills.map(sk => {
                    const isSelected = selected.includes(sk);
                    const isDisabled = !isSelected && selected.length >= count;
                    return (
                      <button
                        key={sk}
                        onClick={() => toggleSkill(sk)}
                        disabled={isDisabled}
                        className={`
                          flex items-center gap-2 px-3 py-2 rounded-lg border text-sm text-left transition-all
                          ${isSelected
                            ? 'border-purple-400 bg-purple-500/20 text-purple-200'
                            : isDisabled
                              ? 'border-border-default/50 text-text-muted/50 cursor-not-allowed'
                              : 'border-border-default text-text-secondary hover:border-purple-400/50 hover:text-text-primary'
                          }
                        `}
                      >
                        <div className={`
                          w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0
                          ${isSelected
                            ? 'border-purple-400 bg-purple-500/30'
                            : 'border-border-default'
                          }
                        `}>
                          {isSelected && <Check size={12} className="text-purple-300" />}
                        </div>
                        {getSkillName(sk)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {availableSkills.length === 0 && (
            <div className="text-center text-text-muted py-8">
              {t('expertisePicker.noSkillsAvailable')}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-purple-500/30 bg-bg-panel-solid/95 px-6 py-4 flex items-center justify-between">
          <div className="text-sm text-text-muted">
            {t('expertisePicker.selectedCount')} <span className={canConfirm ? 'text-purple-300 font-bold' : 'text-text-secondary'}>{selected.length}</span> / {count}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-lg border border-border-default text-text-secondary hover:text-text-primary hover:border-border-hover transition-colors"
            >
              {t('expertisePicker.cancel')}
            </button>
            <button
              onClick={() => onConfirm(selected)}
              disabled={!canConfirm}
              className={`
                px-6 py-2 rounded-lg font-medium transition-all
                ${canConfirm
                  ? 'bg-purple-600 text-white hover:bg-purple-500 border border-purple-400/50'
                  : 'bg-bg-panel-solid text-text-muted border border-border-default cursor-not-allowed'
                }
              `}
            >
              {t('expertisePicker.confirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
