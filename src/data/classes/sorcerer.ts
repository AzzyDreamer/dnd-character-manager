import type { ClassDefinition } from './types';

export const sorcerer: ClassDefinition = {
  id: 'sorcerer',
  name: 'Sorcerer',
  hitDie: 'd6',
  primaryAbility: ['charisma'],
  savingThrows: ['constitution', 'charisma'],
  spellcaster: true,
  spellcastingAbility: 'charisma',
  description: 'An innate mage whose power flows from blood or destiny. Controls raw magical energy.',
  source: "Player's Handbook",
  subclasses: [
    { id: 'draconic', name: 'Draconic Bloodline', description: 'The magic of ancient dragons flows through your veins.', source: 'PHB', level: 3 },
    { id: 'wild-magic', name: 'Wild Magic', description: 'A chaotic force, unpredictable and destructive.', source: 'PHB', level: 3 },
    { id: 'divine-soul', name: 'Divine Soul', description: 'A divine spark grants access to clerical spells.', source: "Xanathar's Guide", level: 3 },
    { id: 'shadow', name: 'Shadow Magic', description: 'A connection to the Shadowfell grants dark power.', source: "Xanathar's Guide", level: 3 },
    { id: 'aberrant-mind', name: 'Aberrant Mind', description: 'Psionic power from contact with alien entities.', source: "Tasha's Cauldron", level: 3 },
    { id: 'clockwork-soul', name: 'Clockwork Soul', description: 'The power of order from Mechanus flows through you.', source: "Tasha's Cauldron", level: 3 },
    { id: 'apocalypse', name: 'Apocalypse', description: 'Hasten or Stall the End of the World', source: "GH:PG'24", level: 3 },
    { id: 'haunted', name: 'Haunted', description: 'Commune with the Dead', source: "GH:PG'24", level: 3 },
    { id: 'lunar', name: 'Lunar Sorcery', description: 'Channel the Magic of the Moon', source: 'DSotDQ', level: 1 },
    { id: 'spellfire', name: 'Spellfire', description: 'Wield Raw Magic', source: 'FRHoF', level: 3 },
    { id: 'storm', name: 'Storm Sorcery', description: 'Command the Power of the Storm', source: 'XGE', level: 1 },
    { id: 'wretched', name: 'Wretched', description: 'Wield Your Curse Like a Weapon', source: "GH:PG'24", level: 3 },
  ],
  proficiencies: {
    armor: [],
    weapons: ['dagger', 'dart', 'sling', 'quarterstaff', 'light crossbow'],
    tools: [],
    skillChoices: { count: 2, from: ['arcana', 'deception', 'insight', 'intimidation', 'persuasion', 'religion'] },
  },
};
