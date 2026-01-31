import type { AbilityScores } from '../types';

export interface RaceTraitDefinition {
  name: string;
  description: string;
}

export interface SubraceDefinition {
  id: string;
  name: string;
  description: string;
  abilityBonuses: Partial<AbilityScores>;
  traits: RaceTraitDefinition[];
}

export interface RaceDefinition {
  id: string;
  name: string;
  speed: number;
  size: string;
  abilityBonuses: Partial<AbilityScores>;
  totalBonusPoints: number;
  traits: RaceTraitDefinition[];
  languages: string[];
  description: string;
  source: string;
  subraces?: SubraceDefinition[];
}

export const RACE_REGISTRY: RaceDefinition[] = [
  {
    id: 'human',
    name: 'Человек',
    speed: 30,
    size: 'Средний',
    abilityBonuses: { strength: 1, dexterity: 1, constitution: 1, intelligence: 1, wisdom: 1, charisma: 1 },
    totalBonusPoints: 6,
    traits: [
      { name: 'Дополнительный язык', description: 'Вы знаете один дополнительный язык по вашему выбору.' },
      { name: 'Дополнительный навык', description: 'Вы владеете одним дополнительным навыком по вашему выбору.' },
    ],
    languages: ['Общий', 'Один на выбор'],
    description: 'Самая распространённая и адаптивная раса. Люди отличаются разнообразием, амбициями и короткой, но яркой жизнью.',
    source: "Player's Handbook",
  },
  {
    id: 'elf',
    name: 'Эльф',
    speed: 30,
    size: 'Средний',
    abilityBonuses: { dexterity: 2 },
    totalBonusPoints: 3,
    traits: [
      { name: 'Тёмное зрение', description: 'Вы видите в темноте на 60 футов.' },
      { name: 'Обострённые чувства', description: 'Вы владеете навыком Восприятие.' },
      { name: 'Наследие фей', description: 'Вы имеете преимущество на спасброски от очарования, и магия не может усыпить вас.' },
      { name: 'Транс', description: 'Вам не нужно спать. Вместо этого вы медитируете 4 часа.' },
    ],
    languages: ['Общий', 'Эльфийский'],
    description: 'Древняя раса с изяществом и долголетием. Эльфы живут веками, ценят магию и природу.',
    source: "Player's Handbook",
    subraces: [
      {
        id: 'high-elf',
        name: 'Высший эльф',
        description: 'Высшие эльфы обладают острым умом и владеют основами магии.',
        abilityBonuses: { intelligence: 1 },
        traits: [
          { name: 'Заговор', description: 'Вы знаете один заговор из списка волшебника.' },
          { name: 'Дополнительный язык', description: 'Вы знаете один дополнительный язык.' },
        ],
      },
      {
        id: 'wood-elf',
        name: 'Лесной эльф',
        description: 'Лесные эльфы быстры и скрытны, живут в гармонии с дикой природой.',
        abilityBonuses: { wisdom: 1 },
        traits: [
          { name: 'Быстрые ноги', description: 'Ваша базовая скорость 35 футов.' },
          { name: 'Маскировка в дикой природе', description: 'Вы можете попытаться спрятаться в слабо заслонённой природной среде.' },
        ],
      },
      {
        id: 'drow',
        name: 'Тёмный эльф (Дроу)',
        description: 'Изгнанники, живущие в подземных городах. Обладают врождённой магией тьмы.',
        abilityBonuses: { charisma: 1 },
        traits: [
          { name: 'Улучшенное тёмное зрение', description: 'Тёмное зрение на 120 футов.' },
          { name: 'Чувствительность к свету', description: 'Помеха на броски атаки и Восприятие при ярком свете.' },
          { name: 'Магия дроу', description: 'Вы знаете заговор Пляшущий огонёк.' },
        ],
      },
    ],
  },
  {
    id: 'dwarf',
    name: 'Дворф',
    speed: 25,
    size: 'Средний',
    abilityBonuses: { constitution: 2 },
    totalBonusPoints: 3,
    traits: [
      { name: 'Тёмное зрение', description: 'Вы видите в темноте на 60 футов.' },
      { name: 'Дворфийская устойчивость', description: 'Преимущество на спасброски от яда и сопротивление урону ядом.' },
      { name: 'Владение оружием', description: 'Владение боевым топором, ручным топором, лёгким молотом и боевым молотом.' },
      { name: 'Работа с камнем', description: 'Удвоенный бонус мастерства для проверок Истории, связанных с камнем.' },
    ],
    languages: ['Общий', 'Дворфийский'],
    description: 'Крепкий и стойкий народ, живущий в горных крепостях. Мастера кузнечного дела и горного промысла.',
    source: "Player's Handbook",
    subraces: [
      {
        id: 'hill-dwarf',
        name: 'Холмовой дворф',
        description: 'Мудрые и выносливые, с обострённой интуицией.',
        abilityBonuses: { wisdom: 1 },
        traits: [
          { name: 'Дворфийская выносливость', description: 'Максимум хитов увеличивается на 1 за каждый уровень.' },
        ],
      },
      {
        id: 'mountain-dwarf',
        name: 'Горный дворф',
        description: 'Сильные и закалённые, привыкшие к суровым условиям.',
        abilityBonuses: { strength: 2 },
        traits: [
          { name: 'Владение доспехами', description: 'Вы владеете лёгкими и средними доспехами.' },
        ],
      },
    ],
  },
  {
    id: 'halfling',
    name: 'Полурослик',
    speed: 25,
    size: 'Маленький',
    abilityBonuses: { dexterity: 2 },
    totalBonusPoints: 3,
    traits: [
      { name: 'Удачливый', description: 'При выпадении 1 на d20 можно перебросить кость.' },
      { name: 'Храбрый', description: 'Преимущество на спасброски от испуга.' },
      { name: 'Проворство полурослика', description: 'Вы можете проходить через пространство существ большего размера.' },
    ],
    languages: ['Общий', 'Полуросликов'],
    description: 'Маленький и жизнерадостный народ, ценящий комфорт и простые радости. Удивительно удачливы.',
    source: "Player's Handbook",
    subraces: [
      {
        id: 'lightfoot',
        name: 'Легконогий',
        description: 'Общительные и обаятельные, легко прячутся за другими существами.',
        abilityBonuses: { charisma: 1 },
        traits: [
          { name: 'Естественная скрытность', description: 'Вы можете прятаться за существами размером больше вас.' },
        ],
      },
      {
        id: 'stout',
        name: 'Крепыш',
        description: 'Выносливые и стойкие, с устойчивостью к ядам.',
        abilityBonuses: { constitution: 1 },
        traits: [
          { name: 'Устойчивость крепыша', description: 'Преимущество на спасброски от яда и сопротивление урону ядом.' },
        ],
      },
    ],
  },
  {
    id: 'dragonborn',
    name: 'Драконорожденный',
    speed: 30,
    size: 'Средний',
    abilityBonuses: { strength: 2, charisma: 1 },
    totalBonusPoints: 3,
    traits: [
      { name: 'Наследие дракона', description: 'Выберите тип дракона — это определяет тип урона вашего дыхания и сопротивление.' },
      { name: 'Оружие дыхания', description: 'Вы можете использовать действие, чтобы выдохнуть разрушительную энергию (2d6 урон, КС 8 + ТЕЛ + бонус мастерства).' },
      { name: 'Сопротивление урону', description: 'Сопротивление типу урона, связанному с вашим драконьим наследием.' },
    ],
    languages: ['Общий', 'Драконий'],
    description: 'Потомки драконов с чешуйчатой кожей и оружием дыхания. Горды и обладают внутренним огнём.',
    source: "Player's Handbook",
  },
  {
    id: 'gnome',
    name: 'Гном',
    speed: 25,
    size: 'Маленький',
    abilityBonuses: { intelligence: 2 },
    totalBonusPoints: 3,
    traits: [
      { name: 'Тёмное зрение', description: 'Вы видите в темноте на 60 футов.' },
      { name: 'Гномья хитрость', description: 'Преимущество на спасброски Интеллекта, Мудрости и Харизмы от магии.' },
    ],
    languages: ['Общий', 'Гномий'],
    description: 'Любопытный и изобретательный маленький народ. Обожают знания, механизмы и шутки.',
    source: "Player's Handbook",
    subraces: [
      {
        id: 'forest-gnome',
        name: 'Лесной гном',
        description: 'Скрытные и связанные с природой, могут общаться с мелкими зверями.',
        abilityBonuses: { dexterity: 1 },
        traits: [
          { name: 'Природная иллюзия', description: 'Вы знаете заговор Малая иллюзия (Интеллект).' },
          { name: 'Речь зверей', description: 'Вы можете общаться с мелкими зверями.' },
        ],
      },
      {
        id: 'rock-gnome',
        name: 'Скальный гном',
        description: 'Прирождённые изобретатели и мастера механизмов.',
        abilityBonuses: { constitution: 1 },
        traits: [
          { name: 'Знание ремесленника', description: 'Удвоенный бонус мастерства к проверкам Истории о магических и механических предметах.' },
          { name: 'Мастер на все руки', description: 'Вы можете создавать крошечные заводные устройства.' },
        ],
      },
    ],
  },
  {
    id: 'half-elf',
    name: 'Полуэльф',
    speed: 30,
    size: 'Средний',
    abilityBonuses: { charisma: 2 },
    totalBonusPoints: 4,
    traits: [
      { name: 'Тёмное зрение', description: 'Вы видите в темноте на 60 футов.' },
      { name: 'Наследие фей', description: 'Преимущество на спасброски от очарования, и магия не может усыпить вас.' },
      { name: 'Универсальность', description: 'Вы владеете двумя дополнительными навыками по вашему выбору.' },
      { name: 'Бонус характеристик', description: '+2 к Харизме и +1 к двум другим характеристикам на ваш выбор.' },
    ],
    languages: ['Общий', 'Эльфийский', 'Один на выбор'],
    description: 'Дети двух миров, сочетающие черты людей и эльфов. Обаятельны и универсальны.',
    source: "Player's Handbook",
  },
  {
    id: 'half-orc',
    name: 'Полуорк',
    speed: 30,
    size: 'Средний',
    abilityBonuses: { strength: 2, constitution: 1 },
    totalBonusPoints: 3,
    traits: [
      { name: 'Тёмное зрение', description: 'Вы видите в темноте на 60 футов.' },
      { name: 'Угрожающий', description: 'Вы владеете навыком Запугивание.' },
      { name: 'Непоколебимая стойкость', description: 'При снижении до 0 хитов вы можете упасть до 1 хита вместо этого (1 раз между отдыхами).' },
      { name: 'Дикие атаки', description: 'При критическом попадании бросьте один дополнительный кубик урона оружия.' },
    ],
    languages: ['Общий', 'Орочий'],
    description: 'Мощные и выносливые, несущие наследие обоих народов. Стремятся доказать свою ценность.',
    source: "Player's Handbook",
  },
  {
    id: 'tiefling',
    name: 'Тифлинг',
    speed: 30,
    size: 'Средний',
    abilityBonuses: { charisma: 2, intelligence: 1 },
    totalBonusPoints: 3,
    traits: [
      { name: 'Тёмное зрение', description: 'Вы видите в темноте на 60 футов.' },
      { name: 'Адское сопротивление', description: 'Сопротивление урону огнём.' },
      { name: 'Адское наследие', description: 'Вы знаете заговор Чудотворство. На 3 уровне — Адское возмездие. На 5 уровне — Тьма.' },
    ],
    languages: ['Общий', 'Инфернальный'],
    description: 'Потомки смертных и демонов, отмеченные рогами, хвостом и адской кровью. Часто встречают предубеждение.',
    source: "Player's Handbook",
  },
];

export const getRaceById = (id: string): RaceDefinition | undefined =>
  RACE_REGISTRY.find(r => r.id === id);

export const getRaceByName = (name: string): RaceDefinition | undefined =>
  RACE_REGISTRY.find(r => r.name === name);

export const getTotalRacialBonus = (race: RaceDefinition, subrace?: SubraceDefinition): number => {
  let total = Object.values(race.abilityBonuses).reduce((sum, v) => sum + (v || 0), 0);
  if (subrace) {
    total += Object.values(subrace.abilityBonuses).reduce((sum, v) => sum + (v || 0), 0);
  }
  return total;
};

export const getRacialBonuses = (race: RaceDefinition, subrace?: SubraceDefinition): Partial<AbilityScores> => {
  const bonuses: Partial<AbilityScores> = { ...race.abilityBonuses };
  if (subrace) {
    for (const [key, value] of Object.entries(subrace.abilityBonuses)) {
      const k = key as keyof AbilityScores;
      bonuses[k] = (bonuses[k] || 0) + (value || 0);
    }
  }
  return bonuses;
};
