import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Braces, X } from 'lucide-react';
import type { Character } from '../types';
import { stripManualEdit } from '../utils/manualEdit';

interface CharacterJsonEditorModalProps {
  character: Character;
  /** Получает разобранного персонажа без отметки; пометку проставляет вызывающий код. */
  onSave: (next: Character) => void;
  onClose: () => void;
}

export const CharacterJsonEditorModal: React.FC<CharacterJsonEditorModalProps> = ({
  character,
  onSave,
  onClose,
}) => {
  const { t } = useTranslation('character');
  // Показываем «чистый» JSON без скрытой пометки — она остаётся невидимой и
  // переустанавливается на сохранении.
  const [text, setText] = useState(() => JSON.stringify(stripManualEdit(character), null, 2));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSave = () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      setError(t('sheet.jsonEditor.invalidJson', { error: (e as Error).message }));
      return;
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      setError(t('sheet.jsonEditor.notObject'));
      return;
    }
    // Сохраняем исходный id, чтобы обновление попало в того же персонажа.
    onSave({ ...(parsed as Character), id: character.id });
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[85vh] bg-bg-panel-solid rounded-xl border border-gold/30 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 border-b border-gold/30 px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-medieval text-gold flex items-center gap-3">
              <Braces size={22} className="text-gold" />
              {t('sheet.jsonEditor.title')}
            </h1>
            <p className="text-xs text-text-muted mt-1">{t('sheet.jsonEditor.description')}</p>
          </div>
          <button
            onClick={onClose}
            aria-label={t('sheet.jsonEditor.cancel')}
            className="text-text-muted hover:text-text-primary transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 p-6 flex flex-col gap-3">
          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); setError(null); }}
            spellCheck={false}
            className="flex-1 min-h-0 w-full resize-none rounded-lg bg-bg-primary border border-border-default text-text-primary
              font-mono text-xs leading-relaxed p-3 outline-none focus:border-gold/50"
          />
          {error && (
            <div className="shrink-0 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-gold/30 px-6 py-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-bg-secondary text-text-secondary border border-border-default
              hover:bg-bg-tertiary transition-all text-sm font-medium cursor-pointer"
          >
            {t('sheet.jsonEditor.cancel')}
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-lg bg-gold/20 text-gold border border-gold/40 font-semibold
              hover:bg-gold/30 transition-all text-sm gold-glow cursor-pointer"
          >
            {t('sheet.jsonEditor.save')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
