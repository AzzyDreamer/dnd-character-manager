/**
 * Runtime translation overlay for game data.
 *
 * Loads flat translated JSON (produced by scripts/i18n-extract.mjs)
 * and patches in-memory data arrays after loading completes.
 * English data is the source of truth — overlay only applies for non-en locales.
 */

import i18n from '../i18n';

// Vite glob imports for each category's translations
const OVERLAY_MODULES: Record<string, Record<string, () => Promise<{ default: Record<string, string> }>>> = {
  spells: import.meta.glob('../i18n/gamedata/*/spells.json') as any,
  feats: import.meta.glob('../i18n/gamedata/*/feats.json') as any,
  items: import.meta.glob('../i18n/gamedata/*/items.json') as any,
  'items-base': import.meta.glob('../i18n/gamedata/*/items-base.json') as any,
  species: import.meta.glob('../i18n/gamedata/*/species.json') as any,
  backgrounds: import.meta.glob('../i18n/gamedata/*/backgrounds.json') as any,
  optionalfeatures: import.meta.glob('../i18n/gamedata/*/optionalfeatures.json') as any,
  actions: import.meta.glob('../i18n/gamedata/*/actions.json') as any,
  conditionsdiseases: import.meta.glob('../i18n/gamedata/*/conditionsdiseases.json') as any,
  senses: import.meta.glob('../i18n/gamedata/*/senses.json') as any,
  skills: import.meta.glob('../i18n/gamedata/*/skills.json') as any,
  variantrule: import.meta.glob('../i18n/gamedata/*/variantrule.json') as any,
  itemproperties: import.meta.glob('../i18n/gamedata/*/itemproperties.json') as any,
  charactercreationoptions: import.meta.glob('../i18n/gamedata/*/charactercreationoptions.json') as any,
  classes: import.meta.glob('../i18n/gamedata/*/classes.json') as any,
  subclasses: import.meta.glob('../i18n/gamedata/*/subclasses.json') as any,
};

/**
 * Apply entry-level translations recursively.
 * Mirrors the extraction walker but sets values instead of reading.
 */
function applyEntryTranslations(entries: any[] | undefined, keyPrefix: string, translations: Record<string, string>): void {
  if (!Array.isArray(entries)) return;

  for (let i = 0; i < entries.length; i++) {
    const key = `${keyPrefix}.${i}`;
    const entry = entries[i];

    if (typeof entry === 'string') {
      if (translations[key] !== undefined) {
        entries[i] = translations[key];
      }
    } else if (entry && typeof entry === 'object') {
      if (typeof entry.name === 'string' && translations[`${key}.name`] !== undefined) {
        entry.name = translations[`${key}.name`];
      }
      if (typeof entry.entry === 'string' && translations[`${key}.entry`] !== undefined) {
        entry.entry = translations[`${key}.entry`];
      }
      if (typeof entry.by === 'string' && translations[`${key}.by`] !== undefined) {
        entry.by = translations[`${key}.by`];
      }
      if (typeof entry.caption === 'string' && translations[`${key}.caption`] !== undefined) {
        entry.caption = translations[`${key}.caption`];
      }
      if (Array.isArray(entry.colLabels)) {
        for (let ci = 0; ci < entry.colLabels.length; ci++) {
          const colKey = `${key}.colLabels.${ci}`;
          if (typeof entry.colLabels[ci] === 'string' && translations[colKey] !== undefined) {
            entry.colLabels[ci] = translations[colKey];
          }
        }
      }
      if (Array.isArray(entry.rows)) {
        for (let ri = 0; ri < entry.rows.length; ri++) {
          const row = entry.rows[ri];
          if (Array.isArray(row)) {
            for (let ci = 0; ci < row.length; ci++) {
              const cellKey = `${key}.rows.${ri}.${ci}`;
              if (typeof row[ci] === 'string' && translations[cellKey] !== undefined) {
                row[ci] = translations[cellKey];
              }
            }
          }
        }
      }
      if (Array.isArray(entry.entries)) {
        applyEntryTranslations(entry.entries, `${key}.entries`, translations);
      }
      if (Array.isArray(entry.items)) {
        applyEntryTranslations(entry.items, `${key}.items`, translations);
      }
    }
  }
}

/**
 * Apply translations to a standard data item (spell, feat, item, etc.)
 */
function applyStandardTranslations(item: any, stem: string, translations: Record<string, string>): void {
  if (translations[`${stem}.name`] !== undefined) {
    if (item._origName === undefined) item._origName = item.name;
    item.name = translations[`${stem}.name`];
  }
  applyEntryTranslations(item.entries, `${stem}.entries`, translations);
  applyEntryTranslations(item.entriesHigherLevel, `${stem}.entriesHigherLevel`, translations);

  // Prerequisite free-text (optional features, some feats)
  if (Array.isArray(item.prerequisite)) {
    for (let i = 0; i < item.prerequisite.length; i++) {
      const pKey = `${stem}.prerequisite.${i}.other`;
      if (item.prerequisite[i] && typeof item.prerequisite[i].other === 'string' && translations[pKey] !== undefined) {
        item.prerequisite[i].other = translations[pKey];
      }
    }
  }

  // Material components
  if (item.components) {
    const mKey = `${stem}.components.m`;
    if (translations[mKey] !== undefined) {
      if (typeof item.components.m === 'string') {
        item.components.m = translations[mKey];
      } else if (item.components.m && typeof item.components.m === 'object') {
        item.components.m.text = translations[mKey];
      }
    }
  }

  // Fluff text (species)
  applyEntryTranslations(item._fluffText, `${stem}._fluffText`, translations);

  // Fluff (backgrounds)
  if (Array.isArray(item.fluff)) {
    for (let i = 0; i < item.fluff.length; i++) {
      const fKey = `${stem}.fluff.${i}`;
      if (typeof item.fluff[i] === 'string' && translations[fKey] !== undefined) {
        item.fluff[i] = translations[fKey];
      }
    }
  }
}

/**
 * Apply translations to a class data object.
 */
function applyClassTranslations(item: any, translations: Record<string, string>): void {
  const stem = item.id;
  if (!stem) return;

  if (translations[`${stem}.name`] !== undefined) {
    if (item._origName === undefined) item._origName = item.name;
    item.name = translations[`${stem}.name`];
  }

  // Fluff (многоабзацный лор) — заменил короткий root description
  if (Array.isArray(item.fluff)) {
    for (let i = 0; i < item.fluff.length; i++) {
      const fKey = `${stem}.fluff.${i}`;
      if (typeof item.fluff[i] === 'string' && translations[fKey] !== undefined) {
        item.fluff[i] = translations[fKey];
      }
    }
  }

  // Starting equipment
  if (item.startingEquipment) {
    for (const optKey of ['optionA', 'optionB']) {
      const opt = item.startingEquipment[optKey];
      if (Array.isArray(opt)) {
        for (let i = 0; i < opt.length; i++) {
          const k = `${stem}.startingEquipment.${optKey}.${i}`;
          if (typeof opt[i] === 'string' && translations[k] !== undefined) {
            opt[i] = translations[k];
          }
        }
      }
    }
  }

  // Level table features intentionally stay in English. They are gameplay
  // identifiers, not display text — the level-up flow matches them against
  // literal English strings ("Ability Score Improvement", "Fighting Style",
  // "Expertise", "Metamagic", "Epic Boon") to decide which pickers to show.
  // Nothing renders levelTable.features, so translating them only broke those
  // checks. The "<class>.levelTable.*.features.*" keys remain in the gamedata
  // JSON for any future localized level-table view, which should map them
  // through i18n rather than mutating this array.

  // Class features
  if (Array.isArray(item.classFeatures)) {
    for (let i = 0; i < item.classFeatures.length; i++) {
      const feat = item.classFeatures[i];
      const fKey = `${stem}.classFeatures.${i}`;
      if (typeof feat.name === 'string' && translations[`${fKey}.name`] !== undefined) {
        feat.name = translations[`${fKey}.name`];
      }
      if (typeof feat.description === 'string' && translations[`${fKey}.description`] !== undefined) {
        feat.description = translations[`${fKey}.description`];
      }
      if (feat.details && typeof feat.details === 'object') {
        for (const dk of Object.keys(feat.details)) {
          const dKey = `${fKey}.details.${dk}`;
          if (typeof feat.details[dk] === 'string' && translations[dKey] !== undefined) {
            feat.details[dk] = translations[dKey];
          }
        }
      }
      applyEntryTranslations(feat.entries, `${fKey}.entries`, translations);
    }
  }
}

/**
 * Apply translations to a subclass data object.
 */
function applySubclassTranslations(item: any, translations: Record<string, string>): void {
  const stem = item.id;
  if (!stem) return;

  if (translations[`${stem}.name`] !== undefined) {
    if (item._origName === undefined) item._origName = item.name;
    item.name = translations[`${stem}.name`];
  }
  if (translations[`${stem}.description`] !== undefined) item.description = translations[`${stem}.description`];
  if (translations[`${stem}.shortDescription`] !== undefined) item.shortDescription = translations[`${stem}.shortDescription`];

  if (Array.isArray(item.features)) {
    for (let i = 0; i < item.features.length; i++) {
      const feat = item.features[i];
      const fKey = `${stem}.features.${i}`;
      if (typeof feat.name === 'string' && translations[`${fKey}.name`] !== undefined) {
        // Preserve the English name — the level-up flow matches subclass-granted
        // features (e.g. "Fighting Style") by their original name.
        if (feat._origName === undefined) feat._origName = feat.name;
        feat.name = translations[`${fKey}.name`];
      }
      if (typeof feat.description === 'string' && translations[`${fKey}.description`] !== undefined) {
        feat.description = translations[`${fKey}.description`];
      }
      if (feat.details && typeof feat.details === 'object') {
        for (const dk of Object.keys(feat.details)) {
          const dKey = `${fKey}.details.${dk}`;
          if (typeof feat.details[dk] === 'string' && translations[dKey] !== undefined) {
            feat.details[dk] = translations[dKey];
          }
        }
      }
      applyEntryTranslations(feat.entries, `${fKey}.entries`, translations);
    }
  }
}

/**
 * Load translations for a category and apply them to the data array.
 *
 * @param categoryId - The category identifier (e.g., 'spells', 'feats')
 * @param items - The in-memory data array to patch
 * @param getKey - Function to get the key prefix from an item (usually item.name or item.id)
 * @param type - 'standard' | 'class' | 'subclass'
 */
/**
 * Translation keys are derived from the source filename, which can differ from
 * the item's runtime `name`: '/' is sanitized to '-' (e.g. "Antipathy/Sympathy"
 * → "Antipathy-Sympathy") and apostrophes may be dropped (e.g. "Vampire's
 * Plaything" → "Vampires Plaything"). Filenames aren't fully consistent (some
 * keep the apostrophe), so probe candidate stems and use the first that has a
 * matching translation, falling back to the raw name. See scripts/i18n-extract.mjs.
 */
function resolveStem(name: string, translations: Record<string, string>): string {
  const candidates = [name];
  const add = (s: string) => { if (s !== name && !candidates.includes(s)) candidates.push(s); };
  add(name.replace(/\//g, '-'));
  add(name.replace(/['’]/g, ''));
  add(name.replace(/\//g, '-').replace(/['’]/g, ''));
  return candidates.find(s => translations[`${s}.name`] !== undefined) ?? name;
}

export async function applyOverlay(
  categoryId: string,
  items: any[],
  getKey: (item: any) => string,
  type: 'standard' | 'class' | 'subclass' = 'standard'
): Promise<void> {
  const lang = i18n.language?.split('-')[0];
  if (!lang || lang === 'en') return;

  const modules = OVERLAY_MODULES[categoryId];
  if (!modules) return;

  const modulePath = Object.keys(modules).find(p => p.includes(`/${lang}/`));
  if (!modulePath) return;

  try {
    const mod = await modules[modulePath]();
    const translations = mod.default ?? mod;

    for (const item of items) {
      const stem = getKey(item);
      if (!stem) continue;

      if (type === 'class') {
        applyClassTranslations(item, translations);
      } else if (type === 'subclass') {
        applySubclassTranslations(item, translations);
      } else {
        applyStandardTranslations(item, resolveStem(stem, translations), translations);
      }
    }
  } catch (e) {
    console.warn(`[i18n overlay] Failed to load ${categoryId}/${lang}:`, e);
  }
}
