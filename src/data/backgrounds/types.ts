import type { AbilityScores } from '../../types';

export interface BackgroundDefinition {
  id: string;
  name: string;
  source: string;
  abilityOptions: (keyof AbilityScores)[];
  feat: string;
  skillProficiencies: string[];
  toolProficiency: string;
  description: string;
  equipment: string;
}
