import type { RaceDefinition } from './types';

export const tiefling: RaceDefinition = {
  id: 'tiefling',
  name: 'Тифлинг',
  speed: 30,
  size: 'Средний',
  traits: [
    { name: 'Тёмное зрение', description: 'Вы видите в темноте на 60 футов.' },
    { name: 'Адское сопротивление', description: 'Сопротивление урону огнём.' },
    { name: 'Адское наследие', description: 'Вы знаете заговор Чудотворство. На 3 уровне — Адское возмездие. На 5 уровне — Тьма.' },
  ],
  languages: ['Общий', 'Инфернальный'],
  description: 'Потомки смертных и демонов, отмеченные рогами, хвостом и адской кровью. Часто встречают предубеждение.',
  source: "Player's Handbook",
};
