import type { ClassDefinition } from './types';

export const artificer: ClassDefinition = {
  id: 'artificer',
  name: 'Изобретатель',
  hitDie: 'd8',
  primaryAbility: ['intelligence'],
  savingThrows: ['constitution', 'intelligence'],
  spellcaster: true,
  spellcastingAbility: 'intelligence',
  description: 'Мастер магических изобретений, вплетающий заклинания в предметы. Создаёт устройства, оружие и броню с магическими свойствами.',
  source: "Tasha's Cauldron of Everything",
  subclasses: [
    { id: 'alchemist', name: 'Алхимик', description: 'Создаёт магические эликсиры и зелья с чудесными свойствами.', source: "Tasha's Cauldron", level: 3 },
    { id: 'armorer', name: 'Бронник', description: 'Превращает доспехи в мощный магический экзоскелет.', source: "Tasha's Cauldron", level: 3 },
    { id: 'artillerist', name: 'Артиллерист', description: 'Создаёт магические пушки-конструкты для огневой поддержки.', source: "Tasha's Cauldron", level: 3 },
    { id: 'battle-smith', name: 'Боевой Кузнец', description: 'Сражается вместе со стальным защитником-конструктом.', source: "Tasha's Cauldron", level: 3 },
  ],
  proficiencies: {
    armor: ['Лёгкие доспехи', 'Средние доспехи', 'Щиты'],
    weapons: ['Простое оружие'],
    tools: ['Воровские инструменты', 'Инструменты ремесленника', 'Набор алхимика'],
    skillChoices: { count: 2, from: ['arcana', 'history', 'investigation', 'medicine', 'nature', 'perception', 'sleightOfHand'] },
  },
};
