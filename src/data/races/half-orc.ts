import type { RaceDefinition } from './types';

export const halfOrc: RaceDefinition = {
  id: 'half-orc',
  name: 'Полуорк',
  speed: 30,
  size: 'Средний',
  traits: [
    { name: 'Тёмное зрение', description: 'Вы видите в темноте на 60 футов.' },
    { name: 'Угрожающий', description: 'Вы владеете навыком Запугивание.' },
    { name: 'Непоколебимая стойкость', description: 'При снижении до 0 хитов вы можете упасть до 1 хита вместо этого (1 раз между отдыхами).' },
    { name: 'Дикие атаки', description: 'При критическом попадании бросьте один дополнительный кубик урона оружия.' },
  ],
  languages: ['Общий', 'Орочий'],
  description: 'Мощные и выносливые, несущие наследие обоих народов. Стремятся доказать свою ценность.',
  source: "Player's Handbook",
};
