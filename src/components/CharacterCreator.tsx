import React, { useState, useMemo } from 'react';
import type { Character, AbilityScores } from '../types';
import {
  generateAbilityScores,
  calculateMaxHP,
  getProficiencyBonus,
  getAbilityModifier,
  formatModifier,
  getSkillBonus,
  ABILITY_NAMES,
  ABILITY_SHORT,
  SKILL_ABILITIES,
  SKILL_NAMES,
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
import { ArrowLeft, ArrowRight, Dices, ChevronDown, ChevronUp, Wand2, Check, Sparkles, Swords, User, Eye, BookOpen, Search, Scroll, Loader2, Target, Star } from 'lucide-react';
import { TabBar, type Tab, CycleSelector, CharacterStatsSidebar, type CreationStats, StatBadge } from './ui';

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

const ALL_STEPS = [
  { key: 'race', label: 'Раса', icon: Sparkles },
  { key: 'class', label: 'Класс', icon: Swords },
  { key: 'background', label: 'Предыстория', icon: BookOpen },
  { key: 'originfeat', label: 'Черта', icon: Star },
  { key: 'charoptions', label: 'Опции', icon: Scroll },
  { key: 'abilities', label: 'Характеристики', icon: Dices },
  { key: 'skills', label: 'Навыки', icon: Target },
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
      <div className={`flex items-center justify-center bg-bg-panel-solid/60 text-gold font-medieval text-lg ${className}`}>
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

  // Origin Feat
  const [selectedOriginFeat, setSelectedOriginFeat] = useState<any | null>(null);
  const [originFeatsLoaded, setOriginFeatsLoaded] = useState(false);
  const [allOriginFeats, setAllOriginFeats] = useState<any[]>([]);
  const [originFeatSearch, setOriginFeatSearch] = useState('');

  // Lazy load origin feats
  React.useEffect(() => {
    let cancelled = false;
    import('../data/feats').then(async mod => {
      await mod.init();
      if (cancelled) return;
      setAllOriginFeats(mod.ALL_FEATS.filter(f => f.category === 'O'));
      setOriginFeatsLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  // Skills (reset when class changes)
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  React.useEffect(() => { setSelectedSkills([]); }, [selectedClass]);

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

  // Origin feat needed when background doesn't provide one
  const bgHasFeat = selectedBackground ? !!getBgFeatName(selectedBackground) : true;

  // Build active steps list based on conditions
  const STEPS = useMemo(() => {
    return ALL_STEPS.filter(s => {
      if (s.key === 'originfeat' && bgHasFeat) return false;
      if (s.key === 'spells' && !isSpellcaster) return false;
      return true;
    });
  }, [bgHasFeat, isSpellcaster]);

  // Clamp step when STEPS length changes
  React.useEffect(() => {
    setStep(s => Math.min(s, STEPS.length - 1));
  }, [STEPS]);

  const getEffectiveStep = (s: number): string => {
    return STEPS[s]?.key ?? 'review';
  };

  // Background skills (auto-granted)
  const backgroundSkillKeys = useMemo<string[]>(() => {
    if (!selectedBackground) return [];
    return getBgSkills(selectedBackground);
  }, [selectedBackground]);

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
      case 'originfeat': return selectedOriginFeat !== null;
      case 'skills': {
        if (!selectedClass) return false;
        return selectedSkills.length === selectedClass.proficiencies.skillChoices.count;
      }
      case 'spells': return true; // Заклинания опциональны
      case 'details': return name.trim().length > 0;
      default: return true;
    }
  };

  const maxStep = STEPS.length - 1;
  const nextStep = () => {
    if (canProceed()) {
      setStep(s => Math.min(s + 1, maxStep));
    }
  };
  const prevStep = () => {
    setStep(s => Math.max(s - 1, 0));
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
    // Determine which feat to use — background feat or selected origin feat
    const featName = bgFeat || selectedOriginFeat?.name || '';
    const featSource = bgFeat ? selectedBackground.source : (selectedOriginFeat?.source || '');

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
      skills: Object.fromEntries(
        Object.keys(SKILL_ABILITIES).map(sk => [
          sk,
          {
            proficient: selectedSkills.includes(sk) || backgroundSkillKeys.includes(sk),
            expertise: false,
          },
        ])
      ),
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
      features: featName ? [{
        id: bgFeat ? 'bg-feat' : 'origin-feat',
        name: featName,
        description: bgFeat
          ? `Черта от предыстории: ${selectedBackground.name}`
          : `Черта происхождения`,
        source: featSource,
      }] : [],
      feats: featName ? [{
        name: featName,
        source: featSource,
        category: 'O',
        levelAcquired: 1,
      }] : undefined,
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

  // ─── Creation Stats for Sidebar ───
  const creationStats = useMemo<CreationStats>(() => ({
    name: name || undefined,
    race: selectedSpecies?.name,
    className: selectedClass?.name,
    level: 1,
    abilityScores: {
      strength: getFinalScore('strength'),
      dexterity: getFinalScore('dexterity'),
      constitution: getFinalScore('constitution'),
      intelligence: getFinalScore('intelligence'),
      wisdom: getFinalScore('wisdom'),
      charisma: getFinalScore('charisma'),
    },
    proficiencies: selectedClass ? {
      armor: selectedClass.proficiencies.armor,
      weapons: selectedClass.proficiencies.weapons,
      tools: selectedClass.proficiencies.tools,
      languages: selectedSpecies ? getSpeciesLanguages(selectedSpecies) : [],
    } : undefined,
    spells: [
      ...selectedCantrips.map(s => ({ name: s.name, level: 0 })),
      ...selectedSpells.map(s => ({ name: s.name, level: s.level })),
    ],
    armorClass: 10 + getAbilityModifier(getFinalScore('dexterity')),
    hitPoints: selectedClass
      ? calculateMaxHP(1, getFinalScore('constitution'), selectedClass.hitDie)
      : undefined,
    speed: selectedSpecies ? getSpeciesSpeed(selectedSpecies) : undefined,
    proficiencyBonus: getProficiencyBonus(1),
    skills: [...selectedSkills, ...backgroundSkillKeys.filter(s => !selectedSkills.includes(s))],
  }), [name, selectedSpecies, selectedClass, selectedCantrips, selectedSpells, abilityScores, activeBonuses, selectedSkills, backgroundSkillKeys]);

  // ─── Step Indicator ───
  const [speciesSearchQuery, setSpeciesSearchQuery] = useState('');
  const [bgSearchQuery, setBgSearchQuery] = useState('');
  const stepTabs: Tab[] = useMemo(() =>
    STEPS.map((s, i) => ({
      key: s.key,
      label: s.label,
      icon: s.icon,
      disabled: i > step,
    })),
    [STEPS, step]
  );

  const handleStepTabChange = (key: string) => {
    const realIndex = STEPS.findIndex(s => s.key === key);
    if (realIndex >= 0 && realIndex <= step) setStep(realIndex);
  };

  const renderStepIndicator = () => (
    <div className="mb-4">
      <TabBar
        tabs={stepTabs}
        activeTab={STEPS[step].key}
        onTabChange={handleStepTabChange}
        size="sm"
      />
    </div>
  );

  // ─── Step 0: Race (Species) ───
  const filteredSpecies = useMemo(() => {
    const q = speciesSearchQuery.toLowerCase().trim();
    if (!q) return allSpecies;
    return allSpecies.filter(sp => sp.name.toLowerCase().includes(q));
  }, [allSpecies, speciesSearchQuery]);

  const [showAllSpecies, setShowAllSpecies] = useState(false);

  const speciesIndex = useMemo(() => {
    if (!selectedSpecies) return 0;
    return allSpecies.findIndex(sp => sp.name === selectedSpecies.name && sp.source === selectedSpecies.source);
  }, [allSpecies, selectedSpecies]);

  const renderRaceStep = () => (
    <div className="space-y-4">
      {!speciesLoaded ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={32} className="animate-spin text-gold" />
          <span className="ml-3 text-text-secondary">Загрузка видов...</span>
        </div>
      ) : (
        <>
          {/* BG3-style Cycle Selector */}
          <CycleSelector
            items={allSpecies.map(sp => ({ id: sp.name, name: sp.name }))}
            selectedIndex={speciesIndex >= 0 ? speciesIndex : 0}
            onSelect={(i) => setSelectedSpecies(allSpecies[i])}
          />

          {/* Toggle grid view */}
          <button
            onClick={() => setShowAllSpecies(!showAllSpecies)}
            className="text-xs text-text-muted hover:text-text-primary transition-colors flex items-center gap-1"
          >
            <Search size={12} />
            {showAllSpecies ? 'Скрыть список' : 'Показать все виды'}
          </button>

          {/* Expandable grid for browsing */}
          {showAllSpecies && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
                <input
                  type="text"
                  placeholder="Поиск видов..."
                  value={speciesSearchQuery}
                  onChange={e => setSpeciesSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-bg-panel-solid border border-border-default rounded-lg text-text-primary text-sm focus:outline-none focus:border-gold/50"
                />
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                {filteredSpecies.map((sp, idx) => (
                  <button
                    key={`${sp.name}-${idx}`}
                    onClick={() => { setSelectedSpecies(sp); setShowAllSpecies(false); }}
                    className={`rounded-lg border text-left p-2 text-xs transition-all ${
                      selectedSpecies?.name === sp.name && selectedSpecies?.source === sp.source
                        ? 'border-gold/40 bg-gold/5 text-gold'
                        : 'border-border-default bg-bg-panel hover:border-border-hover text-text-primary'
                    }`}
                  >
                    <div className="font-semibold truncate">{sp.name}</div>
                    <div className="text-text-muted text-[10px] mt-0.5">{sp.source}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Selected species detail panel */}
          {selectedSpecies && (
            <div className="bg-bg-panel-solid/80 rounded-lg border border-border-default overflow-hidden">
              <EntityImage
                folder="races"
                id={selectedSpecies.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}
                name={selectedSpecies.name}
                className="w-full h-44"
              />
              <div className="p-4 space-y-3">
                <div className="space-y-2 text-sm">
                  <div className="flex gap-2">
                    <span className="text-text-secondary shrink-0">Скорость:</span>
                    <span className="text-text-primary">{getSpeciesSpeed(selectedSpecies)} фт.</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-text-secondary shrink-0">Размер:</span>
                    <span className="text-text-primary">{getSpeciesSize(selectedSpecies)}</span>
                  </div>
                  {selectedSpecies.darkvision && (
                    <div className="flex gap-2">
                      <span className="text-text-secondary shrink-0">Тёмное зрение:</span>
                      <span className="text-text-primary">{selectedSpecies.darkvision} фт.</span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <span className="text-text-secondary shrink-0">Языки:</span>
                    <span className="text-text-primary">{getSpeciesLanguages(selectedSpecies).join(', ')}</span>
                  </div>
                </div>

                {/* "Вы получите следующее:" — BG3 style features list */}
                {selectedSpecies.entries && selectedSpecies.entries.length > 0 && EntryRendererCmp && (
                  <div className="pt-3 border-t border-border-default">
                    <h4 className="text-xs text-gold uppercase tracking-wider mb-2">Вы получите следующее:</h4>
                    <div className="prose prose-invert prose-sm max-w-none text-xs">
                      <EntryRendererCmp entries={selectedSpecies.entries} context={selectedSpecies.name} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  // ─── Step 1: Class ───
  const classIndex = useMemo(() => {
    if (!selectedClass) return 0;
    return CLASS_REGISTRY.findIndex(c => c.id === selectedClass.id);
  }, [selectedClass]);

  const [showAllClasses, setShowAllClasses] = useState(false);

  const renderClassStep = () => (
    <div className="space-y-4">
      {/* BG3-style Cycle Selector */}
      <CycleSelector
        items={CLASS_REGISTRY.map(cls => ({ id: cls.id, name: cls.name }))}
        selectedIndex={classIndex >= 0 ? classIndex : 0}
        onSelect={(i) => setSelectedClass(CLASS_REGISTRY[i])}
      />

      <button
        onClick={() => setShowAllClasses(!showAllClasses)}
        className="text-xs text-text-muted hover:text-text-primary transition-colors flex items-center gap-1"
      >
        <Search size={12} />
        {showAllClasses ? 'Скрыть список' : 'Показать все классы'}
      </button>

      {showAllClasses && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
          {CLASS_REGISTRY.map(cls => (
            <button
              key={cls.id}
              onClick={() => { setSelectedClass(cls); setShowAllClasses(false); }}
              className={`rounded-lg border text-left p-2 text-xs transition-all ${
                selectedClass?.id === cls.id
                  ? 'border-gold/40 bg-gold/5 text-gold'
                  : 'border-border-default bg-bg-panel hover:border-border-hover text-text-primary'
              }`}
            >
              <div className="font-semibold truncate">{cls.name}</div>
              <div className="text-text-muted text-[10px] mt-0.5">{cls.hitDie} • {cls.source}</div>
            </button>
          ))}
        </div>
      )}

      {/* Selected class detail */}
      {selectedClass && (
        <div className="bg-bg-panel-solid/80 rounded-lg border border-border-default overflow-hidden">
          <EntityImage folder="classes" id={selectedClass.id} name={selectedClass.name} className="w-full h-44" />
          <div className="p-4 space-y-3">
            <p className="text-sm text-text-primary leading-relaxed">{selectedClass.description}</p>

            <div className="pt-3 border-t border-border-default">
              <h4 className="text-xs text-gold uppercase tracking-wider mb-2">Вы получите следующее:</h4>
              <div className="space-y-2 text-sm">
                <div className="flex gap-2">
                  <span className="text-text-secondary shrink-0">Кость хитов:</span>
                  <span className="text-text-primary font-bold">{selectedClass.hitDie}</span>
                </div>
                <div>
                  <span className="text-text-secondary">Основная характеристика:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedClass.primaryAbility.map(a => (
                      <span key={a} className="px-2 py-0.5 bg-red-accent/30 text-red-300 rounded text-xs">
                        {ABILITY_NAMES[a]}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-text-secondary">Спасброски:</span>
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
                    <span className="text-text-secondary shrink-0">Заклинатель:</span>
                    <span className="text-purple-300">{ABILITY_NAMES[selectedClass.spellcastingAbility!]}</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <span className="text-text-secondary shrink-0">Доспехи:</span>
                  <span className="text-text-primary text-xs">
                    {selectedClass.proficiencies.armor.length > 0 ? selectedClass.proficiencies.armor.join(', ') : 'Нет'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="text-text-secondary shrink-0">Оружие:</span>
                  <span className="text-text-primary text-xs">{selectedClass.proficiencies.weapons.join(', ')}</span>
                </div>
              </div>
            </div>

            {/* Subclasses preview */}
            {selectedClass.subclasses.length > 0 && (
              <div className="pt-3 border-t border-border-default">
                <h4 className="text-xs text-text-muted uppercase tracking-wider mb-2">
                  Доступные подклассы (выбор на 3 уровне)
                </h4>
                <div className="space-y-1.5">
                  {selectedClass.subclasses.map(sub => (
                    <div key={sub.id} className="flex items-center gap-2 text-xs text-text-secondary">
                      <span className="w-1 h-1 rounded-full bg-gold/50 shrink-0" />
                      <span>{sub.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
          <h3 className="text-xl font-medieval text-gold">Характеристики</h3>
          <div className="flex rounded-lg overflow-hidden border border-border-default">
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
                    ? 'bg-gold text-bg-primary'
                    : 'bg-bg-panel-solid text-text-primary hover:bg-bg-panel-solid'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {abilityMethod === 'pointBuy' && (
          <div className="flex items-center gap-4 p-3 rounded-lg bg-bg-panel-solid/80 border border-border-default">
            <span className="text-text-primary text-sm">Осталось очков:</span>
            <span className={`text-2xl font-bold ${remaining! < 0 ? 'text-red-400' : remaining === 0 ? 'text-green-400' : 'text-gold'}`}>
              {remaining} / {POINT_BUY_TOTAL}
            </span>
          </div>
        )}

        {abilityMethod === 'roll' && (
          <div className="flex items-center gap-4">
            <button
              onClick={handleRollAbilities}
              className="px-5 py-2 bg-gold/20 text-gold border border-gold/30 rounded-lg hover:bg-gold/30 flex items-center gap-2 font-medium"
            >
              <Dices size={18} />
              Бросить заново (4d6 без наименьшего)
            </button>
          </div>
        )}

        {/* BG3-style horizontal ability score row */}
        <div className="flex flex-wrap justify-center gap-4">
          {(Object.keys(abilityScores) as Array<keyof AbilityScores>).map(ability => {
            const base = abilityScores[ability];
            const bonus = activeBonuses[ability] || 0;
            const final = base + bonus;
            const mod = getAbilityModifier(final);

            return (
              <div key={ability} className="flex flex-col items-center gap-1.5">
                <StatBadge
                  label={ABILITY_NAMES[ability]}
                  value={final}
                  modifier={mod}
                  variant="circle"
                  size="lg"
                  highlight={bonus > 0}
                />

                {abilityMethod === 'pointBuy' && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handlePointBuyChange(ability, -1)}
                      disabled={!canDecreasePointBuy(abilityScores, ability)}
                      className="w-6 h-6 rounded bg-bg-panel-solid text-text-primary hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-xs"
                    >
                      −
                    </button>
                    <span className="text-xs text-text-muted w-4 text-center">{base}</span>
                    <button
                      onClick={() => handlePointBuyChange(ability, 1)}
                      disabled={!canIncreasePointBuy(abilityScores, ability)}
                      className="w-6 h-6 rounded bg-bg-panel-solid text-text-primary hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-xs"
                    >
                      +
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
                    className="w-14 text-center bg-bg-panel-solid text-text-primary rounded border border-border-default px-1 py-0.5 text-xs"
                  />
                )}

                {abilityMethod === 'roll' && (
                  <div className="text-[10px] text-text-muted">баз: {base}</div>
                )}

                {bonus > 0 && (
                  <div className="text-[10px] text-gold">+{bonus}</div>
                )}

                {abilityMethod === 'pointBuy' && (
                  <div className="text-[10px] text-text-muted">
                    ({POINT_BUY_COSTS[base]})
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Background Bonus Mode (2024 rules) */}
        {selectedBackground && (
          <div className="bg-bg-panel-solid/80 rounded-lg border border-border-default p-4">
            <h4 className="text-lg font-medieval text-gold mb-3">Бонусы предыстории</h4>
            <div className="flex rounded-lg overflow-hidden border border-border-default mb-4 w-fit">
              <button
                onClick={() => { setBackgroundBonusMode('background'); setCustomBonuses({}); }}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  backgroundBonusMode === 'background'
                    ? 'bg-gold text-bg-primary'
                    : 'bg-bg-panel-solid text-text-primary hover:bg-bg-panel-solid'
                }`}
              >
                По предыстории ({selectedBackground.name})
              </button>
              <button
                onClick={() => { setBackgroundBonusMode('custom'); setBgBonus2(null); setBgBonus1(null); setCustomBonuses({}); }}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  backgroundBonusMode === 'custom'
                    ? 'bg-gold text-bg-primary'
                    : 'bg-bg-panel-solid text-text-primary hover:bg-bg-panel-solid'
                }`}
              >
                Свободное распределение
              </button>
            </div>

            {backgroundBonusMode === 'background' ? (
              <div className="space-y-3">
                <p className="text-sm text-text-secondary">Выберите +2 к одной и +1 к другой из связанных характеристик:</p>
                <div className="grid grid-cols-3 gap-3">
                  {getBgAbilityOptions(selectedBackground).map(ability => {
                    const is2 = bgBonus2 === ability;
                    const is1 = bgBonus1 === ability;
                    return (
                      <div key={ability} className="text-center space-y-2">
                        <div className="text-sm text-text-primary font-medium">{ABILITY_NAMES[ability]}</div>
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => {
                              if (is2) { setBgBonus2(null); }
                              else { if (bgBonus1 === ability) setBgBonus1(null); setBgBonus2(ability); }
                            }}
                            className={`px-3 py-1.5 rounded text-sm font-bold transition-all ${
                              is2
                                ? 'bg-gold text-bg-primary ring-2 ring-gold/50'
                                : 'bg-bg-panel-solid text-text-primary hover:bg-white/10'
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
                                ? 'bg-gold/70 text-bg-primary ring-2 ring-gold/30'
                                : 'bg-bg-panel-solid text-text-primary hover:bg-white/10'
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
                    <span className="px-3 py-1 bg-gold/10 text-gold rounded-lg text-sm">
                      {ABILITY_NAMES[bgBonus2]} +2
                    </span>
                    <span className="px-3 py-1 bg-gold/10 text-gold rounded-lg text-sm">
                      {ABILITY_NAMES[bgBonus1]} +1
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-sm text-text-primary">
                    Распределите 3 очка (макс. +2 на характеристику)
                  </span>
                  <span className={`font-bold ${customBonusSpent === 3 ? 'text-green-400' : 'text-gold'}`}>
                    {customBonusSpent} / 3
                  </span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {(Object.keys(abilityScores) as Array<keyof AbilityScores>).map(ability => (
                    <div key={ability} className="text-center">
                      <div className="text-xs text-text-secondary mb-1">{ABILITY_NAMES[ability]}</div>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleCustomBonusChange(ability, -1)}
                          disabled={(customBonuses[ability] || 0) <= 0}
                          className="w-6 h-6 rounded bg-bg-panel-solid text-text-primary text-xs hover:bg-white/10 disabled:opacity-30 flex items-center justify-center"
                        >
                          -
                        </button>
                        <span className="text-gold font-bold w-5 text-center">
                          +{customBonuses[ability] || 0}
                        </span>
                        <button
                          onClick={() => handleCustomBonusChange(ability, 1)}
                          disabled={(customBonuses[ability] || 0) >= 2 || customBonusSpent >= 3}
                          className="w-6 h-6 rounded bg-bg-panel-solid text-text-primary text-xs hover:bg-white/10 disabled:opacity-30 flex items-center justify-center"
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

  const [showAllBgs, setShowAllBgs] = useState(false);

  const bgIndex = useMemo(() => {
    if (!selectedBackground) return 0;
    return allBackgrounds.findIndex(bg => bg.name === selectedBackground.name && bg.source === selectedBackground.source);
  }, [allBackgrounds, selectedBackground]);

  const renderBackgroundStep = () => (
    <div className="space-y-4">
      {!backgroundsLoaded ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={32} className="animate-spin text-gold" />
          <span className="ml-3 text-text-secondary">Загрузка предысторий...</span>
        </div>
      ) : (
        <>
          <CycleSelector
            items={allBackgrounds.map(bg => ({ id: bg.name, name: bg.name }))}
            selectedIndex={bgIndex >= 0 ? bgIndex : 0}
            onSelect={(i) => { setSelectedBackground(allBackgrounds[i]); setBgBonus2(null); setBgBonus1(null); setCustomBonuses({}); setSelectedOriginFeat(null); }}
          />

          <button
            onClick={() => setShowAllBgs(!showAllBgs)}
            className="text-xs text-text-muted hover:text-text-primary transition-colors flex items-center gap-1"
          >
            <Search size={12} />
            {showAllBgs ? 'Скрыть список' : 'Показать все предыстории'}
          </button>

          {showAllBgs && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
                <input
                  type="text"
                  placeholder="Поиск предысторий..."
                  value={bgSearchQuery}
                  onChange={e => setBgSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-bg-panel-solid border border-border-default rounded-lg text-text-primary text-sm focus:outline-none focus:border-gold/50"
                />
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                {filteredBackgrounds.map((bg, idx) => (
                  <button
                    key={`${bg.name}-${idx}`}
                    onClick={() => { setSelectedBackground(bg); setBgBonus2(null); setBgBonus1(null); setCustomBonuses({}); setSelectedOriginFeat(null); setShowAllBgs(false); }}
                    className={`rounded-lg border text-left p-2 text-xs transition-all ${
                      selectedBackground?.name === bg.name && selectedBackground?.source === bg.source
                        ? 'border-gold/40 bg-gold/5 text-gold'
                        : 'border-border-default bg-bg-panel hover:border-border-hover text-text-primary'
                    }`}
                  >
                    <div className="font-semibold truncate">{bg.name}</div>
                    <div className="text-text-muted text-[10px] mt-0.5">{getBgFeatName(bg)}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Selected background detail */}
          {selectedBackground && (
            <div className="bg-bg-panel-solid/80 rounded-lg border border-border-default p-4 space-y-3">
              <div className="pt-1">
                <h4 className="text-xs text-gold uppercase tracking-wider mb-2">Вы получите следующее:</h4>
                <div className="space-y-2 text-sm">
                  {getBgFeatName(selectedBackground) && (
                    <div>
                      <span className="text-text-secondary">Черта:</span>
                      <span className="text-purple-300 ml-2 font-medium">{getBgFeatName(selectedBackground)}</span>
                    </div>
                  )}
                  {getBgSkills(selectedBackground).length > 0 && (
                    <div>
                      <span className="text-text-secondary">Навыки:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {getBgSkills(selectedBackground).map(s => (
                          <span key={s} className="px-2 py-0.5 bg-blue-900/40 text-blue-300 rounded text-xs">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {getBgToolProficiency(selectedBackground) && (
                    <div className="flex gap-2">
                      <span className="text-text-secondary shrink-0">Инструменты:</span>
                      <span className="text-text-primary">{getBgToolProficiency(selectedBackground)}</span>
                    </div>
                  )}
                  {getBgAbilityOptions(selectedBackground).length > 0 && (
                    <div>
                      <span className="text-text-secondary">Связанные характеристики:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {getBgAbilityOptions(selectedBackground).map(a => (
                          <span key={a} className="px-2 py-0.5 bg-gold/10 text-gold rounded text-xs">{ABILITY_NAMES[a]}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {selectedBackground.entries && selectedBackground.entries.length > 0 && EntryRendererCmp && (
                <div className="pt-3 border-t border-border-default">
                  <div className="prose prose-invert prose-sm max-w-none text-xs">
                    <EntryRendererCmp entries={selectedBackground.entries} context={selectedBackground.name} />
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );

  // ─── Step 4: Details ───
  const renderDetailsStep = () => (
    <div className="max-w-lg mx-auto space-y-6">
      <h3 className="text-xl font-medieval text-gold text-center">Детали персонажа</h3>

      <div>
        <label className="block text-sm text-text-primary mb-2">Имя персонажа *</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Введите имя персонажа"
          className="w-full px-4 py-3 bg-bg-panel-solid border-2 border-border-default rounded-lg text-text-primary focus:outline-none focus:border-gold/50 transition-colors"
        />
      </div>

      {selectedBackground && (
        <div className="bg-bg-panel-solid/80 rounded-lg border border-border-default p-4">
          <div className="text-sm text-text-secondary mb-1">Предыстория</div>
          <div className="text-lg text-gold font-medieval">{selectedBackground.name}</div>
          <div className="text-xs text-text-secondary mt-1">Черта: {getBgFeatName(selectedBackground)}</div>
        </div>
      )}

      <div className="bg-bg-panel-solid/80 rounded-lg border border-border-default p-4">
        <div className="text-sm text-text-secondary mb-1">Уровень</div>
        <div className="text-lg text-text-primary font-bold">1</div>
        <div className="text-xs text-text-muted mt-1">Повышение уровня доступно на странице персонажа</div>
      </div>
    </div>
  );

  // ─── Step 3: Character Creation Options ───
  const renderCharOptionsStep = () => {
    if (!charOptionsLoaded) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={32} className="animate-spin text-gold" />
          <span className="ml-3 text-text-secondary">Загрузка опций создания...</span>
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
          <h3 className="text-xl font-medieval text-gold">Опции создания персонажа</h3>
          <p className="text-sm text-text-secondary mt-1">
            Необязательный шаг — ознакомьтесь с дополнительными опциями для вашего персонажа
          </p>
        </div>

        {selectedCharOption ? (
          <div className="space-y-4">
            <button
              onClick={() => setSelectedCharOption(null)}
              className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              <ArrowLeft size={14} />
              Назад к списку
            </button>
            <div className="bg-bg-panel-solid/80 rounded-lg border border-gold/40 p-6">
              <h3 className="text-2xl font-medieval text-text-primary mb-1">{selectedCharOption.name}</h3>
              <div className="text-sm text-gold mb-4">
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
                <h4 className="text-lg font-medieval text-gold mb-3">
                  {OPTION_TYPE_NAMES[typeKey] || typeKey}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {options.map(opt => (
                    <button
                      key={`${opt.name}-${opt.source}`}
                      onClick={() => setSelectedCharOption(opt)}
                      className="text-left p-3 bg-bg-panel-solid/80 rounded-lg border border-border-default hover:border-gold/50 transition-colors"
                    >
                      <div className="text-text-primary font-medium text-sm">{opt.name}</div>
                      <div className="text-xs text-text-secondary mt-1">{opt.source}</div>
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
        <h3 className="text-xl font-medieval text-gold text-center">Обзор персонажа</h3>

        <div className="bg-bg-panel-solid/80 rounded-lg border border-gold/40 p-6">
          <h2 className="text-3xl font-medieval text-text-primary mb-1">{name || 'Без имени'}</h2>
          <p className="text-gold text-lg">
            {selectedSpecies.name}
            {' • '}
            {selectedClass.name}
            {' • '}
            1 уровень
          </p>
          <p className="text-text-secondary mt-1">Предыстория: {selectedBackground.name}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-bg-panel-solid/80 rounded-lg border border-border-default p-4">
            <h4 className="text-sm text-text-secondary mb-3">Характеристики</h4>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(finalScores) as Array<keyof AbilityScores>).map(ability => (
                <div key={ability} className="flex justify-between text-sm">
                  <span className="text-text-primary">{ABILITY_NAMES[ability]}</span>
                  <span className="text-text-primary font-bold">
                    {finalScores[ability]} ({formatModifier(getAbilityModifier(finalScores[ability]))})
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-bg-panel-solid/80 rounded-lg border border-border-default p-4">
            <h4 className="text-sm text-text-secondary mb-3">Боевые характеристики</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-primary">Хиты:</span>
                <span className="text-text-primary font-bold">{maxHP}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-primary">Класс брони:</span>
                <span className="text-text-primary font-bold">{10 + getAbilityModifier(finalScores.dexterity)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-primary">Инициатива:</span>
                <span className="text-text-primary font-bold">{formatModifier(getAbilityModifier(finalScores.dexterity))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-primary">Скорость:</span>
                <span className="text-text-primary font-bold">{getSpeciesSpeed(selectedSpecies)} фт.</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-primary">Бонус мастерства:</span>
                <span className="text-text-primary font-bold">{formatModifier(profBonus)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-primary">Кость хитов:</span>
                <span className="text-text-primary font-bold">{selectedClass.hitDie}</span>
              </div>
            </div>
          </div>
        </div>

        {selectedClass.spellcaster && selectedClass.spellcastingAbility && (
          <div className="bg-bg-panel-solid/80 rounded-lg border border-border-default p-4">
            <h4 className="text-sm text-text-secondary mb-3">Заклинания</h4>
            <div className="grid grid-cols-3 gap-4 text-sm text-center">
              <div>
                <div className="text-text-secondary">Характеристика</div>
                <div className="text-purple-300 font-bold">{ABILITY_NAMES[selectedClass.spellcastingAbility]}</div>
              </div>
              <div>
                <div className="text-text-secondary">Сл спасброска</div>
                <div className="text-text-primary font-bold">
                  {8 + profBonus + getAbilityModifier(finalScores[selectedClass.spellcastingAbility])}
                </div>
              </div>
              <div>
                <div className="text-text-secondary">Бонус атаки</div>
                <div className="text-text-primary font-bold">
                  {formatModifier(profBonus + getAbilityModifier(finalScores[selectedClass.spellcastingAbility]))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-bg-panel-solid/80 rounded-lg border border-border-default p-4">
          <h4 className="text-sm text-text-secondary mb-3">Владения</h4>
          <div className="space-y-2 text-sm">
            {selectedClass.proficiencies.armor.length > 0 && (
              <div>
                <span className="text-text-secondary">Доспехи: </span>
                <span className="text-text-primary">{selectedClass.proficiencies.armor.join(', ')}</span>
              </div>
            )}
            <div>
              <span className="text-text-secondary">Оружие: </span>
              <span className="text-text-primary">{selectedClass.proficiencies.weapons.join(', ')}</span>
            </div>
            {selectedClass.proficiencies.tools.length > 0 && (
              <div>
                <span className="text-text-secondary">Инструменты: </span>
                <span className="text-text-primary">{selectedClass.proficiencies.tools.join(', ')}</span>
              </div>
            )}
            <div>
              <span className="text-text-secondary">Языки: </span>
              <span className="text-text-primary">{getSpeciesLanguages(selectedSpecies).join(', ')}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ─── Step: Origin Feat ───
  const renderOriginFeatStep = () => {
    if (!originFeatsLoaded) {
      return (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="text-gold animate-spin" />
          <span className="ml-2 text-text-muted">Загрузка черт...</span>
        </div>
      );
    }

    const filtered = originFeatSearch.trim()
      ? allOriginFeats.filter(f => f.name.toLowerCase().includes(originFeatSearch.toLowerCase()))
      : allOriginFeats;

    return (
      <div className="space-y-4">
        <div className="glass-panel p-4">
          <h3 className="text-lg font-medieval text-gold mb-1">Черта происхождения</h3>
          <p className="text-xs text-text-muted mb-4">
            Ваша предыстория не даёт черту. Выберите черту происхождения (Origin Feat).
          </p>

          {/* Search */}
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={originFeatSearch}
              onChange={e => setOriginFeatSearch(e.target.value)}
              placeholder="Поиск черты..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-bg-primary border border-border-default
                text-text-primary placeholder-text-muted focus:border-gold/50 focus:outline-none"
            />
          </div>

          {/* Feat grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto">
            {filtered.map(feat => {
              const isSelected = selectedOriginFeat?.name === feat.name;
              return (
                <button
                  key={feat.name}
                  onClick={() => setSelectedOriginFeat(isSelected ? null : feat)}
                  className={`text-left rounded-lg border p-3 transition-all ${
                    isSelected
                      ? 'border-gold/50 bg-gold/10'
                      : 'border-border-default bg-bg-primary/40 hover:border-border-hover'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isSelected && <Check size={14} className="text-gold shrink-0" />}
                    <span className={`text-sm font-medium ${isSelected ? 'text-gold' : 'text-text-primary'}`}>
                      {feat.name}
                    </span>
                  </div>
                  {feat.entries?.[0] && typeof feat.entries[0] === 'string' && (
                    <p className="text-[11px] text-text-muted mt-1 line-clamp-2">
                      {feat.entries[0].replace(/\{@\w+\s+([^|}]+)(?:\|[^}]*)?\}/g, '$1').slice(0, 120)}
                    </p>
                  )}
                </button>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div className="text-center text-text-muted text-sm py-4">Ничего не найдено</div>
          )}
        </div>

        {/* Selected feat detail */}
        {selectedOriginFeat && (
          <div className="glass-panel p-4">
            <h4 className="text-base font-medieval text-gold mb-2">{selectedOriginFeat.name}</h4>
            <div className="text-sm text-text-secondary leading-relaxed space-y-2">
              {EntryRendererCmp ? (
                <EntryRendererCmp entries={selectedOriginFeat.entries} />
              ) : (
                selectedOriginFeat.entries?.map((e: any, i: number) => (
                  <p key={i}>{typeof e === 'string' ? e.replace(/\{@\w+\s+([^|}]+)(?:\|[^}]*)?\}/g, '$1') : ''}</p>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─── Step: Skills ───
  const renderSkillsStep = () => {
    if (!selectedClass) return null;
    const { count, from } = selectedClass.proficiencies.skillChoices;

    const toggleSkill = (skillKey: string) => {
      // Don't toggle background skills
      if (backgroundSkillKeys.includes(skillKey)) return;
      setSelectedSkills(prev => {
        if (prev.includes(skillKey)) return prev.filter(s => s !== skillKey);
        if (prev.length >= count) return prev;
        return [...prev, skillKey];
      });
    };

    // Group skills by ability
    const ABILITY_ORDER: (keyof typeof ABILITY_NAMES)[] = [
      'strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma',
    ];

    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-medieval text-gold">Выберите навыки</h3>
          <div className="text-sm">
            <span className={`font-bold ${selectedSkills.length === count ? 'text-green-400' : 'text-gold'}`}>
              {selectedSkills.length}
            </span>
            <span className="text-text-secondary"> / {count}</span>
          </div>
        </div>

        <p className="text-sm text-text-secondary">
          Выберите {count} навык{count === 2 ? 'а' : count === 3 ? 'а' : 'ов'} из списка класса «{selectedClass.name}».
          {backgroundSkillKeys.length > 0 && ' Навыки предыстории уже отмечены.'}
        </p>

        {/* All 18 skills grouped by ability */}
        <div className="space-y-4">
          {ABILITY_ORDER.map(ability => {
            const skillsForAbility = Object.entries(SKILL_ABILITIES)
              .filter(([, ab]) => ab === ability)
              .map(([key]) => key);
            if (skillsForAbility.length === 0) return null;

            return (
              <div key={ability}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] uppercase tracking-wider text-text-muted font-bold">
                    {ABILITY_NAMES[ability]} ({ABILITY_SHORT[ability]})
                  </span>
                  <div className="flex-1 h-px bg-border-default" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {skillsForAbility.map(skillKey => {
                    const isFromClass = from.includes(skillKey);
                    const isFromBg = backgroundSkillKeys.includes(skillKey);
                    const isSelected = selectedSkills.includes(skillKey);
                    const isActive = isSelected || isFromBg;
                    const isDisabled = !isFromClass && !isFromBg;
                    const isFull = selectedSkills.length >= count && !isSelected;

                    const abilityScore = getFinalScore(SKILL_ABILITIES[skillKey]);
                    const mod = getSkillBonus(
                      abilityScore,
                      isActive,
                      false,
                      getProficiencyBonus(1)
                    );

                    return (
                      <button
                        key={skillKey}
                        onClick={() => toggleSkill(skillKey)}
                        disabled={isDisabled || isFromBg || (isFull && !isSelected)}
                        className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-left text-sm transition-all ${
                          isFromBg
                            ? 'border-blue-500/50 bg-blue-900/20 text-blue-300 cursor-default'
                            : isSelected
                              ? 'border-gold/70 bg-gold/10 text-gold'
                              : isFromClass
                                ? 'border-border-default bg-bg-panel hover:border-border-hover text-text-primary'
                                : 'border-border-default/30 bg-bg-panel/30 text-text-muted/50 cursor-not-allowed'
                        }`}
                      >
                        {/* Placeholder icon — colored circle */}
                        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 ${
                          isActive
                            ? isFromBg
                              ? 'border-blue-400 bg-blue-900/40 text-blue-300'
                              : 'border-gold bg-gold/20 text-gold'
                            : 'border-border-default bg-bg-panel-solid text-text-muted'
                        }`}>
                          {isActive ? <Check size={14} /> : SKILL_NAMES[skillKey]?.charAt(0) || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate text-xs">{SKILL_NAMES[skillKey]}</div>
                          <div className="text-[10px] text-text-muted">
                            {ABILITY_SHORT[SKILL_ABILITIES[skillKey]]}
                            {isFromBg && ' • Предыстория'}
                          </div>
                        </div>
                        <span className={`text-xs font-bold ${isActive ? 'text-green-400' : 'text-text-muted'}`}>
                          {mod >= 0 ? '+' : ''}{mod}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected summary */}
        {(selectedSkills.length > 0 || backgroundSkillKeys.length > 0) && (
          <div className="bg-bg-panel-solid/60 rounded-lg border border-border-default p-3">
            <h4 className="text-xs text-text-muted uppercase tracking-wider mb-2">Владение навыками:</h4>
            <div className="flex flex-wrap gap-1.5">
              {backgroundSkillKeys.map(sk => (
                <span key={sk} className="px-2 py-1 bg-blue-900/40 text-blue-300 rounded text-xs">
                  {SKILL_NAMES[sk]} <span className="text-blue-400/60 text-[10px]">(Предыстория)</span>
                </span>
              ))}
              {selectedSkills.map(sk => (
                <span key={sk} className="px-2 py-1 bg-gold/10 text-gold rounded text-xs flex items-center gap-1">
                  {SKILL_NAMES[sk]}
                  <button
                    onClick={() => setSelectedSkills(prev => prev.filter(s => s !== sk))}
                    className="text-gold/50 hover:text-gold ml-0.5"
                  >&times;</button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─── Step 6: Spells (только для заклинателей) ───
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
          <h3 className="text-xl font-medieval text-gold">Выберите заклинания</h3>
          <div className="text-sm text-text-secondary">
            {selectedClass.name} • {ABILITY_NAMES[selectedClass.spellcastingAbility!]}
          </div>
        </div>

        {/* Поиск */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
          <input
            type="text"
            placeholder="Поиск заклинаний..."
            value={spellSearchQuery}
            onChange={e => setSpellSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-bg-panel-solid border border-border-default rounded-lg text-text-primary text-sm focus:outline-none focus:border-gold/50"
          />
        </div>

        {/* Заговоры */}
        <div>
          <h4 className="text-lg font-medieval text-purple-300 mb-2">
            Заговоры
            <span className="text-sm font-normal text-text-secondary ml-2">
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
                      : 'border-border-default bg-bg-panel text-text-primary hover:border-border-hover disabled:opacity-40'
                  }`}
                >
                  <div className="font-semibold truncate">{spell.name}</div>
                  <div className="text-text-muted text-[10px]">{SCHOOL_NAMES[spell.school] || spell.school}</div>
                </button>
              );
            })}
            {filteredCantrips.length === 0 && (
              <div className="col-span-full text-center text-text-muted py-4 text-sm">
                {spellSearchQuery ? 'Ничего не найдено' : 'Нет доступных заговоров'}
              </div>
            )}
          </div>
        </div>

        {/* Заклинания 1 уровня */}
        <div>
          <h4 className="text-lg font-medieval text-blue-300 mb-2">
            Заклинания 1 уровня
            <span className="text-sm font-normal text-text-secondary ml-2">
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
                      : 'border-border-default bg-bg-panel text-text-primary hover:border-border-hover'
                  }`}
                >
                  <div className="font-semibold truncate">{spell.name}</div>
                  <div className="text-text-muted text-[10px]">
                    {SCHOOL_NAMES[spell.school] || spell.school}
                    {spell.concentration && spell.duration?.[0]?.concentration ? ' • Концентрация' : ''}
                  </div>
                </button>
              );
            })}
            {filteredLeveled.length === 0 && (
              <div className="col-span-full text-center text-text-muted py-4 text-sm">
                {spellSearchQuery ? 'Ничего не найдено' : 'Нет доступных заклинаний'}
              </div>
            )}
          </div>
        </div>

        {/* Выбранные */}
        {(selectedCantrips.length > 0 || selectedSpells.length > 0) && (
          <div className="bg-bg-panel-solid/60 rounded-lg border border-border-default p-4">
            <h4 className="text-sm text-text-secondary mb-2">Выбранные заклинания:</h4>
            <div className="flex flex-wrap gap-2">
              {selectedCantrips.map(s => (
                <span key={s.name} className="px-2 py-1 bg-purple-900/40 text-purple-300 rounded text-xs flex items-center gap-1">
                  {s.name}
                  <button onClick={() => toggleCantrip(s)} className="text-purple-400 hover:text-text-primary ml-1">&times;</button>
                </span>
              ))}
              {selectedSpells.map(s => (
                <span key={s.name} className="px-2 py-1 bg-blue-900/40 text-blue-300 rounded text-xs flex items-center gap-1">
                  {s.name}
                  <button onClick={() => toggleSpell(s)} className="text-blue-400 hover:text-text-primary ml-1">&times;</button>
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
    const key = getEffectiveStep(step);
    switch (key) {
      case 'race': return renderRaceStep();
      case 'class': return renderClassStep();
      case 'background': return renderBackgroundStep();
      case 'originfeat': return renderOriginFeatStep();
      case 'charoptions': return renderCharOptionsStep();
      case 'abilities': return renderAbilitiesStep();
      case 'skills': return renderSkillsStep();
      case 'spells': return renderSpellsStep();
      case 'details': return renderDetailsStep();
      case 'review': return renderReviewStep();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with back to list */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onCancel}
          className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={20} />
          <span>Назад к списку</span>
        </button>
        <h2 className="text-2xl font-medieval text-gold">Создание персонажа</h2>
        <div className="w-32" />
      </div>

      {renderStepIndicator()}

      {/* Step content + right sidebar */}
      <div className="flex flex-1 min-h-0 gap-4">
        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          {renderStep()}
        </div>
        <CharacterStatsSidebar
          creationStats={creationStats}
          showCombatStats={step >= 4}
        />
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-border-default shrink-0">
        <button
          onClick={step === 0 ? onCancel : prevStep}
          className="flex items-center gap-2 px-6 py-3 rounded-lg border border-border-default text-text-primary hover:text-text-primary hover:border-border-hover transition-colors"
        >
          <ArrowLeft size={18} />
          {step === 0 ? 'Отмена' : 'Назад'}
        </button>

        {step < maxStep ? (
          <button
            onClick={nextStep}
            disabled={!canProceed()}
            className="flex items-center gap-2 px-6 py-3 rounded-lg bg-gold text-bg-primary font-semibold hover:bg-gold/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Далее
            <ArrowRight size={18} />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!canProceed() || !name.trim()}
            className="flex items-center gap-2 px-8 py-3 rounded-lg bg-gold text-bg-primary font-semibold hover:bg-gold/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-lg shadow-gold/20"
          >
            <Wand2 size={18} />
            Создать персонажа
          </button>
        )}
      </div>
    </div>
  );
};
