import type { AbilityScores, Character } from '../types';

// Вычислить модификатор характеристики
export const getAbilityModifier = (score: number): number => {
  return Math.floor((score - 10) / 2);
};

// Получить бонус мастерства по уровню
export const getProficiencyBonus = (level: number): number => {
  return Math.ceil(level / 4) + 1;
};

// Вычислить бонус навыка
export const getSkillBonus = (
  abilityScore: number,
  proficient: boolean,
  expertise: boolean,
  proficiencyBonus: number
): number => {
  const abilityMod = getAbilityModifier(abilityScore);
  let bonus = abilityMod;
  
  if (proficient) {
    bonus += proficiencyBonus;
  }
  
  if (expertise) {
    bonus += proficiencyBonus;
  }
  
  return bonus;
};

// Словарь навыков и их связанных характеристик
export const SKILL_ABILITIES: Record<string, keyof AbilityScores> = {
  acrobatics: 'dexterity',
  animalHandling: 'wisdom',
  arcana: 'intelligence',
  athletics: 'strength',
  deception: 'charisma',
  history: 'intelligence',
  insight: 'wisdom',
  intimidation: 'charisma',
  investigation: 'intelligence',
  medicine: 'wisdom',
  nature: 'intelligence',
  perception: 'wisdom',
  performance: 'charisma',
  persuasion: 'charisma',
  religion: 'intelligence',
  sleightOfHand: 'dexterity',
  stealth: 'dexterity',
  survival: 'wisdom'
};

// Русские названия навыков
export const SKILL_NAMES: Record<string, string> = {
  acrobatics: 'Акробатика',
  animalHandling: 'Уход за животными',
  arcana: 'Магия',
  athletics: 'Атлетика',
  deception: 'Обман',
  history: 'История',
  insight: 'Проницательность',
  intimidation: 'Запугивание',
  investigation: 'Анализ',
  medicine: 'Медицина',
  nature: 'Природа',
  perception: 'Восприятие',
  performance: 'Выступление',
  persuasion: 'Убеждение',
  religion: 'Религия',
  sleightOfHand: 'Ловкость рук',
  stealth: 'Скрытность',
  survival: 'Выживание'
};

// Русские названия характеристик
export const ABILITY_NAMES: Record<keyof AbilityScores, string> = {
  strength: 'Сила',
  dexterity: 'Ловкость',
  constitution: 'Телосложение',
  intelligence: 'Интеллект',
  wisdom: 'Мудрость',
  charisma: 'Харизма'
};

// Сокращения характеристик
export const ABILITY_SHORT: Record<keyof AbilityScores, string> = {
  strength: 'СИЛ',
  dexterity: 'ЛОВ',
  constitution: 'ТЕЛ',
  intelligence: 'ИНТ',
  wisdom: 'МДР',
  charisma: 'ХАР'
};

// Вычислить инициативу
export const getInitiative = (dexterity: number): number => {
  return getAbilityModifier(dexterity);
};

// Форматирование модификатора (с плюсом)
export const formatModifier = (modifier: number): string => {
  return modifier >= 0 ? `+${modifier}` : `${modifier}`;
};

// Бросок кости (для генерации характеристик)
export const rollDice = (sides: number, count: number = 1): number => {
  let total = 0;
  for (let i = 0; i < count; i++) {
    total += Math.floor(Math.random() * sides) + 1;
  }
  return total;
};

// Стандартный метод создания характеристик (4d6, убрать наименьший)
export const rollAbilityScore = (): number => {
  const rolls = [
    rollDice(6),
    rollDice(6),
    rollDice(6),
    rollDice(6)
  ].sort((a, b) => a - b);
  
  // Удаляем наименьший и суммируем остальные 3
  return rolls.slice(1).reduce((sum, roll) => sum + roll, 0);
};

// Генерация полного набора характеристик
export const generateAbilityScores = (): AbilityScores => {
  return {
    strength: rollAbilityScore(),
    dexterity: rollAbilityScore(),
    constitution: rollAbilityScore(),
    intelligence: rollAbilityScore(),
    wisdom: rollAbilityScore(),
    charisma: rollAbilityScore()
  };
};

// Стандартный массив для характеристик
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

// Point Buy система
export const POINT_BUY_COSTS: Record<number, number> = {
  8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9,
};
export const POINT_BUY_TOTAL = 27;
export const POINT_BUY_MIN = 8;
export const POINT_BUY_MAX = 15;

export const getPointBuyRemaining = (scores: AbilityScores): number => {
  const spent = Object.values(scores).reduce((sum, score) => {
    const clamped = Math.max(POINT_BUY_MIN, Math.min(POINT_BUY_MAX, score));
    return sum + (POINT_BUY_COSTS[clamped] || 0);
  }, 0);
  return POINT_BUY_TOTAL - spent;
};

export const canIncreasePointBuy = (scores: AbilityScores, ability: keyof AbilityScores): boolean => {
  const current = scores[ability];
  if (current >= POINT_BUY_MAX) return false;
  const nextCost = POINT_BUY_COSTS[current + 1] - POINT_BUY_COSTS[current];
  return getPointBuyRemaining(scores) >= nextCost;
};

export const canDecreasePointBuy = (scores: AbilityScores, ability: keyof AbilityScores): boolean => {
  return scores[ability] > POINT_BUY_MIN;
};

// Вычисление максимального HP
export const calculateMaxHP = (
  level: number,
  constitution: number,
  hitDie: string,
): number => {
  const conMod = getAbilityModifier(constitution);
  const hitDieValue = parseInt(hitDie.replace('d', ''));
  
  // Первый уровень: максимум хитов + модификатор телосложения
  const firstLevelHP = hitDieValue + conMod;
  
  // Последующие уровни: среднее значение хита (округлено вверх) + модификатор
  const avgHitDie = Math.ceil(hitDieValue / 2) + 1;
  const additionalLevels = level - 1;
  const additionalHP = additionalLevels * (avgHitDie + conMod);
  
  return firstLevelHP + additionalHP;
};

// Маппинг коротких ключей характеристик к полным (для feat пререквизитов)
export const ABILITY_SHORT_TO_LONG: Record<string, keyof AbilityScores> = {
  str: 'strength',
  dex: 'dexterity',
  con: 'constitution',
  int: 'intelligence',
  wis: 'wisdom',
  cha: 'charisma',
};

// Пересчёт производных статов после изменения характеристик (ASI/feat)
export function recalcDerivedStats(char: Character): void {
  if (char.spellcasting) {
    const abilityMod = getAbilityModifier(char.abilityScores[char.spellcasting.ability]);
    char.spellcasting = {
      ...char.spellcasting,
      spellSaveDC: 8 + char.proficiencyBonus + abilityMod,
      spellAttackBonus: char.proficiencyBonus + abilityMod,
    };
  }

  // Recalculate initiative (includes Alert feat bonus)
  const dexMod = getAbilityModifier(char.abilityScores.dexterity);
  const hasAlert = (char.feats ?? []).some(f => f.name === 'Alert');
  char.initiative = dexMod + (hasAlert ? char.proficiencyBonus : 0);
}
