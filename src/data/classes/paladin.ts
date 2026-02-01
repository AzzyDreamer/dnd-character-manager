import type { ClassDefinition } from './types';

export const paladin: ClassDefinition = {
  id: 'paladin',
  name: 'Паладин',
  hitDie: 'd10',
  primaryAbility: ['strength', 'charisma'],
  savingThrows: ['wisdom', 'charisma'],
  spellcaster: true,
  spellcastingAbility: 'charisma',
  description: 'Святой воин, связанный священной клятвой. Сочетает божественную магию с боевым мастерством.',
  source: "Player's Handbook",
  subclasses: [
    { id: 'devotion', name: 'Клятва Преданности', description: 'Идеал рыцарства и справедливости.', source: 'PHB', level: 3 },
    { id: 'ancients', name: 'Клятва Древних', description: 'Защитник света и живого мира.', source: 'PHB', level: 3 },
    { id: 'vengeance', name: 'Клятва Мести', description: 'Неутомимый каратель, преследующий зло.', source: 'PHB', level: 3 },
    { id: 'conquest', name: 'Клятва Завоевания', description: 'Воин, подавляющий врагов страхом и силой.', source: "Xanathar's Guide", level: 3 },
    { id: 'redemption', name: 'Клятва Искупления', description: 'Миротворец, стремящийся спасти даже злодеев.', source: "Xanathar's Guide", level: 3 },
    { id: 'oathbreaker', name: 'Клятвопреступник', description: 'Падший паладин, черпающий силу из тьмы.', source: 'DMG', level: 3 },
  ],
  proficiencies: {
    armor: ['Все доспехи', 'Щиты'],
    weapons: ['Простое оружие', 'Воинское оружие'],
    tools: [],
    skillChoices: { count: 2, from: ['athletics', 'insight', 'intimidation', 'medicine', 'persuasion', 'religion'] },
  },
};
