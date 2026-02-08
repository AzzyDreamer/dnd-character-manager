import type { ClassDefinition } from './types';

export const cleric: ClassDefinition = {
  id: 'cleric',
  name: 'Жрец',
  hitDie: 'd8',
  primaryAbility: ['wisdom'],
  savingThrows: ['wisdom', 'charisma'],
  spellcaster: true,
  spellcastingAbility: 'wisdom',
  description: 'Божественный заклинатель, служащий высшей силе. Целитель и защитник веры.',
  source: "Player's Handbook",
  subclasses: [
    { id: 'life', name: 'Домен Жизни', description: 'Непревзойдённый целитель, благословлённый силой исцеления.', source: 'PHB', level: 3 },
    { id: 'light', name: 'Домен Света', description: 'Несёт свет и огонь, изгоняя тьму.', source: 'PHB', level: 3 },
    { id: 'tempest', name: 'Домен Бури', description: 'Повелевает грозами и разрушительными стихиями.', source: 'PHB', level: 3 },
    { id: 'war', name: 'Домен Войны', description: 'Воитель веры, благословлённый на битву.', source: 'PHB', level: 3 },
    { id: 'knowledge', name: 'Домен Знаний', description: 'Хранитель тайного знания и мудрости.', source: 'PHB', level: 3 },
    { id: 'trickery', name: 'Домен Обмана', description: 'Агент хаоса, мастер иллюзий и хитрости.', source: 'PHB', level: 3 },
    { id: 'forge', name: 'Домен Кузни', description: 'Мастер огня и металла, создатель магических предметов.', source: "Xanathar's Guide", level: 3 },
    { id: 'grave', name: 'Домен Могилы', description: 'Страж границы между жизнью и смертью.', source: "Xanathar's Guide", level: 3 },
  ],
  proficiencies: {
    armor: ['Лёгкие доспехи', 'Средние доспехи', 'Щиты'],
    weapons: ['Простое оружие'],
    tools: [],
    skillChoices: { count: 2, from: ['history', 'insight', 'medicine', 'persuasion', 'religion'] },
  },
};
