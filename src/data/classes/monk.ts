import type { ClassDefinition } from './types';

export const monk: ClassDefinition = {
  id: 'monk',
  name: 'Монах',
  hitDie: 'd8',
  primaryAbility: ['dexterity', 'wisdom'],
  savingThrows: ['strength', 'dexterity'],
  spellcaster: false,
  description: 'Мастер боевых искусств, использующий внутреннюю энергию ки для невероятных подвигов.',
  source: "Player's Handbook",
  subclasses: [
    { id: 'open-hand', name: 'Путь Открытой Ладони', description: 'Мастер рукопашного боя с разрушительными приёмами.', source: 'PHB', level: 3 },
    { id: 'shadow', name: 'Путь Тени', description: 'Воин-тень, мастер скрытности и тёмных искусств.', source: 'PHB', level: 3 },
    { id: 'elements', name: 'Воин Стихий', description: 'Wield Bursts of Elemental Power', source: "PHB'24", level: 3 },
    { id: 'kensei', name: 'Путь Кенсей', description: 'Мастер оружия, превращающий клинок в продолжение себя.', source: "Xanathar's Guide", level: 3 },
    { id: 'mercy', name: 'Путь Милосердия', description: 'Целитель и воин, манипулирующий жизненной энергией.', source: "Tasha's Cauldron", level: 3 },
    { id: 'ascendant-dragon', name: 'Путь Вознесённого Дракона', description: 'Emulate the Power of Dragons', source: 'FTD', level: 3 },
    { id: 'astral-self', name: 'Путь Астрального Я', description: 'Manifest Your Astral True Self', source: 'TCE', level: 3 },
    { id: 'drunken-master', name: 'Путь Пьяного Мастера', description: 'Use Unpredictable Drunken Combat', source: 'XGE', level: 3 },
    { id: 'leaden-crown', name: 'Воин Свинцовой Короны', description: 'Harness the Will to Resist', source: "GHPG'24", level: 3 },
    { id: 'long-death', name: 'Путь Долгой Смерти', description: 'Study Death to Master Combat', source: 'SCAG', level: 3 },
    { id: 'pride', name: 'Воин Гордыни', description: 'Prove Your Superiority', source: "GHPG'24", level: 3 },
    { id: 'regret', name: 'Воин Сожаления', description: 'Atone for Past Mistakes', source: "GHPG'24", level: 3 },
    { id: 'sun-soul', name: 'Путь Солнечной Души', description: 'Channel Life Energy into Radiant Light', source: 'XGE', level: 3 },
  ],
  proficiencies: {
    armor: [],
    weapons: ['Простое оружие', 'Короткие мечи'],
    tools: ['Один инструмент ремесленника или музыкальный инструмент'],
    skillChoices: { count: 2, from: ['acrobatics', 'athletics', 'history', 'insight', 'religion', 'stealth'] },
  },
};
