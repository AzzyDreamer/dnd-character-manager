// Маппинг ключей ресурсов из levelTable классов → отображение
// Только trackable ресурсы (имеющие uses/charges, которые можно тратить и восстанавливать)

export interface ClassResourceDef {
  label: string;
  restoreOn: 'short' | 'long';
}

export const TRACKABLE_RESOURCES: Record<string, ClassResourceDef> = {
  secondWind: { label: 'Второе дыхание', restoreOn: 'short' },
  channelDivinity: { label: 'Божественный канал', restoreOn: 'short' },
  rages: { label: 'Ярость', restoreOn: 'long' },
  focusPoints: { label: 'Очки концентрации', restoreOn: 'short' },
  sorceryPoints: { label: 'Очки колдовства', restoreOn: 'long' },
  wildShape: { label: 'Дикий облик', restoreOn: 'long' },
  pactSlots: { label: 'Ячейки договора', restoreOn: 'short' },
};

// Пассивные значения (не trackable, просто отображение)
export interface ClassPassiveStat {
  key: string;
  label: string;
  value: string | number;
}

const PASSIVE_STAT_LABELS: Record<string, string> = {
  rageDamage: 'Бонус ярости',
  weaponMastery: 'Мастерство оружия',
  martialArts: 'Боевые искусства',
  sneakAttack: 'Скрытая атака',
  bardicDie: 'Кость вдохновения',
  unarmoredMovement: 'Без доспехов',
  invocations: 'Воззвания',
  favoredEnemy: 'Избранный враг',
};

export interface ClassResource {
  key: string;
  label: string;
  max: number;
  restoreOn: 'short' | 'long';
}

export function getClassResources(levelTableRow: Record<string, any> | undefined): ClassResource[] {
  if (!levelTableRow) return [];
  const resources: ClassResource[] = [];

  for (const [key, def] of Object.entries(TRACKABLE_RESOURCES)) {
    const val = levelTableRow[key];
    if (val != null && typeof val === 'number' && val > 0) {
      resources.push({ key, label: def.label, max: val, restoreOn: def.restoreOn });
    }
  }

  return resources;
}

export function getClassPassiveStats(levelTableRow: Record<string, any> | undefined): ClassPassiveStat[] {
  if (!levelTableRow) return [];
  const stats: ClassPassiveStat[] = [];

  for (const [key, label] of Object.entries(PASSIVE_STAT_LABELS)) {
    const val = levelTableRow[key];
    if (val != null) {
      stats.push({ key, label, value: val });
    }
  }

  return stats;
}

export function getLevelTableRow(levelTable: any[] | undefined, level: number): Record<string, any> | undefined {
  if (!levelTable) return undefined;
  return levelTable.find((row: any) => row.level === level);
}
