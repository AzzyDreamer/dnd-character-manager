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
  ],
  proficiencies: {
    armor: ['Лёгкие доспехи', 'Средние доспехи', 'Щиты'],
    weapons: ['Простое оружие', 'Воинское оружие'],
    tools: [],
    skillChoices: { count: 2, from: ['animalHandling', 'athletics', 'intimidation', 'nature', 'perception', 'survival'] },
  },
};
