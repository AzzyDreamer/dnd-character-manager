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
  ],
  proficiencies: {
    armor: [],
    weapons: ['Кинжалы', 'Дротики', 'Пращи', 'Боевые посохи', 'Лёгкие арбалеты'],
    tools: [],
    skillChoices: { count: 2, from: ['arcana', 'deception', 'insight', 'intimidation', 'persuasion', 'religion'] },
  },
};
