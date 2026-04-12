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
import { gunslinger } from './gunslinger';
import { monsterHunter } from './monster-hunter';

import type { ClassDefinition } from './types';
import i18n from '../../i18n';

export const CLASS_REGISTRY: ClassDefinition[] = [
  barbarian,
  bard,
  cleric,
  druid,
  fighter,
  gunslinger,
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
  CLASS_REGISTRY.find(c => c.name === name || getClassName(c.id) === name);

// ── i18n helpers ──

export function getClassName(classId: string): string {
  return i18n.t(`classes.${classId}.name`, { ns: 'game' });
}

export function getClassDescription(classId: string): string {
  return i18n.t(`classes.${classId}.description`, { ns: 'game' });
}

export function getSubclassName(classId: string, subclassId: string): string {
  return i18n.t(`subclasses.${classId}.${subclassId}`, { ns: 'game' });
}

export function translateArmorProficiency(key: string): string {
  return i18n.t(`armorProficiencies.${key}`, { ns: 'game' });
}

export function translateWeaponProficiency(key: string): string {
  const catResult = i18n.t(`weaponCategories.${key}`, { ns: 'game', defaultValue: '' });
  if (catResult) return catResult;
  return i18n.t(`weaponProficiencies.${key}`, { ns: 'game' });
}

export function translateToolProficiency(key: string): string {
  return i18n.t(`toolProficiencies.${key}`, { ns: 'game' });
}

/** Find subclass by name — handles both English canonical and translated names (backward compat) */
export function findSubclass(classDef: ClassDefinition, subclassDisplayName: string) {
  return classDef.subclasses.find(s =>
    s.name === subclassDisplayName ||
    getSubclassName(classDef.id, s.id) === subclassDisplayName
  );
}

export function translateProficiencies(classDef: ClassDefinition): {
  armor: string[];
  weapons: string[];
  tools: string[];
} {
  return {
    armor: classDef.proficiencies.armor.map(translateArmorProficiency),
    weapons: classDef.proficiencies.weapons.map(translateWeaponProficiency),
    tools: classDef.proficiencies.tools.map(translateToolProficiency),
  };
}
