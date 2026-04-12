import type { ClassDefinition } from './types';

export const druid: ClassDefinition = {
  id: 'druid',
  name: 'Druid',
  hitDie: 'd8',
  primaryAbility: ['wisdom'],
  savingThrows: ['intelligence', 'wisdom'],
  spellcaster: true,
  spellcastingAbility: 'wisdom',
  description: 'A guardian of nature, drawing magic from the primordial forces of the world. Can take the form of beasts.',
  source: "Player's Handbook",
  subclasses: [
    { id: 'land', name: 'Circle of the Land', description: 'A mystic bound to a particular terrain.', source: 'PHB', level: 3 },
    { id: 'moon', name: 'Circle of the Moon', description: 'A master of wild shape, able to transform into mighty beasts.', source: 'PHB', level: 3 },
    { id: 'shepherd', name: 'Circle of the Shepherd', description: 'A summoner of nature spirits and protector of animals.', source: "Xanathar's Guide", level: 3 },
    { id: 'spores', name: 'Circle of Spores', description: 'Commands the forces of decay and renewal.', source: "Tasha's Cauldron", level: 3 },
    { id: 'blood', name: 'Circle of Blood', description: 'Wreak Bloody Havoc', source: "GH:PG'24", level: 3 },
    { id: 'dreams', name: 'Circle of Dreams', description: 'Feywild-Connected Healer of Dreams', source: 'XGE', level: 3 },
    { id: 'entropy', name: 'Circle of Entropy', description: 'Become an Instrument of Decay and Ruin', source: "GH:PG'24", level: 3 },
    { id: 'mutation', name: 'Circle of Mutation', description: 'Mutate Into an Apex Predator', source: "GH:PG'24", level: 3 },
    { id: 'sea', name: 'Circle of the Sea', description: 'Become One with Tides and Storms', source: "PHB'24", level: 3 },
    { id: 'stars', name: 'Circle of the Stars', description: 'Harness Secrets Hidden in Constellations', source: "PHB'24", level: 3 },
    { id: 'wildfire', name: 'Circle of Wildfire', description: 'Destruction Brings Renewal Through Fire', source: 'TCE', level: 3 },
  ],
  proficiencies: {
    armor: ['light', 'medium', 'shieldNonmetal'],
    weapons: ['club', 'dagger', 'dart', 'spear', 'mace', 'quarterstaff', 'sickle', 'sling'],
    tools: ['herbalism_kit'],
    skillChoices: { count: 2, from: ['arcana', 'animalHandling', 'insight', 'medicine', 'nature', 'perception', 'religion', 'survival'] },
  },
};
