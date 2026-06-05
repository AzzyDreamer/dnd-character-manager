// Загрузка всех видов (рас) из единого бандла (scripts/bundle-data.mjs).
import { applyOverlay } from '../translationOverlay';
import { makeLabelProxy } from '../labelProxy';

export interface SpeciesData {
  name: string;
  source: string;
  page?: number;
  edition?: string;
  size?: string[];
  speed?: number | { walk?: number; fly?: boolean | number; swim?: number; climb?: number; burrow?: number };
  darkvision?: number;
  traitTags?: string[];
  entries: any[];
  ability?: any[];
  languageProficiencies?: any[];
  additionalSpells?: any[];
  resist?: string[];
  hasFluff?: boolean;
  hasFluffImages?: boolean;
  lineage?: string;
  soundClip?: { type: string; path: string };
  _parentSpecies?: string;
  _isVariant?: boolean;
  _variantLabel?: string;
  [key: string]: any;
}

export const ALL_SPECIES: SpeciesData[] = [];

let _initialized = false;
let _initializing: Promise<void> | null = null;

/** Extract short label from variant full name: "Elf; Drow Lineage" → "Drow Lineage", "Dragonborn (Black)" → "Black" */
function variantLabel(fullName: string): string {
  const semi = fullName.indexOf(';');
  if (semi >= 0) return fullName.slice(semi + 1).trim();
  const parenMatch = fullName.match(/\(([^)]+)\)/);
  if (parenMatch) return parenMatch[1];
  return fullName;
}

/** Substitute {{var}} placeholders in a string */
function substituteVars(str: string, vars: Record<string, string>): string {
  return str.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? _);
}

/** Deep-substitute {{var}} in any JSON-like value */
function deepSubstitute(val: any, vars: Record<string, string>): any {
  if (typeof val === 'string') return substituteVars(val, vars);
  if (Array.isArray(val)) return val.map(v => deepSubstitute(v, vars));
  if (val && typeof val === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(val)) {
      out[k] = deepSubstitute(v, vars);
    }
    return out;
  }
  return val;
}

/**
 * Expand _versions on a base species into separate SpeciesData entries.
 * Handles both simple versions and _abstract/_implementations pattern.
 */
function expandVersions(base: SpeciesData): SpeciesData[] {
  const versions = base._versions as any[] | undefined;
  if (!versions?.length) return [];

  const results: SpeciesData[] = [];
  // Fields to NOT copy from version (internal/meta)
  const META_KEYS = new Set(['_mod', '_abstract', '_implementations', '_variables', '_template']);
  // Fields that version overrides on base
  const OVERRIDE_KEYS = ['name', 'source', 'additionalSpells', 'darkvision', 'speed', 'resist', 'size', 'entries', 'traitTags', 'skillProficiencies', 'languageProficiencies'];

  for (const ver of versions) {
    if (ver._abstract && ver._implementations) {
      // Template pattern (Dragonborn)
      const abstract = ver._abstract;
      const implementations = ver._implementations as any[];
      for (const impl of implementations) {
        const vars: Record<string, string> = impl._variables ?? {};
        const expanded: any = { ...deepSubstitute(abstract, vars) };
        // Merge implementation fields (resist, etc.) excluding meta
        for (const [k, v] of Object.entries(impl)) {
          if (!META_KEYS.has(k)) {
            expanded[k] = deepSubstitute(v, vars);
          }
        }
        const variantName = expanded.name ?? base.name;
        const variant: SpeciesData = {
          ...base,
          _versions: undefined,
          _parentSpecies: base.name,
          _isVariant: true,
          _variantLabel: variantLabel(variantName),
        };
        for (const key of OVERRIDE_KEYS) {
          if (key in expanded) {
            (variant as any)[key] = expanded[key];
          }
        }
        if (!variant.name || variant.name === base.name) variant.name = variantName;
        results.push(variant);
      }
    } else {
      // Simple version pattern (Elf, Tiefling, Gnome, etc.)
      const variantName = ver.name ?? base.name;
      const variant: SpeciesData = {
        ...base,
        _versions: undefined,
        _parentSpecies: base.name,
        _isVariant: true,
        _variantLabel: variantLabel(variantName),
      };
      for (const [k, v] of Object.entries(ver)) {
        if (!META_KEYS.has(k)) {
          (variant as any)[k] = v;
        }
      }
      results.push(variant);
    }
  }

  return results;
}

export async function init(): Promise<void> {
  if (_initialized) return;
  if (_initializing) return _initializing;

  _initializing = (async () => {
    const mod = await import('../_bundles/species.json');
    // Клонируем исходный JSON: оверлей переводов мутирует объекты на месте, а
    // кешированный импорт должен оставаться английским для смены языка в рантайме.
    const items = structuredClone(mod.default ?? mod) as any[];

    for (const data of items) {
      let base: SpeciesData | null = null;
      if (Array.isArray(data)) {
        if (data[0] && typeof data[0] === 'object' && data[0].name) {
          base = data[0] as SpeciesData;
        }
      } else if (data && typeof data === 'object' && data.name) {
        base = data as SpeciesData;
      }
      if (base) {
        ALL_SPECIES.push(base);
        // Expand variants into separate entries
        const variants = expandVersions(base);
        for (const v of variants) ALL_SPECIES.push(v);
      }
    }

    ALL_SPECIES.sort((a, b) => a.name.localeCompare(b.name));
    await applyOverlay('species', ALL_SPECIES, s => s.name);
    _initialized = true;
  })();

  return _initializing;
}

/** Сброс для повторной загрузки под другую локаль (см. registry.reloadForLocale). */
export function reset(): void {
  _initialized = false;
  _initializing = null;
  ALL_SPECIES.length = 0;
}

const PREFERRED_SOURCES = ['XPHB', 'PHB'];

/** Canonical (English) name — stable across locales for internal keying. */
export function getCanonicalName(s: Pick<SpeciesData, 'name'> & { _origName?: string }): string {
  return s._origName ?? s.name;
}

export function getSpeciesByName(name: string, source?: string): SpeciesData | undefined {
  const lc = name.toLowerCase();
  const nameMatches = (s: SpeciesData) => s.name.toLowerCase() === lc || (s as any)._origName?.toLowerCase() === lc;
  if (source) {
    return ALL_SPECIES.find(s => nameMatches(s) && s.source === source);
  }
  // Without source, prefer XPHB/PHB variants to avoid returning homebrew/3rd-party first
  const matches = ALL_SPECIES.filter(nameMatches);
  if (matches.length <= 1) return matches[0];
  return matches.find(s => PREFERRED_SOURCES.includes(s.source)) ?? matches[0];
}

export function getSpeciesBySource(source: string): SpeciesData[] {
  return ALL_SPECIES.filter(s => s.source === source);
}

/**
 * Resolve a stored race string (from `Character.race`/`Character.raceVariant`) to its canonical
 * English name. Works whether the stored string is canonical or already localized — `getSpeciesByName`
 * matches against both `name` and `_origName`.
 *
 * Use this for any internal lookup, comparison, or persisted key (SPECIES_EFFECTS, easter eggs,
 * spell source grouping, image filenames, etc.).
 */
export function resolveCanonicalRace(race: string | undefined, source?: string): string {
  if (!race) return '';
  const sp = getSpeciesByName(race, source);
  return sp ? getCanonicalName(sp) : race;
}

/**
 * Resolve a stored race string to its display name in the current locale (after the translation
 * overlay has been applied). Falls back to the stored value if the species is no longer found.
 */
export function resolveDisplayRace(race: string | undefined, source?: string): string {
  if (!race) return '';
  const sp = getSpeciesByName(race, source);
  return sp?.name ?? race;
}

/** Get expanded variants for a base species */
export function getVariantsFor(baseName: string, source?: string): SpeciesData[] {
  return ALL_SPECIES.filter(s =>
    s._isVariant &&
    s._parentSpecies === baseName &&
    (!source || s.source === source)
  );
}

// Названия размеров берём из i18n (character.creation.sizes), чтобы они
// переключались вместе с языком. Доступ остаётся прежним: SIZE_NAMES[code].
export const SIZE_NAMES: Record<string, string> = makeLabelProxy('creation.sizes', 'character');
