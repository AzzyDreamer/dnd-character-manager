import React from 'react';
import type { Character } from '../types';
import { getAbilityModifier, formatModifier, ABILITY_NAMES, ABILITY_SHORT } from '../utils/dnd';
import { Heart, Shield, Zap, Coins, Backpack } from 'lucide-react';

interface CharacterSheetProps {
  character: Character;
  onUpdate: (character: Character) => void;
}

export const CharacterSheet: React.FC<CharacterSheetProps> = ({ character, onUpdate }) => {
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

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Заголовок персонажа */}
      <div className="bg-dnd-parchment p-6 rounded-lg shadow-lg border-4 border-dnd-secondary">
        <h1 className="text-4xl font-medieval text-dnd-primary mb-2">{character.name}</h1>
        <p className="text-lg">
          {character.race} {character.class}{character.subclass ? ` — ${character.subclass}` : ''} {character.level} уровня
        </p>
        {character.background && <p className="text-gray-600">Предыстория: {character.background}</p>}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Левая колонка - Характеристики */}
        <div className="space-y-4">
          {/* Характеристики */}
          <div className="bg-white p-4 rounded-lg shadow border-2 border-dnd-primary">
            <h2 className="text-xl font-semibold mb-4 text-dnd-primary">Характеристики</h2>
            <div className="space-y-3">
              {(Object.entries(character.abilityScores) as [keyof typeof character.abilityScores, number][]).map(([ability, score]) => {
                const modifier = getAbilityModifier(score);
                return (
                  <div key={ability} className="flex items-center justify-between p-2 bg-dnd-parchment rounded">
                    <div className="flex-1">
                      <div className="text-sm text-gray-600">{ABILITY_NAMES[ability]}</div>
                      <div className="text-xs text-gray-500">{ABILITY_SHORT[ability]}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">{score}</div>
                      <div className="text-sm text-dnd-primary font-semibold">
                        {formatModifier(modifier)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Бонус мастерства */}
          <div className="bg-white p-4 rounded-lg shadow border-2 border-dnd-primary">
            <div className="text-center">
              <div className="text-sm text-gray-600 mb-1">Бонус мастерства</div>
              <div className="text-3xl font-bold text-dnd-primary">
                {formatModifier(character.proficiencyBonus)}
              </div>
            </div>
          </div>
        </div>

        {/* Средняя колонка - Боевые характеристики и HP */}
        <div className="space-y-4">
          {/* HP */}
          <div className="bg-white p-4 rounded-lg shadow border-2 border-dnd-primary">
            <div className="flex items-center gap-2 mb-4">
              <Heart className="text-red-600" size={24} />
              <h2 className="text-xl font-semibold text-dnd-primary">Хиты</h2>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm mb-1">Текущие HP</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateHP(character.hitPoints.current - 1)}
                    className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={character.hitPoints.current}
                    onChange={(e) => updateHP(parseInt(e.target.value) || 0)}
                    className="flex-1 text-center text-2xl font-bold border-2 border-gray-300 rounded px-2 py-1"
                  />
                  <button
                    onClick={() => updateHP(character.hitPoints.current + 1)}
                    className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                  >
                    +
                  </button>
                </div>
                <div className="text-center text-sm text-gray-600 mt-1">
                  из {character.hitPoints.max}
                </div>
              </div>

              <div>
                <label className="block text-sm mb-1">Временные HP</label>
                <input
                  type="number"
                  value={character.hitPoints.temporary}
                  onChange={(e) => updateTempHP(parseInt(e.target.value) || 0)}
                  className="w-full text-center text-lg border-2 border-gray-300 rounded px-2 py-1"
                />
              </div>
            </div>
          </div>

          {/* Боевые характеристики */}
          <div className="bg-white p-4 rounded-lg shadow border-2 border-dnd-primary">
            <h2 className="text-xl font-semibold mb-4 text-dnd-primary">Боевые характеристики</h2>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 bg-dnd-parchment rounded">
                <Shield className="mx-auto mb-2 text-dnd-primary" size={24} />
                <div className="text-sm text-gray-600">Класс брони</div>
                <div className="text-2xl font-bold">{character.armorClass}</div>
              </div>

              <div className="text-center p-3 bg-dnd-parchment rounded">
                <Zap className="mx-auto mb-2 text-dnd-primary" size={24} />
                <div className="text-sm text-gray-600">Инициатива</div>
                <div className="text-2xl font-bold">
                  {formatModifier(getAbilityModifier(character.abilityScores.dexterity))}
                </div>
              </div>

              <div className="text-center p-3 bg-dnd-parchment rounded col-span-2">
                <div className="text-sm text-gray-600">Скорость</div>
                <div className="text-2xl font-bold">{character.speed} фт.</div>
              </div>
            </div>
          </div>

          {/* Хиты кости */}
          <div className="bg-white p-4 rounded-lg shadow border-2 border-dnd-primary">
            <h2 className="text-xl font-semibold mb-2 text-dnd-primary">Кости хитов</h2>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {character.hitDice.total - character.hitDice.used} / {character.hitDice.total}
              </div>
              <div className="text-sm text-gray-600">{character.hitDice.type}</div>
            </div>
          </div>
        </div>

        {/* Правая колонка - Навыки и прочее */}
        <div className="space-y-4">
          {/* Валюта */}
          <div className="bg-white p-4 rounded-lg shadow border-2 border-dnd-primary">
            <div className="flex items-center gap-2 mb-4">
              <Coins className="text-dnd-secondary" size={24} />
              <h2 className="text-xl font-semibold text-dnd-primary">Валюта</h2>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Платина (ПП):</span>
                <span className="font-semibold">{character.currency.platinum}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Золото (ЗМ):</span>
                <span className="font-semibold">{character.currency.gold}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Электрум (ЭМ):</span>
                <span className="font-semibold">{character.currency.electrum}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Серебро (СМ):</span>
                <span className="font-semibold">{character.currency.silver}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Медь (ММ):</span>
                <span className="font-semibold">{character.currency.copper}</span>
              </div>
            </div>
          </div>

          {/* Инвентарь */}
          <div className="bg-white p-4 rounded-lg shadow border-2 border-dnd-primary">
            <div className="flex items-center gap-2 mb-4">
              <Backpack className="text-dnd-primary" size={24} />
              <h2 className="text-xl font-semibold text-dnd-primary">Инвентарь</h2>
            </div>
            {character.inventory.length === 0 ? (
              <p className="text-gray-500 text-sm italic">Инвентарь пуст</p>
            ) : (
              <div className="space-y-2">
                {character.inventory.map((item) => (
                  <div key={item.id} className="p-2 bg-dnd-parchment rounded">
                    <div className="font-semibold">{item.name}</div>
                    <div className="text-sm text-gray-600">
                      Количество: {item.quantity}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Владения */}
          <div className="bg-white p-4 rounded-lg shadow border-2 border-dnd-primary">
            <h2 className="text-xl font-semibold mb-3 text-dnd-primary">Владения</h2>
            <div className="space-y-2 text-sm">
              {character.proficiencies.languages.length > 0 && (
                <div>
                  <div className="font-semibold text-gray-700">Языки:</div>
                  <div className="text-gray-600">{character.proficiencies.languages.join(', ')}</div>
                </div>
              )}
              {character.proficiencies.armor.length > 0 && (
                <div>
                  <div className="font-semibold text-gray-700">Доспехи:</div>
                  <div className="text-gray-600">{character.proficiencies.armor.join(', ')}</div>
                </div>
              )}
              {character.proficiencies.weapons.length > 0 && (
                <div>
                  <div className="font-semibold text-gray-700">Оружие:</div>
                  <div className="text-gray-600">{character.proficiencies.weapons.join(', ')}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Заклинания */}
      {character.spellcasting && (
        <div className="bg-white p-6 rounded-lg shadow border-2 border-dnd-primary">
          <h2 className="text-2xl font-semibold mb-4 text-dnd-primary">Заклинания</h2>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center p-3 bg-dnd-parchment rounded">
              <div className="text-sm text-gray-600">Сл спасброска</div>
              <div className="text-2xl font-bold">{character.spellcasting.spellSaveDC}</div>
            </div>
            <div className="text-center p-3 bg-dnd-parchment rounded">
              <div className="text-sm text-gray-600">Бонус атаки</div>
              <div className="text-2xl font-bold">
                {formatModifier(character.spellcasting.spellAttackBonus)}
              </div>
            </div>
            <div className="text-center p-3 bg-dnd-parchment rounded">
              <div className="text-sm text-gray-600">Характеристика</div>
              <div className="text-lg font-bold">
                {ABILITY_NAMES[character.spellcasting.ability]}
              </div>
            </div>
          </div>
          {character.spellcasting.spells.length === 0 ? (
            <p className="text-gray-500 italic">Заклинания не выбраны</p>
          ) : (
            <div className="space-y-2">
              {character.spellcasting.spells.map((spell) => (
                <div key={spell.spellId} className="p-3 bg-dnd-parchment rounded">
                  <div className="font-semibold">{spell.name}</div>
                  <div className="text-sm text-gray-600">Уровень: {spell.level}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
