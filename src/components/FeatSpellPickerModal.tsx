import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Character, CharacterSpell } from '../types';
import type { FeatSpellConfig } from '../utils/featEffects';
import { Search, Loader2, Check, X, Wand2 } from 'lucide-react';
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
}

interface LoadedModules {
  allSpells: SpellDataLocal[];
  getSpellsByClass: (cls: string) => SpellDataLocal[];
  getSpellsBySchool: (school: string) => SpellDataLocal[];
  getSpellByName: (name: string) => SpellDataLocal | undefined;
  getSpellImageUrl: (name: string) => string;
  SCHOOL_NAMES: Record<string, string>;
  EntryRenderer: React.FC<any>;
}

interface FeatSpellPickerModalProps {
  character: Character;
  featName: string;
  config: FeatSpellConfig;
  onConfirm: (spells: CharacterSpell[], chosenAbility?: string) => void;
  onCancel: () => void;
}

function getFirstEntryText(entries: any[]): string {
  for (const e of entries) {
    if (typeof e === 'string') return e.replace(/\{@\w+\s+([^|}]+)(?:\|[^}]*)?\}/g, '$1');
    if (e?.entries) return getFirstEntryText(e.entries);
  }
  return '';
}

export const FeatSpellPickerModal: React.FC<FeatSpellPickerModalProps> = ({
  character,
  featName,
  config,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation('spells');
  const [modules, setModules] = useState<LoadedModules | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [chosenAbility, setChosenAbility] = useState<string>(config.fixedAbility || '');
  const [chosenClass, setChosenClass] = useState<string>(config.classOptions?.[0]?.className || '');
  const [selectedSpells, setSelectedSpells] = useState<Map<string, SpellDataLocal>>(new Map()); // key = "cantrip-0" or "spell-0"
  // (SpellTooltip wraps children, no explicit hover state needed)

  // Load spells
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const spellsMod = await import('../data/spells');
      await spellsMod.init();
      if (cancelled) return;
      const entryMod = await import('../utils/entryRenderer');
      if (cancelled) return;
      setModules({
        allSpells: spellsMod.ALL_SPELLS as SpellDataLocal[],
        getSpellsByClass: spellsMod.getSpellsByClass as any,
        getSpellsBySchool: spellsMod.getSpellsBySchool as any,
        getSpellByName: spellsMod.getSpellByName as any,
        getSpellImageUrl: spellsMod.getSpellImageUrl,
        SCHOOL_NAMES: spellsMod.SCHOOL_NAMES,
        EntryRenderer: entryMod.EntryRenderer,
      });
    })();
    return () => { cancelled = true; };
  }, []);

  // Resolve fixed spells (determine their levels)
  const fixedSpells = useMemo<SpellDataLocal[]>(() => {
    if (!modules) return [];
    return config.fixedSpells
      .map(fs => modules.getSpellByName(fs.name))
      .filter((s): s is SpellDataLocal => !!s);
  }, [modules, config.fixedSpells]);

  // Active config based on chosen class (for Magic Initiate etc.)
  const activeConfig = useMemo(() => {
    if (!config.classOptions || !chosenClass) return config;
    // Re-parse the additionalSpells for the chosen class option
    // For now, the config choices apply to any class option
    return config;
  }, [config, chosenClass]);

  // Available spells for each choice slot
  const availableSpellsByChoice = useMemo<Record<number, SpellDataLocal[]>>(() => {
    if (!modules) return {};
    const result: Record<number, SpellDataLocal[]> = {};
    const q = searchQuery.toLowerCase().trim();
    const knownNames = new Set(character.spellcasting?.spells.map(s => s.name) || []);
    // Also exclude fixed spells
    for (const fs of fixedSpells) knownNames.add(fs.name);

    activeConfig.choices.forEach((choice, idx) => {
      let spells: SpellDataLocal[];

      if (choice.filterClass && chosenClass) {
        spells = modules.getSpellsByClass(chosenClass);
      } else if (choice.filterClass) {
        spells = modules.getSpellsByClass(choice.filterClass);
      } else {
        spells = modules.allSpells;
      }

      // Filter by level
      spells = spells.filter(s => s.level === choice.level);

      // Filter by school
      if (choice.filterSchools && choice.filterSchools.length > 0) {
        spells = spells.filter(s => choice.filterSchools!.includes(s.school));
      }

      // Exclude already known
      spells = spells.filter(s => !knownNames.has(s.name));

      // Search
      if (q) {
        spells = spells.filter(s => s.name.toLowerCase().includes(q));
      }

      result[idx] = spells.sort((a, b) => a.name.localeCompare(b.name));
    });

    return result;
  }, [modules, activeConfig, chosenClass, searchQuery, character.spellcasting?.spells, fixedSpells]);

  // Toggle spell selection for a choice slot
  const toggleSpell = (choiceIdx: number, spell: SpellDataLocal) => {
    const choice = activeConfig.choices[choiceIdx];
    setSelectedSpells(prev => {
      const next = new Map(prev);
      // Count how many are selected for this choice index
      const keysForChoice = Array.from(next.keys()).filter(k => k.startsWith(`${choiceIdx}-`));

      const existingKey = keysForChoice.find(k => next.get(k)?.name === spell.name);
      if (existingKey) {
        next.delete(existingKey);
      } else if (keysForChoice.length < choice.count) {
        next.set(`${choiceIdx}-${keysForChoice.length}`, spell);
      }
      return next;
    });
  };

  // Check if all required choices are made
  const canConfirm = useMemo(() => {
    if (config.abilityOptions && !chosenAbility) return false;
    if (config.classOptions && !chosenClass) return false;

    for (let i = 0; i < activeConfig.choices.length; i++) {
      const choice = activeConfig.choices[i];
      const count = Array.from(selectedSpells.keys()).filter(k => k.startsWith(`${i}-`)).length;
      if (count < choice.count) return false;
    }
    return true;
  }, [config, activeConfig, chosenAbility, chosenClass, selectedSpells]);

  const handleConfirm = () => {
    if (!canConfirm) return;

    const spells: CharacterSpell[] = [];

    // Fixed spells
    for (const fs of fixedSpells) {
      spells.push({
        spellId: fs.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        name: fs.name,
        level: fs.level,
        prepared: true,
        alwaysPrepared: true,
        source: featName,
      });
    }

    // Chosen spells
    for (const [, spell] of selectedSpells) {
      spells.push({
        spellId: spell.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        name: spell.name,
        level: spell.level,
        prepared: true,
        alwaysPrepared: true,
        source: featName,
      });
    }

    onConfirm(spells, chosenAbility || undefined);
  };

  const getSelectedCountForChoice = (idx: number) =>
    Array.from(selectedSpells.keys()).filter(k => k.startsWith(`${idx}-`)).length;

  const isSpellSelectedForChoice = (idx: number, spell: SpellDataLocal) =>
    Array.from(selectedSpells.entries()).some(([k, s]) => k.startsWith(`${idx}-`) && s.name === spell.name);

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6">
    <div className="w-full max-w-5xl max-h-[85vh] bg-bg-panel-solid rounded-xl border border-gold/30 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-gold/30 bg-bg-panel-solid/95 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-medieval text-gold flex items-center gap-3">
              <Wand2 className="text-gold" size={24} />
              {t('featSpells.title', { feat: featName })}
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              {t('featSpells.chooseSpells')}
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

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-5">
        {!modules ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-gold" />
            <span className="ml-3 text-text-secondary">{t('common.loadingSpells')}</span>
          </div>
        ) : (
          <>
            {/* Class choice (Magic Initiate) */}
            {config.classOptions && config.classOptions.length > 1 && (
              <div className="glass-panel p-4">
                <h3 className="text-sm font-medium text-text-primary mb-3">{t('featSpells.chooseSpellList')}</h3>
                <div className="flex flex-wrap gap-2">
                  {config.classOptions.map(opt => (
                    <button
                      key={opt.className}
                      onClick={() => {
                        setChosenClass(opt.className);
                        setSelectedSpells(new Map());
                      }}
                      className={`px-4 py-2 rounded-lg border text-sm transition-all ${
                        chosenClass === opt.className
                          ? 'border-gold/50 bg-gold/10 text-gold'
                          : 'border-border-default bg-bg-primary/40 text-text-primary hover:border-border-hover'
                      }`}
                    >
                      {opt.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Ability choice */}
            {config.abilityOptions && config.abilityOptions.length > 0 && (
              <div className="glass-panel p-4">
                <h3 className="text-sm font-medium text-text-primary mb-3">{t('featSpells.baseAbility')}</h3>
                <div className="flex flex-wrap gap-2">
                  {config.abilityOptions.map(ab => (
                    <button
                      key={ab}
                      onClick={() => setChosenAbility(ab)}
                      className={`px-4 py-2 rounded-lg border text-sm transition-all ${
                        chosenAbility === ab
                          ? 'border-gold/50 bg-gold/10 text-gold'
                          : 'border-border-default bg-bg-primary/40 text-text-primary hover:border-border-hover'
                      }`}
                    >
                      {t(`abilityLabels.${ab}`, { defaultValue: ab })}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Fixed spells info */}
            {fixedSpells.length > 0 && (
              <div className="glass-panel p-4">
                <h3 className="text-sm font-medium text-text-primary mb-3">
                  {t('featSpells.youWillAutoGet')}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {fixedSpells.map(spell => (
                    <SpellTooltip
                      key={spell.name}
                      name={spell.name}
                      level={spell.level}
                      school={spell.school}
                    >
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-green-500/30 bg-green-500/5">
                        <SpellIconBadge
                          name={spell.name}
                          school={spell.school}
                          level={spell.level}
                          imageSrc={modules.getSpellImageUrl(spell.name)}
                        />
                        <span className="text-sm text-green-400">{spell.name}</span>
                        <span className="text-[10px] text-text-muted">
                          {spell.level === 0 ? t('common.cantripInline') : t('common.levelInline', { level: spell.level })}
                        </span>
                      </div>
                    </SpellTooltip>
                  ))}
                </div>
              </div>
            )}

            {/* Search */}
            {activeConfig.choices.length > 0 && (
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={t('common.search')}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-bg-primary border border-border-default
                    text-text-primary placeholder-text-muted focus:border-gold/50 focus:outline-none"
                />
              </div>
            )}

            {/* Spell choice sections */}
            {activeConfig.choices.map((choice, idx) => {
              const available = availableSpellsByChoice[idx] || [];
              const selectedCount = getSelectedCountForChoice(idx);
              const levelLabel = choice.level === 0 ? t('featSpells.cantripLabel') : t('featSpells.spellsOfLevel', { level: choice.level });
              const schoolLabel = choice.filterSchools?.map(s => SCHOOL_LABELS[s] || s).join(', ');

              return (
                <div key={idx} className="glass-panel p-4">
                  <h3 className="text-sm font-medium text-text-primary mb-1">
                    {levelLabel}
                    {schoolLabel && <span className="text-text-muted font-normal"> — {schoolLabel}</span>}
                  </h3>
                  <p className="text-xs text-text-muted mb-3">
                    {t('featSpells.chooseCount', { count: choice.count, selected: selectedCount })}
                  </p>

                  {available.length === 0 ? (
                    <div className="text-sm text-text-muted py-4 text-center">
                      {searchQuery ? t('common.nothingFound') : t('common.noSpellsAvailable')}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-60 overflow-y-auto">
                      {available.map(spell => {
                        const isSelected = isSpellSelectedForChoice(idx, spell);
                        const canSelect = isSelected || selectedCount < choice.count;

                        return (
                          <SpellTooltip
                            key={spell.name}
                            name={spell.name}
                            level={spell.level}
                            school={spell.school}
                            description={getFirstEntryText(spell.entries)}
                          >
                            <button
                              onClick={() => canSelect && toggleSpell(idx, spell)}
                              disabled={!canSelect}
                              className={`flex items-center gap-2 p-2 rounded-lg border text-left text-xs transition-all w-full ${
                                isSelected
                                  ? 'border-gold/50 bg-gold/10'
                                  : canSelect
                                    ? 'border-border-default bg-bg-primary/40 hover:border-border-hover'
                                    : 'border-border-default/50 bg-bg-primary/20 opacity-40 cursor-not-allowed'
                              }`}
                            >
                              {isSelected && <Check size={12} className="text-gold shrink-0" />}
                              <SpellIconBadge
                                name={spell.name}
                                school={spell.school}
                                level={spell.level}
                                imageSrc={modules.getSpellImageUrl(spell.name)}
                              />
                              <span className={`truncate ${isSelected ? 'text-gold' : 'text-text-primary'}`}>
                                {spell.name}
                              </span>
                            </button>
                          </SpellTooltip>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-gold/30 bg-bg-panel-solid/95 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-text-secondary">
            {fixedSpells.length > 0 && (
              <span>{t('featSpells.autoPlus', { count: fixedSpells.length })}</span>
            )}
            {t('featSpells.selectedCount', { count: Array.from(selectedSpells.values()).length })}
          </div>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="px-8 py-2.5 rounded-lg bg-gold/20 text-gold border border-gold/30 font-medieval font-semibold text-lg
              hover:bg-gold/30 transition-all gold-glow disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-gold/20"
          >
            {t('common.confirm')}
          </button>
        </div>
      </div>

    </div>
    </div>
  );
};
