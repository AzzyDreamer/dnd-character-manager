import type { BackgroundDefinition } from './types';

export const charlatan: BackgroundDefinition = {
  id: 'charlatan',
  name: 'Шарлатан',
  source: 'XPHB',
  abilityOptions: ['dexterity', 'constitution', 'charisma'],
  feat: 'Искусный',
  skillProficiencies: ['Обман', 'Ловкость рук'],
  toolProficiency: 'Набор для подделок',
  description: 'Вы всегда умели убеждать людей в том, что не является правдой.',
  equipment: 'Набор для подделок, набор костюмов, 15 зм',
};
