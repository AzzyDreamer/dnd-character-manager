import type { ClassDefinition } from './types';

export const monsterHunter: ClassDefinition = {
  id: 'monster-hunter',
  name: 'Monster Hunter',
  hitDie: 'd10',
  primaryAbility: ['wisdom', 'dexterity'],
  savingThrows: ['dexterity', 'wisdom'],
  spellcaster: true,
  spellcastingAbility: 'wisdom',
  description: 'A hardened hunter devoted to destroying supernatural threats. Uses monster knowledge and ancient techniques to track and eliminate creatures of darkness.',
  source: "Grim Hollow: Player's Guide (2024)",
  subclasses: [
    { id: 'carver', name: 'Carver Guild', description: 'Slay Monsters Fearlessly and Recklessly', source: "GH:PG'24", level: 3 },
    { id: 'devourer', name: 'Devourer Guild', description: 'Gain Power by Consuming Monster Flesh', source: "GH:PG'24", level: 3 },
    { id: 'occultist', name: 'Occultist Guild', description: 'Hunt Mages and Magical Adversaries', source: "GH:PG'24", level: 3 },
    { id: 'trapper', name: 'Trapper Guild', description: 'Dispatch Monsters with Cunning Traps', source: "GH:PG'24", level: 3 },
  ],
  proficiencies: {
    armor: ['light', 'medium'],
    weapons: ['simple', 'martial'],
    tools: ['alchemist_supplies', 'herbalism_kit'],
    skillChoices: { count: 3, from: ['arcana', 'athletics', 'insight', 'investigation', 'medicine', 'nature', 'perception', 'religion', 'stealth', 'survival'] },
  },
};
