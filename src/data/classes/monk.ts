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
    { id: 'four-elements', name: 'Путь Четырёх Стихий', description: 'Управляет стихиями через ки.', source: 'PHB', level: 3 },
    { id: 'kensei', name: 'Путь Кенсей', description: 'Мастер оружия, превращающий клинок в продолжение себя.', source: "Xanathar's Guide", level: 3 },
    { id: 'mercy', name: 'Путь Милосердия', description: 'Целитель и воин, манипулирующий жизненной энергией.', source: "Tasha's Cauldron", level: 3 },
  ],
  proficiencies: {
    armor: [],
    weapons: ['Простое оружие', 'Короткие мечи'],
    tools: ['Один инструмент ремесленника или музыкальный инструмент'],
    skillChoices: { count: 2, from: ['acrobatics', 'athletics', 'history', 'insight', 'religion', 'stealth'] },
  },
};
