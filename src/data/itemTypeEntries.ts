// Layer 2 рендера предметов: общий текст типа предмета (5etools itemType),
// который дописывается после собственного описания предмета. Ключ — код типа
// (raw.type до символа '|'). Типы без общего текста здесь отсутствуют.
import i18n from '../i18n';

// ─── Корабли и воздушные суда делят один и тот же блок правил ───
const SHIP_ENTRIES_EN: any[] = [
  { type: 'entries', name: 'Speed', entries: ["A ship sailing against a strong wind moves at half speed. In a dead calm (no wind), waterborne ships can't move under sail and must be rowed. Keelboats and Rowboats are used on lakes and rivers. If going downstream, add the speed of the current (typically 3 miles per hour) to the speed of the vehicle. These vehicles can't be rowed against any significant current, but they can be pulled upstream by draft animals on the shores. A Rowboat can be carried and weighs 100 pounds."] },
  { type: 'entries', name: 'Crew', entries: ['A ship larger than a Keelboat or Rowboat needs a crew of skilled hirelings (see "Services") to function. The minimum number of skilled hirelings needed to crew a ship depends on the type of ship.'] },
  { type: 'entries', name: 'Passengers', entries: ['The number of Small and Medium passengers the ship can accommodate using hammocks. A ship outfitted with private accommodations can carry one-fifth as many passengers. A passenger usually pays 5 SP per day for a hammock, but prices can vary from ship to ship. A small private cabin usually costs 2 GP per day.'] },
  { type: 'entries', name: 'Damage Threshold', entries: ['See the rules glossary.'] },
  { type: 'entries', name: 'Ship Repair', entries: ['Repairs to a damaged ship can be made while the vessel is berthed. Repairing 1 Hit Point of damage requires 1 day and costs 20 GP for materials and labor. If the repairs are made in a location where supplies and skilled labor are abundant, such as a city shipyard, the repair time and cost are halved.'] },
];

const SHIP_ENTRIES_RU: any[] = [
  { type: 'entries', name: 'Скорость', entries: ['Судно, идущее против сильного ветра, движется с половинной скоростью. В полный штиль (без ветра) водные суда не могут двигаться под парусом и должны идти на вёслах. Килевые и Гребные лодки используются на озёрах и реках. При движении вниз по течению добавьте скорость течения (обычно 3 мили в час) к скорости судна. Эти суда нельзя грести против сколько-нибудь значительного течения, но их можно тянуть вверх по течению тягловыми животными с берега. Гребную лодку можно переносить, и она весит 100 фунтов.'] },
  { type: 'entries', name: 'Команда', entries: ['Судну крупнее Килевой или Гребной лодки для функционирования нужна команда умелых наёмников (см. «Услуги»). Минимальное число умелых наёмников, необходимое для команды судна, зависит от типа судна.'] },
  { type: 'entries', name: 'Пассажиры', entries: ['Число Маленьких и Средних пассажиров, которых судно может разместить в гамаках. Судно, оснащённое отдельными каютами, вмещает в пять раз меньше пассажиров. Пассажир обычно платит 5 см в день за гамак, но цены могут различаться от судна к судну. Маленькая отдельная каюта обычно стоит 2 зм в день.'] },
  { type: 'entries', name: 'Порог урона', entries: ['См. глоссарий правил.'] },
  { type: 'entries', name: 'Ремонт судна', entries: ['Ремонт повреждённого судна можно проводить, пока оно пришвартовано. Восстановление 1 хита урона требует 1 дня и стоит 20 зм за материалы и работу. Если ремонт проводится там, где в изобилии есть припасы и умелая рабочая сила (например, в городской верфи), время и стоимость ремонта уменьшаются вдвое.'] },
];

const TOOL_PROF_EN = "If you have proficiency with a tool, add your Proficiency Bonus to any ability check you make that uses the tool. If you have proficiency in a skill that's used with that check, you have Advantage on the check too.";
const TOOL_PROF_RU = 'Если вы владеете инструментом, добавляйте Бонус мастерства к любой проверке характеристики, в которой используется этот инструмент. Если вы также владеете навыком, применяемым в этой проверке, вы совершаете проверку с Преимуществом.';

const ITEM_TYPE_ENTRIES_EN: Record<string, any[]> = {
  $A: [{ type: 'entries', name: 'Treasure (Art Object)', entries: ['Idols cast of solid gold, necklaces studded with precious stones, paintings of ancient kings, bejeweled dishes—art objects include all these and more.'] }],
  $G: [{ type: 'entries', name: 'Treasure (Gemstone)', entries: ['Gemstones are small, lightweight, and easily secured compared to their same value in coins.'] }],
  SCF: ['A Holy Symbol takes a specific form and is bejeweled or painted to channel divine magic. A Cleric or Paladin can use a Holy Symbol as a Spellcasting Focus.'],
  INS: [{ type: 'entries', name: 'Tool (Musical Instrument)', entries: [TOOL_PROF_EN] }],
  TG: [{ type: 'entries', name: 'Trade Good', entries: ['Merchants commonly exchange trade goods without using currency.'] }],
  AT: [{ type: 'entries', name: "Artisan's Tool", entries: ["Artisan's Tools are each focused on crafting items and pursuing a trade. Each type of Artisan's Tools requires a separate proficiency.", TOOL_PROF_EN] }],
  T: [{ type: 'entries', name: 'Tool', entries: [TOOL_PROF_EN] }],
  GS: [{ type: 'entries', name: 'Tool (Gaming Set)', entries: [TOOL_PROF_EN] }],
  TB: [{ type: 'entries', name: 'Trade Bar', entries: ['Because large numbers of coins can be difficult to transport and account for, many merchants prefer to use trade bars—ingots of precious metals and alloys (usually silver). These bars are valued by weight.'] }],
  SHP: SHIP_ENTRIES_EN,
  AIR: SHIP_ENTRIES_EN,
  AdvEq: [{ type: 'entries', name: 'Advanced Equipment', entries: [
    'Some pieces of Advanced equipment need special training to fully employ. Other items are usable by anyone proficient with similar gear, and many are usable by anyone—though few can afford and maintain these mechanical, alchemical, or even magical marvels.',
    'As they are expensive and difficult to make, access to Advanced equipment is limited—maybe even as limited as some magic items. The largest cities, or locations housing master crafters, may only have a few items of Advanced equipment.',
  ] }],
};

const ITEM_TYPE_ENTRIES_RU: Record<string, any[]> = {
  $A: [{ type: 'entries', name: 'Сокровище (предмет искусства)', entries: ['Идолы, отлитые из чистого золота, ожерелья, усыпанные драгоценными камнями, портреты древних королей, инкрустированная драгоценностями посуда — всё это и многое другое относится к предметам искусства.'] }],
  $G: [{ type: 'entries', name: 'Сокровище (самоцвет)', entries: ['Самоцветы малы, легки, и их проще хранить и переносить, чем эквивалентную сумму монетами.'] }],
  SCF: ['Священный символ имеет определённую форму и украшен драгоценностями или росписью, чтобы направлять божественную магию. Жрец или Паладин может использовать Священный символ как Фокусировку заклинаний.'],
  INS: [{ type: 'entries', name: 'Инструмент (музыкальный инструмент)', entries: [TOOL_PROF_RU] }],
  TG: [{ type: 'entries', name: 'Товар', entries: ['Торговцы обычно обмениваются товарами, не используя валюту.'] }],
  AT: [{ type: 'entries', name: 'Инструмент ремесленника', entries: ['Инструменты ремесленника предназначены для изготовления предметов и занятия ремеслом. Каждый вид инструментов ремесленника требует отдельного владения.', TOOL_PROF_RU] }],
  T: [{ type: 'entries', name: 'Инструмент', entries: [TOOL_PROF_RU] }],
  GS: [{ type: 'entries', name: 'Инструмент (игровой набор)', entries: [TOOL_PROF_RU] }],
  TB: [{ type: 'entries', name: 'Торговый слиток', entries: ['Поскольку большое количество монет бывает сложно перевозить и учитывать, многие торговцы предпочитают использовать торговые слитки — бруски из драгоценных металлов и сплавов (обычно серебра). Эти слитки оцениваются по весу.'] }],
  SHP: SHIP_ENTRIES_RU,
  AIR: SHIP_ENTRIES_RU,
  AdvEq: [{ type: 'entries', name: 'Продвинутое снаряжение', entries: [
    'Некоторые образцы продвинутого снаряжения требуют особой подготовки. Другими может пользоваться любой, кто владеет схожим снаряжением, а многими — вообще кто угодно, хотя мало кто способен позволить себе и содержать эти механические, алхимические и даже магические чудеса.',
    'Продвинутое снаряжение дорого и сложно в изготовлении, поэтому доступ к нему ограничен — возможно, не меньше, чем к иным магическим предметам. Даже в крупнейших городах или поселениях с мастерами-умельцами найдётся лишь несколько его образцов.',
  ] }],
};

/** Общий текст для типа предмета (по коду типа raw.type). Пусто, если нет. */
export function getItemTypeEntries(typeCode: string): any[] {
  const ru = (i18n.language || '').toLowerCase().startsWith('ru');
  const map = ru ? ITEM_TYPE_ENTRIES_RU : ITEM_TYPE_ENTRIES_EN;
  return map[typeCode] ?? [];
}
