#!/usr/bin/env node
/**
 * i18n Game Data Extraction Script
 *
 * Walks all JSON data directories and extracts translatable strings
 * into flat Crowdin-compatible JSON files (one per category).
 *
 * Usage: node scripts/i18n-extract.mjs
 * Output: src/i18n/gamedata/en/*.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'src', 'data');
const OUTPUT_DIR = path.join(ROOT, 'src', 'i18n', 'gamedata', 'en');

// ── Category definitions ──

const CATEGORIES = [
  { id: 'spells',       dir: 'spells',                        pattern: '*.json' },
  { id: 'feats',        dir: 'feats',                         pattern: '*.json' },
  { id: 'items',        dir: 'items',                         pattern: '*.json' },
  { id: 'items-base',   dir: 'items-base',                    pattern: '*.json' },
  { id: 'species',      dir: 'species',                       pattern: '*.json' },
  { id: 'backgrounds',  dir: 'backgrounds/backgrounds',       pattern: '*.json' },
  { id: 'optionalfeatures', dir: 'optionalfeatures',          pattern: '*.json' },
  { id: 'actions',      dir: 'actions',                       pattern: '*.json' },
  { id: 'conditionsdiseases', dir: 'conditionsdiseases',      pattern: '*.json' },
  { id: 'senses',       dir: 'senses',                        pattern: '*.json' },
  { id: 'skills',       dir: 'skills',                        pattern: '*.json' },
  { id: 'variantrule',  dir: 'variantrule',                   pattern: '*.json' },
  { id: 'itemproperties', dir: 'itemproperties',              pattern: '*.json' },
  { id: 'charactercreationoptions', dir: 'charactercreationoptions', pattern: '*.json' },
  // Classes and subclasses have special structure
  { id: 'classes',      dir: 'classes',                       pattern: '*/*.json', type: 'class' },
  { id: 'subclasses',   dir: 'classes',                       pattern: '*/subclasses/*.json', type: 'subclass' },
];

// ── Entry walker — recursively extracts translatable strings ──

function extractEntries(entries, keyPrefix, output) {
  if (!Array.isArray(entries)) return;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const key = `${keyPrefix}.${i}`;

    if (typeof entry === 'string') {
      output[key] = entry;
    } else if (entry && typeof entry === 'object') {
      // Named subsections (entries, inset, insetReadaloud, etc.)
      if (typeof entry.name === 'string') {
        output[`${key}.name`] = entry.name;
      }
      // Single entry field (item type)
      if (typeof entry.entry === 'string') {
        output[`${key}.entry`] = entry.entry;
      }
      // Quote attribution
      if (typeof entry.by === 'string') {
        output[`${key}.by`] = entry.by;
      }
      // Table caption
      if (typeof entry.caption === 'string') {
        output[`${key}.caption`] = entry.caption;
      }
      // Table column labels
      if (Array.isArray(entry.colLabels)) {
        for (let ci = 0; ci < entry.colLabels.length; ci++) {
          if (typeof entry.colLabels[ci] === 'string') {
            output[`${key}.colLabels.${ci}`] = entry.colLabels[ci];
          }
        }
      }
      // Table rows
      if (Array.isArray(entry.rows)) {
        for (let ri = 0; ri < entry.rows.length; ri++) {
          const row = entry.rows[ri];
          if (Array.isArray(row)) {
            for (let ci = 0; ci < row.length; ci++) {
              if (typeof row[ci] === 'string') {
                output[`${key}.rows.${ri}.${ci}`] = row[ci];
              }
            }
          }
        }
      }
      // Nested entries
      if (Array.isArray(entry.entries)) {
        extractEntries(entry.entries, `${key}.entries`, output);
      }
      // List items
      if (Array.isArray(entry.items)) {
        extractEntries(entry.items, `${key}.items`, output);
      }
    }
  }
}

// ── Extract a standard 5etools data file (spells, feats, items, etc.) ──

function extractStandardFile(data, stem, output) {
  if (typeof data.name === 'string') {
    output[`${stem}.name`] = data.name;
  }

  // Entries
  if (Array.isArray(data.entries)) {
    extractEntries(data.entries, `${stem}.entries`, output);
  }

  // Prerequisite free-text (optional features: "Stage N of the {@charoption ...}", some feats)
  if (Array.isArray(data.prerequisite)) {
    for (let i = 0; i < data.prerequisite.length; i++) {
      const p = data.prerequisite[i];
      if (p && typeof p.other === 'string') {
        output[`${stem}.prerequisite.${i}.other`] = p.other;
      }
    }
  }

  // Higher level entries (spells)
  if (Array.isArray(data.entriesHigherLevel)) {
    extractEntries(data.entriesHigherLevel, `${stem}.entriesHigherLevel`, output);
  }

  // Material components (spells)
  if (data.components) {
    const m = data.components.m;
    if (typeof m === 'string') {
      output[`${stem}.components.m`] = m;
    } else if (m && typeof m === 'object' && typeof m.text === 'string') {
      output[`${stem}.components.m`] = m.text;
    }
  }

  // Fluff text (species)
  if (Array.isArray(data._fluffText)) {
    extractEntries(data._fluffText, `${stem}._fluffText`, output);
  }

  // Fluff (backgrounds) — recurse so structured lore (nested {type:"entries"}
  // sections with sub-headings, e.g. Faction Agent's "The Harpers") is captured,
  // not just flat string paragraphs. Flat strings still emit `${stem}.fluff.${i}`.
  if (Array.isArray(data.fluff)) {
    extractEntries(data.fluff, `${stem}.fluff`, output);
  }
}

// ── Extract a class JSON file ──

function extractClassFile(data, output) {
  const stem = data.id || path.parse(data.name || 'unknown').name;

  if (typeof data.name === 'string') output[`${stem}.name`] = data.name;

  // Fluff (многоабзацный лор класса) — заменил короткий root description
  if (Array.isArray(data.fluff)) {
    for (let i = 0; i < data.fluff.length; i++) {
      if (typeof data.fluff[i] === 'string') {
        output[`${stem}.fluff.${i}`] = data.fluff[i];
      }
    }
  }

  // Starting equipment
  if (data.startingEquipment) {
    for (const optKey of ['optionA', 'optionB']) {
      const opt = data.startingEquipment[optKey];
      if (Array.isArray(opt)) {
        for (let i = 0; i < opt.length; i++) {
          if (typeof opt[i] === 'string') {
            output[`${stem}.startingEquipment.${optKey}.${i}`] = opt[i];
          }
        }
      }
    }
  }

  // Level table feature names
  if (Array.isArray(data.levelTable)) {
    for (let li = 0; li < data.levelTable.length; li++) {
      const row = data.levelTable[li];
      if (Array.isArray(row.features)) {
        for (let fi = 0; fi < row.features.length; fi++) {
          if (typeof row.features[fi] === 'string') {
            output[`${stem}.levelTable.${li}.features.${fi}`] = row.features[fi];
          }
        }
      }
    }
  }

  // Class features
  if (Array.isArray(data.classFeatures)) {
    for (let i = 0; i < data.classFeatures.length; i++) {
      const feat = data.classFeatures[i];
      const fKey = `${stem}.classFeatures.${i}`;
      if (typeof feat.name === 'string') output[`${fKey}.name`] = feat.name;
      if (typeof feat.description === 'string') output[`${fKey}.description`] = feat.description;

      // Details (arbitrary string values)
      if (feat.details && typeof feat.details === 'object') {
        for (const [dk, dv] of Object.entries(feat.details)) {
          if (typeof dv === 'string') {
            output[`${fKey}.details.${dk}`] = dv;
          }
        }
      }

      // Some class features have entries
      if (Array.isArray(feat.entries)) {
        extractEntries(feat.entries, `${fKey}.entries`, output);
      }
    }
  }
}

// ── Extract a subclass JSON file ──

function extractSubclassFile(data, output) {
  const stem = data.id || path.parse(data.name || 'unknown').name;

  if (typeof data.name === 'string') output[`${stem}.name`] = data.name;
  if (typeof data.description === 'string') output[`${stem}.description`] = data.description;
  if (typeof data.shortDescription === 'string') output[`${stem}.shortDescription`] = data.shortDescription;

  // Subclass features
  if (Array.isArray(data.features)) {
    for (let i = 0; i < data.features.length; i++) {
      const feat = data.features[i];
      const fKey = `${stem}.features.${i}`;
      if (typeof feat.name === 'string') output[`${fKey}.name`] = feat.name;
      if (typeof feat.description === 'string') output[`${fKey}.description`] = feat.description;

      if (feat.details && typeof feat.details === 'object') {
        for (const [dk, dv] of Object.entries(feat.details)) {
          if (typeof dv === 'string') {
            output[`${fKey}.details.${dk}`] = dv;
          }
        }
      }

      if (Array.isArray(feat.entries)) {
        extractEntries(feat.entries, `${fKey}.entries`, output);
      }
    }
  }
}

// ── Glob helper (Node 22+) with fallback ──

async function findFiles(baseDir, pattern) {
  const fullPattern = path.join(baseDir, pattern).replace(/\\/g, '/');
  const files = [];
  try {
    for await (const entry of glob(fullPattern)) {
      files.push(entry);
    }
  } catch {
    // Fallback: manual walk
    const walkDir = (dir, pat) => {
      const parts = pat.split('/');
      if (parts.length === 1) {
        // leaf pattern
        const regex = new RegExp('^' + parts[0].replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
        if (fs.existsSync(dir)) {
          for (const f of fs.readdirSync(dir)) {
            if (regex.test(f)) files.push(path.join(dir, f));
          }
        }
      } else {
        const [first, ...rest] = parts;
        if (first === '*') {
          if (fs.existsSync(dir)) {
            for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
              if (d.isDirectory()) walkDir(path.join(dir, d.name), rest.join('/'));
            }
          }
        } else {
          walkDir(path.join(dir, first), rest.join('/'));
        }
      }
    };
    walkDir(baseDir, pattern);
  }
  return files.sort();
}

// ── Main ──

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  let totalKeys = 0;

  for (const cat of CATEGORIES) {
    const baseDir = path.join(DATA_DIR, cat.dir);
    const files = await findFiles(baseDir, cat.pattern);
    const output = {};

    for (const filePath of files) {
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(raw);
        const stem = path.parse(filePath).name;

        if (cat.type === 'class') {
          extractClassFile(data, output);
        } else if (cat.type === 'subclass') {
          extractSubclassFile(data, output);
        } else {
          extractStandardFile(data, stem, output);
        }
      } catch (e) {
        console.warn(`  ⚠ Skipped ${filePath}: ${e.message}`);
      }
    }

    // Sort keys for stable output
    const sorted = {};
    for (const k of Object.keys(output).sort()) {
      sorted[k] = output[k];
    }

    const outPath = path.join(OUTPUT_DIR, `${cat.id}.json`);
    fs.writeFileSync(outPath, JSON.stringify(sorted, null, 2) + '\n', 'utf-8');

    const keyCount = Object.keys(sorted).length;
    totalKeys += keyCount;
    console.log(`✓ ${cat.id}: ${keyCount} keys (${files.length} files)`);
  }

  console.log(`\nTotal: ${totalKeys} translatable strings across ${CATEGORIES.length} categories`);
}

main().catch(e => { console.error(e); process.exit(1); });
