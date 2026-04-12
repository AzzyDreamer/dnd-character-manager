import type { ClassDefinition } from './types';

export const bard: ClassDefinition = {
  id: 'bard',
  name: 'Bard',
  hitDie: 'd8',
  primaryAbility: ['charisma'],
  savingThrows: ['dexterity', 'charisma'],
  spellcaster: true,
  spellcastingAbility: 'charisma',
  description: 'An inspiring mage whose power springs from music and words. A jack of all trades.',
  source: "Player's Handbook",
  subclasses: [
    { id: 'lore', name: 'College of Lore', description: 'A collector of knowledge with diverse skills.', source: 'PHB', level: 3 },
    { id: 'valor', name: 'College of Valor', description: 'A warlike bard inspiring allies to great deeds.', source: 'PHB', level: 3 },
    { id: 'glamour', name: 'College of Glamour', description: 'An enchanting bard with Feywild magic.', source: "Xanathar's Guide", level: 3 },
    { id: 'swords', name: 'College of Swords', description: 'A blade master combining swordplay with magic.', source: "Xanathar's Guide", level: 3 },
    { id: 'whispers', name: 'College of Whispers', description: 'A secret agent wielding fears and secrets.', source: "Xanathar's Guide", level: 3 },
    { id: 'adventurers', name: 'College of Adventurers', description: 'Be a Master of Classes', source: "GH:PG'24", level: 3 },
    { id: 'creation', name: 'College of Creation', description: 'Draw on the Song of Creation', source: 'TCE', level: 3 },
    { id: 'dance', name: 'College of Dance', description: 'Move in Harmony with the Cosmos', source: "PHB'24", level: 3 },
    { id: 'eloquence', name: 'College of Eloquence', description: 'Master the Art of Oratory', source: 'TCE', level: 3 },
    { id: 'fools', name: 'College of Fools', description: "Laugh at Your Foes' Terror", source: "GH:PG'24", level: 3 },
    { id: 'moon', name: 'College of the Moon', description: 'Weave Moonlight into Performance', source: 'FRHoF', level: 3 },
    { id: 'requiems', name: 'College of Requiems', description: 'Sing the Songs of the Dead', source: "GH:PG'24", level: 3 },
    { id: 'spirits', name: 'College of Spirits', description: 'Seek Tales with Inherent Power', source: 'VRGR', level: 3 },
  ],
  proficiencies: {
    armor: ['light'],
    weapons: ['simple', 'hand crossbow', 'longsword', 'rapier', 'shortsword'],
    tools: ['three_musical_instruments'],
    skillChoices: { count: 3, from: ['acrobatics', 'animalHandling', 'arcana', 'athletics', 'deception', 'history', 'insight', 'intimidation', 'investigation', 'medicine', 'nature', 'perception', 'performance', 'persuasion', 'religion', 'sleightOfHand', 'stealth', 'survival'] },
  },
};
