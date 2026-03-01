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
    { id: 'crown', name: 'Клятва Короны', description: 'Serve Law and Civilization', source: 'SCAG', level: 3 },
    { id: 'glory', name: 'Клятва Славы', description: 'Strive for the Heights of Heroism', source: "PHB'24", level: 3 },
    { id: 'noble-genie', name: 'Клятва Благородных Джиннов', description: 'Draw Power from Elemental Genies', source: 'FRHoF', level: 3 },
    { id: 'pestilence', name: 'Клятва Чумы', description: 'Gain Strength Through Suffering', source: "GH:PG'24", level: 3 },
    { id: 'slaughter', name: 'Клятва Бойни', description: 'Revel in Unbridled Violence', source: "GH:PG'24", level: 3 },
    { id: 'watchers', name: 'Клятва Стражей', description: 'Guard against Extraplanar Threats', source: 'TCE', level: 3 },
    { id: 'zeal', name: 'Клятва Рвения', description: 'Root Out Heresy and Corruption', source: "GH:PG'24", level: 3 },
  ],
  proficiencies: {
    armor: ['Все доспехи', 'Щиты'],
    weapons: ['Простое оружие', 'Воинское оружие'],
    tools: [],
    skillChoices: { count: 2, from: ['athletics', 'insight', 'intimidation', 'medicine', 'persuasion', 'religion'] },
  },
};
