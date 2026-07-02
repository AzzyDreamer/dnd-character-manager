// Пассивные эффекты экипированных предметов из сырых 5etools-данных (raw):
// резисты/иммунитеты, изменения скоростей (modifySpeed), флэт-бонусы
// характеристик (Камни Иоун и т.п.), условные бонусы КД, крит-диапазон.
// Здесь только равновесное состояние «предмет надет (и настроен)» — заряды,
// прикреплённые заклинания и прочие активируемые свойства сюда не входят.
// Модуль импортирует только types + equipment.ts: его тянут classEffects,
// activatedEffects и conditionEffects, поэтому циклические импорты недопустимы.
import type { Character, InventoryItem, AbilityScores } from '../types';
import { getEquippedArmor, isWearingArmor, isWieldingShield } from './equipment';

/** Стабильный английский ключ предмета (под RU локалью raw.name переведён). */
export function itemOrigName(item: InventoryItem): string {
  const raw = item.raw as { _origName?: string; name?: string } | undefined;
  return raw?._origName ?? raw?.name ?? item.name;
}

function parseBonus(val: unknown): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const n = parseInt(val, 10);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

/**
 * Экипированные предметы, чьи постоянные свойства сейчас действуют:
 * заняты в слоте экипировки, а требующие настройки — настроены.
 */
export function getEquippedActiveItems(char: Character): InventoryItem[] {
  if (!char.equipment || !char.inventory) return [];
  const ids = new Set(Object.values(char.equipment).filter((id): id is string => !!id));
  return char.inventory.filter(i =>
    ids.has(i.id) && i.raw && (!i.raw.reqAttune || i.attuned),
  );
}

// ── Резисты / иммунитеты / уязвимости ──

export interface ItemResistanceEntry {
  type: string;
  modifier: 'resistance' | 'immunity' | 'vulnerability';
  /** Отображаемое имя предмета-источника (для тултипа «от: …») */
  sourceName: string;
}

/** Резисты/иммунитеты/уязвимости от надетых предметов (raw.resist/immune/vulnerable). */
export function getItemResistances(char: Character): ItemResistanceEntry[] {
  const out: ItemResistanceEntry[] = [];
  for (const item of getEquippedActiveItems(char)) {
    const raw = item.raw!;
    const push = (arr: unknown, modifier: ItemResistanceEntry['modifier']) => {
      if (!Array.isArray(arr)) return;
      for (const t of arr) {
        if (typeof t === 'string') out.push({ type: t, modifier, sourceName: item.name });
      }
    };
    push(raw.resist, 'resistance');
    push(raw.immune, 'immunity');
    push(raw.vulnerable, 'vulnerability');
  }
  return out;
}

// ── Скорости ──

export interface ItemWalkSpeedEffect {
  /** Плоский сдвиг скорости ходьбы (modifySpeed.bonus, штраф Силы брони) */
  adjust: number;
  /** «Скорость становится N, если не выше» (modifySpeed.static.walk); 0 = нет */
  floor: number;
}

/** Сила персонажа, как её видят предметы: база + static-замены + флэт-бонусы. */
function effectiveStrengthForArmor(char: Character): number {
  let str = char.abilityScores.strength;
  for (const item of getEquippedActiveItems(char)) {
    const st = item.raw?.ability?.static?.str;
    if (typeof st === 'number' && st > str) str = st;
  }
  const flat = getItemAbilityBonuses(char).strength;
  if (flat) str = Math.max(str, Math.min(flat.cap, str + flat.bonus));
  return str;
}

/**
 * Эффекты надетых предметов на скорость ходьбы.
 * multiply (Boots of Speed ×2) — активируемое свойство, намеренно не применяется.
 * Требование Силы брони/щита (PHB): скорость −10, пока Сила ниже порога —
 * проверяется по всем надетым предметам без гейта настройки.
 */
export function getItemWalkSpeedEffect(char: Character): ItemWalkSpeedEffect {
  let adjust = 0;
  let floor = 0;
  for (const item of getEquippedActiveItems(char)) {
    const ms = item.raw!.modifySpeed;
    if (!ms || typeof ms !== 'object') continue;
    const st = ms.static?.walk;
    if (typeof st === 'number' && st > floor) floor = st;
    const b = ms.bonus ?? {};
    if (typeof b.walk === 'number') adjust += b.walk;
    if (typeof b['*'] === 'number') adjust += b['*'];
  }

  if (char.equipment && char.inventory) {
    const ids = new Set(Object.values(char.equipment).filter((id): id is string => !!id));
    const strReqUnmet = char.inventory.some(i => {
      if (!ids.has(i.id) || !i.raw?.strength) return false;
      const req = parseBonus(i.raw.strength);
      return req > 0 && effectiveStrengthForArmor(char) < req;
    });
    if (strReqUnmet) adjust -= 10;
  }

  return { adjust, floor };
}

/**
 * Доп. скорости (полёт/плавание/лазание) от надетых предметов;
 * −1 = «равна скорости ходьбы» (modifySpeed.equal). Норы (burrow) в листе нет.
 */
export function getItemMoveSpeeds(char: Character): { fly?: number; swim?: number; climb?: number } {
  const out: { fly?: number; swim?: number; climb?: number } = {};
  const walk = char.speed;
  const resolve = (v: number | undefined) => (v === -1 ? walk : (v ?? 0));
  for (const item of getEquippedActiveItems(char)) {
    const ms = item.raw!.modifySpeed;
    if (!ms || typeof ms !== 'object') continue;
    for (const k of ['fly', 'swim', 'climb'] as const) {
      const candidates: number[] = [];
      const st = ms.static?.[k];
      if (typeof st === 'number') candidates.push(st);
      if (ms.equal?.[k] === 'walk') candidates.push(-1);
      for (const v of candidates) {
        if (resolve(v) > resolve(out[k])) out[k] = v;
      }
    }
  }
  return out;
}

// ── Флэт-бонусы характеристик ──

const ABILITY_ABBR: Record<string, keyof AbilityScores> = {
  str: 'strength', dex: 'dexterity', con: 'constitution',
  int: 'intelligence', wis: 'wisdom', cha: 'charisma',
};

// Книги-усилители: их ability — одноразовое постоянное улучшение после
// прочтения (применяется игроком через редактирование характеристик),
// а не эффект ношения. Ключи — английские имена (itemOrigName).
const ONE_TIME_BOOKS = new Set([
  'Manual of Bodily Health', 'Manual of Gainful Exercise', 'Manual of Quickness of Action',
  'Tome of Clear Thought', 'Tome of Leadership and Influence', 'Tome of Understanding',
  'Book of Exalted Deeds',
]);

// Индивидуальные капы флэт-бонусов; по умолчанию 20 (Ioun Stone, Belt of Dwarvenkind).
const ABILITY_BONUS_CAPS: Record<string, number> = {
  'Shard of Xeluan': 22,
};

export interface ItemAbilityBonus {
  bonus: number;
  /** Максимум, выше которого бонус не поднимает характеристику */
  cap: number;
}

/**
 * Флэт-бонусы характеристик от надетых предметов (raw.ability вида { con: 2 }).
 * static-замены (Gauntlets of Ogre Power) обрабатывает getEffectiveAbilityScores;
 * choose/from (Book of Vile Darkness, колоды) — разовые выборы, не применяются.
 */
export function getItemAbilityBonuses(char: Character): Partial<Record<keyof AbilityScores, ItemAbilityBonus>> {
  const out: Partial<Record<keyof AbilityScores, ItemAbilityBonus>> = {};
  for (const item of getEquippedActiveItems(char)) {
    const ability = item.raw!.ability;
    if (!ability || typeof ability !== 'object') continue;
    if (ONE_TIME_BOOKS.has(itemOrigName(item))) continue;
    const cap = ABILITY_BONUS_CAPS[itemOrigName(item)] ?? 20;
    for (const [abbr, val] of Object.entries(ability)) {
      const key = ABILITY_ABBR[abbr];
      if (!key || typeof val !== 'number') continue;
      const cur = out[key];
      out[key] = { bonus: (cur?.bonus ?? 0) + val, cap: Math.max(cur?.cap ?? 0, cap) };
    }
  }
  return out;
}

// ── Условные бонусы КД ──

/**
 * Известные предметы, чей bonusAc в данных безусловный, но по тексту работает
 * с ограничением. Возвращает false, когда бонус КД предмета сейчас не действует.
 */
export function itemAcBonusApplies(char: Character, item: InventoryItem): boolean {
  if (itemOrigName(item) === 'Bracers of Defense') {
    return !isWearingArmor(char) && !isWieldingShield(char);
  }
  return true;
}

// ── Оружие ──

/** Крит-диапазон оружия из raw.critThreshold (19 → «19–20», 18 → «18–20»). */
export function getWeaponCritThreshold(item: InventoryItem): number | undefined {
  const v = item.raw?.critThreshold;
  return typeof v === 'number' && v < 20 ? v : undefined;
}

/**
 * Бонус урона к атаке данным оружием от ДРУГИХ надетых предметов.
 * Пока единственный источник — Bracers of Archery (+2 урона длинным/коротким луком).
 */
export function getOffWeaponDamageBonus(char: Character, weapon: InventoryItem, isRangedAttack: boolean): number {
  if (!isRangedAttack) return 0;
  let bonus = 0;
  for (const item of getEquippedActiveItems(char)) {
    if (item.id === weapon.id) continue;
    if (itemOrigName(item) !== 'Bracers of Archery') continue;
    const base = String(weapon.raw?.baseItem ?? '').split('|')[0].toLowerCase();
    const wname = itemOrigName(weapon).toLowerCase();
    if (['longbow', 'shortbow'].some(b => base === b || wname.includes(b))) {
      bonus += parseBonus(item.raw!.bonusWeaponDamage);
    }
  }
  return bonus;
}

// ── Зелья лечения ──

// Кубы лечения по стабильному английскому имени (XPHB и XDMG-нейминг).
const HEALING_POTION_DICE: Record<string, string> = {
  'Potion of Healing': '2d4+2',
  'Potion of Greater Healing': '4d4+4',
  'Potion of Healing (Greater)': '4d4+4',
  'Potion of Superior Healing': '8d4+8',
  'Potion of Healing (Superior)': '8d4+8',
  'Potion of Supreme Healing': '10d4+20',
  'Potion of Healing (Supreme)': '10d4+20',
};

/** Формула лечения зелья («2d4+2») или undefined, если предмет — не зелье лечения. */
export function getHealingPotionDice(item: InventoryItem): string | undefined {
  return HEALING_POTION_DICE[itemOrigName(item)];
}

// ── Пределы Ловкости брони (dexterityMax) ──

/**
 * Предел бонуса Ловкости надетой средней брони: undefined — стандартный кап,
 * Infinity — без предела (Serpent Scale Armor: dexterityMax: null), число — кастомный.
 */
export function getArmorDexCapOverride(char: Character): number | undefined {
  const armor = getEquippedArmor(char);
  if (!armor?.raw || !('dexterityMax' in armor.raw)) return undefined;
  const v = armor.raw.dexterityMax;
  if (v === null) return Infinity;
  return typeof v === 'number' ? v : undefined;
}
