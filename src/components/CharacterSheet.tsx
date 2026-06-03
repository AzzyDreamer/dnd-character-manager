import React, { useState, useEffect, Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import type { Character, AbilityScores, CharacterSpell, SpellSlots, DamageResistanceEntry, DamageResistanceModifier } from '../types';
import { getAbilityModifier, formatModifier, getProficiencyBonus, getSkillBonus, getAbilityName, getAbilityShort, SKILL_ABILITIES, getSkillName, recalcDerivedStats } from '../utils/dnd';
import { getDamageTypeName } from '../data/items/constants';
import { CLASS_REGISTRY, getClassById, getClassName, getSubclassName, getSubclassDisplayName, findSubclass } from '../data/classes';
import { Heart, Shield, Backpack, ArrowUp, ScrollText, Scroll, ChevronLeft, ChevronRight, ChevronDown, Sparkles, BookOpen, Dices, Calculator, Target, Check, Star, Languages, Swords, X, Plus, ShieldAlert, Search, Loader2, User, Skull } from 'lucide-react';
import { InventoryGrid } from './InventoryGrid';
import { SpellLevelUpModal, type LevelTableRow } from './SpellLevelUpModal';
import { FeatPickerModal, type FeatPickerResult } from './FeatPickerModal';
import { FeatSpellPickerModal } from './FeatSpellPickerModal';
import { applyFeatStatEffects, applyFeatProficiencies, applyFeatResistances, extractFeatProficiencies, extractFeatResistances, getOngoingFeatHpBonus, type FeatSpellConfig } from '../utils/featEffects';
import { getOngoingClassHpBonus, getSubclassHpFlatBonus, getSubclassIdByName, resolveAC, getClassSpeedBonus, applyLevelUpEffects, getEquippedItemBonuses, getEffectiveAbilityScores } from '../utils/classEffects';
import { getAllItemTemplatesSync } from '../data/items';
import { ExpertisePickerModal } from './ExpertisePickerModal';
import { FeatSpellSwapModal } from './FeatSpellSwapModal';
import { OptionalFeaturePickerModal, OPTIONAL_FEATURE_CONFIGS, type OptionalFeaturePickerResult, type OptionalFeaturePickerConfig } from './InvocationPickerModal';
import { TabBar, type Tab, CharacterStatsSidebar, StatBadge, SpellIconBadge, SpellTooltip } from './ui';
import { useDiceRoll } from './DiceRollProvider';
import { getSubclassImageUrl, type SubclassJsonData } from '../data/classes/subclassJsonLoader';
import { PortraitCropModal } from './PortraitCropModal';
import { AutoSpellsNotificationModal } from './AutoSpellsNotificationModal';
import { getNewAutoSpellsAtLevel, type AutoSpellResult } from '../utils/autoSpells';
import { resolveDisplayRace } from '../data/species';
import { asset } from '../utils/asset';
import { useSettings } from './SettingsProvider';
import { FullEditPanel } from './FullEditPanel';
import { CharacterJsonEditorModal } from './CharacterJsonEditorModal';
import { stampManualEdit } from '../utils/manualEdit';
import { useBackDismiss } from '../hooks/useBackDismiss';

// Ленивая загрузка SpellsTab (тянет за собой spells + entryRenderer + registry)
const LazyActionsSpellsTab = lazy(() => import('./SpellsTab').then(m => ({ default: m.ActionsSpellsTab })));
const LazyDiceTab = lazy(() => import('./DiceTab').then(m => ({ default: m.DiceTab })));
const LazyRoleplayTab = lazy(() => import('./RoleplayTab').then(m => ({ default: m.RoleplayTab })));

type SheetTab = 'stats' | 'inventory' | 'actions' | 'proficiencies' | 'dice' | 'roleplay';

interface CharacterSheetProps {
  character: Character;
  onUpdate: (character: Character) => void;
}

export const CharacterSheet: React.FC<CharacterSheetProps> = ({ character, onUpdate }) => {
  const { t } = useTranslation('character');
  const { fullEditMode } = useSettings();
  const [showJsonEditor, setShowJsonEditor] = useState(false);
  // Любая правка через режим полного редактирования проставляет скрытую пометку.
  const commitFullEdit = (updated: Character) => onUpdate(stampManualEdit(updated));
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
  const [showExpertisePicker, setShowExpertisePicker] = useState(false);
  const [pendingExpertise, setPendingExpertise] = useState<{
    updatedChar: Character;
    count: number;
  } | null>(null);
  const [showFightingStylePicker, setShowFightingStylePicker] = useState(false);
  const [pendingFightingStyleLevelUp, setPendingFightingStyleLevelUp] = useState<{
    updatedChar: Character;
  } | null>(null);
  // Cantrip picker for Blessed/Druidic Warrior after FS selection
  const [showFsCantripPicker, setShowFsCantripPicker] = useState(false);
  const [pendingFsCantrips, setPendingFsCantrips] = useState<{
    updatedChar: Character;
    count: number;
    sourceClass: string;
  } | null>(null);
  // Fighting style replacement on level-up
  const [showFsReplaceModal, setShowFsReplaceModal] = useState(false);
  const [pendingFsReplace, setPendingFsReplace] = useState<{
    updatedChar: Character;
  } | null>(null);

  // Optional feature picker on level-up (invocations, metamagic, maneuvers)
  const [showOptionalFeaturePicker, setShowOptionalFeaturePicker] = useState(false);
  const [pendingOptionalFeature, setPendingOptionalFeature] = useState<{
    updatedChar: Character;
    config: OptionalFeaturePickerConfig;
    newSlots: number;
    allowReplace: boolean;
    // Queue of remaining optional feature checks to run after this one
    remainingChecks: (() => void)[];
  } | null>(null);

  // Auto-spells notification on level-up (subclass + racial)
  const [showAutoSpellsNotification, setShowAutoSpellsNotification] = useState(false);
  const [pendingAutoSpells, setPendingAutoSpells] = useState<{
    updatedChar: Character;
    newSpells: AutoSpellResult[];
  } | null>(null);

  // Feat spell swap on level-up
  const [showFeatSpellSwap, setShowFeatSpellSwap] = useState(false);
  const [pendingFeatSwapChar, setPendingFeatSwapChar] = useState<Character | null>(null);

  // Feat spell picker (Magic Initiate, Fey-Touched, etc.)
  const [showFeatSpellPicker, setShowFeatSpellPicker] = useState(false);
  const [pendingFeatSpells, setPendingFeatSpells] = useState<{
    updatedChar: Character;
    featName: string;
    config: FeatSpellConfig;
  } | null>(null);

  const [showCropModal, setShowCropModal] = useState(false);
  const [pendingPortraitUrl, setPendingPortraitUrl] = useState<string | null>(null);

  const classDef = character.classId ? getClassById(character.classId) : CLASS_REGISTRY.find(c => c.name === character.class);
  const portraitInputRef = React.useRef<HTMLInputElement>(null);
  const effectiveScores = getEffectiveAbilityScores(character);
  // Character with effective ability scores for display purposes
  const displayCharacter = React.useMemo(() => {
    if (effectiveScores === character.abilityScores) return character;
    return { ...character, abilityScores: effectiveScores };
  }, [character, effectiveScores]);

  // Миграция: обновить raw данные предметов из актуальных шаблонов (мёрж бонусов)
  useEffect(() => {
    const inv = character.inventory;
    if (!inv || inv.length === 0) return;
    const templates = getAllItemTemplatesSync();
    let changed = false;
    const migrated = inv.map(item => {
      const tmpl = templates.find(t => t.name === item.name);
      if (!tmpl) return item;
      // Если raw отсутствует или шаблон имеет поля, которых нет в item.raw — обновить
      const newRaw = { ...(item.raw ?? {}), ...tmpl.raw };
      const newEquipSlot = item.equipSlot ?? tmpl.equipSlot;
      const rawChanged = JSON.stringify(newRaw) !== JSON.stringify(item.raw);
      const slotChanged = newEquipSlot !== item.equipSlot;
      if (rawChanged || slotChanged) {
        changed = true;
        return { ...item, raw: newRaw, equipSlot: newEquipSlot };
      }
      return item;
    });
    if (changed) {
      const updated = { ...character, inventory: migrated, armorClass: 0 };
      updated.armorClass = resolveAC(updated);
      onUpdate(updated);
    }
  }, [character.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Миграция: amulet/ring1/ring2 → accessory1/accessory2/accessory3
  useEffect(() => {
    const eq = character.equipment;
    if (!eq) return;
    const legacy = eq as Record<string, string | undefined>;
    if (!legacy.amulet && !legacy.ring1 && !legacy.ring2) return;
    const newEq = { ...eq };
    const newEqAny = newEq as Record<string, string | undefined>;
    if (legacy.amulet) { newEqAny.accessory1 = legacy.amulet; delete newEqAny.amulet; }
    if (legacy.ring1) { newEqAny.accessory2 = legacy.ring1; delete newEqAny.ring1; }
    if (legacy.ring2) { newEqAny.accessory3 = legacy.ring2; delete newEqAny.ring2; }
    // Обновить equipSlot у предметов
    const inv = (character.inventory ?? []).map(item => {
      if (item.equipSlot === 'amulet' as any || item.equipSlot === 'ring1' as any || item.equipSlot === 'ring2' as any) {
        return { ...item, equipSlot: 'accessory1' as const };
      }
      return item;
    });
    const updated = { ...character, equipment: newEq, inventory: inv, armorClass: 0 };
    updated.armorClass = resolveAC(updated);
    onUpdate(updated);
  }, [character.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePortraitUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // Resize to max QHD (2560) for quality portraits in localStorage
        const MAX = 2560;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          const scale = MAX / Math.max(w, h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setPendingPortraitUrl(dataUrl);
        setShowCropModal(true);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

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
    // Add ongoing HP bonus from feats like Tough (+2 per level)
    const featHpBonus = getOngoingFeatHpBonus(character);
    // Add ongoing HP bonus from class/subclass/species (e.g. Draconic Resilience +1/level, Dwarf +1/level)
    const classHpBonus = getOngoingClassHpBonus(character);
    const totalHpGain = hpGain + featHpBonus + classHpBonus;

    const updated: Character = {
      ...character,
      level: newLevel,
      hitPoints: {
        ...character.hitPoints,
        max: character.hitPoints.max + totalHpGain,
        current: character.hitPoints.current + totalHpGain,
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

      // Apply flat HP bonus when subclass is first selected (e.g. Draconic Resilience +3)
      const subId = getSubclassIdByName(character.classId, subclass);
      if (subId) {
        const flatHp = getSubclassHpFlatBonus(character.classId, subId);
        if (flatHp > 0) {
          updated.hitPoints = {
            ...updated.hitPoints,
            max: updated.hitPoints.max + flatHp,
            current: updated.hitPoints.current + flatHp,
          };
        }
      }
    }

    // Recalculate AC considering class/subclass formulas (e.g. Barbarian/Monk Unarmored Defense, Draconic Resilience)
    updated.armorClass = resolveAC(updated);

    // Recalculate speed with class/subclass bonuses (e.g. Barbarian Fast Movement, Monk Unarmored Movement)
    const baseSpeed = character.speed - getClassSpeedBonus(character);
    updated.speed = baseSpeed + getClassSpeedBonus(updated);

    // Apply permanent effects gained at this level (resistances, saving throw proficiencies)
    applyLevelUpEffects(updated, newLevel);

    // Update spellcasting stats if applicable
    if (updated.spellcasting) {
      const abilityMod = getAbilityModifier(updated.abilityScores[updated.spellcasting.ability]);
      updated.spellcasting = {
        ...updated.spellcasting,
        spellSaveDC: 8 + newProfBonus + abilityMod,
        spellAttackBonus: newProfBonus + abilityMod,
      };
    }

    // Recalculate initiative if Alert feat is present (adds proficiency bonus)
    const hasAlert = (updated.feats ?? []).some(f => f.name === 'Alert');
    if (hasAlert) {
      updated.initiative = getAbilityModifier(updated.abilityScores.dexterity) + newProfBonus;
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

    // Check auto-spells → Invocations → FS replacement → Fighting Style → ASI/EB chain
    if (checkAndShowAutoSpells(updated)) return;

    onUpdate(updated);
    setShowSubclassModal(false);
  };

  /** Detect all optional features to pick at this level and show pickers sequentially. */
  const checkAndShowOptionalFeaturePickers = (updated: Character): boolean => {
    (async () => {
      try {
        const mod = await import('../data/classes/classJsonLoader');
        await mod.init();
        const data = mod.getClassDataByName(updated.class);

        // Collect all optional feature picks needed at this level
        type FeaturePick = { config: OptionalFeaturePickerConfig; gain: number; allowReplace: boolean };
        const picks: FeaturePick[] = [];

        // --- Warlock: Eldritch Invocations (from invocations field in levelTable) ---
        if (data?.levelTable) {
          const oldRow = data.levelTable.find((r: any) => r.level === updated.level - 1);
          const newRow = data.levelTable.find((r: any) => r.level === updated.level);
          const oldInv = (oldRow as any)?.invocations ?? 0;
          const newInv = (newRow as any)?.invocations ?? 0;
          const gain = newInv - oldInv;
          const hasExisting = (updated.optionalFeatures ?? []).some(f => f.featureType === 'EI');

          if (gain > 0 || (newInv > 0 && hasExisting)) {
            picks.push({
              config: OPTIONAL_FEATURE_CONFIGS['EI'],
              gain,
              allowReplace: hasExisting,
            });
          }
        }

        // --- Sorcerer: Metamagic (from "Metamagic" in features array) ---
        if (data?.levelTable) {
          const newRow = data.levelTable.find((r: any) => r.level === updated.level);
          const features: string[] = (newRow as any)?.features ?? [];
          if (features.includes('Metamagic')) {
            const hasExisting = (updated.optionalFeatures ?? []).some(f => f.featureType === 'MM');
            picks.push({
              config: OPTIONAL_FEATURE_CONFIGS['MM'],
              gain: 2, // PHB'24: always 2 metamagic options
              allowReplace: hasExisting,
            });
          }
        }

        // --- Battle Master: Maneuvers (subclass feature) ---
        if (updated.subclass && updated.classId === 'fighter') {
          try {
            const subMod = await import('../data/classes/subclassJsonLoader');
            await subMod.init();
            const subData = subMod.getSubclassById('fighter', 'battle-master');
            if (subData) {
              // Battle Master gains maneuvers at levels 3, 7, 10, 15
              const BM_MANEUVER_GAINS: Record<number, number> = { 3: 3, 7: 2, 10: 2, 15: 2 };
              const gain = BM_MANEUVER_GAINS[updated.level] ?? 0;
              const hasExisting = (updated.optionalFeatures ?? []).some(f => f.featureType === 'MV:B');
              if (gain > 0) {
                picks.push({
                  config: OPTIONAL_FEATURE_CONFIGS['MV:B'],
                  gain,
                  allowReplace: hasExisting,
                });
              }
            }
          } catch (e) { /* ignore */ }
        }

        if (picks.length === 0) {
          checkAndShowExpertise(updated);
          return;
        }

        // Show the first pick, queue the rest
        const [first, ...rest] = picks;
        const remainingChecks = rest.map(pick => () => {
          setPendingOptionalFeature(prev => {
            if (!prev) return null;
            return {
              updatedChar: prev.updatedChar, // will be overwritten by confirm handler
              config: pick.config,
              newSlots: pick.gain,
              allowReplace: pick.allowReplace,
              remainingChecks: prev.remainingChecks.slice(1),
            };
          });
          setShowOptionalFeaturePicker(true);
        });

        setPendingOptionalFeature({
          updatedChar: updated,
          config: first.config,
          newSlots: first.gain,
          allowReplace: first.allowReplace,
          remainingChecks,
        });
        setShowOptionalFeaturePicker(true);
      } catch (e) {
        console.warn('Failed to check optional features:', e);
        checkAndShowExpertise(updated);
      }
    })();
    return true;
  };

  /** Extract innate spell names from an optional feature's additionalSpells field */
  const extractInnateSpellNames = (feat: any): string[] => {
    const spells: string[] = [];
    const asList = feat.additionalSpells;
    if (!Array.isArray(asList)) return spells;
    for (const as of asList) {
      const innate = as?.innate?._;
      if (!innate) continue;
      if (Array.isArray(innate)) {
        // Simple list: ["speak with animals"]
        for (const s of innate) {
          if (typeof s === 'string') spells.push(s.split('|')[0]);
        }
      } else if (typeof innate === 'object') {
        // Daily use: { daily: { "1e": ["compulsion"] } }
        const daily = innate.daily;
        if (daily) {
          for (const arr of Object.values(daily)) {
            if (Array.isArray(arr)) {
              for (const s of arr) {
                if (typeof s === 'string') spells.push(s.split('|')[0]);
              }
            }
          }
        }
      }
    }
    return spells;
  };

  /** Apply spell and skill effects from an optional feature onto the character */
  const applyOptionalFeatureEffects = async (char: Character, feat: any): Promise<Character> => {
    let updated = { ...char };

    // 1) additionalSpells — add innate spells to character
    const spellNames = extractInnateSpellNames(feat);
    if (spellNames.length > 0) {
      const spellsMod = await import('../data/spells');
      await spellsMod.init();
      const newSpells = spellNames
        .filter(name => {
          // Skip if already known
          const existing = updated.spellcasting?.spells ?? [];
          return !existing.some(s => s.name.toLowerCase() === name.toLowerCase());
        })
        .map(name => {
          const spellData = spellsMod.getSpellByName(name);
          return {
            spellId: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            name: spellData?.name ?? name.replace(/\b\w/g, c => c.toUpperCase()),
            level: spellData?.level ?? 0,
            prepared: true,
            alwaysPrepared: true,
            source: feat.name,
          };
        });
      if (newSpells.length > 0 && updated.spellcasting) {
        updated.spellcasting = {
          ...updated.spellcasting,
          spells: [...updated.spellcasting.spells, ...newSpells],
        };
      } else if (newSpells.length > 0 && !updated.spellcasting) {
        // Warlock should always have spellcasting, but just in case
        updated.spellcasting = {
          ability: 'charisma',
          spellSaveDC: 0,
          spellAttackBonus: 0,
          spells: newSpells,
        };
      }
    }

    // 2) skillProficiencies — add skill proficiencies
    const skillProfs = feat.skillProficiencies;
    if (Array.isArray(skillProfs)) {
      updated.skills = { ...updated.skills };
      for (const entry of skillProfs) {
        if (typeof entry === 'object') {
          for (const [skill, val] of Object.entries(entry)) {
            if (val === true && updated.skills[skill]) {
              updated.skills[skill] = { ...updated.skills[skill], proficient: true };
            }
          }
        }
      }
    }

    return updated;
  };

  /** Remove spell and skill effects of a replaced optional feature */
  const removeOptionalFeatureEffects = (char: Character, featName: string, featData: any): Character => {
    let updated = { ...char };

    // Remove innate spells sourced from this feature
    const spellNames = extractInnateSpellNames(featData);
    if (spellNames.length > 0 && updated.spellcasting) {
      const nameLower = new Set(spellNames.map(n => n.toLowerCase()));
      updated.spellcasting = {
        ...updated.spellcasting,
        spells: updated.spellcasting.spells.filter(s =>
          !(nameLower.has(s.name.toLowerCase()) && s.source === featName)
        ),
      };
    }

    // Note: we don't remove skill proficiencies since they may overlap with other sources
    return updated;
  };

  const handleOptionalFeatureConfirm = (result: OptionalFeaturePickerResult) => {
    if (!pendingOptionalFeature) return;
    const { config, remainingChecks } = pendingOptionalFeature;
    let updated = { ...pendingOptionalFeature.updatedChar };

    // Add newly chosen features
    const newOptFeatures = [...(updated.optionalFeatures ?? [])];
    for (const feat of result.chosen) {
      newOptFeatures.push({
        name: feat.name,
        source: feat.source,
        featureType: config.featureType,
        levelAcquired: updated.level,
      });
    }

    // Handle replacement
    if (result.replaced && result.replacement) {
      const idx = newOptFeatures.findIndex(
        f => f.featureType === config.featureType && f.name === result.replaced
      );
      if (idx !== -1) {
        newOptFeatures[idx] = {
          name: result.replacement.name,
          source: result.replacement.source,
          featureType: config.featureType,
          levelAcquired: updated.level,
        };
      }
    }

    updated.optionalFeatures = newOptFeatures;

    // Apply effects asynchronously (spells, skills)
    (async () => {
      // Remove effects of replaced feature
      if (result.replaced && result.replacement) {
        const { getOptionalFeatureByName } = await import('../data/optionalfeatures');
        const oldData = getOptionalFeatureByName(result.replaced);
        if (oldData) {
          updated = removeOptionalFeatureEffects(updated, result.replaced, oldData);
        }
        updated = await applyOptionalFeatureEffects(updated, result.replacement);
      }

      // Apply effects of newly chosen features
      for (const feat of result.chosen) {
        updated = await applyOptionalFeatureEffects(updated, feat);
      }

      setShowOptionalFeaturePicker(false);

      // If there are more picks queued, show the next one
      if (remainingChecks.length > 0) {
        const [next, ...rest] = remainingChecks;
        setPendingOptionalFeature(prev => prev ? {
          ...prev,
          updatedChar: updated,
          remainingChecks: rest,
        } : null);
        next();
      } else {
        setPendingOptionalFeature(null);
        checkAndShowExpertise(updated);
      }
    })();
  };

  /** Check if the character's current level grants Expertise and show picker if so. */
  const checkAndShowExpertise = (updated: Character): void => {
    (async () => {
      try {
        const mod = await import('../data/classes/classJsonLoader');
        await mod.init();
        const data = mod.getClassDataByName(updated.class);
        if (!data?.levelTable) {
          checkAndShowFsReplace(updated);
          return;
        }
        const levelRow = data.levelTable.find((r: any) => r.level === updated.level);
        const features: string[] = levelRow?.features ?? [];
        if (features.includes('Expertise')) {
          setPendingExpertise({ updatedChar: updated, count: 2 });
          setShowExpertisePicker(true);
        } else {
          checkAndShowFsReplace(updated);
        }
      } catch (e) {
        console.warn('Failed to check Expertise:', e);
        checkAndShowFsReplace(updated);
      }
    })();
  };

  const handleExpertiseConfirm = (skills: string[]) => {
    if (!pendingExpertise) return;
    const updated = { ...pendingExpertise.updatedChar };
    updated.skills = { ...updated.skills };
    for (const sk of skills) {
      updated.skills[sk] = { ...updated.skills[sk], expertise: true };
    }
    setShowExpertisePicker(false);
    setPendingExpertise(null);
    checkAndShowFsReplace(updated);
  };

  /** Check if the character can replace an existing fighting style on level-up. */
  const checkAndShowFsReplace = (updated: Character): boolean => {
    const FS_CLASSES = ['fighter', 'paladin', 'ranger'];
    const classId = updated.classId || '';
    const hasExistingFs = updated.feats?.some(f => f.category?.startsWith('FS'));
    if (FS_CLASSES.includes(classId) && hasExistingFs) {
      setPendingFsReplace({ updatedChar: updated });
      setShowFsReplaceModal(true);
      return true;
    }
    return checkAndShowFightingStylePicker(updated);
  };

  /** Check if the character's current level grants Fighting Style and show picker if so. */
  const checkAndShowFightingStylePicker = (updated: Character): boolean => {
    (async () => {
      try {
        const mod = await import('../data/classes/classJsonLoader');
        await mod.init();
        const data = mod.getClassDataByName(updated.class);
        if (!data?.levelTable) {
          checkAndShowFeatPicker(updated);
          return;
        }
        const levelRow = data.levelTable.find((r: any) => r.level === updated.level);
        const features: string[] = levelRow?.features ?? [];

        // Check class-level features
        let hasFS = features.includes('Fighting Style') || features.includes('Additional Fighting Style');

        // Check subclass features (e.g. Champion level 7)
        if (!hasFS && updated.subclass) {
          try {
            const subMod = await import('../data/classes/subclassJsonLoader');
            await subMod.init();
            const classDef2 = getClassById(updated.classId || '') ?? CLASS_REGISTRY.find(c => c.name === updated.class);
            const subDef = classDef2 && updated.subclass ? findSubclass(classDef2, updated.subclass) : undefined;
            if (subDef && classDef2) {
              const subData = subMod.getSubclassById(classDef2.id, subDef.id);
              if (subData?.features) {
                hasFS = subData.features.some(f => {
                  // Match the English identifier — feature names are translated for display.
                  const fname = (f as { _origName?: string })._origName ?? f.name;
                  return f.level === updated.level &&
                    (fname === 'Fighting Style' || fname === 'Additional Fighting Style');
                });
              }
            }
          } catch (e) { /* ignore */ }
        }

        if (hasFS) {
          setPendingFightingStyleLevelUp({ updatedChar: updated });
          setShowFightingStylePicker(true);
        } else {
          checkAndShowFeatPicker(updated);
        }
      } catch (e) {
        console.warn('Failed to check Fighting Style:', e);
        checkAndShowFeatPicker(updated);
      }
    })();
    return true;
  };

  const FS_CLASS_MAP: Record<string, string> = { cleric: t('creation.classMap.cleric'), druid: t('creation.classMap.druid') };

  /** Parse additionalSpells from a fighting style feat */
  const parseFsAdditionalSpells = (feat: any): { count: number; sourceClass: string } | null => {
    const as = feat?.additionalSpells?.[0];
    if (!as) return null;
    const count = as.known?._?.[0]?.count ?? 0;
    const choose: string = as.known?._?.[0]?.choose ?? '';
    const classMatch = choose.match(/class=(\w+)/);
    const sourceClass = classMatch ? (FS_CLASS_MAP[classMatch[1]] || classMatch[1]) : '';
    return count > 0 && sourceClass ? { count, sourceClass } : null;
  };

  const handleFightingStyleConfirm = (result: FeatPickerResult) => {
    if (!pendingFightingStyleLevelUp || !result.feat) return;
    let updated = { ...pendingFightingStyleLevelUp.updatedChar };

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
        category: result.feat.category || 'FS',
        levelAcquired: updated.level,
      },
    ];

    // Apply stat effects from fighting style (e.g. Defense: +1 AC)
    applyFeatStatEffects(updated, result.feat.name);

    setShowFightingStylePicker(false);
    setPendingFightingStyleLevelUp(null);

    // Check if this FS grants cantrips (Blessed/Druidic Warrior)
    const spellInfo = parseFsAdditionalSpells(result.feat);
    if (spellInfo) {
      setPendingFsCantrips({ updatedChar: updated, ...spellInfo });
      setShowFsCantripPicker(true);
      return;
    }

    // Continue the chain: check for ASI/EB
    checkAndShowFeatPicker(updated);
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
          category: result.feat.category || (pendingFeatLevelUp.mode === 'epicBoon' ? 'EB' : 'G'),
          levelAcquired: updated.level,
          abilityBonuses: result.abilityChoice,
        },
      ];

      // Apply proficiencies from feat JSON data + choices
      const profs = extractFeatProficiencies(result.feat);
      applyFeatProficiencies(updated, profs, {
        skills: result.skillChoices,
        savingThrows: result.savingThrowChoice ? [result.savingThrowChoice] : undefined,
        expertise: result.expertiseChoice ? [result.expertiseChoice] : undefined,
      });

      // Apply resistances
      const resists = extractFeatResistances(result.feat);
      if (resists.fixed.length > 0 || (result.resistanceChoices && result.resistanceChoices.length > 0)) {
        applyFeatResistances(updated, resists, result.resistanceChoices);
      }

      // Apply stat effects (HP, AC, initiative, speed)
      applyFeatStatEffects(updated, result.feat.name);

      // Check if feat grants spells — trigger spell picker
      if (result.spellConfig) {
        recalcDerivedStats(updated);
        updated.armorClass = resolveAC(updated);
        setShowFeatPicker(false);
        setPendingFeatLevelUp(null);
        setShowSubclassModal(false);
        setPendingFeatSpells({ updatedChar: updated, featName: result.feat.name, config: result.spellConfig });
        setShowFeatSpellPicker(true);
        return;
      }
    }

    // Recalc derived stats (spell DC, attack bonus, AC)
    recalcDerivedStats(updated);
    updated.armorClass = resolveAC(updated);

    onUpdate(updated);
    setShowFeatPicker(false);
    setPendingFeatLevelUp(null);
    setShowSubclassModal(false);
  };

  const handleFeatSpellPickerConfirm = (spells: CharacterSpell[], chosenAbility?: string) => {
    if (!pendingFeatSpells) return;
    let updated = { ...pendingFeatSpells.updatedChar };

    if (spells.length > 0) {
      if (!updated.spellcasting) {
        // Initialize minimal spellcasting for non-caster characters
        const ability = (chosenAbility || 'intelligence') as 'intelligence' | 'wisdom' | 'charisma';
        const abilityMod = getAbilityModifier(updated.abilityScores[ability]);
        updated.spellcasting = {
          ability,
          spellSaveDC: 8 + updated.proficiencyBonus + abilityMod,
          spellAttackBonus: updated.proficiencyBonus + abilityMod,
          spells: [],
        };
      }
      updated.spellcasting = {
        ...updated.spellcasting,
        spells: [...updated.spellcasting.spells, ...spells],
      };
    }

    recalcDerivedStats(updated);
    updated.armorClass = resolveAC(updated);
    onUpdate(updated);
    setShowFeatSpellPicker(false);
    setPendingFeatSpells(null);
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

    // After spells, check auto-spells → Invocations → FS replacement → Fighting Style → ASI/EB chain
    checkAndShowAutoSpells(final);
  };

  const handleSpellLevelUpCancel = () => {
    setShowSpellLevelUp(false);
    setPendingLevelUp(null);
  };

  // Check for auto-spells (subclass + racial) gained at this level
  const checkAndShowAutoSpells = (updated: Character): boolean => {
    if (!updated.spellcasting) {
      checkAndShowFeatSpellSwap(updated);
      return true;
    }

    (async () => {
      try {
        const spellsMod = await import('../data/spells');
        await spellsMod.init();

        const newAutoSpells = await getNewAutoSpellsAtLevel(
          {
            class: updated.class,
            classId: updated.classId,
            subclass: updated.subclass,
            level: updated.level,
            race: updated.race,
            raceSource: updated.raceSource,
            raceVariant: updated.raceVariant,
            spellcasting: updated.spellcasting,
          },
          updated.level,
          spellsMod.getSpellByName,
        );

        if (newAutoSpells.length > 0) {
          const withAutoSpells: Character = {
            ...updated,
            spellcasting: {
              ...updated.spellcasting!,
              spells: [
                ...updated.spellcasting!.spells,
                ...newAutoSpells.map(s => ({
                  spellId: s.spellId,
                  name: s.name,
                  level: s.level,
                  prepared: true,
                  alwaysPrepared: true,
                  source: s.source,
                })),
              ],
            },
          };

          setPendingAutoSpells({ updatedChar: withAutoSpells, newSpells: newAutoSpells });
          setShowAutoSpellsNotification(true);
          return;
        }
      } catch (e) {
        console.warn('Failed to check auto-spells:', e);
      }

      // No auto-spells or error → continue chain
      checkAndShowFeatSpellSwap(updated);
    })();

    return true;
  };

  const handleAutoSpellsConfirm = () => {
    if (!pendingAutoSpells) return;
    setShowAutoSpellsNotification(false);
    checkAndShowFeatSpellSwap(pendingAutoSpells.updatedChar);
    setPendingAutoSpells(null);
  };

  // Check if character has feat spells that can be swapped on level-up
  const checkAndShowFeatSpellSwap = (updated: Character) => {
    const featSpells = updated.spellcasting?.spells.filter(s =>
      s.source && s.source !== updated.subclass && s.source !== updated.race
    ) || [];
    if (featSpells.length > 0) {
      setPendingFeatSwapChar(updated);
      setShowFeatSpellSwap(true);
      return;
    }
    checkAndShowOptionalFeaturePickers(updated);
  };

  const handleFeatSpellSwapConfirm = (swaps: { oldSpellId: string; newSpell: CharacterSpell }[]) => {
    if (!pendingFeatSwapChar) return;
    let updated = { ...pendingFeatSwapChar };
    if (swaps.length > 0 && updated.spellcasting) {
      updated = {
        ...updated,
        spellcasting: {
          ...updated.spellcasting,
          spells: updated.spellcasting.spells.map(s => {
            const swap = swaps.find(sw => sw.oldSpellId === s.spellId);
            return swap ? swap.newSpell : s;
          }),
        },
      };
    }
    setShowFeatSpellSwap(false);
    setPendingFeatSwapChar(null);
    checkAndShowOptionalFeaturePickers(updated);
  };

  const handleFeatSpellSwapSkip = () => {
    if (!pendingFeatSwapChar) return;
    setShowFeatSpellSwap(false);
    checkAndShowOptionalFeaturePickers(pendingFeatSwapChar);
    setPendingFeatSwapChar(null);
  };

  const handleSubclassSelect = (subclassName: string) => {
    applyLevelUp(character.level + 1, subclassName);
  };

  const canLevelUp = character.level < 20;
  const needsSubclass = character.level === 2 && !character.subclass && classDef && classDef.subclasses.length > 0;

  // Browser Back closes whichever modal/overlay is open instead of navigating
  // away from the sheet. Closing = cancel/dismiss the topmost open modal.
  const anyModalOpen = showCropModal || showJsonEditor || showFeatSpellPicker || showFeatPicker
    || showOptionalFeaturePicker || showExpertisePicker || showFsCantripPicker || showFightingStylePicker
    || showFsReplaceModal || showFeatSpellSwap || showAutoSpellsNotification || showSpellLevelUp
    || showHpChoiceModal || showSubclassModal;
  const closeTopModal = () => {
    if (showCropModal) { setShowCropModal(false); setPendingPortraitUrl(null); return; }
    if (showJsonEditor) { setShowJsonEditor(false); return; }
    if (showFeatSpellPicker) { setShowFeatSpellPicker(false); setPendingFeatSpells(null); return; }
    if (showFeatPicker) { setShowFeatPicker(false); setPendingFeatLevelUp(null); return; }
    if (showOptionalFeaturePicker) { setShowOptionalFeaturePicker(false); setPendingOptionalFeature(null); return; }
    if (showExpertisePicker) { setShowExpertisePicker(false); setPendingExpertise(null); return; }
    if (showFsCantripPicker) { setShowFsCantripPicker(false); setPendingFsCantrips(null); return; }
    if (showFightingStylePicker) { setShowFightingStylePicker(false); setPendingFightingStyleLevelUp(null); return; }
    if (showFsReplaceModal) { setShowFsReplaceModal(false); setPendingFsReplace(null); return; }
    if (showFeatSpellSwap) { setShowFeatSpellSwap(false); setPendingFeatSwapChar(null); return; }
    if (showAutoSpellsNotification) { setShowAutoSpellsNotification(false); setPendingAutoSpells(null); return; }
    if (showSpellLevelUp) { setShowSpellLevelUp(false); setPendingLevelUp(null); return; }
    if (showHpChoiceModal) { setShowHpChoiceModal(false); setPendingHpChoice(null); return; }
    if (showSubclassModal) { setShowSubclassModal(false); return; }
  };
  useBackDismiss(anyModalOpen, closeTopModal);

  const sheetTabs: Tab[] = [
    { key: 'stats', label: t('sheet.tabs.stats'), icon: ScrollText },
    { key: 'inventory', label: t('sheet.tabs.inventory'), icon: Backpack },
    { key: 'actions', label: t('sheet.tabs.actions'), icon: Swords },
    { key: 'proficiencies', label: t('sheet.tabs.proficiencies'), icon: ScrollText },
    { key: 'roleplay', label: t('sheet.tabs.roleplay'), icon: User },
    { key: 'dice', label: t('sheet.tabs.dice'), icon: Dices },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Compact Header */}
      <div className="shrink-0 py-3 flex items-center justify-between border-b border-border-default">
        <div className="flex items-center gap-3">
          <input
            ref={portraitInputRef}
            type="file"
            accept="image/*"
            onChange={handlePortraitUpload}
            className="hidden"
          />
          <img
            src={asset(`/images/classes/${character.classId}.webp`)}
            alt={character.classId ? getClassName(character.classId) : character.class}
            className="w-10 h-10 object-contain shrink-0 opacity-80"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <div>
            <h1 className="text-2xl font-medieval text-gold">{character.name}</h1>
            <p className="text-sm text-text-secondary">
              {resolveDisplayRace(character.race, character.raceSource)} {character.classId ? getClassName(character.classId) : character.class}{character.subclass ? ` — ${character.classId ? getSubclassDisplayName(character.classId, character.subclass) : character.subclass}` : ''} {t('sheet.header.levelDisplay', { level: character.level })}
            </p>
          </div>
        </div>
        {canLevelUp && (
          <button
            onClick={handleLevelUp}
            className="flex items-center gap-2 px-4 py-2 bg-gold/20 text-gold border border-gold/30 rounded-lg hover:bg-gold/30 font-semibold transition-colors text-sm"
          >
            <ArrowUp size={16} />
            {needsSubclass ? t('sheet.header.levelUpSubclass') : t('sheet.header.levelUp', { level: character.level + 1 })}
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
      <div className="flex flex-1 min-h-0 gap-4 py-4">
        {/* Left content — changes per tab */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
          {/* Tab: Inventory */}
          {activeTab === 'inventory' && (
            <InventoryGrid character={character} onUpdate={onUpdate} />
          )}

          {/* Tab: Actions & Spells */}
          {activeTab === 'actions' && (
            <Suspense fallback={<div className="text-center text-text-muted py-8">{t('sheet.loading')}</div>}>
              <LazyActionsSpellsTab character={character} onUpdate={onUpdate} />
            </Suspense>
          )}

          {/* Tab: Skills & Proficiencies */}
          {activeTab === 'proficiencies' && (
            <>
              <SkillsSection character={character} />
              <ProficienciesSection character={character} />
            </>
          )}

          {/* Tab: Roleplay */}
          {activeTab === 'roleplay' && (
            <Suspense fallback={<div className="text-center text-text-muted py-8">{t('sheet.loading')}</div>}>
              <LazyRoleplayTab character={character} onUpdate={onUpdate} />
            </Suspense>
          )}

          {/* Tab: Dice */}
          {activeTab === 'dice' && (
            <Suspense fallback={<div className="text-center text-text-muted py-8">{t('sheet.loading')}</div>}>
              <LazyDiceTab />
            </Suspense>
          )}

          {/* Tab: Stats */}
          {activeTab === 'stats' && (
            <>
              {/* Full edit panel — только в режиме полного редактирования */}
              {fullEditMode && (
                <FullEditPanel
                  character={character}
                  onCommit={commitFullEdit}
                  onOpenJson={() => setShowJsonEditor(true)}
                />
              )}

              {/* HP Management (narrower) + Ability Scores to the right.
                  Combat stats now live in the portrait hover overlay. */}
              <div className="flex flex-col lg:flex-row gap-4 items-stretch">
                {/* HP Management + Hit Dice + Death Saves */}
                <div className="glass-panel p-4 flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-3">
                  <Heart className="text-red-bright" size={20} />
                  <h2 className="text-lg font-medieval text-gold">{t('sheet.health.title')}</h2>
                </div>
                <div className="flex gap-4">
                  {/* Left: HP controls + Hit Dice */}
                  <div className="flex-1 min-w-0">
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
                        <span className="text-text-muted">{t('sheet.health.temporaryHp')}</span>
                        <input
                          type="number"
                          value={character.hitPoints.temporary}
                          onChange={(e) => updateTempHP(parseInt(e.target.value) || 0)}
                          className="w-16 text-center bg-bg-primary border border-border-default text-text-primary rounded px-1 py-0.5"
                        />
                      </div>
                    </div>
                    {/* Hit Dice */}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-border-default">
                      <span className="text-sm font-medium text-text-secondary">{t('sheet.health.hitDice')}</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const remaining = character.hitDice.total - character.hitDice.used;
                            if (remaining > 0) onUpdate({ ...character, hitDice: { ...character.hitDice, used: character.hitDice.used + 1 } });
                          }}
                          className="px-2 py-0.5 bg-red-accent/80 text-white rounded hover:bg-red-accent transition-colors text-sm"
                        >−</button>
                        <input
                          type="number"
                          value={character.hitDice.total - character.hitDice.used}
                          onChange={(e) => {
                            const remaining = Math.max(0, Math.min(character.hitDice.total, parseInt(e.target.value) || 0));
                            onUpdate({ ...character, hitDice: { ...character.hitDice, used: character.hitDice.total - remaining } });
                          }}
                          className="w-10 text-center text-lg font-bold bg-bg-primary border border-border-default text-text-primary rounded px-1 py-0.5"
                        />
                        <span className="text-text-muted">/ {character.hitDice.total}</span>
                        <button
                          onClick={() => {
                            if (character.hitDice.used > 0) onUpdate({ ...character, hitDice: { ...character.hitDice, used: character.hitDice.used - 1 } });
                          }}
                          className="px-2 py-0.5 bg-green-accent/80 text-white rounded hover:bg-green-accent transition-colors text-sm"
                        >+</button>
                        <span className="text-sm text-text-secondary">{character.hitDice.type}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Death Saves */}
                  <div className="border-l border-border-default pl-4">
                    <DeathSavesSection character={character} onUpdate={onUpdate} />
                  </div>
                </div>
                </div>

                {/* Ability Scores — to the right of the Health panel */}
                <div className="glass-panel p-4 flex items-center justify-center shrink-0">
                  <div className="grid grid-cols-3 gap-3 justify-items-center">
                    {ABILITY_ORDER.map((key) => (
                      <StatBadge
                        key={key}
                        label={getAbilityShort(key)}
                        value={displayCharacter.abilityScores[key]}
                        modifier={getAbilityModifier(displayCharacter.abilityScores[key])}
                        variant="circle"
                        size="md"
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Conditions & Resistances */}
              <ConditionsSection character={character} onUpdate={onUpdate} />
              <ResistancesSection character={character} onUpdate={onUpdate} />

              {/* Features — BG3 style categorized list */}
              <FeaturesSection character={character} />

            </>
          )}
        </div>

        {/* Right Sidebar — always visible (BG3 pattern) */}
        <CharacterStatsSidebar
          character={displayCharacter}
          showCombatStats
          classIconSrc={asset(`/images/classes/${character.classId}.webp`)}
          hideSections={['identity', 'proficiencies', 'skills', 'spells', 'abilities', 'combat']}
          showPortraitStats
          portraitUrl={character.portraitDataUrl}
          portraitPosition={character.portraitPosition}
          onPortraitClick={() => {
            if (character.portraitDataUrl) {
              setPendingPortraitUrl(character.portraitDataUrl);
              setShowCropModal(true);
            } else {
              portraitInputRef.current?.click();
            }
          }}
        />
      </div>

      {/* Character JSON editor (full edit mode) */}
      {showJsonEditor && (
        <CharacterJsonEditorModal
          character={character}
          onSave={(next) => { commitFullEdit(next); setShowJsonEditor(false); }}
          onClose={() => setShowJsonEditor(false)}
        />
      )}

      {/* HP Choice Modal */}
      {showHpChoiceModal && pendingHpChoice && (
        <HpChoiceModal
          hitDieType={character.hitDice.type}
          conMod={getAbilityModifier(effectiveScores.constitution)}
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

      {/* Auto-spells notification */}
      {showAutoSpellsNotification && pendingAutoSpells && (
        <AutoSpellsNotificationModal
          spells={pendingAutoSpells.newSpells}
          newLevel={pendingAutoSpells.updatedChar.level}
          onConfirm={handleAutoSpellsConfirm}
        />
      )}

      {/* Feat Spell Swap on Level-Up */}
      {showFeatSpellSwap && pendingFeatSwapChar && (
        <FeatSpellSwapModal
          character={pendingFeatSwapChar}
          onConfirm={handleFeatSpellSwapConfirm}
          onSkip={handleFeatSpellSwapSkip}
        />
      )}

      {/* Expertise Picker Modal */}
      {showExpertisePicker && pendingExpertise && (
        <ExpertisePickerModal
          character={pendingExpertise.updatedChar}
          count={pendingExpertise.count}
          onConfirm={handleExpertiseConfirm}
          onCancel={() => {
            setShowExpertisePicker(false);
            setPendingExpertise(null);
          }}
        />
      )}
      {showFightingStylePicker && pendingFightingStyleLevelUp && (
        <FeatPickerModal
          character={pendingFightingStyleLevelUp.updatedChar}
          mode="fightingStyle"
          onConfirm={handleFightingStyleConfirm}
          onCancel={() => {
            // On cancel, discard the level-up entirely
            setShowFightingStylePicker(false);
            setPendingFightingStyleLevelUp(null);
          }}
        />
      )}

      {showOptionalFeaturePicker && pendingOptionalFeature && (
        <OptionalFeaturePickerModal
          character={pendingOptionalFeature.updatedChar}
          config={pendingOptionalFeature.config}
          newSlots={pendingOptionalFeature.newSlots}
          allowReplace={pendingOptionalFeature.allowReplace}
          onConfirm={handleOptionalFeatureConfirm}
          onCancel={() => {
            // Full cancel — do not apply level-up at all
            setShowOptionalFeaturePicker(false);
            setPendingOptionalFeature(null);
          }}
        />
      )}

      {showFeatPicker && pendingFeatLevelUp && (
        <FeatPickerModal
          character={pendingFeatLevelUp.updatedChar}
          mode={pendingFeatLevelUp.mode}
          onConfirm={handleFeatPickerConfirm}
          onCancel={() => {
            // On cancel, discard the level-up entirely
            setShowFeatPicker(false);
            setPendingFeatLevelUp(null);
          }}
        />
      )}

      {/* Feat Spell Picker Modal (Magic Initiate, Fey-Touched, etc.) */}
      {showFeatSpellPicker && pendingFeatSpells && (
        <FeatSpellPickerModal
          character={pendingFeatSpells.updatedChar}
          featName={pendingFeatSpells.featName}
          config={pendingFeatSpells.config}
          onConfirm={handleFeatSpellPickerConfirm}
          onCancel={() => {
            // On cancel, still save the character with feat effects applied (just no spells)
            onUpdate(pendingFeatSpells.updatedChar);
            setShowFeatSpellPicker(false);
            setPendingFeatSpells(null);
          }}
        />
      )}

      {/* Fighting Style Replacement Modal */}
      {showFsReplaceModal && pendingFsReplace && (
        <FsReplaceModal
          character={pendingFsReplace.updatedChar}
          onReplace={(oldFeatName) => {
            let updated = { ...pendingFsReplace.updatedChar };
            // Remove old FS from features and feats
            updated.features = updated.features.filter(f => f.name !== oldFeatName);
            updated.feats = (updated.feats ?? []).filter(f => !(f.name === oldFeatName && f.category?.startsWith('FS')));
            // If old was Blessed/Druidic Warrior, we'd need to remove cantrips too — but for simplicity, keep them
            // (user can manage spells separately)
            setShowFsReplaceModal(false);
            setPendingFsReplace(null);
            // Show FS picker for replacement (reuse existing fighting style picker)
            setPendingFightingStyleLevelUp({ updatedChar: updated });
            setShowFightingStylePicker(true);
          }}
          onSkip={() => {
            const updated = pendingFsReplace.updatedChar;
            setShowFsReplaceModal(false);
            setPendingFsReplace(null);
            checkAndShowFightingStylePicker(updated);
          }}
        />
      )}

      {/* FS Cantrip Picker Modal */}
      {showFsCantripPicker && pendingFsCantrips && (
        <FsCantripPickerModal
          sourceClass={pendingFsCantrips.sourceClass}
          count={pendingFsCantrips.count}
          character={pendingFsCantrips.updatedChar}
          onConfirm={(cantrips) => {
            let updated = { ...pendingFsCantrips.updatedChar };
            const newSpells = cantrips.map((s: any) => ({
              spellId: s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
              name: s.name,
              level: 0,
              prepared: true,
              alwaysPrepared: true,
            }));
            if (updated.spellcasting) {
              updated.spellcasting = {
                ...updated.spellcasting,
                spells: [...updated.spellcasting.spells, ...newSpells],
                cantripsKnown: (updated.spellcasting.cantripsKnown ?? 0) + cantrips.length,
              };
            }
            setShowFsCantripPicker(false);
            setPendingFsCantrips(null);
            checkAndShowFeatPicker(updated);
          }}
          onCancel={() => {
            // Cancel — don't save anything, revert the level-up
            setShowFsCantripPicker(false);
            setPendingFsCantrips(null);
          }}
        />
      )}

      {/* Portrait Crop Modal */}
      {showCropModal && pendingPortraitUrl && (
        <PortraitCropModal
          imageDataUrl={pendingPortraitUrl}
          initialPosition={character.portraitPosition}
          onSave={(pos) => {
            onUpdate({
              ...character,
              portraitDataUrl: pendingPortraitUrl,
              portraitPosition: pos,
              updatedAt: new Date().toISOString(),
            });
            setShowCropModal(false);
            setPendingPortraitUrl(null);
          }}
          onCancel={() => {
            setShowCropModal(false);
            setPendingPortraitUrl(null);
          }}
          onChangeImage={() => {
            setShowCropModal(false);
            setPendingPortraitUrl(null);
            portraitInputRef.current?.click();
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
  rawEntries?: any[];
  level?: number;
  source?: string;
}

interface FeatureCategory {
  label: string;
  icon: React.ReactNode;
  features: FeatureItem[];
  subcategories?: { label: string; icon: React.ReactNode; features: FeatureItem[] }[];
}

// ─── Skills Section ───
const ABILITY_ORDER: (keyof AbilityScores)[] = [
  'strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma',
];

function SkillsSection({ character }: { character: Character }) {
  const { t } = useTranslation('character');
  const [collapsed, setCollapsed] = useState(false);
  const diceCtx = useDiceRoll();

  const profBonus = character.proficiencyBonus;
  const itemBonuses = getEquippedItemBonuses(character);
  const effectiveScores = getEffectiveAbilityScores(character);

  return (
    <div className="glass-panel p-4">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 w-full text-left mb-3"
      >
        <Target className="text-gold" size={20} />
        <h2 className="text-lg font-medieval text-gold flex-1">{t('sheet.skills.title')}</h2>
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
                    {getAbilityName(ability)} ({getAbilityShort(ability)})
                  </span>
                  <div className="flex-1 h-px bg-border-default/50" />
                </div>
                <div className="space-y-1">
                  {skillsForAbility.map(skillKey => {
                    const skillData = character.skills?.[skillKey];
                    const isProficient = skillData?.proficient ?? false;
                    const hasExpertise = skillData?.expertise ?? false;
                    const abilityScore = effectiveScores[ability];
                    const mod = getSkillBonus(abilityScore, isProficient, hasExpertise, profBonus);

                    return (
                      <div
                        key={skillKey}
                        role="button"
                        tabIndex={0}
                        title={t('sheet.skills.rollTooltip', { skill: getSkillName(skillKey), mod: `${mod >= 0 ? '+' : ''}${mod}` })}
                        onClick={(e) => diceCtx.roll(`1d20${mod >= 0 ? '+' : ''}${mod}`, e)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          diceCtx.openConfig(`1d20${mod >= 0 ? '+' : ''}${mod}`, (e.currentTarget as HTMLElement).getBoundingClientRect());
                        }}
                        className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                          isProficient
                            ? 'bg-gold/5 hover:bg-gold/10'
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

                        {/* Skill icon */}
                        <img
                          src={asset(`/images/skills/${skillKey}.webp`)}
                          alt=""
                          className={`w-7 h-7 object-contain shrink-0 ${isProficient ? 'opacity-90' : 'opacity-30 grayscale'}`}
                        />

                        {/* Skill name */}
                        <span className={`flex-1 text-sm ${
                          isProficient ? 'text-text-primary font-medium' : 'text-text-secondary'
                        }`}>
                          {getSkillName(skillKey)}
                        </span>

                        {/* Dice icon */}
                        <Dices size={12} className="text-text-muted/40 shrink-0" />

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
                {t('sheet.skills.savingThrows')}
              </span>
              <div className="flex-1 h-px bg-border-default/50" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {ABILITY_ORDER.map(ability => {
                const isProficient = character.savingThrows[ability]?.proficient ?? false;
                const mod = getAbilityModifier(effectiveScores[ability]) + (isProficient ? profBonus : 0) + itemBonuses.bonusSavingThrow;
                return (
                  <div
                    key={ability}
                    role="button"
                    tabIndex={0}
                    title={t('sheet.skills.savingThrowTooltip', { ability: getAbilityShort(ability), mod: `${mod >= 0 ? '+' : ''}${mod}` })}
                    onClick={(e) => diceCtx.roll(`1d20${mod >= 0 ? '+' : ''}${mod}`, e)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      diceCtx.openConfig(`1d20${mod >= 0 ? '+' : ''}${mod}`, (e.currentTarget as HTMLElement).getBoundingClientRect());
                    }}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm cursor-pointer transition-colors ${
                      isProficient ? 'bg-gold/5 hover:bg-gold/10' : 'hover:bg-bg-panel/50'
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
                      {getAbilityShort(ability)}
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
  const { t } = useTranslation('character');
  const [loaded, setLoaded] = useState(false);
  const [classFeatures, setClassFeatures] = useState<FeatureItem[]>([]);
  const [subclassFeatures, setSubclassFeatures] = useState<FeatureItem[]>([]);
  const [subclassImageUrl, setSubclassImageUrl] = useState<string | null>(null);
  const [raceTraits, setRaceTraits] = useState<FeatureItem[]>([]);
  const [featItems, setFeatItems] = useState<FeatureItem[]>([]);
  const [charOptionTraits, setCharOptionTraits] = useState<FeatureItem[]>([]);
  const [optionalFeatureGroups, setOptionalFeatureGroups] = useState<{ featureType: string; label: string; items: FeatureItem[] }[]>([]);
  const [expandedFeature, setExpandedFeature] = useState<string | null>(null);
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());
  const [EntryRendererCmp, setEntryRendererCmp] = useState<React.FC<any> | null>(null);

  // Lazy load EntryRenderer
  useEffect(() => {
    import('../utils/entryRenderer').then(mod => {
      setEntryRendererCmp(() => mod.EntryRenderer);
    });
  }, []);

  // Background features (exclude feat-related ones — those go to Feats section)
  const bgFeatures: FeatureItem[] = character.features
    .filter(f => f.id !== 'bg-feat' && f.id !== 'origin-feat' && !f.id?.startsWith('feat-'))
    .map(f => ({
      name: f.name,
      description: f.description,
      source: f.source,
    }));

  // Background feat name (for feats subcategory)
  const bgFeatEntry = character.features.find(f => f.id === 'bg-feat' || f.id === 'origin-feat');

  // Load race + class + subclass features + feats lazily; reset on character switch
  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setClassFeatures([]);
    setSubclassFeatures([]);
    setSubclassImageUrl(null);
    setRaceTraits([]);
    setFeatItems([]);
    setCharOptionTraits([]);
    setOptionalFeatureGroups([]);

    (async () => {
      try {
        // Load species + class data in parallel
        const [speciesMod, classMod] = await Promise.all([
          import('../data/species').then(async m => { await m.init(); return m; }),
          import('../data/classes/classJsonLoader').then(async m => { await m.init(); return m; }),
        ]);
        if (cancelled) return;

        // Species traits (with raw entries for EntryRenderer) — prefer variant data
        const speciesData = character.raceVariant
          ? speciesMod.getSpeciesByName(character.raceVariant, character.raceSource) ?? speciesMod.getSpeciesByName(character.race, character.raceSource)
          : speciesMod.getSpeciesByName(character.race, character.raceSource);
        if (speciesData?.entries) {
          const traits = speciesData.entries
            .filter((e: any) => e && typeof e === 'object' && e.name && Array.isArray(e.entries))
            .map((e: any) => ({
              name: e.name,
              description: '',
              rawEntries: e.entries,
            }));
          setRaceTraits(traits);
        }

        // Build rawEntries from description + details (if present)
        const buildRawEntries = (f: any): any[] => {
          const entries: any[] = [];
          if (f.description) entries.push(f.description);
          if (f.details && typeof f.details === 'object') {
            for (const val of Object.values(f.details)) {
              if (typeof val === 'string') {
                // Extract bold name like {@b Careful Spell.} or just "Name. ..."
                const match = val.match(/\{@b\s+([^.}]+)\.\s*\}/);
                if (match) {
                  entries.push({ _detailName: match[1], _detailText: val });
                } else {
                  entries.push(val);
                }
              }
            }
          }
          return entries;
        };

        // Class features — wrap description + details in rawEntries so EntryRenderer processes tags
        const classData = classMod.getClassDataByName(character.class);
        if (classData?.classFeatures) {
          const cf = classData.classFeatures
            .filter((f: any) => f.level <= character.level)
            .map((f: any) => ({
              name: f.name,
              description: f.description || '',
              rawEntries: buildRawEntries(f),
              level: f.level,
              source: f.source,
            }));
          setClassFeatures(cf);
        }
        if (cancelled) return;

        // Subclass features — same: wrap description in rawEntries
        if (character.subclass) {
          const subMod = await import('../data/classes/subclassJsonLoader');
          await subMod.init();
          if (cancelled) return;

          const classDef = getClassById(character.classId || '') ?? CLASS_REGISTRY.find(c => c.name === character.class);
          const subDef = classDef && character.subclass ? findSubclass(classDef, character.subclass) : undefined;
          if (subDef) {
            const subData = subMod.getSubclassById(classDef!.id, subDef.id);
            if (subData?.features) {
              const sf = subData.features
                .filter(f => f.level <= character.level)
                .map(f => ({
                  name: f.name,
                  description: (f as any).description || '',
                  rawEntries: buildRawEntries(f),
                  level: f.level,
                  source: (f as any).source,
                }));
              setSubclassFeatures(sf);
            }
            setSubclassImageUrl(subMod.getSubclassImageUrl(classDef!.id, subDef.id));
          }
        }

        // Load feat details (from character.feats)
        const featsMod = await import('../data/feats');
        await featsMod.init();
        if (cancelled) return;

        if (character.feats?.length) {
          const items: FeatureItem[] = character.feats.map(cf => {
            const featData = featsMod.getFeatByName(cf.name);
            return {
              name: cf.name,
              description: '',
              rawEntries: featData?.entries ?? [],
              level: cf.levelAcquired,
              source: cf.source,
            };
          });
          if (!cancelled) setFeatItems(items);
        } else if (bgFeatEntry) {
          // Character has bg feat in features but no feats array — load it
          const featData = featsMod.getFeatByName(bgFeatEntry.name);
          if (featData && !cancelled) {
            setFeatItems([{
              name: bgFeatEntry.name,
              description: '',
              rawEntries: featData.entries ?? [],
              level: 1,
              source: bgFeatEntry.source,
            }]);
          }
        }

        // Load character creation option traits
        if (character.charCreationOption) {
          try {
            const ccoMod = await import('../data/charactercreationoptions');
            await ccoMod.init();
            if (cancelled) return;
            const optData = ccoMod.getCharacterCreationOptionByName(character.charCreationOption.name);
            if (optData?.entries) {
              const traits = optData.entries
                .filter((e: any) => e && typeof e === 'object' && e.name && Array.isArray(e.entries))
                .map((e: any) => ({
                  name: e.name,
                  description: '',
                  rawEntries: e.entries,
                }));
              // Also include entries nested inside section > entries
              for (const e of optData.entries) {
                if (e?.type === 'section' && Array.isArray(e.entries)) {
                  for (const sub of e.entries) {
                    if (sub && typeof sub === 'object' && sub.name && Array.isArray(sub.entries) && sub.type === 'entries') {
                      traits.push({ name: sub.name, description: '', rawEntries: sub.entries });
                    }
                  }
                }
              }
              if (!cancelled) setCharOptionTraits(traits);
            }
          } catch (e) { console.warn('Failed to load char creation option:', e); }
        }

        // Load optional feature details (invocations, metamagic, maneuvers, etc.)
        const allOptFeatures = character.optionalFeatures ?? [];
        if (allOptFeatures.length > 0) {
          try {
            const ofMod = await import('../data/optionalfeatures');
            await ofMod.init();
            // Group by featureType
            const byType = new Map<string, typeof allOptFeatures>();
            for (const f of allOptFeatures) {
              const arr = byType.get(f.featureType) ?? [];
              arr.push(f);
              byType.set(f.featureType, arr);
            }
            const groups = Array.from(byType.entries()).map(([ft, features]) => ({
              featureType: ft,
              label: ofMod.FEATURE_TYPE_NAMES[ft] ?? ft,
              items: features.map(f => {
                const data = ofMod.getOptionalFeatureByName(f.name);
                return {
                  name: f.name,
                  description: '',
                  rawEntries: data?.entries,
                  level: f.levelAcquired,
                  source: f.source,
                } as FeatureItem;
              }),
            }));
            if (!cancelled) setOptionalFeatureGroups(groups);
          } catch (e) { console.warn('Failed to load optional features:', e); }
        }

        if (!cancelled) setLoaded(true);
      } catch (e) {
        console.warn('Failed to load features:', e);
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [character.class, character.subclass, character.level, character.classId, character.race, character.raceSource, character.name, character.charCreationOption, character.optionalFeatures]);

  const toggleCat = (key: string) => {
    setCollapsedCats(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // --- Особенности categories ---
  const featureCategories: FeatureCategory[] = [
    ...(raceTraits.length > 0 ? [{
      label: t('sheet.features.raceLabel', { race: resolveDisplayRace(character.race, character.raceSource) }),
      icon: <Sparkles size={14} className="text-purple-400" />,
      features: raceTraits,
    }] : []),
    ...(classFeatures.length > 0 ? [{
      label: character.classId ? getClassName(character.classId) : character.class,
      icon: <Shield size={14} className="text-gold" />,
      features: classFeatures,
    }] : []),
    ...(subclassFeatures.length > 0 && character.subclass ? [{
      label: character.classId ? getSubclassDisplayName(character.classId, character.subclass) : character.subclass,
      icon: subclassImageUrl
        ? <img src={subclassImageUrl} alt="" className="w-5 h-5 rounded object-cover shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        : <BookOpen size={14} className="text-blue-400" />,
      features: subclassFeatures,
    }] : []),
    ...optionalFeatureGroups.map(g => ({
      label: g.label,
      icon: <Sparkles size={14} className="text-violet-400" />,
      features: g.items,
    })),
    ...(charOptionTraits.length > 0 ? [{
      label: character.charCreationOption?.name ?? t('sheet.features.creationOption'),
      icon: <Scroll size={14} className="text-emerald-400" />,
      features: charOptionTraits,
    }] : []),
  ];

  const featureTotalCount = featureCategories.reduce((s, c) => s + c.features.length, 0);

  // --- Черты categories (with background as subcategory) ---
  // Origin feat from background goes into a subcategory named after the background
  const originFeatItems = featItems.filter((_, i) => {
    const cf = character.feats?.[i];
    return cf?.category === 'O' && cf?.levelAcquired === 1;
  });
  const otherFeatItems = featItems.filter((_, i) => {
    const cf = character.feats?.[i];
    return !(cf?.category === 'O' && cf?.levelAcquired === 1);
  });

  const featCategories: FeatureCategory[] = [];

  // If there are non-origin feats, show them at top level
  if (otherFeatItems.length > 0) {
    featCategories.push({
      label: t('sheet.features.general'),
      icon: <Star size={14} className="text-amber-400" />,
      features: otherFeatItems,
    });
  }

  // Background subcategory with origin feat + other bg features
  const bgSubFeatures = [...originFeatItems, ...bgFeatures];
  if (bgSubFeatures.length > 0) {
    featCategories.push({
      label: character.background || t('sheet.features.backgroundFallback'),
      icon: <ScrollText size={14} className="text-text-secondary" />,
      features: bgSubFeatures,
    });
  }

  const featTotalCount = featCategories.reduce((s, c) => s + c.features.length, 0);

  const renderFeatureContent = (feat: FeatureItem) => {
    if (feat.rawEntries && feat.rawEntries.length > 0 && EntryRendererCmp) {
      // Separate plain entries from detail entries (with images)
      const plainEntries = feat.rawEntries.filter(e => !e?._detailName);
      const detailEntries = feat.rawEntries.filter(e => e?._detailName);

      return (
        <div className="mt-2 pt-2 border-t border-border-default text-xs text-text-secondary leading-relaxed ml-3.5 prose prose-invert prose-sm max-w-none">
          {plainEntries.length > 0 && (
            <EntryRendererCmp entries={plainEntries} context={feat.name} />
          )}
          {detailEntries.length > 0 && (
            <div className="space-y-2 mt-2 not-prose">
              {detailEntries.map((d: any, i: number) => (
                <div key={i} className="flex gap-2 items-start">
                  <img
                    src={getFeatureImageUrl(d._detailName)}
                    alt=""
                    className="w-6 h-6 rounded object-cover shrink-0 bg-bg-panel mt-0.5"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <div className="prose prose-invert prose-sm max-w-none text-xs">
                    <EntryRendererCmp entries={[d._detailText]} context={d._detailName} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
    if (feat.description) {
      return (
        <div className="mt-2 pt-2 border-t border-border-default text-xs text-text-secondary leading-relaxed whitespace-pre-line ml-3.5">
          {cleanEntryRefs(feat.description)}
        </div>
      );
    }
    return null;
  };

  const renderCategoryList = (cats: FeatureCategory[]) => (
    <div className="space-y-3">
      {cats.map(cat => {
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
                        <img
                          src={getFeatureImageUrl(feat.name)}
                          alt=""
                          className="w-6 h-6 rounded object-cover shrink-0 bg-bg-panel"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                        <span className="text-sm text-text-primary font-medium">{feat.name}</span>
                        {feat.level && (
                          <span className="text-[10px] text-text-muted ml-auto shrink-0">{t('sheet.features.levelShort', { level: feat.level })}</span>
                        )}
                      </div>
                      {isExpanded && renderFeatureContent(feat)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      {/* Особенности */}
      <div className="glass-panel p-4">
        <h2 className="text-lg font-medieval mb-3 text-gold flex items-center gap-2">
          <BookOpen size={18} />
          {t('sheet.features.title')}
          <span className="text-xs font-normal text-text-muted ml-1">({featureTotalCount})</span>
        </h2>

        {!loaded && featureCategories.length === 0 && (
          <div className="text-text-muted text-sm animate-pulse py-2">{t('sheet.features.loading')}</div>
        )}

        {renderCategoryList(featureCategories)}

        {loaded && featureTotalCount === 0 && (
          <div className="text-center text-text-muted text-sm py-2 italic">
            {t('sheet.features.noFeatures')}
          </div>
        )}
      </div>

      {/* Черты */}
      <div className="glass-panel p-4">
        <h2 className="text-lg font-medieval mb-3 text-gold flex items-center gap-2">
          <Star size={18} />
          {t('sheet.features.featsTitle')}
          <span className="text-xs font-normal text-text-muted ml-1">({featTotalCount})</span>
        </h2>

        {!loaded && featCategories.length === 0 && (
          <div className="text-text-muted text-sm animate-pulse py-2">{t('sheet.features.loading')}</div>
        )}

        {renderCategoryList(featCategories)}

        {loaded && featTotalCount === 0 && (
          <div className="text-center text-text-muted text-sm py-2 italic">
            {t('sheet.features.noFeats')}
          </div>
        )}
      </div>
    </>
  );
}

// ==============================
// Conditions & Resistances Section (Состояния и Устойчивости)
// ==============================

// Map from condition English name to i18n key (PascalCase without spaces/hyphens/apostrophes)
function conditionNameToI18nKey(name: string): string {
  return name.replace(/[\s\-']+/g, '').replace(/^(.)/, c => c.toUpperCase());
}

// This is not a hook — it's a pure lookup function.
// Components that call it must provide their own t() function.
function getConditionDisplayName(name: string, t: (key: string, opts?: any) => string): string {
  const i18nKey = conditionNameToI18nKey(name);
  const translated = t(`sheet.conditions.names.${i18nKey}`, { defaultValue: '' });
  return translated || name;
}

// Override map for feature names that differ from image filenames
// (British/American spelling, variant suffixes, etc.)
const FEATURE_IMAGE_OVERRIDES: Record<string, string> = {
  // British/American spelling
  'Accursed_Specter': 'Accursed_Spectre',
  'Armor_of_Hexes': 'Armour_of_Hexes',
  'Beguiling_Defenses': 'Beguiling_Defences',
  'Song_of_Defense': 'Song_of_Defence',
  'Unarmored_Defense': 'Unarmoured_Defense_Barbarian',
  'Unarmored_Movement': 'Unarmoured_Movement',
  'Patient_Defense': 'Patient_Defence',
  // Parent features with variant images
  'Bolstering_Magic': 'Bolstering_Magic_Boon',
  'Elemental_Affinity': 'Elemental_Affinity_Damage',
  'Elemental_Cleaver': 'Elemental_Cleaver_fire',
  'Heart_of_the_Storm': 'Heart_of_the_Storm_Lightning',
  'Improved_Critical': 'Improved_Critical_Hit',
  'Martial_Arts': 'Martial_Arts_Dextrous_Attacks',
  'Remarkable_Athlete': 'Remarkable_Athlete_Proficiency',
  'Sneak_Attack': 'Sneak_Attack_Melee',
  'Stunning_Strike': 'Stunning_Strike_Melee',
  'Arcane_Shot': 'Arcane_Shot_Banishing_Arrow',
  'Metamagic': 'Metamagic_Subtle_Spell',
  'Step_of_the_Wind': 'Step_of_the_Wind_Dash',
  // Metamagic sub-options
  'Careful_Spell': 'Metamagic_Careful_Spell',
  'Distant_Spell': 'Metamagic_Distant_Spell',
  'Extended_Spell': 'Metamagic_Extended_Spell',
  'Heightened_Spell': 'Metamagic_Heightened_Spell',
  'Quickened_Spell': 'Metamagic_Quickened_Spell',
  'Subtle_Spell': 'Metamagic_Subtle_Spell',
  'Twinned_Spell': 'Metamagic_Twinned_Spell',
  // Arcane Shot sub-options
  'Banishing_Arrow': 'Arcane_Shot_Banishing_Arrow',
  'Beguiling_Arrow': 'Arcane_Shot_Beguiling_Arrow',
  'Bursting_Arrow': 'Arcane_Shot_Bursting_Arrow',
  'Enfeebling_Arrow': 'Arcane_Shot_Enfeebling_Arrow',
  'Grasping_Arrow': 'Arcane_Shot_Grasping_Arrow',
  'Piercing_Arrow': 'Arcane_Shot_Piercing_Arrow',
  'Seeking_Arrow': 'Arcane_Shot_Seeking_Arrow',
  'Shadow_Arrow': 'Arcane_Shot_Shadow_Arrow',
  // Battle Master maneuvers (Melee variant)
  'Commander_s_Strike': "Commander's_Strike",
  'Disarming_Attack': 'Disarming_Attack_Melee',
  'Distracting_Strike': 'Distracting_Strike_Melee',
  'Goading_Attack': 'Goading_Attack_Melee',
  'Menacing_Attack': 'Menacing_Attack_Melee',
  'Pushing_Attack': 'Pushing_Attack_Melee',
  'Trip_Attack': 'Trip_Attack_Melee',
  // Monk sub-options
  'Bonus_Unarmed_Strike': 'Martial_Arts_Bonus_Unarmed_Strike',
  'Dexterous_Attacks': 'Martial_Arts_Dextrous_Attacks',
  'Deft_Strike': 'Martial_Arts_Deft_Strikes',
  // Blade Flourish sub-options
  'Defensive_Flourish': 'Defensive_Flourish_Melee',
  'Mobile_Flourish': 'Mobile_Flourish_Melee',
  'Slashing_Flourish': 'Slashing_Flourish_Melee',
};

function getFeatureImageUrl(name: string): string {
  const sanitized = name.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = FEATURE_IMAGE_OVERRIDES[sanitized] || sanitized;
  return asset(`/images/misc/${filename}.webp`);
}

function getConditionImageUrl(name: string): string {
  const filename = name.replace(/[^a-zA-Z0-9]/g, '_');
  return asset(`/images/conditionsdiseases/${filename}.webp`);
}

// ── Condition Picker Modal ──
function ConditionPickerModal({
  onAdd,
  onCancel,
  activeConditions,
}: {
  onAdd: (name: string) => void;
  onCancel: () => void;
  activeConditions: string[];
}) {
  const { t } = useTranslation('character');
  const [allConditions, setAllConditions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'condition' | 'disease'>('all');

  // Condition names that are "standard conditions" (no type field = condition)
  // Diseases have a type field like "Magical Contagion", "Supernatural Contagion", etc.
  const [conditionTypes, setConditionTypes] = useState<Record<string, string>>({});

  useEffect(() => {
    import('../data/conditionsdiseases').then(async (mod) => {
      await mod.init();
      const names = mod.ALL_CONDITIONS.map(c => c.name);
      const types: Record<string, string> = {};
      for (const c of mod.ALL_CONDITIONS) {
        // If the item has a root-level "type" field it's a disease, otherwise it's a condition
        types[c.name] = c.type ? 'disease' : 'condition';
      }
      setAllConditions(names);
      setConditionTypes(types);
      setLoading(false);
    });
  }, []);

  const searchLower = search.toLowerCase();
  const filtered = allConditions.filter(name => {
    if (activeConditions.includes(name)) return false;
    if (filter !== 'all' && conditionTypes[name] !== filter) return false;
    if (search) {
      const displayName = getConditionDisplayName(name, t).toLowerCase();
      const englishName = name.toLowerCase();
      return displayName.includes(searchLower) || englishName.includes(searchLower);
    }
    return true;
  });

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div
        className="bg-bg-panel border border-gold/30 rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-default shrink-0">
          <h3 className="text-base font-medieval text-gold">{t('sheet.conditions.addCondition')}</h3>
          <button onClick={onCancel} className="p-1 rounded hover:bg-bg-primary/80 text-text-muted hover:text-text-primary transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Search + Filter */}
        <div className="px-4 pt-3 pb-2 space-y-2 shrink-0">
          <input
            type="text"
            placeholder={t('sheet.conditions.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-3 py-1.5 text-sm bg-bg-primary border border-border-default rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-gold/50"
            autoFocus
          />
          <div className="flex gap-1.5">
            {([['all', t('sheet.conditions.filterAll')], ['condition', t('sheet.conditions.filterConditions')], ['disease', t('sheet.conditions.filterDiseases')]] as [('all' | 'condition' | 'disease'), string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                  filter === key
                    ? 'border-gold bg-gold/15 text-gold'
                    : 'border-border-default/50 text-text-muted hover:text-text-primary'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Condition list */}
        <div className="flex-1 overflow-y-auto px-4 pb-3 min-h-0">
          {loading ? (
            <p className="text-sm text-text-muted text-center py-4">{t('sheet.loading')}</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-4 italic">{t('sheet.conditions.nothingFound')}</p>
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              {filtered.map(name => (
                <button
                  key={name}
                  onClick={() => onAdd(name)}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-border-default/50 bg-bg-primary/40 text-left text-sm text-text-secondary hover:text-text-primary hover:border-red-700/50 hover:bg-red-900/20 transition-colors"
                >
                  <img
                    src={getConditionImageUrl(name)}
                    alt=""
                    className="w-6 h-6 object-contain opacity-70 shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).src = asset('/images/conditionsdiseases/PLACEHOLDER.webp'); }}
                  />
                  <div className="min-w-0">
                    <div className="truncate">{getConditionDisplayName(name, t)}</div>
                    {getConditionDisplayName(name, t) !== name && (
                      <div className="text-[9px] text-text-muted truncate">{name}</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


const DAMAGE_TYPE_IMAGES: Record<string, string> = {
  fire: '40px-Fire_Damage_Icon.png.webp',
  cold: '39px-Cold_Damage_Icon.png.webp',
  lightning: '40px-Lightning_Damage_Icon.png.webp',
  poison: '40px-Poison_Damage_Icon.png.webp',
  acid: '40px-Acid_Damage_Icon.png.webp',
  necrotic: '40px-Necrotic_Damage_Icon.png.webp',
  radiant: '40px-Radiant_Damage_Icon.png.webp',
  psychic: '40px-Psychic_Damage_Icon.png.webp',
  force: '40px-Force_Damage_Icon.png.webp',
  thunder: '40px-Thunder_Damage_Icon.png.webp',
  bludgeoning: '40px-Bludgeoning_Damage_Icon.png.webp',
  piercing: '40px-Piercing_Damage_Icon.png.webp',
  slashing: '40px-Slashing_Damage_Icon.png.webp',
};

function getDamageTypeImageUrl(type: string): string {
  return asset(`/images/resistances/${DAMAGE_TYPE_IMAGES[type] || type + '.webp'}`);
}

const ALL_DAMAGE_TYPES = Object.keys(DAMAGE_TYPE_IMAGES);

function getModifierInfo(t: (key: string) => string): { key: DamageResistanceModifier; label: string; shortLabel: string; color: string }[] {
  return [
    { key: 'resistance',       label: t('sheet.resistances.modifiers.resistance'),       shortLabel: t('sheet.resistances.modifiers.resistanceShort'),    color: 'text-white' },
    { key: 'resistance_magic', label: t('sheet.resistances.modifiers.resistanceMagic'),  shortLabel: t('sheet.resistances.modifiers.resistanceMagicShort'),  color: 'text-blue-400' },
    { key: 'resistance_all',   label: t('sheet.resistances.modifiers.resistanceAll'), shortLabel: t('sheet.resistances.modifiers.resistanceAllShort'),  color: 'text-emerald-400' },
    { key: 'vulnerability',    label: t('sheet.resistances.modifiers.vulnerability'),         shortLabel: t('sheet.resistances.modifiers.vulnerabilityShort'),      color: 'text-red-400' },
    { key: 'immunity',         label: t('sheet.resistances.modifiers.immunity'),          shortLabel: t('sheet.resistances.modifiers.immunityShort'),     color: 'text-white' },
    { key: 'immunity_all',     label: t('sheet.resistances.modifiers.immunityAll'),   shortLabel: t('sheet.resistances.modifiers.immunityAllShort'), color: 'text-blue-400' },
  ];
}

// ── Visual indicator overlay for resistance badges ──
function ResistanceIndicator({ modifier }: { modifier: DamageResistanceModifier }) {
  switch (modifier) {
    case 'resistance':
      return <span className="absolute -top-1 left-1/2 -translate-x-1/2 text-[9px] leading-none text-white drop-shadow-md">▲</span>;
    case 'resistance_magic':
      return <span className="absolute -top-1 left-1/2 -translate-x-1/2 text-[9px] leading-none text-blue-400 drop-shadow-md">▲</span>;
    case 'resistance_all':
      return (
        <span className="absolute -top-1 left-1/2 -translate-x-1/2 flex gap-px leading-none drop-shadow-md">
          <span className="text-[8px] text-white">▲</span>
          <span className="text-[8px] text-blue-400">▲</span>
        </span>
      );
    case 'vulnerability':
      return <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[9px] leading-none text-red-400 drop-shadow-md">▼</span>;
    case 'immunity':
      return null; // handled via ring style on container
    case 'immunity_all':
      return null; // handled via ring style on container
    default:
      return null;
  }
}

function getResistanceRingClass(modifier: DamageResistanceModifier): string {
  if (modifier === 'immunity') return 'ring-2 ring-white/80';
  if (modifier === 'immunity_all') return 'ring-2 ring-blue-400/80';
  return '';
}

function getResistanceBadgeBg(modifier: DamageResistanceModifier): string {
  if (modifier === 'vulnerability') return 'bg-red-900/30 border-red-700/40';
  if (modifier === 'immunity' || modifier === 'immunity_all') return 'bg-amber-900/20 border-amber-700/30';
  return 'bg-emerald-900/30 border-emerald-700/40';
}

function getResistanceBadgeTextColor(modifier: DamageResistanceModifier): string {
  if (modifier === 'vulnerability') return 'text-red-300';
  if (modifier === 'immunity' || modifier === 'immunity_all') return 'text-amber-200';
  return 'text-emerald-300';
}

// ── Resistance Picker Modal ──
function ResistancePickerModal({
  onAdd,
  onCancel,
  existing,
}: {
  onAdd: (entry: DamageResistanceEntry) => void;
  onCancel: () => void;
  existing: DamageResistanceEntry[];
}) {
  const { t } = useTranslation('character');
  const MODIFIER_INFO = getModifierInfo(t);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedModifier, setSelectedModifier] = useState<DamageResistanceModifier | null>(null);

  const alreadyExists = selectedType && selectedModifier
    ? existing.some(e => e.type === selectedType && e.modifier === selectedModifier)
    : false;

  const canAdd = selectedType && selectedModifier && !alreadyExists;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div
        className="bg-bg-panel border border-gold/30 rounded-xl shadow-2xl w-full max-w-sm"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-default">
          <h3 className="text-base font-medieval text-gold">{t('sheet.resistances.addResistance')}</h3>
          <button onClick={onCancel} className="p-1 rounded hover:bg-bg-primary/80 text-text-muted hover:text-text-primary transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Damage type grid */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-text-muted font-bold mb-2">{t('sheet.resistances.damageType')}</p>
            <div className="grid grid-cols-5 gap-1.5">
              {ALL_DAMAGE_TYPES.map(type => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`flex flex-col items-center gap-1 p-1.5 rounded-lg border transition-colors ${
                    selectedType === type
                      ? 'border-gold bg-gold/15 text-gold'
                      : 'border-border-default/50 bg-bg-primary/40 text-text-secondary hover:border-border-default hover:text-text-primary'
                  }`}
                  title={getDamageTypeName(type)}
                >
                  <img
                    src={getDamageTypeImageUrl(type)}
                    alt=""
                    className="w-7 h-7 object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <span className="text-[9px] leading-tight text-center truncate w-full">
                    {getDamageTypeName(type)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Modifier selection */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-text-muted font-bold mb-2">{t('sheet.resistances.modifierType')}</p>
            <div className="grid grid-cols-2 gap-1.5">
              {MODIFIER_INFO.map(info => (
                <button
                  key={info.key}
                  onClick={() => setSelectedModifier(info.key)}
                  className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border transition-colors text-left ${
                    selectedModifier === info.key
                      ? 'border-gold bg-gold/15'
                      : 'border-border-default/50 bg-bg-primary/40 hover:border-border-default'
                  }`}
                >
                  {/* Visual preview */}
                  <div className={`relative w-6 h-6 rounded shrink-0 ${
                    info.key === 'immunity' ? 'ring-2 ring-white/80' :
                    info.key === 'immunity_all' ? 'ring-2 ring-blue-400/80' : ''
                  }`}>
                    {selectedType ? (
                      <img src={getDamageTypeImageUrl(selectedType)} alt="" className="w-6 h-6 object-contain" />
                    ) : (
                      <div className="w-6 h-6 rounded bg-border-default/30" />
                    )}
                    <ResistanceIndicator modifier={info.key} />
                  </div>
                  <span className={`text-xs ${selectedModifier === info.key ? 'text-gold' : 'text-text-secondary'}`}>
                    {info.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border-default">
          {alreadyExists && (
            <span className="text-xs text-red-400 mr-auto">{t('sheet.resistances.alreadyAdded')}</span>
          )}
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            {t('sheet.resistances.cancel')}
          </button>
          <button
            disabled={!canAdd}
            onClick={() => {
              if (selectedType && selectedModifier) {
                onAdd({ type: selectedType, modifier: selectedModifier });
              }
            }}
            className="px-4 py-1.5 text-sm font-semibold rounded-lg bg-gold/20 text-gold border border-gold/30 hover:bg-gold/30 transition-colors disabled:opacity-30 disabled:pointer-events-none"
          >
            {t('sheet.resistances.add')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Death Saving Throws Section ──
function DeathSavesSection({ character, onUpdate }: { character: Character; onUpdate: (c: Character) => void }) {
  const { t } = useTranslation('character');
  const { roll, openConfig } = useDiceRoll();
  const [lastRoll, setLastRoll] = useState<{ value: number; type: 'success' | 'failure' | 'crit_success' | 'crit_failure' } | null>(null);

  const deathSaves = character.deathSaves ?? { successes: 0, failures: 0 };
  const isResolved = deathSaves.successes >= 3 || deathSaves.failures >= 3;

  const updateDeathSaves = (successes: number, failures: number) => {
    onUpdate({
      ...character,
      deathSaves: {
        successes: Math.max(0, Math.min(3, successes)),
        failures: Math.max(0, Math.min(3, failures)),
      },
    });
  };

  // Apply d20 result to death saves (used by both left-click roll and config menu callback)
  const applyDeathSaveResult = (value: number) => {
    if (isResolved) return;
    if (value === 20) {
      setLastRoll({ value, type: 'crit_success' });
      onUpdate({
        ...character,
        deathSaves: { successes: 0, failures: 0 },
        hitPoints: { ...character.hitPoints, current: 1 },
      });
    } else if (value === 1) {
      const newFailures = Math.min(3, deathSaves.failures + 2);
      setLastRoll({ value, type: 'crit_failure' });
      updateDeathSaves(deathSaves.successes, newFailures);
    } else if (value >= 10) {
      setLastRoll({ value, type: 'success' });
      updateDeathSaves(Math.min(3, deathSaves.successes + 1), deathSaves.failures);
    } else {
      setLastRoll({ value, type: 'failure' });
      updateDeathSaves(deathSaves.successes, Math.min(3, deathSaves.failures + 1));
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isResolved) return;
    const result = roll('1d20', e);
    if (result) applyDeathSaveResult(result.total);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (isResolved) return;
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    openConfig('1d20', rect, (total) => applyDeathSaveResult(total));
  };

  const resetDeathSaves = () => {
    updateDeathSaves(0, 0);
    setLastRoll(null);
  };

  const renderPips = (count: number, max: number, color: 'success' | 'failure') => {
    const colorClass = color === 'success'
      ? 'bg-green-accent border-green-accent'
      : 'bg-red-accent border-red-accent';
    return (
      <div className="flex gap-1.5">
        {Array.from({ length: max }, (_, i) => (
          <button
            key={i}
            onClick={() => {
              if (color === 'success') {
                updateDeathSaves(i < count ? i : i + 1, deathSaves.failures);
              } else {
                updateDeathSaves(deathSaves.successes, i < count ? i : i + 1);
              }
            }}
            className={`w-5 h-5 rounded-full border-2 transition-all cursor-pointer ${
              i < count
                ? colorClass
                : 'border-border-default bg-transparent hover:border-text-muted'
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center gap-2.5">
      {/* Title + reset */}
      <div className="flex items-center gap-2">
        <Skull className="text-text-muted" size={16} />
        <span className="text-sm font-medieval text-gold whitespace-nowrap">{t('sheet.deathSaves.title')}</span>
        {(deathSaves.successes > 0 || deathSaves.failures > 0) && (
          <button
            onClick={resetDeathSaves}
            className="text-text-muted hover:text-text-secondary transition-colors ml-1"
            title={t('sheet.deathSaves.reset')}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Pips rows */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-green-accent w-10 text-right">{t('sheet.deathSaves.successes')}</span>
          {renderPips(deathSaves.successes, 3, 'success')}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-red-accent w-10 text-right">{t('sheet.deathSaves.failures')}</span>
          {renderPips(deathSaves.failures, 3, 'failure')}
        </div>
      </div>

      {/* Roll Button — left-click rolls, right-click opens config */}
      <button
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        disabled={isResolved}
        className={`px-4 py-1.5 rounded font-medium text-sm transition-all flex items-center gap-2 whitespace-nowrap ${
          deathSaves.successes >= 3
            ? 'bg-green-accent/20 text-green-accent cursor-default'
            : deathSaves.failures >= 3
            ? 'bg-red-accent/20 text-red-accent cursor-default'
            : 'bg-gold/20 text-gold hover:bg-gold/30 cursor-pointer tag-rollable'
        }`}
      >
        <Dices size={16} />
        {deathSaves.successes >= 3
          ? t('sheet.deathSaves.stable')
          : deathSaves.failures >= 3
          ? t('sheet.deathSaves.dead')
          : '1d20'}
      </button>

      {/* Last Roll Result */}
      {lastRoll && (
        <div className={`text-sm text-center ${
          lastRoll.type === 'crit_success' || lastRoll.type === 'success' ? 'text-green-accent' : 'text-red-accent'
        }`}>
          <span className="font-bold">{lastRoll.value}</span>
          {' '}
          <span>
            {lastRoll.type === 'crit_success' && t('sheet.deathSaves.critSuccess')}
            {lastRoll.type === 'success' && t('sheet.deathSaves.success')}
            {lastRoll.type === 'failure' && t('sheet.deathSaves.failure')}
            {lastRoll.type === 'crit_failure' && t('sheet.deathSaves.critFailure')}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Conditions Section ──
function ConditionsSection({
  character,
  onUpdate,
}: {
  character: Character;
  onUpdate: (c: Character) => void;
}) {
  const { t } = useTranslation('character');
  const [collapsed, setCollapsed] = useState(false);
  const [showConditionModal, setShowConditionModal] = useState(false);

  const activeConditions = character.conditions ?? [];

  const addCondition = (name: string) => {
    if (!activeConditions.includes(name)) {
      onUpdate({ ...character, conditions: [...activeConditions, name] });
    }
    setShowConditionModal(false);
  };

  const removeCondition = (key: string) => {
    onUpdate({ ...character, conditions: activeConditions.filter(c => c !== key) });
  };

  return (
    <div className="glass-panel p-3">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-2 flex-1 text-left"
        >
          <ShieldAlert className="text-gold" size={20} />
          <h2 className="text-lg font-medieval text-gold">{t('sheet.conditions.title')}</h2>
        </button>
        <button
          onClick={() => setShowConditionModal(true)}
          className="p-1.5 rounded-lg border border-gold/30 bg-gold/10 text-gold hover:bg-gold/25 transition-colors shrink-0"
          title={t('sheet.conditions.addCondition')}
        >
          <Plus size={18} />
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="shrink-0"
        >
          <ChevronDown
            size={16}
            className={`text-text-muted transition-transform ${collapsed ? '-rotate-90' : ''}`}
          />
        </button>
      </div>

      {!collapsed && (
        <div className="mt-2">
          {activeConditions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {activeConditions.map(key => (
                <span
                  key={key}
                  className="flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-lg bg-red-900/30 border border-red-700/40 text-sm text-red-300"
                >
                  <img
                    src={getConditionImageUrl(key)}
                    alt=""
                    className="w-5 h-5 object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).src = asset('/images/conditionsdiseases/PLACEHOLDER.webp'); }}
                  />
                  {getConditionDisplayName(key, t)}
                  <button
                    onClick={() => removeCondition(key)}
                    className="ml-0.5 p-0.5 rounded hover:bg-red-800/50 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-muted italic">{t('sheet.conditions.noActiveConditions')}</p>
          )}
        </div>
      )}

      {showConditionModal && (
        <ConditionPickerModal
          onAdd={addCondition}
          onCancel={() => setShowConditionModal(false)}
          activeConditions={activeConditions}
        />
      )}
    </div>
  );
}

// ── Resistances Section ──
function ResistancesSection({
  character,
  onUpdate,
}: {
  character: Character;
  onUpdate: (c: Character) => void;
}) {
  const { t } = useTranslation('character');
  const MODIFIER_INFO = getModifierInfo(t);
  const [collapsed, setCollapsed] = useState(false);
  const [showResistanceModal, setShowResistanceModal] = useState(false);

  const resistances = character.damageResistances ?? [];

  const addResistance = (entry: DamageResistanceEntry) => {
    onUpdate({ ...character, damageResistances: [...resistances, entry] });
    setShowResistanceModal(false);
  };

  const removeResistance = (idx: number) => {
    onUpdate({ ...character, damageResistances: resistances.filter((_, i) => i !== idx) });
  };

  return (
    <div className="glass-panel p-3">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-2 flex-1 text-left"
        >
          <Shield className="text-gold" size={20} />
          <h2 className="text-lg font-medieval text-gold">{t('sheet.resistances.title')}</h2>
        </button>
        <button
          onClick={() => setShowResistanceModal(true)}
          className="p-1.5 rounded-lg border border-gold/30 bg-gold/10 text-gold hover:bg-gold/25 transition-colors shrink-0"
          title={t('sheet.resistances.addResistance')}
        >
          <Plus size={18} />
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="shrink-0"
        >
          <ChevronDown
            size={16}
            className={`text-text-muted transition-transform ${collapsed ? '-rotate-90' : ''}`}
          />
        </button>
      </div>

      {!collapsed && (
        <div className="mt-2">
          {resistances.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {resistances.map((entry, idx) => {
                const modInfo = MODIFIER_INFO.find(m => m.key === entry.modifier);
                return (
                  <span
                    key={`${entry.type}-${entry.modifier}-${idx}`}
                    className={`flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-lg border text-sm ${getResistanceBadgeBg(entry.modifier)} ${getResistanceBadgeTextColor(entry.modifier)}`}
                  >
                    <div className={`relative w-5 h-5 shrink-0 rounded ${getResistanceRingClass(entry.modifier)}`}>
                      <img
                        src={getDamageTypeImageUrl(entry.type)}
                        alt=""
                        className="w-5 h-5 object-contain"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <ResistanceIndicator modifier={entry.modifier} />
                    </div>
                    <span>{getDamageTypeName(entry.type)}</span>
                    <span className="text-[9px] opacity-60">({modInfo?.shortLabel})</span>
                    <button
                      onClick={() => removeResistance(idx)}
                      className="ml-0.5 p-0.5 rounded hover:bg-red-800/50 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </span>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-text-muted italic">{t('sheet.resistances.noResistances')}</p>
          )}
        </div>
      )}

      {showResistanceModal && (
        <ResistancePickerModal
          onAdd={addResistance}
          onCancel={() => setShowResistanceModal(false)}
          existing={resistances}
        />
      )}
    </div>
  );
}

// ==============================
// Proficiencies Section (Владения tab)
// ==============================

function ProficienciesSection({ character }: { character: Character }) {
  const { t } = useTranslation('character');
  const { proficiencies } = character;

  const categories = [
    {
      key: 'languages',
      label: t('sheet.proficiencies.languages'),
      icon: <Languages size={16} className="text-blue-400" />,
      items: proficiencies.languages,
    },
    {
      key: 'weapons',
      label: t('sheet.proficiencies.weapons'),
      icon: <Swords size={16} className="text-red-400" />,
      items: proficiencies.weapons,
    },
    {
      key: 'armor',
      label: t('sheet.proficiencies.armor'),
      icon: <Shield size={16} className="text-amber-400" />,
      items: proficiencies.armor,
    },
    {
      key: 'tools',
      label: t('sheet.proficiencies.tools'),
      icon: <Dices size={16} className="text-emerald-400" />,
      items: proficiencies.tools,
    },
  ];

  return (
    <div className="space-y-4">
      {categories.map(cat => (
        cat.items && cat.items.length > 0 && (
          <div key={cat.key} className="glass-panel p-4">
            <h2 className="text-lg font-medieval mb-3 text-gold flex items-center gap-2">
              {cat.icon}
              {cat.label}
              <span className="text-xs font-normal text-text-muted ml-1">({cat.items.length})</span>
            </h2>
            <div className="flex flex-wrap gap-2">
              {cat.items.map((item, i) => (
                <span
                  key={`${item}-${i}`}
                  className="px-3 py-1.5 rounded-lg bg-bg-primary/60 border border-border-default text-sm text-text-primary"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        )
      ))}

      {categories.every(c => !c.items?.length) && (
        <div className="text-center text-text-muted text-sm py-8 italic">
          {t('sheet.proficiencies.noProficiencies')}
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
  const { t } = useTranslation('character');
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
          <h2 className="text-xl font-medieval text-gold">{t('sheet.hpRoll.title')}</h2>
          <p className="text-sm text-text-secondary mt-1">
            {t('sheet.hpRoll.hitDieLabel', { die: hitDieType })}
            {' '} • {t('sheet.hpRoll.conModLabel', { mod: formatModifier(conMod) })}
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
                  {t('sheet.hpRoll.standardFormula')}
                </div>
                <div className="text-xs text-text-muted mt-0.5">
                  {t('sheet.hpRoll.averageLabel', { average: averageRoll, die: hitDieType, mod: `${conMod >= 0 ? '+' : ''}${conMod}` })}
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
                  {t('sheet.hpRoll.rollDie')}
                </div>
                <div className="text-xs text-text-muted mt-0.5">
                  {t('sheet.hpRoll.rangeLabel', { die: hitDieType, mod: `${conMod >= 0 ? '+' : ''}${conMod}`, min: Math.max(1, 1 + conMod), max: hitDieValue + conMod })}
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
                  {isRolling ? t('sheet.hpRoll.rolling') : t('sheet.hpRoll.rollButton', { die: hitDieType })}
                </button>
              ) : (
                <>
                  <button
                    onClick={doRoll}
                    className="py-2 px-4 rounded-lg border border-border-default text-text-secondary hover:text-text-primary
                      hover:border-border-hover transition-colors text-sm"
                  >
                    {t('sheet.hpRoll.reroll')}
                  </button>
                  <button
                    onClick={() => onChoice(rolledTotal!)}
                    className="flex-1 py-2 rounded-lg bg-gold/20 text-gold border border-gold/30 font-semibold
                      hover:bg-gold/30 transition-all text-sm"
                  >
                    {t('sheet.hpRoll.accept', { total: rolledTotal })}
                  </button>
                </>
              )}
            </div>

            {rolledValue !== null && !isRolling && (
              <div className="text-xs text-text-muted text-center">
                {t('sheet.hpRoll.rollResult', { value: rolledValue, mod: `${conMod >= 0 ? '+' : ''}${conMod}`, total: rolledTotal })}
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
          {t('sheet.hpRoll.cancel')}
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
  const { t } = useTranslation('character');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [subclassDetails, setSubclassDetails] = useState<SubclassJsonData[]>([]);
  const [loading, setLoading] = useState(true);
  const [renderTags, setRenderTags] = useState<((text: string) => React.ReactNode[]) | null>(null);

  // Load detailed subclass data + entryRenderer
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [loader, entryMod] = await Promise.all([
        import('../data/classes/subclassJsonLoader'),
        import('../utils/entryRenderer'),
      ]);
      await loader.init();
      if (cancelled) return;
      const details = loader.getSubclassesByClass(classDef.id);
      setSubclassDetails(details);
      setRenderTags(() => (text: string) => entryMod.renderTaggedString(text));
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
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6">
    <div className="w-full max-w-5xl max-h-[85vh] bg-bg-panel-solid rounded-xl border border-gold/30 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-gold/30 bg-bg-panel-solid/95 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-medieval text-gold flex items-center gap-3">
              <Sparkles className="text-gold" size={24} />
              {t('sheet.subclass.title')}
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              {t('sheet.subclass.description', { class: character.classId ? getClassName(character.classId) : character.class })}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-border-default text-text-secondary hover:text-text-primary hover:border-border-hover transition-colors text-sm"
          >
            {t('sheet.subclass.cancel')}
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
              <div className="text-center min-w-[200px] flex flex-col items-center">
                {(() => { const scImg = current ? getSubclassImageUrl(classDef.id, current.id) : null; return scImg ? <img src={scImg} alt="" className="w-10 h-10 rounded-lg object-cover mb-1" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} /> : null; })()}
                <div className="text-xl font-medieval text-gold">{current ? getSubclassName(classDef.id, current.id) : ''}</div>
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
              {renderTags ? renderTags(detail?.description || current?.description || '') : (detail?.description || current?.description)}
            </p>
          </div>

          {/* Level 3 Features */}
          {loading ? (
            <div className="glass-panel p-6 flex items-center justify-center">
              <div className="text-text-muted animate-pulse">{t('sheet.subclass.loadingAbilities')}</div>
            </div>
          ) : level3Features.length > 0 ? (
            <div className="glass-panel p-4 space-y-4">
              <h3 className="text-base font-medieval text-gold flex items-center gap-2">
                <BookOpen size={16} />
                {t('sheet.subclass.level3Features')}
              </h3>
              {level3Features.map((feature, i) => (
                <div key={i} className="border border-border-default rounded-lg p-3 bg-bg-primary/40">
                  <h4 className="text-sm font-semibold text-text-primary mb-1.5 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-gold shrink-0" />
                    {feature.name}
                  </h4>
                  <div className="text-xs text-text-secondary leading-relaxed whitespace-pre-line">
                    {renderTags ? renderTags(feature.description) : cleanEntryRefs(feature.description)}
                  </div>
                  {feature.spellList && feature.spellList.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-border-default">
                      <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">{t('sheet.subclass.subclassSpells')}</div>
                      <div className="space-y-1">
                        {feature.spellList.map((row: any, ri: number) => {
                          const lvlKey = Object.keys(row).find(k => k !== 'spells') || '';
                          const lvlVal = row[lvlKey];
                          const spellNames = (row.spells as string[]).map(s =>
                            s.replace(/\{@spell\s+([^|}]+)(?:\|[^}]*)?\}/g, '$1')
                          );
                          return (
                            <div key={ri} className="flex items-start gap-2 text-xs">
                              <span className="text-text-muted shrink-0">{t('sheet.fsCantripPicker.levelShort', { level: lvlVal })}:</span>
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
              {t('sheet.subclass.noDetailData')}
            </div>
          )}

          {/* All subclasses quick-nav grid */}
          <div className="glass-panel p-4">
            <h4 className="text-xs text-text-muted uppercase tracking-wider mb-3">{t('sheet.subclass.allSubclasses')}</h4>
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
            {t('sheet.subclass.selected')} <span className="text-gold font-semibold">{current ? getSubclassName(classDef.id, current.id) : ''}</span>
          </div>
          <button
            onClick={() => onSelect(current?.name)}
            className="px-8 py-2.5 rounded-lg bg-gold/20 text-gold border border-gold/30 font-medieval font-semibold text-lg
              hover:bg-gold/30 transition-all gold-glow"
          >
            {t('sheet.subclass.selectButton', { name: current ? getSubclassName(classDef.id, current.id) : '' })}
          </button>
        </div>
      </div>
    </div>
    </div>
  );
}

// ── Fighting Style Replacement Modal ──

function FsReplaceModal({
  character,
  onReplace,
  onSkip,
}: {
  character: Character;
  onReplace: (oldFeatName: string) => void;
  onSkip: () => void;
}) {
  const { t } = useTranslation('character');
  const fsFeats = (character.feats ?? []).filter(f => f.category?.startsWith('FS'));

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-bg-panel-solid rounded-xl border border-gold/30 p-6">
        <h2 className="text-xl font-medieval text-gold mb-4">{t('sheet.fightingStyleReplace.title')}</h2>
        <p className="text-sm text-text-secondary mb-4">
          {t('sheet.fightingStyleReplace.description')}
        </p>

        <div className="space-y-2 mb-6">
          {fsFeats.map(f => (
            <div key={f.name} className="flex items-center justify-between p-3 rounded-lg border border-border-default bg-bg-primary/40">
              <span className="text-sm text-text-primary font-medium">{f.name}</span>
              <button
                onClick={() => onReplace(f.name)}
                className="px-3 py-1 text-xs rounded border border-gold/30 bg-gold/10 text-gold hover:bg-gold/20 transition-colors"
              >
                {t('sheet.fightingStyleReplace.replace')}
              </button>
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <button
            onClick={onSkip}
            className="px-6 py-2 rounded-lg border border-border-default text-text-secondary hover:text-text-primary hover:border-border-hover transition-colors text-sm"
          >
            {t('sheet.fightingStyleReplace.skip')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── FS Cantrip Picker Modal ──

function getFsCantripMeta(spell: any, t: (key: string, opts?: any) => string) {
  const castingTime = spell.time
    ?.map((ti: any) => `${ti.number} ${t(`creation.timeUnits.${ti.unit}`, { defaultValue: ti.unit })}`)
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
}

function getFsFirstEntryText(entries: any[]): string {
  for (const e of entries) {
    if (typeof e === 'string') return e;
    if (e?.entries) return getFsFirstEntryText(e.entries);
  }
  return '';
}

function FsCantripPickerModal({
  sourceClass,
  count,
  character,
  onConfirm,
  onCancel,
}: {
  sourceClass: string;
  count: number;
  character: Character;
  onConfirm: (cantrips: any[]) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation('character');
  // Character with effective ability scores for display purposes
  const effectiveScores = getEffectiveAbilityScores(character);
  const displayCharacter = effectiveScores === character.abilityScores
    ? character
    : { ...character, abilityScores: effectiveScores };
  const [available, setAvailable] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState<any[]>([]);
  const [expandedSpell, setExpandedSpell] = useState<string | null>(null);
  const [getImgUrl, setGetImgUrl] = useState<((name: string) => string) | null>(null);
  const [EntryRenderer, setEntryRenderer] = useState<React.FC<any> | null>(null);
  const [schoolNames, setSchoolNames] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [spellMod, entryMod] = await Promise.all([
          import('../data/spells').then(async m => { await m.init(); return m; }),
          import('../utils/entryRenderer'),
        ]);
        if (cancelled) return;
        setGetImgUrl(() => spellMod.getSpellImageUrl);
        setEntryRenderer(() => entryMod.EntryRenderer);
        setSchoolNames(spellMod.SCHOOL_NAMES || {});
        const all = spellMod.getSpellsByClass(sourceClass).filter((s: any) => s.level === 0);
        const knownNames = new Set(character.spellcasting?.spells?.filter(s => s.level === 0).map(s => s.name) ?? []);
        setAvailable(all.filter((s: any) => !knownNames.has(s.name)));
        setLoaded(true);
      } catch { if (!cancelled) setLoaded(true); }
    })();
    return () => { cancelled = true; };
  }, [sourceClass, character]);

  const filtered = searchQuery.trim()
    ? available.filter((s: any) => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : available;

  const toggle = (spell: any) => {
    setSelected(prev => {
      if (prev.some(s => s.name === spell.name)) return prev.filter(s => s.name !== spell.name);
      if (prev.length >= count) return prev;
      return [...prev, spell];
    });
  };

  const expandedData = expandedSpell ? available.find(s => s.name === expandedSpell) ?? null : null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6">
    <div className="w-full max-w-7xl max-h-[85vh] bg-bg-panel-solid rounded-xl border border-gold/30 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-gold/30 bg-bg-panel-solid/95 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-medieval text-gold flex items-center gap-3">
              <Sparkles className="text-purple-400" size={24} />
              {t('sheet.fsCantripPicker.title', { class: sourceClass })}
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              {t('sheet.fsCantripPicker.description', { count, cantripWord: count === 1 ? t('sheet.fsCantripPicker.cantripSingular') : t('sheet.fsCantripPicker.cantripPlural'), classGen: sourceClass === t('creation.classMap.cleric') ? t('sheet.fsCantripPicker.clericGen') : t('sheet.fsCantripPicker.druidGen') })}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-border-default text-text-secondary hover:text-text-primary hover:border-border-hover transition-colors text-sm"
          >
            {t('sheet.fsCantripPicker.cancel')}
          </button>
        </div>
      </div>

      {/* Main content: two-column layout */}
      <div className="flex flex-1 min-h-0 max-w-7xl mx-auto w-full">
        {/* LEFT: content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-5">
          {!loaded ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={32} className="animate-spin text-gold" />
              <span className="ml-3 text-text-secondary">{t('sheet.loading')}</span>
            </div>
          ) : (
            <>
              {/* "Вы получите" section */}
              <div className="glass-panel ornate-border p-4 space-y-3">
                <h3 className="text-base font-medieval text-gold">{t('sheet.fsCantripPicker.youWillGet')}</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-text-primary">
                    <span className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
                      <Sparkles size={12} className="text-purple-400" />
                    </span>
                    {t('sheet.fsCantripPicker.cantripBonus', { count, cantripWord: count === 1 ? t('sheet.fsCantripPicker.cantripSingular') : t('sheet.fsCantripPicker.cantripPlural'), classGen: sourceClass === t('creation.classMap.cleric') ? t('sheet.fsCantripPicker.clericGen') : t('sheet.fsCantripPicker.druidGen') })}
                  </div>
                </div>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
                <input
                  type="text"
                  placeholder={t('sheet.fsCantripPicker.searchPlaceholder')}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-bg-primary border border-border-default rounded-lg text-text-primary text-sm focus:outline-none focus:border-gold/50 transition-colors"
                />
              </div>

              {/* Cantrip icon grid */}
              <div className="glass-panel p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles size={16} className="text-purple-400" />
                  <span className="text-sm font-medieval text-purple-300">
                    {t('sheet.fsCantripPicker.cantripsCount', { current: selected.length, max: count })}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {filtered.map((spell: any) => {
                    const isSelected = selected.some(s => s.name === spell.name);
                    const disabled = !isSelected && selected.length >= count;
                    const meta = getFsCantripMeta(spell, t);
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
                        description={getFsFirstEntryText(spell.entries || [])}
                      >
                        <SpellIconBadge
                          name={spell.name}
                          school={spell.school}
                          level={0}
                          imageSrc={getImgUrl?.(spell.name)}
                          prepared={!disabled || isSelected}
                          selected={isSelected}
                          onClick={() => {
                            if (!disabled || isSelected) {
                              toggle(spell);
                              setExpandedSpell(spell.name);
                            }
                          }}
                          className={isSelected ? 'ring-2 ring-green-bright/60' : ''}
                        />
                      </SpellTooltip>
                    );
                  })}
                  {filtered.length === 0 && (
                    <p className="text-sm text-text-muted py-2">{t('sheet.fsCantripPicker.noCantrips')}</p>
                  )}
                </div>
              </div>

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
                    {t('sheet.fsCantripPicker.cantripLabel')}
                    {expandedData.school && ` • ${schoolNames[expandedData.school] || expandedData.school}`}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    {(() => { const m = getFsCantripMeta(expandedData, t); return (<>
                      {m.castingTime && <div><span className="text-text-muted">{t('sheet.fsCantripPicker.castingTime')}</span><span className="text-text-primary">{m.castingTime}</span></div>}
                      {m.range && <div><span className="text-text-muted">{t('sheet.fsCantripPicker.range')}</span><span className="text-text-primary">{m.range}</span></div>}
                      {m.components && <div><span className="text-text-muted">{t('sheet.fsCantripPicker.components')}</span><span className="text-text-primary">{m.components}</span></div>}
                      {m.duration && <div><span className="text-text-muted">{t('sheet.fsCantripPicker.duration')}</span><span className="text-text-primary">{m.duration}</span></div>}
                    </>); })()}
                  </div>
                  <div className="pt-2 border-t border-border-default prose prose-invert prose-sm max-w-none text-xs">
                    {EntryRenderer ? (
                      <EntryRenderer entries={expandedData.entries} context={expandedData.name} />
                    ) : (
                      expandedData.entries?.map((e: any, i: number) => (
                        <p key={i}>{typeof e === 'string' ? cleanEntryRefs(e) : ''}</p>
                      ))
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
            character={displayCharacter}
            showCombatStats
            classIconSrc={asset(`/images/classes/${character.classId}.webp`)}
            className="!w-full !flex !flex-col"
          />

          {/* Selected cantrips summary */}
          {selected.length > 0 && (
            <div className="glass-panel p-3 mt-3 space-y-2">
              <h4 className="text-[10px] uppercase tracking-wider text-text-muted">{t('sheet.fsCantripPicker.selected')}</h4>
              {selected.map((s: any) => (
                <div key={s.name} className="flex items-center gap-2 text-xs text-text-secondary">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
                  <span className="truncate">{s.name}</span>
                  <span className="text-purple-400 text-[10px] ml-auto">{t('sheet.fsCantripPicker.cantripShort')}</span>
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
            <span className={selected.length === count ? 'text-green-bright' : ''}>
              {t('sheet.fsCantripPicker.cantripsFooter', { current: selected.length, max: count })}
            </span>
          </div>
          <button
            onClick={() => onConfirm(selected)}
            disabled={selected.length !== count}
            className="px-8 py-2.5 rounded-lg bg-gold/20 text-gold border border-gold/30 font-medieval font-semibold text-lg
              hover:bg-gold/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all
              enabled:gold-glow"
          >
            {t('sheet.fsCantripPicker.confirm')}
          </button>
        </div>
      </div>
    </div>
    </div>
  );
}

// SpellsTab вынесен в SpellsTab.tsx и загружается лениво через LazySpellsTab
