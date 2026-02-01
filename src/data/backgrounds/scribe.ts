import type { BackgroundDefinition } from './types';

export const scribe: BackgroundDefinition = {
  id: 'scribe',
  name: 'Писец',
  source: 'XPHB',
  abilityOptions: ['dexterity', 'intelligence', 'wisdom'],
  feat: 'Искусный',
  skillProficiencies: ['Анализ', 'Восприятие'],
  toolProficiency: 'Набор каллиграфа',
  description: 'Вы зарабатывали копированием документов и ведением записей.',
  equipment: 'Набор каллиграфа, 2 книги, чернила, перо, фонарь, пергамент (10 листов), 23 зм',
};
