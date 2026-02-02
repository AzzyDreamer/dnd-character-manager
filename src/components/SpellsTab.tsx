import React, { useState } from 'react';
import type { Character } from '../types';
import { formatModifier, ABILITY_NAMES } from '../utils/dnd';
import { getSpellByName, SCHOOL_NAMES } from '../data/spells';
import { EntryRenderer } from '../utils/entryRenderer';

export const SpellsTab: React.FC<{ character: Character }> = ({ character }) => {
  const [expandedSpell, setExpandedSpell] = useState<string | null>(null);
  const spellcasting = character.spellcasting;
  if (!spellcasting) return null;

  const cantrips = spellcasting.spells.filter(s => s.level === 0);
  const leveledSpells = spellcasting.spells.filter(s => s.level > 0);
  const groupedByLevel = leveledSpells.reduce<Record<number, typeof leveledSpells>>((acc, s) => {
    (acc[s.level] = acc[s.level] || []).push(s);
    return acc;
  }, {});

  const toggleSpellExpand = (spellId: string) => {
    setExpandedSpell(prev => prev === spellId ? null : spellId);
  };

  const renderSpellCard = (spell: { spellId: string; name: string; level: number; prepared?: boolean }) => {
    const spellData = getSpellByName(spell.name);
    const isExpanded = expandedSpell === spell.spellId;
    const school = spellData ? SCHOOL_NAMES[spellData.school] || spellData.school : '';

    return (
      <div
        key={spell.spellId}
        className={`rounded-lg border transition-all ${
          isExpanded
            ? 'border-dnd-secondary bg-gray-800'
            : 'border-gray-700 bg-gray-800/50 hover:border-gray-500'
        }`}
      >
        <button
          onClick={() => toggleSpellExpand(spell.spellId)}
          className="w-full p-3 text-left flex items-center justify-between"
        >
          <div>
            <div className="font-semibold text-gray-200 text-sm">{spell.name}</div>
            <div className="text-xs text-gray-500">
              {spell.level === 0 ? 'Заговор' : `${spell.level} уровень`}
              {school && ` • ${school}`}
            </div>
          </div>
          {spell.prepared && (
            <span className="text-xs px-2 py-0.5 bg-green-900/40 text-green-400 rounded">
              Подготовлено
            </span>
          )}
        </button>
        {isExpanded && spellData && (
          <div className="px-3 pb-3 border-t border-gray-700">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-2 text-xs">
              {spellData.time && (
                <div>
                  <span className="text-gray-500">Время: </span>
                  <span className="text-gray-300">
                    {spellData.time.map((t: any) => {
                      const units: Record<string, string> = { action: 'действие', bonus: 'бонус', reaction: 'реакция', minute: 'мин.' };
                      return `${t.number} ${units[t.unit] || t.unit}`;
                    }).join(', ')}
                  </span>
                </div>
              )}
              {spellData.range && (
                <div>
                  <span className="text-gray-500">Дистанция: </span>
                  <span className="text-gray-300">
                    {spellData.range.distance?.amount
                      ? `${spellData.range.distance.amount} фт.`
                      : spellData.range.type === 'touch' ? 'Касание'
                        : spellData.range.type === 'self' ? 'На себя'
                          : spellData.range.type || ''}
                  </span>
                </div>
              )}
              {spellData.components && (
                <div>
                  <span className="text-gray-500">Компоненты: </span>
                  <span className="text-gray-300">
                    {[
                      spellData.components.v ? 'В' : '',
                      spellData.components.s ? 'С' : '',
                      spellData.components.m ? 'М' : '',
                    ].filter(Boolean).join(', ')}
                  </span>
                </div>
              )}
              {spellData.duration && (
                <div>
                  <span className="text-gray-500">Длительность: </span>
                  <span className="text-gray-300">
                    {spellData.duration.map((d: any) => {
                      if (d.type === 'instant') return 'Мгновенная';
                      if (d.concentration) return `Конц., ${d.duration?.amount || ''} ${d.duration?.type || ''}`;
                      return d.type;
                    }).join(', ')}
                  </span>
                </div>
              )}
            </div>
            <EntryRenderer
              entries={spellData.entries}
              context={spellData.name}
              className="mt-2"
            />
            {spellData.entriesHigherLevel && spellData.entriesHigherLevel.length > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-700">
                <EntryRenderer
                  entries={spellData.entriesHigherLevel}
                  context={spellData.name}
                />
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg shadow border-2 border-dnd-primary">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="p-3 bg-dnd-parchment rounded">
            <div className="text-sm text-gray-600">Сл спасброска</div>
            <div className="text-2xl font-bold">{spellcasting.spellSaveDC}</div>
          </div>
          <div className="p-3 bg-dnd-parchment rounded">
            <div className="text-sm text-gray-600">Бонус атаки</div>
            <div className="text-2xl font-bold">{formatModifier(spellcasting.spellAttackBonus)}</div>
          </div>
          <div className="p-3 bg-dnd-parchment rounded">
            <div className="text-sm text-gray-600">Характеристика</div>
            <div className="text-lg font-bold">{ABILITY_NAMES[spellcasting.ability]}</div>
          </div>
        </div>
      </div>

      {cantrips.length > 0 && (
        <div>
          <h3 className="text-lg font-medieval text-purple-300 mb-3">Заговоры ({cantrips.length})</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {cantrips.map(renderSpellCard)}
          </div>
        </div>
      )}

      {Object.entries(groupedByLevel)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([level, spells]) => (
          <div key={level}>
            <h3 className="text-lg font-medieval text-blue-300 mb-3">{level} уровень ({spells.length})</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {spells.map(renderSpellCard)}
            </div>
          </div>
        ))}

      {spellcasting.spells.length === 0 && (
        <div className="text-center text-gray-500 py-8 italic">
          Заклинания не выбраны
        </div>
      )}
    </div>
  );
};
