export type { SubclassDefinition, ClassDefinition } from './types';

import { barbarian } from './barbarian';
import { bard } from './bard';
import { cleric } from './cleric';
import { druid } from './druid';
import { fighter } from './fighter';
import { monk } from './monk';
import { paladin } from './paladin';
import { ranger } from './ranger';
import { rogue } from './rogue';
import { sorcerer } from './sorcerer';
import { warlock } from './warlock';
import { wizard } from './wizard';
import { artificer } from './artificer';
import { monsterHunter } from './monster-hunter';

import type { ClassDefinition } from './types';

export const CLASS_REGISTRY: ClassDefinition[] = [
  barbarian,
  bard,
  cleric,
  druid,
  fighter,
  monk,
  paladin,
  ranger,
  rogue,
  sorcerer,
  warlock,
  wizard,
  artificer,
  monsterHunter,
];

export const getClassById = (id: string): ClassDefinition | undefined =>
  CLASS_REGISTRY.find(c => c.id === id);

export const getClassByName = (name: string): ClassDefinition | undefined =>
  CLASS_REGISTRY.find(c => c.name === name);
