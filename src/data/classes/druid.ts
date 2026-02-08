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
    { id: 'land', name: 'Круг Земли', description: 'Мистик, связанный с определённой местностью.', source: "PHB'24", level: 3 },
    { id: 'moon', name: 'Круг Луны', description: 'Мастер дикого облика, способный обращаться в могучих зверей.', source: "PHB'24", level: 3 },
    { id: 'sea', name: 'Круг Моря', description: 'Друид, черпающий силу из океанских глубин и штормов.', source: "PHB'24", level: 3 },
    { id: 'stars', name: 'Круг Звёзд', description: 'Друид, читающий звёзды и использующий их силу.', source: "PHB'24", level: 3 },
    { id: 'dreams', name: 'Круг Грёз', description: 'Друид, связанный с Фейским миром и исцеляющей магией снов.', source: "XGE", level: 3 },
    { id: 'shepherd', name: 'Круг Пастыря', description: 'Призыватель духов природы и защитник животных.', source: "XGE", level: 3 },
    { id: 'spores', name: 'Круг Спор', description: 'Повелевает силами разложения и возрождения через споры и грибы.', source: "TCE", level: 3 },
    { id: 'wildfire', name: 'Круг Лесного Пожара', description: 'Друид, использующий разрушительную и возрождающую силу огня.', source: "TCE", level: 3 },
    { id: 'blood', name: 'Круг Крови', description: 'Хранитель древних кровавых ритуалов, балансирующий между жизнью и смертью.', source: "GH:PG24", level: 3 },
    { id: 'entropy', name: 'Круг Энтропии', description: 'Друид упадка и разрушения, видящий красоту в неизбежном конце.', source: "GH:PG24", level: 3 },
    { id: 'mutation', name: 'Круг Мутации', description: 'Друид, верящий в необходимость улучшения природы через мутации.', source: "GH:PG24", level: 3 },
  ],
  proficiencies: {
    armor: ['Лёгкие доспехи', 'Щиты'],
    weapons: ['Простое оружие'],
    tools: ['Набор травника'],
    skillChoices: { count: 2, from: ['arcana', 'animalHandling', 'insight', 'medicine', 'nature', 'perception', 'religion', 'survival'] },
  },
};
