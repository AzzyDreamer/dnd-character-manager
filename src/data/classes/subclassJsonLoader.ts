// Загрузка JSON данных подклассов из единого бандла (scripts/bundle-data.mjs).
import { applyOverlay } from '../translationOverlay';
import { asset } from '../../utils/asset';

export interface SubclassJsonData {
  id: string;
  name: string;
  classId: string;
  description: string;
  shortDescription?: string;
  source: string;
  level: number;
  features: {
    name: string;
    level: number;
    source: string;
    description: string;
    details?: any;
    spells?: any[];
    spellList?: any[];
  }[];
  [key: string]: any;
}

export const ALL_SUBCLASS_DATA: SubclassJsonData[] = [];

let _initialized = false;
let _initializing: Promise<void> | null = null;

export async function init(): Promise<void> {
  if (_initialized) return;
  if (_initializing) return _initializing;

  _initializing = (async () => {
    const mod = await import('../_bundles/subclasses.json');
    const items = (mod.default ?? mod) as SubclassJsonData[];

    for (const data of items) {
      if (data && typeof data === 'object' && data.name && data.classId) {
        ALL_SUBCLASS_DATA.push(data as SubclassJsonData);
      }
    }

    ALL_SUBCLASS_DATA.sort((a, b) => {
      const cmp = a.classId.localeCompare(b.classId);
      return cmp !== 0 ? cmp : a.name.localeCompare(b.name);
    });
    await applyOverlay('subclasses', ALL_SUBCLASS_DATA, s => s.id, 'subclass');
    _initialized = true;
  })();

  return _initializing;
}

export function getSubclassesByClass(classId: string): SubclassJsonData[] {
  return ALL_SUBCLASS_DATA.filter(s => s.classId === classId);
}

export function getSubclassById(classId: string, subclassId: string): SubclassJsonData | undefined {
  return ALL_SUBCLASS_DATA.find(s => s.classId === classId && s.id === subclassId);
}

/**
 * Найти подкласс по имени (с учётом перевода через _origName) в рамках класса.
 * classId стабилен (не переписывается оверлеем), поэтому матчим по нему,
 * а имя сверяем и с переведённым name, и с оригинальным _origName.
 */
export function getSubclassByName(classId: string, subclassName: string): SubclassJsonData | undefined {
  const lcSub = subclassName.toLowerCase();
  // Имена подклассов в данных русские; английский идентификатор — только в id
  // ("bladesinger", "battle-master"). Матчим по id с нормализацией дефисов/пробелов.
  const normSub = lcSub.replace(/[^a-z0-9]/g, '');
  return ALL_SUBCLASS_DATA.find(s =>
    s.classId === classId &&
    (s.name.toLowerCase() === lcSub ||
     (s as any)._origName?.toLowerCase() === lcSub ||
     s.id?.toLowerCase() === lcSub ||
     s.id?.toLowerCase().replace(/[^a-z0-9]/g, '') === normSub)
  );
}

// Mapping: "classId/subclassId" → image filename in /images/subclasses/
const SUBCLASS_IMAGE_MAP: Record<string, string> = {
  'barbarian/berserker': 'Class_Barbarian_Berserker_Badge_Icon.png',
  'barbarian/giant': 'Class_Barbarian_Giant_Badge_Icon.png',
  'barbarian/wild-magic': 'Class_Barbarian_Wild_Magic_Badge_Icon.png',
  'barbarian/wild-heart': 'Class_Barbarian_Wildheart_Badge_Icon.png',
  'bard/glamour': 'Class_Bard_Glamour_Badge_Icon.png',
  'bard/lore': 'Class_Bard_Lore_Badge_Icon.png',
  'bard/swords': 'Class_Bard_Swords_Badge_Icon.png',
  'bard/valor': 'Class_Bard_Valour_Badge_Icon.png',
  'cleric/death': 'Class_Cleric_Death_Badge_Icon.png',
  'cleric/knowledge': 'Class_Cleric_Knowledge_Badge_Icon.png',
  'cleric/life': 'Class_Cleric_Life_Badge_Icon.png',
  'cleric/light': 'Class_Cleric_Light_Badge_Icon.png',
  'cleric/nature': 'Class_Cleric_Nature_Badge_Icon.png',
  'cleric/tempest': 'Class_Cleric_Tempest_Badge_Icon.png',
  'cleric/war': 'Class_Cleric_War_Badge_Icon.png',
  'druid/land': 'Class_Druid_Land_Badge_Icon.png',
  'druid/moon': 'Class_Druid_Moon_Badge_Icon.png',
  'druid/spores': 'Class_Druid_Spores_Badge_Icon.png',
  'druid/stars': 'Class_Druid_Stars_Badge_Icon.png',
  'fighter/arcane-archer': 'Class_Fighter_Arcane_Archer_Badge_Icon.png',
  'fighter/battle-master': 'Class_Fighter_Battle_Master_Badge_Icon.png',
  'fighter/champion': 'Class_Fighter_Champion_Badge_Icon.png',
  'fighter/eldritch-knight': 'Class_Fighter_Eldritch_Knight_Badge_Icon.png',
  'monk/drunken-master': 'Class_Monk_Drunken_Master_Badge_Icon.png',
  'monk/elements': 'Class_Monk_Four_Elements_Badge_Icon.png',
  'monk/open-hand': 'Class_Monk_Open_Hand_Badge_Icon.png',
  'monk/shadow': 'Class_Monk_Shadow_Badge_Icon.png',
  'paladin/ancients': 'Class_Paladin_Ancients_Badge_Icon.png',
  'paladin/crown': 'Class_Paladin_Crown_Badge_Icon.png',
  'paladin/devotion': 'Class_Paladin_Devotion_Badge_Icon.png',
  'paladin/oathbreaker': 'Class_Paladin_Oathbreaker_Badge_Icon.png',
  'paladin/vengeance': 'Class_Paladin_Vengeance_Badge_Icon.png',
  'ranger/beast-master': 'Class_Ranger_Beast_Master_Badge_Icon.png',
  'ranger/gloom-stalker': 'Class_Ranger_Gloom_Stalker_Badge_Icon.png',
  'ranger/hunter': 'Class_Ranger_Hunter_Badge_Icon.png',
  'ranger/swarmkeeper': 'Class_Ranger_Swarmkeeper_Badge_Icon.png',
  'rogue/arcane-trickster': 'Class_Rogue_Arcane_Trickster_Badge_Icon.png',
  'rogue/assassin': 'Class_Rogue_Assassin_Badge_Icon.png',
  'rogue/swashbuckler': 'Class_Rogue_Swashbuckler_Badge_Icon.png',
  'rogue/thief': 'Class_Rogue_Thief_Badge_Icon.png',
  'sorcerer/draconic': 'Class_Sorcerer_Draconic_Bloodline_Badge_Icon.png',
  'sorcerer/shadow': 'Class_Sorcerer_Shadow_Magic_Badge_Icon.png',
  'sorcerer/storm': 'Class_Sorcerer_Storm_Sorcery_Badge_Icon.png',
  'sorcerer/wild-magic': 'Class_Sorcerer_Wild_Magic_Badge_Icon.png',
  'warlock/archfey': 'Class_Warlock_Archfey_Badge_Icon.png',
  'warlock/fiend': 'Class_Warlock_Fiend_Badge_Icon.png',
  'warlock/great-old-one': 'Class_Warlock_Great_Old_One_Badge_Icon.png',
  'warlock/hexblade': 'Class_Warlock_Hexblade_Badge_Icon.png',
  'wizard/abjurer': 'Class_Wizard_Abjuration_Badge_Icon.png',
  'wizard/bladesinger': 'Class_Wizard_Bladesinging_Badge_Icon.png',
  'wizard/conjuration': 'Class_Wizard_Conjuration_Badge_Icon.png',
  'wizard/diviner': 'Class_Wizard_Divination_Badge_Icon.png',
  'wizard/enchantment': 'Class_Wizard_Enchantment_Badge_Icon.png',
  'wizard/evoker': 'Class_Wizard_Evocation_Badge_Icon.png',
  'wizard/illusionist': 'Class_Wizard_Illusion_Badge_Icon.png',
  'wizard/necromancy': 'Class_Wizard_Necromancy_Badge_Icon.png',
  'wizard/transmutation': 'Class_Wizard_Transmutation_Badge_Icon.png',
};

export function getSubclassImageUrl(classId: string, subclassId: string): string | null {
  const file = SUBCLASS_IMAGE_MAP[`${classId}/${subclassId}`];
  return file ? asset(`/images/subclasses/${file}`) : null;
}
