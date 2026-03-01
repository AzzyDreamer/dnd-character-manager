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
import type { SpeciesData } from '../data/species';
import type { JsonBackgroundData } from '../data/backgrounds/jsonBackgrounds';
import type { CharacterCreationOptionData } from '../data/charactercreationoptions';
import { ArrowLeft, ArrowRight, Dices, ChevronDown, ChevronUp, Wand2, Check, Sparkles, Swords, User, Eye, BookOpen, Search, Scroll, Loader2 } from 'lucide-react';

// ─── Хелперы для SpeciesData ───
function getSpeciesSpeed(sp: SpeciesData): number {
  if (typeof sp.speed === 'number') return sp.speed;
  if (sp.speed && typeof sp.speed === 'object') return sp.speed.walk || 30;
  return 30;
}

const SPECIES_SIZE_NAMES: Record<string, string> = {
  T: 'Крошечный', S: 'Маленький', M: 'Средний', L: 'Большой', H: 'Огромный', G: 'Гигантский',
};

function getSpeciesSize(sp: SpeciesData): string {
  return sp.size?.map(s => SPECIES_SIZE_NAMES[s] || s).join('/') || 'Средний';
}

function getSpeciesLanguages(sp: SpeciesData): string[] {
  if (!sp.languageProficiencies?.length) return ['Common'];
  const langs: string[] = [];
  for (const lp of sp.languageProficiencies) {
    for (const [k, v] of Object.entries(lp)) {
      if (k !== 'anyStandard' && k !== 'choose' && v) langs.push(k);
    }
  }
  return langs.length ? langs : ['Common'];
}

// ─── Хелперы для JsonBackgroundData ───
function getBgFeatName(bg: JsonBackgroundData): string {
  if (!bg.feats?.length) return '';
  return Object.keys(bg.feats[0])[0]?.split('|')[0] || '';
}

function getBgSkills(bg: JsonBackgroundData): string[] {
  if (!bg.skillProficiencies?.length) return [];
  return Object.keys(bg.skillProficiencies[0]).filter(k => k !== 'choose');
}

function getBgToolProficiency(bg: JsonBackgroundData): string {
  if (!bg.toolProficiencies?.length) return '';
  return Object.keys(bg.toolProficiencies[0]).filter(k => k !== 'choose').join(', ');
}

function getBgAbilityOptions(bg: JsonBackgroundData): (keyof AbilityScores)[] {
  if (!bg.ability?.length) return [];
  const result: (keyof AbilityScores)[] = [];
  const ABILITY_MAP: Record<string, keyof AbilityScores> = {
    str: 'strength', dex: 'dexterity', con: 'constitution',
    int: 'intelligence', wis: 'wisdom', cha: 'charisma',
  };
  for (const ab of bg.ability) {
    if (ab.choose?.from) {
      for (const k of ab.choose.from) {
        const mapped = ABILITY_MAP[k] || k as keyof AbilityScores;
        if (!result.includes(mapped)) result.push(mapped);
      }
    }
  }
  return result;
}

// ─── OPTION_TYPE_NAMES для char creation options ───
const OPTION_TYPE_NAMES: Record<string, string> = {
  'SG': 'Сверхъестественный Дар',
  'CS': 'Секрет Персонажа',
  'DG': 'Тёмный Дар',
  'RF:B': 'Региональная Особенность',
  'Transformation': 'Трансформация',
};

// Типы заклинаний (без прямого импорта данных — данные загрузятся лениво)
interface SpellData {
  name: string;
  level: number;
  school: string;
  duration?: { type: string; concentration?: boolean; duration?: { type: string; amount: number } }[];
  concentration?: boolean;
  [key: string]: any;
}

const SCHOOL_NAMES: Record<string, string> = {
  A: 'Ограждение', C: 'Вызов', D: 'Прорицание', E: 'Очарование',
  V: 'Воплощение', I: 'Иллюзия', N: 'Некромантия', T: 'Преобразование',
};

interface CharacterCreatorProps {
  onSave: (character: Character) => void;
  onCancel: () => void;
}

type AbilityMethod = 'pointBuy' | 'roll' | 'manual';
type BackgroundBonusMode = 'background' | 'custom';

const STEPS = [
  { key: 'race', label: 'Раса', icon: Sparkles },
  { key: 'class', label: 'Класс', icon: Swords },
  { key: 'background', label: 'Предыстория', icon: BookOpen },
  { key: 'charoptions', label: 'Опции', icon: Scroll },
  { key: 'abilities', label: 'Характеристики', icon: Dices },
  { key: 'spells', label: 'Заклинания', icon: Wand2 },
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

  // Species (lazy loaded)
  const [speciesLoaded, setSpeciesLoaded] = useState(false);
  const [allSpecies, setAllSpecies] = useState<SpeciesData[]>([]);
  const [selectedSpecies, setSelectedSpecies] = useState<SpeciesData | null>(null);

  // Class
  const [selectedClass, setSelectedClass] = useState<ClassDefinition | null>(null);
  const [classLevelTable, setClassLevelTable] = useState<any[] | null>(null);

  // Background (lazy loaded)
  const [backgroundsLoaded, setBackgroundsLoaded] = useState(false);
  const [allBackgrounds, setAllBackgrounds] = useState<JsonBackgroundData[]>([]);
  const [selectedBackground, setSelectedBackground] = useState<JsonBackgroundData | null>(null);

  // Character Creation Options (lazy loaded)
  const [charOptionsLoaded, setCharOptionsLoaded] = useState(false);
  const [allCharOptions, setAllCharOptions] = useState<CharacterCreationOptionData[]>([]);
  const [selectedCharOption, setSelectedCharOption] = useState<CharacterCreationOptionData | null>(null);

  // EntryRenderer for species/bg/charoptions detail
  const [EntryRendererCmp, setEntryRendererCmp] = useState<React.FC<any> | null>(null);

  // Lazy load species
  React.useEffect(() => {
    let cancelled = false;
    import('../data/species').then(async mod => {
      await mod.init();
      if (!cancelled) { setAllSpecies([...mod.ALL_SPECIES]); setSpeciesLoaded(true); }
    });
    return () => { cancelled = true; };
  }, []);

  // Lazy load backgrounds
  React.useEffect(() => {
    let cancelled = false;
    import('../data/backgrounds/jsonBackgrounds').then(async mod => {
      await mod.init();
      if (!cancelled) { setAllBackgrounds([...mod.ALL_JSON_BACKGROUNDS]); setBackgroundsLoaded(true); }
    });
    return () => { cancelled = true; };
  }, []);

  // Lazy load char creation options
  React.useEffect(() => {
    let cancelled = false;
    import('../data/charactercreationoptions').then(async mod => {
      await mod.init();
      if (!cancelled) { setAllCharOptions([...mod.ALL_CHARACTER_CREATION_OPTIONS]); setCharOptionsLoaded(true); }
    });
    return () => { cancelled = true; };
  }, []);

  // Lazy load EntryRenderer
  React.useEffect(() => {
    import('../utils/entryRenderer').then(mod => {
      setEntryRendererCmp(() => mod.EntryRenderer);
    });
  }, []);

  // Lazy load class levelTable when class changes
  React.useEffect(() => {
    if (!selectedClass) { setClassLevelTable(null); return; }
    let cancelled = false;
    import('../data/classes/classJsonLoader').then(async mod => {
      await mod.init();
      if (cancelled) return;
      const data = mod.getClassDataByName(selectedClass.name);
      setClassLevelTable(data?.levelTable ?? null);
    });
    return () => { cancelled = true; };
  }, [selectedClass]);

  // Abilities
  const [abilityMethod, setAbilityMethod] = useState<AbilityMethod>('pointBuy');
  const [abilityScores, setAbilityScores] = useState<AbilityScores>({ ...DEFAULT_SCORES });
  const [backgroundBonusMode, setBackgroundBonusMode] = useState<BackgroundBonusMode>('background');
  const [bgBonus2, setBgBonus2] = useState<keyof AbilityScores | null>(null);
  const [bgBonus1, setBgBonus1] = useState<keyof AbilityScores | null>(null);
  const [customBonuses, setCustomBonuses] = useState<Partial<AbilityScores>>({});

  // Spells
  const [selectedSpells, setSelectedSpells] = useState<SpellData[]>([]);
  const [selectedCantrips, setSelectedCantrips] = useState<SpellData[]>([]);
  const [spellSearchQuery, setSpellSearchQuery] = useState('');

  // Details
  const [name, setName] = useState('');

  // Computed background bonuses (2024 rules: +2/+1 from background, not race)
  const activeBonuses = useMemo<Partial<AbilityScores>>(() => {
    if (backgroundBonusMode === 'custom') return customBonuses;
    const bonuses: Partial<AbilityScores> = {};
    if (bgBonus2) bonuses[bgBonus2] = 2;
    if (bgBonus1) bonuses[bgBonus1] = 1;
    return bonuses;
  }, [backgroundBonusMode, bgBonus2, bgBonus1, customBonuses]);

  const customBonusSpent = useMemo(() => {
    return Object.values(customBonuses).reduce((sum, v) => sum + (v || 0), 0);
  }, [customBonuses]);

  const getFinalScore = (ability: keyof AbilityScores): number => {
    return abilityScores[ability] + (activeBonuses[ability] || 0);
  };

  // Доступные заклинания для класса (загружаются лениво)
  const [spellsLoaded, setSpellsLoaded] = useState(false);
  const [loadedSpells, setLoadedSpells] = useState<SpellData[]>([]);

  React.useEffect(() => {
    if (!selectedClass?.spellcaster) return;
    let cancelled = false;
    import('../data/spells').then(async mod => {
      await mod.init(); // Инициализируем данные заклинаний
      if (cancelled) return;
      const spells = mod.getSpellsByClass(selectedClass.name);
      setLoadedSpells(spells);
      setSpellsLoaded(true);
    });
    return () => { cancelled = true; };
  }, [selectedClass]);

  const availableSpells = useMemo(() => {
    if (!selectedClass?.spellcaster || !spellsLoaded) return { cantrips: [] as SpellData[], leveled: [] as SpellData[] };
    const cantrips = loadedSpells.filter(s => s.level === 0);
    const leveled = loadedSpells.filter(s => s.level === 1);
    return { cantrips, leveled };
  }, [selectedClass, spellsLoaded, loadedSpells]);

  const isSpellcaster = selectedClass?.spellcaster ?? false;
  // Берём лимиты заговоров и заклинаний из levelTable класса (уровень 1)
  const level1Data = classLevelTable?.find((r: any) => r.level === 1);
  const maxCantrips = level1Data?.cantrips ?? (isSpellcaster ? 2 : 0);
  const maxSpells = level1Data?.preparedSpells ?? (isSpellcaster ? Math.max(1, 1 + (activeBonuses[selectedClass?.spellcastingAbility as keyof AbilityScores] || 0)) : 0);

  // Navigation (8 шагов для заклинателя, 7 для остальных — пропускаем spells)
  // Steps: 0=race, 1=class, 2=background, 3=charoptions, 4=abilities, 5=spells, 6=details, 7=review
  const getEffectiveStep = (s: number): string => {
    // step variable directly maps to STEPS index; spells skip handled by nextStep/prevStep
    return STEPS[s]?.key ?? 'review';
  };

  const canProceed = (): boolean => {
    const effectiveKey = getEffectiveStep(step);
    switch (effectiveKey) {
      case 'race': return selectedSpecies !== null;
      case 'class': return selectedClass !== null;
      case 'background': return selectedBackground !== null;
      case 'charoptions': return true; // Информационный шаг
      case 'abilities': {
        if (abilityMethod === 'pointBuy' && getPointBuyRemaining(abilityScores) < 0) return false;
        if (backgroundBonusMode === 'background' && (!bgBonus2 || !bgBonus1)) return false;
        if (backgroundBonusMode === 'custom' && customBonusSpent !== 3) return false;
        return true;
      }
      case 'spells': return true; // Заклинания опциональны
      case 'details': return name.trim().length > 0;
      default: return true;
    }
  };

  const maxStep = isSpellcaster ? 7 : 6;
  const nextStep = () => {
    if (canProceed()) {
      setStep(s => {
        let next = s + 1;
        // Пропускаем шаг заклинаний если не заклинатель
        if (!isSpellcaster && next === 5) next = 6;
        return Math.min(next, maxStep);
      });
    }
  };
  const prevStep = () => {
    setStep(s => {
      let prev = s - 1;
      if (!isSpellcaster && prev === 5) prev = 4;
      return Math.max(prev, 0);
    });
  };

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
      if (newTotal > 3) return prev;
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
    if (!selectedSpecies || !selectedClass || !selectedBackground) return;

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
    const bgTool = getBgToolProficiency(selectedBackground);
    const allTools = [...selectedClass.proficiencies.tools];
    if (bgTool && !allTools.includes(bgTool)) {
      allTools.push(bgTool);
    }

    const bgFeat = getBgFeatName(selectedBackground);

    const character: Character = {
      id: crypto.randomUUID(),
      name,
      race: selectedSpecies.name,
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
        languages: getSpeciesLanguages(selectedSpecies),
      },
      armorClass: 10 + getAbilityModifier(finalScores.dexterity),
      initiative: getAbilityModifier(finalScores.dexterity),
      speed: getSpeciesSpeed(selectedSpecies),
      proficiencyBonus,
      inventory: [],
      equipment: {},
      currency: { copper: 0, silver: 0, electrum: 0, gold: 0, platinum: 0 },
      features: bgFeat ? [{ id: 'bg-feat', name: bgFeat, description: `Черта от предыстории: ${selectedBackground.name}`, source: selectedBackground.source }] : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (selectedClass.spellcaster && selectedClass.spellcastingAbility) {
      const abilityMod = getAbilityModifier(finalScores[selectedClass.spellcastingAbility]);
      const allSelectedSpells = [
        ...selectedCantrips.map(s => ({
          spellId: s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          name: s.name,
          level: 0,
          prepared: true,
          alwaysPrepared: true,
        })),
        ...selectedSpells.map(s => ({
          spellId: s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          name: s.name,
          level: s.level,
          prepared: true,
        })),
      ];
      character.spellcasting = {
        ability: selectedClass.spellcastingAbility,
        spellSaveDC: 8 + proficiencyBonus + abilityMod,
        spellAttackBonus: proficiencyBonus + abilityMod,
        spells: allSelectedSpells,
        cantripsKnown: maxCantrips,
        spellsKnown: maxSpells,
      };

      // Инициализировать spell slots из levelTable
      if (level1Data?.spellSlots) {
        const slots = level1Data.spellSlots as number[];
        character.spellcasting.spellSlots = {
          level1: { total: slots[0] || 0, used: 0 },
          level2: { total: slots[1] || 0, used: 0 },
          level3: { total: slots[2] || 0, used: 0 },
          level4: { total: slots[3] || 0, used: 0 },
          level5: { total: slots[4] || 0, used: 0 },
          level6: { total: slots[5] || 0, used: 0 },
          level7: { total: slots[6] || 0, used: 0 },
          level8: { total: slots[7] || 0, used: 0 },
          level9: { total: slots[8] || 0, used: 0 },
        };
      }
    }

    onSave(character);
  };

  // ─── Step Indicator ───
  const visibleSteps = isSpellcaster ? STEPS : STEPS.filter(s => s.key !== 'spells');
  const [speciesSearchQuery, setSpeciesSearchQuery] = useState('');
  const [bgSearchQuery, setBgSearchQuery] = useState('');
  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-0 mb-4">
      {visibleSteps.map((s, vi) => {
        const Icon = s.icon;
        // Найдём реальный индекс в STEPS
        const realIndex = STEPS.findIndex(st => st.key === s.key);
        const isActive = realIndex === step;
        const isDone = realIndex < step;
        return (
          <React.Fragment key={s.key}>
            {vi > 0 && (
              <div className={`h-0.5 w-8 sm:w-12 ${isDone ? 'bg-dnd-secondary' : 'bg-gray-600'}`} />
            )}
            <button
              onClick={() => { if (isDone) setStep(realIndex); }}
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

  // ─── Step 0: Race (Species) ───
  const filteredSpecies = useMemo(() => {
    const q = speciesSearchQuery.toLowerCase().trim();
    if (!q) return allSpecies;
    return allSpecies.filter(sp => sp.name.toLowerCase().includes(q));
  }, [allSpecies, speciesSearchQuery]);

  const renderRaceStep = () => (
    <div className="flex flex-col lg:flex-row gap-6 h-full">
      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        <h3 className="text-xl font-medieval text-dnd-secondary mb-4">Выберите вид</h3>

        {!speciesLoaded ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={32} className="animate-spin text-dnd-secondary" />
            <span className="ml-3 text-gray-400">Загрузка видов...</span>
          </div>
        ) : (
          <>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Поиск видов..."
                value={speciesSearchQuery}
                onChange={e => setSpeciesSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-dnd-secondary"
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredSpecies.map((sp, idx) => {
                const spId = sp.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                return (
                  <button
                    key={`${sp.name}-${idx}`}
                    onClick={() => setSelectedSpecies(sp)}
                    className={`rounded-lg border-2 text-left transition-all hover:scale-[1.02] overflow-hidden ${
                      selectedSpecies?.name === sp.name && selectedSpecies?.source === sp.source
                        ? 'border-dnd-secondary bg-dnd-secondary/10 shadow-lg shadow-dnd-secondary/20'
                        : 'border-gray-600 bg-gray-800/50 hover:border-gray-400'
                    }`}
                  >
                    <EntityImage folder="races" id={spId} name={sp.name} className="w-full h-32 rounded-t-md" />
                    <div className="p-2">
                      <div className={`font-semibold text-sm ${selectedSpecies?.name === sp.name && selectedSpecies?.source === sp.source ? 'text-dnd-secondary' : 'text-gray-200'}`}>
                        {sp.name}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">{sp.source}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {selectedSpecies && (
        <div className="w-full lg:w-96 shrink-0 bg-gray-800/80 rounded-lg border border-gray-600 overflow-y-auto">
          <EntityImage
            folder="races"
            id={selectedSpecies.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}
            name={selectedSpecies.name}
            className="w-full h-52"
          />
          <div className="p-5 space-y-3">
            <h3 className="text-xl font-medieval text-dnd-secondary">{selectedSpecies.name}</h3>
            <div className="text-xs text-gray-400">{selectedSpecies.source}</div>

            <div className="space-y-2 text-sm">
              <div className="flex gap-2">
                <span className="text-gray-400 shrink-0">Скорость:</span>
                <span className="text-white">{getSpeciesSpeed(selectedSpecies)} фт.</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-400 shrink-0">Размер:</span>
                <span className="text-white">{getSpeciesSize(selectedSpecies)}</span>
              </div>
              {selectedSpecies.darkvision && (
                <div className="flex gap-2">
                  <span className="text-gray-400 shrink-0">Тёмное зрение:</span>
                  <span className="text-white">{selectedSpecies.darkvision} фт.</span>
                </div>
              )}
              <div className="flex gap-2">
                <span className="text-gray-400 shrink-0">Языки:</span>
                <span className="text-white">{getSpeciesLanguages(selectedSpecies).join(', ')}</span>
              </div>
            </div>

            {/* Entries через EntryRenderer */}
            {selectedSpecies.entries && selectedSpecies.entries.length > 0 && EntryRendererCmp && (
              <div className="pt-3 border-t border-gray-700">
                <div className="prose prose-invert prose-sm max-w-none text-xs">
                  <EntryRendererCmp entries={selectedSpecies.entries} context={selectedSpecies.name} />
                </div>
              </div>
            )}
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
                  <div className="text-xs text-dnd-secondary mt-1">+{bonus} предыстория</div>
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

        {/* Background Bonus Mode (2024 rules) */}
        {selectedBackground && (
          <div className="bg-gray-800/80 rounded-lg border border-gray-600 p-4">
            <h4 className="text-lg font-medieval text-dnd-secondary mb-3">Бонусы предыстории</h4>
            <div className="flex rounded-lg overflow-hidden border border-gray-600 mb-4 w-fit">
              <button
                onClick={() => { setBackgroundBonusMode('background'); setCustomBonuses({}); }}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  backgroundBonusMode === 'background'
                    ? 'bg-dnd-secondary text-dnd-dark'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                По предыстории ({selectedBackground.name})
              </button>
              <button
                onClick={() => { setBackgroundBonusMode('custom'); setBgBonus2(null); setBgBonus1(null); setCustomBonuses({}); }}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  backgroundBonusMode === 'custom'
                    ? 'bg-dnd-secondary text-dnd-dark'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                Свободное распределение
              </button>
            </div>

            {backgroundBonusMode === 'background' ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-400">Выберите +2 к одной и +1 к другой из связанных характеристик:</p>
                <div className="grid grid-cols-3 gap-3">
                  {getBgAbilityOptions(selectedBackground).map(ability => {
                    const is2 = bgBonus2 === ability;
                    const is1 = bgBonus1 === ability;
                    return (
                      <div key={ability} className="text-center space-y-2">
                        <div className="text-sm text-gray-300 font-medium">{ABILITY_NAMES[ability]}</div>
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => {
                              if (is2) { setBgBonus2(null); }
                              else { if (bgBonus1 === ability) setBgBonus1(null); setBgBonus2(ability); }
                            }}
                            className={`px-3 py-1.5 rounded text-sm font-bold transition-all ${
                              is2
                                ? 'bg-dnd-secondary text-dnd-dark ring-2 ring-dnd-secondary/50'
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                          >
                            +2
                          </button>
                          <button
                            onClick={() => {
                              if (is1) { setBgBonus1(null); }
                              else { if (bgBonus2 === ability) setBgBonus2(null); setBgBonus1(ability); }
                            }}
                            className={`px-3 py-1.5 rounded text-sm font-bold transition-all ${
                              is1
                                ? 'bg-dnd-secondary/70 text-dnd-dark ring-2 ring-dnd-secondary/30'
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                          >
                            +1
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {bgBonus2 && bgBonus1 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="px-3 py-1 bg-dnd-secondary/20 text-dnd-secondary rounded-lg text-sm">
                      {ABILITY_NAMES[bgBonus2]} +2
                    </span>
                    <span className="px-3 py-1 bg-dnd-secondary/20 text-dnd-secondary rounded-lg text-sm">
                      {ABILITY_NAMES[bgBonus1]} +1
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-sm text-gray-300">
                    Распределите 3 очка (макс. +2 на характеристику)
                  </span>
                  <span className={`font-bold ${customBonusSpent === 3 ? 'text-green-400' : 'text-dnd-secondary'}`}>
                    {customBonusSpent} / 3
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
                          disabled={(customBonuses[ability] || 0) >= 2 || customBonusSpent >= 3}
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
  const filteredBackgrounds = useMemo(() => {
    const q = bgSearchQuery.toLowerCase().trim();
    if (!q) return allBackgrounds;
    return allBackgrounds.filter(bg => bg.name.toLowerCase().includes(q));
  }, [allBackgrounds, bgSearchQuery]);

  const renderBackgroundStep = () => (
    <div className="flex flex-col lg:flex-row gap-6 h-full">
      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        <h3 className="text-xl font-medieval text-dnd-secondary mb-4">Выберите предысторию</h3>

        {!backgroundsLoaded ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={32} className="animate-spin text-dnd-secondary" />
            <span className="ml-3 text-gray-400">Загрузка предысторий...</span>
          </div>
        ) : (
          <>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Поиск предысторий..."
                value={bgSearchQuery}
                onChange={e => setBgSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-dnd-secondary"
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredBackgrounds.map((bg, idx) => (
                <button
                  key={`${bg.name}-${idx}`}
                  onClick={() => { setSelectedBackground(bg); setBgBonus2(null); setBgBonus1(null); setCustomBonuses({}); }}
                  className={`rounded-lg border-2 text-left transition-all hover:scale-[1.02] p-3 ${
                    selectedBackground?.name === bg.name && selectedBackground?.source === bg.source
                      ? 'border-dnd-secondary bg-dnd-secondary/10 shadow-lg shadow-dnd-secondary/20'
                      : 'border-gray-600 bg-gray-800/50 hover:border-gray-400'
                  }`}
                >
                  <div className={`font-semibold text-sm ${selectedBackground?.name === bg.name && selectedBackground?.source === bg.source ? 'text-dnd-secondary' : 'text-gray-200'}`}>
                    {bg.name}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">{getBgFeatName(bg)}</div>
                  <div className="text-xs text-gray-500 mt-1">{getBgSkills(bg).join(', ')}</div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {selectedBackground && (
        <div className="w-full lg:w-96 shrink-0 bg-gray-800/80 rounded-lg border border-gray-600 overflow-y-auto p-5 space-y-3">
          <h3 className="text-xl font-medieval text-dnd-secondary">{selectedBackground.name}</h3>
          <div className="text-xs text-gray-400">{selectedBackground.source}</div>

          <div className="space-y-2 text-sm">
            {getBgFeatName(selectedBackground) && (
              <div>
                <span className="text-gray-400">Черта:</span>
                <span className="text-purple-300 ml-2 font-medium">{getBgFeatName(selectedBackground)}</span>
              </div>
            )}
            {getBgSkills(selectedBackground).length > 0 && (
              <div>
                <span className="text-gray-400">Навыки:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {getBgSkills(selectedBackground).map(s => (
                    <span key={s} className="px-2 py-0.5 bg-blue-900/40 text-blue-300 rounded text-xs">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {getBgToolProficiency(selectedBackground) && (
              <div className="flex gap-2">
                <span className="text-gray-400 shrink-0">Инструменты:</span>
                <span className="text-gray-200">{getBgToolProficiency(selectedBackground)}</span>
              </div>
            )}
            {getBgAbilityOptions(selectedBackground).length > 0 && (
              <div>
                <span className="text-gray-400">Связанные характеристики:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {getBgAbilityOptions(selectedBackground).map(a => (
                    <span key={a} className="px-2 py-0.5 bg-dnd-secondary/20 text-dnd-secondary rounded text-xs">
                      {ABILITY_NAMES[a]}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Entries через EntryRenderer */}
          {selectedBackground.entries && selectedBackground.entries.length > 0 && EntryRendererCmp && (
            <div className="pt-3 border-t border-gray-700">
              <div className="prose prose-invert prose-sm max-w-none text-xs">
                <EntryRendererCmp entries={selectedBackground.entries} context={selectedBackground.name} />
              </div>
            </div>
          )}
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
          <div className="text-xs text-gray-400 mt-1">Черта: {getBgFeatName(selectedBackground)}</div>
        </div>
      )}

      <div className="bg-gray-800/80 rounded-lg border border-gray-600 p-4">
        <div className="text-sm text-gray-400 mb-1">Уровень</div>
        <div className="text-lg text-white font-bold">1</div>
        <div className="text-xs text-gray-500 mt-1">Повышение уровня доступно на странице персонажа</div>
      </div>
    </div>
  );

  // ─── Step 3: Character Creation Options ───
  const renderCharOptionsStep = () => {
    if (!charOptionsLoaded) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={32} className="animate-spin text-dnd-secondary" />
          <span className="ml-3 text-gray-400">Загрузка опций создания...</span>
        </div>
      );
    }

    // Группировка по типу опции
    const grouped = new Map<string, CharacterCreationOptionData[]>();
    for (const opt of allCharOptions) {
      const typeKey = opt.optionType?.[0] || 'Other';
      if (!grouped.has(typeKey)) grouped.set(typeKey, []);
      grouped.get(typeKey)!.push(opt);
    }

    return (
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="text-xl font-medieval text-dnd-secondary">Опции создания персонажа</h3>
          <p className="text-sm text-gray-400 mt-1">
            Необязательный шаг — ознакомьтесь с дополнительными опциями для вашего персонажа
          </p>
        </div>

        {selectedCharOption ? (
          <div className="space-y-4">
            <button
              onClick={() => setSelectedCharOption(null)}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={14} />
              Назад к списку
            </button>
            <div className="bg-gray-800/80 rounded-lg border border-dnd-secondary p-6">
              <h3 className="text-2xl font-medieval text-white mb-1">{selectedCharOption.name}</h3>
              <div className="text-sm text-dnd-secondary mb-4">
                {selectedCharOption.optionType?.map(t => OPTION_TYPE_NAMES[t] || t).join(', ')}
                {' • '}{selectedCharOption.source}
              </div>
              {EntryRendererCmp && selectedCharOption.entries && (
                <div className="prose prose-invert max-w-none text-sm">
                  <EntryRendererCmp entries={selectedCharOption.entries} />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {Array.from(grouped.entries()).map(([typeKey, options]) => (
              <div key={typeKey}>
                <h4 className="text-lg font-medieval text-dnd-secondary mb-3">
                  {OPTION_TYPE_NAMES[typeKey] || typeKey}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {options.map(opt => (
                    <button
                      key={`${opt.name}-${opt.source}`}
                      onClick={() => setSelectedCharOption(opt)}
                      className="text-left p-3 bg-gray-800/80 rounded-lg border border-gray-600 hover:border-dnd-secondary transition-colors"
                    >
                      <div className="text-white font-medium text-sm">{opt.name}</div>
                      <div className="text-xs text-gray-400 mt-1">{opt.source}</div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ─── Step 7: Review ───
  const renderReviewStep = () => {
    if (!selectedSpecies || !selectedClass || !selectedBackground) return null;
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
            {selectedSpecies.name}
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
                <span className="text-white font-bold">{getSpeciesSpeed(selectedSpecies)} фт.</span>
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
              <span className="text-gray-200">{getSpeciesLanguages(selectedSpecies).join(', ')}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ─── Step 4: Spells (только для заклинателей) ───
  const renderSpellsStep = () => {
    if (!selectedClass?.spellcaster) return null;

    const q = spellSearchQuery.toLowerCase().trim();
    const filteredCantrips = q
      ? availableSpells.cantrips.filter(s => s.name.toLowerCase().includes(q))
      : availableSpells.cantrips;
    const filteredLeveled = q
      ? availableSpells.leveled.filter(s => s.name.toLowerCase().includes(q))
      : availableSpells.leveled;

    const toggleCantrip = (spell: SpellData) => {
      setSelectedCantrips(prev => {
        const exists = prev.find(s => s.name === spell.name);
        if (exists) return prev.filter(s => s.name !== spell.name);
        if (prev.length >= maxCantrips) return prev;
        return [...prev, spell];
      });
    };

    const toggleSpell = (spell: SpellData) => {
      setSelectedSpells(prev => {
        const exists = prev.find(s => s.name === spell.name);
        if (exists) return prev.filter(s => s.name !== spell.name);
        return [...prev, spell];
      });
    };

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-medieval text-dnd-secondary">Выберите заклинания</h3>
          <div className="text-sm text-gray-400">
            {selectedClass.name} • {ABILITY_NAMES[selectedClass.spellcastingAbility!]}
          </div>
        </div>

        {/* Поиск */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Поиск заклинаний..."
            value={spellSearchQuery}
            onChange={e => setSpellSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-dnd-secondary"
          />
        </div>

        {/* Заговоры */}
        <div>
          <h4 className="text-lg font-medieval text-purple-300 mb-2">
            Заговоры
            <span className="text-sm font-normal text-gray-400 ml-2">
              ({selectedCantrips.length}/{maxCantrips})
            </span>
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
            {filteredCantrips.map(spell => {
              const isSelected = selectedCantrips.some(s => s.name === spell.name);
              return (
                <button
                  key={spell.name}
                  onClick={() => toggleCantrip(spell)}
                  disabled={!isSelected && selectedCantrips.length >= maxCantrips}
                  className={`p-2 rounded-lg border text-left text-xs transition-all ${
                    isSelected
                      ? 'border-purple-500 bg-purple-900/30 text-purple-200'
                      : 'border-gray-600 bg-gray-800/50 text-gray-300 hover:border-gray-400 disabled:opacity-40'
                  }`}
                >
                  <div className="font-semibold truncate">{spell.name}</div>
                  <div className="text-gray-500 text-[10px]">{SCHOOL_NAMES[spell.school] || spell.school}</div>
                </button>
              );
            })}
            {filteredCantrips.length === 0 && (
              <div className="col-span-full text-center text-gray-500 py-4 text-sm">
                {spellSearchQuery ? 'Ничего не найдено' : 'Нет доступных заговоров'}
              </div>
            )}
          </div>
        </div>

        {/* Заклинания 1 уровня */}
        <div>
          <h4 className="text-lg font-medieval text-blue-300 mb-2">
            Заклинания 1 уровня
            <span className="text-sm font-normal text-gray-400 ml-2">
              (выбрано: {selectedSpells.length})
            </span>
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-64 overflow-y-auto">
            {filteredLeveled.map(spell => {
              const isSelected = selectedSpells.some(s => s.name === spell.name);
              return (
                <button
                  key={spell.name}
                  onClick={() => toggleSpell(spell)}
                  className={`p-2 rounded-lg border text-left text-xs transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-900/30 text-blue-200'
                      : 'border-gray-600 bg-gray-800/50 text-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className="font-semibold truncate">{spell.name}</div>
                  <div className="text-gray-500 text-[10px]">
                    {SCHOOL_NAMES[spell.school] || spell.school}
                    {spell.concentration && spell.duration?.[0]?.concentration ? ' • Концентрация' : ''}
                  </div>
                </button>
              );
            })}
            {filteredLeveled.length === 0 && (
              <div className="col-span-full text-center text-gray-500 py-4 text-sm">
                {spellSearchQuery ? 'Ничего не найдено' : 'Нет доступных заклинаний'}
              </div>
            )}
          </div>
        </div>

        {/* Выбранные */}
        {(selectedCantrips.length > 0 || selectedSpells.length > 0) && (
          <div className="bg-gray-800/60 rounded-lg border border-gray-600 p-4">
            <h4 className="text-sm text-gray-400 mb-2">Выбранные заклинания:</h4>
            <div className="flex flex-wrap gap-2">
              {selectedCantrips.map(s => (
                <span key={s.name} className="px-2 py-1 bg-purple-900/40 text-purple-300 rounded text-xs flex items-center gap-1">
                  {s.name}
                  <button onClick={() => toggleCantrip(s)} className="text-purple-400 hover:text-white ml-1">&times;</button>
                </span>
              ))}
              {selectedSpells.map(s => (
                <span key={s.name} className="px-2 py-1 bg-blue-900/40 text-blue-300 rounded text-xs flex items-center gap-1">
                  {s.name}
                  <button onClick={() => toggleSpell(s)} className="text-blue-400 hover:text-white ml-1">&times;</button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─── Main Render ───
  const renderStep = () => {
    switch (step) {
      case 0: return renderRaceStep();
      case 1: return renderClassStep();
      case 2: return renderBackgroundStep();
      case 3: return renderCharOptionsStep();
      case 4: return renderAbilitiesStep();
      case 5: return renderSpellsStep();
      case 6: return renderDetailsStep();
      case 7: return renderReviewStep();
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

        {step < maxStep ? (
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
