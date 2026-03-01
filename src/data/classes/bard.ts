import type { ClassDefinition } from './types';

export const bard: ClassDefinition = {
  id: 'bard',
  name: 'Бард',
  hitDie: 'd8',
  primaryAbility: ['charisma'],
  savingThrows: ['dexterity', 'charisma'],
  spellcaster: true,
  spellcastingAbility: 'charisma',
  description: 'Вдохновляющий маг, чья сила проистекает из музыки и слов. Мастер на все руки.',
  source: "Player's Handbook",
  subclasses: [
    { id: 'lore', name: 'Коллегия Знаний', description: 'Собиратель знаний, владеющий разнообразными навыками.', source: 'PHB', level: 3 },
    { id: 'valor', name: 'Коллегия Доблести', description: 'Воинственный бард, вдохновляющий союзников на подвиги.', source: 'PHB', level: 3 },
    { id: 'glamour', name: 'Коллегия Гламура', description: 'Очаровывающий бард с магией Страны Фей.', source: "Xanathar's Guide", level: 3 },
    { id: 'swords', name: 'Коллегия Мечей', description: 'Мастер клинка, сочетающий фехтование с магией.', source: "Xanathar's Guide", level: 3 },
    { id: 'whispers', name: 'Коллегия Шёпотов', description: 'Тайный агент, использующий страхи и секреты.', source: "Xanathar's Guide", level: 3 },
    { id: 'adventurers', name: 'Коллегия Искателей Приключений', description: 'Be a Master of Classes', source: "GH:PG'24", level: 3 },
    { id: 'creation', name: 'Коллегия Творения', description: 'Draw on the Song of Creation', source: 'TCE', level: 3 },
    { id: 'dance', name: 'Коллегия Танца', description: 'Move in Harmony with the Cosmos', source: "PHB'24", level: 3 },
    { id: 'eloquence', name: 'Коллегия Красноречия', description: 'Master the Art of Oratory', source: 'TCE', level: 3 },
    { id: 'fools', name: 'Коллегия Шутов', description: "Laugh at Your Foes' Terror", source: "GH:PG'24", level: 3 },
    { id: 'moon', name: 'Коллегия Луны', description: 'Weave Moonlight into Performance', source: 'FRHoF', level: 3 },
    { id: 'requiems', name: 'Коллегия Реквиемов', description: 'Sing the Songs of the Dead', source: "GH:PG'24", level: 3 },
    { id: 'spirits', name: 'Коллегия Духов', description: 'Seek Tales with Inherent Power', source: 'VRGR', level: 3 },
  ],
  proficiencies: {
    armor: ['Лёгкие доспехи'],
    weapons: ['Простое оружие', 'Ручные арбалеты', 'Длинные мечи', 'Рапиры', 'Короткие мечи'],
    tools: ['Три музыкальных инструмента'],
    skillChoices: { count: 3, from: ['acrobatics', 'animalHandling', 'arcana', 'athletics', 'deception', 'history', 'insight', 'intimidation', 'investigation', 'medicine', 'nature', 'perception', 'performance', 'persuasion', 'religion', 'sleightOfHand', 'stealth', 'survival'] },
  },
};
