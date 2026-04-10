import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Character, CharacterSpell } from '../types';
import { SpellIconBadge } from './ui';
import { ArrowRight, Search, SkipForward } from 'lucide-react';

interface SpellDataLocal {
  name: string;
  level: number;
  school: string;
  time?: { number: number; unit: string }[];
  range?: { type: string; distance?: { type: string; amount?: number } };
  components?: { v?: boolean; s?: boolean; m?: string | boolean | any };
  duration?: { type: string; duration?: { type: string; amount: number }; concentration?: boolean }[];
  entries: any[];
  entriesHigherLevel?: any[];
}

interface LoadedModules {
  allSpells: SpellDataLocal[];
  getSpellsByClass: (cls: string) => SpellDataLocal[];
  getSpellByName: (name: string) => SpellDataLocal | undefined;
  getSpellImageUrl: (name: string) => string;
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

interface FeatSpellSwapModalProps {
  character: Character;
  onConfirm: (swaps: { oldSpellId: string; newSpell: CharacterSpell }[]) => void;
  onSkip: () => void;
}

export const FeatSpellSwapModal: React.FC<FeatSpellSwapModalProps> = ({ character, onConfirm, onSkip }) => {
  const { t } = useTranslation('spells');
  const [modules, setModules] = useState<LoadedModules | null>(null);
  const [selectedFeatSpell, setSelectedFeatSpell] = useState<CharacterSpell | null>(null);
  const [selectedReplacement, setSelectedReplacement] = useState<SpellDataLocal | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [inspectedSpell, setInspectedSpell] = useState<SpellDataLocal | null>(null);

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
        allSpells: spellsMod.ALL_SPELLS as any,
        getSpellsByClass: spellsMod.getSpellsByClass as any,
        getSpellByName: spellsMod.getSpellByName as any,
        getSpellImageUrl: spellsMod.getSpellImageUrl,
        SCHOOL_NAMES: spellsMod.SCHOOL_NAMES,
        EntryRenderer: entryMod.EntryRenderer,
      });
    })();
    return () => { cancelled = true; };
  }, []);

  // Feat spells that can be swapped
  const featSpells = useMemo(() => {
    if (!character.spellcasting) return [];
    return character.spellcasting.spells.filter(s =>
      s.source && s.source !== character.subclass && s.source !== character.race
    );
  }, [character]);

  // Extract feat's original class from character.feats (e.g. "Magic Initiate (Cleric)" → "Cleric")
  const getFeatClassName = (spellSource: string): string | null => {
    const feat = character.feats?.find(f =>
      f.name === spellSource || f.name.startsWith(spellSource + ' (')
    );
    if (feat) {
      const match = feat.name.match(/\(([^)]+)\)/);
      if (match) return match[1];
    }
    return null;
  };

  // Max spell level the character has access to (from spell slots)
  const maxAvailableLevel = useMemo(() => {
    const slots = character.spellcasting?.spellSlots;
    if (!slots) return 1;
    let max = 1;
    const slotKeys = ['level1','level2','level3','level4','level5','level6','level7','level8','level9'] as const;
    slotKeys.forEach((key, idx) => {
      if (slots[key]?.total && slots[key].total > 0) max = idx + 1;
    });
    return max;
  }, [character.spellcasting?.spellSlots]);

  // Available spells for replacement — from feat's class, up to max available spell level
  const replacementSpells = useMemo(() => {
    if (!modules || !selectedFeatSpell) return [];
    const featClass = getFeatClassName(selectedFeatSpell.source || '');
    const className = featClass || character.class;
    const classSpells = modules.getSpellsByClass(className);
    const existingNames = new Set(character.spellcasting?.spells.map(s => s.name) || []);
    const q = searchQuery.toLowerCase().trim();
    const minLevel = selectedFeatSpell.level === 0 ? 0 : 1;
    const maxLevel = selectedFeatSpell.level === 0 ? 0 : maxAvailableLevel;

    return classSpells
      .filter(s => s.level >= minLevel && s.level <= maxLevel)
      .filter(s => !existingNames.has(s.name))
      .filter(s => !q || s.name.toLowerCase().includes(q))
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  }, [modules, selectedFeatSpell, character, searchQuery, maxAvailableLevel]);

  const handleConfirm = () => {
    if (!selectedFeatSpell || !selectedReplacement) return;
    onConfirm([{
      oldSpellId: selectedFeatSpell.spellId,
      newSpell: {
        spellId: selectedReplacement.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        name: selectedReplacement.name,
        level: selectedReplacement.level,
        prepared: true,
        alwaysPrepared: true,
        source: selectedFeatSpell.source,
      },
    }]);
  };

  if (featSpells.length === 0) {
    onSkip();
    return null;
  }

  const detailSpell = inspectedSpell;
  const detailMeta = getSpellMeta(detailSpell ?? undefined, t);

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6">
      <div className="w-full max-w-5xl max-h-[85vh] bg-bg-panel-solid rounded-xl border border-purple-500/30 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="shrink-0 border-b border-purple-500/30 px-6 py-4">
          <h2 className="text-lg font-medieval text-purple-300">{t('swap.title')}</h2>
          <p className="text-xs text-text-muted mt-1">
            {t('swap.description')}
          </p>
        </div>

        {/* Body: two columns */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Left: spell selection */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 border-r border-border-default">
            {/* Step 1: Select feat spell to replace */}
            <div>
              <h3 className="text-sm font-medium text-text-primary mb-2">{t('swap.spellToReplace')}</h3>
              <div className="flex flex-wrap gap-2">
                {featSpells.map(spell => {
                  const data = modules?.getSpellByName(spell.name);
                  const isSelected = selectedFeatSpell?.spellId === spell.spellId;
                  return (
                    <button
                      key={spell.spellId}
                      onClick={() => {
                        setSelectedFeatSpell(isSelected ? null : spell);
                        setSelectedReplacement(null);
                        setSearchQuery('');
                        if (!isSelected && data) setInspectedSpell(data);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        if (data) setInspectedSpell(data);
                      }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                        isSelected
                          ? 'border-purple-400/60 bg-purple-500/15 ring-1 ring-purple-400/40'
                          : 'border-border-default bg-bg-primary/40 hover:border-purple-400/40'
                      }`}
                    >
                      <SpellIconBadge
                        name={spell.name}
                        school={data?.school || ''}
                        level={spell.level}
                        imageSrc={modules?.getSpellImageUrl(spell.name)}
                        prepared
                      />
                      <div className="text-left">
                        <div className={`text-sm ${isSelected ? 'text-purple-300' : 'text-text-primary'}`}>{spell.name}</div>
                        <div className="text-[10px] text-text-muted">
                          {spell.level === 0 ? t('common.cantripInline') : t('common.levelInline', { level: spell.level })} · {spell.source}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Select replacement from class list */}
            {selectedFeatSpell && modules && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <ArrowRight size={14} className="text-text-muted" />
                  <h3 className="text-sm font-medium text-text-primary">
                    {t('swap.replaceWith', {
                      levelRange: selectedFeatSpell.level === 0 ? t('swap.replaceWithCantrips') : t('swap.levelRangeSpells', { max: maxAvailableLevel }),
                      class: getFeatClassName(selectedFeatSpell.source || '') || character.class,
                    })}
                  </h3>
                </div>

                <div className="relative mb-2">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder={t('common.search')}
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-bg-primary border border-border-default
                      text-text-primary placeholder-text-muted focus:border-purple-400/50 focus:outline-none"
                  />
                </div>

                <div className="flex flex-wrap gap-1.5 max-h-[45vh] overflow-y-auto">
                  {replacementSpells.map(spell => {
                    const isSelected = selectedReplacement?.name === spell.name;
                    const isInspected = inspectedSpell?.name === spell.name;
                    return (
                      <button
                        key={spell.name}
                        onClick={() => {
                          setSelectedReplacement(isSelected ? null : spell);
                          setInspectedSpell(spell);
                        }}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-colors ${
                          isSelected
                            ? 'border-gold/50 bg-gold/10'
                            : isInspected
                              ? 'border-purple-400/40 bg-purple-500/5'
                              : 'border-border-default bg-bg-primary/40 hover:border-border-hover'
                        }`}
                      >
                        <SpellIconBadge
                          name={spell.name}
                          school={spell.school}
                          level={spell.level}
                          imageSrc={modules.getSpellImageUrl(spell.name)}
                          prepared
                          selected={isSelected}
                        />
                        <span className={`text-sm truncate ${isSelected ? 'text-gold' : 'text-text-primary'}`}>
                          {spell.name}
                        </span>
                        {spell.level > 0 && (
                          <span className="text-[10px] text-text-muted shrink-0">{t('common.levelInline', { level: spell.level })}</span>
                        )}
                      </button>
                    );
                  })}
                  {replacementSpells.length === 0 && (
                    <div className="text-text-muted text-sm py-2">{t('swap.noReplacementSpells')}</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right: spell detail panel */}
          <div className="w-[340px] shrink-0 overflow-y-auto p-4">
            {detailSpell && modules ? (
              <div className="space-y-3">
                <h3 className="text-lg font-medieval text-gold">{detailSpell.name}</h3>
                <div className="text-xs text-text-muted">
                  {detailSpell.level === 0 ? t('common.cantrip') : t(`spellLevelLabels.${detailSpell.level}`)}
                  {detailSpell.school && ` · ${t(`schoolLabels.${detailSpell.school}`, { defaultValue: modules.SCHOOL_NAMES[detailSpell.school] || detailSpell.school })}`}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  {detailMeta.castingTime && <div><span className="text-text-muted">{t('meta.castingTime')}</span><span className="text-text-primary">{detailMeta.castingTime}</span></div>}
                  {detailMeta.range && <div><span className="text-text-muted">{t('meta.range')}</span><span className="text-text-primary">{detailMeta.range}</span></div>}
                  {detailMeta.components && <div><span className="text-text-muted">{t('meta.components')}</span><span className="text-text-primary">{detailMeta.components}</span></div>}
                  {detailMeta.duration && <div><span className="text-text-muted">{t('meta.duration')}</span><span className="text-text-primary">{detailMeta.duration}</span></div>}
                </div>

                <div className="pt-2 border-t border-border-default prose prose-invert prose-sm max-w-none text-xs">
                  <modules.EntryRenderer entries={detailSpell.entries} context={detailSpell.name} />
                </div>
                {detailSpell.entriesHigherLevel && detailSpell.entriesHigherLevel.length > 0 && (
                  <div className="pt-2 border-t border-border-default prose prose-invert prose-sm max-w-none text-xs">
                    <modules.EntryRenderer entries={detailSpell.entriesHigherLevel} context={detailSpell.name} />
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-text-muted text-sm italic">
                {t('swap.clickToSeeDescription')}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-purple-500/30 px-6 py-3 flex items-center justify-between">
          <button
            onClick={onSkip}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border-default text-text-secondary hover:text-text-primary hover:border-border-hover transition-colors"
          >
            <SkipForward size={14} />
            {t('common.skip')}
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedFeatSpell || !selectedReplacement}
            className="px-5 py-2 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {t('common.replace')}
          </button>
        </div>
      </div>
    </div>
  );
};
