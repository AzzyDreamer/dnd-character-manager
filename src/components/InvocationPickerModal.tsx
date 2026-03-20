import React, { useState, useEffect, useMemo } from 'react';
import type { Character } from '../types';
import type { OptionalFeatureData } from '../data/optionalfeatures';
import { Search, Check, X, Loader2, Sparkles, BookOpen, RefreshCw } from 'lucide-react';
import { CharacterStatsSidebar } from './ui';

// ── Types ──

export interface OptionalFeaturePickerConfig {
  featureType: string;          // "EI", "MM", "MV:B"
  title: string;                // "Воззвания", "Метамагия", "Манёвры"
  singular: string;             // "воззвание", "метамагию", "манёвр"
  pluralFew: string;            // "воззвания", "метамагии", "манёвра"
  pluralGenitive: string;       // "воззваний", "метамагий", "манёвров"
}

export interface OptionalFeaturePickerResult {
  chosen: OptionalFeatureData[];
  replaced?: string;
  replacement?: OptionalFeatureData;
}

// Keep old name as alias for backward compatibility in CharacterSheet imports
export type InvocationPickerResult = OptionalFeaturePickerResult;

interface OptionalFeaturePickerModalProps {
  character: Character;
  config: OptionalFeaturePickerConfig;
  newSlots: number;
  allowReplace: boolean;
  onConfirm: (result: OptionalFeaturePickerResult) => void;
  onCancel: () => void;
}

// ── Configs ──

export const OPTIONAL_FEATURE_CONFIGS: Record<string, OptionalFeaturePickerConfig> = {
  EI: { featureType: 'EI', title: 'Воззвания', singular: 'воззвание', pluralFew: 'воззвания', pluralGenitive: 'воззваний' },
  MM: { featureType: 'MM', title: 'Метамагия', singular: 'метамагию', pluralFew: 'метамагии', pluralGenitive: 'метамагий' },
  'MV:B': { featureType: 'MV:B', title: 'Манёвры', singular: 'манёвр', pluralFew: 'манёвра', pluralGenitive: 'манёвров' },
};

// ── EntryRenderer lazy load ──
let _EntryRenderer: React.FC<{ entries: any[]; className?: string }> | null = null;
let _entryPromise: Promise<void> | null = null;
function loadEntryRenderer(): Promise<void> {
  if (_EntryRenderer) return Promise.resolve();
  if (_entryPromise) return _entryPromise;
  _entryPromise = import('../utils/entryRenderer').then(mod => {
    _EntryRenderer = mod.EntryRenderer;
  });
  return _entryPromise;
}

// ── Helpers ──

function isRepeatable(feat: OptionalFeatureData): boolean {
  if (!feat.entries) return false;
  return feat.entries.some((e: any) => {
    if (typeof e !== 'object') return false;
    if (e.name === 'Repeatable') return true;
    if (e.entries) {
      return e.entries.some((inner: any) =>
        typeof inner === 'object' && inner.name === 'Repeatable'
      );
    }
    return false;
  });
}

function checkPrerequisite(
  feat: OptionalFeatureData,
  characterLevel: number,
  ownedFeatures: Set<string>,
  spellNames: Set<string>,
): boolean {
  if (!feat.prerequisite || feat.prerequisite.length === 0) return true;

  for (const prereq of feat.prerequisite) {
    if (prereq.level) {
      const reqLevel = typeof prereq.level === 'number' ? prereq.level : prereq.level.level;
      if (reqLevel && characterLevel < reqLevel) return false;
    }
    if (prereq.optionalfeature) {
      for (const of_ of prereq.optionalfeature) {
        const name = of_.split('|')[0].toLowerCase();
        if (!ownedFeatures.has(name)) return false;
      }
    }
    if (prereq.pact) {
      const pactName = `pact of the ${prereq.pact.toLowerCase()}`;
      if (!ownedFeatures.has(pactName)) return false;
    }
    if (prereq.spell) {
      for (const sp of prereq.spell) {
        if (typeof sp === 'string') {
          const spellName = sp.split('#')[0].split('|')[0].toLowerCase();
          if (!spellNames.has(spellName)) return false;
        }
      }
    }
  }
  return true;
}

function formatPrerequisite(prereq: any): string {
  const parts: string[] = [];
  if (prereq.level) {
    const lvl = typeof prereq.level === 'number' ? prereq.level : prereq.level?.level;
    if (lvl) parts.push(`Ур. ${lvl}+`);
  }
  if (prereq.optionalfeature) {
    for (const of_ of prereq.optionalfeature) {
      const name = of_.split('|')[0];
      parts.push(name.split(' ').map((w: string) => w[0].toUpperCase() + w.slice(1)).join(' '));
    }
  }
  if (prereq.pact) {
    parts.push(`Pact of the ${prereq.pact}`);
  }
  if (prereq.spell) {
    for (const sp of prereq.spell) {
      if (typeof sp === 'string') {
        const name = sp.split('#')[0].split('|')[0];
        parts.push(name.split(' ').map((w: string) => w[0].toUpperCase() + w.slice(1)).join(' '));
      } else if (sp.entrySummary) {
        parts.push(sp.entrySummary);
      }
    }
  }
  return parts.join(', ') || 'Есть требования';
}

function cleanEntryRefs(text: string): string {
  return text.replace(/\{@\w+\s+([^|}]+)(?:\|[^}]*)?\}/g, '$1');
}

const FEATURE_IMAGE_OVERRIDES: Record<string, string> = {
  'Agonizing_Blast': 'Agonising_Blast',
  'Armor_of_Shadows': 'Armour_of_Shadows',
  'Careful_Spell': 'Metamagic_Careful_Spell',
  'Distant_Spell': 'Metamagic_Distant_Spell',
  'Extended_Spell': 'Metamagic_Extended_Spell',
  'Heightened_Spell': 'Metamagic_Heightened_Spell',
  'Quickened_Spell': 'Metamagic_Quickened_Spell',
  'Subtle_Spell': 'Metamagic_Subtle_Spell',
  'Twinned_Spell': 'Metamagic_Twinned_Spell',
  'Empowered_Spell': 'Metamagic_Empowered_Spell',
  'Seeking_Spell': 'Metamagic_Seeking_Spell',
  'Transmuted_Spell': 'Metamagic_Transmuted_Spell',
  'Commander_s_Strike': "Commander's_Strike",
  'Disarming_Attack': 'Disarming_Attack_Melee',
  'Distracting_Strike': 'Distracting_Strike_Melee',
  'Goading_Attack': 'Goading_Attack_Melee',
  'Menacing_Attack': 'Menacing_Attack_Melee',
  'Pushing_Attack': 'Pushing_Attack_Melee',
  'Trip_Attack': 'Trip_Attack_Melee',
};

function getFeatureImageUrl(name: string): string {
  const sanitized = name.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = FEATURE_IMAGE_OVERRIDES[sanitized] || sanitized;
  return `/images/misc/${filename}.webp`;
}

function pluralize(n: number, singular: string, few: string, genitive: string): string {
  if (n === 1) return singular;
  if (n >= 2 && n <= 4) return few;
  return genitive;
}

// ── Main Component ──

export function OptionalFeaturePickerModal({
  character,
  config,
  newSlots,
  allowReplace,
  onConfirm,
  onCancel,
}: OptionalFeaturePickerModalProps) {
  const [allFeatures, setAllFeatures] = useState<OptionalFeatureData[]>([]);
  const [loading, setLoading] = useState(true);
  const [entryReady, setEntryReady] = useState(!!_EntryRenderer);
  const [searchQuery, setSearchQuery] = useState('');

  const [selected, setSelected] = useState<OptionalFeatureData[]>([]);
  const [focusedFeature, setFocusedFeature] = useState<OptionalFeatureData | null>(null);

  const [replaceMode, setReplaceMode] = useState(false);
  const [replacedName, setReplacedName] = useState<string | null>(null);
  const [replacement, setReplacement] = useState<OptionalFeatureData | null>(null);

  // Load features by type
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mod = await import('../data/optionalfeatures');
      await mod.init();
      if (cancelled) return;
      const ft = config.featureType;
      const filtered = mod.ALL_OPTIONAL_FEATURES.filter(
        f => f.featureType?.some(t => t === ft || t.startsWith(ft))
      );
      setAllFeatures(filtered);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [config.featureType]);

  useEffect(() => {
    if (!_EntryRenderer) {
      loadEntryRenderer().then(() => setEntryReady(true));
    }
  }, []);

  const ft = config.featureType;

  // Owned features of this type
  const ownedFeatures = useMemo(() => {
    const names = new Set<string>();
    for (const f of character.optionalFeatures ?? []) {
      if (f.featureType === ft) {
        names.add(f.name.toLowerCase());
      }
    }
    return names;
  }, [character.optionalFeatures, ft]);

  // Owned + selected (for prereq checking)
  const allOwnedAndSelected = useMemo(() => {
    const names = new Set(ownedFeatures);
    for (const s of selected) names.add(s.name.toLowerCase());
    if (replacement) names.add(replacement.name.toLowerCase());
    if (replacedName) names.delete(replacedName.toLowerCase());
    return names;
  }, [ownedFeatures, selected, replacement, replacedName]);

  const spellNames = useMemo(() => {
    const names = new Set<string>();
    if (character.spellcasting?.spells) {
      for (const spell of character.spellcasting.spells) {
        names.add(spell.name.toLowerCase());
      }
    }
    return names;
  }, [character.spellcasting?.spells]);

  const takenNames = useMemo(() => {
    const names = new Set<string>();
    for (const f of character.optionalFeatures ?? []) {
      if (f.featureType === ft) names.add(f.name.toLowerCase());
    }
    return names;
  }, [character.optionalFeatures, ft]);

  const eligibleNames = useMemo(() => {
    const names = new Set<string>();
    for (const inv of allFeatures) {
      if (checkPrerequisite(inv, character.level, allOwnedAndSelected, spellNames)) {
        names.add(inv.name);
      }
    }
    return names;
  }, [allFeatures, character.level, allOwnedAndSelected, spellNames]);

  const filteredFeatures = useMemo(() => {
    let list = allFeatures;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(f => f.name.toLowerCase().includes(q));
    }
    return list.sort((a, b) => {
      const aE = eligibleNames.has(a.name) ? 0 : 1;
      const bE = eligibleNames.has(b.name) ? 0 : 1;
      if (aE !== bE) return aE - bE;
      return a.name.localeCompare(b.name);
    });
  }, [allFeatures, eligibleNames, searchQuery]);

  const selectedNames = useMemo(() => {
    const names = new Set<string>();
    for (const s of selected) names.add(s.name);
    if (replacement) names.add(replacement.name);
    return names;
  }, [selected, replacement]);

  const handleToggleSelect = (inv: OptionalFeatureData) => {
    if (replaceMode) {
      if (replacement?.name === inv.name) {
        setReplacement(null);
      } else {
        setReplacement(inv);
      }
      setFocusedFeature(inv);
      return;
    }

    if (selectedNames.has(inv.name)) {
      setSelected(prev => prev.filter(s => s.name !== inv.name));
    } else {
      if (selected.length < newSlots) {
        setSelected(prev => [...prev, inv]);
      }
    }
    setFocusedFeature(inv);
  };

  const handleConfirm = () => {
    if (selected.length !== newSlots) return;
    onConfirm({
      chosen: selected,
      replaced: replacedName ?? undefined,
      replacement: replacement ?? undefined,
    });
  };

  const existingFeatures = useMemo(() => {
    return (character.optionalFeatures ?? []).filter(f => f.featureType === ft);
  }, [character.optionalFeatures, ft]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center">
        <div className="glass-panel p-8 flex items-center gap-3">
          <Loader2 size={24} className="text-gold animate-spin" />
          <span className="text-text-muted">Загрузка...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6">
    <div className="w-full max-w-6xl max-h-[85vh] bg-bg-panel-solid rounded-xl border border-gold/30 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-gold/30 bg-bg-panel-solid/95 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-medieval text-gold flex items-center gap-3">
              <Sparkles className="text-gold" size={24} />
              {config.title} — Уровень {character.level}
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              {newSlots > 0
                ? `Выберите ${newSlots} ${pluralize(newSlots, config.singular, config.pluralFew, config.pluralGenitive)}`
                : `Вы можете заменить ${config.singular}`}
              {allowReplace && newSlots > 0 && ` (можно также заменить ${config.singular})`}
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
      <div className="flex-1 min-h-0 flex gap-4 max-w-6xl mx-auto w-full p-4">
        {/* Left: feature list */}
        <div className="w-72 shrink-0 flex flex-col min-h-0">
          {/* Replace toggle */}
          {allowReplace && existingFeatures.length > 0 && (
            <button
              onClick={() => {
                setReplaceMode(!replaceMode);
                setReplacedName(null);
                setReplacement(null);
              }}
              className={`mb-3 w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                replaceMode
                  ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
                  : 'border-border-default bg-bg-primary/40 text-text-secondary hover:border-border-hover'
              }`}
            >
              <RefreshCw size={14} />
              <span>Заменить {config.singular}</span>
            </button>
          )}

          {/* Replace: pick existing to remove */}
          {replaceMode && (
            <div className="mb-3 space-y-1">
              <div className="text-xs text-text-muted mb-1">Заменить:</div>
              {existingFeatures.map(inv => (
                <button
                  key={inv.name}
                  onClick={() => {
                    setReplacedName(replacedName === inv.name ? null : inv.name);
                    setReplacement(null);
                  }}
                  className={`w-full text-left rounded-lg border p-2 text-sm transition-all ${
                    replacedName === inv.name
                      ? 'border-red-500/50 bg-red-500/10 text-red-400'
                      : 'border-border-default bg-bg-primary/40 text-text-primary hover:border-border-hover'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {replacedName === inv.name && <X size={12} className="text-red-400 shrink-0" />}
                    <span className="truncate">{inv.name}</span>
                  </div>
                </button>
              ))}
              {replacedName && (
                <div className="text-xs text-text-muted mt-1">Теперь выберите замену из списка ниже:</div>
              )}
            </div>
          )}

          {/* Search */}
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={`Поиск...`}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-bg-primary border border-border-default
                text-text-primary placeholder-text-muted focus:border-gold/50 focus:outline-none"
            />
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto space-y-1">
            {filteredFeatures.length === 0 ? (
              <div className="text-center text-text-muted text-sm py-8">
                {searchQuery ? 'Ничего не найдено' : 'Нет доступных опций'}
              </div>
            ) : filteredFeatures.map(inv => {
              const isSelected = selectedNames.has(inv.name);
              const isReplacement = replacement?.name === inv.name;
              const isTaken = !isRepeatable(inv) && takenNames.has(inv.name.toLowerCase());
              const isIneligible = !eligibleNames.has(inv.name);
              const isFull = !replaceMode && selected.length >= newSlots && !isSelected;
              const isDisabled = isTaken || isIneligible || (isFull && !replaceMode) ||
                (replaceMode && !replacedName);

              return (
                <button
                  key={inv.name}
                  onClick={() => !isDisabled && handleToggleSelect(inv)}
                  onMouseEnter={() => setFocusedFeature(inv)}
                  disabled={isDisabled}
                  className={`w-full text-left rounded-lg border p-2.5 transition-all text-sm ${
                    isSelected || isReplacement
                      ? 'border-gold/50 bg-gold/10'
                      : isDisabled
                        ? 'border-border-default/50 bg-bg-primary/20 opacity-40 cursor-not-allowed'
                        : 'border-border-default bg-bg-primary/40 hover:border-border-hover'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {(isSelected || isReplacement) && <Check size={14} className="text-gold shrink-0" />}
                    <img
                      src={getFeatureImageUrl(inv.name)}
                      alt=""
                      className="w-6 h-6 rounded object-cover shrink-0 bg-bg-panel"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <span className={`truncate ${
                      isSelected || isReplacement ? 'text-gold font-medium'
                      : isIneligible ? 'text-red-400/70'
                      : 'text-text-primary'
                    }`}>
                      {inv.name}
                    </span>
                    {isTaken && (
                      <span className="text-[10px] text-text-muted ml-auto shrink-0">уже есть</span>
                    )}
                    {isIneligible && !isTaken && (
                      <span className="text-[10px] text-red-400/60 ml-auto shrink-0">недоступно</span>
                    )}
                    {isRepeatable(inv) && (
                      <span className="text-[10px] text-purple-400/60 ml-auto shrink-0">повторяемое</span>
                    )}
                  </div>
                  {inv.prerequisite && inv.prerequisite.length > 0 && (
                    <div className={`text-[10px] mt-0.5 truncate ${isIneligible ? 'text-red-400/50' : 'text-text-muted'}`}>
                      {formatPrerequisite(inv.prerequisite[0])}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-2 text-xs text-text-muted text-center">
            {filteredFeatures.filter(f => eligibleNames.has(f.name)).length} из {filteredFeatures.length} доступно
          </div>
        </div>

        {/* Middle: detail panel */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {focusedFeature ? (
            <div className="glass-panel p-4 space-y-4">
              <div className="flex items-center gap-3">
                <img
                  src={getFeatureImageUrl(focusedFeature.name)}
                  alt=""
                  className="w-12 h-12 rounded-lg object-cover bg-bg-panel shrink-0"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <div>
                  <h3 className="text-lg font-medieval text-gold">{focusedFeature.name}</h3>
                  {focusedFeature.source && (
                    <div className="text-[10px] text-text-muted mt-0.5">{focusedFeature.source}</div>
                  )}
                  {focusedFeature.prerequisite && focusedFeature.prerequisite.length > 0 && (
                    <div className="text-xs text-text-secondary mt-1">
                      Требования: {formatPrerequisite(focusedFeature.prerequisite[0])}
                    </div>
                  )}
                </div>
              </div>

              {entryReady && _EntryRenderer ? (
                <_EntryRenderer
                  entries={focusedFeature.entries}
                  className="text-sm text-text-secondary leading-relaxed"
                />
              ) : (
                <div className="text-sm text-text-secondary">
                  {focusedFeature.entries?.map((e: any, i: number) => (
                    <p key={i} className="mb-2">
                      {typeof e === 'string' ? cleanEntryRefs(e) : ''}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-text-muted text-sm">
              <BookOpen size={20} className="mr-2 opacity-50" />
              Выберите опцию из списка слева
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <CharacterStatsSidebar character={character} showCombatStats classIconSrc={`/images/classes/${character.classId}.webp`} />
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-gold/30 bg-bg-panel-solid/95 px-6 py-4">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="text-sm text-text-secondary">
            {newSlots > 0 ? (
              <span>
                Выбрано: <span className={`font-bold ${selected.length === newSlots ? 'text-green-400' : 'text-gold'}`}>
                  {selected.length}/{newSlots}
                </span>
              </span>
            ) : (
              <span className="text-text-muted">Замена (необязательно)</span>
            )}
            {replaceMode && replacedName && replacement && (
              <span className="ml-3 text-amber-400">
                {replacedName} → {replacement.name}
              </span>
            )}
          </div>
          <div className="flex gap-3">
            {newSlots === 0 && (
              <button
                onClick={() => onConfirm({ chosen: [], replaced: undefined, replacement: undefined })}
                className="px-6 py-2.5 rounded-lg border border-border-default text-text-secondary
                  hover:border-border-hover hover:text-text-primary transition-all font-medieval"
              >
                Пропустить
              </button>
            )}
            <button
              onClick={handleConfirm}
              disabled={selected.length !== newSlots}
              className="px-8 py-2.5 rounded-lg bg-gold/20 text-gold border border-gold/30 font-medieval font-semibold text-lg
                hover:bg-gold/30 transition-all gold-glow disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-gold/20"
            >
              Подтвердить
            </button>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}

// Backward-compatible alias
export const InvocationPickerModal = OptionalFeaturePickerModal;
