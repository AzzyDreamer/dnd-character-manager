import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Character, CharacterSpell, SpellSlots } from '../types';
import { Search, Loader2, Wand2, Sparkles, ChevronDown, ChevronRight, Zap, BookOpen } from 'lucide-react';
import { CharacterStatsSidebar, SpellIconBadge, SpellTooltip } from './ui';
import { getClassName } from '../data/classes';
import { asset } from '../utils/asset';
import { SpellDetailModal } from './SpellDetailModal';

// Минимальный тип данных заклинания (без полного импорта)
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
}

interface LoadedModules {
  spells: SpellDataLocal[];
  getSpellImageUrl: (name: string) => string;
  SCHOOL_NAMES: Record<string, string>;
  EntryRenderer: React.FC<any>;
}

export interface LevelTableRow {
  level: number;
  cantrips?: number;
  preparedSpells?: number;
  spellSlots?: number[];
  [key: string]: any;
}

interface SpellLevelUpModalProps {
  character: Character;
  newLevel: number;
  oldLevelData: LevelTableRow;
  newLevelData: LevelTableRow;
  onConfirm: (newSpells: CharacterSpell[], updatedSlots: SpellSlots) => void;
  onCancel: () => void;
}

function buildSpellSlots(slotsArr: number[], currentSlots?: SpellSlots): SpellSlots {
  return {
    level1: { total: slotsArr[0] || 0, used: currentSlots?.level1?.used || 0 },
    level2: { total: slotsArr[1] || 0, used: currentSlots?.level2?.used || 0 },
    level3: { total: slotsArr[2] || 0, used: currentSlots?.level3?.used || 0 },
    level4: { total: slotsArr[3] || 0, used: currentSlots?.level4?.used || 0 },
    level5: { total: slotsArr[4] || 0, used: currentSlots?.level5?.used || 0 },
    level6: { total: slotsArr[5] || 0, used: currentSlots?.level6?.used || 0 },
    level7: { total: slotsArr[6] || 0, used: currentSlots?.level7?.used || 0 },
    level8: { total: slotsArr[7] || 0, used: currentSlots?.level8?.used || 0 },
    level9: { total: slotsArr[8] || 0, used: currentSlots?.level9?.used || 0 },
  };
}

function getSpellMeta(spell: SpellDataLocal, t: (key: string, opts?: any) => string) {
  const castingTime = spell.time
    ?.map(tm => `${tm.number} ${t(`meta.timeUnits.${tm.unit}`, { defaultValue: tm.unit })}`)
    .join(', ');
  const range = spell.range?.distance?.amount
    ? t('meta.rangeFeet', { amount: spell.range.distance.amount })
    : spell.range?.type === 'touch' ? t('meta.rangeTouch')
      : spell.range?.type === 'self' ? t('meta.rangeSelf')
        : spell.range?.type || '';
  const components = spell.components
    ? [spell.components.v ? t('meta.componentV') : '', spell.components.s ? t('meta.componentS') : '', spell.components.m ? t('meta.componentM') : ''].filter(Boolean).join(', ')
    : '';
  const duration = spell.duration
    ?.map(d => {
      if (d.type === 'instant') return t('meta.durationInstant');
      if (d.concentration) return t('meta.durationConcentration', { amount: d.duration?.amount || '', type: d.duration?.type || '' });
      return d.type;
    })
    .join(', ');
  return { castingTime, range, components, duration };
}

function getFirstEntryText(entries: any[]): string {
  for (const e of entries) {
    if (typeof e === 'string') return e;
    if (e?.entries) return getFirstEntryText(e.entries);
  }
  return '';
}

export const SpellLevelUpModal: React.FC<SpellLevelUpModalProps> = ({
  character,
  newLevel,
  oldLevelData,
  newLevelData,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation('spells');
  const [modules, setModules] = useState<LoadedModules | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNewCantrips, setSelectedNewCantrips] = useState<SpellDataLocal[]>([]);
  const [selectedNewSpells, setSelectedNewSpells] = useState<SpellDataLocal[]>([]);
  const [expandedSpell, setExpandedSpell] = useState<string | null>(null);
  const [infoSpell, setInfoSpell] = useState<{ name: string; level: number } | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const newCantripsCount = (newLevelData.cantrips ?? 0) - (oldLevelData.cantrips ?? 0);
  const newSpellsCount = (newLevelData.preparedSpells ?? 0) - (oldLevelData.preparedSpells ?? 0);

  const maxSpellLevel = useMemo(() => {
    const slots = newLevelData.spellSlots;
    if (!slots) return 1;
    let max = 1;
    for (let i = 0; i < slots.length; i++) {
      if (slots[i] > 0) max = i + 1;
    }
    return max;
  }, [newLevelData]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const spellsMod = await import('../data/spells');
      await spellsMod.init();
      if (cancelled) return;
      const entryMod = await import('../utils/entryRenderer');
      if (cancelled) return;
      const classSpells = spellsMod.getSpellsByClass(character.class);
      // Расширение списка от предыстории (Ravnica/Strixhaven additionalSpells.expanded)
      let allSpells = classSpells;
      if (character.background) {
        try {
          const bgMod = await import('../data/backgrounds/jsonBackgrounds');
          await bgMod.init();
          if (cancelled) return;
          const bg = bgMod.getJsonBackgroundByName(character.background);
          const extraNames = bgMod.getBackgroundExpandedSpellNames(bg);
          const have = new Set(classSpells.map(s => s.name.toLowerCase()));
          const extras = extraNames
            .map(n => spellsMod.getSpellByName(n))
            .filter((s): s is NonNullable<typeof s> => !!s && !have.has(s.name.toLowerCase()));
          if (extras.length > 0) allSpells = [...classSpells, ...extras];
        } catch { /* предыстория без расширений — ок */ }
      }
      setModules({
        spells: allSpells,
        getSpellImageUrl: spellsMod.getSpellImageUrl,
        SCHOOL_NAMES: spellsMod.SCHOOL_NAMES,
        EntryRenderer: entryMod.EntryRenderer,
      });
    })();
    return () => { cancelled = true; };
  }, [character.class, character.background]);

  const knownSpellNames = useMemo(() => {
    return new Set(character.spellcasting?.spells.map(s => s.name) || []);
  }, [character.spellcasting?.spells]);

  const { availableCantrips, availableSpells } = useMemo(() => {
    if (!modules) return { availableCantrips: [], availableSpells: [] };
    const q = searchQuery.toLowerCase().trim();
    const cantrips = modules.spells
      .filter(s => s.level === 0 && !knownSpellNames.has(s.name))
      .filter(s => !q || s.name.toLowerCase().includes(q));
    const spells = modules.spells
      .filter(s => s.level > 0 && s.level <= maxSpellLevel && !knownSpellNames.has(s.name))
      .filter(s => !q || s.name.toLowerCase().includes(q));
    return { availableCantrips: cantrips, availableSpells: spells };
  }, [modules, searchQuery, knownSpellNames, maxSpellLevel]);

  // Group available spells by level
  const spellsByLevel = useMemo(() => {
    const groups: Record<number, SpellDataLocal[]> = {};
    for (const s of availableSpells) {
      (groups[s.level] = groups[s.level] || []).push(s);
    }
    return groups;
  }, [availableSpells]);

  const toggleCantrip = (spell: SpellDataLocal) => {
    setSelectedNewCantrips(prev => {
      const exists = prev.find(s => s.name === spell.name);
      if (exists) return prev.filter(s => s.name !== spell.name);
      if (prev.length >= newCantripsCount) return prev;
      return [...prev, spell];
    });
  };

  const toggleSpell = (spell: SpellDataLocal) => {
    setSelectedNewSpells(prev => {
      const exists = prev.find(s => s.name === spell.name);
      if (exists) return prev.filter(s => s.name !== spell.name);
      if (prev.length >= newSpellsCount) return prev;
      return [...prev, spell];
    });
  };

  const toggleSection = (key: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const canConfirm =
    selectedNewCantrips.length === Math.max(0, newCantripsCount) &&
    selectedNewSpells.length === Math.max(0, newSpellsCount);

  const handleConfirm = () => {
    const newCharSpells: CharacterSpell[] = [
      ...selectedNewCantrips.map(s => ({
        spellId: s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        name: s.name,
        level: 0,
        prepared: true,
        alwaysPrepared: true,
      })),
      ...selectedNewSpells.map(s => ({
        spellId: s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        name: s.name,
        level: s.level,
        prepared: true,
      })),
    ];
    const updatedSlots = buildSpellSlots(
      newLevelData.spellSlots || [],
      character.spellcasting?.spellSlots
    );
    onConfirm(newCharSpells, updatedSlots);
  };

  // Нет новых заклинаний/заговоров — авто-подтверждение
  const noNewSpellsNeeded = newCantripsCount <= 0 && newSpellsCount <= 0;
  useEffect(() => {
    if (noNewSpellsNeeded) {
      const updatedSlots = buildSpellSlots(
        newLevelData.spellSlots || [],
        character.spellcasting?.spellSlots
      );
      onConfirm([], updatedSlots);
    }
  }, [noNewSpellsNeeded]); // eslint-disable-line react-hooks/exhaustive-deps

  if (noNewSpellsNeeded) return null;

  // Spell slot changes for the "you'll gain" section
  const slotChanges: { level: number; oldCount: number; newCount: number }[] = [];
  if (newLevelData.spellSlots) {
    for (let i = 0; i < newLevelData.spellSlots.length; i++) {
      const oldCount = oldLevelData.spellSlots?.[i] ?? 0;
      const newCount = newLevelData.spellSlots[i] ?? 0;
      if (newCount > oldCount) {
        slotChanges.push({ level: i + 1, oldCount, newCount });
      }
    }
  }

  // Expanded spell detail
  const expandedData = expandedSpell && modules ? (() => {
    const allSpells = [...availableCantrips, ...availableSpells];
    const spell = allSpells.find(s => s.name === expandedSpell);
    return spell || null;
  })() : null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6">
    <div className="w-full max-w-7xl max-h-[85vh] bg-bg-panel-solid rounded-xl border border-gold/30 flex flex-col overflow-hidden">
      {/* Header bar */}
      <div className="shrink-0 border-b border-gold/30 bg-bg-panel-solid/95 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-medieval text-gold flex items-center gap-3">
              <Sparkles className="text-gold" size={24} />
              {t('levelUp.title', { level: newLevel })}
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              {t('levelUp.subtitle', { class: character.classId ? getClassName(character.classId) : character.class, level: newLevel })}
              {newCantripsCount > 0 && ` • ${t('levelUp.newCantrips', { count: newCantripsCount })}`}
              {newSpellsCount > 0 && ` • ${t('levelUp.newSpells', { count: newSpellsCount })}`}
              {` • ${t('levelUp.availableUpTo', { level: maxSpellLevel })}`}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-border-default text-text-secondary hover:text-text-primary hover:border-border-hover transition-colors text-sm"
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>

      {/* Main content: two-column layout */}
      <div className="flex flex-1 min-h-0 max-w-7xl mx-auto w-full">
        {/* LEFT: content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-5">
          {!modules ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={32} className="animate-spin text-gold" />
              <span className="ml-3 text-text-secondary">{t('common.loadingSpells')}</span>
            </div>
          ) : (
            <>
              {/* "Вы получите следующее" section */}
              <div className="glass-panel ornate-border p-4 space-y-3">
                <h3 className="text-base font-medieval text-gold">{t('levelUp.youWillGain')}</h3>
                <div className="space-y-2 text-sm">
                  {newCantripsCount > 0 && (
                    <div className="flex items-center gap-2 text-text-primary">
                      <span className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
                        <Sparkles size={12} className="text-purple-400" />
                      </span>
                      {t('levelUp.newCantripsGain', { count: newCantripsCount })}
                    </div>
                  )}
                  {newSpellsCount > 0 && (
                    <div className="flex items-center gap-2 text-text-primary">
                      <span className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                        <Wand2 size={12} className="text-blue-400" />
                      </span>
                      {t('levelUp.newSpellsGain', { count: newSpellsCount })}
                    </div>
                  )}
                  {slotChanges.map(({ level, oldCount, newCount }) => (
                    <div key={level} className="flex items-center gap-2 text-text-primary">
                      <span className="w-5 h-5 rounded-full bg-gold/20 flex items-center justify-center shrink-0">
                        <Zap size={12} className="text-gold" />
                      </span>
                      {t('spellSlots.slotsChange', { level, old: oldCount, new: newCount })}
                    </div>
                  ))}
                </div>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
                <input
                  type="text"
                  placeholder={t('common.search')}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-bg-primary border border-border-default rounded-lg text-text-primary text-sm focus:outline-none focus:border-gold/50 transition-colors"
                />
              </div>

              {/* New cantrips section — icon grid */}
              {newCantripsCount > 0 && (
                <div className="glass-panel p-4">
                  <button
                    onClick={() => toggleSection('cantrips')}
                    className="flex items-center gap-2 w-full text-left mb-3"
                  >
                    {collapsedSections.has('cantrips')
                      ? <ChevronRight size={16} className="text-text-muted" />
                      : <ChevronDown size={16} className="text-text-muted" />}
                    <Sparkles size={16} className="text-purple-400" />
                    <span className="text-sm font-medieval text-purple-300">
                      {t('levelUp.newCantripSection', { selected: selectedNewCantrips.length, total: newCantripsCount })}
                    </span>
                  </button>
                  {!collapsedSections.has('cantrips') && (
                    <div className="flex flex-wrap gap-2">
                      {availableCantrips.map(spell => {
                        const isSelected = selectedNewCantrips.some(s => s.name === spell.name);
                        const disabled = !isSelected && selectedNewCantrips.length >= newCantripsCount;
                        const meta = getSpellMeta(spell, t);
                        return (
                          <SpellTooltip
                            key={spell.name}
                            name={spell.name}
                            level={0}
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
                              level={0}
                              imageSrc={modules.getSpellImageUrl(spell.name)}
                              prepared={!disabled || isSelected}
                              selected={isSelected}
                              onClick={() => {
                                if (!disabled || isSelected) {
                                  toggleCantrip(spell);
                                }
                              }}
                              onContextMenu={(e) => { e.preventDefault(); setInfoSpell({ name: spell.name, level: 0 }); }}
                              className={isSelected ? 'ring-2 ring-green-bright/60' : ''}
                            />
                          </SpellTooltip>
                        );
                      })}
                      {availableCantrips.length === 0 && (
                        <p className="text-sm text-text-muted py-2">{t('common.noCantripsAvailable')}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* New spells section — icon grid grouped by level */}
              {newSpellsCount > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 px-1">
                    <Wand2 size={16} className="text-blue-400" />
                    <span className="text-sm font-medieval text-blue-300">
                      {t('levelUp.newSpellSection', { selected: selectedNewSpells.length, total: newSpellsCount })}
                    </span>
                  </div>

                  {Object.entries(spellsByLevel)
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([level, spells]) => {
                      const sectionKey = `spells-level-${level}`;
                      return (
                        <div key={level} className="glass-panel p-4">
                          <button
                            onClick={() => toggleSection(sectionKey)}
                            className="flex items-center gap-2 w-full text-left mb-3"
                          >
                            {collapsedSections.has(sectionKey)
                              ? <ChevronRight size={14} className="text-text-muted" />
                              : <ChevronDown size={14} className="text-text-muted" />}
                            <span className="text-sm font-medieval text-blue-300">
                              {t('spellcasting.levelCount', { level, count: spells.length })}
                            </span>
                          </button>
                          {!collapsedSections.has(sectionKey) && (
                            <div className="flex flex-wrap gap-2">
                              {spells.map(spell => {
                                const isSelected = selectedNewSpells.some(s => s.name === spell.name);
                                const disabled = !isSelected && selectedNewSpells.length >= newSpellsCount;
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
                                      prepared={!disabled || isSelected}
                                      selected={isSelected}
                                      onClick={() => {
                                        if (!disabled || isSelected) {
                                          toggleSpell(spell);
                                        }
                                      }}
                                      onContextMenu={(e) => { e.preventDefault(); setInfoSpell({ name: spell.name, level: spell.level }); }}
                                      className={isSelected ? 'ring-2 ring-green-bright/60' : ''}
                                    />
                                  </SpellTooltip>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}

                  {availableSpells.length === 0 && (
                    <p className="text-sm text-text-muted text-center py-4">{t('common.noSpellsAvailable')}</p>
                  )}
                </div>
              )}

              {/* Expanded spell detail */}
              {expandedData && modules && (
                <div className="glass-panel ornate-border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medieval text-gold">{expandedData.name}</h3>
                    <button
                      onClick={() => setExpandedSpell(null)}
                      className="text-text-muted hover:text-text-primary text-sm"
                    >✕</button>
                  </div>
                  <div className="text-xs text-text-muted">
                    {expandedData.level === 0 ? t('common.cantrip') : t(`spellLevelLabels.${expandedData.level}`)}
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
                </div>
              )}

              {/* Spell slots info */}
              {newLevelData.spellSlots && (
                <div className="glass-panel p-4">
                  <h4 className="text-sm font-medieval text-text-secondary mb-2 flex items-center gap-2">
                    <BookOpen size={14} />
                    {t('spellSlots.slotsAtLevel', { level: newLevel })}
                  </h4>
                  <div className="flex gap-3 flex-wrap text-sm">
                    {newLevelData.spellSlots.map((count: number, idx: number) =>
                      count > 0 ? (
                        <div key={idx} className="flex items-center gap-1.5 px-2 py-1 rounded bg-bg-primary border border-border-default">
                          <span className="text-text-muted text-xs">{t('common.levelInline', { level: idx + 1 })}</span>
                          <span className="text-text-primary font-bold">{count}</span>
                        </div>
                      ) : null
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* RIGHT: Character stats sidebar */}
        <div className="hidden lg:block w-72 shrink-0 border-l border-border-default bg-bg-panel-solid/50 overflow-y-auto p-4">
          <CharacterStatsSidebar
            character={character}
            showCombatStats
            classIconSrc={asset(`/images/classes/${character.classId}.webp`)}
            className="!w-full !flex !flex-col"
          />

          {/* Selected spells summary */}
          {(selectedNewCantrips.length > 0 || selectedNewSpells.length > 0) && (
            <div className="glass-panel p-3 mt-3 space-y-2">
              <h4 className="text-[10px] uppercase tracking-wider text-text-muted">{t('common.selected')}</h4>
              {selectedNewCantrips.map(s => (
                <div key={s.name} className="flex items-center gap-2 text-xs text-text-secondary">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
                  <span className="truncate">{s.name}</span>
                  <span className="text-purple-400 text-[10px] ml-auto">{t('common.cantripShort')}</span>
                </div>
              ))}
              {selectedNewSpells.map(s => (
                <div key={s.name} className="flex items-center gap-2 text-xs text-text-secondary">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                  <span className="truncate">{s.name}</span>
                  <span className="text-blue-400 text-[10px] ml-auto">{t('common.levelInline', { level: s.level })}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-gold/30 bg-bg-panel-solid/95 px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="text-sm text-text-muted">
            {newCantripsCount > 0 && (
              <span className={selectedNewCantrips.length === newCantripsCount ? 'text-green-bright' : ''}>
                {t('levelUp.cantripsFooter', { selected: selectedNewCantrips.length, total: newCantripsCount })}
              </span>
            )}
            {newCantripsCount > 0 && newSpellsCount > 0 && <span className="mx-2">•</span>}
            {newSpellsCount > 0 && (
              <span className={selectedNewSpells.length === newSpellsCount ? 'text-green-bright' : ''}>
                {t('levelUp.spellsFooter', { selected: selectedNewSpells.length, total: newSpellsCount })}
              </span>
            )}
          </div>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="px-8 py-2.5 rounded-lg bg-gold/20 text-gold border border-gold/30 font-medieval font-semibold text-lg
              hover:bg-gold/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all
              enabled:gold-glow"
          >
            {t('common.confirm')}
          </button>
        </div>
      </div>
    </div>

    {infoSpell && (
      <SpellDetailModal
        spellName={infoSpell.name}
        fallbackLevel={infoSpell.level}
        onClose={() => setInfoSpell(null)}
      />
    )}
    </div>
  );
};
