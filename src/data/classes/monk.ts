import type { ClassDefinition } from './types';

export const monk: ClassDefinition = {
  id: 'monk',
  name: 'Monk',
  hitDie: 'd8',
  primaryAbility: ['dexterity', 'wisdom'],
  savingThrows: ['strength', 'dexterity'],
  spellcaster: false,
  description: 'A martial arts master who uses inner ki energy for incredible feats.',
  source: "Player's Handbook",
  subclasses: [
    { id: 'open-hand', name: 'Way of the Open Hand', description: 'A master of unarmed combat with devastating techniques.', source: 'PHB', level: 3 },
    { id: 'shadow', name: 'Way of Shadow', description: 'A shadow warrior, master of stealth and dark arts.', source: 'PHB', level: 3 },
    { id: 'elements', name: 'Warrior of the Elements', description: 'Wield Bursts of Elemental Power', source: "PHB'24", level: 3 },
    { id: 'kensei', name: 'Way of the Kensei', description: 'A weapon master who makes the blade an extension of self.', source: "Xanathar's Guide", level: 3 },
    { id: 'mercy', name: 'Way of Mercy', description: 'A healer and warrior who manipulates life energy.', source: "Tasha's Cauldron", level: 3 },
    { id: 'ascendant-dragon', name: 'Way of the Ascendant Dragon', description: 'Emulate the Power of Dragons', source: 'FTD', level: 3 },
    { id: 'astral-self', name: 'Way of the Astral Self', description: 'Manifest Your Astral True Self', source: 'TCE', level: 3 },
    { id: 'drunken-master', name: 'Way of the Drunken Master', description: 'Use Unpredictable Drunken Combat', source: 'XGE', level: 3 },
    { id: 'leaden-crown', name: 'Warrior of the Leaden Crown', description: 'Harness the Will to Resist', source: "GHPG'24", level: 3 },
    { id: 'long-death', name: 'Way of the Long Death', description: 'Study Death to Master Combat', source: 'SCAG', level: 3 },
    { id: 'pride', name: 'Warrior of Pride', description: 'Prove Your Superiority', source: "GHPG'24", level: 3 },
    { id: 'regret', name: 'Warrior of Regret', description: 'Atone for Past Mistakes', source: "GHPG'24", level: 3 },
    { id: 'sun-soul', name: 'Way of the Sun Soul', description: 'Channel Life Energy into Radiant Light', source: 'XGE', level: 3 },
  ],
  proficiencies: {
    armor: [],
    weapons: ['simple', 'shortsword'],
    tools: ['one_artisan_or_musical'],
    skillChoices: { count: 2, from: ['acrobatics', 'athletics', 'history', 'insight', 'religion', 'stealth'] },
  },
};
