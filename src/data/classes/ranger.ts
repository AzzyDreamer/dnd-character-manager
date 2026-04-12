import type { ClassDefinition } from './types';

export const ranger: ClassDefinition = {
  id: 'ranger',
  name: 'Ranger',
  hitDie: 'd10',
  primaryAbility: ['dexterity', 'wisdom'],
  savingThrows: ['strength', 'dexterity'],
  spellcaster: true,
  spellcastingAbility: 'wisdom',
  description: 'A warrior of the wild, master of survival and tracking. An unmatched hunter.',
  source: "Player's Handbook",
  subclasses: [
    { id: 'hunter', name: 'Hunter', description: 'A master of hunting dangerous prey.', source: 'PHB', level: 3 },
    { id: 'beast-master', name: 'Beast Master', description: 'Fights alongside a loyal animal companion.', source: 'PHB', level: 3 },
    { id: 'gloom-stalker', name: 'Gloom Stalker', description: 'A hunter in darkness, invisible to foes.', source: "Xanathar's Guide", level: 3 },
    { id: 'horizon-walker', name: 'Horizon Walker', description: 'A guardian between the planes of existence.', source: "Xanathar's Guide", level: 3 },
    { id: 'swarmkeeper', name: 'Swarmkeeper', description: 'Commands a swarm of nature spirits.', source: "Tasha's Cauldron", level: 3 },
    { id: 'drakewarden', name: 'Drakewarden', description: 'Channel the Power of Dragons', source: 'FToD', level: 3 },
    { id: 'fey-wanderer', name: 'Fey Wanderer', description: 'Wield Fey Mirth and Fury', source: "PHB'24", level: 3 },
    { id: 'green-reaper', name: 'Green Reaper', description: "Slay with Nature's Venom", source: "GHPg'24", level: 3 },
    { id: 'monster-slayer', name: 'Monster Slayer', description: 'Hunt Down Creatures of the Night', source: 'XGE', level: 3 },
    { id: 'primordial-archer', name: 'Primordial Archer', description: 'Channel the Wrath of the Wilds', source: "GHPg'24", level: 3 },
    { id: 'vermin-lord', name: 'Vermin Lord', description: 'Grow Powerful from Strength in Numbers', source: "GHPg'24", level: 3 },
    { id: 'winter-walker', name: 'Winter Walker', description: 'Withstand the Horrors of Frigid Wastelands', source: 'FRiME', level: 3 },
  ],
  proficiencies: {
    armor: ['light', 'medium', 'shield'],
    weapons: ['simple', 'martial'],
    tools: [],
    skillChoices: { count: 3, from: ['animalHandling', 'athletics', 'insight', 'investigation', 'nature', 'perception', 'stealth', 'survival'] },
  },
};
