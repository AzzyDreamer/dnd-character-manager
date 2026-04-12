import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Character, CharacterSpell } from '../types';
import { Search, Loader2, ChevronDown, ChevronRight, BookOpen, Check } from 'lucide-react';
import { SpellIconBadge, SpellTooltip } from './ui';

interface SpellDataLocal {
  name: string;
  level: number;
  school: string;
  source: string;
  time?: { number: number; unit: string }[];
  range?: { type: string; distance?: { type: string; amount?: number } };
  components?: { v?: boolean; s?: boolean; m?: string | boolean | any };
  duration?: { type: string; duration?: { type: string; amount: number }; concentration?: boolean }[];
  entries: any[];
  entriesHigherLevel?: any[];
}

interface LoadedModules {
  spells: SpellDataLocal[];
  getSpellImageUrl: (name: string) => string;
  SCHOOL_NAMES: Record<string, string>;
  EntryRenderer: React.FC<any>;
}

interface SpellPreparationModalProps {
  character: Character;
  onConfirm: (updatedSpells: CharacterSpell[]) => void;
  onCancel: () => void;
}

function getSpellMeta(spell: SpellDataLocal, t: (key: string, opts?: any) => string) {
  const castingTime = spell.time?.map(tm => `${tm.number} ${t(`meta.timeUnits.${tm.unit}`, { defaultValue: tm.unit })}`).join(', ');
  const range = spell.range?.distance?.amount
    ? t('meta.rangeFeet', { amount: spell.range.distance.amount })
    : spell.range?.type === 'touch' ? t('meta.rangeTouch')
      : spell.range?.type === 'self' ? t('meta.rangeSelf') : spell.range?.type || '';
  const components = spell.components
    ? [spell.components.v ? t('meta.componentV') : '', spell.components.s ? t('meta.componentS') : '', spell.components.m ? t('meta.componentM') : ''].filter(Boolean).join(', ')
    : '';
  const duration = spell.duration?.map(d => {
    if (d.type === 'instant') return t('meta.durationInstant');
    if (d.concentration) return t('meta.durationConcentration', { amount: d.duration?.amount || '', type: d.duration?.type || '' });
    return d.type;
  }).join(', ');
  return { castingTime, range, components, duration };
}

function getFirstEntryText(entries: any[]): string {
  for (const e of entries) {
    if (typeof e === 'string') return e;
    if (e?.entries) return getFirstEntryText(e.entries);
  }
  return '';
}

export const SpellPreparationModal: React.FC<SpellPreparationModalProps> = ({
  character,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation('spells');
  const [modules, setModules] = useState<LoadedModules | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [preparedNames, setPreparedNames] = useState<Set<string>>(() => {
    const prepared = new Set<string>();
    character.spellcasting?.spells
      .filter(s => s.level > 0 && s.prepared && !s.alwaysPrepared)
      .forEach(s => prepared.add(s.name));
    return prepared;
  });
  const [expandedSpell, setExpandedSpell] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const maxPrepared = character.spellcasting?.spellsKnown ?? 0;

  const maxSpellLevel = useMemo(() => {
    const slots = character.spellcasting?.spellSlots;
    if (!slots) return 1;
    let max = 1;
    const entries = Object.entries(slots) as [string, { total: number }][];
    for (const [key, val] of entries) {
      if (val.total > 0) {
        const lvl = parseInt(key.replace('level', ''));
        if (lvl > max) max = lvl;
      }
    }
    return max;
  }, [character.spellcasting?.spellSlots]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const spellsMod = await import('../data/spells');
      await spellsMod.init();
      if (cancelled) return;
      const entryMod = await import('../utils/entryRenderer');
      if (cancelled) return;
      const classSpells = spellsMod.getSpellsByClass(character.class);
      setModules({
        spells: classSpells,
        getSpellImageUrl: spellsMod.getSpellImageUrl,
        SCHOOL_NAMES: spellsMod.SCHOOL_NAMES,
        EntryRenderer: entryMod.EntryRenderer,
      });
    })();
    return () => { cancelled = true; };
  }, [character.class]);

  // All leveled class spells the character can access
  const availableSpells = useMemo(() => {
    if (!modules) return [];
    const q = searchQuery.toLowerCase().trim();
    return modules.spells
      .filter(s => s.level > 0 && s.level <= maxSpellLevel)
      .filter(s => !q || s.name.toLowerCase().includes(q));
  }, [modules, searchQuery, maxSpellLevel]);

  const spellsByLevel = useMemo(() => {
    const groups: Record<number, SpellDataLocal[]> = {};
    for (const s of availableSpells) {
      (groups[s.level] = groups[s.level] || []).push(s);
    }
    return groups;
  }, [availableSpells]);

  const toggleSpell = (spellName: string) => {
    setPreparedNames(prev => {
      const next = new Set(prev);
      if (next.has(spellName)) {
        next.delete(spellName);
      } else {
        if (maxPrepared > 0 && next.size >= maxPrepared) return prev;
        next.add(spellName);
      }
      return next;
    });
  };

  const toggleSection = (key: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleConfirm = () => {
    if (!modules) return;
    // Keep cantrips and alwaysPrepared as-is
    const cantrips = character.spellcasting?.spells.filter(s => s.level === 0) || [];
    const alwaysPrepared = character.spellcasting?.spells.filter(s => s.level > 0 && s.alwaysPrepared) || [];

    // Build new leveled spell list from prepared selections
    const newLeveledSpells: CharacterSpell[] = [];
    for (const name of preparedNames) {
      // Check if character already has this spell
      const existing = character.spellcasting?.spells.find(s => s.name === name);
      if (existing) {
        newLeveledSpells.push({ ...existing, prepared: true });
      } else {
        // New spell from class list
        const data = modules.spells.find(s => s.name === name);
        if (data) {
          newLeveledSpells.push({
            spellId: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            name: name,
            level: data.level,
            prepared: true,
          });
        }
      }
    }

    onConfirm([...cantrips, ...alwaysPrepared, ...newLeveledSpells]);
  };

  const expandedData = expandedSpell && modules
    ? (() => {
        const data = modules.spells.find(s => s.name === expandedSpell);
        return data || null;
      })()
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-bg-panel-solid border border-border-default rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-border-default flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <BookOpen size={20} className="text-gold" />
            <h2 className="text-lg font-medieval text-gold">{t('preparation.title')}</h2>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-text-secondary">
              {t('preparation.preparedCount')}<span className={`font-bold ${preparedNames.size >= maxPrepared ? 'text-red-bright' : 'text-gold'}`}>
                {preparedNames.size}/{maxPrepared}
              </span>
            </span>
            <button onClick={onCancel} className="text-text-muted hover:text-text-primary">✕</button>
          </div>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-border-default shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder={t('preparation.searchPlaceholder')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 bg-bg-primary border border-border-default rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-gold/50"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {!modules ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-gold mr-2" size={20} />
              <span className="text-text-muted">{t('common.loadingSpells')}</span>
            </div>
          ) : (
            <div className="p-3 space-y-3">
              {Object.entries(spellsByLevel)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([level, spells]) => {
                  const sectionKey = `prep-level-${level}`;
                  const isCollapsed = collapsedSections.has(sectionKey);
                  const preparedInLevel = spells.filter(s => preparedNames.has(s.name)).length;
                  return (
                    <div key={level} className="glass-panel p-3">
                      <button
                        onClick={() => toggleSection(sectionKey)}
                        className="flex items-center gap-2 w-full text-left mb-2"
                      >
                        {isCollapsed
                          ? <ChevronRight size={14} className="text-text-muted" />
                          : <ChevronDown size={14} className="text-text-muted" />}
                        <span className="text-sm font-medieval text-blue-300">
                          {t('spellcasting.levelCount', { level, count: spells.length })}
                        </span>
                        {preparedInLevel > 0 && (
                          <span className="text-xs text-green-bright ml-1">
                            {t('preparation.preparedShort', { count: preparedInLevel })}
                          </span>
                        )}
                      </button>
                      {!isCollapsed && (
                        <div className="flex flex-wrap gap-2">
                          {spells.map(spell => {
                            const isPrepared = preparedNames.has(spell.name);
                            const meta = getSpellMeta(spell, t);
                            return (
                              <SpellTooltip
                                key={spell.name}
                                name={spell.name}
                                level={spell.level}
                                school={spell.school}
                                castingTime={meta.castingTime}
                                range={meta.range}
                                components={meta.components}
                                duration={meta.duration}
                                description={getFirstEntryText(spell.entries)}
                              >
                                <SpellIconBadge
                                  name={spell.name}
                                  school={spell.school}
                                  level={spell.level}
                                  imageSrc={modules.getSpellImageUrl(spell.name)}
                                  prepared={isPrepared || undefined}
                                  selected={expandedSpell === spell.name}
                                  onClick={() => setExpandedSpell(expandedSpell === spell.name ? null : spell.name)}
                                  onContextMenu={(e) => { e.preventDefault(); toggleSpell(spell.name); }}
                                  className={!isPrepared ? 'opacity-50' : ''}
                                />
                              </SpellTooltip>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

              {availableSpells.length === 0 && searchQuery && (
                <div className="text-center text-text-muted py-6 text-sm italic">
                  {t('preparation.notFound')}
                </div>
              )}
            </div>
          )}

          {/* Expanded spell detail */}
          {expandedData && modules && (
            <div className="mx-3 mb-3 glass-panel ornate-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medieval text-gold">{expandedData.name}</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleSpell(expandedData.name)}
                    disabled={!preparedNames.has(expandedData.name) && maxPrepared > 0 && preparedNames.size >= maxPrepared}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      preparedNames.has(expandedData.name)
                        ? 'bg-green-accent/30 text-green-bright border border-green-bright/30 hover:bg-red-accent/30 hover:text-red-bright hover:border-red-bright/30'
                        : 'bg-bg-panel border border-border-default text-text-secondary hover:border-gold/40 hover:text-gold disabled:opacity-40'
                    }`}
                  >
                    {preparedNames.has(expandedData.name) ? t('spellcasting.unprepare') : t('spellcasting.prepare')}
                  </button>
                  <button onClick={() => setExpandedSpell(null)} className="text-text-muted hover:text-text-primary text-sm">✕</button>
                </div>
              </div>
              <div className="text-xs text-text-muted">
                {t(`spellLevelLabels.${expandedData.level}`)}
                {expandedData.school && ` • ${t(`schoolLabels.${expandedData.school}`, { defaultValue: modules.SCHOOL_NAMES[expandedData.school] || expandedData.school })}`}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {(() => { const m = getSpellMeta(expandedData, t); return (<>
                  {m.castingTime && <div><span className="text-text-muted">{t('meta.castingTime')}</span><span className="text-text-primary">{m.castingTime}</span></div>}
                  {m.range && <div><span className="text-text-muted">{t('meta.range')}</span><span className="text-text-primary">{m.range}</span></div>}
                  {m.components && <div><span className="text-text-muted">{t('meta.components')}</span><span className="text-text-primary">{m.components}</span></div>}
                  {m.duration && <div><span className="text-text-muted">{t('meta.duration')}</span><span className="text-text-primary">{m.duration}</span></div>}
                </>); })()}
              </div>
              <div className="pt-2 border-t border-border-default prose prose-invert prose-sm max-w-none text-xs">
                <modules.EntryRenderer entries={expandedData.entries} context={expandedData.name} />
              </div>
              {expandedData.entriesHigherLevel && expandedData.entriesHigherLevel.length > 0 && (
                <div className="pt-2 border-t border-border-default prose prose-invert prose-sm max-w-none text-xs">
                  <modules.EntryRenderer entries={expandedData.entriesHigherLevel} context={expandedData.name} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border-default flex items-center justify-between shrink-0">
          <p className="text-xs text-text-muted">
            {t('preparation.hint')}
          </p>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-lg border border-border-default text-text-secondary hover:text-text-primary hover:border-border-hover text-sm"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleConfirm}
              className="px-4 py-2 rounded-lg bg-gold/20 border border-gold/40 text-gold hover:bg-gold/30 text-sm font-medium flex items-center gap-2"
            >
              <Check size={14} />
              {t('common.apply')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
