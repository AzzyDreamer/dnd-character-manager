// Дикий облик друида (PHB'24): выученные формы, лимиты по уровню и живая
// подмена статов. Модель 2024: друид ЗНАЕТ конкретные формы (4/6/8), выбранные
// из зверей с CR не выше порога; полёт запрещён до 8 уровня. Круг Луны и Circle
// of Mutation (GH) поднимают порог CR до уровень/3 (Circle Forms).
//
// Как и активируемые эффекты, форма НИКОГДА не вшивается в хранимые статы:
// СИЛ/ЛОВ/ТЕЛ, КД и скорости зверя применяются живьём на этапе отображения
// (getEffectiveAbilityScores / getACBreakdown / getEffectiveSpeed). Хиты, ИНТ/
// МДР/ХАР, спасброски и черты остаются своими (правило 2024).
import type { Character, AbilityScores } from '../types';
import { getAbilityModifier } from './dnd';
import { getClassById, findSubclass } from '../data/classes';
import {
  ALL_CREATURES,
  getCreatureByName,
  getCreatureAC,
  getCreatureTypeName,
  crToNumber,
  type CreatureData,
} from '../data/creatures';

export interface WildShapeLimits {
  /** Сколько форм друид знает одновременно (4/6/8) */
  knownForms: number;
  /** Максимальный CR формы (0.25/0.5/1; Луна/Mutation — уровень/3) */
  maxCR: number;
  /** Полёт разрешён с 8 уровня (Circle Forms порог CR не отменяет этого) */
  flyAllowed: boolean;
  /** Временные хиты при превращении: уровень (Луна — 3×уровень) */
  tempHP: number;
  /** Длительность формы в часах: уровень/2 */
  durationHours: number;
  /** Круг Луны: КД формы = max(КД зверя, 13 + мод Мдр) */
  moonAC: boolean;
}

// Подклассы с Circle Forms: максимальный CR = уровень друида / 3 (вниз)
const CR_OVERRIDE_SUBCLASSES = new Set(['moon', 'mutation']);

function getSubclassId(char: Character): string | null {
  if (!char.subclass || !char.classId) return null;
  const classDef = getClassById(char.classId);
  if (!classDef) return null;
  return findSubclass(classDef, char.subclass)?.id ?? null;
}

/** Лимиты Дикого облика, или null если способность недоступна (не друид / уровень < 2). */
export function getWildShapeLimits(char: Character): WildShapeLimits | null {
  if (char.classId !== 'druid' || char.level < 2) return null;
  const lvl = char.level;
  const sub = getSubclassId(char);
  let maxCR = lvl >= 8 ? 1 : lvl >= 4 ? 0.5 : 0.25;
  if (sub && CR_OVERRIDE_SUBCLASSES.has(sub) && lvl >= 3) {
    maxCR = Math.max(maxCR, Math.floor(lvl / 3));
  }
  const moon = sub === 'moon' && lvl >= 3;
  return {
    knownForms: lvl >= 8 ? 8 : lvl >= 4 ? 6 : 4,
    maxCR,
    flyAllowed: lvl >= 8,
    tempHP: moon ? 3 * lvl : lvl,
    durationHours: lvl / 2,
    moonAC: moon,
  };
}

/** Подходит ли существо под лимиты: зверь, CR ≤ порога, полёт только с 8 уровня. */
export function isFormEligible(c: CreatureData, limits: WildShapeLimits): boolean {
  if (getCreatureTypeName(c).toLowerCase() !== 'beast') return false;
  const cr = crToNumber(c.cr);
  if (!(cr <= limits.maxCR)) return false; // NaN не проходит
  if (!limits.flyAllowed && c.speed?.fly) return false;
  return true;
}

/** Все существа бестиария, доступные под данные лимиты (для пикера форм). */
export function getEligibleForms(limits: WildShapeLimits): CreatureData[] {
  return ALL_CREATURES.filter(c => isFormEligible(c, limits));
}

// ── Состояние персонажа ──

export function getKnownFormNames(char: Character): string[] {
  return char.wildShape?.knownForms ?? [];
}

/** Перезаписать список известных форм (пикер сам следит за лимитом). */
export function setKnownForms(char: Character, names: string[]): Character {
  return {
    ...char,
    wildShape: { knownForms: names, active: char.wildShape?.active },
    updatedAt: new Date().toISOString(),
  };
}

export interface ActiveWildShape {
  creature: CreatureData;
  form: string;
  activatedAt: string;
  /** Оставшееся игровое время в часах (ручной трекер, не реальное время) */
  remainingHours?: number;
}

/** Активная форма с резолвом статблока, или null (нет формы / способность утрачена). */
export function getActiveWildShapeForm(char: Character): ActiveWildShape | null {
  const active = char.wildShape?.active;
  if (!active) return null;
  if (!getWildShapeLimits(char)) return null;
  const creature = getCreatureByName(active.form);
  if (!creature) return null;
  return { creature, form: active.form, activatedAt: active.activatedAt, remainingHours: active.remainingHours };
}

export function isWildShapeExpired(char: Character): boolean {
  const remaining = char.wildShape?.active?.remainingHours;
  return remaining !== undefined && remaining <= 0;
}

/**
 * Подкрутить оставшееся игровое время формы (шаг ±0.5 ч с листа). Зажато в
 * [0, уровень/2 часов]. На 0 форма помечается истёкшей — UI снимает её.
 */
export function adjustWildShapeTime(char: Character, deltaHours: number): Character {
  const active = char.wildShape?.active;
  const limits = getWildShapeLimits(char);
  if (!active || !limits) return char;
  const next = Math.max(0, Math.min(
    limits.durationHours,
    Math.round(((active.remainingHours ?? limits.durationHours) + deltaHours) * 2) / 2,
  ));
  return {
    ...char,
    wildShape: {
      knownForms: char.wildShape!.knownForms,
      active: { ...active, remainingHours: next },
    },
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Превратиться: списать использование, проставить длительность, выдать временные
 * хиты (не стакаются — берём большее). Достаточность ресурса проверяет вызывающий.
 */
export function activateWildShape(char: Character, formName: string, resourceMax?: number): Character {
  const limits = getWildShapeLimits(char);
  if (!limits) return char;

  const now = new Date();
  const tracker = char.resourceTrackers?.wildShape;
  const max = tracker?.max ?? resourceMax ?? 1;
  const current = tracker?.current ?? max;

  return {
    ...char,
    wildShape: {
      knownForms: getKnownFormNames(char),
      active: {
        form: formName,
        activatedAt: now.toISOString(),
        // Игровое время: трекер ведётся вручную, к реальным часам не привязан
        remainingHours: limits.durationHours,
      },
    },
    resourceTrackers: {
      ...(char.resourceTrackers ?? {}),
      wildShape: { current: Math.max(0, current - 1), max },
    },
    hitPoints: {
      ...char.hitPoints,
      temporary: Math.max(char.hitPoints.temporary ?? 0, limits.tempHP),
    },
    updatedAt: now.toISOString(),
  };
}

/** Покинуть форму (бонусным действием / досрочно). Ресурс не возвращается. */
export function deactivateWildShape(char: Character): Character {
  if (!char.wildShape?.active) return char;
  return {
    ...char,
    wildShape: { knownForms: char.wildShape.knownForms, active: undefined },
    updatedAt: new Date().toISOString(),
  };
}

// ── Живые оверлеи статов (никогда не бейкаются) ──

/** СИЛ/ЛОВ/ТЕЛ зверя ЗАМЕНЯЮТ свои (даже если ниже); ИНТ/МДР/ХАР остаются. */
export function applyWildShapeAbilityOverride(char: Character, scores: AbilityScores): AbilityScores {
  const form = getActiveWildShapeForm(char);
  if (!form) return scores;
  return {
    ...scores,
    strength: form.creature.str,
    dexterity: form.creature.dex,
    constitution: form.creature.con,
  };
}

/** КД в форме (Луна — 13 + Мдр, если выше КД зверя), или null когда форма неактивна. */
export function getWildShapeAC(char: Character): number | null {
  const form = getActiveWildShapeForm(char);
  if (!form) return null;
  const beastAC = getCreatureAC(form.creature);
  if (getWildShapeLimits(char)?.moonAC) {
    return Math.max(beastAC, 13 + getAbilityModifier(char.abilityScores.wisdom));
  }
  return beastAC;
}

/** Скорость ходьбы формы, или null когда форма неактивна. */
export function getWildShapeWalkSpeed(char: Character): number | null {
  const form = getActiveWildShapeForm(char);
  if (!form) return null;
  return form.creature.speed?.walk ?? 30;
}

/** Доп. скорости формы (полёт/плавание/лазание/копание). Пусто, когда формы нет. */
export function getWildShapeMoveSpeeds(char: Character): { fly?: number; swim?: number; climb?: number; burrow?: number } {
  const form = getActiveWildShapeForm(char);
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
 * Идемпотентная чистка для effectSync: миграция старого реального expiresAt в
 * ручной remainingHours и снятие истёкшей/осиротевшей формы. Мутирует
 * переданный объект (sync работает со structuredClone).
 */
export function syncWildShape(char: Character, now: Date = new Date()): boolean {
  const ws = char.wildShape;
  if (!ws?.active) return false;
  let changed = false;

  // Миграция: ранние версии хранили реальное время истечения
  if (ws.active.expiresAt !== undefined) {
    if (ws.active.remainingHours === undefined) {
      const leftMs = new Date(ws.active.expiresAt).getTime() - now.getTime();
      ws.active.remainingHours = Math.max(0, Math.round((leftMs / 3_600_000) * 2) / 2);
    }
    delete ws.active.expiresAt;
    changed = true;
  }

  const limits = getWildShapeLimits(char);
  // «Существо не найдено» значимо только при загруженном бестиарии — иначе
  // пустой ALL_CREATURES (ранний вызов sync) снёс бы легитимную форму.
  const orphaned = ALL_CREATURES.length > 0 && !getCreatureByName(ws.active.form);
  if (!limits || orphaned || isWildShapeExpired(char)) {
    ws.active = undefined;
    return true;
  }
  return changed;
}
