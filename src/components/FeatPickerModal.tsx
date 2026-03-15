import React, { useState, useEffect, useMemo } from 'react';
import type { Character, AbilityScores } from '../types';
import { type FeatData, getFeatImageUrl } from '../data/feats';
import { getAbilityModifier, ABILITY_NAMES, ABILITY_SHORT, ABILITY_SHORT_TO_LONG } from '../utils/dnd';
import { checkFeatPrerequisite, buildFeatContext } from '../utils/featPrerequisites';
import { Search, Check, X, Loader2, Sparkles, BookOpen } from 'lucide-react';
import { TabBar, type Tab, CharacterStatsSidebar } from './ui';

// ── Types ──

type FeatPickerMode = 'asi' | 'epicBoon' | 'fightingStyle';
type PickerTab = 'asi' | 'feat';

export interface FeatPickerResult {
  type: 'asi' | 'feat';
  asiChanges?: Partial<AbilityScores>;
  feat?: FeatData;
  abilityChoice?: Partial<AbilityScores>;
}

interface FeatPickerModalProps {
  character: Character;
  mode: FeatPickerMode;
  onConfirm: (result: FeatPickerResult) => void;
  onCancel: () => void;
}

// ── Constants ──

const ABILITY_KEYS: (keyof AbilityScores)[] = [
  'strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma',
];

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

// ── Main Component ──

export function FeatPickerModal({ character, mode, onConfirm, onCancel }: FeatPickerModalProps) {
  const isFightingStyle = mode === 'fightingStyle';
  const [activeTab, setActiveTab] = useState<PickerTab>(isFightingStyle ? 'feat' : 'asi');
  const [allFeats, setAllFeats] = useState<FeatData[]>([]);
  const [featsLoading, setFeatsLoading] = useState(true);
  const [entryReady, setEntryReady] = useState(!!_EntryRenderer);
  const [searchQuery, setSearchQuery] = useState('');

  // ASI state
  const [asiChanges, setAsiChanges] = useState<Partial<AbilityScores>>({});

  // Feat selection state
  const [selectedFeat, setSelectedFeat] = useState<FeatData | null>(null);
  const [featAbilityChoice, setFeatAbilityChoice] = useState<Partial<AbilityScores>>({});

  const maxScore = 30;
  const category = mode === 'epicBoon' ? 'EB' : isFightingStyle ? 'FS' : 'G';
  const categoryLabel = mode === 'epicBoon' ? 'Эпическое благо' : isFightingStyle ? 'Боевой стиль' : 'Общая черта';

  // Load feats
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mod = await import('../data/feats');
      await mod.init();
      if (cancelled) return;
      setAllFeats([...mod.ALL_FEATS]);
      setFeatsLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Load EntryRenderer
  useEffect(() => {
    if (!_EntryRenderer) {
      loadEntryRenderer().then(() => setEntryReady(true));
    }
  }, []);

  // Build feat check context
  const featCtx = useMemo(() => {
    return buildFeatContext(
      character.level,
      character.abilityScores,
      character.race,
      !!character.spellcasting,
      character.features,
      character.feats,
    );
  }, [character]);

  // All category feats (excluding ASI)
  const categoryFeats = useMemo(() => {
    return allFeats.filter(feat => {
      if (isFightingStyle) {
        // FS = generic, FS:P = paladin-only, FS:R = ranger-only
        if (!feat.category || !feat.category.startsWith('FS')) return false;
        if (feat.category === 'FS') return true;
        const suffix = feat.category.split(':')[1];
        if (suffix === 'P' && character.classId === 'paladin') return true;
        if (suffix === 'R' && character.classId === 'ranger') return true;
        return false;
      }
      if (feat.category !== category) return false;
      if (feat.name === 'Ability Score Improvement') return false;
      return true;
    });
  }, [allFeats, category, isFightingStyle, character.classId]);

  // Set of eligible feat names (in fightingStyle mode all are eligible)
  const eligibleFeatNames = useMemo(() => {
    const names = new Set<string>();
    for (const feat of categoryFeats) {
      if (isFightingStyle || checkFeatPrerequisite(featCtx, feat)) {
        names.add(feat.name);
      }
    }
    return names;
  }, [categoryFeats, featCtx, isFightingStyle]);

  // Search filter + sort: eligible first, then ineligible
  const filteredFeats = useMemo(() => {
    let feats = categoryFeats;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      feats = feats.filter(f => f.name.toLowerCase().includes(q));
    }
    return feats.sort((a, b) => {
      const aEligible = eligibleFeatNames.has(a.name) ? 0 : 1;
      const bEligible = eligibleFeatNames.has(b.name) ? 0 : 1;
      if (aEligible !== bEligible) return aEligible - bEligible;
      return a.name.localeCompare(b.name);
    });
  }, [categoryFeats, eligibleFeatNames, searchQuery]);

  // Already taken feats (non-repeatable check)
  const takenFeatNames = useMemo(() => {
    const names = new Set<string>();
    for (const f of character.features) names.add(f.name.toLowerCase());
    for (const f of character.feats ?? []) names.add(f.name.toLowerCase());
    return names;
  }, [character]);

  // ASI logic
  const asiTotal = useMemo(() => {
    return Object.values(asiChanges).reduce((s, v) => s + (v || 0), 0);
  }, [asiChanges]);

  const handleAsiChange = (ability: keyof AbilityScores, delta: number) => {
    setAsiChanges(prev => {
      const current = prev[ability] || 0;
      const newVal = current + delta;
      if (newVal < 0) return prev;
      // Can't exceed +2 per ability
      if (newVal > 2) return prev;
      // Total points: max 2
      const currentTotal = Object.values(prev).reduce((s, v) => s + (v || 0), 0);
      if (currentTotal + delta > 2) return prev;
      // Check max score limit
      if (character.abilityScores[ability] + newVal > maxScore) return prev;
      return { ...prev, [ability]: newVal === 0 ? undefined : newVal };
    });
  };

  // Feat ability choice logic
  const featAbilityOptions = useMemo<string[]>(() => {
    if (!selectedFeat?.ability) return [];
    for (const abilityEntry of selectedFeat.ability) {
      if (abilityEntry.choose?.from) {
        return abilityEntry.choose.from;
      }
    }
    return [];
  }, [selectedFeat]);

  const featAbilityMax = useMemo<number>(() => {
    if (!selectedFeat?.ability) return 20;
    for (const abilityEntry of selectedFeat.ability) {
      if (abilityEntry.max) return abilityEntry.max;
    }
    return 20;
  }, [selectedFeat]);

  const featAbilityAmount = useMemo<number>(() => {
    if (!selectedFeat?.ability) return 1;
    for (const abilityEntry of selectedFeat.ability) {
      if (abilityEntry.choose?.amount) return abilityEntry.choose.amount;
    }
    return 1;
  }, [selectedFeat]);

  const handleFeatAbilityChange = (shortKey: string) => {
    const longKey = ABILITY_SHORT_TO_LONG[shortKey];
    if (!longKey) return;
    setFeatAbilityChoice(prev => {
      if (prev[longKey]) {
        // Remove
        const next = { ...prev };
        delete next[longKey];
        return next;
      }
      // Add — check if we've reached the limit
      const count = Object.keys(prev).length;
      if (count >= 1) {
        // Replace (single choice)
        return { [longKey]: featAbilityAmount };
      }
      return { ...prev, [longKey]: featAbilityAmount };
    });
  };

  // Can confirm
  const canConfirmAsi = asiTotal === 2;
  const canConfirmFeat = selectedFeat !== null && (
    featAbilityOptions.length === 0 || Object.keys(featAbilityChoice).length === 1
  );

  const handleConfirm = () => {
    if (activeTab === 'asi') {
      if (!canConfirmAsi) return;
      onConfirm({ type: 'asi', asiChanges });
    } else {
      if (!canConfirmFeat || !selectedFeat) return;
      onConfirm({
        type: 'feat',
        feat: selectedFeat,
        abilityChoice: featAbilityOptions.length > 0 ? featAbilityChoice : undefined,
      });
    }
  };

  const tabs: Tab[] = [
    { key: 'asi', label: 'Улучшение характеристик' },
    { key: 'feat', label: categoryLabel },
  ];

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6">
    <div className="w-full max-w-6xl max-h-[85vh] bg-bg-panel-solid rounded-xl border border-gold/30 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-gold/30 bg-bg-panel-solid/95 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-medieval text-gold flex items-center gap-3">
              <Sparkles className="text-gold" size={24} />
              {isFightingStyle
                ? `Боевой стиль — Уровень ${character.level}`
                : mode === 'epicBoon' ? 'Эпическое благо — Уровень 19' : `Улучшение — Уровень ${character.level}`}
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              {isFightingStyle
                ? 'Выберите боевой стиль'
                : 'Выберите улучшение характеристик (+2/+1) или черту'}
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

      {/* Tabs (hidden in fightingStyle mode) */}
      {!isFightingStyle && (
        <div className="shrink-0 bg-bg-panel-solid/90">
          <div className="max-w-6xl mx-auto">
            <TabBar tabs={tabs} activeTab={activeTab} onTabChange={(k) => setActiveTab(k as PickerTab)} size="md" />
          </div>
        </div>
      )}

      {/* Content + Sidebar */}
      <div className="flex-1 min-h-0 flex gap-4 max-w-6xl mx-auto w-full p-4">
        {/* Left content */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
          {activeTab === 'asi' ? (
            <AsiTab
              character={character}
              asiChanges={asiChanges}
              maxScore={maxScore}
              asiTotal={asiTotal}
              onAsiChange={handleAsiChange}
            />
          ) : (
            <FeatTab
              feats={filteredFeats}
              loading={featsLoading}
              selectedFeat={selectedFeat}
              onSelectFeat={(f) => { setSelectedFeat(f); setFeatAbilityChoice({}); }}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              takenFeatNames={takenFeatNames}
              eligibleFeatNames={eligibleFeatNames}
              entryReady={entryReady}
              featAbilityOptions={featAbilityOptions}
              featAbilityChoice={featAbilityChoice}
              featAbilityMax={featAbilityMax}
              featAbilityAmount={featAbilityAmount}
              onFeatAbilityChange={handleFeatAbilityChange}
              character={character}
            />
          )}
        </div>

        {/* Right Sidebar */}
        <CharacterStatsSidebar character={character} showCombatStats classIconSrc={`/images/classes/${character.classId}.webp`} />
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-gold/30 bg-bg-panel-solid/95 px-6 py-4">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="text-sm text-text-secondary">
            {activeTab === 'asi' ? (
              asiTotal > 0 ? `Распределено: ${asiTotal}/2` : 'Распределите 2 очка'
            ) : (
              selectedFeat ? (
                <span>Выбрано: <span className="text-gold font-semibold">{selectedFeat.name}</span></span>
              ) : isFightingStyle ? 'Выберите боевой стиль' : 'Выберите черту'
            )}
          </div>
          <button
            onClick={handleConfirm}
            disabled={activeTab === 'asi' ? !canConfirmAsi : !canConfirmFeat}
            className="px-8 py-2.5 rounded-lg bg-gold/20 text-gold border border-gold/30 font-medieval font-semibold text-lg
              hover:bg-gold/30 transition-all gold-glow disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-gold/20"
          >
            Подтвердить
          </button>
        </div>
      </div>
    </div>
    </div>
  );
}

// ── ASI Tab ──

function AsiTab({
  character,
  asiChanges,
  maxScore,
  asiTotal,
  onAsiChange,
}: {
  character: Character;
  asiChanges: Partial<AbilityScores>;
  maxScore: number;
  asiTotal: number;
  onAsiChange: (ability: keyof AbilityScores, delta: number) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="glass-panel p-4">
        <h3 className="text-base font-medieval text-gold mb-1">Улучшение характеристик</h3>
        <p className="text-xs text-text-muted mb-4">
          Распределите 2 очка между характеристиками. Максимум +2 на одну, максимум {maxScore} итого.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ABILITY_KEYS.map(ability => {
            const current = character.abilityScores[ability];
            const bonus = asiChanges[ability] || 0;
            const final = current + bonus;
            const canIncrease = asiTotal < 2 && bonus < 2 && final < maxScore;
            const canDecrease = bonus > 0;

            return (
              <div
                key={ability}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                  bonus > 0
                    ? 'border-gold/40 bg-gold/5'
                    : 'border-border-default bg-bg-primary/40'
                }`}
              >
                <div className="flex-1">
                  <div className="text-sm font-medium text-text-primary">
                    {ABILITY_NAMES[ability]}
                  </div>
                  <div className="text-xs text-text-muted">
                    {ABILITY_SHORT[ability]} • {current}
                    {bonus > 0 && (
                      <span className="text-gold ml-1">→ {final}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onAsiChange(ability, -1)}
                    disabled={!canDecrease}
                    className="w-7 h-7 rounded border border-border-default text-text-secondary hover:text-text-primary
                      hover:border-border-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm font-bold"
                  >
                    −
                  </button>
                  <span className={`w-8 text-center font-bold tabular-nums ${
                    bonus > 0 ? 'text-gold' : 'text-text-muted'
                  }`}>
                    +{bonus}
                  </span>
                  <button
                    onClick={() => onAsiChange(ability, 1)}
                    disabled={!canIncrease}
                    className="w-7 h-7 rounded border border-gold/30 bg-gold/10 text-gold
                      hover:bg-gold/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm font-bold"
                  >
                    +
                  </button>
                </div>

                <div className="w-10 text-right">
                  <span className="text-lg font-bold text-text-primary">{final}</span>
                  <div className="text-[10px] text-text-muted">
                    {getAbilityModifier(final) >= 0 ? '+' : ''}{getAbilityModifier(final)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-3 text-center text-sm">
          <span className={`font-bold ${asiTotal === 2 ? 'text-green-400' : 'text-gold'}`}>
            {asiTotal}/2
          </span>
          <span className="text-text-muted ml-1">очков распределено</span>
        </div>
      </div>
    </div>
  );
}

// ── Feat Tab ──

function FeatTab({
  feats,
  loading,
  selectedFeat,
  onSelectFeat,
  searchQuery,
  onSearchChange,
  takenFeatNames,
  eligibleFeatNames,
  entryReady,
  featAbilityOptions,
  featAbilityChoice,
  featAbilityMax,
  featAbilityAmount,
  onFeatAbilityChange,
  character,
}: {
  feats: FeatData[];
  loading: boolean;
  selectedFeat: FeatData | null;
  onSelectFeat: (feat: FeatData) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  takenFeatNames: Set<string>;
  eligibleFeatNames: Set<string>;
  entryReady: boolean;
  featAbilityOptions: string[];
  featAbilityChoice: Partial<AbilityScores>;
  featAbilityMax: number;
  featAbilityAmount: number;
  onFeatAbilityChange: (shortKey: string) => void;
  character: Character;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="text-gold animate-spin" />
        <span className="ml-2 text-text-muted">Загрузка черт...</span>
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-full min-h-0">
      {/* Left: feat list */}
      <div className="w-72 shrink-0 flex flex-col min-h-0">
        {/* Search */}
        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Поиск черты..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-bg-primary border border-border-default
              text-text-primary placeholder-text-muted focus:border-gold/50 focus:outline-none"
          />
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto space-y-1">
          {feats.length === 0 ? (
            <div className="text-center text-text-muted text-sm py-8">
              {searchQuery ? 'Ничего не найдено' : 'Нет доступных черт'}
            </div>
          ) : feats.map(feat => {
            const isSelected = selectedFeat?.name === feat.name;
            const isTaken = !feat.repeatable && takenFeatNames.has(feat.name.toLowerCase());
            const isIneligible = !eligibleFeatNames.has(feat.name);
            const isDisabled = isTaken || isIneligible;
            return (
              <button
                key={feat.name}
                onClick={() => !isDisabled && onSelectFeat(feat)}
                disabled={isDisabled}
                className={`w-full text-left rounded-lg border p-2.5 transition-all text-sm ${
                  isSelected
                    ? 'border-gold/50 bg-gold/10'
                    : isDisabled
                      ? 'border-border-default/50 bg-bg-primary/20 opacity-40 cursor-not-allowed'
                      : 'border-border-default bg-bg-primary/40 hover:border-border-hover'
                }`}
              >
                <div className="flex items-center gap-2">
                  {isSelected && <Check size={14} className="text-gold shrink-0" />}
                  <img
                    src={getFeatImageUrl(feat.name)}
                    alt=""
                    className="w-6 h-6 rounded object-cover shrink-0 bg-bg-panel"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <span className={`truncate ${
                    isSelected ? 'text-gold font-medium'
                    : isIneligible ? 'text-red-400/70'
                    : 'text-text-primary'
                  }`}>
                    {feat.name}
                  </span>
                  {isTaken && (
                    <span className="text-[10px] text-text-muted ml-auto shrink-0">уже есть</span>
                  )}
                  {isIneligible && !isTaken && (
                    <span className="text-[10px] text-red-400/60 ml-auto shrink-0">недоступно</span>
                  )}
                </div>
                {feat.prerequisite && feat.prerequisite.length > 0 && (
                  <div className={`text-[10px] mt-0.5 truncate ${isIneligible ? 'text-red-400/50' : 'text-text-muted'}`}>
                    {formatPrerequisite(feat.prerequisite[0])}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-2 text-xs text-text-muted text-center">
          {feats.filter(f => eligibleFeatNames.has(f.name)).length} из {feats.length} {feats.length === 1 ? 'черта' : feats.length < 5 ? 'черты' : 'черт'} доступно
        </div>
      </div>

      {/* Right: feat detail */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {selectedFeat ? (
          <div className="glass-panel p-4 space-y-4">
            <div className="flex items-center gap-3">
              <img
                src={getFeatImageUrl(selectedFeat.name)}
                alt=""
                className="w-12 h-12 rounded-lg object-cover bg-bg-panel shrink-0"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <div>
                <h3 className="text-lg font-medieval text-gold">{selectedFeat.name}</h3>
                {selectedFeat.source && (
                  <div className="text-[10px] text-text-muted mt-0.5">{selectedFeat.source}</div>
                )}
              </div>
            </div>

            {/* Entries */}
            {entryReady && _EntryRenderer ? (
              <_EntryRenderer
                entries={selectedFeat.entries}
                className="text-sm text-text-secondary leading-relaxed"
              />
            ) : (
              <div className="text-sm text-text-secondary">
                {selectedFeat.entries?.map((e: any, i: number) => (
                  <p key={i} className="mb-2">
                    {typeof e === 'string' ? cleanEntryRefs(e) : JSON.stringify(e)}
                  </p>
                ))}
              </div>
            )}

            {/* Ability choice */}
            {featAbilityOptions.length > 0 && (
              <div className="border-t border-border-default pt-3">
                <h4 className="text-sm font-medium text-text-primary mb-2">
                  Выберите характеристику (+{featAbilityAmount}, макс. {featAbilityMax})
                </h4>
                <div className="flex flex-wrap gap-2">
                  {featAbilityOptions.map(shortKey => {
                    const longKey = ABILITY_SHORT_TO_LONG[shortKey];
                    if (!longKey) return null;
                    const isChosen = !!featAbilityChoice[longKey];
                    const currentScore = character.abilityScores[longKey];
                    const wouldExceed = currentScore + featAbilityAmount > featAbilityMax;

                    return (
                      <button
                        key={shortKey}
                        onClick={() => onFeatAbilityChange(shortKey)}
                        disabled={wouldExceed && !isChosen}
                        className={`px-3 py-2 rounded-lg border text-sm transition-all ${
                          isChosen
                            ? 'border-gold/50 bg-gold/10 text-gold'
                            : wouldExceed
                              ? 'border-border-default/50 text-text-muted opacity-50 cursor-not-allowed'
                              : 'border-border-default bg-bg-primary/40 text-text-primary hover:border-border-hover'
                        }`}
                      >
                        <div className="font-medium">{ABILITY_SHORT[longKey]}</div>
                        <div className="text-[10px] text-text-muted">
                          {currentScore}
                          {isChosen && <span className="text-gold"> → {currentScore + featAbilityAmount}</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-text-muted text-sm">
            <BookOpen size={20} className="mr-2 opacity-50" />
            Выберите черту из списка слева
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helpers ──

function cleanEntryRefs(text: string): string {
  return text.replace(/\{@\w+\s+([^|}]+)(?:\|[^}]*)?\}/g, '$1');
}

function formatPrerequisite(prereq: any): string {
  const parts: string[] = [];
  if (prereq.level) {
    const lvl = typeof prereq.level === 'number' ? prereq.level : prereq.level?.level;
    if (lvl) parts.push(`Ур. ${lvl}+`);
  }
  if (prereq.ability) {
    for (const ab of prereq.ability) {
      for (const [k, v] of Object.entries(ab)) {
        const longKey = ABILITY_SHORT_TO_LONG[k];
        if (longKey && typeof v === 'number') {
          parts.push(`${ABILITY_SHORT[longKey]} ${v}+`);
        }
      }
    }
  }
  if (prereq.spellcasting2020) parts.push('Заклинатель');
  if (prereq.race) {
    parts.push(prereq.race.map((r: any) => r.name).join('/'));
  }
  return parts.join(', ') || 'Есть требования';
}
