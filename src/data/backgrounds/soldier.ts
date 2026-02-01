import type { BackgroundDefinition } from './types';

export const soldier: BackgroundDefinition = {
  id: 'soldier',
  name: 'Солдат',
  source: 'XPHB',
  abilityOptions: ['strength', 'dexterity', 'constitution'],
  feat: 'Целитель',
  skillProficiencies: ['Атлетика', 'Запугивание'],
  toolProficiency: 'Набор для игры (один на выбор)',
  description: 'Вы служили в армии, прошли через военные кампании и битвы.',
  equipment: 'Копьё, арбалет лёгкий, 20 болтов, набор для игры, дорожная одежда, 14 зм',
};
