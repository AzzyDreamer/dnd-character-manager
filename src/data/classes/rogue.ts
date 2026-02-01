import type { ClassDefinition } from './types';

export const rogue: ClassDefinition = {
  id: 'rogue',
  name: 'Плут',
  hitDie: 'd8',
  primaryAbility: ['dexterity'],
  savingThrows: ['dexterity', 'intelligence'],
  spellcaster: false,
  description: 'Ловкий специалист, полагающийся на хитрость и точные удары. Мастер скрытности и обмана.',
  source: "Player's Handbook",
  subclasses: [
    { id: 'thief', name: 'Вор', description: 'Мастер проникновения и ловкости рук.', source: 'PHB', level: 3 },
    { id: 'assassin', name: 'Убийца', description: 'Смертоносный агент, мастер внезапных атак.', source: 'PHB', level: 3 },
    { id: 'arcane-trickster', name: 'Мистический Ловкач', description: 'Плут, освоивший магию иллюзий и очарования.', source: 'PHB', level: 3 },
    { id: 'swashbuckler', name: 'Дуэлянт', description: 'Отважный фехтовальщик с харизмой и грацией.', source: "Xanathar's Guide", level: 3 },
    { id: 'phantom', name: 'Фантом', description: 'Плут, связанный с миром мёртвых.', source: "Tasha's Cauldron", level: 3 },
    { id: 'soulknife', name: 'Нож Души', description: 'Использует псионическую энергию для создания клинков.', source: "Tasha's Cauldron", level: 3 },
  ],
  proficiencies: {
    armor: ['Лёгкие доспехи'],
    weapons: ['Простое оружие', 'Ручные арбалеты', 'Длинные мечи', 'Рапиры', 'Короткие мечи'],
    tools: ['Воровские инструменты'],
    skillChoices: { count: 4, from: ['acrobatics', 'athletics', 'deception', 'insight', 'intimidation', 'investigation', 'perception', 'performance', 'persuasion', 'sleightOfHand', 'stealth'] },
  },
};
