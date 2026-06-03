import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useBackDismiss } from '../hooks/useBackDismiss';

interface SpellDataLocal {
  name: string;
  level: number;
  school?: string;
  time?: { number: number; unit: string }[];
  range?: { type: string; distance?: { type: string; amount?: number } };
  components?: { v?: boolean; s?: boolean; m?: string | boolean | any };
  duration?: { type: string; duration?: { type: string; amount: number }; concentration?: boolean }[];
  entries: any[];
  entriesHigherLevel?: any[];
}

interface LoadedModules {
  getSpellByName: (name: string) => SpellDataLocal | undefined;
  SCHOOL_NAMES: Record<string, string>;
  EntryRenderer: React.FC<any>;
}

function getSpellMeta(s: SpellDataLocal | undefined, t: (key: string, opts?: any) => string) {
  if (!s) return {} as { castingTime?: string; range?: string; components?: string; duration?: string };
  const castingTime = s.time?.map(tm => `${tm.number} ${t(`meta.timeUnits.${tm.unit}`, { defaultValue: tm.unit })}`).join(', ');
  const range = s.range?.type === 'point'
    ? (s.range.distance?.type === 'self' ? t('meta.rangeSelf') : t('meta.rangeFeet', { amount: s.range.distance?.amount || 0 }))
    : s.range?.type === 'special' ? t('meta.rangeSpecial') : undefined;
  const components = s.components
    ? [s.components.v && t('meta.componentV'), s.components.s && t('meta.componentS'), s.components.m && t('meta.componentM')].filter(Boolean).join(', ')
    : undefined;
  const duration = s.duration?.[0]
    ? (s.duration[0].type === 'instant' ? t('meta.durationInstant')
      : s.duration[0].type === 'permanent' ? t('meta.durationPermanent')
      : s.duration[0].concentration
        ? t('meta.durationConcentration', { amount: s.duration[0].duration?.amount || '', type: s.duration[0].duration?.type || '' })
        : `${s.duration[0].duration?.amount || ''} ${s.duration[0].duration?.type || ''}`)
    : undefined;
  return { castingTime, range, components, duration };
}

interface SpellDetailModalProps {
  /** Spell name to look up (matches against loaded spell data). */
  spellName: string;
  /** Fallback level shown while data loads or if the spell isn't found. */
  fallbackLevel?: number;
  onClose: () => void;
}

/**
 * Self-contained popup showing a spell's full description. Loads spell data and
 * the entry renderer on its own, so it can be dropped into any surface where
 * spells appear (spell list, level-up picker, preparation, feat-spell picker).
 */
export const SpellDetailModal: React.FC<SpellDetailModalProps> = ({ spellName, fallbackLevel, onClose }) => {
  const { t } = useTranslation('spells');
  const [modules, setModules] = useState<LoadedModules | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [spellsMod, entryMod] = await Promise.all([
        import('../data/spells'),
        import('../utils/entryRenderer'),
      ]);
      await spellsMod.init();
      if (cancelled) return;
      setModules({
        getSpellByName: spellsMod.getSpellByName as any,
        SCHOOL_NAMES: spellsMod.SCHOOL_NAMES,
        EntryRenderer: entryMod.EntryRenderer,
      });
    })();
    return () => { cancelled = true; };
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Browser Back closes this popup before the surface underneath it.
  useBackDismiss(true, onClose);

  const spell = modules?.getSpellByName(spellName);
  const level = spell?.level ?? fallbackLevel ?? 0;
  const meta = getSpellMeta(spell, t);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        className="glass-panel ornate-border w-full max-w-lg max-h-[85vh] overflow-y-auto p-5 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-medieval text-gold">{spell?.name ?? spellName}</h3>
          <button
            onClick={onClose}
            aria-label={t('common.close', { defaultValue: 'Close' })}
            className="text-text-muted hover:text-text-primary text-sm shrink-0 leading-none mt-1"
          >✕</button>
        </div>

        <div className="text-xs text-text-muted">
          {level === 0 ? t('common.cantrip') : t(`spellLevelLabels.${level}`, { defaultValue: t('common.level', { level }) })}
          {spell?.school && ` • ${t(`schoolLabels.${spell.school}`, { defaultValue: modules?.SCHOOL_NAMES[spell.school] || spell.school })}`}
        </div>

        {(meta.castingTime || meta.range || meta.components || meta.duration) && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {meta.castingTime && <div><span className="text-text-muted">{t('meta.castingTime')}</span><span className="text-text-primary">{meta.castingTime}</span></div>}
            {meta.range && <div><span className="text-text-muted">{t('meta.range')}</span><span className="text-text-primary">{meta.range}</span></div>}
            {meta.components && <div><span className="text-text-muted">{t('meta.components')}</span><span className="text-text-primary">{meta.components}</span></div>}
            {meta.duration && <div><span className="text-text-muted">{t('meta.duration')}</span><span className="text-text-primary">{meta.duration}</span></div>}
          </div>
        )}

        {modules && spell ? (
          <>
            <div className="pt-2 border-t border-border-default prose prose-invert prose-sm max-w-none text-xs">
              <modules.EntryRenderer entries={spell.entries} context={spell.name} />
            </div>
            {spell.entriesHigherLevel && spell.entriesHigherLevel.length > 0 && (
              <div className="pt-2 border-t border-border-default prose prose-invert prose-sm max-w-none text-xs">
                <modules.EntryRenderer entries={spell.entriesHigherLevel} context={spell.name} />
              </div>
            )}
          </>
        ) : (
          <div className="py-6 text-center text-text-muted text-sm animate-pulse">
            {modules ? t('common.spellNotFound', { defaultValue: spellName }) : t('common.loading', { defaultValue: '…' })}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};
