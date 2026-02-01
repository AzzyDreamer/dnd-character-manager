import type { BackgroundDefinition } from './types';

export const acolyte: BackgroundDefinition = {
  id: 'acolyte',
  name: 'Послушник',
  source: 'XPHB',
  abilityOptions: ['intelligence', 'wisdom', 'charisma'],
  feat: 'Посвящённый в магию (Жрец)',
  skillProficiencies: ['Проницательность', 'Религия'],
  toolProficiency: 'Набор каллиграфа',
  description: 'Вы провели годы в служении храму, изучая священные тексты и проводя ритуалы.',
  equipment: 'Набор каллиграфа, книга (молитвы), священный символ, 10 листов пергамента, ряса, 8 зм',
};
