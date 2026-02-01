import type { BackgroundDefinition } from './types';

export const sage: BackgroundDefinition = {
  id: 'sage',
  name: 'Мудрец',
  source: 'XPHB',
  abilityOptions: ['constitution', 'intelligence', 'wisdom'],
  feat: 'Посвящённый в магию (Волшебник)',
  skillProficiencies: ['Магия', 'История'],
  toolProficiency: 'Набор каллиграфа',
  description: 'Вы провели годы за изучением знаний, накопленных великими учёными.',
  equipment: 'Набор каллиграфа, 4 книги, фонарь, пергамент (10 листов), 8 зм',
};
