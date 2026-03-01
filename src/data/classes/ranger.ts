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
    { id: 'drakewarden', name: 'Хранитель Дрейков', description: 'Channel the Power of Dragons', source: 'FToD', level: 3 },
    { id: 'fey-wanderer', name: 'Странник Фей', description: 'Wield Fey Mirth and Fury', source: "PHB'24", level: 3 },
    { id: 'green-reaper', name: 'Зелёный Жнец', description: "Slay with Nature's Venom", source: "GHPg'24", level: 3 },
    { id: 'monster-slayer', name: 'Истребитель Монстров', description: 'Hunt Down Creatures of the Night', source: 'XGE', level: 3 },
    { id: 'primordial-archer', name: 'Первозданный Стрелок', description: 'Channel the Wrath of the Wilds', source: "GHPg'24", level: 3 },
    { id: 'vermin-lord', name: 'Повелитель Паразитов', description: 'Grow Powerful from Strength in Numbers', source: "GHPg'24", level: 3 },
    { id: 'winter-walker', name: 'Зимний Скиталец', description: 'Withstand the Horrors of Frigid Wastelands', source: 'FRiME', level: 3 },
  ],
  proficiencies: {
    armor: ['Лёгкие доспехи', 'Средние доспехи', 'Щиты'],
    weapons: ['Простое оружие', 'Воинское оружие'],
    tools: [],
    skillChoices: { count: 3, from: ['animalHandling', 'athletics', 'insight', 'investigation', 'nature', 'perception', 'stealth', 'survival'] },
  },
};
