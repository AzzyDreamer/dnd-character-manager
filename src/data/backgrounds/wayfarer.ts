import type { BackgroundDefinition } from './types';

export const wayfarer: BackgroundDefinition = {
  id: 'wayfarer',
  name: 'Странник',
  source: 'XPHB',
  abilityOptions: ['dexterity', 'wisdom', 'charisma'],
  feat: 'Счастливчик',
  skillProficiencies: ['Проницательность', 'Скрытность'],
  toolProficiency: 'Воровские инструменты',
  description: 'Вы выросли на улицах, научившись выживать благодаря смекалке и удаче.',
  equipment: 'Воровские инструменты, набор для переодевания, дорожная одежда, 16 зм',
};
