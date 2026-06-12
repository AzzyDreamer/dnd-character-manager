// Kindred Form ликантропа (GH:PG24, дар 2-й стадии): полное превращение в
// зверя своего типа ликантропии по правилам заклинания Полиморф (XPHB):
//   - заменяются ВСЕ ШЕСТЬ характеристик (в отличие от Дикого облика);
//   - ХИТЫ заменяются хитами зверя; свои сохраняются и возвращаются при выходе
//     (избыточный урон при падении в 0 переносится вручную — авто-возврата нет);
//   - экипировка ПАДАЕТ («falls off») — КД зверя без бонусов предметов;
//   - говорить и колдовать нельзя; ресурс не тратится (Magic action).
// Зверь определяется гибридным даром 1-й стадии: волк/медведь/крыса.
// Длительность — ручной трекер игрового времени (текст дара её не задаёт;
// дефолт 1 час по Полиморфу, подкручивается с листа).
import type { Character, AbilityScores } from '../types';
import {
  ALL_CREATURES,
  getCreatureByName,
  getCreatureAC,
  type CreatureData,
} from '../data/creatures';
import { ACTIVATED_EFFECTS } from './activatedEffects';
import { asset } from './asset';

// Гибридный дар 1-й стадии → зверь Kindred Form (Kindred Form.json, GH:PG24)
const HYBRID_BOON_TO_BEAST: Record<string, string> = {
  'Hybrid Wolf Form': 'Wolf',
  'Hybrid Bear Form': 'Black Bear',
  'Hybrid Rat Form': 'Giant Rat',
};

// Ключ активируемого эффекта гибридной формы → токен ликантропа
const HYBRID_FORM_TOKENS: Record<string, string> = {
  'hybrid-wolf-form': 'Werewolf',
  'hybrid-bear-form': 'Werebear',
  'hybrid-rat-form': 'Wererat',
};

const DEFAULT_DURATION_HOURS = 1;
// Текст дара длительность не ограничивает — потолок ручного трекера щедрый
const MAX_DURATION_HOURS = 24;

function ownsBoon(char: Character, boonNameEn: string): boolean {
  return (char.optionalFeatures ?? []).some(f => (f.nameEn ?? f.name) === boonNameEn);
}

/** Токен гибридной формы ликантропа (Werewolf/Werebear/Wererat) для ключа эффекта. */
export function getHybridFormTokenUrl(effectKey: string): string | null {
  const name = HYBRID_FORM_TOKENS[effectKey];
  return name ? asset(`/images/transformations/${name}.webp`) : null;
}

/** Зверь Kindred Form по гибридному дару 1-й стадии, или null (дар не выбран). */
export function getKindredBeastName(char: Character): string | null {
  for (const [boon, beast] of Object.entries(HYBRID_BOON_TO_BEAST)) {
    if (ownsBoon(char, boon)) return beast;
  }
  return null;
}

/** Доступна ли Kindred Form: дар во владении и тип ликантропии определён. */
export function isKindredFormAvailable(char: Character): boolean {
  return ownsBoon(char, 'Kindred Form') && getKindredBeastName(char) !== null;
}

/** Владеет ли даром Kindred Form, но тип не выводим (нет гибридного дара 1-й стадии). */
export function isKindredFormTypeUnknown(char: Character): boolean {
  return ownsBoon(char, 'Kindred Form') && getKindredBeastName(char) === null;
}

export interface ActiveKindredForm {
  creature: CreatureData;
  form: string;
  activatedAt: string;
  remainingHours?: number;
}

/** Активная Kindred Form с резолвом статблока, или null (нет формы / дар утрачен). */
export function getActiveKindredForm(char: Character): ActiveKindredForm | null {
  const active = char.kindredForm?.active;
  if (!active) return null;
  if (!ownsBoon(char, 'Kindred Form')) return null;
  const creature = getCreatureByName(active.form);
  if (!creature) return null;
  return { creature, form: active.form, activatedAt: active.activatedAt, remainingHours: active.remainingHours };
}

export function isKindredFormExpired(char: Character): boolean {
  const remaining = char.kindredForm?.active?.remainingHours;
  return remaining !== undefined && remaining <= 0;
}

/**
 * Принять звериную форму: сохранить свои хиты, принять хиты зверя (Полиморф),
 * снять гибридные формы (одновременно активна одна форма) и Дикий облик.
 */
export function activateKindredForm(char: Character): Character {
  const beastName = getKindredBeastName(char);
  if (!beastName || !ownsBoon(char, 'Kindred Form')) return char;
  const creature = getCreatureByName(beastName);
  if (!creature) return char;

  const now = new Date();
  const beastHp = creature.hp?.average ?? 1;

  // Гибридные формы (exclusiveGroup 'transform-form') несовместимы со звериной
  const activeEffects = (char.activeEffects ?? []).filter(
    e => ACTIVATED_EFFECTS[e.key]?.exclusiveGroup !== 'transform-form',
  );

  return {
    ...char,
    activeEffects: activeEffects.length ? activeEffects : undefined,
    wildShape: char.wildShape ? { ...char.wildShape, active: undefined } : undefined,
    kindredForm: {
      active: {
        form: beastName,
        activatedAt: now.toISOString(),
        remainingHours: DEFAULT_DURATION_HOURS,
        savedHp: {
          current: char.hitPoints.current,
          max: char.hitPoints.max,
          temporary: char.hitPoints.temporary ?? 0,
        },
      },
    },
    hitPoints: { current: beastHp, max: beastHp, temporary: 0 },
    updatedAt: now.toISOString(),
  };
}

/** Вернуть свой облик: восстановить сохранённые хиты. */
export function deactivateKindredForm(char: Character): Character {
  const active = char.kindredForm?.active;
  if (!active) return char;
  return {
    ...char,
    kindredForm: undefined,
    hitPoints: { ...active.savedHp },
    updatedAt: new Date().toISOString(),
  };
}

/** Подкрутить оставшееся игровое время (±0.5 ч). На 0 UI снимает форму. */
export function adjustKindredTime(char: Character, deltaHours: number): Character {
  const active = char.kindredForm?.active;
  if (!active) return char;
  const next = Math.max(0, Math.min(
    MAX_DURATION_HOURS,
    Math.round(((active.remainingHours ?? DEFAULT_DURATION_HOURS) + deltaHours) * 2) / 2,
  ));
  return {
    ...char,
    kindredForm: { active: { ...active, remainingHours: next } },
    updatedAt: new Date().toISOString(),
  };
}

// ── Живые оверлеи статов (хиты НЕ здесь — они состояние, см. activate) ──

/** Полиморф: заменяются все шесть характеристик зверя. */
export function applyKindredAbilityOverride(char: Character, scores: AbilityScores): AbilityScores {
  const form = getActiveKindredForm(char);
  if (!form) return scores;
  const c = form.creature;
  return {
    strength: c.str,
    dexterity: c.dex,
    constitution: c.con,
    intelligence: c.int,
    wisdom: c.wis,
    charisma: c.cha,
  };
}

/** КД зверя (экипировка слита/упала), или null когда форма неактивна. */
export function getKindredAC(char: Character): number | null {
  const form = getActiveKindredForm(char);
  return form ? getCreatureAC(form.creature) : null;
}

/** Скорость ходьбы зверя, или null когда форма неактивна. */
export function getKindredWalkSpeed(char: Character): number | null {
  const form = getActiveKindredForm(char);
  if (!form) return null;
  return form.creature.speed?.walk ?? 30;
}

/** Доп. скорости зверя (полёт/плавание/лазание/копание). Пусто без формы. */
export function getKindredMoveSpeeds(char: Character): { fly?: number; swim?: number; climb?: number; burrow?: number } {
  const form = getActiveKindredForm(char);
  if (!form?.creature.speed) return {};
  const { fly, swim, climb, burrow } = form.creature.speed;
  const out: { fly?: number; swim?: number; climb?: number; burrow?: number } = {};
  if (fly) out.fly = fly;
  if (swim) out.swim = swim;
  if (climb) out.climb = climb;
  if (burrow) out.burrow = burrow;
  return out;
}

/**
 * Идемпотентная чистка для effectSync: снять осиротевшую/истёкшую форму С
 * ВОССТАНОВЛЕНИЕМ хитов. Мутирует переданный объект (sync работает с клоном).
 */
export function syncKindredForm(char: Character): boolean {
  const active = char.kindredForm?.active;
  if (!active) {
    if (char.kindredForm) { char.kindredForm = undefined; return true; }
    return false;
  }
  // «Зверь не найден» значимо только при загруженном бестиарии
  const orphanedBeast = ALL_CREATURES.length > 0 && !getCreatureByName(active.form);
  const boonLost = !ownsBoon(char, 'Kindred Form');
  if (boonLost || orphanedBeast || isKindredFormExpired(char)) {
    char.hitPoints = { ...active.savedHp };
    char.kindredForm = undefined;
    return true;
  }
  return false;
}
