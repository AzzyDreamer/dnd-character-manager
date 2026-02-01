import type { BackgroundDefinition } from './types';

export const entertainer: BackgroundDefinition = {
  id: 'entertainer',
  name: 'Артист',
  source: 'XPHB',
  abilityOptions: ['strength', 'dexterity', 'charisma'],
  feat: 'Музыкант',
  skillProficiencies: ['Акробатика', 'Выступление'],
  toolProficiency: 'Музыкальный инструмент (один на выбор)',
  description: 'Вы зарабатывали на жизнь выступлениями перед публикой.',
  equipment: 'Музыкальный инструмент, 2 костюма, зеркальце, 11 зм',
};
