export type { RaceDefinition, SubraceDefinition, RaceTraitDefinition } from './types';

import { human } from './human';
import { elf } from './elf';
import { dwarf } from './dwarf';
import { halfling } from './halfling';
import { dragonborn } from './dragonborn';
import { gnome } from './gnome';
import { halfElf } from './half-elf';
import { halfOrc } from './half-orc';
import { tiefling } from './tiefling';

import type { RaceDefinition } from './types';

export const RACE_REGISTRY: RaceDefinition[] = [
  human,
  elf,
  dwarf,
  halfling,
  dragonborn,
  gnome,
  halfElf,
  halfOrc,
  tiefling,
];

export const getRaceById = (id: string): RaceDefinition | undefined =>
  RACE_REGISTRY.find(r => r.id === id);

export const getRaceByName = (name: string): RaceDefinition | undefined =>
  RACE_REGISTRY.find(r => r.name === name);
