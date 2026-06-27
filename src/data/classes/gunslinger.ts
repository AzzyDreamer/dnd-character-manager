import type { ClassDefinition } from './types';

export const gunslinger: ClassDefinition = {
  id: 'gunslinger',
  name: 'Gunslinger',
  hitDie: 'd8',
  primaryAbility: ['dexterity'],
  savingThrows: ['dexterity', 'charisma'],
  spellcaster: false,
  description: 'A master of firearms, combining lightning reflexes, precise shooting, and daring maneuvers.',
  source: "GC:VSS'24",
  subclasses: [
    { id: 'deadeye', name: 'Deadeye', description: 'Shoot with Bullseye Precision', source: "GC:VSS'24", level: 3 },
    { id: 'high-roller', name: 'High Roller', description: 'Gamble with Life and Death', source: "GC:VSS'24", level: 3 },
    { id: 'secret-agent', name: 'Secret Agent', description: 'Engage in Espionage and Assassination', source: "GC:VSS'24", level: 3 },
    { id: 'spellslinger', name: 'Spellslinger', description: 'Complement Your Gunslinging with Arcana', source: "GC:VSS'24", level: 3 },
    { id: 'trick-shot', name: 'Trick Shot', description: 'Ricochet Bullets from Every Angle', source: "GC:VSS'24", level: 3 },
    { id: 'white-hat', name: 'White Hat', description: 'Protect Your Allies and Uphold the Law', source: "GC:VSS'24", level: 3 },
  ],
  proficiencies: {
    armor: ['light'],
    weapons: ['simple', 'rangedMartial', 'firearms'],
    tools: [],
    skillChoices: { count: 2, from: ['acrobatics', 'animalHandling', 'athletics', 'deception', 'insight', 'intimidation', 'perception', 'persuasion', 'sleightOfHand', 'stealth'] },
  },
};
