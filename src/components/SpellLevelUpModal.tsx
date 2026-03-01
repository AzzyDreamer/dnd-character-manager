import React, { useState, useEffect, useMemo } from 'react';
import type { Character, CharacterSpell, SpellSlots } from '../types';
import { X, Search, Loader2, Check, Wand2, Sparkles } from 'lucide-react';

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

const TIME_UNITS: Record<string, string> = { action: 'действие', bonus: 'бонус', reaction: 'реакция', minute: 'мин.', hour: 'час' };

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

export const SpellLevelUpModal: React.FC<SpellLevelUpModalProps> = ({
  character,
  newLevel,
  oldLevelData,
  newLevelData,
  onConfirm,
  onCancel,
}) => {
  const [modules, setModules] = useState<LoadedModules | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNewCantrips, setSelectedNewCantrips] = useState<SpellDataLocal[]>([]);
  const [selectedNewSpells, setSelectedNewSpells] = useState<SpellDataLocal[]>([]);
  const [expandedSpell, setExpandedSpell] = useState<string | null>(null);

  // Вычисляем сколько нужно выбрать
  const newCantripsCount = (newLevelData.cantrips ?? 0) - (oldLevelData.cantrips ?? 0);
  const newSpellsCount = (newLevelData.preparedSpells ?? 0) - (oldLevelData.preparedSpells ?? 0);

  // Максимальный уровень заклинаний доступный на новом уровне
  const maxSpellLevel = useMemo(() => {
    const slots = newLevelData.spellSlots;
    if (!slots) return 1;
    let max = 1;
    for (let i = 0; i < slots.length; i++) {
      if (slots[i] > 0) max = i + 1;
    }
    return max;
  }, [newLevelData]);

  // Загрузка данных заклинаний
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const spellsMod = await import('../data/spells');
      await spellsMod.init();
      if (cancelled) return;
      const entryMod = await import('../utils/entryRenderer');
      if (cancelled) return;
      const classSpells = spellsMod.getSpellsByClass(character.class);
      setModules({
        spells: classSpells,
        SCHOOL_NAMES: spellsMod.SCHOOL_NAMES,
        EntryRenderer: entryMod.EntryRenderer,
      });
    })();
    return () => { cancelled = true; };
  }, [character.class]);

  // Уже известные заклинания
  const knownSpellNames = useMemo(() => {
    return new Set(character.spellcasting?.spells.map(s => s.name) || []);
  }, [character.spellcasting?.spells]);

  // Фильтрация доступных заклинаний
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

  const renderSpellCard = (spell: SpellDataLocal, isSelected: boolean, onToggle: () => void, disabled: boolean) => {
    const school = modules?.SCHOOL_NAMES[spell.school] || spell.school;
    const isExpanded = expandedSpell === spell.name;

    return (
      <div key={spell.name} className={`rounded-lg border transition-all ${
        isSelected ? 'border-dnd-secondary bg-dnd-secondary/10' : 'border-gray-700 bg-gray-800/50'
      }`}>
        <div className="flex items-center gap-2 p-3">
          <button
            onClick={onToggle}
            disabled={disabled && !isSelected}
            className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
              isSelected
                ? 'bg-dnd-secondary border-dnd-secondary text-dnd-dark'
                : disabled
                  ? 'border-gray-600 opacity-40 cursor-not-allowed'
                  : 'border-gray-500 hover:border-dnd-secondary'
            }`}
          >
            {isSelected && <Check size={12} />}
          </button>
          <button
            onClick={() => setExpandedSpell(isExpanded ? null : spell.name)}
            className="flex-1 text-left"
          >
            <div className="font-medium text-gray-200 text-sm">{spell.name}</div>
            <div className="text-xs text-gray-500">
              {spell.level === 0 ? 'Заговор' : `${spell.level} ур.`} • {school}
              {spell.time?.[0] && ` • ${spell.time[0].number} ${TIME_UNITS[spell.time[0].unit] || spell.time[0].unit}`}
            </div>
          </button>
        </div>
        {isExpanded && modules?.EntryRenderer && (
          <div className="px-3 pb-3 border-t border-gray-700">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-2 text-xs">
              {spell.range && (
                <div>
                  <span className="text-gray-500">Дистанция: </span>
                  <span className="text-gray-300">
                    {spell.range.distance?.amount
                      ? `${spell.range.distance.amount} фт.`
                      : spell.range.type === 'touch' ? 'Касание'
                        : spell.range.type === 'self' ? 'На себя' : spell.range.type || ''}
                  </span>
                </div>
              )}
              {spell.components && (
                <div>
                  <span className="text-gray-500">Компоненты: </span>
                  <span className="text-gray-300">
                    {[spell.components.v && 'В', spell.components.s && 'С', spell.components.m && 'М'].filter(Boolean).join(', ')}
                  </span>
                </div>
              )}
            </div>
            <modules.EntryRenderer entries={spell.entries} context={spell.name} />
          </div>
        )}
      </div>
    );
  };

  // Нет новых заклинаний/заговоров, но слоты обновились — авто-подтверждение
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

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl border-2 border-dnd-secondary max-w-3xl w-full max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-gray-900 border-b border-gray-700 p-4 flex items-center justify-between z-10 shrink-0 rounded-t-xl">
          <div>
            <h2 className="text-xl font-medieval text-dnd-secondary">
              Уровень {newLevel} — Новые заклинания
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              {newCantripsCount > 0 && `+${newCantripsCount} заговор(ов) `}
              {newSpellsCount > 0 && `+${newSpellsCount} заклинаний `}
              {` • Доступны заклинания до ${maxSpellLevel} уровня`}
            </p>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-6">
          {!modules ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={32} className="animate-spin text-dnd-secondary" />
              <span className="ml-3 text-gray-400">Загрузка заклинаний...</span>
            </div>
          ) : (
            <>
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Поиск заклинаний..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-dnd-secondary"
                />
              </div>

              {/* New cantrips section */}
              {newCantripsCount > 0 && (
                <div>
                  <h3 className="text-lg font-medieval text-purple-300 mb-3 flex items-center gap-2">
                    <Sparkles size={18} />
                    Новые заговоры ({selectedNewCantrips.length}/{newCantripsCount})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
                    {availableCantrips.map(spell => {
                      const isSelected = selectedNewCantrips.some(s => s.name === spell.name);
                      return renderSpellCard(
                        spell,
                        isSelected,
                        () => toggleCantrip(spell),
                        selectedNewCantrips.length >= newCantripsCount
                      );
                    })}
                    {availableCantrips.length === 0 && (
                      <p className="text-sm text-gray-500 col-span-2 text-center py-4">Нет доступных заговоров</p>
                    )}
                  </div>
                </div>
              )}

              {/* New spells section */}
              {newSpellsCount > 0 && (
                <div>
                  <h3 className="text-lg font-medieval text-blue-300 mb-3 flex items-center gap-2">
                    <Wand2 size={18} />
                    Новые заклинания ({selectedNewSpells.length}/{newSpellsCount})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[400px] overflow-y-auto">
                    {availableSpells.map(spell => {
                      const isSelected = selectedNewSpells.some(s => s.name === spell.name);
                      return renderSpellCard(
                        spell,
                        isSelected,
                        () => toggleSpell(spell),
                        selectedNewSpells.length >= newSpellsCount
                      );
                    })}
                    {availableSpells.length === 0 && (
                      <p className="text-sm text-gray-500 col-span-2 text-center py-4">Нет доступных заклинаний</p>
                    )}
                  </div>
                </div>
              )}

              {/* Spell slots update info */}
              {newLevelData.spellSlots && (
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <h4 className="text-sm text-gray-400 mb-2">Ячейки заклинаний (уровень {newLevel})</h4>
                  <div className="flex gap-3 flex-wrap text-sm">
                    {newLevelData.spellSlots.map((count: number, idx: number) =>
                      count > 0 ? (
                        <div key={idx} className="flex items-center gap-1">
                          <span className="text-gray-400">{idx + 1} ур.:</span>
                          <span className="text-white font-bold">{count}</span>
                        </div>
                      ) : null
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-700 p-4 flex items-center justify-between shrink-0">
          <button
            onClick={onCancel}
            className="px-6 py-2 rounded-lg border border-gray-600 text-gray-300 hover:text-white hover:border-gray-400 transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="px-6 py-2 rounded-lg bg-dnd-secondary text-dnd-dark font-semibold hover:bg-dnd-secondary/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Подтвердить
          </button>
        </div>
      </div>
    </div>
  );
};
