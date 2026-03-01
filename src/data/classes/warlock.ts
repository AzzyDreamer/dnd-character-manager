import type { ClassDefinition } from './types';

export const warlock: ClassDefinition = {
  id: 'warlock',
  name: 'Колдун',
  hitDie: 'd8',
  primaryAbility: ['charisma'],
  savingThrows: ['wisdom', 'charisma'],
  spellcaster: true,
  spellcastingAbility: 'charisma',
  description: 'Маг, заключивший пакт с могущественной сущностью. Получает уникальные силы от своего покровителя.',
  source: "Player's Handbook",
  subclasses: [
    { id: 'archfey', name: 'Архифея', description: 'Покровитель из Страны Фей с чарующей магией.', source: 'PHB', level: 3 },
    { id: 'fiend', name: 'Исчадие', description: 'Пакт с демоном или дьяволом, дающий разрушительную силу.', source: 'PHB', level: 3 },
    { id: 'great-old-one', name: 'Великий Древний', description: 'Контакт с непостижимой сущностью из глубин космоса.', source: 'PHB', level: 3 },
    { id: 'celestial', name: 'Небожитель', description: 'Покровитель из верхних планов, дающий целительную силу.', source: "Xanathar's Guide", level: 3 },
    { id: 'hexblade', name: 'Ведьмин Клинок', description: 'Пакт с таинственным оружием из Царства Теней.', source: "Xanathar's Guide", level: 3 },
    { id: 'fathomless', name: 'Бездонный', description: 'Покровитель из глубин океана с тёмной водной магией.', source: "Tasha's Cauldron", level: 3 },
    { id: 'coven', name: 'Ковен', description: 'Curse and Befuddle with Hag Magic', source: "GH:PG'24", level: 3 },
    { id: 'first-vampire', name: 'Первый Вампир', description: 'Wield the Power of Undeath', source: "GH:PG'24", level: 3 },
    { id: 'genie', name: 'Джинн', description: 'Bargain with a Noble Genie', source: 'TCE', level: 3 },
    { id: 'parasite', name: 'Паразит', description: 'Become One with a Cosmic Being', source: "GH:PG'24", level: 3 },
    { id: 'undead', name: 'Нежить', description: 'Defy the Cycle of Life and Death', source: 'VRGR', level: 3 },
    { id: 'undying', name: 'Бессмертный', description: 'Unlock the Secrets of Everlasting Life', source: 'SCAG', level: 3 },
  ],
  proficiencies: {
    armor: ['Лёгкие доспехи'],
    weapons: ['Простое оружие'],
    tools: [],
    skillChoices: { count: 2, from: ['arcana', 'deception', 'history', 'intimidation', 'investigation', 'nature', 'religion'] },
  },
};
