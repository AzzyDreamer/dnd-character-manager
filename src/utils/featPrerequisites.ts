import type { AbilityScores } from '../types';
import type { FeatData } from '../data/feats';
import { ABILITY_SHORT_TO_LONG } from './dnd';

export interface FeatCheckContext {
  level: number;
  abilityScores: AbilityScores;
  race: string;
  hasSpellcasting: boolean;
  existingFeats: string[];
}

/**
 * Check if a character meets a feat's prerequisites.
 * prerequisite[] uses OR between elements; within one element, all fields are ANDed.
 */
export function checkFeatPrerequisite(ctx: FeatCheckContext, feat: FeatData): boolean {
  if (!feat.prerequisite || feat.prerequisite.length === 0) return true;

  // OR: any one prereq option satisfied → pass
  return feat.prerequisite.some(prereq => checkSinglePrereq(ctx, prereq));
}

function checkSinglePrereq(ctx: FeatCheckContext, prereq: any): boolean {
  // Level check
  if (prereq.level !== undefined) {
    const reqLevel = typeof prereq.level === 'number' ? prereq.level : prereq.level?.level;
    if (reqLevel && ctx.level < reqLevel) return false;
  }

  // Ability score minimums
  if (prereq.ability) {
    for (const abilityReq of prereq.ability) {
      for (const [shortKey, minVal] of Object.entries(abilityReq)) {
        const longKey = ABILITY_SHORT_TO_LONG[shortKey];
        if (longKey && typeof minVal === 'number') {
          if (ctx.abilityScores[longKey] < minVal) return false;
        }
      }
    }
  }

  // Race check
  if (prereq.race) {
    const raceLower = ctx.race.toLowerCase();
    const raceMatch = prereq.race.some((r: any) => {
      const reqName = (r.name || '').toLowerCase();
      return raceLower.includes(reqName);
    });
    if (!raceMatch) return false;
  }

  // Spellcasting check
  if (prereq.spellcasting2020 === true) {
    if (!ctx.hasSpellcasting) return false;
  }

  // Feat prerequisite
  if (prereq.feat) {
    const hasFeat = prereq.feat.some((f: any) => {
      // Format: "feat name|source" or just object with key
      const featName = typeof f === 'string'
        ? f.split('|')[0].toLowerCase()
        : Object.keys(f)[0]?.split('|')[0]?.toLowerCase() || '';
      return ctx.existingFeats.some(ef => ef.toLowerCase() === featName);
    });
    if (!hasFeat) return false;
  }

  // Proficiency check (weapon/armor) — skip for now, too complex
  // Campaign check — skip, not relevant for most games

  return true;
}

/**
 * Get all feats of a given category that the character is eligible for.
 */
export function getEligibleFeats(
  allFeats: FeatData[],
  ctx: FeatCheckContext,
  category: string
): FeatData[] {
  return allFeats.filter(feat => {
    if (feat.category !== category) return false;
    return checkFeatPrerequisite(ctx, feat);
  });
}

/**
 * Build a FeatCheckContext from character data.
 */
export function buildFeatContext(
  level: number,
  abilityScores: AbilityScores,
  race: string,
  hasSpellcasting: boolean,
  features: { name: string }[],
  feats?: { name: string }[]
): FeatCheckContext {
  const existingFeats = [
    ...features.map(f => f.name),
    ...(feats || []).map(f => f.name),
  ];
  return { level, abilityScores, race, hasSpellcasting, existingFeats };
}
