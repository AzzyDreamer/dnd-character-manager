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
    { id: 'crimson-order', name: 'Кровавый Орден', description: 'Использует запретную кровавую магию, жертвуя собственной жизненной силой для уничтожения монстров.', source: "Grim Hollow", level: 3 },
    { id: 'silver-order', name: 'Серебряный Орден', description: 'Мастер серебряного оружия и святых ритуалов, специализирующийся на охоте на нежить и оборотней.', source: "Grim Hollow", level: 3 },
    { id: 'twilight-order', name: 'Сумеречный Орден', description: 'Охотник из теней, мастер засад и скрытных операций против тёмных тварей.', source: "Grim Hollow", level: 3 },
    { id: 'pyre-order', name: 'Орден Костра', description: 'Повелевает очищающим пламенем, выжигая скверну и проклятия из мира.', source: "Grim Hollow", level: 3 },
  ],
  proficiencies: {
    armor: ['Лёгкие доспехи', 'Средние доспехи'],
    weapons: ['Простое оружие', 'Воинское оружие'],
    tools: ['Набор алхимика', 'Набор травника'],
    skillChoices: { count: 3, from: ['arcana', 'athletics', 'insight', 'investigation', 'medicine', 'nature', 'perception', 'religion', 'stealth', 'survival'] },
  },
};
