import type { ClassDefinition } from './types';

export const warlock: ClassDefinition = {
  id: 'warlock',
  name: 'Warlock',
  hitDie: 'd8',
  primaryAbility: ['charisma'],
  savingThrows: ['wisdom', 'charisma'],
  spellcaster: true,
  spellcastingAbility: 'charisma',
  description: 'A mage who has made a pact with a powerful entity. Gains unique powers from their patron.',
  source: "Player's Handbook",
  subclasses: [
    { id: 'archfey', name: 'The Archfey', description: 'A patron from the Feywild with enchanting magic.', source: 'PHB', level: 3 },
    { id: 'fiend', name: 'The Fiend', description: 'A pact with a demon or devil granting destructive power.', source: 'PHB', level: 3 },
    { id: 'great-old-one', name: 'The Great Old One', description: 'Contact with an incomprehensible entity from the depths of the cosmos.', source: 'PHB', level: 3 },
    { id: 'celestial', name: 'The Celestial', description: 'A patron from the upper planes granting healing power.', source: "Xanathar's Guide", level: 3 },
    { id: 'hexblade', name: 'Hexblade', description: 'A pact with a mysterious weapon from the Shadowfell.', source: "Xanathar's Guide", level: 3 },
    { id: 'fathomless', name: 'The Fathomless', description: 'A patron from the ocean depths with dark water magic.', source: "Tasha's Cauldron", level: 3 },
    { id: 'coven', name: 'The Coven', description: 'Curse and Befuddle with Hag Magic', source: "GH:PG'24", level: 3 },
    { id: 'first-vampire', name: 'The First Vampire', description: 'Wield the Power of Undeath', source: "GH:PG'24", level: 3 },
    { id: 'genie', name: 'The Genie', description: 'Bargain with a Noble Genie', source: 'TCE', level: 3 },
    { id: 'parasite', name: 'The Parasite', description: 'Become One with a Cosmic Being', source: "GH:PG'24", level: 3 },
    { id: 'undead', name: 'The Undead', description: 'Defy the Cycle of Life and Death', source: 'VRGR', level: 3 },
    { id: 'undying', name: 'The Undying', description: 'Unlock the Secrets of Everlasting Life', source: 'SCAG', level: 3 },
  ],
  proficiencies: {
    armor: ['light'],
    weapons: ['simple'],
    tools: [],
    skillChoices: { count: 2, from: ['arcana', 'deception', 'history', 'intimidation', 'investigation', 'nature', 'religion'] },
  },
};
