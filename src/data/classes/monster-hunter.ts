import type { ClassDefinition } from './types';

export const monsterHunter: ClassDefinition = {
  id: 'monster-hunter',
  name: 'Охотник на монстров',
  hitDie: 'd10',
  primaryAbility: ['wisdom', 'dexterity'],
  savingThrows: ['dexterity', 'wisdom'],
  spellcaster: true,
  spellcastingAbility: 'wisdom',
  description: 'Закалённый охотник, посвятивший жизнь уничтожению сверхъестественных угроз. Использует знания о монстрах и древние техники для выслеживания и уничтожения порождений тьмы.',
  source: "Grim Hollow: Player's Guide (2024)",
  subclasses: [
    { id: 'carver', name: 'Гильдия Живодёров', description: 'Slay Monsters Fearlessly and Recklessly', source: "GH:PG'24", level: 3 },
    { id: 'devourer', name: 'Гильдия Пожирателей', description: 'Gain Power by Consuming Monster Flesh', source: "GH:PG'24", level: 3 },
    { id: 'occultist', name: 'Гильдия Оккультистов', description: 'Hunt Mages and Magical Adversaries', source: "GH:PG'24", level: 3 },
    { id: 'trapper', name: 'Гильдия Ловчих', description: 'Dispatch Monsters with Cunning Traps', source: "GH:PG'24", level: 3 },
  ],
  proficiencies: {
    armor: ['Лёгкие доспехи', 'Средние доспехи'],
    weapons: ['Простое оружие', 'Воинское оружие'],
    tools: ['Набор алхимика', 'Набор травника'],
    skillChoices: { count: 3, from: ['arcana', 'athletics', 'insight', 'investigation', 'medicine', 'nature', 'perception', 'religion', 'stealth', 'survival'] },
  },
};
