import type { ClassDefinition } from './types';

export const ranger: ClassDefinition = {
  id: 'ranger',
  name: 'Следопыт',
  hitDie: 'd10',
  primaryAbility: ['dexterity', 'wisdom'],
  savingThrows: ['strength', 'dexterity'],
  spellcaster: true,
  spellcastingAbility: 'wisdom',
  description: 'Воин дикой природы, мастер выживания и следопытства. Непревзойдённый охотник.',
  source: "Player's Handbook",
  subclasses: [
    { id: 'hunter', name: 'Охотник', description: 'Мастер охоты на опасную добычу.', source: 'PHB', level: 3 },
    { id: 'beast-master', name: 'Повелитель Зверей', description: 'Сражается бок о бок с верным животным-компаньоном.', source: 'PHB', level: 3 },
    { id: 'gloom-stalker', name: 'Мрачный Скиталец', description: 'Охотник во тьме, невидимый для врагов.', source: "Xanathar's Guide", level: 3 },
    { id: 'horizon-walker', name: 'Странник Горизонта', description: 'Страж между планами бытия.', source: "Xanathar's Guide", level: 3 },
    { id: 'swarmkeeper', name: 'Хранитель Роя', description: 'Управляет роем духов природы.', source: "Tasha's Cauldron", level: 3 },
  ],
  proficiencies: {
    armor: ['Лёгкие доспехи', 'Средние доспехи', 'Щиты'],
    weapons: ['Простое оружие', 'Воинское оружие'],
    tools: [],
    skillChoices: { count: 3, from: ['animalHandling', 'athletics', 'insight', 'investigation', 'nature', 'perception', 'stealth', 'survival'] },
  },
};
