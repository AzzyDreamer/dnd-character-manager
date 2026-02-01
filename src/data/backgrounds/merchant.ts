import type { BackgroundDefinition } from './types';

export const merchant: BackgroundDefinition = {
  id: 'merchant',
  name: 'Торговец',
  source: 'XPHB',
  abilityOptions: ['constitution', 'intelligence', 'charisma'],
  feat: 'Счастливчик',
  skillProficiencies: ['Уход за животными', 'Убеждение'],
  toolProficiency: 'Инструменты навигатора',
  description: 'Вы путешествовали с караваном, торгуя товарами между городами.',
  equipment: 'Инструменты навигатора, 2 мешочка, дорожная одежда, 22 зм',
};
