import type { BackgroundDefinition } from './types';

export const hermit: BackgroundDefinition = {
  id: 'hermit',
  name: 'Отшельник',
  source: 'XPHB',
  abilityOptions: ['constitution', 'wisdom', 'charisma'],
  feat: 'Посвящённый в магию (Друид)',
  skillProficiencies: ['Медицина', 'Религия'],
  toolProficiency: 'Набор травника',
  description: 'Вы провели долгое время в уединении, предаваясь размышлениям и самопознанию.',
  equipment: 'Набор травника, свиток с записями, зимнее одеяло, лампа, масло, 15 зм',
};
