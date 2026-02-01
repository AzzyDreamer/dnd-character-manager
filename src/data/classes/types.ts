import type { AbilityScores } from '../../types';

export interface SubclassDefinition {
  id: string;
  name: string;
  description: string;
  source: string;
  level: number;
}

export interface ClassDefinition {
  id: string;
  name: string;
  hitDie: string;
  primaryAbility: (keyof AbilityScores)[];
  savingThrows: (keyof AbilityScores)[];
  spellcaster: boolean;
  spellcastingAbility?: 'intelligence' | 'wisdom' | 'charisma';
  description: string;
  source: string;
  subclasses: SubclassDefinition[];
  proficiencies: {
    armor: string[];
    weapons: string[];
    tools: string[];
    skillChoices: { count: number; from: string[] };
  };
}
