// Идемпотентная синхронизация постоянных эффектов персонажа с данными игры.
// Запускается при открытии листа: добавляет недостающие резисты/иммунитеты,
// владения спасбросками, чувства (тёмное зрение вида и т.п.) и пересчитывает
// хранимые производные статы (КД, инициативу) по актуальным правилам.
//
// Принципы:
//  - только аддитивные, повторяемые операции (ничего не удаляет);
//  - HP/скорость/характеристики НЕ трогаем — это разовые изменения момента
//    получения (применяются в левел-апе/выборе дара);
//  - персонажи с ручными правками (manualEdit) пропускаются целиком.
import type { Character } from '../types';
import { resolveAC, computeInitiative, syncPermanentClassEffects, addResistances, applySenses, applyMoveSpeeds, getClassSpeedBonus } from './classEffects';
import { extractFeatResistances, extractFeatSenses, applyFeatResistances, applyFeatSenses, FEAT_STAT_EFFECTS } from './featEffects';
import { getActiveTransformEffects } from './transformationEffects';
import { normalizeSkillKey } from './dnd';

/**
 * Returns an updated character if anything was missing, or null when the
 * character is already in sync (or has manual edits and must not be touched).
 */
export async function syncCharacterEffects(char: Character): Promise<Character | null> {
  if (char.manualEdit?.edited) return null;

  const updated: Character = structuredClone(char);

  // 1) Class / subclass / species wired effects (resists, saves, senses)
  syncPermanentClassEffects(updated);

  // 2) Species data: darkvision, fixed resistances, fixed skill proficiencies,
  //    walking speed (база для пересчёта скорости)
  let speciesWalkSpeed: number | null = null;
  try {
    const speciesMod = await import('../data/species');
    await speciesMod.init();
    const sp = updated.raceVariant
      ? speciesMod.getSpeciesByName(updated.raceVariant, updated.raceSource)
        ?? speciesMod.getSpeciesByName(updated.race, updated.raceSource)
      : speciesMod.getSpeciesByName(updated.race, updated.raceSource);
    if (sp) {
      if (typeof sp.speed === 'number') speciesWalkSpeed = sp.speed;
      else if (sp.speed && typeof sp.speed === 'object' && typeof sp.speed.walk === 'number') speciesWalkSpeed = sp.speed.walk;
      // Дополнительные скорости вида (Aarakocra fly 50, Triton swim 30, fly:true = «равна ходьбе»)
      if (sp.speed && typeof sp.speed === 'object') {
        const ms: { fly?: number; swim?: number; climb?: number } = {};
        for (const kind of ['fly', 'swim', 'climb'] as const) {
          const v = (sp.speed as Record<string, number | boolean | undefined>)[kind];
          if (v === true) ms[kind] = -1;
          else if (typeof v === 'number' && v > 0) ms[kind] = v;
        }
        if (Object.keys(ms).length > 0) applyMoveSpeeds(updated, ms);
      }
      if (typeof sp.darkvision === 'number' && sp.darkvision > 0) {
        applySenses(updated, { darkvision: sp.darkvision });
      }
      if (Array.isArray(sp.resist)) {
        const fixed = sp.resist.filter((r): r is string => typeof r === 'string');
        // Создание персонажа помечает видовые резисты как resistance_all — повторяем.
        const existing = updated.damageResistances ?? [];
        for (const type of fixed) {
          if (!existing.some(r => r.type === type)) {
            existing.push({ type, modifier: 'resistance_all' });
          }
        }
        updated.damageResistances = existing;
      }
      for (const entry of (sp.skillProficiencies ?? []) as Record<string, unknown>[]) {
        if (!entry || typeof entry !== 'object') continue;
        for (const [key, val] of Object.entries(entry)) {
          if (val !== true) continue; // choose/any — выбор игрока, не синкаем
          const sk = normalizeSkillKey(key);
          if (!updated.skills[sk]?.proficient) {
            updated.skills = { ...updated.skills, [sk]: { ...(updated.skills[sk] ?? {}), proficient: true } };
          }
        }
      }
    }
  } catch { /* species data unavailable — skip */ }

  // 3) Feats: senses + fixed resistances/immunities from JSON
  try {
    const featsMod = await import('../data/feats');
    await featsMod.init();
    for (const f of updated.feats ?? []) {
      const data = featsMod.getFeatByName(f.nameEn ?? f.name);
      if (!data) continue;
      const res = extractFeatResistances(data);
      if (res.fixed.length > 0 || res.immune.length > 0) {
        applyFeatResistances(updated, { fixed: res.fixed, immune: res.immune });
      }
      applyFeatSenses(updated, extractFeatSenses(data));
    }
  } catch { /* feats data unavailable — skip */ }

  // 4) Transformation boons/flaws: static idempotent subset (включая выведенную
  //    уязвимость Seasonally Affected). Senses здесь max-merge, без стакания
  //    Eyes of the Night — стак только в момент получения дара.
  for (const e of getActiveTransformEffects(updated)) {
    if (e.resistances) addResistances(updated, e.resistances, 'resistance');
    if (e.immunities) addResistances(updated, e.immunities, 'immunity');
    if (e.vulnerabilities) addResistances(updated, e.vulnerabilities, 'vulnerability');
    if (e.senses) applySenses(updated, e.senses);
    if (e.moveSpeeds) applyMoveSpeeds(updated, e.moveSpeeds);
    if (e.skillProficiencies) {
      for (const sk of e.skillProficiencies) {
        if (!updated.skills[sk]?.proficient) {
          updated.skills = { ...updated.skills, [sk]: { ...(updated.skills[sk] ?? {}), proficient: true } };
        }
      }
    }
  }

  // 5) Recompute stored derived stats with the current formulas.
  //    Скорость: база вида + постоянные бонусы черт + бонус класса/подкласса
  //    (трансформации применяются живьём и сюда не входят). Пересчитываем только
  //    когда известна базовая скорость вида.
  if (speciesWalkSpeed != null) {
    let featSpeed = 0;
    for (const f of updated.feats ?? []) {
      const e = FEAT_STAT_EFFECTS[f.nameEn ?? f.name];
      if (e?.speedBonus) featSpeed += e.speedBonus;
    }
    updated.speed = speciesWalkSpeed + featSpeed + getClassSpeedBonus(updated);
  }
  updated.armorClass = resolveAC(updated);
  updated.initiative = computeInitiative(updated);

  return JSON.stringify(updated) === JSON.stringify(char) ? null : updated;
}
