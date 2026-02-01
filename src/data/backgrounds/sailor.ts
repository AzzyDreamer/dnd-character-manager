import type { BackgroundDefinition } from './types';

export const sailor: BackgroundDefinition = {
  id: 'sailor',
  name: 'Моряк',
  source: 'XPHB',
  abilityOptions: ['strength', 'dexterity', 'wisdom'],
  feat: 'Ловкач',
  skillProficiencies: ['Акробатика', 'Восприятие'],
  toolProficiency: 'Инструменты навигатора',
  description: 'Вы провели годы на борту корабля, изучив морское дело.',
  equipment: 'Инструменты навигатора, верёвка (15 м), дорожная одежда, 20 зм',
};
