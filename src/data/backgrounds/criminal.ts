import type { BackgroundDefinition } from './types';

export const criminal: BackgroundDefinition = {
  id: 'criminal',
  name: 'Преступник',
  source: 'XPHB',
  abilityOptions: ['dexterity', 'constitution', 'intelligence'],
  feat: 'Внимательный',
  skillProficiencies: ['Скрытность', 'Ловкость рук'],
  toolProficiency: 'Воровские инструменты',
  description: 'Вы имеете криминальное прошлое и навыки, полученные на тёмной стороне закона.',
  equipment: 'Воровские инструменты, лом, 2 мешочка, тёмная одежда с капюшоном, 16 зм',
};
