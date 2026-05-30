import React from 'react';
import { Sparkles, BookOpen, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AutoSpellResult } from '../utils/autoSpells';

interface AutoSpellsNotificationModalProps {
  spells: AutoSpellResult[];
  newLevel: number;
  onConfirm: () => void;
}

export const AutoSpellsNotificationModal: React.FC<AutoSpellsNotificationModalProps> = ({
  spells,
  newLevel,
  onConfirm,
}) => {
  const { t } = useTranslation('spells');
  // Group spells by source
  const grouped = spells.reduce<Record<string, AutoSpellResult[]>>((acc, spell) => {
    const key = spell.source;
    if (!acc[key]) acc[key] = [];
    acc[key].push(spell);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-bg-panel-solid rounded-xl border border-gold/30 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="shrink-0 border-b border-gold/30 bg-bg-panel-solid/95 px-6 py-4">
          <h1 className="text-2xl font-medieval text-gold flex items-center gap-3">
            <Sparkles className="text-gold" size={24} />
            {t('autoSpells.title')}
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            {t('autoSpells.description', { level: newLevel })}
          </p>
        </div>

        {/* Spell list */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {Object.entries(grouped).map(([source, sourceSpells]) => (
            <div key={source}>
              <div className="flex items-center gap-2 mb-2">
                <BookOpen size={16} className="text-gold/70" />
                <h3 className="text-sm font-semibold text-gold/90">{source}</h3>
              </div>
              <div className="space-y-2 ml-6">
                {sourceSpells.map(spell => (
                  <div
                    key={spell.spellId}
                    className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2 border border-white/10"
                  >
                    <div className="flex items-center gap-2">
                      <Star size={14} className="text-gold/60 shrink-0" />
                      <span className="text-text-primary font-medium">{spell.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-secondary">
                        {t(`spellLevelLabels.${spell.level}`, t('common.levelInline', { level: spell.level }))}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gold/15 text-gold border border-gold/20">
                        {t('common.auto')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-gold/30 bg-bg-panel-solid/95 px-6 py-4">
          <div className="flex justify-end">
            <button
              onClick={onConfirm}
              className="px-8 py-2.5 rounded-lg bg-gold/20 text-gold border border-gold/30 font-medieval font-semibold text-lg
                hover:bg-gold/30 transition-all gold-glow"
            >
              {t('common.continue')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
