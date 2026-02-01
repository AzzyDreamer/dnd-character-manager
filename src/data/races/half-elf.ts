import type { RaceDefinition } from './types';

export const halfElf: RaceDefinition = {
  id: 'half-elf',
  name: 'Полуэльф',
  speed: 30,
  size: 'Средний',
  traits: [
    { name: 'Тёмное зрение', description: 'Вы видите в темноте на 60 футов.' },
    { name: 'Наследие фей', description: 'Преимущество на спасброски от очарования, и магия не может усыпить вас.' },
    { name: 'Универсальность', description: 'Вы владеете двумя дополнительными навыками по вашему выбору.' },
  ],
  languages: ['Общий', 'Эльфийский', 'Один на выбор'],
  description: 'Дети двух миров, сочетающие черты людей и эльфов. Обаятельны и универсальны.',
  source: "Player's Handbook",
};
