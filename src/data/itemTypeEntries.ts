// Layer 2 рендера предметов: общий текст типа предмета (5etools itemType),
// который дописывается после собственного описания предмета. Ключ — код типа
// (raw.type до символа '|'). Типы без общего текста здесь отсутствуют.
//
// Пока только английский. RU-перевод можно добавить позже через i18n-оверлей.

// Корабли и воздушные суда делят один и тот же блок правил.
const SHIP_ENTRIES: any[] = [
  {
    type: 'entries',
    name: 'Speed',
    entries: [
      "A ship sailing against a strong wind moves at half speed. In a dead calm (no wind), waterborne ships can't move under sail and must be rowed. Keelboats and Rowboats are used on lakes and rivers. If going downstream, add the speed of the current (typically 3 miles per hour) to the speed of the vehicle. These vehicles can't be rowed against any significant current, but they can be pulled upstream by draft animals on the shores. A Rowboat can be carried and weighs 100 pounds.",
    ],
  },
  {
    type: 'entries',
    name: 'Crew',
    entries: [
      'A ship larger than a Keelboat or Rowboat needs a crew of skilled hirelings (see "Services") to function. The minimum number of skilled hirelings needed to crew a ship depends on the type of ship.',
    ],
  },
  {
    type: 'entries',
    name: 'Passengers',
    entries: [
      'The number of Small and Medium passengers the ship can accommodate using hammocks. A ship outfitted with private accommodations can carry one-fifth as many passengers. A passenger usually pays 5 SP per day for a hammock, but prices can vary from ship to ship. A small private cabin usually costs 2 GP per day.',
    ],
  },
  {
    type: 'entries',
    name: 'Damage Threshold',
    entries: ['See the rules glossary.'],
  },
  {
    type: 'entries',
    name: 'Ship Repair',
    entries: [
      'Repairs to a damaged ship can be made while the vessel is berthed. Repairing 1 Hit Point of damage requires 1 day and costs 20 GP for materials and labor. If the repairs are made in a location where supplies and skilled labor are abundant, such as a city shipyard, the repair time and cost are halved.',
    ],
  },
];

const TOOL_PROFICIENCY =
  "If you have proficiency with a tool, add your Proficiency Bonus to any ability check you make that uses the tool. If you have proficiency in a skill that's used with that check, you have Advantage on the check too.";

export const ITEM_TYPE_ENTRIES: Record<string, any[]> = {
  $A: [{ type: 'entries', name: 'Treasure (Art Object)', entries: ['Idols cast of solid gold, necklaces studded with precious stones, paintings of ancient kings, bejeweled dishes—art objects include all these and more.'] }],
  $G: [{ type: 'entries', name: 'Treasure (Gemstone)', entries: ['Gemstones are small, lightweight, and easily secured compared to their same value in coins.'] }],
  SCF: ['A Holy Symbol takes a specific form and is bejeweled or painted to channel divine magic. A Cleric or Paladin can use a Holy Symbol as a Spellcasting Focus.'],
  INS: [{ type: 'entries', name: 'Tool (Musical Instrument)', entries: [TOOL_PROFICIENCY] }],
  TG: [{ type: 'entries', name: 'Trade Good', entries: ['Merchants commonly exchange trade goods without using currency.'] }],
  AT: [{ type: 'entries', name: "Artisan's Tool", entries: ["Artisan's Tools are each focused on crafting items and pursuing a trade. Each type of Artisan's Tools requires a separate proficiency.", TOOL_PROFICIENCY] }],
  T: [{ type: 'entries', name: 'Tool', entries: [TOOL_PROFICIENCY] }],
  GS: [{ type: 'entries', name: 'Tool (Gaming Set)', entries: [TOOL_PROFICIENCY] }],
  TB: [{ type: 'entries', name: 'Trade Bar', entries: ['Because large numbers of coins can be difficult to transport and account for, many merchants prefer to use trade bars—ingots of precious metals and alloys (usually silver). These bars are valued by weight.'] }],
  SHP: SHIP_ENTRIES,
  AIR: SHIP_ENTRIES,
};

/** Общий текст для типа предмета (по коду типа raw.type). Пусто, если нет. */
export function getItemTypeEntries(typeCode: string): any[] {
  return ITEM_TYPE_ENTRIES[typeCode] ?? [];
}
