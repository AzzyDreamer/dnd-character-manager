// Маппинг ключей ресурсов из levelTable классов → отображение
// Только trackable ресурсы (имеющие uses/charges, которые можно тратить и восстанавливать)

export interface ClassResourceDef {
  label: string;
  restoreOn: 'short' | 'long';
  icon?: string;
}

export const TRACKABLE_RESOURCES: Record<string, ClassResourceDef> = {
  secondWind: { label: 'Второе дыхание', restoreOn: 'short' },
  channelDivinity: { label: 'Божественный канал', restoreOn: 'short', icon: '/images/resources/30px-Channel_Divinity_Charges_Icon.png.webp' },
  channelOath: { label: 'Канал клятвы', restoreOn: 'short', icon: '/images/resources/30px-Channel_Oath_Icon.png.webp' },
  rages: { label: 'Ярость', restoreOn: 'long', icon: '/images/resources/32px-Rage_Charges_Icons.png.webp' },
  focusPoints: { label: 'Очки концентрации', restoreOn: 'short', icon: '/images/resources/30px-Monk_Ki_Icon.png.webp' },
  sorceryPoints: { label: 'Очки колдовства', restoreOn: 'long', icon: '/images/resources/30px-Sorcery_Points_Icons.png.webp' },
  wildShape: { label: 'Дикий облик', restoreOn: 'long', icon: '/images/resources/30px-Wild_Shape_Charges_Icon.png.webp' },
  pactSlots: { label: 'Ячейки договора', restoreOn: 'short' },
};

// Пассивные значения (не trackable, просто отображение)
export interface ClassPassiveStat {
  key: string;
  label: string;
  value: string | number;
  icon?: string;
}

const PASSIVE_STAT_LABELS: Record<string, { label: string; icon?: string }> = {
  rageDamage: { label: 'Бонус ярости', icon: '/images/resources/32px-Rage_Charges_Icons.png.webp' },
  weaponMastery: { label: 'Мастерство оружия', icon: '/images/resources/30px-Superiority_Die_d8_Icon.png.webp' },
  martialArts: { label: 'Боевые искусства' },
  sneakAttack: { label: 'Скрытая атака' },
  bardicDie: { label: 'Кость вдохновения', icon: '/images/resources/30px-Bardic_Inspiration_Resource_Icon.png.webp' },
  unarmoredMovement: { label: 'Без доспехов' },
  invocations: { label: 'Воззвания' },
  favoredEnemy: { label: 'Избранный враг' },
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
      resources.push({ key, label: def.label, max: val, restoreOn: def.restoreOn, icon: def.icon });
    }
  }

  return resources;
}

export function getClassPassiveStats(levelTableRow: Record<string, any> | undefined): ClassPassiveStat[] {
  if (!levelTableRow) return [];
  const stats: ClassPassiveStat[] = [];

  for (const [key, def] of Object.entries(PASSIVE_STAT_LABELS)) {
    const val = levelTableRow[key];
    if (val != null) {
      stats.push({ key, label: def.label, value: val, icon: def.icon });
    }
  }

  return stats;
}

export function getLevelTableRow(levelTable: any[] | undefined, level: number): Record<string, any> | undefined {
  if (!levelTable) return undefined;
  return levelTable.find((row: any) => row.level === level);
}
