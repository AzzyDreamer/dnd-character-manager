import type { ClassDefinition } from './types';

export const wizard: ClassDefinition = {
  id: 'wizard',
  name: 'Волшебник',
  hitDie: 'd6',
  primaryAbility: ['intelligence'],
  savingThrows: ['intelligence', 'wisdom'],
  spellcaster: true,
  spellcastingAbility: 'intelligence',
  description: 'Учёный маг, постигающий тайны мироздания через изучение заклинаний. Самый универсальный заклинатель.',
  source: "Player's Handbook",
  subclasses: [
    { id: 'abjuration', name: 'Школа Ограждения', description: 'Мастер защитной магии и магических барьеров.', source: 'PHB', level: 3 },
    { id: 'conjuration', name: 'Школа Вызова', description: 'Призывает существ и создаёт предметы из ничего.', source: 'PHB', level: 3 },
    { id: 'divination', name: 'Школа Прорицания', description: 'Видит будущее и управляет вероятностями.', source: 'PHB', level: 3 },
    { id: 'enchantment', name: 'Школа Очарования', description: 'Управляет разумом и эмоциями.', source: 'PHB', level: 3 },
    { id: 'evocation', name: 'Школа Воплощения', description: 'Мастер разрушительной стихийной магии.', source: 'PHB', level: 3 },
    { id: 'illusion', name: 'Школа Иллюзий', description: 'Создаёт обманчивые образы и искажает реальность.', source: 'PHB', level: 3 },
    { id: 'necromancy', name: 'Школа Некромантии', description: 'Управляет силами жизни и смерти.', source: 'PHB', level: 3 },
    { id: 'transmutation', name: 'Школа Преобразования', description: 'Изменяет свойства материи и энергии.', source: 'PHB', level: 3 },
    { id: 'war-magic', name: 'Школа Военной Магии', description: 'Сочетает атакующую и защитную магию в бою.', source: "Xanathar's Guide", level: 3 },
    { id: 'chronurgy', name: 'Хронургия', description: 'Манипулирует временем и вероятностями.', source: "Explorer's Guide to Wildemount", level: 3 },
  ],
  proficiencies: {
    armor: [],
    weapons: ['Кинжалы', 'Дротики', 'Пращи', 'Боевые посохи', 'Лёгкие арбалеты'],
    tools: [],
    skillChoices: { count: 2, from: ['arcana', 'history', 'insight', 'investigation', 'medicine', 'religion'] },
  },
};
