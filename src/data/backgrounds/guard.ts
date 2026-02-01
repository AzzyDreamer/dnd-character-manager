import type { BackgroundDefinition } from './types';

export const guard: BackgroundDefinition = {
  id: 'guard',
  name: 'Стражник',
  source: 'XPHB',
  abilityOptions: ['strength', 'intelligence', 'wisdom'],
  feat: 'Внимательный',
  skillProficiencies: ['Атлетика', 'Восприятие'],
  toolProficiency: 'Набор для игры (один на выбор)',
  description: 'Вы служили стражником, защищая город или важную персону.',
  equipment: 'Копьё, набор для игры, наручники, фонарь, 12 зм',
};
