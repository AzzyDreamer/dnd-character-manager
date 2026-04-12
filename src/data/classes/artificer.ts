import type { ClassDefinition } from './types';

export const artificer: ClassDefinition = {
  id: 'artificer',
  name: 'Artificer',
  hitDie: 'd8',
  primaryAbility: ['intelligence'],
  savingThrows: ['constitution', 'intelligence'],
  spellcaster: true,
  spellcastingAbility: 'intelligence',
  description: 'A master of magical inventions, weaving spells into objects. Creates devices, weapons, and armor with magical properties.',
  source: "Tasha's Cauldron of Everything",
  subclasses: [
    { id: 'alchemist', name: 'Alchemist', description: 'Creates magical elixirs and potions with wondrous properties.', source: "Tasha's Cauldron", level: 3 },
    { id: 'armorer', name: 'Armorer', description: 'Transforms armor into a powerful magical exoskeleton.', source: "Tasha's Cauldron", level: 3 },
    { id: 'artillerist', name: 'Artillerist', description: 'Creates magical cannon-constructs for fire support.', source: "Tasha's Cauldron", level: 3 },
    { id: 'battle-smith', name: 'Battle Smith', description: 'Fights alongside a steel defender construct.', source: "Tasha's Cauldron", level: 3 },
    { id: 'cartographer', name: 'Cartographer', description: 'Chart Advantageous Courses through Turmoil', source: 'EFA', level: 3 },
  ],
  proficiencies: {
    armor: ['light', 'medium', 'shield'],
    weapons: ['simple'],
    tools: ['thieves_tools', 'artisan_tools', 'alchemist_supplies'],
    skillChoices: { count: 2, from: ['arcana', 'history', 'investigation', 'medicine', 'nature', 'perception', 'sleightOfHand'] },
  },
};
