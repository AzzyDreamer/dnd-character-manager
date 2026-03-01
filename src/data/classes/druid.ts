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
    { id: 'blood', name: 'Круг Крови', description: 'Wreak Bloody Havoc', source: "GH:PG'24", level: 3 },
    { id: 'dreams', name: 'Круг Грёз', description: 'Feywild-Connected Healer of Dreams', source: 'XGE', level: 3 },
    { id: 'entropy', name: 'Круг Энтропии', description: 'Become an Instrument of Decay and Ruin', source: "GH:PG'24", level: 3 },
    { id: 'mutation', name: 'Круг Мутации', description: 'Mutate Into an Apex Predator', source: "GH:PG'24", level: 3 },
    { id: 'sea', name: 'Круг Моря', description: 'Become One with Tides and Storms', source: "PHB'24", level: 3 },
    { id: 'stars', name: 'Круг Звёзд', description: 'Harness Secrets Hidden in Constellations', source: "PHB'24", level: 3 },
    { id: 'wildfire', name: 'Круг Лесного Пожара', description: 'Destruction Brings Renewal Through Fire', source: 'TCE', level: 3 },
  ],
  proficiencies: {
    armor: ['Лёгкие доспехи', 'Средние доспехи', 'Щиты (не металлические)'],
    weapons: ['Дубинки', 'Кинжалы', 'Дротики', 'Копья', 'Булавы', 'Боевые посохи', 'Серпы', 'Пращи'],
    tools: ['Набор травника'],
    skillChoices: { count: 2, from: ['arcana', 'animalHandling', 'insight', 'medicine', 'nature', 'perception', 'religion', 'survival'] },
  },
};
