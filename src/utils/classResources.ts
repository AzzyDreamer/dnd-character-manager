// Маппинг ключей ресурсов из levelTable классов → отображение
// Только trackable ресурсы (имеющие uses/charges, которые можно тратить и восстанавливать)

import i18n from '../i18n';
import { asset } from '../utils/asset';

export interface ClassResourceDef {
  labelKey: string;
  restoreOn: 'short' | 'long';
  icon?: string;
}

const TRACKABLE_RESOURCES: Record<string, ClassResourceDef> = {
  secondWind: { labelKey: 'secondWind', restoreOn: 'short', icon: asset('/images/resources/Second_Wind.webp') },
  channelDivinity: { labelKey: 'channelDivinity', restoreOn: 'short', icon: asset('/images/resources/30px-Channel_Divinity_Charges_Icon.png.webp') },
  channelOath: { labelKey: 'channelOath', restoreOn: 'short', icon: asset('/images/resources/30px-Channel_Oath_Icon.png.webp') },
  rages: { labelKey: 'rages', restoreOn: 'long', icon: asset('/images/resources/32px-Rage_Charges_Icons.png.webp') },
  focusPoints: { labelKey: 'focusPoints', restoreOn: 'short', icon: asset('/images/resources/30px-Monk_Ki_Icon.png.webp') },
  sorceryPoints: { labelKey: 'sorceryPoints', restoreOn: 'long', icon: asset('/images/resources/30px-Sorcery_Points_Icons.png.webp') },
  wildShape: { labelKey: 'wildShape', restoreOn: 'long', icon: asset('/images/resources/30px-Wild_Shape_Charges_Icon.png.webp') },
  pactSlots: { labelKey: 'pactSlots', restoreOn: 'short' },
};

// Пассивные значения (не trackable, просто отображение)
export interface ClassPassiveStat {
  key: string;
  label: string;
  value: string | number;
  icon?: string;
}

const PASSIVE_STAT_DEFS: Record<string, { labelKey: string; icon?: string }> = {
  rageDamage: { labelKey: 'rageDamage', icon: asset('/images/resources/32px-Rage_Charges_Icons.png.webp') },
  weaponMastery: { labelKey: 'weaponMastery', icon: asset('/images/resources/30px-Superiority_Die_d8_Icon.png.webp') },
  martialArts: { labelKey: 'martialArts' },
  sneakAttack: { labelKey: 'sneakAttack' },
  bardicDie: { labelKey: 'bardicDie', icon: asset('/images/resources/30px-Bardic_Inspiration_Resource_Icon.png.webp') },
  unarmoredMovement: { labelKey: 'unarmoredMovement' },
  invocations: { labelKey: 'invocations' },
  favoredEnemy: { labelKey: 'favoredEnemy' },
};

export interface ClassResource {
  key: string;
  label: string;
  max: number;
  restoreOn: 'short' | 'long';
  icon?: string;
}

export function getClassResources(levelTableRow: Record<string, any> | undefined): ClassResource[] {
  if (!levelTableRow) return [];
  const resources: ClassResource[] = [];

  for (const [key, def] of Object.entries(TRACKABLE_RESOURCES)) {
    const val = levelTableRow[key];
    if (val != null && typeof val === 'number' && val > 0) {
      resources.push({
        key,
        label: i18n.t(`classResources.${def.labelKey}`, { ns: 'game' }),
        max: val,
        restoreOn: def.restoreOn,
        icon: def.icon,
      });
    }
  }

  return resources;
}

// Subclass-specific trackable resources (not in levelTable, derived from subclass features)
export interface SubclassResourceDef {
  classId: string;
  subclassId: string;
  key: string;
  labelKey: string;
  restoreOn: 'short' | 'long';
  icon?: string;
  /** Returns the max value based on character level */
  getMax: (level: number) => number;
  /** Min level to show this resource */
  minLevel: number;
}

const SUBCLASS_RESOURCES: SubclassResourceDef[] = [
  {
    classId: 'fighter',
    subclassId: 'battle-master',
    key: 'superiorityDice',
    labelKey: 'superiorityDice',
    restoreOn: 'short',
    icon: asset('/images/resources/30px-Superiority_Die_d8_Icon.png.webp'),
    minLevel: 3,
    getMax: (level: number) => {
      if (level >= 15) return 6;
      if (level >= 7) return 5;
      return 4;
    },
  },
];

export function getSubclassResources(classId: string, subclassId: string | undefined, level: number): ClassResource[] {
  if (!subclassId) return [];
  return SUBCLASS_RESOURCES
    .filter(d => d.classId === classId && d.subclassId === subclassId && level >= d.minLevel)
    .map(d => ({
      key: d.key,
      label: i18n.t(`classResources.${d.labelKey}`, { ns: 'game' }),
      max: d.getMax(level),
      restoreOn: d.restoreOn,
      icon: d.icon,
    }));
}

// Subclass-specific passive stats
interface SubclassPassiveStatDef {
  classId: string;
  subclassId: string;
  key: string;
  labelKey: string;
  icon?: string;
  minLevel: number;
  getValue: (level: number) => string;
}

const SUBCLASS_PASSIVE_STATS: SubclassPassiveStatDef[] = [
  {
    classId: 'fighter',
    subclassId: 'battle-master',
    key: 'superiorityDieType',
    labelKey: 'superiorityDieType',
    icon: asset('/images/resources/30px-Superiority_Die_d8_Icon.png.webp'),
    minLevel: 3,
    getValue: (level: number) => {
      if (level >= 18) return 'd12';
      if (level >= 10) return 'd10';
      return 'd8';
    },
  },
];

export function getSubclassPassiveStats(classId: string, subclassId: string | undefined, level: number): ClassPassiveStat[] {
  if (!subclassId) return [];
  return SUBCLASS_PASSIVE_STATS
    .filter(d => d.classId === classId && d.subclassId === subclassId && level >= d.minLevel)
    .map(d => ({
      key: d.key,
      label: i18n.t(`passiveStats.${d.labelKey}`, { ns: 'game' }),
      value: d.getValue(level),
      icon: d.icon,
    }));
}

export function getClassPassiveStats(levelTableRow: Record<string, any> | undefined): ClassPassiveStat[] {
  if (!levelTableRow) return [];
  const stats: ClassPassiveStat[] = [];

  for (const [key, def] of Object.entries(PASSIVE_STAT_DEFS)) {
    const val = levelTableRow[key];
    if (val != null) {
      stats.push({
        key,
        label: i18n.t(`passiveStats.${def.labelKey}`, { ns: 'game' }),
        value: val,
        icon: def.icon,
      });
    }
  }

  return stats;
}

export function getLevelTableRow(levelTable: any[] | undefined, level: number): Record<string, any> | undefined {
  if (!levelTable) return undefined;
  return levelTable.find((row: any) => row.level === level);
}
