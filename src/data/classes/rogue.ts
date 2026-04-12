import type { ClassDefinition } from './types';

export const rogue: ClassDefinition = {
  id: 'rogue',
  name: 'Rogue',
  hitDie: 'd8',
  primaryAbility: ['dexterity'],
  savingThrows: ['dexterity', 'intelligence'],
  spellcaster: false,
  description: 'A nimble specialist relying on cunning and precise strikes. A master of stealth and deception.',
  source: "Player's Handbook",
  subclasses: [
    { id: 'thief', name: 'Thief', description: 'A master of infiltration and sleight of hand.', source: 'PHB', level: 3 },
    { id: 'assassin', name: 'Assassin', description: 'A deadly agent, master of surprise attacks.', source: 'PHB', level: 3 },
    { id: 'arcane-trickster', name: 'Arcane Trickster', description: 'A rogue who has mastered illusion and enchantment magic.', source: 'PHB', level: 3 },
    { id: 'swashbuckler', name: 'Swashbuckler', description: 'A daring swordsman with charisma and grace.', source: "Xanathar's Guide", level: 3 },
    { id: 'phantom', name: 'Phantom', description: 'A rogue connected to the world of the dead.', source: "Tasha's Cauldron", level: 3 },
    { id: 'soulknife', name: 'Soulknife', description: 'Uses psionic energy to create blades.', source: "Tasha's Cauldron", level: 3 },
    { id: 'highway-rider', name: 'Highway Rider', description: 'A Steed Makes the Best Partner in Crime', source: "GH:PG'24", level: 3 },
    { id: 'inquisitive', name: 'Inquisitive', description: 'Root Out Secrets and Unravel Mysteries', source: 'XGE', level: 3 },
    { id: 'mastermind', name: 'Mastermind', description: 'Master of Intrigue and Manipulation', source: 'XGE', level: 3 },
    { id: 'misfortune-bringer', name: 'Misfortune Bringer', description: "Curse Those You're About to Strike", source: "GH:PG'24", level: 3 },
    { id: 'sanguine-thief', name: 'Sanguine Thief', description: 'Eliminate Your Prey with Blood Magic', source: "GH:PG'24", level: 3 },
    { id: 'scion-of-the-three', name: 'Scion of the Three', description: 'Channel the Power of the Dead Three', source: 'FRHoF', level: 3 },
    { id: 'scout', name: 'Scout', description: 'Scout Ahead with Wilderness Expertise', source: 'XGE', level: 3 },
  ],
  proficiencies: {
    armor: ['light'],
    weapons: ['simple', 'hand crossbow', 'longsword', 'rapier', 'shortsword'],
    tools: ['thieves_tools'],
    skillChoices: { count: 4, from: ['acrobatics', 'athletics', 'deception', 'insight', 'intimidation', 'investigation', 'perception', 'performance', 'persuasion', 'sleightOfHand', 'stealth'] },
  },
};
