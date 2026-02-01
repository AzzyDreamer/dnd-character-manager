export interface RaceTraitDefinition {
  name: string;
  description: string;
}

export interface SubraceDefinition {
  id: string;
  name: string;
  description: string;
  traits: RaceTraitDefinition[];
}

export interface RaceDefinition {
  id: string;
  name: string;
  speed: number;
  size: string;
  traits: RaceTraitDefinition[];
  languages: string[];
  description: string;
  source: string;
  subraces?: SubraceDefinition[];
}
