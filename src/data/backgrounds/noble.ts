import type { BackgroundDefinition } from './types';

export const noble: BackgroundDefinition = {
  id: 'noble',
  name: 'Дворянин',
  source: 'XPHB',
  abilityOptions: ['strength', 'intelligence', 'charisma'],
  feat: 'Искусный',
  skillProficiencies: ['История', 'Убеждение'],
  toolProficiency: 'Набор для игры (один на выбор)',
  description: 'Вы родились в знатной семье и привыкли к привилегиям высшего общества.',
  equipment: 'Набор для игры, изящная одежда, перстень-печатка, 29 зм',
};
