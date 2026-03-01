import type { ClassDefinition } from './types';

export const gunslinger: ClassDefinition = {
  id: 'gunslinger',
  name: 'Стрелок',
  hitDie: 'd8',
  primaryAbility: ['dexterity'],
  savingThrows: ['dexterity', 'charisma'],
  spellcaster: false,
  description: 'Стрелок — мастер огнестрельного оружия, сочетающий молниеносную реакцию, точную стрельбу и дерзкие манёвры.',
  source: "GC:VSS'24",
  subclasses: [
    { id: 'deadeye', name: 'Меткий Стрелок', description: 'Shoot with Bullseye Precision', source: "GC:VSS'24", level: 3 },
    { id: 'high-roller', name: 'Азартный Игрок', description: 'Gamble with Life and Death', source: "GC:VSS'24", level: 3 },
    { id: 'secret-agent', name: 'Тайный Агент', description: 'Engage in Espionage and Assassination', source: "GC:VSS'24", level: 3 },
    { id: 'spellslinger', name: 'Заклинатель', description: 'Complement Your Gunslinging with Arcana', source: "GC:VSS'24", level: 3 },
    { id: 'trick-shot', name: 'Трюкач', description: 'Ricochet Bullets from Every Angle', source: "GC:VSS'24", level: 3 },
    { id: 'white-hat', name: 'Белая Шляпа', description: 'Protect Your Allies and Uphold the Law', source: "GC:VSS'24", level: 3 },
  ],
  proficiencies: {
    armor: ['Лёгкие доспехи'],
    weapons: ['Простое оружие', 'Дальнобойное воинское оружие'],
    tools: [],
    skillChoices: { count: 2, from: ['acrobatics', 'animalHandling', 'athletics', 'deception', 'insight', 'intimidation', 'perception', 'persuasion', 'sleightOfHand', 'stealth'] },
  },
};
