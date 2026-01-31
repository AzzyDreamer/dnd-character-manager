import type { AbilityScores } from '../types';

export interface SubclassDefinition {
  id: string;
  name: string;
  description: string;
  source: string;
  level: number;
}

export interface ClassDefinition {
  id: string;
  name: string;
  hitDie: string;
  primaryAbility: (keyof AbilityScores)[];
  savingThrows: (keyof AbilityScores)[];
  spellcaster: boolean;
  spellcastingAbility?: 'intelligence' | 'wisdom' | 'charisma';
  description: string;
  source: string;
  subclasses: SubclassDefinition[];
  proficiencies: {
    armor: string[];
    weapons: string[];
    tools: string[];
    skillChoices: { count: number; from: string[] };
  };
}

export const CLASS_REGISTRY: ClassDefinition[] = [
  {
    id: 'barbarian',
    name: 'Варвар',
    hitDie: 'd12',
    primaryAbility: ['strength'],
    savingThrows: ['strength', 'constitution'],
    spellcaster: false,
    description: 'Свирепый воин, черпающий силу из первобытной ярости. В бою входит в состояние неудержимого гнева.',
    source: "Player's Handbook",
    subclasses: [
      { id: 'berserker', name: 'Путь Берсерка', description: 'Безудержная ярость, позволяющая сражаться до последнего вздоха.', source: 'PHB', level: 3 },
      { id: 'totem-warrior', name: 'Путь Тотемного Воина', description: 'Духовный путь, связывающий варвара с животным-тотемом.', source: 'PHB', level: 3 },
      { id: 'ancestral-guardian', name: 'Путь Предков', description: 'Призывает духов предков для защиты союзников.', source: "Xanathar's Guide", level: 3 },
      { id: 'storm-herald', name: 'Путь Буревестника', description: 'Ярость варвара порождает магическую ауру стихий.', source: "Xanathar's Guide", level: 3 },
      { id: 'zealot', name: 'Путь Фанатика', description: 'Воин, наполненный божественной яростью и стойкостью.', source: "Xanathar's Guide", level: 3 },
    ],
    proficiencies: {
      armor: ['Лёгкие доспехи', 'Средние доспехи', 'Щиты'],
      weapons: ['Простое оружие', 'Воинское оружие'],
      tools: [],
      skillChoices: { count: 2, from: ['animalHandling', 'athletics', 'intimidation', 'nature', 'perception', 'survival'] },
    },
  },
  {
    id: 'bard',
    name: 'Бард',
    hitDie: 'd8',
    primaryAbility: ['charisma'],
    savingThrows: ['dexterity', 'charisma'],
    spellcaster: true,
    spellcastingAbility: 'charisma',
    description: 'Вдохновляющий маг, чья сила проистекает из музыки и слов. Мастер на все руки.',
    source: "Player's Handbook",
    subclasses: [
      { id: 'lore', name: 'Коллегия Знаний', description: 'Собиратель знаний, владеющий разнообразными навыками.', source: 'PHB', level: 3 },
      { id: 'valor', name: 'Коллегия Доблести', description: 'Воинственный бард, вдохновляющий союзников на подвиги.', source: 'PHB', level: 3 },
      { id: 'glamour', name: 'Коллегия Гламура', description: 'Очаровывающий бард с магией Страны Фей.', source: "Xanathar's Guide", level: 3 },
      { id: 'swords', name: 'Коллегия Мечей', description: 'Мастер клинка, сочетающий фехтование с магией.', source: "Xanathar's Guide", level: 3 },
      { id: 'whispers', name: 'Коллегия Шёпотов', description: 'Тайный агент, использующий страхи и секреты.', source: "Xanathar's Guide", level: 3 },
    ],
    proficiencies: {
      armor: ['Лёгкие доспехи'],
      weapons: ['Простое оружие', 'Ручные арбалеты', 'Длинные мечи', 'Рапиры', 'Короткие мечи'],
      tools: ['Три музыкальных инструмента'],
      skillChoices: { count: 3, from: ['acrobatics', 'animalHandling', 'arcana', 'athletics', 'deception', 'history', 'insight', 'intimidation', 'investigation', 'medicine', 'nature', 'perception', 'performance', 'persuasion', 'religion', 'sleightOfHand', 'stealth', 'survival'] },
    },
  },
  {
    id: 'cleric',
    name: 'Жрец',
    hitDie: 'd8',
    primaryAbility: ['wisdom'],
    savingThrows: ['wisdom', 'charisma'],
    spellcaster: true,
    spellcastingAbility: 'wisdom',
    description: 'Божественный заклинатель, служащий высшей силе. Целитель и защитник веры.',
    source: "Player's Handbook",
    subclasses: [
      { id: 'life', name: 'Домен Жизни', description: 'Непревзойдённый целитель, благословлённый силой исцеления.', source: 'PHB', level: 3 },
      { id: 'light', name: 'Домен Света', description: 'Несёт свет и огонь, изгоняя тьму.', source: 'PHB', level: 3 },
      { id: 'tempest', name: 'Домен Бури', description: 'Повелевает грозами и разрушительными стихиями.', source: 'PHB', level: 3 },
      { id: 'war', name: 'Домен Войны', description: 'Воитель веры, благословлённый на битву.', source: 'PHB', level: 3 },
      { id: 'knowledge', name: 'Домен Знаний', description: 'Хранитель тайного знания и мудрости.', source: 'PHB', level: 3 },
      { id: 'trickery', name: 'Домен Обмана', description: 'Агент хаоса, мастер иллюзий и хитрости.', source: 'PHB', level: 3 },
      { id: 'forge', name: 'Домен Кузни', description: 'Мастер огня и металла, создатель магических предметов.', source: "Xanathar's Guide", level: 3 },
      { id: 'grave', name: 'Домен Могилы', description: 'Страж границы между жизнью и смертью.', source: "Xanathar's Guide", level: 3 },
    ],
    proficiencies: {
      armor: ['Лёгкие доспехи', 'Средние доспехи', 'Щиты'],
      weapons: ['Простое оружие'],
      tools: [],
      skillChoices: { count: 2, from: ['history', 'insight', 'medicine', 'persuasion', 'religion'] },
    },
  },
  {
    id: 'druid',
    name: 'Друид',
    hitDie: 'd8',
    primaryAbility: ['wisdom'],
    savingThrows: ['intelligence', 'wisdom'],
    spellcaster: true,
    spellcastingAbility: 'wisdom',
    description: 'Хранитель природы, черпающий магию из первозданных сил мира. Может принимать облик зверей.',
    source: "Player's Handbook",
    subclasses: [
      { id: 'land', name: 'Круг Земли', description: 'Мистик, связанный с определённой местностью.', source: 'PHB', level: 3 },
      { id: 'moon', name: 'Круг Луны', description: 'Мастер дикого облика, способный обращаться в могучих зверей.', source: 'PHB', level: 3 },
      { id: 'shepherd', name: 'Круг Пастыря', description: 'Призыватель духов природы и защитник животных.', source: "Xanathar's Guide", level: 3 },
      { id: 'spores', name: 'Круг Спор', description: 'Повелевает силами разложения и возрождения.', source: "Tasha's Cauldron", level: 3 },
    ],
    proficiencies: {
      armor: ['Лёгкие доспехи', 'Средние доспехи', 'Щиты (не металлические)'],
      weapons: ['Дубинки', 'Кинжалы', 'Дротики', 'Копья', 'Булавы', 'Боевые посохи', 'Серпы', 'Пращи'],
      tools: ['Набор травника'],
      skillChoices: { count: 2, from: ['arcana', 'animalHandling', 'insight', 'medicine', 'nature', 'perception', 'religion', 'survival'] },
    },
  },
  {
    id: 'fighter',
    name: 'Воин',
    hitDie: 'd10',
    primaryAbility: ['strength', 'dexterity'],
    savingThrows: ['strength', 'constitution'],
    spellcaster: false,
    description: 'Мастер боевых искусств, владеющий любым оружием и доспехами. Непревзойдённый тактик.',
    source: "Player's Handbook",
    subclasses: [
      { id: 'champion', name: 'Чемпион', description: 'Совершенный атлет с повышенными критическими ударами.', source: 'PHB', level: 3 },
      { id: 'battlemaster', name: 'Мастер Боевых Искусств', description: 'Тактик, использующий боевые манёвры.', source: 'PHB', level: 3 },
      { id: 'eldritch-knight', name: 'Мистический Рыцарь', description: 'Воин, сочетающий фехтование с магией.', source: 'PHB', level: 3 },
      { id: 'samurai', name: 'Самурай', description: 'Воин с несгибаемой волей и смертоносной точностью.', source: "Xanathar's Guide", level: 3 },
      { id: 'echo-knight', name: 'Рыцарь Эха', description: 'Призывает эхо из параллельной реальности для боя.', source: "Explorer's Guide to Wildemount", level: 3 },
    ],
    proficiencies: {
      armor: ['Все доспехи', 'Щиты'],
      weapons: ['Простое оружие', 'Воинское оружие'],
      tools: [],
      skillChoices: { count: 2, from: ['acrobatics', 'animalHandling', 'athletics', 'history', 'insight', 'intimidation', 'perception', 'survival'] },
    },
  },
  {
    id: 'monk',
    name: 'Монах',
    hitDie: 'd8',
    primaryAbility: ['dexterity', 'wisdom'],
    savingThrows: ['strength', 'dexterity'],
    spellcaster: false,
    description: 'Мастер боевых искусств, использующий внутреннюю энергию ки для невероятных подвигов.',
    source: "Player's Handbook",
    subclasses: [
      { id: 'open-hand', name: 'Путь Открытой Ладони', description: 'Мастер рукопашного боя с разрушительными приёмами.', source: 'PHB', level: 3 },
      { id: 'shadow', name: 'Путь Тени', description: 'Воин-тень, мастер скрытности и тёмных искусств.', source: 'PHB', level: 3 },
      { id: 'four-elements', name: 'Путь Четырёх Стихий', description: 'Управляет стихиями через ки.', source: 'PHB', level: 3 },
      { id: 'kensei', name: 'Путь Кенсей', description: 'Мастер оружия, превращающий клинок в продолжение себя.', source: "Xanathar's Guide", level: 3 },
      { id: 'mercy', name: 'Путь Милосердия', description: 'Целитель и воин, манипулирующий жизненной энергией.', source: "Tasha's Cauldron", level: 3 },
    ],
    proficiencies: {
      armor: [],
      weapons: ['Простое оружие', 'Короткие мечи'],
      tools: ['Один инструмент ремесленника или музыкальный инструмент'],
      skillChoices: { count: 2, from: ['acrobatics', 'athletics', 'history', 'insight', 'religion', 'stealth'] },
    },
  },
  {
    id: 'paladin',
    name: 'Паладин',
    hitDie: 'd10',
    primaryAbility: ['strength', 'charisma'],
    savingThrows: ['wisdom', 'charisma'],
    spellcaster: true,
    spellcastingAbility: 'charisma',
    description: 'Святой воин, связанный священной клятвой. Сочетает божественную магию с боевым мастерством.',
    source: "Player's Handbook",
    subclasses: [
      { id: 'devotion', name: 'Клятва Преданности', description: 'Идеал рыцарства и справедливости.', source: 'PHB', level: 3 },
      { id: 'ancients', name: 'Клятва Древних', description: 'Защитник света и живого мира.', source: 'PHB', level: 3 },
      { id: 'vengeance', name: 'Клятва Мести', description: 'Неутомимый каратель, преследующий зло.', source: 'PHB', level: 3 },
      { id: 'conquest', name: 'Клятва Завоевания', description: 'Воин, подавляющий врагов страхом и силой.', source: "Xanathar's Guide", level: 3 },
      { id: 'redemption', name: 'Клятва Искупления', description: 'Миротворец, стремящийся спасти даже злодеев.', source: "Xanathar's Guide", level: 3 },
      { id: 'oathbreaker', name: 'Клятвопреступник', description: 'Падший паладин, черпающий силу из тьмы.', source: 'DMG', level: 3 },
    ],
    proficiencies: {
      armor: ['Все доспехи', 'Щиты'],
      weapons: ['Простое оружие', 'Воинское оружие'],
      tools: [],
      skillChoices: { count: 2, from: ['athletics', 'insight', 'intimidation', 'medicine', 'persuasion', 'religion'] },
    },
  },
  {
    id: 'ranger',
    name: 'Следопыт',
    hitDie: 'd10',
    primaryAbility: ['dexterity', 'wisdom'],
    savingThrows: ['strength', 'dexterity'],
    spellcaster: true,
    spellcastingAbility: 'wisdom',
    description: 'Воин дикой природы, мастер выживания и следопытства. Непревзойдённый охотник.',
    source: "Player's Handbook",
    subclasses: [
      { id: 'hunter', name: 'Охотник', description: 'Мастер охоты на опасную добычу.', source: 'PHB', level: 3 },
      { id: 'beast-master', name: 'Повелитель Зверей', description: 'Сражается бок о бок с верным животным-компаньоном.', source: 'PHB', level: 3 },
      { id: 'gloom-stalker', name: 'Мрачный Скиталец', description: 'Охотник во тьме, невидимый для врагов.', source: "Xanathar's Guide", level: 3 },
      { id: 'horizon-walker', name: 'Странник Горизонта', description: 'Страж между планами бытия.', source: "Xanathar's Guide", level: 3 },
      { id: 'swarmkeeper', name: 'Хранитель Роя', description: 'Управляет роем духов природы.', source: "Tasha's Cauldron", level: 3 },
    ],
    proficiencies: {
      armor: ['Лёгкие доспехи', 'Средние доспехи', 'Щиты'],
      weapons: ['Простое оружие', 'Воинское оружие'],
      tools: [],
      skillChoices: { count: 3, from: ['animalHandling', 'athletics', 'insight', 'investigation', 'nature', 'perception', 'stealth', 'survival'] },
    },
  },
  {
    id: 'rogue',
    name: 'Плут',
    hitDie: 'd8',
    primaryAbility: ['dexterity'],
    savingThrows: ['dexterity', 'intelligence'],
    spellcaster: false,
    description: 'Ловкий специалист, полагающийся на хитрость и точные удары. Мастер скрытности и обмана.',
    source: "Player's Handbook",
    subclasses: [
      { id: 'thief', name: 'Вор', description: 'Мастер проникновения и ловкости рук.', source: 'PHB', level: 3 },
      { id: 'assassin', name: 'Убийца', description: 'Смертоносный агент, мастер внезапных атак.', source: 'PHB', level: 3 },
      { id: 'arcane-trickster', name: 'Мистический Ловкач', description: 'Плут, освоивший магию иллюзий и очарования.', source: 'PHB', level: 3 },
      { id: 'swashbuckler', name: 'Дуэлянт', description: 'Отважный фехтовальщик с харизмой и грацией.', source: "Xanathar's Guide", level: 3 },
      { id: 'phantom', name: 'Фантом', description: 'Плут, связанный с миром мёртвых.', source: "Tasha's Cauldron", level: 3 },
      { id: 'soulknife', name: 'Нож Души', description: 'Использует псионическую энергию для создания клинков.', source: "Tasha's Cauldron", level: 3 },
    ],
    proficiencies: {
      armor: ['Лёгкие доспехи'],
      weapons: ['Простое оружие', 'Ручные арбалеты', 'Длинные мечи', 'Рапиры', 'Короткие мечи'],
      tools: ['Воровские инструменты'],
      skillChoices: { count: 4, from: ['acrobatics', 'athletics', 'deception', 'insight', 'intimidation', 'investigation', 'perception', 'performance', 'persuasion', 'sleightOfHand', 'stealth'] },
    },
  },
  {
    id: 'sorcerer',
    name: 'Чародей',
    hitDie: 'd6',
    primaryAbility: ['charisma'],
    savingThrows: ['constitution', 'charisma'],
    spellcaster: true,
    spellcastingAbility: 'charisma',
    description: 'Врождённый маг, чья сила проистекает из крови или судьбы. Управляет сырой магической энергией.',
    source: "Player's Handbook",
    subclasses: [
      { id: 'draconic', name: 'Драконья Кровь', description: 'Магия древних драконов течёт в ваших жилах.', source: 'PHB', level: 3 },
      { id: 'wild-magic', name: 'Дикая Магия', description: 'Хаотическая сила, непредсказуемая и разрушительная.', source: 'PHB', level: 3 },
      { id: 'divine-soul', name: 'Божественная Душа', description: 'Божественная искра даёт доступ к жреческим заклинаниям.', source: "Xanathar's Guide", level: 3 },
      { id: 'shadow', name: 'Теневая Магия', description: 'Связь с Царством Теней наделяет тёмной силой.', source: "Xanathar's Guide", level: 3 },
      { id: 'aberrant-mind', name: 'Аберрантный Разум', description: 'Псионическая сила из контакта с чуждыми сущностями.', source: "Tasha's Cauldron", level: 3 },
      { id: 'clockwork-soul', name: 'Заводная Душа', description: 'Сила порядка Механуса течёт через вас.', source: "Tasha's Cauldron", level: 3 },
    ],
    proficiencies: {
      armor: [],
      weapons: ['Кинжалы', 'Дротики', 'Пращи', 'Боевые посохи', 'Лёгкие арбалеты'],
      tools: [],
      skillChoices: { count: 2, from: ['arcana', 'deception', 'insight', 'intimidation', 'persuasion', 'religion'] },
    },
  },
  {
    id: 'warlock',
    name: 'Колдун',
    hitDie: 'd8',
    primaryAbility: ['charisma'],
    savingThrows: ['wisdom', 'charisma'],
    spellcaster: true,
    spellcastingAbility: 'charisma',
    description: 'Маг, заключивший пакт с могущественной сущностью. Получает уникальные силы от своего покровителя.',
    source: "Player's Handbook",
    subclasses: [
      { id: 'archfey', name: 'Архифея', description: 'Покровитель из Страны Фей с чарующей магией.', source: 'PHB', level: 3 },
      { id: 'fiend', name: 'Исчадие', description: 'Пакт с демоном или дьяволом, дающий разрушительную силу.', source: 'PHB', level: 3 },
      { id: 'great-old-one', name: 'Великий Древний', description: 'Контакт с непостижимой сущностью из глубин космоса.', source: 'PHB', level: 3 },
      { id: 'celestial', name: 'Небожитель', description: 'Покровитель из верхних планов, дающий целительную силу.', source: "Xanathar's Guide", level: 3 },
      { id: 'hexblade', name: 'Ведьмин Клинок', description: 'Пакт с таинственным оружием из Царства Теней.', source: "Xanathar's Guide", level: 3 },
      { id: 'fathomless', name: 'Бездонный', description: 'Покровитель из глубин океана с тёмной водной магией.', source: "Tasha's Cauldron", level: 3 },
    ],
    proficiencies: {
      armor: ['Лёгкие доспехи'],
      weapons: ['Простое оружие'],
      tools: [],
      skillChoices: { count: 2, from: ['arcana', 'deception', 'history', 'intimidation', 'investigation', 'nature', 'religion'] },
    },
  },
  {
    id: 'wizard',
    name: 'Волшебник',
    hitDie: 'd6',
    primaryAbility: ['intelligence'],
    savingThrows: ['intelligence', 'wisdom'],
    spellcaster: true,
    spellcastingAbility: 'intelligence',
    description: 'Учёный маг, постигающий тайны мироздания через изучение заклинаний. Самый универсальный заклинатель.',
    source: "Player's Handbook",
    subclasses: [
      { id: 'abjuration', name: 'Школа Ограждения', description: 'Мастер защитной магии и магических барьеров.', source: 'PHB', level: 3 },
      { id: 'conjuration', name: 'Школа Вызова', description: 'Призывает существ и создаёт предметы из ничего.', source: 'PHB', level: 3 },
      { id: 'divination', name: 'Школа Прорицания', description: 'Видит будущее и управляет вероятностями.', source: 'PHB', level: 3 },
      { id: 'enchantment', name: 'Школа Очарования', description: 'Управляет разумом и эмоциями.', source: 'PHB', level: 3 },
      { id: 'evocation', name: 'Школа Воплощения', description: 'Мастер разрушительной стихийной магии.', source: 'PHB', level: 3 },
      { id: 'illusion', name: 'Школа Иллюзий', description: 'Создаёт обманчивые образы и искажает реальность.', source: 'PHB', level: 3 },
      { id: 'necromancy', name: 'Школа Некромантии', description: 'Управляет силами жизни и смерти.', source: 'PHB', level: 3 },
      { id: 'transmutation', name: 'Школа Преобразования', description: 'Изменяет свойства материи и энергии.', source: 'PHB', level: 3 },
      { id: 'war-magic', name: 'Школа Военной Магии', description: 'Сочетает атакующую и защитную магию в бою.', source: "Xanathar's Guide", level: 3 },
      { id: 'chronurgy', name: 'Хронургия', description: 'Манипулирует временем и вероятностями.', source: "Explorer's Guide to Wildemount", level: 3 },
    ],
    proficiencies: {
      armor: [],
      weapons: ['Кинжалы', 'Дротики', 'Пращи', 'Боевые посохи', 'Лёгкие арбалеты'],
      tools: [],
      skillChoices: { count: 2, from: ['arcana', 'history', 'insight', 'investigation', 'medicine', 'religion'] },
    },
  },
  {
    id: 'artificer',
    name: 'Изобретатель',
    hitDie: 'd8',
    primaryAbility: ['intelligence'],
    savingThrows: ['constitution', 'intelligence'],
    spellcaster: true,
    spellcastingAbility: 'intelligence',
    description: 'Мастер магических изобретений, вплетающий заклинания в предметы. Создаёт устройства, оружие и броню с магическими свойствами.',
    source: "Tasha's Cauldron of Everything",
    subclasses: [
      { id: 'alchemist', name: 'Алхимик', description: 'Создаёт магические эликсиры и зелья с чудесными свойствами.', source: "Tasha's Cauldron", level: 3 },
      { id: 'armorer', name: 'Бронник', description: 'Превращает доспехи в мощный магический экзоскелет.', source: "Tasha's Cauldron", level: 3 },
      { id: 'artillerist', name: 'Артиллерист', description: 'Создаёт магические пушки-конструкты для огневой поддержки.', source: "Tasha's Cauldron", level: 3 },
      { id: 'battle-smith', name: 'Боевой Кузнец', description: 'Сражается вместе со стальным защитником-конструктом.', source: "Tasha's Cauldron", level: 3 },
    ],
    proficiencies: {
      armor: ['Лёгкие доспехи', 'Средние доспехи', 'Щиты'],
      weapons: ['Простое оружие'],
      tools: ['Воровские инструменты', 'Инструменты ремесленника', 'Набор алхимика'],
      skillChoices: { count: 2, from: ['arcana', 'history', 'investigation', 'medicine', 'nature', 'perception', 'sleightOfHand'] },
    },
  },
  {
    id: 'monster-hunter',
    name: 'Охотник на монстров',
    hitDie: 'd10',
    primaryAbility: ['wisdom', 'dexterity'],
    savingThrows: ['dexterity', 'wisdom'],
    spellcaster: true,
    spellcastingAbility: 'wisdom',
    description: 'Закалённый охотник, посвятивший жизнь уничтожению сверхъестественных угроз. Использует знания о монстрах и древние техники для выслеживания и уничтожения порождений тьмы.',
    source: "Grim Hollow: Player's Guide (2024)",
    subclasses: [
      { id: 'crimson-order', name: 'Кровавый Орден', description: 'Использует запретную кровавую магию, жертвуя собственной жизненной силой для уничтожения монстров.', source: "Grim Hollow", level: 3 },
      { id: 'silver-order', name: 'Серебряный Орден', description: 'Мастер серебряного оружия и святых ритуалов, специализирующийся на охоте на нежить и оборотней.', source: "Grim Hollow", level: 3 },
      { id: 'twilight-order', name: 'Сумеречный Орден', description: 'Охотник из теней, мастер засад и скрытных операций против тёмных тварей.', source: "Grim Hollow", level: 3 },
      { id: 'pyre-order', name: 'Орден Костра', description: 'Повелевает очищающим пламенем, выжигая скверну и проклятия из мира.', source: "Grim Hollow", level: 3 },
    ],
    proficiencies: {
      armor: ['Лёгкие доспехи', 'Средние доспехи'],
      weapons: ['Простое оружие', 'Воинское оружие'],
      tools: ['Набор алхимика', 'Набор травника'],
      skillChoices: { count: 3, from: ['arcana', 'athletics', 'insight', 'investigation', 'medicine', 'nature', 'perception', 'religion', 'stealth', 'survival'] },
    },
  },
];

export const getClassById = (id: string): ClassDefinition | undefined =>
  CLASS_REGISTRY.find(c => c.id === id);

export const getClassByName = (name: string): ClassDefinition | undefined =>
  CLASS_REGISTRY.find(c => c.name === name);
