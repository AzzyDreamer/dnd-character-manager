import type { ClassDefinition } from './types';

export const fighter: ClassDefinition = {
  id: 'fighter',
  name: 'Воин',
  hitDie: 'd10',
  primaryAbility: ['strength', 'dexterity'],
  savingThrows: ['strength', 'constitution'],
  spellcaster: false,
  description: 'Мастер боевых искусств, владеющий любым оружием и доспехами. Непревзойдённый тактик.',
  source: "Player's Handbook",
  subclasses: [
    { id: 'champion', name: 'Чемпион', description: 'Совершенный атлет с повышенными критическими ударами.', source: 'PHB', level: 3 },
    { id: 'battlemaster', name: 'Мастер Боевых Искусств', description: 'Тактик, использующий боевые манёвры.', source: 'PHB', level: 3 },
    { id: 'eldritch-knight', name: 'Мистический Рыцарь', description: 'Воин, сочетающий фехтование с магией.', source: 'PHB', level: 3 },
    { id: 'samurai', name: 'Самурай', description: 'Воин с несгибаемой волей и смертоносной точностью.', source: "Xanathar's Guide", level: 3 },
    { id: 'echo-knight', name: 'Рыцарь Эха', description: 'Призывает эхо из параллельной реальности для боя.', source: "Explorer's Guide to Wildemount", level: 3 },
  ],
  proficiencies: {
    armor: ['Все доспехи', 'Щиты'],
    weapons: ['Простое оружие', 'Воинское оружие'],
    tools: [],
    skillChoices: { count: 2, from: ['acrobatics', 'animalHandling', 'athletics', 'history', 'insight', 'intimidation', 'perception', 'survival'] },
  },
};
