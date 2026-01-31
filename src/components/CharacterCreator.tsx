import React, { useState, useMemo } from 'react';
import type { Character, AbilityScores } from '../types';
import {
  generateAbilityScores,
  calculateMaxHP,
  getProficiencyBonus,
  getAbilityModifier,
  formatModifier,
  ABILITY_NAMES,
  POINT_BUY_TOTAL,
  POINT_BUY_MIN,
  POINT_BUY_MAX,
  POINT_BUY_COSTS,
  getPointBuyRemaining,
  canIncreasePointBuy,
  canDecreasePointBuy,
} from '../utils/dnd';
import { CLASS_REGISTRY, type ClassDefinition } from '../data/classes';
import { RACE_REGISTRY, getRacialBonuses, getTotalRacialBonus, type RaceDefinition, type SubraceDefinition } from '../data/races';
import { BACKGROUND_REGISTRY, type BackgroundDefinition } from '../data/backgrounds';
import { ArrowLeft, ArrowRight, Dices, ChevronDown, ChevronUp, Wand2, Check, Sparkles, Swords, User, Eye, BookOpen } from 'lucide-react';

interface CharacterCreatorProps {
  onSave: (character: Character) => void;
  onCancel: () => void;
}

type AbilityMethod = 'pointBuy' | 'roll' | 'manual';
type RacialBonusMode = 'standard' | 'custom';

const STEPS = [
  { key: 'race', label: 'Раса', icon: Sparkles },
  { key: 'class', label: 'Класс', icon: Swords },
  { key: 'background', label: 'Предыстория', icon: BookOpen },
  { key: 'abilities', label: 'Характеристики', icon: Dices },
  { key: 'details', label: 'Детали', icon: User },
  { key: 'review', label: 'Обзор', icon: Eye },
];

const DEFAULT_SCORES: AbilityScores = {
  strength: 8, dexterity: 8, constitution: 8,
  intelligence: 8, wisdom: 8, charisma: 8,
};

// ─── Image helper with fallback ───
const EntityImage: React.FC<{
  folder: string;
  id: string;
  name: string;
  className?: string;
}> = ({ folder, id, name, className = '' }) => {
  const [failed, setFailed] = useState(false);
  const src = `/images/${folder}/${id}.webp`;

  if (failed) {
    return (
      <div className={`flex items-center justify-center bg-gray-700/60 text-dnd-secondary font-medieval text-lg ${className}`}>
        {name.charAt(0)}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
};

export const CharacterCreator: React.FC<CharacterCreatorProps> = ({ onSave, onCancel }) => {
  const [step, setStep] = useState(0);

  // Race
  const [selectedRace, setSelectedRace] = useState<RaceDefinition | null>(null);
  const [selectedSubrace, setSelectedSubrace] = useState<SubraceDefinition | null>(null);

  // Class
  const [selectedClass, setSelectedClass] = useState<ClassDefinition | null>(null);

  // Background
  const [selectedBackground, setSelectedBackground] = useState<BackgroundDefinition | null>(null);

  // Abilities
  const [abilityMethod, setAbilityMethod] = useState<AbilityMethod>('pointBuy');
  const [abilityScores, setAbilityScores] = useState<AbilityScores>({ ...DEFAULT_SCORES });
  const [racialBonusMode, setRacialBonusMode] = useState<RacialBonusMode>('standard');
  const [customBonuses, setCustomBonuses] = useState<Partial<AbilityScores>>({});

  // Details
  const [name, setName] = useState('');

  // Computed racial bonuses
  const standardBonuses = useMemo(() => {
    if (!selectedRace) return {};
    return getRacialBonuses(selectedRace, selectedSubrace || undefined);
  }, [selectedRace, selectedSubrace]);

  const totalBonusPoints = useMemo(() => {
    if (!selectedRace) return 0;
    return getTotalRacialBonus(selectedRace, selectedSubrace || undefined);
  }, [selectedRace, selectedSubrace]);

  const activeBonuses = racialBonusMode === 'standard' ? standardBonuses : customBonuses;

  const customBonusSpent = useMemo(() => {
    return Object.values(customBonuses).reduce((sum, v) => sum + (v || 0), 0);
  }, [customBonuses]);

  const getFinalScore = (ability: keyof AbilityScores): number => {
    return abilityScores[ability] + (activeBonuses[ability] || 0);
  };

  // Navigation
  const canProceed = (): boolean => {
    switch (step) {
      case 0: return selectedRace !== null;
      case 1: return selectedClass !== null;
      case 2: return selectedBackground !== null;
      case 3: {
        if (abilityMethod === 'pointBuy' && getPointBuyRemaining(abilityScores) < 0) return false;
        if (racialBonusMode === 'custom' && customBonusSpent !== totalBonusPoints) return false;
        return true;
      }
      case 4: return name.trim().length > 0;
      default: return true;
    }
  };

  const nextStep = () => { if (canProceed()) setStep(s => Math.min(s + 1, 5)); };
  const prevStep = () => setStep(s => Math.max(s - 1, 0));

  // Ability methods
  const handlePointBuyChange = (ability: keyof AbilityScores, delta: number) => {
    setAbilityScores(prev => {
      const next = { ...prev, [ability]: prev[ability] + delta };
      if (next[ability] < POINT_BUY_MIN || next[ability] > POINT_BUY_MAX) return prev;
      if (delta > 0 && !canIncreasePointBuy(prev, ability)) return prev;
      return next;
    });
  };

  const handleRollAbilities = () => {
    setAbilityScores(generateAbilityScores());
  };

  const handleManualChange = (ability: keyof AbilityScores, value: number) => {
    setAbilityScores(prev => ({
      ...prev,
      [ability]: Math.max(1, Math.min(20, value || 1)),
    }));
  };

  const handleCustomBonusChange = (ability: keyof AbilityScores, delta: number) => {
    setCustomBonuses(prev => {
      const current = prev[ability] || 0;
      const next = current + delta;
      if (next < 0 || next > 2) return prev;
      const newBonuses = { ...prev, [ability]: next };
      const newTotal = Object.values(newBonuses).reduce((sum, v) => sum + (v || 0), 0);
      if (newTotal > totalBonusPoints) return prev;
      return newBonuses;
    });
  };

  const switchAbilityMethod = (method: AbilityMethod) => {
    setAbilityMethod(method);
    if (method === 'pointBuy') {
      setAbilityScores({ ...DEFAULT_SCORES });
    } else if (method === 'roll') {
      handleRollAbilities();
    } else {
      setAbilityScores({ strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 });
    }
  };

  // Submit
  const handleSubmit = () => {
    if (!selectedRace || !selectedClass || !selectedBackground) return;

    const level = 1;
    const finalScores: AbilityScores = {
      strength: getFinalScore('strength'),
      dexterity: getFinalScore('dexterity'),
      constitution: getFinalScore('constitution'),
      intelligence: getFinalScore('intelligence'),
      wisdom: getFinalScore('wisdom'),
      charisma: getFinalScore('charisma'),
    };

    const proficiencyBonus = getProficiencyBonus(level);
    const maxHP = calculateMaxHP(level, finalScores.constitution, selectedClass.hitDie);

    // Merge tool proficiencies from class and background
    const allTools = [...selectedClass.proficiencies.tools];
    if (selectedBackground.toolProficiency && !allTools.includes(selectedBackground.toolProficiency)) {
      allTools.push(selectedBackground.toolProficiency);
    }

    const character: Character = {
      id: crypto.randomUUID(),
      name,
      race: selectedSubrace ? `${selectedRace.name} (${selectedSubrace.name})` : selectedRace.name,
      class: selectedClass.name,
      classId: selectedClass.id,
      level,
      background: selectedBackground.name,
      abilityScores: finalScores,
      hitPoints: { current: maxHP, max: maxHP, temporary: 0 },
      hitDice: { total: level, used: 0, type: selectedClass.hitDie },
      savingThrows: {
        strength: { proficient: selectedClass.savingThrows.includes('strength') },
        dexterity: { proficient: selectedClass.savingThrows.includes('dexterity') },
        constitution: { proficient: selectedClass.savingThrows.includes('constitution') },
        intelligence: { proficient: selectedClass.savingThrows.includes('intelligence') },
        wisdom: { proficient: selectedClass.savingThrows.includes('wisdom') },
        charisma: { proficient: selectedClass.savingThrows.includes('charisma') },
      },
      skills: {},
      proficiencies: {
        armor: selectedClass.proficiencies.armor,
        weapons: selectedClass.proficiencies.weapons,
        tools: allTools,
        languages: selectedRace.languages,
      },
      armorClass: 10 + getAbilityModifier(finalScores.dexterity),
      initiative: getAbilityModifier(finalScores.dexterity),
      speed: selectedRace.speed,
      proficiencyBonus,
      inventory: [],
      currency: { copper: 0, silver: 0, electrum: 0, gold: 0, platinum: 0 },
      features: selectedBackground.feat ? [{ id: 'bg-feat', name: selectedBackground.feat, description: `Черта от предыстории: ${selectedBackground.name}`, source: selectedBackground.source }] : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (selectedClass.spellcaster && selectedClass.spellcastingAbility) {
      const abilityMod = getAbilityModifier(finalScores[selectedClass.spellcastingAbility]);
      character.spellcasting = {
        ability: selectedClass.spellcastingAbility,
        spellSaveDC: 8 + proficiencyBonus + abilityMod,
        spellAttackBonus: proficiencyBonus + abilityMod,
        spells: [],
        cantripsKnown: 2,
        spellsKnown: level + abilityMod,
      };
    }

    onSave(character);
  };

  // ─── Step Indicator ───
  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-0 mb-4">
      {STEPS.map((s, i) => {
        const Icon = s.icon;
        const isActive = i === step;
        const isDone = i < step;
        return (
          <React.Fragment key={s.key}>
            {i > 0 && (
              <div className={`h-0.5 w-8 sm:w-12 ${isDone ? 'bg-dnd-secondary' : 'bg-gray-600'}`} />
            )}
            <button
              onClick={() => { if (isDone) setStep(i); }}
              className={`flex flex-col items-center gap-1 px-2 py-1 rounded transition-all ${
                isActive
                  ? 'text-dnd-secondary scale-110'
                  : isDone
                    ? 'text-dnd-secondary/70 cursor-pointer hover:text-dnd-secondary'
                    : 'text-gray-500 cursor-default'
              }`}
              disabled={!isDone && !isActive}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                isActive
                  ? 'border-dnd-secondary bg-dnd-secondary/20'
                  : isDone
                    ? 'border-dnd-secondary bg-dnd-secondary text-dnd-dark'
                    : 'border-gray-600 bg-transparent'
              }`}>
                {isDone ? <Check size={18} /> : <Icon size={18} />}
              </div>
              <span className="text-xs font-medium hidden sm:block">{s.label}</span>
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );

  // ─── Step 0: Race ───
  const renderRaceStep = () => (
    <div className="flex flex-col lg:flex-row gap-6 h-full">
      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        <h3 className="text-xl font-medieval text-dnd-secondary mb-4">Выберите расу</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
          {RACE_REGISTRY.map(race => (
            <button
              key={race.id}
              onClick={() => {
                setSelectedRace(race);
                setSelectedSubrace(null);
                setCustomBonuses({});
              }}
              className={`rounded-lg border-2 text-left transition-all hover:scale-[1.02] overflow-hidden ${
                selectedRace?.id === race.id
                  ? 'border-dnd-secondary bg-dnd-secondary/10 shadow-lg shadow-dnd-secondary/20'
                  : 'border-gray-600 bg-gray-800/50 hover:border-gray-400'
              }`}
            >
              <EntityImage folder="races" id={race.id} name={race.name} className="w-full h-32 rounded-t-md" />
              <div className="p-2">
                <div className={`font-semibold text-sm ${selectedRace?.id === race.id ? 'text-dnd-secondary' : 'text-gray-200'}`}>
                  {race.name}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">{race.source}</div>
              </div>
            </button>
          ))}
        </div>

        {selectedRace?.subraces && selectedRace.subraces.length > 0 && (
          <div className="mt-6">
            <h4 className="text-lg font-medieval text-dnd-secondary mb-3">Подраса</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {selectedRace.subraces.map(sub => (
                <button
                  key={sub.id}
                  onClick={() => { setSelectedSubrace(sub); setCustomBonuses({}); }}
                  className={`rounded-lg border-2 text-left transition-all overflow-hidden ${
                    selectedSubrace?.id === sub.id
                      ? 'border-dnd-secondary bg-dnd-secondary/10'
                      : 'border-gray-600 bg-gray-800/50 hover:border-gray-400'
                  }`}
                >
                  <EntityImage folder="subraces" id={sub.id} name={sub.name} className="w-full h-28 rounded-t-md" />
                  <div className="p-2">
                    <div className={`font-semibold text-sm ${selectedSubrace?.id === sub.id ? 'text-dnd-secondary' : 'text-gray-200'}`}>
                      {sub.name}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {selectedRace && (
        <div className="w-full lg:w-96 shrink-0 bg-gray-800/80 rounded-lg border border-gray-600 overflow-y-auto">
          <EntityImage
            folder={selectedSubrace ? 'subraces' : 'races'}
            id={selectedSubrace ? selectedSubrace.id : selectedRace.id}
            name={selectedSubrace ? selectedSubrace.name : selectedRace.name}
            className="w-full h-52"
          />
          <div className="p-5 space-y-3">
            <div>
              <h3 className="text-xl font-medieval text-dnd-secondary">{selectedRace.name}</h3>
              {selectedSubrace && <div className="text-sm text-dnd-secondary/80 mt-0.5">{selectedSubrace.name}</div>}
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">{selectedRace.description}</p>
            {selectedSubrace && <p className="text-sm text-gray-400 leading-relaxed">{selectedSubrace.description}</p>}

            <div className="space-y-2 text-sm">
              <div className="flex gap-2">
                <span className="text-gray-400 shrink-0">Скорость:</span>
                <span className="text-white">{selectedRace.speed} фт.</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-400 shrink-0">Размер:</span>
                <span className="text-white">{selectedRace.size}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-400 shrink-0">Языки:</span>
                <span className="text-white">{selectedRace.languages.join(', ')}</span>
              </div>
              <div>
                <span className="text-gray-400">Бонусы:</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {Object.entries(getRacialBonuses(selectedRace, selectedSubrace || undefined)).map(([key, val]) => (
                    val ? (
                      <span key={key} className="px-2 py-0.5 bg-dnd-secondary/20 text-dnd-secondary rounded text-xs">
                        {ABILITY_NAMES[key as keyof AbilityScores]} +{val}
                      </span>
                    ) : null
                  ))}
                </div>
              </div>
              <div>
                <span className="text-gray-400">Особенности:</span>
                <div className="mt-2 space-y-2">
                  {selectedRace.traits.map(t => (
                    <div key={t.name} className="text-xs leading-relaxed">
                      <span className="text-dnd-secondary font-medium">{t.name}:</span>
                      <span className="text-gray-300 ml-1">{t.description}</span>
                    </div>
                  ))}
                  {selectedSubrace?.traits.map(t => (
                    <div key={t.name} className="text-xs leading-relaxed">
                      <span className="text-dnd-secondary font-medium">{t.name}:</span>
                      <span className="text-gray-300 ml-1">{t.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ─── Step 1: Class ───
  const renderClassStep = () => (
    <div className="flex flex-col lg:flex-row gap-6 h-full">
      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        <h3 className="text-xl font-medieval text-dnd-secondary mb-4">Выберите класс</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
          {CLASS_REGISTRY.map(cls => (
            <button
              key={cls.id}
              onClick={() => setSelectedClass(cls)}
              className={`rounded-lg border-2 text-left transition-all hover:scale-[1.02] overflow-hidden ${
                selectedClass?.id === cls.id
                  ? 'border-dnd-secondary bg-dnd-secondary/10 shadow-lg shadow-dnd-secondary/20'
                  : 'border-gray-600 bg-gray-800/50 hover:border-gray-400'
              }`}
            >
              <EntityImage folder="classes" id={cls.id} name={cls.name} className="w-full h-32 rounded-t-md" />
              <div className="p-2">
                <div className={`font-semibold text-sm ${selectedClass?.id === cls.id ? 'text-dnd-secondary' : 'text-gray-200'}`}>
                  {cls.name}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {cls.hitDie} • {cls.source}
                </div>
              </div>
            </button>
          ))}
        </div>

        {selectedClass && selectedClass.subclasses.length > 0 && (
          <div className="mt-6">
            <h4 className="text-lg font-medieval text-dnd-secondary mb-2">
              Доступные подклассы <span className="text-sm font-normal text-gray-400">(выбор на 3 уровне)</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {selectedClass.subclasses.map(sub => (
                <div
                  key={sub.id}
                  className="rounded-lg border border-gray-600 bg-gray-800/30 overflow-hidden flex opacity-80"
                >
                  <EntityImage folder="subclasses" id={sub.id} name={sub.name} className="w-16 h-16 shrink-0" />
                  <div className="p-2 min-w-0">
                    <div className="font-semibold text-sm text-gray-300">{sub.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{sub.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {selectedClass && (
        <div className="w-full lg:w-96 shrink-0 bg-gray-800/80 rounded-lg border border-gray-600 overflow-y-auto">
          <EntityImage
            folder="classes"
            id={selectedClass.id}
            name={selectedClass.name}
            className="w-full h-52"
          />
          <div className="p-5 space-y-3">
            <h3 className="text-xl font-medieval text-dnd-secondary">{selectedClass.name}</h3>
            <p className="text-sm text-gray-300 leading-relaxed">{selectedClass.description}</p>

            <div className="space-y-2 text-sm">
              <div className="flex gap-2">
                <span className="text-gray-400 shrink-0">Кость хитов:</span>
                <span className="text-white font-bold">{selectedClass.hitDie}</span>
              </div>
              <div>
                <span className="text-gray-400">Основная характеристика:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedClass.primaryAbility.map(a => (
                    <span key={a} className="px-2 py-0.5 bg-dnd-primary/30 text-red-300 rounded text-xs">
                      {ABILITY_NAMES[a]}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-gray-400">Спасброски:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedClass.savingThrows.map(a => (
                    <span key={a} className="px-2 py-0.5 bg-blue-900/40 text-blue-300 rounded text-xs">
                      {ABILITY_NAMES[a]}
                    </span>
                  ))}
                </div>
              </div>
              {selectedClass.spellcaster && (
                <div className="flex gap-2">
                  <span className="text-gray-400 shrink-0">Заклинатель:</span>
                  <span className="text-purple-300">
                    {ABILITY_NAMES[selectedClass.spellcastingAbility!]}
                  </span>
                </div>
              )}
              <div className="flex gap-2">
                <span className="text-gray-400 shrink-0">Доспехи:</span>
                <span className="text-gray-200 text-xs">
                  {selectedClass.proficiencies.armor.length > 0 ? selectedClass.proficiencies.armor.join(', ') : 'Нет'}
                </span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-400 shrink-0">Оружие:</span>
                <span className="text-gray-200 text-xs">
                  {selectedClass.proficiencies.weapons.join(', ')}
                </span>
              </div>
              {selectedClass.proficiencies.tools.length > 0 && (
                <div className="flex gap-2">
                  <span className="text-gray-400 shrink-0">Инструменты:</span>
                  <span className="text-gray-200 text-xs">
                    {selectedClass.proficiencies.tools.join(', ')}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ─── Step 2: Abilities ───
  const renderAbilitiesStep = () => {
    const remaining = abilityMethod === 'pointBuy' ? getPointBuyRemaining(abilityScores) : null;

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h3 className="text-xl font-medieval text-dnd-secondary">Характеристики</h3>
          <div className="flex rounded-lg overflow-hidden border border-gray-600">
            {([
              { key: 'pointBuy' as const, label: 'Покупка очков' },
              { key: 'roll' as const, label: 'Бросок кубиков' },
              { key: 'manual' as const, label: 'Вручную' },
            ]).map(m => (
              <button
                key={m.key}
                onClick={() => switchAbilityMethod(m.key)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  abilityMethod === m.key
                    ? 'bg-dnd-secondary text-dnd-dark'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {abilityMethod === 'pointBuy' && (
          <div className="flex items-center gap-4 p-3 rounded-lg bg-gray-800/80 border border-gray-600">
            <span className="text-gray-300 text-sm">Осталось очков:</span>
            <span className={`text-2xl font-bold ${remaining! < 0 ? 'text-red-400' : remaining === 0 ? 'text-green-400' : 'text-dnd-secondary'}`}>
              {remaining} / {POINT_BUY_TOTAL}
            </span>
          </div>
        )}

        {abilityMethod === 'roll' && (
          <div className="flex items-center gap-4">
            <button
              onClick={handleRollAbilities}
              className="px-5 py-2 bg-dnd-primary text-white rounded-lg hover:bg-dnd-primary/80 flex items-center gap-2 font-medium"
            >
              <Dices size={18} />
              Бросить заново (4d6 без наименьшего)
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {(Object.keys(abilityScores) as Array<keyof AbilityScores>).map(ability => {
            const base = abilityScores[ability];
            const bonus = activeBonuses[ability] || 0;
            const final = base + bonus;
            const mod = getAbilityModifier(final);

            return (
              <div key={ability} className="bg-gray-800/80 rounded-lg border border-gray-600 p-4 text-center">
                <div className="text-sm text-gray-400 mb-1">{ABILITY_NAMES[ability]}</div>
                <div className="text-3xl font-bold text-white mb-1">{final}</div>
                <div className={`text-sm font-semibold mb-3 ${mod >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatModifier(mod)}
                </div>

                {abilityMethod === 'pointBuy' && (
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => handlePointBuyChange(ability, -1)}
                      disabled={!canDecreasePointBuy(abilityScores, ability)}
                      className="w-8 h-8 rounded bg-gray-700 text-white hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      <ChevronDown size={16} />
                    </button>
                    <span className="text-sm text-gray-400 w-6">{base}</span>
                    <button
                      onClick={() => handlePointBuyChange(ability, 1)}
                      disabled={!canIncreasePointBuy(abilityScores, ability)}
                      className="w-8 h-8 rounded bg-gray-700 text-white hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      <ChevronUp size={16} />
                    </button>
                  </div>
                )}

                {abilityMethod === 'manual' && (
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={base}
                    onChange={e => handleManualChange(ability, parseInt(e.target.value))}
                    className="w-16 text-center bg-gray-700 text-white rounded border border-gray-500 px-2 py-1"
                  />
                )}

                {abilityMethod === 'roll' && (
                  <div className="text-xs text-gray-500">базовое: {base}</div>
                )}

                {bonus > 0 && (
                  <div className="text-xs text-dnd-secondary mt-1">+{bonus} раса</div>
                )}

                {abilityMethod === 'pointBuy' && (
                  <div className="text-xs text-gray-500 mt-1">
                    стоимость: {POINT_BUY_COSTS[base]}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Racial Bonus Mode */}
        {selectedRace && (
          <div className="bg-gray-800/80 rounded-lg border border-gray-600 p-4">
            <h4 className="text-lg font-medieval text-dnd-secondary mb-3">Расовые бонусы</h4>
            <div className="flex rounded-lg overflow-hidden border border-gray-600 mb-4 w-fit">
              <button
                onClick={() => { setRacialBonusMode('standard'); setCustomBonuses({}); }}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  racialBonusMode === 'standard'
                    ? 'bg-dnd-secondary text-dnd-dark'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                Стандартные ({selectedRace.name})
              </button>
              <button
                onClick={() => { setRacialBonusMode('custom'); setCustomBonuses({}); }}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  racialBonusMode === 'custom'
                    ? 'bg-dnd-secondary text-dnd-dark'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                Свободное распределение
              </button>
            </div>

            {racialBonusMode === 'standard' ? (
              <div className="flex flex-wrap gap-2">
                {Object.entries(standardBonuses).map(([key, val]) => (
                  val ? (
                    <span key={key} className="px-3 py-1 bg-dnd-secondary/20 text-dnd-secondary rounded-lg text-sm">
                      {ABILITY_NAMES[key as keyof AbilityScores]} +{val}
                    </span>
                  ) : null
                ))}
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-sm text-gray-300">
                    Распределите {totalBonusPoints} очков (макс. +2 на характеристику)
                  </span>
                  <span className={`font-bold ${customBonusSpent === totalBonusPoints ? 'text-green-400' : 'text-dnd-secondary'}`}>
                    {customBonusSpent} / {totalBonusPoints}
                  </span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {(Object.keys(abilityScores) as Array<keyof AbilityScores>).map(ability => (
                    <div key={ability} className="text-center">
                      <div className="text-xs text-gray-400 mb-1">{ABILITY_NAMES[ability]}</div>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleCustomBonusChange(ability, -1)}
                          disabled={(customBonuses[ability] || 0) <= 0}
                          className="w-6 h-6 rounded bg-gray-700 text-white text-xs hover:bg-gray-600 disabled:opacity-30 flex items-center justify-center"
                        >
                          -
                        </button>
                        <span className="text-dnd-secondary font-bold w-5 text-center">
                          +{customBonuses[ability] || 0}
                        </span>
                        <button
                          onClick={() => handleCustomBonusChange(ability, 1)}
                          disabled={(customBonuses[ability] || 0) >= 2 || customBonusSpent >= totalBonusPoints}
                          className="w-6 h-6 rounded bg-gray-700 text-white text-xs hover:bg-gray-600 disabled:opacity-30 flex items-center justify-center"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ─── Step 2: Background ───
  const renderBackgroundStep = () => (
    <div className="flex flex-col lg:flex-row gap-6 h-full">
      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        <h3 className="text-xl font-medieval text-dnd-secondary mb-4">Выберите предысторию</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
          {BACKGROUND_REGISTRY.map(bg => (
            <button
              key={bg.id}
              onClick={() => setSelectedBackground(bg)}
              className={`rounded-lg border-2 text-left transition-all hover:scale-[1.02] p-3 ${
                selectedBackground?.id === bg.id
                  ? 'border-dnd-secondary bg-dnd-secondary/10 shadow-lg shadow-dnd-secondary/20'
                  : 'border-gray-600 bg-gray-800/50 hover:border-gray-400'
              }`}
            >
              <div className={`font-semibold text-sm ${selectedBackground?.id === bg.id ? 'text-dnd-secondary' : 'text-gray-200'}`}>
                {bg.name}
              </div>
              <div className="text-xs text-gray-400 mt-1">{bg.feat}</div>
              <div className="text-xs text-gray-500 mt-1">{bg.skillProficiencies.join(', ')}</div>
            </button>
          ))}
        </div>
      </div>

      {selectedBackground && (
        <div className="w-full lg:w-96 shrink-0 bg-gray-800/80 rounded-lg border border-gray-600 overflow-y-auto p-5 space-y-3">
          <h3 className="text-xl font-medieval text-dnd-secondary">{selectedBackground.name}</h3>
          <p className="text-sm text-gray-300 leading-relaxed">{selectedBackground.description}</p>

          <div className="space-y-2 text-sm">
            <div>
              <span className="text-gray-400">Черта:</span>
              <span className="text-purple-300 ml-2 font-medium">{selectedBackground.feat}</span>
            </div>
            <div>
              <span className="text-gray-400">Навыки:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {selectedBackground.skillProficiencies.map(s => (
                  <span key={s} className="px-2 py-0.5 bg-blue-900/40 text-blue-300 rounded text-xs">{s}</span>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-400 shrink-0">Инструменты:</span>
              <span className="text-gray-200">{selectedBackground.toolProficiency}</span>
            </div>
            <div>
              <span className="text-gray-400">Связанные характеристики:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {selectedBackground.abilityOptions.map(a => (
                  <span key={a} className="px-2 py-0.5 bg-dnd-secondary/20 text-dnd-secondary rounded text-xs">
                    {ABILITY_NAMES[a]}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <span className="text-gray-400">Снаряжение:</span>
              <p className="text-xs text-gray-300 mt-1 leading-relaxed">{selectedBackground.equipment}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ─── Step 4: Details ───
  const renderDetailsStep = () => (
    <div className="max-w-lg mx-auto space-y-6">
      <h3 className="text-xl font-medieval text-dnd-secondary text-center">Детали персонажа</h3>

      <div>
        <label className="block text-sm text-gray-300 mb-2">Имя персонажа *</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Введите имя персонажа"
          className="w-full px-4 py-3 bg-gray-800 border-2 border-gray-600 rounded-lg text-white focus:outline-none focus:border-dnd-secondary transition-colors"
        />
      </div>

      {selectedBackground && (
        <div className="bg-gray-800/80 rounded-lg border border-gray-600 p-4">
          <div className="text-sm text-gray-400 mb-1">Предыстория</div>
          <div className="text-lg text-dnd-secondary font-medieval">{selectedBackground.name}</div>
          <div className="text-xs text-gray-400 mt-1">Черта: {selectedBackground.feat}</div>
        </div>
      )}

      <div className="bg-gray-800/80 rounded-lg border border-gray-600 p-4">
        <div className="text-sm text-gray-400 mb-1">Уровень</div>
        <div className="text-lg text-white font-bold">1</div>
        <div className="text-xs text-gray-500 mt-1">Повышение уровня доступно на странице персонажа</div>
      </div>
    </div>
  );

  // ─── Step 5: Review ───
  const renderReviewStep = () => {
    if (!selectedRace || !selectedClass || !selectedBackground) return null;
    const level = 1;
    const profBonus = getProficiencyBonus(level);
    const finalScores: AbilityScores = {
      strength: getFinalScore('strength'),
      dexterity: getFinalScore('dexterity'),
      constitution: getFinalScore('constitution'),
      intelligence: getFinalScore('intelligence'),
      wisdom: getFinalScore('wisdom'),
      charisma: getFinalScore('charisma'),
    };
    const maxHP = calculateMaxHP(level, finalScores.constitution, selectedClass.hitDie);

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <h3 className="text-xl font-medieval text-dnd-secondary text-center">Обзор персонажа</h3>

        <div className="bg-gray-800/80 rounded-lg border border-dnd-secondary p-6">
          <h2 className="text-3xl font-medieval text-white mb-1">{name || 'Без имени'}</h2>
          <p className="text-dnd-secondary text-lg">
            {selectedSubrace ? `${selectedRace.name} (${selectedSubrace.name})` : selectedRace.name}
            {' • '}
            {selectedClass.name}
            {' • '}
            1 уровень
          </p>
          <p className="text-gray-400 mt-1">Предыстория: {selectedBackground.name}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-800/80 rounded-lg border border-gray-600 p-4">
            <h4 className="text-sm text-gray-400 mb-3">Характеристики</h4>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(finalScores) as Array<keyof AbilityScores>).map(ability => (
                <div key={ability} className="flex justify-between text-sm">
                  <span className="text-gray-300">{ABILITY_NAMES[ability]}</span>
                  <span className="text-white font-bold">
                    {finalScores[ability]} ({formatModifier(getAbilityModifier(finalScores[ability]))})
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gray-800/80 rounded-lg border border-gray-600 p-4">
            <h4 className="text-sm text-gray-400 mb-3">Боевые характеристики</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-300">Хиты:</span>
                <span className="text-white font-bold">{maxHP}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Класс брони:</span>
                <span className="text-white font-bold">{10 + getAbilityModifier(finalScores.dexterity)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Инициатива:</span>
                <span className="text-white font-bold">{formatModifier(getAbilityModifier(finalScores.dexterity))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Скорость:</span>
                <span className="text-white font-bold">{selectedRace.speed} фт.</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Бонус мастерства:</span>
                <span className="text-white font-bold">{formatModifier(profBonus)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Кость хитов:</span>
                <span className="text-white font-bold">{selectedClass.hitDie}</span>
              </div>
            </div>
          </div>
        </div>

        {selectedClass.spellcaster && selectedClass.spellcastingAbility && (
          <div className="bg-gray-800/80 rounded-lg border border-gray-600 p-4">
            <h4 className="text-sm text-gray-400 mb-3">Заклинания</h4>
            <div className="grid grid-cols-3 gap-4 text-sm text-center">
              <div>
                <div className="text-gray-400">Характеристика</div>
                <div className="text-purple-300 font-bold">{ABILITY_NAMES[selectedClass.spellcastingAbility]}</div>
              </div>
              <div>
                <div className="text-gray-400">Сл спасброска</div>
                <div className="text-white font-bold">
                  {8 + profBonus + getAbilityModifier(finalScores[selectedClass.spellcastingAbility])}
                </div>
              </div>
              <div>
                <div className="text-gray-400">Бонус атаки</div>
                <div className="text-white font-bold">
                  {formatModifier(profBonus + getAbilityModifier(finalScores[selectedClass.spellcastingAbility]))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-gray-800/80 rounded-lg border border-gray-600 p-4">
          <h4 className="text-sm text-gray-400 mb-3">Владения</h4>
          <div className="space-y-2 text-sm">
            {selectedClass.proficiencies.armor.length > 0 && (
              <div>
                <span className="text-gray-400">Доспехи: </span>
                <span className="text-gray-200">{selectedClass.proficiencies.armor.join(', ')}</span>
              </div>
            )}
            <div>
              <span className="text-gray-400">Оружие: </span>
              <span className="text-gray-200">{selectedClass.proficiencies.weapons.join(', ')}</span>
            </div>
            {selectedClass.proficiencies.tools.length > 0 && (
              <div>
                <span className="text-gray-400">Инструменты: </span>
                <span className="text-gray-200">{selectedClass.proficiencies.tools.join(', ')}</span>
              </div>
            )}
            <div>
              <span className="text-gray-400">Языки: </span>
              <span className="text-gray-200">{selectedRace.languages.join(', ')}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ─── Main Render ───
  const renderStep = () => {
    switch (step) {
      case 0: return renderRaceStep();
      case 1: return renderClassStep();
      case 2: return renderBackgroundStep();
      case 3: return renderAbilitiesStep();
      case 4: return renderDetailsStep();
      case 5: return renderReviewStep();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with back to list */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onCancel}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
          <span>Назад к списку</span>
        </button>
        <h2 className="text-2xl font-medieval text-white">Создание персонажа</h2>
        <div className="w-32" />
      </div>

      {renderStepIndicator()}

      {/* Step content — fills remaining height */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {renderStep()}
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-700 shrink-0">
        <button
          onClick={step === 0 ? onCancel : prevStep}
          className="flex items-center gap-2 px-6 py-3 rounded-lg border border-gray-600 text-gray-300 hover:text-white hover:border-gray-400 transition-colors"
        >
          <ArrowLeft size={18} />
          {step === 0 ? 'Отмена' : 'Назад'}
        </button>

        {step < 5 ? (
          <button
            onClick={nextStep}
            disabled={!canProceed()}
            className="flex items-center gap-2 px-6 py-3 rounded-lg bg-dnd-secondary text-dnd-dark font-semibold hover:bg-dnd-secondary/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Далее
            <ArrowRight size={18} />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!canProceed() || !name.trim()}
            className="flex items-center gap-2 px-8 py-3 rounded-lg bg-dnd-primary text-white font-semibold hover:bg-dnd-primary/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-lg"
          >
            <Wand2 size={18} />
            Создать персонажа
          </button>
        )}
      </div>
    </div>
  );
};
