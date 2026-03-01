import type { ClassDefinition } from './types';

export const sorcerer: ClassDefinition = {
  id: 'sorcerer',
  name: 'Чародей',
  hitDie: 'd6',
  primaryAbility: ['charisma'],
  savingThrows: ['constitution', 'charisma'],
  spellcaster: true,
  spellcastingAbility: 'charisma',
  description: 'Врождённый маг, чья сила проистекает из крови или судьбы. Управляет сырой магической энергией.',
  source: "Player's Handbook",
  subclasses: [
    { id: 'draconic', name: 'Драконья Кровь', description: 'Магия древних драконов течёт в ваших жилах.', source: 'PHB', level: 3 },
    { id: 'wild-magic', name: 'Дикая Магия', description: 'Хаотическая сила, непредсказуемая и разрушительная.', source: 'PHB', level: 3 },
    { id: 'divine-soul', name: 'Божественная Душа', description: 'Божественная искра даёт доступ к жреческим заклинаниям.', source: "Xanathar's Guide", level: 3 },
    { id: 'shadow', name: 'Теневая Магия', description: 'Связь с Царством Теней наделяет тёмной силой.', source: "Xanathar's Guide", level: 3 },
    { id: 'aberrant-mind', name: 'Аберрантный Разум', description: 'Псионическая сила из контакта с чуждыми сущностями.', source: "Tasha's Cauldron", level: 3 },
    { id: 'clockwork-soul', name: 'Заводная Душа', description: 'Сила порядка Механуса течёт через вас.', source: "Tasha's Cauldron", level: 3 },
    { id: 'apocalypse', name: 'Апокалипсис', description: 'Hasten or Stall the End of the World', source: "GH:PG'24", level: 3 },
    { id: 'haunted', name: 'Преследуемый', description: 'Commune with the Dead', source: "GH:PG'24", level: 3 },
    { id: 'lunar', name: 'Лунная Магия', description: 'Channel the Magic of the Moon', source: 'DSotDQ', level: 1 },
    { id: 'spellfire', name: 'Магический Огонь', description: 'Wield Raw Magic', source: 'FRHoF', level: 3 },
    { id: 'storm', name: 'Штормовая Магия', description: 'Command the Power of the Storm', source: 'XGE', level: 1 },
    { id: 'wretched', name: 'Отверженный', description: 'Wield Your Curse Like a Weapon', source: "GH:PG'24", level: 3 },
  ],
  proficiencies: {
    armor: [],
    weapons: ['Кинжалы', 'Дротики', 'Пращи', 'Боевые посохи', 'Лёгкие арбалеты'],
    tools: [],
    skillChoices: { count: 2, from: ['arcana', 'deception', 'insight', 'intimidation', 'persuasion', 'religion'] },
  },
};
