import type { ClassDefinition } from './types';

export const fighter: ClassDefinition = {
  id: 'fighter',
  name: 'Fighter',
  hitDie: 'd10',
  primaryAbility: ['strength', 'dexterity'],
  savingThrows: ['strength', 'constitution'],
  spellcaster: false,
  description: 'A master of martial combat, proficient with any weapon and armor. An unmatched tactician.',
  source: "Player's Handbook",
  subclasses: [
    { id: 'champion', name: 'Champion', description: 'A perfect athlete with improved critical hits.', source: 'PHB', level: 3 },
    { id: 'battle-master', name: 'Battle Master', description: 'Master Sophisticated Battle Maneuvers', source: "PHB'24", level: 3 },
    { id: 'eldritch-knight', name: 'Eldritch Knight', description: 'A warrior combining swordplay with magic.', source: 'PHB', level: 3 },
    { id: 'samurai', name: 'Samurai', description: 'A warrior with unyielding will and deadly precision.', source: "Xanathar's Guide", level: 3 },
    { id: 'echo-knight', name: 'Echo Knight', description: 'Summons an echo from a parallel reality for combat.', source: "Explorer's Guide to Wildemount", level: 3 },
    { id: 'arcane-archer', name: 'Arcane Archer', description: 'Weave Magic into Archery Attacks', source: 'XGE', level: 3 },
    { id: 'banneret', name: 'Banneret', description: 'Rally Fellow Heroes with Inspiring Leadership', source: 'FRMoF', level: 3 },
    { id: 'bulwark-warrior', name: 'Bulwark Warrior', description: 'Provoke Your Enemies, Protect Your Allies', source: "GH PG'24", level: 3 },
    { id: 'cavalier', name: 'Cavalier', description: 'Excel at Mounted Combat', source: 'XGE', level: 3 },
    { id: 'living-crucible', name: 'Living Crucible', description: 'Enhance Your Martial Prowess with Alchemy', source: "GH PG'24", level: 3 },
    { id: 'nightwatcher', name: 'Nightwatcher', description: 'Take Back the Night', source: "GH PG'24", level: 3 },
    { id: 'psi-warrior', name: 'Psi Warrior', description: 'Augment Physical Might with Psionic Power', source: "PHB'24", level: 3 },
    { id: 'rune-knight', name: 'Rune Knight', description: 'Enhance Equipment with Giant Rune Magic', source: 'TCE', level: 3 },
  ],
  proficiencies: {
    armor: ['all', 'shield'],
    weapons: ['simple', 'martial'],
    tools: [],
    skillChoices: { count: 2, from: ['acrobatics', 'animalHandling', 'athletics', 'history', 'insight', 'intimidation', 'perception', 'survival'] },
  },
};
