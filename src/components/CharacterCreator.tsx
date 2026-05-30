import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Character, AbilityScores, CharacterSpell } from '../types';
import {
  generateAbilityScores,
  calculateMaxHP,
  getProficiencyBonus,
  getAbilityModifier,
  formatModifier,
  getSkillBonus,
  getAbilityName,
  getAbilityShort,
  SKILL_ABILITIES,
  getSkillName,
  POINT_BUY_TOTAL,
  POINT_BUY_MIN,
  POINT_BUY_MAX,
  POINT_BUY_COSTS,
  getPointBuyRemaining,
  canIncreasePointBuy,
  canDecreasePointBuy,
} from '../utils/dnd';
import { CLASS_REGISTRY, type ClassDefinition, getClassName, getClassDescription, getSubclassName, translateProficiencies, translateArmorProficiency, translateWeaponProficiency, translateToolProficiency } from '../data/classes';
import { getSubclassImageUrl } from '../data/classes/subclassJsonLoader';
import type { SpeciesData } from '../data/species';
import { getCanonicalName as getSpeciesCanonicalName } from '../data/species';
import type { JsonBackgroundData } from '../data/backgrounds/jsonBackgrounds';
import type { CharacterCreationOptionData } from '../data/charactercreationoptions';
import { ArrowLeft, ArrowRight, Dices, Wand2, Check, Sparkles, Swords, User, Eye, BookOpen, Search, Scroll, Loader2, Target, Star, Languages, Shield, ChevronDown, ChevronRight, Zap } from 'lucide-react';
import { TabBar, type Tab, CharacterStatsSidebar, type CreationStats, StatBadge, SpellTooltip, SpellIconBadge } from './ui';
import { applyFeatStatEffects, extractFeatProficiencies, applyFeatProficiencies, extractFeatResistances, applyFeatResistances, extractFeatSpellConfig, type FeatSpellConfig } from '../utils/featEffects';
import { resolveACForCreation, SPECIES_EFFECTS } from '../utils/classEffects';
import { FeatSpellPickerModal } from './FeatSpellPickerModal';

// ─── Хелперы для SpeciesData ───
function getSpeciesSpeed(sp: SpeciesData): number {
  if (typeof sp.speed === 'number') return sp.speed;
  if (sp.speed && typeof sp.speed === 'object') return sp.speed.walk || 30;
  return 30;
}

// getSpeciesSize moved inside component to access i18n

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
/** Parse bg feat key like "magic initiate; cleric|xphb" → { name: "Magic Initiate", variant: "Cleric" } */
function parseBgFeat(bg: JsonBackgroundData): { name: string; variant: string } {
  if (!bg.feats?.length) return { name: '', variant: '' };
  const raw = Object.keys(bg.feats[0])[0]?.split('|')[0] || '';
  const parts = raw.split(';').map(s => s.trim());
  const name = parts[0].replace(/\b\w/g, (c: string) => c.toUpperCase());
  const variant = parts[1] ? parts[1].replace(/\b\w/g, (c: string) => c.toUpperCase()) : '';
  return { name, variant };
}

function getBgFeatName(bg: JsonBackgroundData): string {
  return parseBgFeat(bg).name;
}

function getBgFeatDisplayName(bg: JsonBackgroundData): string {
  const { name, variant } = parseBgFeat(bg);
  return variant ? `${name} (${variant})` : name;
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
    const from: string[] | undefined = ab.choose?.weighted?.from ?? ab.choose?.from;
    if (from) {
      for (const k of from) {
        const mapped = ABILITY_MAP[k] || k as keyof AbilityScores;
        if (!result.includes(mapped)) result.push(mapped);
      }
    }
  }
  return result;
}

// OPTION_TYPE_NAMES moved inside component to access i18n

// ─── Языки D&D ───
const STANDARD_LANGUAGES = [
  'Common', 'Dwarvish', 'Elvish', 'Giant', 'Gnomish',
  'Goblin', 'Halfling', 'Orc',
];
const EXOTIC_LANGUAGES = [
  'Abyssal', 'Celestial', 'Deep Speech', 'Draconic',
  'Infernal', 'Primordial', 'Sylvan', 'Undercommon',
];
const ALL_CHOOSABLE_LANGUAGES = [...STANDARD_LANGUAGES.filter(l => l !== 'Common'), ...EXOTIC_LANGUAGES];

/** Parse languageProficiencies from species/background JSON data.
 *  Returns { fixed: string[], chooseCount: number, chooseFrom?: string[] }
 */
function parseLanguageProficiencies(langProfs: any[] | undefined): {
  fixed: string[];
  chooseCount: number;
  chooseFrom?: string[];
} {
  if (!langProfs?.length) return { fixed: [], chooseCount: 0 };
  const fixed: string[] = [];
  let chooseCount = 0;
  let chooseFrom: string[] | undefined;
  for (const lp of langProfs) {
    for (const [k, v] of Object.entries(lp)) {
      if (k === 'anyStandard' && typeof v === 'number') {
        chooseCount += v;
      } else if (k === 'choose' && v && typeof v === 'object') {
        const ch = v as any;
        if (ch.from) {
          chooseFrom = ch.from.filter((l: string) => l !== 'other');
          chooseCount += ch.count || 1;
        }
      } else if (typeof v === 'boolean' && v && k !== 'anyStandard') {
        // capitalize first letter
        fixed.push(k.charAt(0).toUpperCase() + k.slice(1));
      }
    }
  }
  return { fixed, chooseCount, chooseFrom: chooseFrom?.length ? chooseFrom : undefined };
}

// Типы заклинаний (без прямого импорта данных — данные загрузятся лениво)
interface SpellData {
  name: string;
  level: number;
  school: string;
  duration?: { type: string; concentration?: boolean; duration?: { type: string; amount: number } }[];
  concentration?: boolean;
  [key: string]: any;
}

// SCHOOL_NAMES, TIME_UNITS, getSpellMeta moved inside component to access i18n

function cleanTagRefs(text: string): string {
  return text.replace(/\{@\w+\s+([^|}]+)(?:\|[^|}]*)*(?:\|([^}]*))?\}/g, (_, first, last) => last || first);
}

function getFirstEntryText(entries: any[]): string {
  for (const e of entries) {
    if (typeof e === 'string') return cleanTagRefs(e);
    if (e?.entries) return getFirstEntryText(e.entries);
  }
  return '';
}

interface CharacterCreatorProps {
  onSave: (character: Character) => void;
  onCancel: () => void;
}

type AbilityMethod = 'pointBuy' | 'roll' | 'manual';
type BackgroundBonusMode = 'background' | 'custom';

// ALL_STEPS moved inside component to access i18n
const ALL_STEP_ICONS = {
  race: Sparkles, class: Swords, background: BookOpen, languages: Languages,
  originfeat: Star, charoptions: Scroll, fightingStyle: Shield, abilities: Dices,
  skills: Target, spells: Wand2, details: User, review: Eye,
} as const;
const ALL_STEP_KEYS = ['race', 'class', 'background', 'languages', 'originfeat', 'charoptions', 'fightingStyle', 'abilities', 'skills', 'spells', 'details', 'review'] as const;

const DEFAULT_SCORES: AbilityScores = {
  strength: 8, dexterity: 8, constitution: 8,
  intelligence: 8, wisdom: 8, charisma: 8,
};


export const CharacterCreator: React.FC<CharacterCreatorProps> = ({ onSave, onCancel }) => {
  const { t } = useTranslation('character');
  const [step, setStep] = useState(0);

  // i18n-backed helpers (moved from module scope)
  const SCHOOL_NAMES: Record<string, string> = {
    A: t('creation.schools.A'), C: t('creation.schools.C'), D: t('creation.schools.D'), E: t('creation.schools.E'),
    V: t('creation.schools.V'), I: t('creation.schools.I'), N: t('creation.schools.N'), T: t('creation.schools.T'),
  };
  const TIME_UNITS: Record<string, string> = {
    action: t('creation.timeUnits.action'), bonus: t('creation.timeUnits.bonus'),
    reaction: t('creation.timeUnits.reaction'), minute: t('creation.timeUnits.minute'),
  };
  const OPTION_TYPE_NAMES: Record<string, string> = {
    'SG': t('creation.optionTypes.SG'), 'CS': t('creation.optionTypes.CS'),
    'DG': t('creation.optionTypes.DG'), 'RF:B': t('creation.optionTypes.RF:B'),
    'Transformation': t('creation.optionTypes.Transformation'),
  };

  const getSpeciesSize = (sp: SpeciesData): string => {
    return sp.size?.map(s => t(`creation.sizes.${s}`, { defaultValue: s })).join('/') || t('creation.sizes.M');
  };

  const getSpellMeta = (spell: SpellData) => {
    const castingTime = spell.time
      ?.map((ti: any) => `${ti.number} ${TIME_UNITS[ti.unit] || ti.unit}`)
      .join(', ');
    const range = spell.range?.distance?.amount
      ? t('creation.spellRange.ft', { amount: spell.range.distance.amount })
      : spell.range?.type === 'touch' ? t('creation.spellRange.touch')
        : spell.range?.type === 'self' ? t('creation.spellRange.self')
          : spell.range?.type || '';
    const components = spell.components
      ? [spell.components.v ? t('creation.spellComponents.v') : '', spell.components.s ? t('creation.spellComponents.s') : '', spell.components.m ? t('creation.spellComponents.m') : ''].filter(Boolean).join(', ')
      : '';
    const duration = spell.duration
      ?.map((d: any) => {
        if (d.type === 'instant') return t('creation.spellDuration.instant');
        if (d.concentration) return t('creation.spellDuration.concentration', { amount: d.duration?.amount || '', type: d.duration?.type || '' });
        return d.type;
      })
      .join(', ');
    return { castingTime, range, components, duration };
  };

  const ALL_STEPS = ALL_STEP_KEYS.map(key => ({
    key,
    label: t(`creation.steps.${key}`),
    icon: ALL_STEP_ICONS[key],
  }));

  // Species (lazy loaded)
  const [speciesLoaded, setSpeciesLoaded] = useState(false);
  const [allSpecies, setAllSpecies] = useState<SpeciesData[]>([]);
  const [selectedSpecies, setSelectedSpecies] = useState<SpeciesData | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<SpeciesData | null>(null);

  // Class
  const [selectedClass, setSelectedClass] = useState<ClassDefinition | null>(null);
  const [classLevelTable, setClassLevelTable] = useState<any[] | null>(null);

  // Background (lazy loaded)
  const [backgroundsLoaded, setBackgroundsLoaded] = useState(false);
  const [allBackgrounds, setAllBackgrounds] = useState<JsonBackgroundData[]>([]);
  const [selectedBackground, setSelectedBackground] = useState<JsonBackgroundData | null>(null);
  const easterEggAudioRef = React.useRef<HTMLAudioElement | null>(null);

  const EVIL_ALIGNMENTS = ['lawfulEvil', 'neutralEvil', 'chaoticEvil'];

  const wrappedOnSave = React.useCallback((character: Character) => {
    if (
      (selectedBackground as any)?._isEasterEgg
      && character.alignment
      && EVIL_ALIGNMENTS.includes(character.alignment)
    ) {
      if (!easterEggAudioRef.current) {
        easterEggAudioRef.current = new Audio('/images/classes/.asset_cache.mp3');
      }
      const audio = easterEggAudioRef.current;
      audio.currentTime = 22;
      audio.play().catch(() => {});
    }
    onSave(character);
  }, [onSave, selectedBackground]);

  // Character Creation Options (lazy loaded)
  const [charOptionsLoaded, setCharOptionsLoaded] = useState(false);
  const [allCharOptions, setAllCharOptions] = useState<CharacterCreationOptionData[]>([]);
  const [selectedCharOption, setSelectedCharOption] = useState<CharacterCreationOptionData | null>(null); // viewing
  const [confirmedCharOption, setConfirmedCharOption] = useState<CharacterCreationOptionData | null>(null); // chosen

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

  // Background feat spell picker (Magic Initiate from background)
  const [showBgFeatSpellPicker, setShowBgFeatSpellPicker] = useState(false);
  const [bgFeatSpellConfig, setBgFeatSpellConfig] = useState<FeatSpellConfig | null>(null);
  const [pendingCharacter, setPendingCharacter] = useState<Character | null>(null);

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

  // Fighting Style
  const [selectedFightingStyle, setSelectedFightingStyle] = useState<any | null>(null);
  const [fightingStyleFeats, setFightingStyleFeats] = useState<any[]>([]);
  const [fightingStyleLoaded, setFightingStyleLoaded] = useState(false);
  const [fightingStyleSearch, setFightingStyleSearch] = useState('');
  // Cantrips from Blessed Warrior / Druidic Warrior
  const [fsCantrips, setFsCantrips] = useState<SpellData[]>([]);
  const [fsCantripsAvailable, setFsCantripsAvailable] = useState<SpellData[]>([]);
  const [fsCantripsLoaded, setFsCantripsLoaded] = useState(true);
  const [fsCantripSearch, setFsCantripSearch] = useState('');
  const [fsCantripDetail, setFsCantripDetail] = useState<SpellData | null>(null);

  // Detect if class needs fighting style at level 1
  const needsFightingStyle = useMemo(() => {
    if (!classLevelTable) return false;
    const level1Row = classLevelTable.find((r: any) => r.level === 1);
    return (level1Row?.features as string[] | undefined)?.includes('Fighting Style') ?? false;
  }, [classLevelTable]);

  // Detect if class needs expertise at level 1 (Rogue)
  const needsExpertise = useMemo(() => {
    if (!classLevelTable) return false;
    const level1Row = classLevelTable.find((r: any) => r.level === 1);
    return (level1Row?.features as string[] | undefined)?.includes('Expertise') ?? false;
  }, [classLevelTable]);

  // Load fighting style feats when class changes (reuse already-loaded feats module)
  React.useEffect(() => {
    if (!selectedClass) {
      setFightingStyleFeats([]);
      setFightingStyleLoaded(false);
      setSelectedFightingStyle(null);
      setFightingStyleSearch('');
      return;
    }
    let cancelled = false;
    setFightingStyleLoaded(false);
    setSelectedFightingStyle(null);
    setFightingStyleSearch('');
    import('../data/feats').then(async mod => {
      await mod.init();
      if (cancelled) return;
      const classId = selectedClass.id;
      setFightingStyleFeats(mod.ALL_FEATS.filter(f => {
        if (!f.category || !f.category.startsWith('FS')) return false;
        if (f.category === 'FS') return true;
        const suffix = f.category.split(':')[1];
        if (suffix === 'P' && classId === 'paladin') return true;
        if (suffix === 'R' && classId === 'ranger') return true;
        return false;
      }));
      setFightingStyleLoaded(true);
    }).catch(err => {
      console.error('Failed to load fighting style feats:', err);
      if (!cancelled) setFightingStyleLoaded(true);
    });
    return () => { cancelled = true; };
  }, [selectedClass]);

  // Load cantrips when a fighting style with additionalSpells is selected (Blessed/Druidic Warrior)
  const FS_CLASS_MAP: Record<string, string> = { cleric: t('creation.classMap.cleric'), druid: t('creation.classMap.druid') };
  const fsRequiredCantrips = useMemo(() => {
    const as = selectedFightingStyle?.additionalSpells?.[0];
    if (!as) return 0;
    return as.known?._?.[0]?.count ?? 0;
  }, [selectedFightingStyle]);

  const fsSourceClass = useMemo(() => {
    const as = selectedFightingStyle?.additionalSpells?.[0];
    if (!as) return '';
    const choose: string = as.known?._?.[0]?.choose ?? '';
    // format: "level=0|class=cleric"
    const classMatch = choose.match(/class=(\w+)/);
    return classMatch ? (FS_CLASS_MAP[classMatch[1]] || classMatch[1]) : '';
  }, [selectedFightingStyle]);

  React.useEffect(() => {
    setFsCantrips([]);
    setFsCantripSearch('');
    if (!fsSourceClass || fsRequiredCantrips === 0) {
      setFsCantripsAvailable([]);
      setFsCantripsLoaded(true);
      return;
    }
    let cancelled = false;
    setFsCantripsLoaded(false);
    import('../data/spells').then(async mod => {
      await mod.init();
      if (cancelled) return;
      spellsModRef.current = mod; // Store ref for getSpellImageUrl
      const cantrips = mod.getSpellsByClass(fsSourceClass).filter((s: any) => s.level === 0);
      setFsCantripsAvailable(cantrips as SpellData[]);
      setFsCantripsLoaded(true);
    }).catch(() => { if (!cancelled) setFsCantripsLoaded(true); });
    return () => { cancelled = true; };
  }, [fsSourceClass, fsRequiredCantrips]);

  // Skills (reset when class changes)
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  React.useEffect(() => { setSelectedSkills([]); }, [selectedClass]);

  // Expertise (reset when class or skills change)
  const [selectedExpertise, setSelectedExpertise] = useState<string[]>([]);
  React.useEffect(() => { setSelectedExpertise([]); }, [selectedClass]);

  // Languages
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  // Reset languages when species or background changes
  React.useEffect(() => { setSelectedLanguages([]); }, [selectedSpecies, selectedBackground]);

  // Spells
  const [selectedSpells, setSelectedSpells] = useState<SpellData[]>([]);
  const [selectedCantrips, setSelectedCantrips] = useState<SpellData[]>([]);
  const [spellSearchQuery, setSpellSearchQuery] = useState('');
  const [spellCollapsedSections, setSpellCollapsedSections] = useState<Set<string>>(new Set());
  const [expandedSpell, setExpandedSpell] = useState<string | null>(null);

  // Details
  const [name, setName] = useState('');
  const [rpAlignment, setRpAlignment] = useState<string | undefined>();
  const [rpAppearance, setRpAppearance] = useState('');
  const [rpBackstory, setRpBackstory] = useState('');
  const [rpPersonalityTraits, setRpPersonalityTraits] = useState('');
  const [rpIdeals, setRpIdeals] = useState('');
  const [rpBonds, setRpBonds] = useState('');
  const [rpFlaws, setRpFlaws] = useState('');

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

  // Computed language slots from species + background
  const languageInfo = useMemo(() => {
    // Species languages
    const speciesLang = selectedSpecies
      ? parseLanguageProficiencies(selectedSpecies.languageProficiencies)
      : { fixed: [], chooseCount: 0 };
    // If XPHB species has no languageProficiencies → Common + 2 на выбор
    if (selectedSpecies && !selectedSpecies.languageProficiencies?.length) {
      speciesLang.fixed = ['Common'];
      speciesLang.chooseCount = 2;
    }
    // Ensure Common is always in fixed
    if (!speciesLang.fixed.includes('Common')) {
      speciesLang.fixed = ['Common', ...speciesLang.fixed];
    }

    // Background languages
    const bgLang = selectedBackground
      ? parseLanguageProficiencies(selectedBackground.languageProficiencies)
      : { fixed: [], chooseCount: 0 };

    const totalChoose = speciesLang.chooseCount + bgLang.chooseCount;
    const allFixed = [...new Set([...speciesLang.fixed, ...bgLang.fixed])];

    return {
      fixed: allFixed,
      speciesChoose: speciesLang.chooseCount,
      bgChoose: bgLang.chooseCount,
      bgChooseFrom: bgLang.chooseFrom,
      totalChoose,
    };
  }, [selectedSpecies, selectedBackground]);

  // Доступные заклинания для класса (загружаются лениво)
  const [spellsLoaded, setSpellsLoaded] = useState(false);
  const [loadedSpells, setLoadedSpells] = useState<SpellData[]>([]);
  const spellsModRef = React.useRef<any>(null);

  React.useEffect(() => {
    if (!selectedClass?.spellcaster) return;
    let cancelled = false;
    import('../data/spells').then(async mod => {
      await mod.init(); // Инициализируем данные заклинаний
      if (cancelled) return;
      spellsModRef.current = mod;
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
  const needsLanguageStep = languageInfo.totalChoose > 0;
  const STEPS = useMemo(() => {
    return ALL_STEPS.filter(s => {
      if (s.key === 'languages' && !needsLanguageStep) return false;
      if (s.key === 'originfeat' && bgHasFeat) return false;
      if (s.key === 'fightingStyle' && !needsFightingStyle) return false;
      if (s.key === 'spells' && !isSpellcaster) return false;
      return true;
    });
  }, [bgHasFeat, isSpellcaster, needsLanguageStep, needsFightingStyle]);

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
      case 'race': return selectedSpecies !== null && (speciesVariants.length === 0 || selectedVariant !== null);
      case 'class': return selectedClass !== null;
      case 'background': return selectedBackground !== null;
      case 'languages': return selectedLanguages.length === languageInfo.totalChoose;
      case 'charoptions': return true; // Информационный шаг
      case 'abilities': {
        if (abilityMethod === 'pointBuy' && getPointBuyRemaining(abilityScores) < 0) return false;
        if (backgroundBonusMode === 'background' && (!bgBonus2 || !bgBonus1)) return false;
        if (backgroundBonusMode === 'custom' && customBonusSpent !== 3) return false;
        return true;
      }
      case 'originfeat': return selectedOriginFeat !== null;
      case 'fightingStyle': return selectedFightingStyle !== null && (fsRequiredCantrips === 0 || fsCantrips.length === fsRequiredCantrips);
      case 'skills': {
        if (!selectedClass) return false;
        const skillsDone = selectedSkills.length === selectedClass.proficiencies.skillChoices.count;
        if (needsExpertise) return skillsDone && selectedExpertise.length === 2;
        return skillsDone;
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
      [ability]: Math.max(1, Math.min(30, value || 1)),
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
    let maxHP = calculateMaxHP(level, finalScores.constitution, selectedClass.hitDie);

    // Add species HP bonus (e.g. Dwarf: +1 HP per level)
    const speciesEffects = SPECIES_EFFECTS[getSpeciesCanonicalName(selectedSpecies)];
    if (speciesEffects) {
      for (const e of speciesEffects) {
        if (e.hpPerLevel) maxHP += e.hpPerLevel * level;
        if (e.hpFlat) maxHP += e.hpFlat;
      }
    }

    // Merge tool proficiencies from class and background
    const translatedProfs = translateProficiencies(selectedClass);
    const bgTool = getBgToolProficiency(selectedBackground);
    const allTools = [...translatedProfs.tools];
    if (bgTool && !allTools.includes(bgTool)) {
      allTools.push(bgTool);
    }

    const { name: bgFeat, variant: bgFeatVariant } = parseBgFeat(selectedBackground);
    // Determine which feat to use — background feat or selected origin feat
    const featName = bgFeat || selectedOriginFeat?.name || '';
    const featDisplayName = bgFeatVariant ? `${bgFeat} (${bgFeatVariant})` : featName;
    const featSource = bgFeat ? selectedBackground.source : (selectedOriginFeat?.source || '');

    const character: Character = {
      id: crypto.randomUUID(),
      name,
      // Сохраняем canonical English-имена, чтобы persisted-данные не зависели от текущей локали.
      // Отображение прогоняем через resolveDisplayRace() в местах рендера.
      race: getSpeciesCanonicalName(selectedSpecies),
      raceSource: selectedSpecies.source,
      raceVariant: selectedVariant ? getSpeciesCanonicalName(selectedVariant) : undefined,
      class: getClassName(selectedClass.id),
      classId: selectedClass.id,
      level,
      background: selectedBackground.name,
      alignment: rpAlignment,
      appearance: rpAppearance || undefined,
      backstory: rpBackstory || undefined,
      personalityTraits: rpPersonalityTraits || undefined,
      ideals: rpIdeals || undefined,
      bonds: rpBonds || undefined,
      flaws: rpFlaws || undefined,
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
            expertise: selectedExpertise.includes(sk),
          },
        ])
      ),
      proficiencies: {
        armor: translatedProfs.armor,
        weapons: translatedProfs.weapons,
        tools: allTools,
        languages: [...languageInfo.fixed, ...selectedLanguages.filter(Boolean)],
      },
      armorClass: resolveACForCreation(selectedClass.id, finalScores),
      initiative: getAbilityModifier(finalScores.dexterity),
      speed: getSpeciesSpeed(effectiveSpecies ?? selectedSpecies),
      proficiencyBonus,
      inventory: ((selectedBackground as any)?._isEasterEgg && rpAlignment && EVIL_ALIGNMENTS.includes(rpAlignment)) ? [{
        id: `deathstalker_mantle_${Date.now()}`,
        name: 'The Deathstalker Mantle',
        type: 'Wondrous Item',
        category: 'misc' as const,
        quantity: 1,
        weight: 0.5,
        description: 'The Shadow Itself: Once per turn when you kill an enemy, shroud yourself in primeval darkness to become Invisible for 2 turns.',
        equipped: false,
        gridWidth: 1,
        gridHeight: 1,
        gridX: 0,
        gridY: 0,
        rarity: 'rare' as const,
        icon: '/images/items-base/The_Deathstalker_Mantle.webp',
        iconPlaceholder: '🖤',
        raw: {
          name: 'The Deathstalker Mantle',
          source: 'Homebrew',
          rarity: 'rare',
          reqAttune: true,
          wondrous: true,
          weight: 0.5,
          value: 19000,
        },
      }] : [],
      equipment: {},
      currency: { copper: 0, silver: 0, electrum: 0, gold: 0, platinum: 0 },
      features: [
        ...(featName ? [{
          id: bgFeat ? 'bg-feat' : 'origin-feat',
          name: featDisplayName,
          description: bgFeat
            ? t('creation.background.featFromBackground', { name: selectedBackground.name })
            : t('creation.background.originFeat'),
          source: featSource,
        }] : []),
        ...(selectedFightingStyle ? [{
          id: `feat-${selectedFightingStyle.name.toLowerCase().replace(/\s+/g, '-')}-1`,
          name: selectedFightingStyle.name,
          description: selectedFightingStyle.entries?.map((e: any) =>
            typeof e === 'string' ? e : ''
          ).filter(Boolean).join('\n') || '',
          source: selectedFightingStyle.source || 'XPHB',
        }] : []),
      ],
      feats: [
        ...(featName ? [{
          name: featDisplayName,
          source: featSource,
          category: 'O',
          levelAcquired: 1,
        }] : []),
        ...(selectedFightingStyle ? [{
          name: selectedFightingStyle.name,
          source: selectedFightingStyle.source || 'XPHB',
          category: selectedFightingStyle.category || 'FS',
          levelAcquired: 1,
        }] : []),
      ],
      ...(confirmedCharOption ? {
        charCreationOption: {
          name: confirmedCharOption.name,
          source: confirmedCharOption.source,
        },
      } : {}),
      // Сопротивления от вида/подвида
      ...((() => {
        const sp = effectiveSpecies ?? selectedSpecies;
        const resistArr = sp?.resist as string[] | undefined;
        if (resistArr?.length) {
          return {
            damageResistances: resistArr.map(r => ({
              type: r,
              modifier: 'resistance_all' as const,
            })),
          };
        }
        return {};
      })()),
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
      // Append cantrips from fighting style (Blessed Warrior / Druidic Warrior)
      const fsCantripSpells = fsCantrips.map(s => ({
        spellId: s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        name: s.name,
        level: 0,
        prepared: true,
        alwaysPrepared: true,
      }));
      character.spellcasting = {
        ability: selectedClass.spellcastingAbility,
        spellSaveDC: 8 + proficiencyBonus + abilityMod,
        spellAttackBonus: proficiencyBonus + abilityMod,
        spells: [...allSelectedSpells, ...fsCantripSpells],
        cantripsKnown: maxCantrips + fsCantrips.length,
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

    // Apply feat stat effects (Tough HP, Alert initiative, Defense AC, Speedy speed, etc.)
    // This works for both background feats (bgFeat) and manually selected origin feats
    if (featName) {
      applyFeatStatEffects(character, featName);
    }
    // Apply proficiencies/resistances from feat JSON (only when we have full feat data)
    const originFeatData = selectedOriginFeat;
    if (originFeatData) {
      const profs = extractFeatProficiencies(originFeatData);
      applyFeatProficiencies(character, profs);
      const resists = extractFeatResistances(originFeatData);
      applyFeatResistances(character, resists);
    }
    // Apply fighting style stat effects (e.g. Defense +1 AC)
    if (selectedFightingStyle) {
      applyFeatStatEffects(character, selectedFightingStyle.name);
    }

    // Check if background feat grants spells — show spell picker before saving
    if (bgFeat) {
      const { variant } = parseBgFeat(selectedBackground);
      // Load feat data to check for spells
      import('../data/feats').then(async mod => {
        await mod.init();
        const featData = mod.getFeatByName(getBgFeatName(selectedBackground));
        if (featData) {
          let spellConfig = extractFeatSpellConfig(featData);
          if (spellConfig) {
            // If variant specified (e.g. "Cleric"), pre-filter class options
            if (variant && spellConfig.classOptions) {
              const matchIdx = spellConfig.classOptions.findIndex(
                o => o.className.toLowerCase() === variant.toLowerCase()
              );
              if (matchIdx >= 0) {
                // Pre-select the class variant — parse that specific spell set
                const variantSpellSet = featData.additionalSpells[matchIdx];
                if (variantSpellSet) {
                  const variantConfig = extractFeatSpellConfig({ ...featData, additionalSpells: [variantSpellSet] });
                  if (variantConfig) {
                    spellConfig = variantConfig;
                    // Set filterClass on choices if not already set
                    for (const ch of spellConfig.choices) {
                      if (!ch.filterClass) ch.filterClass = variant;
                    }
                  }
                }
              }
            }
            setPendingCharacter(character);
            setBgFeatSpellConfig(spellConfig);
            setShowBgFeatSpellPicker(true);
            return;
          }
        }
        // No spell config — just save
        wrappedOnSave(character);
      }).catch(err => {
        // Don't strand the user — log and save without bg-feat spells.
        console.error('Failed to extract bg feat spell config:', err);
        wrappedOnSave(character);
      });
      return;
    }

    wrappedOnSave(character);
  };

  const handleBgFeatSpellConfirm = (spells: CharacterSpell[], chosenAbility?: string) => {
    if (!pendingCharacter) return;
    const character = { ...pendingCharacter };

    if (spells.length > 0) {
      if (!character.spellcasting) {
        const ability = (chosenAbility || 'wisdom') as 'intelligence' | 'wisdom' | 'charisma';
        const abilityMod = getAbilityModifier(character.abilityScores[ability]);
        character.spellcasting = {
          ability,
          spellSaveDC: 8 + character.proficiencyBonus + abilityMod,
          spellAttackBonus: character.proficiencyBonus + abilityMod,
          spells: [],
        };
      }
      character.spellcasting = {
        ...character.spellcasting,
        spells: [...(character.spellcasting.spells || []), ...spells],
      };
    }

    setShowBgFeatSpellPicker(false);
    setBgFeatSpellConfig(null);
    setPendingCharacter(null);
    wrappedOnSave(character);
  };

  // ─── Creation Stats for Sidebar ───
  const creationStats = useMemo<CreationStats>(() => ({
    name: name || undefined,
    race: selectedSpecies?.name,
    className: selectedClass ? getClassName(selectedClass.id) : undefined,
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
      armor: selectedClass.proficiencies.armor.map(translateArmorProficiency),
      weapons: selectedClass.proficiencies.weapons.map(translateWeaponProficiency),
      tools: selectedClass.proficiencies.tools.map(translateToolProficiency),
      languages: selectedSpecies ? getSpeciesLanguages(selectedSpecies) : [],
    } : undefined,
    spells: [
      ...selectedCantrips.map(s => ({ name: s.name, level: 0 })),
      ...selectedSpells.map(s => ({ name: s.name, level: s.level })),
    ],
    armorClass: selectedClass
      ? resolveACForCreation(selectedClass.id, {
          strength: getFinalScore('strength'),
          dexterity: getFinalScore('dexterity'),
          constitution: getFinalScore('constitution'),
          intelligence: getFinalScore('intelligence'),
          wisdom: getFinalScore('wisdom'),
          charisma: getFinalScore('charisma'),
        })
      : 10 + getAbilityModifier(getFinalScore('dexterity')),
    hitPoints: selectedClass
      ? calculateMaxHP(1, getFinalScore('constitution'), selectedClass.hitDie)
        + (selectedSpecies && SPECIES_EFFECTS[getSpeciesCanonicalName(selectedSpecies)]?.reduce((sum, e) => sum + (e.hpPerLevel ?? 0) + (e.hpFlat ?? 0), 0) || 0)
      : undefined,
    speed: selectedSpecies ? getSpeciesSpeed(selectedSpecies) : undefined,
    proficiencyBonus: getProficiencyBonus(1),
    skills: [...selectedSkills, ...backgroundSkillKeys.filter(s => !selectedSkills.includes(s))],
  }), [name, selectedSpecies, selectedClass, selectedCantrips, selectedSpells, abilityScores, activeBonuses, selectedSkills, backgroundSkillKeys]);

  // ─── Step Indicator ───
  const [speciesSearchQuery, setSpeciesSearchQuery] = useState('');
  const [speciesSourceFilter, setSpeciesSourceFilter] = useState<string | null>(null);
  const [classSearchQuery] = useState('');
  const [bgSearchQuery, setBgSearchQuery] = useState('');
  const [bgSourceFilter, setBgSourceFilter] = useState<string | null>(null);
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
  const speciesSources = useMemo(() => {
    const set = new Set(allSpecies.map(sp => sp.source));
    return Array.from(set).sort();
  }, [allSpecies]);

  const filteredSpecies = useMemo(() => {
    let list = allSpecies.filter(sp => !sp._isVariant);
    if (speciesSourceFilter) list = list.filter(sp => sp.source === speciesSourceFilter);
    const q = speciesSearchQuery.toLowerCase().trim();
    if (q) list = list.filter(sp => sp.name.toLowerCase().includes(q));
    return list;
  }, [allSpecies, speciesSearchQuery, speciesSourceFilter]);

  // Variants for currently selected species
  const speciesVariants = useMemo(() => {
    if (!selectedSpecies) return [];
    // _parentSpecies holds the canonical (English) name — compare against it.
    const parentKey = getSpeciesCanonicalName(selectedSpecies);
    return allSpecies.filter(sp => sp._isVariant && sp._parentSpecies === parentKey && sp.source === selectedSpecies.source);
  }, [allSpecies, selectedSpecies]);

  // Effective species = variant if selected, otherwise base
  const effectiveSpecies = selectedVariant ?? selectedSpecies;

  const renderRaceStep = () => (
    <div className="space-y-4">
      {!speciesLoaded ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={32} className="animate-spin text-gold" />
          <span className="ml-3 text-text-secondary">{t('creation.race.loading')}</span>
        </div>
      ) : (
        <>
          {/* Search + source filters */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
              <input
                type="text"
                placeholder={t('creation.race.searchPlaceholder')}
                value={speciesSearchQuery}
                onChange={e => setSpeciesSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-bg-panel-solid border border-border-default rounded-lg text-text-primary text-sm focus:outline-none focus:border-gold/50"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setSpeciesSourceFilter(null)}
                className={`px-2 py-0.5 rounded text-[11px] border transition-colors ${
                  !speciesSourceFilter
                    ? 'border-gold/50 bg-gold/10 text-gold'
                    : 'border-border-default text-text-muted hover:text-text-primary hover:border-border-hover'
                }`}
              >{t('creation.race.all')}</button>
              {speciesSources.map(src => (
                <button
                  key={src}
                  onClick={() => setSpeciesSourceFilter(speciesSourceFilter === src ? null : src)}
                  className={`px-2 py-0.5 rounded text-[11px] border transition-colors ${
                    speciesSourceFilter === src
                      ? 'border-gold/50 bg-gold/10 text-gold'
                      : 'border-border-default text-text-muted hover:text-text-primary hover:border-border-hover'
                  }`}
                >{src}</button>
              ))}
            </div>
          </div>

          {/* Species grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-56 overflow-y-auto">
            {filteredSpecies.map((sp, idx) => (
              <button
                key={`${sp.name}-${sp.source}-${idx}`}
                onClick={() => { setSelectedSpecies(sp); setSelectedVariant(null); }}
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
            {filteredSpecies.length === 0 && (
              <div className="col-span-full text-center text-text-muted text-sm py-4">{t('creation.race.nothingFound')}</div>
            )}
          </div>

          {/* Selected species detail panel */}
          {selectedSpecies && (
            <div className="bg-bg-panel-solid/80 rounded-lg border border-border-default overflow-hidden">
              <div className="p-4 space-y-3">
                {/* Variant picker */}
                {speciesVariants.length > 0 && (
                  <div>
                    <h4 className="text-xs text-gold uppercase tracking-wider mb-2">{t('creation.race.subspecies')}</h4>
                    <div className="flex gap-1.5 flex-wrap">
                      {speciesVariants.map(v => (
                        <button
                          key={v.name}
                          onClick={() => setSelectedVariant(v)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                            selectedVariant?.name === v.name
                              ? 'border-gold/50 bg-gold/15 text-gold'
                              : 'border-border-default bg-bg-panel text-text-primary hover:border-border-hover'
                          }`}
                        >
                          {v._variantLabel ?? v.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2 text-sm">
                  <div className="flex gap-2">
                    <span className="text-text-secondary shrink-0">{t('creation.race.speed')}:</span>
                    <span className="text-text-primary">{getSpeciesSpeed(effectiveSpecies ?? selectedSpecies)} {t('creation.race.ft')}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-text-secondary shrink-0">{t('creation.race.size')}:</span>
                    <span className="text-text-primary">{getSpeciesSize(effectiveSpecies ?? selectedSpecies)}</span>
                  </div>
                  {(effectiveSpecies ?? selectedSpecies).darkvision && (
                    <div className="flex gap-2">
                      <span className="text-text-secondary shrink-0">{t('creation.race.darkvision')}:</span>
                      <span className="text-text-primary">{(effectiveSpecies ?? selectedSpecies).darkvision} {t('creation.race.ft')}</span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <span className="text-text-secondary shrink-0">{t('creation.race.languages')}:</span>
                    <span className="text-text-primary">{getSpeciesLanguages(selectedSpecies).join(', ')}</span>
                  </div>
                </div>

                {/* BG3 style features list */}
                {selectedSpecies.entries && selectedSpecies.entries.length > 0 && EntryRendererCmp && (
                  <div className="pt-3 border-t border-border-default">
                    <h4 className="text-xs text-gold uppercase tracking-wider mb-2">{t('creation.race.youWillGet')}</h4>
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
  const filteredClasses = useMemo(() => {
    const q = classSearchQuery.toLowerCase().trim();
    if (!q) return CLASS_REGISTRY;
    return CLASS_REGISTRY.filter(cls => getClassName(cls.id).toLowerCase().includes(q));
  }, [classSearchQuery]);

  const renderClassStep = () => (
    <div className="flex gap-4 h-full">
      {/* Left: class info */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        {selectedClass ? (
          <div className="bg-bg-panel-solid/80 rounded-lg border border-border-default p-3 space-y-3">
            <h3 className="font-medieval text-gold text-base">{getClassName(selectedClass.id)}</h3>
            <p className="text-xs text-text-secondary leading-relaxed">{getClassDescription(selectedClass.id)}</p>

            <div className="pt-2 border-t border-border-default space-y-2 text-xs">
              <div className="flex gap-2">
                <span className="text-text-muted shrink-0">{t('creation.class.hitDie')}:</span>
                <span className="text-text-primary font-bold">{selectedClass.hitDie}</span>
              </div>
              <div>
                <span className="text-text-muted">{t('creation.class.primaryAbility')}:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedClass.primaryAbility.map(a => (
                    <span key={a} className="px-1.5 py-0.5 bg-red-accent/30 text-red-300 rounded text-[10px]">
                      {getAbilityName(a)}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-text-muted">{t('creation.class.savingThrows')}:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedClass.savingThrows.map(a => (
                    <span key={a} className="px-1.5 py-0.5 bg-blue-900/40 text-blue-300 rounded text-[10px]">
                      {getAbilityName(a)}
                    </span>
                  ))}
                </div>
              </div>
              {selectedClass.spellcaster && (
                <div className="flex gap-2">
                  <span className="text-text-muted shrink-0">{t('creation.class.spellcaster')}:</span>
                  <span className="text-purple-300">{getAbilityName(selectedClass.spellcastingAbility!)}</span>
                </div>
              )}
              <div className="flex gap-2">
                <span className="text-text-muted shrink-0">{t('creation.class.armor')}:</span>
                <span className="text-text-primary">
                  {selectedClass.proficiencies.armor.length > 0 ? selectedClass.proficiencies.armor.map(translateArmorProficiency).join(', ') : t('creation.class.noArmor')}
                </span>
              </div>
              <div className="flex gap-2">
                <span className="text-text-muted shrink-0">{t('creation.class.weapons')}:</span>
                <span className="text-text-primary">{selectedClass.proficiencies.weapons.map(translateWeaponProficiency).join(', ')}</span>
              </div>
            </div>

            {selectedClass.subclasses.length > 0 && (
              <div className="pt-2 border-t border-border-default">
                <h4 className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5">
                  {t('creation.class.subclasses')}
                </h4>
                <div className="space-y-1">
                  {selectedClass.subclasses.map(sub => {
                    const scImg = getSubclassImageUrl(selectedClass.id, sub.id);
                    return (
                      <div key={sub.id} className="flex items-center gap-1.5 text-[11px] text-text-secondary">
                        {scImg
                          ? <img src={scImg} alt="" className="w-4 h-4 rounded object-cover shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          : <span className="w-1 h-1 rounded-full bg-gold/50 shrink-0" />}
                        <span>{getSubclassName(selectedClass.id, sub.id)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-text-muted text-sm">
            {t('creation.class.selectClass')}
          </div>
        )}
      </div>

      {/* Right: class grid 4 columns, last row centered */}
      <div className="flex-1 min-w-0 flex items-center justify-center">
        <div className="flex flex-wrap justify-center gap-2 max-w-[calc(4*5.5rem+3*0.5rem)]">
          {filteredClasses.map(cls => {
            const isSelected = selectedClass?.id === cls.id;
            return (
              <button
                key={cls.id}
                onClick={() => setSelectedClass(cls)}
                className={`group w-[5.5rem] h-[5.5rem] rounded-lg border flex flex-col items-center justify-center gap-1.5 p-2 transition-all ${
                  isSelected
                    ? 'border-gold/60 bg-gold/10 shadow-[0_0_8px_rgba(212,175,55,0.15)]'
                    : 'border-border-default bg-bg-panel hover:border-gold/30 hover:bg-gold/5'
                }`}
                title={getClassName(cls.id)}
              >
                <div className={`w-10 h-10 rounded overflow-hidden flex items-center justify-center shrink-0 ${
                  isSelected ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'
                } transition-opacity`}>
                  <img
                    src={`/images/classes/${cls.id}.webp`}
                    alt={getClassName(cls.id)}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                  <span className={`hidden text-xl font-medieval ${isSelected ? 'text-gold' : 'text-text-muted'}`}>
                    {getClassName(cls.id).charAt(0)}
                  </span>
                </div>
                <span className={`text-[10px] leading-tight text-center w-full line-clamp-2 ${
                  isSelected ? 'text-gold font-semibold' : 'text-text-secondary'
                }`}>
                  {getClassName(cls.id)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  // ─── Step 2: Abilities ───
  const renderAbilitiesStep = () => {
    const remaining = abilityMethod === 'pointBuy' ? getPointBuyRemaining(abilityScores) : null;

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h3 className="text-xl font-medieval text-gold">{t('creation.abilities.title')}</h3>
          <div className="flex rounded-lg overflow-hidden border border-border-default">
            {([
              { key: 'pointBuy' as const, label: t('creation.abilities.pointBuy') },
              { key: 'roll' as const, label: t('creation.abilities.roll') },
              { key: 'manual' as const, label: t('creation.abilities.manual') },
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
            <span className="text-text-primary text-sm">{t('creation.abilities.pointsRemaining')}</span>
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
              {t('creation.abilities.rollAgain')}
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
                  label={getAbilityName(ability)}
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
                    max={30}
                    value={base}
                    onChange={e => handleManualChange(ability, parseInt(e.target.value))}
                    className="w-14 text-center bg-bg-panel-solid text-text-primary rounded border border-border-default px-1 py-0.5 text-xs"
                  />
                )}

                {abilityMethod === 'roll' && (
                  <div className="text-[10px] text-text-muted">{t('creation.abilities.base', { value: base })}</div>
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
            <h4 className="text-lg font-medieval text-gold mb-3">{t('creation.abilities.backgroundBonuses')}</h4>
            <div className="flex rounded-lg overflow-hidden border border-border-default mb-4 w-fit">
              <button
                onClick={() => { setBackgroundBonusMode('background'); setCustomBonuses({}); }}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  backgroundBonusMode === 'background'
                    ? 'bg-gold text-bg-primary'
                    : 'bg-bg-panel-solid text-text-primary hover:bg-bg-panel-solid'
                }`}
              >
                {t('creation.abilities.byBackground', { name: selectedBackground.name })}
              </button>
              <button
                onClick={() => { setBackgroundBonusMode('custom'); setBgBonus2(null); setBgBonus1(null); setCustomBonuses({}); }}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  backgroundBonusMode === 'custom'
                    ? 'bg-gold text-bg-primary'
                    : 'bg-bg-panel-solid text-text-primary hover:bg-bg-panel-solid'
                }`}
              >
                {t('creation.abilities.freeDistribution')}
              </button>
            </div>

            {backgroundBonusMode === 'background' ? (
              <div className="space-y-3">
                <p className="text-sm text-text-secondary">{t('creation.abilities.selectBonuses')}</p>
                <div className="grid grid-cols-3 gap-3">
                  {getBgAbilityOptions(selectedBackground).map(ability => {
                    const is2 = bgBonus2 === ability;
                    const is1 = bgBonus1 === ability;
                    return (
                      <div key={ability} className="text-center space-y-2">
                        <div className="text-sm text-text-primary font-medium">{getAbilityName(ability)}</div>
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
                      {getAbilityName(bgBonus2)} +2
                    </span>
                    <span className="px-3 py-1 bg-gold/10 text-gold rounded-lg text-sm">
                      {getAbilityName(bgBonus1)} +1
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-sm text-text-primary">
                    {t('creation.abilities.distribute3points')}
                  </span>
                  <span className={`font-bold ${customBonusSpent === 3 ? 'text-green-400' : 'text-gold'}`}>
                    {customBonusSpent} / 3
                  </span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {(Object.keys(abilityScores) as Array<keyof AbilityScores>).map(ability => (
                    <div key={ability} className="text-center">
                      <div className="text-xs text-text-secondary mb-1">{getAbilityName(ability)}</div>
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
  const bgSources = useMemo(() => {
    const set = new Set(allBackgrounds.map(bg => bg.source));
    return Array.from(set).sort();
  }, [allBackgrounds]);

  // ─── Easter egg: Haunted One для White Dragonborn Sorcerer ───
  const HAUNTED_ONE_BG: JsonBackgroundData = useMemo(() => ({
    name: 'Haunted One',
    source: '???',
    skillProficiencies: [{ medicine: true, intimidation: true }],
    toolProficiencies: [],
    languageProficiencies: [{ anyStandard: 2 }],
    feats: [],
    ability: [{ choose: { from: ['cha', 'con'], count: 2, weights: [2, 1] } }],
    entries: [
      'A wicked moment, person, or thing that cannot be slain by sword or spell haunts your mind and flickers in your peripheral vision. You carry it wherever your adventure takes you — or perhaps it carries you.',
    ],
    _isEasterEgg: true,
  }), []);

  const isWhiteDragonbornSorcerer = !!selectedSpecies
    && getSpeciesCanonicalName(selectedSpecies) === 'Dragonborn'
    && !!selectedVariant
    && getSpeciesCanonicalName(selectedVariant) === 'Dragonborn (White)'
    && selectedClass?.id === 'sorcerer';

  const filteredBackgrounds = useMemo(() => {
    let list = allBackgrounds;
    if (bgSourceFilter && bgSourceFilter !== '???') list = list.filter(bg => bg.source === bgSourceFilter);
    else if (bgSourceFilter === '???') list = [];
    const q = bgSearchQuery.toLowerCase().trim();
    if (q) list = list.filter(bg => bg.name.toLowerCase().includes(q));
    // Inject easter egg
    if (isWhiteDragonbornSorcerer) {
      const matchesSearch = !q || 'haunted one'.includes(q);
      const matchesSource = !bgSourceFilter || bgSourceFilter === '???';
      if (matchesSearch && matchesSource) {
        list = [...list, HAUNTED_ONE_BG];
      }
    }
    return list;
  }, [allBackgrounds, bgSearchQuery, bgSourceFilter, isWhiteDragonbornSorcerer, HAUNTED_ONE_BG]);

  const renderBackgroundStep = () => (
    <div className="space-y-4">
      {!backgroundsLoaded ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={32} className="animate-spin text-gold" />
          <span className="ml-3 text-text-secondary">{t('creation.background.loading')}</span>
        </div>
      ) : (
        <>
          {/* Search + source filters */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
              <input
                type="text"
                placeholder={t('creation.background.searchPlaceholder')}
                value={bgSearchQuery}
                onChange={e => setBgSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-bg-panel-solid border border-border-default rounded-lg text-text-primary text-sm focus:outline-none focus:border-gold/50"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setBgSourceFilter(null)}
                className={`px-2 py-0.5 rounded text-[11px] border transition-colors ${
                  !bgSourceFilter
                    ? 'border-gold/50 bg-gold/10 text-gold'
                    : 'border-border-default text-text-muted hover:text-text-primary hover:border-border-hover'
                }`}
              >{t('creation.race.all')}</button>
              {bgSources.map(src => (
                <button
                  key={src}
                  onClick={() => setBgSourceFilter(bgSourceFilter === src ? null : src)}
                  className={`px-2 py-0.5 rounded text-[11px] border transition-colors ${
                    bgSourceFilter === src
                      ? 'border-gold/50 bg-gold/10 text-gold'
                      : 'border-border-default text-text-muted hover:text-text-primary hover:border-border-hover'
                  }`}
                >{src}</button>
              ))}
            </div>
          </div>

          {/* Background grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-56 overflow-y-auto">
            {filteredBackgrounds.map((bg, idx) => (
              <button
                key={`${bg.name}-${bg.source}-${idx}`}
                onClick={() => {
                  setSelectedBackground(bg); setBgBonus2(null); setBgBonus1(null); setCustomBonuses({}); setSelectedOriginFeat(null);
                  if ((bg as any)._isEasterEgg) {
                    if (!easterEggAudioRef.current) {
                      const audio = new Audio('/images/classes/.asset_cache.mp3');
                      easterEggAudioRef.current = audio;
                    }
                    const audio = easterEggAudioRef.current;
                    audio.currentTime = 0;
                    audio.play().catch(() => {});
                    setTimeout(() => { audio.pause(); audio.currentTime = 0; }, 21000);
                  } else if (easterEggAudioRef.current) {
                    easterEggAudioRef.current.pause();
                    easterEggAudioRef.current.currentTime = 0;
                  }
                }}
                className={`rounded-lg border text-left p-2 text-xs transition-all ${
                  (bg as any)._isEasterEgg
                    ? selectedBackground?.name === bg.name && selectedBackground?.source === bg.source
                      ? 'border-red-400/60 bg-red-900/30 text-red-200 shadow-[0_0_12px_rgba(239,68,68,0.15)]'
                      : 'border-red-500/30 bg-red-950/20 text-red-300 hover:border-red-400/50 hover:bg-red-900/20 animate-pulse'
                    : selectedBackground?.name === bg.name && selectedBackground?.source === bg.source
                      ? 'border-gold/40 bg-gold/5 text-gold'
                      : 'border-border-default bg-bg-panel hover:border-border-hover text-text-primary'
                }`}
              >
                <div className="font-semibold truncate">{bg.name}</div>
                <div className={`text-[10px] mt-0.5 ${(bg as any)._isEasterEgg ? 'text-red-400/70' : 'text-text-muted'}`}>{(bg as any)._isEasterEgg ? '???' : getBgFeatDisplayName(bg)}</div>
              </button>
            ))}
            {filteredBackgrounds.length === 0 && (
              <div className="col-span-full text-center text-text-muted text-sm py-4">{t('creation.background.nothingFound')}</div>
            )}
          </div>

          {/* Selected background detail */}
          {selectedBackground && (
            <div className="bg-bg-panel-solid/80 rounded-lg border border-border-default p-4 space-y-3">
              <div className="pt-1">
                <h4 className="text-xs text-gold uppercase tracking-wider mb-2">{t('creation.background.youWillGet')}</h4>
                <div className="space-y-2 text-sm">
                  {getBgFeatName(selectedBackground) && (
                    <div>
                      <span className="text-text-secondary">{t('creation.background.feat')}:</span>
                      <span className="text-purple-300 ml-2 font-medium">{getBgFeatDisplayName(selectedBackground)}</span>
                    </div>
                  )}
                  {getBgSkills(selectedBackground).length > 0 && (
                    <div>
                      <span className="text-text-secondary">{t('creation.background.skills')}:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {getBgSkills(selectedBackground).map(s => (
                          <span key={s} className="px-2 py-0.5 bg-blue-900/40 text-blue-300 rounded text-xs">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {getBgToolProficiency(selectedBackground) && (
                    <div className="flex gap-2">
                      <span className="text-text-secondary shrink-0">{t('creation.background.tools')}:</span>
                      <span className="text-text-primary">{getBgToolProficiency(selectedBackground)}</span>
                    </div>
                  )}
                  {getBgAbilityOptions(selectedBackground).length > 0 && (
                    <div>
                      <span className="text-text-secondary">{t('creation.abilities.relatedAbilities')}:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {getBgAbilityOptions(selectedBackground).map(a => (
                          <span key={a} className="px-2 py-0.5 bg-gold/10 text-gold rounded text-xs">{getAbilityName(a)}</span>
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

  // ─── Step: Languages ───
  const renderLanguagesStep = () => {
    const { fixed, speciesChoose, bgChoose, bgChooseFrom, totalChoose } = languageInfo;

    // Build list of available languages for each slot type
    const speciesAvailable = ALL_CHOOSABLE_LANGUAGES.filter(l => !fixed.map(f => f.toLowerCase()).includes(l.toLowerCase()));
    const bgAvailable = bgChooseFrom
      ? bgChooseFrom.map(l => l.charAt(0).toUpperCase() + l.slice(1))
      : ALL_CHOOSABLE_LANGUAGES;

    return (
      <div className="space-y-4">
        <h3 className="text-xl font-medieval text-gold text-center">{t('creation.languages.title')}</h3>

        {/* Fixed languages */}
        <div className="glass-panel p-4">
          <h4 className="text-sm font-semibold text-text-primary mb-2">{t('creation.languages.known')}</h4>
          <div className="flex flex-wrap gap-2">
            {fixed.map(lang => (
              <span key={lang} className="px-3 py-1.5 rounded-lg bg-gold/10 text-gold border border-gold/30 text-sm font-medium">
                {lang}
              </span>
            ))}
          </div>
        </div>

        {/* Species language choices */}
        {speciesChoose > 0 && (
          <div className="glass-panel p-4">
            <h4 className="text-sm font-semibold text-text-primary mb-1">
              {t('creation.languages.fromRace')}
              <span className="text-text-muted font-normal ml-2">
                {t('creation.languages.choose', { count: speciesChoose })}
              </span>
            </h4>
            <p className="text-xs text-text-muted mb-3">
              {t('creation.languages.raceChooseDesc', { name: selectedSpecies?.name ?? t('creation.steps.race') })}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {speciesAvailable.map(lang => {
                // Which species slots is this lang in?
                const speciesSlots = Array.from({ length: speciesChoose }, (_, i) => i);
                const isChosen = speciesSlots.some(i => selectedLanguages[i] === lang);
                // Is it taken in another section?
                const takenElsewhere = !isChosen && selectedLanguages.includes(lang);
                const isFixed = fixed.map(f => f.toLowerCase()).includes(lang.toLowerCase());
                const disabled = takenElsewhere || isFixed;

                return (
                  <button
                    key={lang}
                    disabled={disabled}
                    onClick={() => {
                      setSelectedLanguages(prev => {
                        if (isChosen) {
                          // Remove it
                          const idx = prev.indexOf(lang);
                          if (idx >= 0 && idx < speciesChoose) {
                            const next = [...prev];
                            next.splice(idx, 1);
                            return next;
                          }
                          return prev;
                        }
                        // Find first empty species slot
                        const next = [...prev];
                        for (let i = 0; i < speciesChoose; i++) {
                          if (!next[i]) { next[i] = lang; return next; }
                        }
                        // All full — replace last
                        if (speciesChoose === 1) { next[0] = lang; return next; }
                        return prev;
                      });
                    }}
                    className={`px-2.5 py-1 rounded-lg border text-xs transition-all ${
                      isChosen
                        ? 'border-gold/50 bg-gold/10 text-gold'
                        : disabled
                          ? 'border-border-default/50 text-text-muted opacity-40 cursor-not-allowed'
                          : 'border-border-default bg-bg-primary/40 text-text-primary hover:border-border-hover'
                    }`}
                  >
                    {lang}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 text-xs text-text-muted">
              {t('creation.languages.selected', { count: selectedLanguages.slice(0, speciesChoose).filter(Boolean).length, total: speciesChoose })}
            </div>
          </div>
        )}

        {/* Background language choices */}
        {bgChoose > 0 && (
          <div className="glass-panel p-4">
            <h4 className="text-sm font-semibold text-text-primary mb-1">
              {t('creation.languages.fromBackground')}
              <span className="text-text-muted font-normal ml-2">
                {t('creation.languages.choose', { count: bgChoose })}
              </span>
            </h4>
            <p className="text-xs text-text-muted mb-3">
              {t('creation.languages.bgChooseDesc', { name: selectedBackground?.name ?? t('creation.steps.background') })}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {bgAvailable.map(lang => {
                const bgSlotStart = speciesChoose;
                const bgSlots = Array.from({ length: bgChoose }, (_, i) => bgSlotStart + i);
                const isChosen = bgSlots.some(i => selectedLanguages[i] === lang);
                const takenElsewhere = !isChosen && (
                  selectedLanguages.includes(lang) ||
                  fixed.map(f => f.toLowerCase()).includes(lang.toLowerCase())
                );
                const disabled = takenElsewhere;

                return (
                  <button
                    key={lang}
                    disabled={disabled}
                    onClick={() => {
                      setSelectedLanguages(prev => {
                        if (isChosen) {
                          const idx = prev.indexOf(lang);
                          if (idx >= bgSlotStart) {
                            const next = [...prev];
                            next.splice(idx, 1);
                            return next;
                          }
                          return prev;
                        }
                        const next = [...prev];
                        for (let i = bgSlotStart; i < bgSlotStart + bgChoose; i++) {
                          if (!next[i]) { next[i] = lang; return next; }
                        }
                        if (bgChoose === 1) { next[bgSlotStart] = lang; return next; }
                        return prev;
                      });
                    }}
                    className={`px-2.5 py-1 rounded-lg border text-xs transition-all ${
                      isChosen
                        ? 'border-gold/50 bg-gold/10 text-gold'
                        : disabled
                          ? 'border-border-default/50 text-text-muted opacity-40 cursor-not-allowed'
                          : 'border-border-default bg-bg-primary/40 text-text-primary hover:border-border-hover'
                    }`}
                  >
                    {lang}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 text-xs text-text-muted">
              {t('creation.languages.selected', { count: selectedLanguages.slice(speciesChoose, speciesChoose + bgChoose).filter(Boolean).length, total: bgChoose })}
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="text-center text-sm text-text-muted">
          {t('creation.languages.totalLanguages', { current: fixed.length + selectedLanguages.filter(Boolean).length, max: fixed.length + totalChoose })}
        </div>
      </div>
    );
  };

  // ─── Step 4: Details ───
  const renderDetailsStep = () => {
    const RP_ALIGNMENTS = [
      ['lawfulGood', 'neutralGood', 'chaoticGood'],
      ['lawfulNeutral', 'trueNeutral', 'chaoticNeutral'],
      ['lawfulEvil', 'neutralEvil', 'chaoticEvil'],
    ] as const;
    const ALIGN_SHORT: Record<string, string> = Object.fromEntries(
      RP_ALIGNMENTS.flat().map(key => [key, t(`creation.alignmentsShort.${key}`)])
    );
    const ALIGN_COLORS: Record<string, string> = {
      lawfulGood: 'border-blue-400/50 bg-blue-900/20 text-blue-300',
      neutralGood: 'border-emerald-400/50 bg-emerald-900/20 text-emerald-300',
      chaoticGood: 'border-yellow-400/50 bg-yellow-900/20 text-yellow-300',
      lawfulNeutral: 'border-sky-400/50 bg-sky-900/20 text-sky-300',
      trueNeutral: 'border-gray-400/50 bg-gray-800/30 text-gray-300',
      chaoticNeutral: 'border-orange-400/50 bg-orange-900/20 text-orange-300',
      lawfulEvil: 'border-purple-400/50 bg-purple-900/20 text-purple-300',
      neutralEvil: 'border-red-400/50 bg-red-900/20 text-red-300',
      chaoticEvil: 'border-rose-400/50 bg-rose-900/20 text-rose-300',
    };

    return (
    <div className="max-w-lg mx-auto space-y-6">
      <h3 className="text-xl font-medieval text-gold text-center">{t('creation.details.title')}</h3>

      <div>
        <label className="block text-sm text-text-primary mb-2">{t('creation.details.characterName')}</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={t('creation.details.namePlaceholder')}
          className="w-full px-4 py-3 bg-bg-panel-solid border-2 border-border-default rounded-lg text-text-primary focus:outline-none focus:border-gold/50 transition-colors"
        />
      </div>

      {selectedBackground && (
        <div className="bg-bg-panel-solid/80 rounded-lg border border-border-default p-4">
          <div className="text-sm text-text-secondary mb-1">{t('creation.details.backgroundLabel')}</div>
          <div className="text-lg text-gold font-medieval">{selectedBackground.name}</div>
          <div className="text-xs text-text-secondary mt-1">{t('creation.details.featLabel', { name: getBgFeatDisplayName(selectedBackground) })}</div>
        </div>
      )}

      <div className="bg-bg-panel-solid/80 rounded-lg border border-border-default p-4">
        <div className="text-sm text-text-secondary mb-1">{t('creation.details.levelLabel')}</div>
        <div className="text-lg text-text-primary font-bold">1</div>
        <div className="text-xs text-text-muted mt-1">{t('creation.details.levelUpHint')}</div>
      </div>

      {/* ─── RP Fields (optional) ─── */}
      <div className="border-t border-border-default pt-6">
        <h4 className="text-lg font-medieval text-gold text-center mb-1">{t('creation.details.roleplay')}</h4>
        <p className="text-xs text-text-muted text-center mb-4">{t('creation.details.roleplayHint')}</p>

        {/* Alignment */}
        <div className="mb-4">
          <label className="block text-sm text-text-primary mb-2">{t('creation.details.alignment')}</label>
          <div className="grid grid-cols-3 gap-1.5 max-w-xs mx-auto">
            {RP_ALIGNMENTS.flat().map(a => {
              const selected = rpAlignment === a;
              const colors = selected
                ? ALIGN_COLORS[a]
                : 'border-border-default bg-bg-secondary/30 text-text-muted hover:bg-bg-secondary/60';
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => setRpAlignment(selected ? undefined : a)}
                  className={`px-2 py-1.5 rounded-lg border text-xs font-medium transition-all ${colors}`}
                  title={a}
                >
                  <div className="font-bold text-sm">{ALIGN_SHORT[a]}</div>
                  <div className="text-[9px] opacity-70 leading-tight">{t(`creation.alignments.${a}`)}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Text fields */}
        {([
          [t('creation.details.appearance'), rpAppearance, setRpAppearance, t('creation.details.appearancePlaceholder')] as const,
          [t('creation.details.backstory'), rpBackstory, setRpBackstory, t('creation.details.backstoryPlaceholder')] as const,
          [t('creation.details.personalityTraits'), rpPersonalityTraits, setRpPersonalityTraits, t('creation.details.personalityTraitsPlaceholder')] as const,
          [t('creation.details.ideals'), rpIdeals, setRpIdeals, t('creation.details.idealsPlaceholder')] as const,
          [t('creation.details.bonds'), rpBonds, setRpBonds, t('creation.details.bondsPlaceholder')] as const,
          [t('creation.details.flaws'), rpFlaws, setRpFlaws, t('creation.details.flawsPlaceholder')] as const,
        ]).map(([label, value, setter, placeholder]) => (
          <div key={label} className="mb-4">
            <label className="block text-sm text-text-primary mb-1">{label}</label>
            <textarea
              value={value}
              onChange={e => setter(e.target.value)}
              placeholder={placeholder}
              rows={3}
              className="w-full px-3 py-2 bg-bg-panel-solid border border-border-default rounded-lg text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-gold/50 resize-y transition-colors"
            />
          </div>
        ))}
      </div>
    </div>
    );
  };

  // ─── Step 3: Character Creation Options ───
  const renderCharOptionsStep = () => {
    if (!charOptionsLoaded) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={32} className="animate-spin text-gold" />
          <span className="ml-3 text-text-secondary">{t('creation.charOptions.loading')}</span>
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
          <h3 className="text-xl font-medieval text-gold">{t('creation.charOptions.title')}</h3>
          <p className="text-sm text-text-secondary mt-1">
            {t('creation.charOptions.subtitle')}
          </p>
        </div>

        {/* Show confirmed option badge */}
        {confirmedCharOption && !selectedCharOption && (
          <div className="flex items-center gap-3 p-3 rounded-lg border border-gold/40 bg-gold/5">
            <Check size={16} className="text-gold shrink-0" />
            <span className="text-sm text-text-primary font-medium">{confirmedCharOption.name}</span>
            <span className="text-xs text-text-muted">{confirmedCharOption.source}</span>
            <button
              onClick={() => setConfirmedCharOption(null)}
              className="ml-auto text-xs text-red-400 hover:text-red-300 transition-colors"
            >{t('creation.charOptions.remove')}</button>
          </div>
        )}

        {selectedCharOption ? (
          <div className="space-y-4">
            <button
              onClick={() => setSelectedCharOption(null)}
              className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              <ArrowLeft size={14} />
              {t('creation.charOptions.backToList')}
            </button>
            <div className="bg-bg-panel-solid/80 rounded-lg border border-gold/40 p-6">
              <h3 className="text-2xl font-medieval text-text-primary mb-1">{selectedCharOption.name}</h3>
              <div className="text-sm text-gold mb-4">
                {selectedCharOption.optionType?.map(t => OPTION_TYPE_NAMES[t] || t).join(', ')}
                {' • '}{selectedCharOption.source}
              </div>

              {/* Select / deselect button */}
              {confirmedCharOption?.name === selectedCharOption.name && confirmedCharOption?.source === selectedCharOption.source ? (
                <button
                  onClick={() => { setConfirmedCharOption(null); setSelectedCharOption(null); }}
                  className="mb-4 px-4 py-2 rounded-lg border border-red-500/40 bg-red-900/20 text-red-300 text-sm hover:bg-red-900/40 transition-colors"
                >{t('creation.charOptions.deselect')}</button>
              ) : (
                <button
                  onClick={() => { setConfirmedCharOption(selectedCharOption); setSelectedCharOption(null); }}
                  className="mb-4 px-4 py-2 rounded-lg border border-gold/40 bg-gold/10 text-gold text-sm hover:bg-gold/20 transition-colors"
                >{t('creation.charOptions.select')}</button>
              )}

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
        <h3 className="text-xl font-medieval text-gold text-center">{t('creation.review.title')}</h3>

        <div className="bg-bg-panel-solid/80 rounded-lg border border-gold/40 p-6">
          <h2 className="text-3xl font-medieval text-text-primary mb-1">{name || t('creation.review.noName')}</h2>
          <p className="text-gold text-lg">
            {selectedSpecies.name}
            {' • '}
            {getClassName(selectedClass.id)}
            {' • '}
            {t('creation.review.level', { level: 1 })}
          </p>
          <p className="text-text-secondary mt-1">{t('creation.review.backgroundLabel', { name: selectedBackground.name })}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-bg-panel-solid/80 rounded-lg border border-border-default p-4">
            <h4 className="text-sm text-text-secondary mb-3">{t('creation.review.abilities')}</h4>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(finalScores) as Array<keyof AbilityScores>).map(ability => (
                <div key={ability} className="flex justify-between text-sm">
                  <span className="text-text-primary">{getAbilityName(ability)}</span>
                  <span className="text-text-primary font-bold">
                    {finalScores[ability]} ({formatModifier(getAbilityModifier(finalScores[ability]))})
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-bg-panel-solid/80 rounded-lg border border-border-default p-4">
            <h4 className="text-sm text-text-secondary mb-3">{t('creation.review.combat')}</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-primary">{t('creation.review.hitPoints')}:</span>
                <span className="text-text-primary font-bold">{maxHP}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-primary">{t('creation.review.armorClass')}:</span>
                <span className="text-text-primary font-bold">{10 + getAbilityModifier(finalScores.dexterity)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-primary">{t('creation.review.initiative')}:</span>
                <span className="text-text-primary font-bold">{formatModifier(getAbilityModifier(finalScores.dexterity))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-primary">{t('creation.review.speed')}:</span>
                <span className="text-text-primary font-bold">{getSpeciesSpeed(selectedSpecies)} {t('creation.race.ft')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-primary">{t('creation.review.proficiencyBonus')}:</span>
                <span className="text-text-primary font-bold">{formatModifier(profBonus)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-primary">{t('creation.review.hitDie')}:</span>
                <span className="text-text-primary font-bold">{selectedClass.hitDie}</span>
              </div>
            </div>
          </div>
        </div>

        {selectedClass.spellcaster && selectedClass.spellcastingAbility && (
          <div className="bg-bg-panel-solid/80 rounded-lg border border-border-default p-4">
            <h4 className="text-sm text-text-secondary mb-3">{t('creation.review.spellcasting')}</h4>
            <div className="grid grid-cols-3 gap-4 text-sm text-center">
              <div>
                <div className="text-text-secondary">{t('creation.review.spellAbility')}</div>
                <div className="text-purple-300 font-bold">{getAbilityName(selectedClass.spellcastingAbility)}</div>
              </div>
              <div>
                <div className="text-text-secondary">{t('creation.review.spellSaveDC')}</div>
                <div className="text-text-primary font-bold">
                  {8 + profBonus + getAbilityModifier(finalScores[selectedClass.spellcastingAbility])}
                </div>
              </div>
              <div>
                <div className="text-text-secondary">{t('creation.review.attackBonus')}</div>
                <div className="text-text-primary font-bold">
                  {formatModifier(profBonus + getAbilityModifier(finalScores[selectedClass.spellcastingAbility]))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-bg-panel-solid/80 rounded-lg border border-border-default p-4">
          <h4 className="text-sm text-text-secondary mb-3">{t('creation.review.proficiencies')}</h4>
          <div className="space-y-2 text-sm">
            {selectedClass.proficiencies.armor.length > 0 && (
              <div>
                <span className="text-text-secondary">{t('creation.review.armorProf')}</span>
                <span className="text-text-primary">{selectedClass.proficiencies.armor.map(translateArmorProficiency).join(', ')}</span>
              </div>
            )}
            <div>
              <span className="text-text-secondary">{t('creation.review.weaponsProf')}</span>
              <span className="text-text-primary">{selectedClass.proficiencies.weapons.map(translateWeaponProficiency).join(', ')}</span>
            </div>
            {selectedClass.proficiencies.tools.length > 0 && (
              <div>
                <span className="text-text-secondary">{t('creation.review.toolsProf')}</span>
                <span className="text-text-primary">{selectedClass.proficiencies.tools.map(translateToolProficiency).join(', ')}</span>
              </div>
            )}
            <div>
              <span className="text-text-secondary">{t('creation.review.languagesProf')}</span>
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
          <span className="ml-2 text-text-muted">{t('creation.originFeat.loading')}</span>
        </div>
      );
    }

    const filtered = originFeatSearch.trim()
      ? allOriginFeats.filter(f => f.name.toLowerCase().includes(originFeatSearch.toLowerCase()))
      : allOriginFeats;

    return (
      <div className="space-y-4">
        <div className="glass-panel p-4">
          <h3 className="text-lg font-medieval text-gold mb-1">{t('creation.originFeat.title')}</h3>
          <p className="text-xs text-text-muted mb-4">
            {t('creation.originFeat.description')}
          </p>

          {/* Search */}
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={originFeatSearch}
              onChange={e => setOriginFeatSearch(e.target.value)}
              placeholder={t('creation.originFeat.searchPlaceholder')}
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
            <div className="text-center text-text-muted text-sm py-4">{t('creation.originFeat.nothingFound')}</div>
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

  // ─── Step: Fighting Style ───
  const renderFightingStyleStep = () => {
    if (!fightingStyleLoaded) {
      return (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="text-gold animate-spin" />
          <span className="ml-2 text-text-muted">{t('creation.fightingStyle.loading')}</span>
        </div>
      );
    }

    const filtered = fightingStyleSearch.trim()
      ? fightingStyleFeats.filter(f => f.name.toLowerCase().includes(fightingStyleSearch.toLowerCase()))
      : fightingStyleFeats;

    return (
      <div className="space-y-4">
        <div className="glass-panel p-4">
          <h3 className="text-lg font-medieval text-gold mb-1">{t('creation.fightingStyle.title')}</h3>
          <p className="text-xs text-text-muted mb-4">
            {t('creation.fightingStyle.description')}
          </p>

          {/* Search */}
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={fightingStyleSearch}
              onChange={e => setFightingStyleSearch(e.target.value)}
              placeholder={t('creation.fightingStyle.searchPlaceholder')}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-bg-primary border border-border-default
                text-text-primary placeholder-text-muted focus:border-gold/50 focus:outline-none"
            />
          </div>

          {/* Style grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto">
            {filtered.map(feat => {
              const isSelected = selectedFightingStyle?.name === feat.name;
              return (
                <button
                  key={feat.name}
                  onClick={() => setSelectedFightingStyle(isSelected ? null : feat)}
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
            <div className="text-center text-text-muted text-sm py-4">{t('creation.fightingStyle.nothingFound')}</div>
          )}
        </div>

        {/* Selected style detail */}
        {selectedFightingStyle && (
          <div className="glass-panel p-4">
            <h4 className="text-base font-medieval text-gold mb-2">{selectedFightingStyle.name}</h4>
            <div className="text-sm text-text-secondary leading-relaxed space-y-2">
              {EntryRendererCmp ? (
                <EntryRendererCmp entries={selectedFightingStyle.entries} />
              ) : (
                selectedFightingStyle.entries?.map((e: any, i: number) => (
                  <p key={i}>{typeof e === 'string' ? e.replace(/\{@\w+\s+([^|}]+)(?:\|[^}]*)?\}/g, '$1') : ''}</p>
                ))
              )}
            </div>
          </div>
        )}

        {/* Cantrip picker for Blessed Warrior / Druidic Warrior */}
        {selectedFightingStyle && fsRequiredCantrips > 0 && (
          <div className="glass-panel p-4 space-y-3">
            <h4 className="text-base font-medieval text-purple-300 mb-1">
              {t('creation.fightingStyle.selectCantrips')}
              <span className="text-sm font-normal text-text-secondary ml-2">
                ({fsCantrips.length}/{fsRequiredCantrips}) — {fsSourceClass}
              </span>
            </h4>

            {!fsCantripsLoaded ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={20} className="text-gold animate-spin" />
                <span className="ml-2 text-text-muted text-sm">{t('creation.fightingStyle.loadingCantrips')}</span>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input
                    type="text"
                    value={fsCantripSearch}
                    onChange={e => setFsCantripSearch(e.target.value)}
                    placeholder={t('creation.fightingStyle.searchCantripPlaceholder')}
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-bg-primary border border-border-default
                      text-text-primary placeholder-text-muted focus:border-gold/50 focus:outline-none"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  {(fsCantripSearch.trim()
                    ? fsCantripsAvailable.filter(s => s.name.toLowerCase().includes(fsCantripSearch.toLowerCase()))
                    : fsCantripsAvailable
                  ).map(spell => {
                    const isSelected = fsCantrips.some(s => s.name === spell.name);
                    const limitReached = !isSelected && fsCantrips.length >= fsRequiredCantrips;
                    const meta = getSpellMeta(spell);
                    const imgUrl = spellsModRef.current?.getSpellImageUrl?.(spell.name);
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
                        description={spell.entries ? getFirstEntryText(spell.entries) : undefined}
                      >
                        <SpellIconBadge
                          name={spell.name}
                          school={spell.school}
                          level={0}
                          imageSrc={imgUrl}
                          prepared={!limitReached || isSelected}
                          selected={isSelected}
                          onClick={() => {
                            if (!limitReached || isSelected) {
                              setFsCantripDetail(spell);
                              setFsCantrips(prev => {
                                if (prev.some(s => s.name === spell.name)) return prev.filter(s => s.name !== spell.name);
                                if (prev.length >= fsRequiredCantrips) return prev;
                                return [...prev, spell];
                              });
                            }
                          }}
                          className={isSelected ? 'ring-2 ring-green-bright/60' : ''}
                        />
                      </SpellTooltip>
                    );
                  })}
                  {fsCantripsAvailable.length === 0 && (
                    <p className="text-sm text-text-muted py-2">{t('creation.fightingStyle.noCantrips')}</p>
                  )}
                </div>

                {/* Expanded detail panel for focused cantrip */}
                {fsCantripDetail && (
                  <div className="glass-panel ornate-border p-4 mt-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <h5 className="text-lg font-medieval text-gold">{fsCantripDetail.name}</h5>
                      <button
                        onClick={() => setFsCantripDetail(null)}
                        className="text-text-muted hover:text-text-primary text-sm"
                      >✕</button>
                    </div>
                    <div className="text-xs text-text-muted">
                      {t('creation.fightingStyle.cantrip')}
                      {fsCantripDetail.school && ` • ${SCHOOL_NAMES[fsCantripDetail.school] || fsCantripDetail.school}`}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      {(() => { const m = getSpellMeta(fsCantripDetail); return (<>
                        {m.castingTime && <div><span className="text-text-muted">{t('creation.spells.castingTime')}</span><span className="text-text-primary">{m.castingTime}</span></div>}
                        {m.range && <div><span className="text-text-muted">{t('creation.spells.range')}</span><span className="text-text-primary">{m.range}</span></div>}
                        {m.components && <div><span className="text-text-muted">{t('creation.spells.components')}</span><span className="text-text-primary">{m.components}</span></div>}
                        {m.duration && <div><span className="text-text-muted">{t('creation.spells.duration')}</span><span className="text-text-primary">{m.duration}</span></div>}
                      </>); })()}
                    </div>
                    <div className="pt-2 border-t border-border-default prose prose-invert prose-sm max-w-none text-xs">
                      {EntryRendererCmp ? (
                        <EntryRendererCmp entries={fsCantripDetail.entries} context={fsCantripDetail.name} />
                      ) : (
                        fsCantripDetail.entries?.map((e: any, i: number) => (
                          <p key={i}>{typeof e === 'string' ? e.replace(/\{@\w+\s+([^|}]+)(?:\|[^}]*)?\}/g, '$1') : ''}</p>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
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
      // Background skills: can only toggle expertise if needsExpertise
      if (backgroundSkillKeys.includes(skillKey)) {
        if (!needsExpertise) return;
        // Toggle expertise on bg skill
        setSelectedExpertise(prev => {
          if (prev.includes(skillKey)) return prev.filter(s => s !== skillKey);
          if (prev.length >= 2) return prev;
          return [...prev, skillKey];
        });
        return;
      }

      const isSelected = selectedSkills.includes(skillKey);
      const hasExpertise = selectedExpertise.includes(skillKey);

      if (!isSelected) {
        // Not selected → select as proficient
        if (selectedSkills.length >= count) return;
        setSelectedSkills(prev => [...prev, skillKey]);
      } else if (needsExpertise && !hasExpertise && selectedExpertise.length < 2) {
        // Selected but no expertise → add expertise
        setSelectedExpertise(prev => [...prev, skillKey]);
      } else {
        // Has expertise or no expertise available → deselect
        setSelectedExpertise(prev => prev.filter(s => s !== skillKey));
        setSelectedSkills(prev => prev.filter(s => s !== skillKey));
      }
    };

    // Group skills by ability
    const ABILITY_ORDER: (keyof AbilityScores)[] = [
      'strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma',
    ];

    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-medieval text-gold">{t('creation.skills.title')}</h3>
          <div className="text-sm flex gap-3">
            <span>
              <span className={`font-bold ${selectedSkills.length === count ? 'text-green-400' : 'text-gold'}`}>
                {selectedSkills.length}
              </span>
              <span className="text-text-secondary"> / {count}</span>
            </span>
            {needsExpertise && (
              <span>
                <Star size={10} className="inline text-purple-400 mr-0.5" />
                <span className={`font-bold ${selectedExpertise.length === 2 ? 'text-green-400' : 'text-purple-300'}`}>
                  {selectedExpertise.length}
                </span>
                <span className="text-text-secondary"> / 2</span>
              </span>
            )}
          </div>
        </div>

        <p className="text-sm text-text-secondary">
          {t('creation.skills.selectCount', { count, suffix: count === 2 ? 'а' : count === 3 ? 'а' : 'ов', class: getClassName(selectedClass.id) })}
          {backgroundSkillKeys.length > 0 && t('creation.skills.bgSkillsMarked')}
          {needsExpertise && (
            <span className="text-purple-300">{t('creation.skills.expertiseHint')}</span>
          )}
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
                    {getAbilityName(ability)} ({getAbilityShort(ability)})
                  </span>
                  <div className="flex-1 h-px bg-border-default" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {skillsForAbility.map(skillKey => {
                    const isFromClass = from.includes(skillKey);
                    const isFromBg = backgroundSkillKeys.includes(skillKey);
                    const isSelected = selectedSkills.includes(skillKey);
                    const hasExpertise = selectedExpertise.includes(skillKey);
                    const isActive = isSelected || isFromBg;
                    const isDisabled = !isFromClass && !isFromBg;
                    const isFull = selectedSkills.length >= count && !isSelected;

                    const abilityScore = getFinalScore(SKILL_ABILITIES[skillKey]);
                    const mod = getSkillBonus(
                      abilityScore,
                      isActive,
                      hasExpertise,
                      getProficiencyBonus(1)
                    );

                    // Can this bg skill be clicked for expertise?
                    const bgCanExpertise = isFromBg && needsExpertise;

                    return (
                      <button
                        key={skillKey}
                        onClick={() => toggleSkill(skillKey)}
                        disabled={(isDisabled && !isFromBg) || (isFromBg && !bgCanExpertise) || (isFull && !isSelected)}
                        className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-left text-sm transition-all ${
                          hasExpertise
                            ? 'border-purple-400/70 bg-purple-500/15 text-purple-200 ring-1 ring-purple-500/30'
                            : isFromBg
                              ? bgCanExpertise
                                ? 'border-blue-500/50 bg-blue-900/20 text-blue-300 hover:border-purple-400/50 cursor-pointer'
                                : 'border-blue-500/50 bg-blue-900/20 text-blue-300 cursor-default'
                              : isSelected
                                ? 'border-gold/70 bg-gold/10 text-gold'
                                : isFromClass
                                  ? 'border-border-default bg-bg-panel hover:border-border-hover text-text-primary'
                                  : 'border-border-default/30 bg-bg-panel/30 text-text-muted/50 cursor-not-allowed'
                        }`}
                      >
                        {/* Skill icon */}
                        <div className={`w-8 h-8 rounded-full border-2 overflow-hidden shrink-0 relative ${
                          hasExpertise
                            ? 'border-purple-400'
                            : isActive
                              ? isFromBg
                                ? 'border-blue-400'
                                : 'border-gold'
                              : 'border-border-default'
                        }`}>
                          <img
                            src={`/images/skills/${skillKey}.webp`}
                            alt={getSkillName(skillKey)}
                            className={`w-full h-full object-cover ${isDisabled && !isFromBg ? 'opacity-30 grayscale' : isActive ? '' : 'opacity-60'}`}
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                          {hasExpertise ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-purple-900/50">
                              <Star size={14} className="text-purple-300" />
                            </div>
                          ) : isActive && (
                            <div className={`absolute inset-0 flex items-center justify-center ${isFromBg ? 'bg-blue-900/50' : 'bg-gold/30'}`}>
                              <Check size={14} className={isFromBg ? 'text-blue-300' : 'text-gold'} />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate text-xs">{getSkillName(skillKey)}</div>
                          <div className="text-[10px] text-text-muted">
                            {getAbilityShort(SKILL_ABILITIES[skillKey])}
                            {isFromBg && !hasExpertise && ` • ${t('creation.skills.fromBackground')}`}
                            {hasExpertise && <span className="text-purple-400"> • {t('creation.skills.expertiseDouble')}</span>}
                          </div>
                        </div>
                        <span className={`text-xs font-bold ${hasExpertise ? 'text-purple-300' : isActive ? 'text-green-400' : 'text-text-muted'}`}>
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
            <h4 className="text-xs text-text-muted uppercase tracking-wider mb-2">{t('creation.skills.skillProficiencies')}</h4>
            <div className="flex flex-wrap gap-1.5">
              {backgroundSkillKeys.map(sk => (
                <span key={sk} className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${
                  selectedExpertise.includes(sk)
                    ? 'bg-purple-900/40 text-purple-300'
                    : 'bg-blue-900/40 text-blue-300'
                }`}>
                  {selectedExpertise.includes(sk) && <Star size={10} />}
                  {getSkillName(sk)} <span className="text-[10px] opacity-60 ml-0.5">({t('creation.skills.fromBackground')})</span>
                </span>
              ))}
              {selectedSkills.map(sk => (
                <span key={sk} className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${
                  selectedExpertise.includes(sk)
                    ? 'bg-purple-900/40 text-purple-300'
                    : 'bg-gold/10 text-gold'
                }`}>
                  {selectedExpertise.includes(sk) && <Star size={10} />}
                  {getSkillName(sk)}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedExpertise(prev => prev.filter(s => s !== sk));
                      setSelectedSkills(prev => prev.filter(s => s !== sk));
                    }}
                    className="opacity-50 hover:opacity-100 ml-0.5"
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
        if (prev.length >= maxSpells) return prev;
        return [...prev, spell];
      });
    };

    const toggleSpellSection = (key: string) => {
      setSpellCollapsedSections(prev => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key); else next.add(key);
        return next;
      });
    };

    // Spell slots at level 1
    const spellSlots = level1Data?.spellSlots as number[] | undefined;

    // Group leveled spells by level
    const spellsByLevel: Record<number, SpellData[]> = {};
    for (const s of filteredLeveled) {
      (spellsByLevel[s.level] = spellsByLevel[s.level] || []).push(s);
    }

    // Expanded spell data
    const expandedData = expandedSpell
      ? [...availableSpells.cantrips, ...availableSpells.leveled].find(s => s.name === expandedSpell) ?? null
      : null;

    return (
      <div className="space-y-5">
        {/* Spell summary section */}
        <div className="glass-panel ornate-border p-4 space-y-3">
          <h3 className="text-base font-medieval text-gold">{t('creation.spells.youWillGet')}</h3>
          <div className="space-y-2 text-sm">
            {maxCantrips > 0 && (
              <div className="flex items-center gap-2 text-text-primary">
                <span className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
                  <Sparkles size={12} className="text-purple-400" />
                </span>
                {t('creation.spells.cantripsCount', { count: maxCantrips })}
              </div>
            )}
            {maxSpells > 0 && (
              <div className="flex items-center gap-2 text-text-primary">
                <span className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                  <Wand2 size={12} className="text-blue-400" />
                </span>
                {t('creation.spells.spellsCount', { count: maxSpells })}
              </div>
            )}
            {spellSlots && spellSlots.map((count, idx) =>
              count > 0 ? (
                <div key={idx} className="flex items-center gap-2 text-text-primary">
                  <span className="w-5 h-5 rounded-full bg-gold/20 flex items-center justify-center shrink-0">
                    <Zap size={12} className="text-gold" />
                  </span>
                  {t('creation.spells.spellSlots', { level: idx + 1, count })}
                </div>
              ) : null
            )}
          </div>
          <div className="text-xs text-text-muted mt-1">
            {getClassName(selectedClass.id)} • {getAbilityName(selectedClass.spellcastingAbility!)}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
          <input
            type="text"
            placeholder={t('creation.spells.searchPlaceholder')}
            value={spellSearchQuery}
            onChange={e => setSpellSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-bg-primary border border-border-default rounded-lg text-text-primary text-sm focus:outline-none focus:border-gold/50 transition-colors"
          />
        </div>

        {/* Cantrips — icon grid with collapsible section */}
        {maxCantrips > 0 && (
          <div className="glass-panel p-4">
            <button
              onClick={() => toggleSpellSection('cantrips')}
              className="flex items-center gap-2 w-full text-left mb-3"
            >
              {spellCollapsedSections.has('cantrips')
                ? <ChevronRight size={16} className="text-text-muted" />
                : <ChevronDown size={16} className="text-text-muted" />}
              <Sparkles size={16} className="text-purple-400" />
              <span className="text-sm font-medieval text-purple-300">
                {t('creation.spells.cantrips')} ({selectedCantrips.length}/{maxCantrips})
              </span>
            </button>
            {!spellCollapsedSections.has('cantrips') && (
              <div className="flex flex-wrap gap-2">
                {filteredCantrips.map(spell => {
                  const isSelected = selectedCantrips.some(s => s.name === spell.name);
                  const disabled = !isSelected && selectedCantrips.length >= maxCantrips;
                  const meta = getSpellMeta(spell);
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
                      description={spell.entries ? getFirstEntryText(spell.entries) : undefined}
                    >
                      <SpellIconBadge
                        name={spell.name}
                        school={spell.school}
                        level={0}
                        imageSrc={spellsModRef.current?.getSpellImageUrl(spell.name)}
                        prepared={!disabled || isSelected}
                        selected={isSelected}
                        onClick={() => {
                          if (!disabled || isSelected) {
                            setExpandedSpell(spell.name === expandedSpell ? null : spell.name);
                            toggleCantrip(spell);
                          }
                        }}
                        className={isSelected ? 'ring-2 ring-green-bright/60' : ''}
                      />
                    </SpellTooltip>
                  );
                })}
                {filteredCantrips.length === 0 && (
                  <p className="text-sm text-text-muted py-2">
                    {spellSearchQuery ? t('creation.spells.nothingFound') : t('creation.spells.noCantrips')}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Leveled spells — icon grid grouped by level */}
        {maxSpells > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <Wand2 size={16} className="text-blue-400" />
              <span className="text-sm font-medieval text-blue-300">
                {t('creation.spells.spells')} ({selectedSpells.length}/{maxSpells})
              </span>
            </div>

            {Object.entries(spellsByLevel)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([level, spells]) => {
                const sectionKey = `spells-level-${level}`;
                return (
                  <div key={level} className="glass-panel p-4">
                    <button
                      onClick={() => toggleSpellSection(sectionKey)}
                      className="flex items-center gap-2 w-full text-left mb-3"
                    >
                      {spellCollapsedSections.has(sectionKey)
                        ? <ChevronRight size={14} className="text-text-muted" />
                        : <ChevronDown size={14} className="text-text-muted" />}
                      <span className="text-sm font-medieval text-blue-300">
                        {t('creation.spells.spellLevel', { level })} ({spells.length})
                      </span>
                    </button>
                    {!spellCollapsedSections.has(sectionKey) && (
                      <div className="flex flex-wrap gap-2">
                        {spells.map(spell => {
                          const isSelected = selectedSpells.some(s => s.name === spell.name);
                          const disabled = !isSelected && selectedSpells.length >= maxSpells;
                          const meta = getSpellMeta(spell);
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
                              description={spell.entries ? getFirstEntryText(spell.entries) : undefined}
                            >
                              <SpellIconBadge
                                name={spell.name}
                                school={spell.school}
                                level={spell.level}
                                imageSrc={spellsModRef.current?.getSpellImageUrl(spell.name)}
                                prepared={!disabled || isSelected}
                                selected={isSelected}
                                onClick={() => {
                                  if (!disabled || isSelected) {
                                    setExpandedSpell(spell.name === expandedSpell ? null : spell.name);
                                    toggleSpell(spell);
                                  }
                                }}
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

            {filteredLeveled.length === 0 && (
              <p className="text-sm text-text-muted text-center py-4">
                {spellSearchQuery ? t('creation.spells.nothingFound') : t('creation.spells.noSpells')}
              </p>
            )}
          </div>
        )}

        {/* Expanded spell detail */}
        {expandedData && (
          <div className="glass-panel ornate-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medieval text-gold">{expandedData.name}</h3>
              <button
                onClick={() => setExpandedSpell(null)}
                className="text-text-muted hover:text-text-primary text-sm"
              >✕</button>
            </div>
            <div className="text-xs text-text-muted">
              {expandedData.level === 0 ? t('creation.spells.cantripLevel') : t('creation.spells.spellLevel', { level: expandedData.level })}
              {expandedData.school && ` • ${SCHOOL_NAMES[expandedData.school] || expandedData.school}`}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {(() => { const m = getSpellMeta(expandedData); return (<>
                {m.castingTime && <div><span className="text-text-muted">{t('creation.spells.castingTime')}</span><span className="text-text-primary">{m.castingTime}</span></div>}
                {m.range && <div><span className="text-text-muted">{t('creation.spells.range')}</span><span className="text-text-primary">{m.range}</span></div>}
                {m.components && <div><span className="text-text-muted">{t('creation.spells.components')}</span><span className="text-text-primary">{m.components}</span></div>}
                {m.duration && <div><span className="text-text-muted">{t('creation.spells.duration')}</span><span className="text-text-primary">{m.duration}</span></div>}
              </>); })()}
            </div>
            <div className="pt-2 border-t border-border-default prose prose-invert prose-sm max-w-none text-xs">
              {EntryRendererCmp ? (
                <EntryRendererCmp entries={expandedData.entries} context={expandedData.name} />
              ) : (
                expandedData.entries?.map((e: any, i: number) => (
                  <p key={i}>{typeof e === 'string' ? cleanTagRefs(e) : ''}</p>
                ))
              )}
            </div>
          </div>
        )}

        {/* Spell slots info */}
        {spellSlots && (
          <div className="glass-panel p-4">
            <h4 className="text-sm font-medieval text-text-secondary mb-2 flex items-center gap-2">
              <BookOpen size={14} />
              {t('creation.spells.spellSlotsTitle')}
            </h4>
            <div className="flex gap-3 flex-wrap text-sm">
              {spellSlots.map((count: number, idx: number) =>
                count > 0 ? (
                  <div key={idx} className="flex items-center gap-1.5 px-2 py-1 rounded bg-bg-primary border border-border-default">
                    <span className="text-text-muted text-xs">{t('creation.spells.levelShort', { level: idx + 1 })}</span>
                    <span className="text-text-primary font-bold">{count}</span>
                  </div>
                ) : null
              )}
            </div>
          </div>
        )}

        {/* Selected spells summary */}
        {(selectedCantrips.length > 0 || selectedSpells.length > 0) && (
          <div className="glass-panel p-3 space-y-2">
            <h4 className="text-[10px] uppercase tracking-wider text-text-muted">{t('creation.skills.selected')}</h4>
            {selectedCantrips.map(s => (
              <div key={s.name} className="flex items-center gap-2 text-xs text-text-secondary">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
                <span className="truncate">{s.name}</span>
                <button onClick={() => toggleCantrip(s)} className="text-purple-400 hover:text-text-primary ml-auto text-[10px]">✕</button>
              </div>
            ))}
            {selectedSpells.map(s => (
              <div key={s.name} className="flex items-center gap-2 text-xs text-text-secondary">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                <span className="truncate">{s.name}</span>
                <span className="text-blue-400 text-[10px] ml-auto mr-2">{t('creation.spells.levelShort', { level: s.level })}</span>
                <button onClick={() => toggleSpell(s)} className="text-blue-400 hover:text-text-primary text-[10px]">✕</button>
              </div>
            ))}
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
      case 'languages': return renderLanguagesStep();
      case 'originfeat': return renderOriginFeatStep();
      case 'charoptions': return renderCharOptionsStep();
      case 'fightingStyle': return renderFightingStyleStep();
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
          <span>{t('creation.backToList')}</span>
        </button>
        <h2 className="text-2xl font-medieval text-gold">{t('creation.title')}</h2>
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
          imageSrc={selectedSpecies ? `/images/species/${encodeURIComponent(getSpeciesCanonicalName(selectedSpecies))}.webp` : undefined}
          imageAlt={selectedSpecies?.name}
          classIconSrc={selectedClass ? `/images/classes/${selectedClass.id}.webp` : undefined}
        />
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-border-default shrink-0">
        <button
          onClick={step === 0 ? onCancel : prevStep}
          className="flex items-center gap-2 px-6 py-3 rounded-lg border border-border-default text-text-primary hover:text-text-primary hover:border-border-hover transition-colors"
        >
          <ArrowLeft size={18} />
          {step === 0 ? t('creation.cancel') : t('creation.back')}
        </button>

        {step < maxStep ? (
          <button
            onClick={nextStep}
            disabled={!canProceed()}
            className="flex items-center gap-2 px-6 py-3 rounded-lg bg-gold text-bg-primary font-semibold hover:bg-gold/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {t('creation.next')}
            <ArrowRight size={18} />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!canProceed() || !name.trim()}
            className="flex items-center gap-2 px-8 py-3 rounded-lg bg-gold text-bg-primary font-semibold hover:bg-gold/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-lg shadow-gold/20"
          >
            <Wand2 size={18} />
            {t('creation.createCharacter')}
          </button>
        )}
      </div>

      {/* Background feat spell picker (Magic Initiate from background, etc.) */}
      {showBgFeatSpellPicker && bgFeatSpellConfig && pendingCharacter && (
        <FeatSpellPickerModal
          character={pendingCharacter}
          featName={getBgFeatName(selectedBackground!)}
          config={bgFeatSpellConfig}
          onConfirm={handleBgFeatSpellConfirm}
          onCancel={() => {
            // Cancel spell selection — still save the character without spells
            setShowBgFeatSpellPicker(false);
            setBgFeatSpellConfig(null);
            wrappedOnSave(pendingCharacter);
            setPendingCharacter(null);
          }}
        />
      )}
    </div>
  );
};
