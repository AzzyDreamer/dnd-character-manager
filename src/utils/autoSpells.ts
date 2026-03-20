import type { CharacterSpell } from '../types';

export interface AutoSpellResult {
  spellId: string;
  name: string;
  level: number;
  prepared: boolean;
  alwaysPrepared: boolean;
  source: string;
}

export function parseSpellTag(tag: string): string {
  const m = tag.match(/\{@spell\s+([^|}]+)/);
  return m ? m[1].trim() : tag.replace(/[{}@spell]/g, '').split('|')[0].trim();
}

export function parseRacialSpellName(raw: string): { name: string; isCantrip: boolean } {
  const isCantrip = raw.endsWith('#c');
  const clean = raw.replace(/#c$/, '').split('|')[0].trim();
  const name = clean.replace(/\b\w/g, c => c.toUpperCase());
  return { name, isCantrip };
}

function makeSpellId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

interface CharacterInfo {
  class: string;
  classId: string;
  subclass?: string;
  level: number;
  race: string;
  raceSource?: string;
  raceVariant?: string;
  spellcasting?: { spells: CharacterSpell[] };
}

type GetSpellByName = (name: string) => { level: number } | undefined;

/**
 * Collect subclass auto-spells available up to a given level.
 * If onlyAtLevel is set, only returns spells whose requiredLevel === onlyAtLevel.
 */
async function getSubclassSpells(
  character: CharacterInfo,
  getSpellByName: GetSpellByName,
  existingNames: Set<string>,
  onlyAtLevel?: number,
): Promise<AutoSpellResult[]> {
  if (!character.subclass || !character.classId) return [];

  const results: AutoSpellResult[] = [];

  try {
    const [subMod, { getClassById, CLASS_REGISTRY }] = await Promise.all([
      import('../data/classes/subclassJsonLoader').then(async m => { await m.init(); return m; }),
      import('../data/classes'),
    ]);

    const classDef = getClassById(character.classId) ?? CLASS_REGISTRY.find(c => c.name === character.class);
    const subDef = classDef?.subclasses.find(s => s.name === character.subclass);
    if (subDef && classDef) {
      const subData = subMod.getSubclassById(classDef.id, subDef.id);
      if (subData?.features) {
        for (const feat of subData.features) {
          const spellEntries = feat.spellList ?? feat.spells ?? feat.details?.spellTable ?? [];
          for (const entry of spellEntries) {
            const levelKey = Object.keys(entry).find(k => k.endsWith('Level'));
            const requiredLevel = levelKey ? entry[levelKey] : entry.level;
            if (requiredLevel == null) continue;

            const match = onlyAtLevel !== undefined
              ? requiredLevel === onlyAtLevel
              : requiredLevel <= character.level;

            if (match) {
              for (const spellTag of (entry.spells ?? [])) {
                const name = parseSpellTag(spellTag);
                if (!existingNames.has(name.toLowerCase())) {
                  const spellData = getSpellByName(name);
                  results.push({
                    spellId: makeSpellId(name),
                    name,
                    level: spellData?.level ?? 1,
                    prepared: true,
                    alwaysPrepared: true,
                    source: character.subclass!,
                  });
                  existingNames.add(name.toLowerCase());
                }
              }
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn('Failed to load subclass spells:', e);
  }

  return results;
}

/**
 * Collect racial auto-spells available up to a given level.
 * If onlyAtLevel is set, only returns spells whose level === onlyAtLevel.
 */
async function getRacialSpells(
  character: CharacterInfo,
  getSpellByName: GetSpellByName,
  existingNames: Set<string>,
  onlyAtLevel?: number,
): Promise<AutoSpellResult[]> {
  if (!character.race) return [];

  const results: AutoSpellResult[] = [];

  try {
    const speciesMod = await import('../data/species');
    await speciesMod.init();

    // Prefer variant-specific data if raceVariant is set
    const speciesData = character.raceVariant
      ? speciesMod.getSpeciesByName(character.raceVariant, character.raceSource) ?? speciesMod.getSpeciesByName(character.race, character.raceSource)
      : speciesMod.getSpeciesByName(character.race, character.raceSource);
    if (speciesData?.additionalSpells) {
      for (const group of speciesData.additionalSpells) {
        if (group.known) {
          for (const [lvlStr, spellsOrObj] of Object.entries(group.known)) {
            const lvl = parseInt(lvlStr);
            const match = onlyAtLevel !== undefined ? lvl === onlyAtLevel : lvl <= character.level;
            if (match && Array.isArray(spellsOrObj)) {
              for (const raw of spellsOrObj as string[]) {
                if (typeof raw !== 'string') continue;
                const { name, isCantrip } = parseRacialSpellName(raw);
                if (!existingNames.has(name.toLowerCase())) {
                  const spellData = getSpellByName(name);
                  results.push({
                    spellId: makeSpellId(name),
                    name,
                    level: isCantrip ? 0 : (spellData?.level ?? 1),
                    prepared: true,
                    alwaysPrepared: true,
                    source: character.race,
                  });
                  existingNames.add(name.toLowerCase());
                }
              }
            }
          }
        }
        if (group.innate) {
          for (const [lvlStr, innateObj] of Object.entries(group.innate as Record<string, any>)) {
            const lvl = parseInt(lvlStr);
            const match = onlyAtLevel !== undefined ? lvl === onlyAtLevel : lvl <= character.level;
            if (match && innateObj?.daily) {
              for (const spellArr of Object.values(innateObj.daily as Record<string, string[]>)) {
                if (!Array.isArray(spellArr)) continue;
                for (const raw of spellArr) {
                  if (typeof raw !== 'string') continue;
                  const { name } = parseRacialSpellName(raw);
                  if (!existingNames.has(name.toLowerCase())) {
                    const spellData = getSpellByName(name);
                    results.push({
                      spellId: makeSpellId(name),
                      name,
                      level: spellData?.level ?? 1,
                      prepared: true,
                      alwaysPrepared: true,
                      source: character.race,
                    });
                    existingNames.add(name.toLowerCase());
                  }
                }
              }
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn('Failed to load racial spells:', e);
  }

  return results;
}

/**
 * Get all auto-spells (subclass + racial) available up to character's current level.
 * Excludes spells already in character.spellcasting.spells.
 * Used by SpellsTab for display.
 */
export async function getAutoSpellsForLevel(
  character: CharacterInfo,
  getSpellByName: GetSpellByName,
): Promise<AutoSpellResult[]> {
  const existingNames = new Set(
    character.spellcasting?.spells.map(s => s.name.toLowerCase()) ?? [],
  );

  const [subclass, racial] = await Promise.all([
    getSubclassSpells(character, getSpellByName, existingNames),
    getRacialSpells(character, getSpellByName, existingNames),
  ]);

  return [...subclass, ...racial];
}

/**
 * Get only the NEW auto-spells gained specifically at newLevel (not accumulated).
 * Used during level-up to detect and notify about new spells.
 */
export async function getNewAutoSpellsAtLevel(
  character: CharacterInfo,
  newLevel: number,
  getSpellByName: GetSpellByName,
): Promise<AutoSpellResult[]> {
  const existingNames = new Set(
    character.spellcasting?.spells.map(s => s.name.toLowerCase()) ?? [],
  );

  const charAtNewLevel = { ...character, level: newLevel };

  const [subclass, racial] = await Promise.all([
    getSubclassSpells(charAtNewLevel, getSpellByName, existingNames, newLevel),
    getRacialSpells(charAtNewLevel, getSpellByName, existingNames, newLevel),
  ]);

  return [...subclass, ...racial];
}
