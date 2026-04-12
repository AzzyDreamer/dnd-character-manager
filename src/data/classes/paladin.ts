import type { ClassDefinition } from './types';

export const paladin: ClassDefinition = {
  id: 'paladin',
  name: 'Paladin',
  hitDie: 'd10',
  primaryAbility: ['strength', 'charisma'],
  savingThrows: ['wisdom', 'charisma'],
  spellcaster: true,
  spellcastingAbility: 'charisma',
  description: 'A holy warrior bound by a sacred oath. Combines divine magic with martial prowess.',
  source: "Player's Handbook",
  subclasses: [
    { id: 'devotion', name: 'Oath of Devotion', description: 'The ideal of knighthood and justice.', source: 'PHB', level: 3 },
    { id: 'ancients', name: 'Oath of the Ancients', description: 'A defender of light and the living world.', source: 'PHB', level: 3 },
    { id: 'vengeance', name: 'Oath of Vengeance', description: 'A tireless avenger pursuing evil.', source: 'PHB', level: 3 },
    { id: 'conquest', name: 'Oath of Conquest', description: 'A warrior who crushes foes with fear and might.', source: "Xanathar's Guide", level: 3 },
    { id: 'redemption', name: 'Oath of Redemption', description: 'A peacemaker seeking to save even villains.', source: "Xanathar's Guide", level: 3 },
    { id: 'oathbreaker', name: 'Oathbreaker', description: 'A fallen paladin drawing power from darkness.', source: 'DMG', level: 3 },
    { id: 'crown', name: 'Oath of the Crown', description: 'Serve Law and Civilization', source: 'SCAG', level: 3 },
    { id: 'glory', name: 'Oath of Glory', description: 'Strive for the Heights of Heroism', source: "PHB'24", level: 3 },
    { id: 'noble-genie', name: 'Oath of the Noble Genie', description: 'Draw Power from Elemental Genies', source: 'FRHoF', level: 3 },
    { id: 'pestilence', name: 'Oath of Pestilence', description: 'Gain Strength Through Suffering', source: "GH:PG'24", level: 3 },
    { id: 'slaughter', name: 'Oath of Slaughter', description: 'Revel in Unbridled Violence', source: "GH:PG'24", level: 3 },
    { id: 'watchers', name: 'Oath of the Watchers', description: 'Guard against Extraplanar Threats', source: 'TCE', level: 3 },
    { id: 'zeal', name: 'Oath of Zeal', description: 'Root Out Heresy and Corruption', source: "GH:PG'24", level: 3 },
  ],
  proficiencies: {
    armor: ['all', 'shield'],
    weapons: ['simple', 'martial'],
    tools: [],
    skillChoices: { count: 2, from: ['athletics', 'insight', 'intimidation', 'medicine', 'persuasion', 'religion'] },
  },
};
