import React, { useState, useEffect, Suspense, lazy } from 'react';
import type { Character, AbilityScores, CharacterSpell, SpellSlots } from '../types';
import { getAbilityModifier, formatModifier, getProficiencyBonus, getSkillBonus, ABILITY_NAMES, ABILITY_SHORT, SKILL_ABILITIES, SKILL_NAMES, recalcDerivedStats } from '../utils/dnd';
import { CLASS_REGISTRY, getClassById } from '../data/classes';
import { Heart, Shield, Zap, Coins, Backpack, ArrowUp, X, ScrollText, Wand2, ChevronLeft, ChevronRight, ChevronDown, Sparkles, BookOpen, Dices, Calculator, Target, Check } from 'lucide-react';
import { InventoryGrid } from './InventoryGrid';
import { SpellLevelUpModal, type LevelTableRow } from './SpellLevelUpModal';
import { FeatPickerModal, type FeatPickerResult } from './FeatPickerModal';
import { TabBar, type Tab, CharacterStatsSidebar } from './ui';
import type { SubclassJsonData } from '../data/classes/subclassJsonLoader';
import { getRaceByName } from '../data/races';

// Ленивая загрузка SpellsTab (тянет за собой spells + entryRenderer + registry)
const LazySpellsTab = lazy(() => import('./SpellsTab').then(m => ({ default: m.SpellsTab })));

type SheetTab = 'stats' | 'inventory' | 'spells';

interface CharacterSheetProps {
  character: Character;
  onUpdate: (character: Character) => void;
}

export const CharacterSheet: React.FC<CharacterSheetProps> = ({ character, onUpdate }) => {
  const [showSubclassModal, setShowSubclassModal] = useState(false);
  const [showSpellLevelUp, setShowSpellLevelUp] = useState(false);
  const [showHpChoiceModal, setShowHpChoiceModal] = useState(false);
  const [pendingHpChoice, setPendingHpChoice] = useState<{
    newLevel: number;
    subclass?: string;
  } | null>(null);
  const [pendingLevelUp, setPendingLevelUp] = useState<{
    newLevel: number;
    updatedChar: Character;
    oldData: LevelTableRow;
    newData: LevelTableRow;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<SheetTab>('stats');
  const [showFeatPicker, setShowFeatPicker] = useState(false);
  const [pendingFeatLevelUp, setPendingFeatLevelUp] = useState<{
    updatedChar: Character;
    mode: 'asi' | 'epicBoon';
  } | null>(null);

  const classDef = character.classId ? getClassById(character.classId) : CLASS_REGISTRY.find(c => c.name === character.class);

  const updateHP = (current: number) => {
    onUpdate({
      ...character,
      hitPoints: { ...character.hitPoints, current: Math.max(0, Math.min(current, character.hitPoints.max)) }
    });
  };

  const updateTempHP = (temporary: number) => {
    onUpdate({
      ...character,
      hitPoints: { ...character.hitPoints, temporary: Math.max(0, temporary) }
    });
  };

  const handleLevelUp = () => {
    if (character.level >= 20) return;

    const newLevel = character.level + 1;

    // If reaching level 3 and no subclass — need to pick one first
    if (newLevel === 3 && !character.subclass && classDef && classDef.subclasses.length > 0) {
      setShowSubclassModal(true);
      return;
    }

    // Show HP choice modal before applying level-up
    setPendingHpChoice({ newLevel });
    setShowHpChoiceModal(true);
  };

  const handleHpChoice = (hpGain: number) => {
    if (!pendingHpChoice) return;
    setShowHpChoiceModal(false);
    applyLevelUp(pendingHpChoice.newLevel, pendingHpChoice.subclass, hpGain);
    setPendingHpChoice(null);
  };

  const buildUpdatedChar = (newLevel: number, hpGain: number, subclass?: string): Character => {
    const newProfBonus = getProficiencyBonus(newLevel);

    const updated: Character = {
      ...character,
      level: newLevel,
      hitPoints: {
        ...character.hitPoints,
        max: character.hitPoints.max + hpGain,
        current: character.hitPoints.current + hpGain,
      },
      hitDice: {
        ...character.hitDice,
        total: newLevel,
      },
      proficiencyBonus: newProfBonus,
      updatedAt: new Date().toISOString(),
    };

    if (subclass) {
      updated.subclass = subclass;
    }

    // Update spellcasting stats if applicable
    if (updated.spellcasting) {
      const abilityMod = getAbilityModifier(updated.abilityScores[updated.spellcasting.ability]);
      updated.spellcasting = {
        ...updated.spellcasting,
        spellSaveDC: 8 + newProfBonus + abilityMod,
        spellAttackBonus: newProfBonus + abilityMod,
      };
    }

    return updated;
  };

  const applyLevelUp = async (newLevel: number, subclass?: string, hpGain?: number) => {
    // If hpGain not provided (e.g. from subclass flow), show HP choice modal
    if (hpGain === undefined) {
      setPendingHpChoice({ newLevel, subclass });
      setShowHpChoiceModal(true);
      setShowSubclassModal(false);
      return;
    }
    const updated = buildUpdatedChar(newLevel, hpGain, subclass);

    // Проверяем изменения в заклинаниях через levelTable
    if (updated.spellcasting && classDef?.spellcaster) {
      try {
        const mod = await import('../data/classes/classJsonLoader');
        await mod.init();
        const classData = mod.getClassDataByName(character.class);
        if (classData?.levelTable) {
          const oldData = classData.levelTable.find((r: any) => r.level === character.level) as LevelTableRow | undefined;
          const newData = classData.levelTable.find((r: any) => r.level === newLevel) as LevelTableRow | undefined;

          if (oldData && newData) {
            const cantripsGain = (newData.cantrips ?? 0) - (oldData.cantrips ?? 0);
            const spellsGain = (newData.preparedSpells ?? 0) - (oldData.preparedSpells ?? 0);

            if (cantripsGain > 0 || spellsGain > 0) {
              // Нужно выбрать новые заклинания — показываем модал
              setPendingLevelUp({ newLevel, updatedChar: updated, oldData, newData });
              setShowSpellLevelUp(true);
              setShowSubclassModal(false);
              return;
            }

            // Нет новых заклинаний, но обновляем слоты
            if (newData.spellSlots) {
              const slots = newData.spellSlots as number[];
              updated.spellcasting = {
                ...updated.spellcasting!,
                spellSlots: {
                  level1: { total: slots[0] || 0, used: updated.spellcasting.spellSlots?.level1?.used || 0 },
                  level2: { total: slots[1] || 0, used: updated.spellcasting.spellSlots?.level2?.used || 0 },
                  level3: { total: slots[2] || 0, used: updated.spellcasting.spellSlots?.level3?.used || 0 },
                  level4: { total: slots[3] || 0, used: updated.spellcasting.spellSlots?.level4?.used || 0 },
                  level5: { total: slots[4] || 0, used: updated.spellcasting.spellSlots?.level5?.used || 0 },
                  level6: { total: slots[5] || 0, used: updated.spellcasting.spellSlots?.level6?.used || 0 },
                  level7: { total: slots[6] || 0, used: updated.spellcasting.spellSlots?.level7?.used || 0 },
                  level8: { total: slots[7] || 0, used: updated.spellcasting.spellSlots?.level8?.used || 0 },
                  level9: { total: slots[8] || 0, used: updated.spellcasting.spellSlots?.level9?.used || 0 },
                },
                cantripsKnown: newData.cantrips ?? updated.spellcasting.cantripsKnown,
                spellsKnown: newData.preparedSpells ?? updated.spellcasting.spellsKnown,
              };
            }
          }
        }
      } catch (e) {
        console.warn('Failed to load class level table:', e);
      }
    }

    // Check if this level grants ASI or Epic Boon
    if (checkAndShowFeatPicker(updated)) return;

    onUpdate(updated);
    setShowSubclassModal(false);
  };

  /** Check if the character's current level grants ASI/EB and show picker if so. Returns true if picker shown. */
  const checkAndShowFeatPicker = (updated: Character): boolean => {
    // Load class data to check features at this level
    const classData = classDef;
    if (!classData) return false;

    // We need to check the levelTable — but it's async. Let's do it inline.
    // Actually, use the classLevelTable from classJsonLoader
    (async () => {
      try {
        const mod = await import('../data/classes/classJsonLoader');
        await mod.init();
        const data = mod.getClassDataByName(updated.class);
        if (!data?.levelTable) return;
        const levelRow = data.levelTable.find((r: any) => r.level === updated.level);
        const features: string[] = levelRow?.features ?? [];
        const hasASI = features.includes('Ability Score Improvement');
        const hasEB = features.includes('Epic Boon');
        if (hasASI || hasEB) {
          setPendingFeatLevelUp({
            updatedChar: updated,
            mode: hasEB ? 'epicBoon' : 'asi',
          });
          setShowFeatPicker(true);
        } else {
          onUpdate(updated);
        }
      } catch (e) {
        console.warn('Failed to check ASI/EB:', e);
        onUpdate(updated);
      }
    })();
    return true; // Always return true to prevent immediate onUpdate — the async handler will call it
  };

  const handleFeatPickerConfirm = (result: FeatPickerResult) => {
    if (!pendingFeatLevelUp) return;
    let updated = { ...pendingFeatLevelUp.updatedChar };

    if (result.type === 'asi' && result.asiChanges) {
      // Apply ASI
      const newScores = { ...updated.abilityScores };
      for (const [key, delta] of Object.entries(result.asiChanges)) {
        if (delta) {
          newScores[key as keyof AbilityScores] += delta;
        }
      }
      updated = { ...updated, abilityScores: newScores };
      // Add to feats list
      updated.feats = [
        ...(updated.feats ?? []),
        {
          name: 'Ability Score Improvement',
          source: 'XPHB',
          category: pendingFeatLevelUp.mode === 'epicBoon' ? 'EB' : 'G',
          levelAcquired: updated.level,
          abilityBonuses: result.asiChanges,
        },
      ];
    } else if (result.type === 'feat' && result.feat) {
      // Apply feat ability bonus
      if (result.abilityChoice) {
        const newScores = { ...updated.abilityScores };
        for (const [key, delta] of Object.entries(result.abilityChoice)) {
          if (delta) {
            newScores[key as keyof AbilityScores] += delta;
          }
        }
        updated = { ...updated, abilityScores: newScores };
      }
      // Add feat to features and feats
      updated.features = [
        ...updated.features,
        {
          id: `feat-${result.feat.name.toLowerCase().replace(/\s+/g, '-')}-${updated.level}`,
          name: result.feat.name,
          description: result.feat.entries?.map((e: any) =>
            typeof e === 'string' ? e : ''
          ).filter(Boolean).join('\n') || '',
          source: result.feat.source,
        },
      ];
      updated.feats = [
        ...(updated.feats ?? []),
        {
          name: result.feat.name,
          source: result.feat.source,
          category: result.feat.category || pendingFeatLevelUp.mode === 'epicBoon' ? 'EB' : 'G',
          levelAcquired: updated.level,
          abilityBonuses: result.abilityChoice,
        },
      ];
    }

    // Recalc derived stats (spell DC, attack bonus)
    recalcDerivedStats(updated);

    onUpdate(updated);
    setShowFeatPicker(false);
    setPendingFeatLevelUp(null);
    setShowSubclassModal(false);
  };

  const handleSpellLevelUpConfirm = (newSpells: CharacterSpell[], updatedSlots: SpellSlots) => {
    if (!pendingLevelUp) return;
    const { updatedChar, newData } = pendingLevelUp;

    const final: Character = {
      ...updatedChar,
      spellcasting: {
        ...updatedChar.spellcasting!,
        spells: [...updatedChar.spellcasting!.spells, ...newSpells],
        spellSlots: updatedSlots,
        cantripsKnown: newData.cantrips ?? updatedChar.spellcasting!.cantripsKnown,
        spellsKnown: newData.preparedSpells ?? updatedChar.spellcasting!.spellsKnown,
      },
    };

    setShowSpellLevelUp(false);
    setPendingLevelUp(null);

    // After spells, check for ASI/EB
    checkAndShowFeatPicker(final);
  };

  const handleSpellLevelUpCancel = () => {
    setShowSpellLevelUp(false);
    setPendingLevelUp(null);
  };

  const handleSubclassSelect = (subclassName: string) => {
    applyLevelUp(character.level + 1, subclassName);
  };

  const canLevelUp = character.level < 20;
  const needsSubclass = character.level === 2 && !character.subclass && classDef && classDef.subclasses.length > 0;

  const sheetTabs: Tab[] = [
    { key: 'stats', label: 'Характеристики', icon: ScrollText },
    { key: 'inventory', label: 'Инвентарь', icon: Backpack },
    ...(character.spellcasting
      ? [{ key: 'spells', label: 'Заклинания', icon: Wand2 } as Tab]
      : []),
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Compact Header */}
      <div className="shrink-0 px-4 py-3 flex items-center justify-between border-b border-border-default">
        <div>
          <h1 className="text-2xl font-medieval text-gold">{character.name}</h1>
          <p className="text-sm text-text-secondary">
            {character.race} {character.class}{character.subclass ? ` — ${character.subclass}` : ''} {character.level} ур.
          </p>
        </div>
        {canLevelUp && (
          <button
            onClick={handleLevelUp}
            className="flex items-center gap-2 px-4 py-2 bg-gold/20 text-gold border border-gold/30 rounded-lg hover:bg-gold/30 font-semibold transition-colors text-sm"
          >
            <ArrowUp size={16} />
            {needsSubclass ? 'Ур. 3 (подкласс)' : `Уровень ${character.level + 1}`}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="shrink-0">
        <TabBar
          tabs={sheetTabs}
          activeTab={activeTab}
          onTabChange={(key) => setActiveTab(key as SheetTab)}
          size="md"
        />
      </div>

      {/* Content + Sidebar */}
      <div className="flex flex-1 min-h-0 gap-4 p-4">
        {/* Left content — changes per tab */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
          {/* Tab: Inventory */}
          {activeTab === 'inventory' && (
            <InventoryGrid character={character} onUpdate={onUpdate} />
          )}

          {/* Tab: Spells */}
          {activeTab === 'spells' && character.spellcasting && (
            <Suspense fallback={<div className="text-center text-text-muted py-8">Загрузка заклинаний...</div>}>
              <LazySpellsTab character={character} />
            </Suspense>
          )}

          {/* Tab: Stats */}
          {activeTab === 'stats' && (
            <>
              {/* HP Management */}
              <div className="glass-panel p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Heart className="text-red-bright" size={20} />
                  <h2 className="text-lg font-medieval text-gold">Хиты</h2>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => updateHP(character.hitPoints.current - 1)}
                    className="px-3 py-1.5 bg-red-accent/80 text-white rounded hover:bg-red-accent transition-colors text-sm"
                  >−</button>
                  <input
                    type="number"
                    value={character.hitPoints.current}
                    onChange={(e) => updateHP(parseInt(e.target.value) || 0)}
                    className="w-20 text-center text-xl font-bold bg-bg-primary border border-border-default text-text-primary rounded px-2 py-1"
                  />
                  <span className="text-text-muted">/ {character.hitPoints.max}</span>
                  <button
                    onClick={() => updateHP(character.hitPoints.current + 1)}
                    className="px-3 py-1.5 bg-green-accent/80 text-white rounded hover:bg-green-accent transition-colors text-sm"
                  >+</button>
                  <div className="ml-4 flex items-center gap-2 text-sm">
                    <span className="text-text-muted">Временные:</span>
                    <input
                      type="number"
                      value={character.hitPoints.temporary}
                      onChange={(e) => updateTempHP(parseInt(e.target.value) || 0)}
                      className="w-16 text-center bg-bg-primary border border-border-default text-text-primary rounded px-1 py-0.5"
                    />
                  </div>
                </div>
              </div>

              {/* Hit Dice */}
              <div className="glass-panel p-4 flex items-center justify-between">
                <h2 className="text-lg font-medieval text-gold">Кости хитов</h2>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold text-text-primary">
                    {character.hitDice.total - character.hitDice.used} / {character.hitDice.total}
                  </span>
                  <span className="text-sm text-text-secondary">{character.hitDice.type}</span>
                </div>
              </div>

              {/* Skills & Saving Throws */}
              <SkillsSection character={character} />

              {/* Features — BG3 style categorized list */}
              <FeaturesSection character={character} />

              {/* Spells summary */}
              {character.spellcasting && character.spellcasting.spells.length > 0 && (
                <div className="glass-panel p-4">
                  <h2 className="text-lg font-medieval mb-2 text-gold">
                    Заклинания ({character.spellcasting.spells.length})
                  </h2>
                  <div className="flex flex-wrap gap-1">
                    {character.spellcasting.spells.map(spell => (
                      <span
                        key={spell.spellId}
                        className={`px-2 py-1 rounded text-xs ${
                          spell.level === 0 ? 'bg-purple-900/50 text-purple-300' : 'bg-blue-900/50 text-blue-300'
                        }`}
                      >
                        {spell.name}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-text-muted mt-2 italic">Подробности во вкладке «Заклинания»</p>
                </div>
              )}

              {/* Currency */}
              <div className="glass-panel p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Coins className="text-gold" size={20} />
                  <h2 className="text-lg font-medieval text-gold">Валюта</h2>
                </div>
                <div className="flex flex-wrap gap-4 text-sm">
                  {[
                    { key: 'platinum', label: 'ПП', val: character.currency.platinum },
                    { key: 'gold', label: 'ЗМ', val: character.currency.gold },
                    { key: 'electrum', label: 'ЭМ', val: character.currency.electrum },
                    { key: 'silver', label: 'СМ', val: character.currency.silver },
                    { key: 'copper', label: 'ММ', val: character.currency.copper },
                  ].map(c => (
                    <div key={c.key} className="flex items-center gap-1.5">
                      <span className="text-text-muted">{c.label}:</span>
                      <span className="font-semibold text-text-primary">{c.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right Sidebar — always visible (BG3 pattern) */}
        <CharacterStatsSidebar character={character} showCombatStats />
      </div>

      {/* HP Choice Modal */}
      {showHpChoiceModal && pendingHpChoice && (
        <HpChoiceModal
          hitDieType={character.hitDice.type}
          conMod={getAbilityModifier(character.abilityScores.constitution)}
          onChoice={handleHpChoice}
          onCancel={() => {
            setShowHpChoiceModal(false);
            setPendingHpChoice(null);
          }}
        />
      )}

      {/* Subclass Selection Modal — BG3 full-screen style */}
      {showSubclassModal && classDef && (
        <SubclassPickerModal
          character={character}
          classDef={classDef}
          onSelect={handleSubclassSelect}
          onCancel={() => setShowSubclassModal(false)}
        />
      )}

      {/* Spell Level-Up Modal */}
      {showSpellLevelUp && pendingLevelUp && (
        <SpellLevelUpModal
          character={character}
          newLevel={pendingLevelUp.newLevel}
          oldLevelData={pendingLevelUp.oldData}
          newLevelData={pendingLevelUp.newData}
          onConfirm={handleSpellLevelUpConfirm}
          onCancel={handleSpellLevelUpCancel}
        />
      )}

      {/* Feat Picker Modal */}
      {showFeatPicker && pendingFeatLevelUp && (
        <FeatPickerModal
          character={pendingFeatLevelUp.updatedChar}
          mode={pendingFeatLevelUp.mode}
          onConfirm={handleFeatPickerConfirm}
          onCancel={() => {
            // On cancel, still apply the level-up but without feat/ASI
            onUpdate(pendingFeatLevelUp.updatedChar);
            setShowFeatPicker(false);
            setPendingFeatLevelUp(null);
          }}
        />
      )}
    </div>
  );
};

// ==============================
// Features Section — BG3 style categorized list
// ==============================

interface FeatureItem {
  name: string;
  description: string;
  level?: number;
  source?: string;
}

interface FeatureCategory {
  label: string;
  icon: React.ReactNode;
  features: FeatureItem[];
}

// ─── Skills Section ───
const ABILITY_ORDER: (keyof AbilityScores)[] = [
  'strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma',
];

function SkillsSection({ character }: { character: Character }) {
  const [collapsed, setCollapsed] = useState(false);

  const profBonus = character.proficiencyBonus;

  return (
    <div className="glass-panel p-4">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 w-full text-left mb-3"
      >
        <Target className="text-gold" size={20} />
        <h2 className="text-lg font-medieval text-gold flex-1">Навыки</h2>
        <ChevronDown
          size={16}
          className={`text-text-muted transition-transform ${collapsed ? '-rotate-90' : ''}`}
        />
      </button>

      {!collapsed && (
        <div className="space-y-4">
          {ABILITY_ORDER.map(ability => {
            const skillsForAbility = Object.entries(SKILL_ABILITIES)
              .filter(([, ab]) => ab === ability)
              .map(([key]) => key);
            if (skillsForAbility.length === 0) return null;

            return (
              <div key={ability}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-text-muted font-bold">
                    {ABILITY_NAMES[ability]} ({ABILITY_SHORT[ability]})
                  </span>
                  <div className="flex-1 h-px bg-border-default/50" />
                </div>
                <div className="space-y-1">
                  {skillsForAbility.map(skillKey => {
                    const skillData = character.skills?.[skillKey];
                    const isProficient = skillData?.proficient ?? false;
                    const hasExpertise = skillData?.expertise ?? false;
                    const abilityScore = character.abilityScores[ability];
                    const mod = getSkillBonus(abilityScore, isProficient, hasExpertise, profBonus);

                    return (
                      <div
                        key={skillKey}
                        className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-colors ${
                          isProficient
                            ? 'bg-gold/5'
                            : 'hover:bg-bg-panel/50'
                        }`}
                      >
                        {/* Proficiency indicator */}
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          hasExpertise
                            ? 'border-purple-400 bg-purple-900/40'
                            : isProficient
                              ? 'border-gold bg-gold/20'
                              : 'border-border-default/60 bg-transparent'
                        }`}>
                          {(isProficient || hasExpertise) && (
                            <Check size={10} className={hasExpertise ? 'text-purple-300' : 'text-gold'} />
                          )}
                        </div>

                        {/* Placeholder icon */}
                        <div className={`w-7 h-7 rounded border flex items-center justify-center text-[10px] font-bold shrink-0 ${
                          isProficient
                            ? 'border-gold/30 bg-gold/10 text-gold'
                            : 'border-border-default/40 bg-bg-panel-solid/40 text-text-muted'
                        }`}>
                          {SKILL_NAMES[skillKey]?.charAt(0) || '?'}
                        </div>

                        {/* Skill name */}
                        <span className={`flex-1 text-sm ${
                          isProficient ? 'text-text-primary font-medium' : 'text-text-secondary'
                        }`}>
                          {SKILL_NAMES[skillKey]}
                        </span>

                        {/* Modifier */}
                        <span className={`text-sm font-bold tabular-nums ${
                          isProficient
                            ? mod >= 0 ? 'text-green-400' : 'text-red-bright'
                            : 'text-text-muted'
                        }`}>
                          {mod >= 0 ? '+' : ''}{mod}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Saving Throws */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] uppercase tracking-wider text-text-muted font-bold">
                Спасброски
              </span>
              <div className="flex-1 h-px bg-border-default/50" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {ABILITY_ORDER.map(ability => {
                const isProficient = character.savingThrows[ability]?.proficient ?? false;
                const mod = getAbilityModifier(character.abilityScores[ability]) + (isProficient ? profBonus : 0);
                return (
                  <div
                    key={ability}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm ${
                      isProficient ? 'bg-gold/5' : ''
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      isProficient
                        ? 'border-gold bg-gold/20'
                        : 'border-border-default/60'
                    }`}>
                      {isProficient && <Check size={8} className="text-gold" />}
                    </div>
                    <span className={isProficient ? 'text-text-primary' : 'text-text-secondary'}>
                      {ABILITY_SHORT[ability]}
                    </span>
                    <span className={`ml-auto font-bold tabular-nums ${
                      isProficient ? 'text-green-400' : 'text-text-muted'
                    }`}>
                      {mod >= 0 ? '+' : ''}{mod}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FeaturesSection({ character }: { character: Character }) {
  const [loaded, setLoaded] = useState(false);
  const [classFeatures, setClassFeatures] = useState<FeatureItem[]>([]);
  const [subclassFeatures, setSubclassFeatures] = useState<FeatureItem[]>([]);
  const [expandedFeature, setExpandedFeature] = useState<string | null>(null);
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());

  const raceDef = getRaceByName(character.race);
  const raceTraits: FeatureItem[] = (raceDef?.traits ?? []).map(t => ({
    name: t.name,
    description: t.description,
  }));

  // Background features from character.features
  const bgFeatures: FeatureItem[] = character.features.map(f => ({
    name: f.name,
    description: f.description,
    source: f.source,
  }));

  // Load class + subclass features lazily
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const classMod = await import('../data/classes/classJsonLoader');
        await classMod.init();
        if (cancelled) return;

        const classData = classMod.getClassDataByName(character.class);
        if (classData?.classFeatures) {
          const cf = classData.classFeatures
            .filter((f: any) => f.level <= character.level)
            .map((f: any) => ({
              name: f.name,
              description: f.description || '',
              level: f.level,
              source: f.source,
            }));
          setClassFeatures(cf);
        }

        if (character.subclass) {
          const subMod = await import('../data/classes/subclassJsonLoader');
          await subMod.init();
          if (cancelled) return;

          const classDef = getClassById(character.classId || '') ?? CLASS_REGISTRY.find(c => c.name === character.class);
          const subDef = classDef?.subclasses.find(s => s.name === character.subclass);
          if (subDef) {
            const subData = subMod.getSubclassById(classDef!.id, subDef.id);
            if (subData?.features) {
              const sf = subData.features
                .filter(f => f.level <= character.level)
                .map(f => ({
                  name: f.name,
                  description: f.description || '',
                  level: f.level,
                  source: f.source,
                }));
              setSubclassFeatures(sf);
            }
          }
        }

        setLoaded(true);
      } catch (e) {
        console.warn('Failed to load features:', e);
        setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [character.class, character.subclass, character.level, character.classId]);

  const toggleCat = (key: string) => {
    setCollapsedCats(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const categories: FeatureCategory[] = [
    ...(raceTraits.length > 0 ? [{
      label: `Раса — ${character.race}`,
      icon: <Sparkles size={14} className="text-purple-400" />,
      features: raceTraits,
    }] : []),
    ...(classFeatures.length > 0 ? [{
      label: `${character.class}`,
      icon: <Shield size={14} className="text-gold" />,
      features: classFeatures,
    }] : []),
    ...(subclassFeatures.length > 0 ? [{
      label: `${character.subclass}`,
      icon: <BookOpen size={14} className="text-blue-400" />,
      features: subclassFeatures,
    }] : []),
    ...(bgFeatures.length > 0 ? [{
      label: 'Предыстория',
      icon: <ScrollText size={14} className="text-text-secondary" />,
      features: bgFeatures,
    }] : []),
  ];

  const totalCount = categories.reduce((s, c) => s + c.features.length, 0);

  return (
    <div className="glass-panel p-4">
      <h2 className="text-lg font-medieval mb-3 text-gold flex items-center gap-2">
        <BookOpen size={18} />
        Особенности
        <span className="text-xs font-normal text-text-muted ml-1">({totalCount})</span>
      </h2>

      {!loaded && categories.length === 0 && (
        <div className="text-text-muted text-sm animate-pulse py-2">Загрузка...</div>
      )}

      <div className="space-y-3">
        {categories.map(cat => {
          const key = cat.label;
          const collapsed = collapsedCats.has(key);
          return (
            <div key={key}>
              <button
                onClick={() => toggleCat(key)}
                className="flex items-center gap-2 w-full text-left mb-1.5"
              >
                {collapsed
                  ? <ChevronRight size={14} className="text-text-muted" />
                  : <ChevronDown size={14} className="text-text-muted" />}
                {cat.icon}
                <span className="text-sm font-semibold text-text-primary">{cat.label}</span>
                <span className="text-xs text-text-muted ml-1">({cat.features.length})</span>
              </button>
              {!collapsed && (
                <div className="space-y-1 ml-5">
                  {cat.features.map((feat, i) => {
                    const featureKey = `${key}-${feat.name}-${i}`;
                    const isExpanded = expandedFeature === featureKey;
                    return (
                      <button
                        key={featureKey}
                        onClick={() => setExpandedFeature(isExpanded ? null : featureKey)}
                        className={`w-full text-left rounded-lg border p-2.5 transition-all ${
                          isExpanded
                            ? 'border-gold/40 bg-gold/5'
                            : 'border-border-default bg-bg-primary/40 hover:border-border-hover'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-gold/60 shrink-0" />
                          <span className="text-sm text-text-primary font-medium">{feat.name}</span>
                          {feat.level && (
                            <span className="text-[10px] text-text-muted ml-auto shrink-0">{feat.level} ур.</span>
                          )}
                        </div>
                        {isExpanded && feat.description && (
                          <div className="mt-2 pt-2 border-t border-border-default text-xs text-text-secondary leading-relaxed whitespace-pre-line ml-3.5">
                            {cleanEntryRefs(feat.description)}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {loaded && totalCount === 0 && (
        <div className="text-center text-text-muted text-sm py-2 italic">
          Нет особенностей
        </div>
      )}
    </div>
  );
}

// ==============================
// HP Choice Modal — Average vs Roll
// ==============================
interface HpChoiceModalProps {
  hitDieType: string;      // e.g. "d10"
  conMod: number;
  onChoice: (hpGain: number) => void;
  onCancel: () => void;
}

function HpChoiceModal({ hitDieType, conMod, onChoice, onCancel }: HpChoiceModalProps) {
  const hitDieValue = parseInt(hitDieType.replace('d', ''));
  const averageRoll = Math.ceil(hitDieValue / 2) + 1; // стандартная формула D&D: ceil(die/2)+1
  const averageTotal = Math.max(1, averageRoll + conMod);

  const [rolledValue, setRolledValue] = useState<number | null>(null);
  const [isRolling, setIsRolling] = useState(false);

  const doRoll = () => {
    setIsRolling(true);
    setRolledValue(null);

    // Анимация "кручения" кубика
    let ticks = 0;
    const maxTicks = 12;
    const interval = setInterval(() => {
      ticks++;
      setRolledValue(Math.floor(Math.random() * hitDieValue) + 1);
      if (ticks >= maxTicks) {
        clearInterval(interval);
        const finalRoll = Math.floor(Math.random() * hitDieValue) + 1;
        setRolledValue(finalRoll);
        setIsRolling(false);
      }
    }, 80);
  };

  const rolledTotal = rolledValue !== null ? Math.max(1, rolledValue + conMod) : null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-bg-panel-solid rounded-xl border-2 border-gold/40 ornate-border max-w-md w-full p-6 space-y-5">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-xl font-medieval text-gold">Повышение здоровья</h2>
          <p className="text-sm text-text-secondary mt-1">
            Кость здоровья: <span className="text-text-primary font-bold">{hitDieType}</span>
            {' '} • Модификатор Тел: <span className="text-text-primary font-bold">{formatModifier(conMod)}</span>
          </p>
        </div>

        {/* Two options */}
        <div className="grid grid-cols-1 gap-3">
          {/* Option 1: Standard/Average */}
          <button
            onClick={() => onChoice(averageTotal)}
            className="group rounded-lg border-2 border-border-default hover:border-gold/50 bg-bg-primary/60 hover:bg-gold/5 p-4 transition-all text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg border-2 border-gold/30 bg-gold/10 flex items-center justify-center shrink-0">
                <Calculator size={22} className="text-gold" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-text-primary group-hover:text-gold transition-colors">
                  Стандартная формула
                </div>
                <div className="text-xs text-text-muted mt-0.5">
                  {averageRoll} ({hitDieType} среднее) {conMod >= 0 ? '+' : ''}{conMod} (Тел)
                </div>
              </div>
              <div className="text-2xl font-bold text-gold">
                +{averageTotal}
              </div>
            </div>
          </button>

          {/* Option 2: Roll */}
          <div className="rounded-lg border-2 border-border-default bg-bg-primary/60 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg border-2 border-gold/30 bg-gold/10 flex items-center justify-center shrink-0">
                <Dices size={22} className="text-gold" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-text-primary">
                  Бросить кубик
                </div>
                <div className="text-xs text-text-muted mt-0.5">
                  1{hitDieType} {conMod >= 0 ? '+' : ''}{conMod} (Тел) — от {Math.max(1, 1 + conMod)} до {hitDieValue + conMod}
                </div>
              </div>

              {rolledValue !== null && !isRolling ? (
                <div className="text-2xl font-bold text-gold">
                  +{rolledTotal}
                </div>
              ) : isRolling && rolledValue !== null ? (
                <div className="text-2xl font-bold text-text-muted animate-pulse">
                  {rolledValue}
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              {rolledValue === null || isRolling ? (
                <button
                  onClick={doRoll}
                  disabled={isRolling}
                  className="flex-1 py-2 rounded-lg border border-gold/30 bg-gold/10 text-gold font-semibold
                    hover:bg-gold/20 disabled:opacity-50 transition-all text-sm flex items-center justify-center gap-2"
                >
                  <Dices size={16} className={isRolling ? 'animate-spin' : ''} />
                  {isRolling ? 'Бросаю...' : 'Бросить ' + hitDieType}
                </button>
              ) : (
                <>
                  <button
                    onClick={doRoll}
                    className="py-2 px-4 rounded-lg border border-border-default text-text-secondary hover:text-text-primary
                      hover:border-border-hover transition-colors text-sm"
                  >
                    Перебросить
                  </button>
                  <button
                    onClick={() => onChoice(rolledTotal!)}
                    className="flex-1 py-2 rounded-lg bg-gold/20 text-gold border border-gold/30 font-semibold
                      hover:bg-gold/30 transition-all text-sm"
                  >
                    Принять +{rolledTotal}
                  </button>
                </>
              )}
            </div>

            {rolledValue !== null && !isRolling && (
              <div className="text-xs text-text-muted text-center">
                Выпало: <span className="text-text-primary font-bold">{rolledValue}</span> {conMod >= 0 ? '+' : ''}{conMod} = <span className="text-gold font-bold">{rolledTotal}</span>
              </div>
            )}
          </div>
        </div>

        {/* Cancel */}
        <button
          onClick={onCancel}
          className="w-full py-2 rounded-lg border border-border-default text-text-secondary hover:text-text-primary
            hover:border-border-hover transition-colors text-sm"
        >
          Отмена
        </button>
      </div>
    </div>
  );
}

// ==============================
// Subclass Picker Modal — BG3 style
// ==============================
function cleanEntryRefs(text: string): string {
  // Strip {@spell X}, {@action X}, {@condition X}, {@variantrule X} → just X
  return text.replace(/\{@\w+\s+([^|}]+)(?:\|[^}]*)?\}/g, '$1');
}

interface SubclassPickerModalProps {
  character: Character;
  classDef: import('../data/classes/types').ClassDefinition;
  onSelect: (subclassName: string) => void;
  onCancel: () => void;
}

function SubclassPickerModal({ character, classDef, onSelect, onCancel }: SubclassPickerModalProps) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [subclassDetails, setSubclassDetails] = useState<SubclassJsonData[]>([]);
  const [loading, setLoading] = useState(true);

  // Load detailed subclass data
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loader = await import('../data/classes/subclassJsonLoader');
      await loader.init();
      if (cancelled) return;
      const details = loader.getSubclassesByClass(classDef.id);
      setSubclassDetails(details);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [classDef.id]);

  const subs = classDef.subclasses;
  const current = subs[selectedIdx];
  // Match detailed JSON data by id
  const detail = subclassDetails.find(d => d.id === current?.id);
  const level3Features = detail?.features.filter(f => f.level === 3) ?? [];

  const prev = () => setSelectedIdx(i => (i - 1 + subs.length) % subs.length);
  const next = () => setSelectedIdx(i => (i + 1) % subs.length);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-gold/30 bg-bg-panel-solid/95 px-6 py-4">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div>
            <h1 className="text-2xl font-medieval text-gold flex items-center gap-3">
              <Sparkles className="text-gold" size={24} />
              Выбор подкласса — Уровень 3
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              Ваш {character.class} достиг 3 уровня! Выберите специализацию.
            </p>
          </div>
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-border-default text-text-secondary hover:text-text-primary hover:border-border-hover transition-colors text-sm"
          >
            Отмена
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-6 space-y-5">
          {/* CycleSelector-style navigation */}
          <div className="glass-panel ornate-border p-4">
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={prev}
                className="p-2 rounded-lg border border-gold/30 text-gold hover:bg-gold/10 transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="text-center min-w-[200px]">
                <div className="text-xl font-medieval text-gold">{current?.name}</div>
                <div className="text-xs text-text-muted mt-1">{current?.source}</div>
              </div>
              <button
                onClick={next}
                className="p-2 rounded-lg border border-gold/30 text-gold hover:bg-gold/10 transition-colors"
              >
                <ChevronRight size={20} />
              </button>
            </div>
            <div className="text-center text-xs text-text-muted mt-2">
              {selectedIdx + 1} / {subs.length}
            </div>
          </div>

          {/* Description */}
          <div className="glass-panel p-4">
            <p className="text-sm text-text-secondary leading-relaxed">
              {detail?.description || current?.description}
            </p>
          </div>

          {/* Level 3 Features */}
          {loading ? (
            <div className="glass-panel p-6 flex items-center justify-center">
              <div className="text-text-muted animate-pulse">Загрузка способностей...</div>
            </div>
          ) : level3Features.length > 0 ? (
            <div className="glass-panel p-4 space-y-4">
              <h3 className="text-base font-medieval text-gold flex items-center gap-2">
                <BookOpen size={16} />
                Способности 3 уровня
              </h3>
              {level3Features.map((feature, i) => (
                <div key={i} className="border border-border-default rounded-lg p-3 bg-bg-primary/40">
                  <h4 className="text-sm font-semibold text-text-primary mb-1.5 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-gold shrink-0" />
                    {feature.name}
                  </h4>
                  <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-line">
                    {cleanEntryRefs(feature.description)}
                  </p>
                  {feature.spellList && feature.spellList.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-border-default">
                      <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Заклинания подкласса</div>
                      <div className="space-y-1">
                        {feature.spellList.map((row: any, ri: number) => {
                          const lvlKey = Object.keys(row).find(k => k !== 'spells') || '';
                          const lvlVal = row[lvlKey];
                          const spellNames = (row.spells as string[]).map(s =>
                            s.replace(/\{@spell\s+([^|}]+)(?:\|[^}]*)?\}/g, '$1')
                          );
                          return (
                            <div key={ri} className="flex items-start gap-2 text-xs">
                              <span className="text-text-muted shrink-0">{lvlVal} ур.:</span>
                              <span className="text-text-primary">{spellNames.join(', ')}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-panel p-4 text-center text-text-muted text-sm">
              Подробные данные для этого подкласса не найдены
            </div>
          )}

          {/* All subclasses quick-nav grid */}
          <div className="glass-panel p-4">
            <h4 className="text-xs text-text-muted uppercase tracking-wider mb-3">Все подклассы</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {subs.map((sub, i) => (
                <button
                  key={sub.id}
                  onClick={() => setSelectedIdx(i)}
                  className={`text-left rounded-lg border p-2.5 transition-all text-sm ${
                    i === selectedIdx
                      ? 'border-gold/50 bg-gold/10 text-gold'
                      : 'border-border-default bg-bg-primary/40 text-text-secondary hover:border-border-hover hover:text-text-primary'
                  }`}
                >
                  <div className="font-medium truncate">{sub.name}</div>
                  <div className="text-[10px] text-text-muted truncate mt-0.5">{sub.description}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-gold/30 bg-bg-panel-solid/95 px-6 py-4">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div className="text-sm text-text-secondary">
            Выбрано: <span className="text-gold font-semibold">{current?.name}</span>
          </div>
          <button
            onClick={() => onSelect(current?.name)}
            className="px-8 py-2.5 rounded-lg bg-gold/20 text-gold border border-gold/30 font-medieval font-semibold text-lg
              hover:bg-gold/30 transition-all gold-glow"
          >
            Выбрать {current?.name}
          </button>
        </div>
      </div>
    </div>
  );
}

// SpellsTab вынесен в SpellsTab.tsx и загружается лениво через LazySpellsTab
