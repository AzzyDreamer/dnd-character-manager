import type { ClassDefinition } from './types';

export const druid: ClassDefinition = {
  id: 'druid',
  name: 'Друид',
  hitDie: 'd8',
  primaryAbility: ['wisdom'],
  savingThrows: ['intelligence', 'wisdom'],
  spellcaster: true,
  spellcastingAbility: 'wisdom',
  description: 'Хранитель природы, черпающий магию из первозданных сил мира. Может принимать облик зверей.',
  source: "Player's Handbook",
  subclasses: [
    { id: 'land', name: 'Круг Земли', description: 'Мистик, связанный с определённой местностью.', source: 'PHB', level: 3 },
    { id: 'moon', name: 'Круг Луны', description: 'Мастер дикого облика, способный обращаться в могучих зверей.', source: 'PHB', level: 3 },
    { id: 'shepherd', name: 'Круг Пастыря', description: 'Призыватель духов природы и защитник животных.', source: "Xanathar's Guide", level: 3 },
    { id: 'spores', name: 'Круг Спор', description: 'Повелевает силами разложения и возрождения.', source: "Tasha's Cauldron", level: 3 },
  ],
  proficiencies: {
    armor: ['Лёгкие доспехи', 'Средние доспехи', 'Щиты (не металлические)'],
    weapons: ['Дубинки', 'Кинжалы', 'Дротики', 'Копья', 'Булавы', 'Боевые посохи', 'Серпы', 'Пращи'],
    tools: ['Набор травника'],
    skillChoices: { count: 2, from: ['arcana', 'animalHandling', 'insight', 'medicine', 'nature', 'perception', 'religion', 'survival'] },
  },
};
