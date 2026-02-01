import type { BackgroundDefinition } from './types';

export const farmer: BackgroundDefinition = {
  id: 'farmer',
  name: 'Фермер',
  source: 'XPHB',
  abilityOptions: ['strength', 'constitution', 'wisdom'],
  feat: 'Крутой',
  skillProficiencies: ['Уход за животными', 'Природа'],
  toolProficiency: 'Инструменты плотника',
  description: 'Вы выросли на ферме, привыкнув к тяжёлому труду и жизни на земле.',
  equipment: 'Инструменты плотника, железный горшок, лопата, 30 зм',
};
