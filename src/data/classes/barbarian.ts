import type { ClassDefinition } from './types';

export const barbarian: ClassDefinition = {
  id: 'barbarian',
  name: 'Barbarian',
  hitDie: 'd12',
  primaryAbility: ['strength'],
  savingThrows: ['strength', 'constitution'],
  spellcaster: false,
  description: 'A fierce warrior drawing strength from primal rage. Enters a state of unstoppable fury in battle.',
  source: "Player's Handbook",
  subclasses: [
    { id: 'berserker', name: 'Path of the Berserker', description: 'Unbridled rage that lets you fight to the last breath.', source: 'PHB', level: 3 },
    { id: 'totem-warrior', name: 'Path of the Totem Warrior', description: 'A spiritual path binding the barbarian to a totem animal.', source: 'PHB', level: 3 },
    { id: 'ancestral-guardian', name: 'Path of the Ancestral Guardian', description: 'Summons ancestral spirits to protect allies.', source: "Xanathar's Guide", level: 3 },
    { id: 'storm-herald', name: 'Path of the Storm Herald', description: 'Barbarian rage spawns a magical elemental aura.', source: "Xanathar's Guide", level: 3 },
    { id: 'zealot', name: 'Path of the Zealot', description: 'A warrior filled with divine fury and resilience.', source: "Xanathar's Guide", level: 3 },
    { id: 'battlerager', name: 'Path of the Battlerager', description: 'Fight in Spiked Armor', source: 'SCAG', level: 3 },
    { id: 'beast', name: 'Path of the Beast', description: 'Transform into a Bestial Form', source: 'TCE', level: 3 },
    { id: 'fractured', name: 'Path of the Fractured', description: 'Two Personalities Are Better than One', source: "GH:PG'24", level: 3 },
    { id: 'giant', name: 'Path of the Giant', description: 'Channel the Primal Might of Giants', source: 'BGG', level: 3 },
    { id: 'primal-spirit', name: 'Path of the Primal Spirit', description: 'Rage Alongside a Bestial Spirit', source: "GH:PG'24", level: 3 },
    { id: 'wild-heart', name: 'Path of the Wild Heart', description: 'Walk in Community with the Animal World', source: "PHB'24", level: 3 },
    { id: 'wild-magic', name: 'Path of Wild Magic', description: 'Channel Wild Magic through Rage', source: 'TCE', level: 3 },
    { id: 'world-tree', name: 'Path of the World Tree', description: 'Trace the Roots and Branches of the Multiverse', source: "PHB'24", level: 3 },
    { id: 'wrathful-dead', name: 'Path of the Wrathful Dead', description: 'Channel the Rage of the Unquiet Dead', source: "GH:PG'24", level: 3 },
  ],
  proficiencies: {
    armor: ['light', 'medium', 'shield'],
    weapons: ['simple', 'martial'],
    tools: [],
    skillChoices: { count: 2, from: ['animalHandling', 'athletics', 'intimidation', 'nature', 'perception', 'survival'] },
  },
};
