import type { ClassDefinition } from './types';

export const barbarian: ClassDefinition = {
  id: 'barbarian',
  name: 'Варвар',
  hitDie: 'd12',
  primaryAbility: ['strength'],
  savingThrows: ['strength', 'constitution'],
  spellcaster: false,
  description: 'Свирепый воин, черпающий силу из первобытной ярости. В бою входит в состояние неудержимого гнева.',
  source: "Player's Handbook",
  subclasses: [
    { id: 'berserker', name: 'Путь Берсерка', description: 'Безудержная ярость, позволяющая сражаться до последнего вздоха.', source: 'PHB', level: 3 },
    { id: 'totem-warrior', name: 'Путь Тотемного Воина', description: 'Духовный путь, связывающий варвара с животным-тотемом.', source: 'PHB', level: 3 },
    { id: 'ancestral-guardian', name: 'Путь Предков', description: 'Призывает духов предков для защиты союзников.', source: "Xanathar's Guide", level: 3 },
    { id: 'storm-herald', name: 'Путь Буревестника', description: 'Ярость варвара порождает магическую ауру стихий.', source: "Xanathar's Guide", level: 3 },
    { id: 'zealot', name: 'Путь Фанатика', description: 'Воин, наполненный божественной яростью и стойкостью.', source: "Xanathar's Guide", level: 3 },
    { id: 'battlerager', name: 'Путь Неистового Бойца', description: 'Fight in Spiked Armor', source: 'SCAG', level: 3 },
    { id: 'beast', name: 'Путь Зверя', description: 'Transform into a Bestial Form', source: 'TCE', level: 3 },
    { id: 'fractured', name: 'Путь Расколотого', description: 'Two Personalities Are Better than One', source: "GH:PG'24", level: 3 },
    { id: 'giant', name: 'Путь Гиганта', description: 'Channel the Primal Might of Giants', source: 'BGG', level: 3 },
    { id: 'primal-spirit', name: 'Путь Первобытного Духа', description: 'Rage Alongside a Bestial Spirit', source: "GH:PG'24", level: 3 },
    { id: 'wild-heart', name: 'Путь Дикого Сердца', description: 'Walk in Community with the Animal World', source: "PHB'24", level: 3 },
    { id: 'wild-magic', name: 'Путь Дикой Магии', description: 'Channel Wild Magic through Rage', source: 'TCE', level: 3 },
    { id: 'world-tree', name: 'Путь Мирового Древа', description: 'Trace the Roots and Branches of the Multiverse', source: "PHB'24", level: 3 },
    { id: 'wrathful-dead', name: 'Путь Гневных Мертвецов', description: 'Channel the Rage of the Unquiet Dead', source: "GH:PG'24", level: 3 },
  ],
  proficiencies: {
    armor: ['Лёгкие доспехи', 'Средние доспехи', 'Щиты'],
    weapons: ['Простое оружие', 'Воинское оружие'],
    tools: [],
    skillChoices: { count: 2, from: ['animalHandling', 'athletics', 'intimidation', 'nature', 'perception', 'survival'] },
  },
};
