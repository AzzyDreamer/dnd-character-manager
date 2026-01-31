import type { AbilityScores } from '../types';

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

// Вычисление максимального HP
export const calculateMaxHP = (
  level: number,
  constitution: number,
  hitDie: string,
  _classHP?: number
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
