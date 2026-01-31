import React, { useState } from 'react';
import { Character, AbilityScores } from '../types';
import { generateAbilityScores, STANDARD_ARRAY, calculateMaxHP, getProficiencyBonus } from '../utils/dnd';
import { Dices, Wand2 } from 'lucide-react';

interface CharacterCreatorProps {
  onSave: (character: Character) => void;
  onCancel: () => void;
}

const CLASSES = [
  { name: 'Варвар', hitDie: 'd12', spellcaster: false },
  { name: 'Бард', hitDie: 'd8', spellcaster: true, ability: 'charisma' as const },
  { name: 'Жрец', hitDie: 'd8', spellcaster: true, ability: 'wisdom' as const },
  { name: 'Друид', hitDie: 'd8', spellcaster: true, ability: 'wisdom' as const },
  { name: 'Воин', hitDie: 'd10', spellcaster: false },
  { name: 'Монах', hitDie: 'd8', spellcaster: false },
  { name: 'Паладин', hitDie: 'd10', spellcaster: true, ability: 'charisma' as const },
  { name: 'Следопыт', hitDie: 'd10', spellcaster: true, ability: 'wisdom' as const },
  { name: 'Плут', hitDie: 'd8', spellcaster: false },
  { name: 'Чародей', hitDie: 'd6', spellcaster: true, ability: 'charisma' as const },
  { name: 'Колдун', hitDie: 'd8', spellcaster: true, ability: 'charisma' as const },
  { name: 'Волшебник', hitDie: 'd6', spellcaster: true, ability: 'intelligence' as const },
];

const RACES = [
  'Человек', 'Эльф', 'Дворф', 'Полурослик', 'Драконорожденный',
  'Гном', 'Полуэльф', 'Полуорк', 'Тифлинг'
];

export const CharacterCreator: React.FC<CharacterCreatorProps> = ({ onSave, onCancel }) => {
  const [name, setName] = useState('');
  const [race, setRace] = useState(RACES[0]);
  const [selectedClass, setSelectedClass] = useState(CLASSES[0]);
  const [level, setLevel] = useState(1);
  const [background, setBackground] = useState('');
  const [abilityScores, setAbilityScores] = useState<AbilityScores>({
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10
  });
  const [useStandardArray, setUseStandardArray] = useState(true);
  const [standardArrayValues, setStandardArrayValues] = useState<number[]>([...STANDARD_ARRAY]);

  const handleRollAbilities = () => {
    setAbilityScores(generateAbilityScores());
    setUseStandardArray(false);
  };

  const handleUseStandardArray = () => {
    setUseStandardArray(true);
    setStandardArrayValues([...STANDARD_ARRAY]);
  };

  const handleAbilityChange = (ability: keyof AbilityScores, value: number) => {
    setAbilityScores(prev => ({ ...prev, [ability]: value }));
  };

  const assignStandardArrayValue = (ability: keyof AbilityScores, value: number) => {
    const currentValue = abilityScores[ability];
    
    // Возвращаем старое значение в массив
    if (STANDARD_ARRAY.includes(currentValue)) {
      setStandardArrayValues(prev => [...prev, currentValue].sort((a, b) => b - a));
    }
    
    // Убираем новое значение из массива
    setStandardArrayValues(prev => {
      const index = prev.indexOf(value);
      if (index > -1) {
        const newArray = [...prev];
        newArray.splice(index, 1);
        return newArray;
      }
      return prev;
    });
    
    handleAbilityChange(ability, value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const proficiencyBonus = getProficiencyBonus(level);
    const maxHP = calculateMaxHP(level, abilityScores.constitution, selectedClass.hitDie);

    const character: Character = {
      id: crypto.randomUUID(),
      name,
      race,
      class: selectedClass.name,
      level,
      background,
      abilityScores,
      hitPoints: {
        current: maxHP,
        max: maxHP,
        temporary: 0
      },
      hitDice: {
        total: level,
        used: 0,
        type: selectedClass.hitDie
      },
      savingThrows: {
        strength: { proficient: false },
        dexterity: { proficient: false },
        constitution: { proficient: false },
        intelligence: { proficient: false },
        wisdom: { proficient: false },
        charisma: { proficient: false }
      },
      skills: {},
      proficiencies: {
        armor: [],
        weapons: [],
        tools: [],
        languages: []
      },
      armorClass: 10,
      initiative: 0,
      speed: 30,
      proficiencyBonus,
      inventory: [],
      currency: {
        copper: 0,
        silver: 0,
        electrum: 0,
        gold: 0,
        platinum: 0
      },
      features: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Добавляем заклинания если класс - заклинатель
    if (selectedClass.spellcaster && selectedClass.ability) {
      character.spellcasting = {
        ability: selectedClass.ability,
        spellSaveDC: 8 + proficiencyBonus,
        spellAttackBonus: proficiencyBonus,
        spells: [],
        cantripsKnown: 2,
        spellsKnown: level + 1
      };
    }

    onSave(character);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-dnd-parchment rounded-lg shadow-2xl border-4 border-dnd-secondary">
      <h2 className="text-3xl font-medieval text-dnd-primary mb-6 text-center">
        Создание персонажа
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Базовая информация */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-2">Имя персонажа</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 border-2 border-dnd-primary rounded focus:outline-none focus:ring-2 focus:ring-dnd-secondary"
              placeholder="Введите имя"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Предыстория</label>
            <input
              type="text"
              value={background}
              onChange={(e) => setBackground(e.target.value)}
              className="w-full px-3 py-2 border-2 border-dnd-primary rounded focus:outline-none focus:ring-2 focus:ring-dnd-secondary"
              placeholder="Например: Солдат"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Раса</label>
            <select
              value={race}
              onChange={(e) => setRace(e.target.value)}
              className="w-full px-3 py-2 border-2 border-dnd-primary rounded focus:outline-none focus:ring-2 focus:ring-dnd-secondary"
            >
              {RACES.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Класс</label>
            <select
              value={selectedClass.name}
              onChange={(e) => setSelectedClass(CLASSES.find(c => c.name === e.target.value)!)}
              className="w-full px-3 py-2 border-2 border-dnd-primary rounded focus:outline-none focus:ring-2 focus:ring-dnd-secondary"
            >
              {CLASSES.map(c => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Уровень</label>
            <input
              type="number"
              min="1"
              max="20"
              value={level}
              onChange={(e) => setLevel(parseInt(e.target.value))}
              className="w-full px-3 py-2 border-2 border-dnd-primary rounded focus:outline-none focus:ring-2 focus:ring-dnd-secondary"
            />
          </div>
        </div>

        {/* Характеристики */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold">Характеристики</h3>
            <div className="space-x-2">
              <button
                type="button"
                onClick={handleRollAbilities}
                className="px-4 py-2 bg-dnd-primary text-white rounded hover:bg-opacity-80 flex items-center gap-2"
              >
                <Dices size={18} />
                Бросить кости
              </button>
              <button
                type="button"
                onClick={handleUseStandardArray}
                className="px-4 py-2 bg-dnd-secondary text-white rounded hover:bg-opacity-80"
              >
                Стандартный массив
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {(Object.keys(abilityScores) as Array<keyof AbilityScores>).map((ability) => (
              <div key={ability} className="bg-white p-3 rounded border-2 border-dnd-primary">
                <label className="block text-sm font-semibold mb-2 capitalize">
                  {ability === 'strength' && 'Сила'}
                  {ability === 'dexterity' && 'Ловкость'}
                  {ability === 'constitution' && 'Телосложение'}
                  {ability === 'intelligence' && 'Интеллект'}
                  {ability === 'wisdom' && 'Мудрость'}
                  {ability === 'charisma' && 'Харизма'}
                </label>
                {useStandardArray ? (
                  <select
                    value={abilityScores[ability]}
                    onChange={(e) => assignStandardArrayValue(ability, parseInt(e.target.value))}
                    className="w-full px-2 py-1 border border-gray-300 rounded"
                  >
                    <option value={abilityScores[ability]}>{abilityScores[ability]}</option>
                    {standardArrayValues.map(val => (
                      <option key={val} value={val}>{val}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="number"
                    min="3"
                    max="20"
                    value={abilityScores[ability]}
                    onChange={(e) => handleAbilityChange(ability, parseInt(e.target.value))}
                    className="w-full px-2 py-1 border border-gray-300 rounded"
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Кнопки */}
        <div className="flex justify-end gap-4 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
          >
            Отмена
          </button>
          <button
            type="submit"
            className="px-6 py-2 bg-dnd-primary text-white rounded hover:bg-opacity-80 flex items-center gap-2"
          >
            <Wand2 size={18} />
            Создать персонажа
          </button>
        </div>
      </form>
    </div>
  );
};
