// Fill byte-identical-EN duplicate keys with an existing RU translation
// (translation helper, untracked). After a manual patch+apply, this copies a
// translated RU value into every still-untranslated key whose EN value is
// byte-identical, so shared lore blocks only need translating once.
// Usage: node scripts/i18n-tools/fill-dupes.mjs <file>
import { readFileSync, writeFileSync } from 'node:fs';

const file = process.argv[2];
const enPath = `src/i18n/gamedata/en/${file}.json`;
const ruPath = `src/i18n/gamedata/ru/${file}.json`;

const en = JSON.parse(readFileSync(enPath, 'utf-8'));
const ru = JSON.parse(readFileSync(ruPath, 'utf-8'));

// en-value -> first available translated ru-value
const byEn = new Map();
for (const [k, v] of Object.entries(en)) {
  if (ru[k] !== undefined && ru[k] !== v && !byEn.has(v)) byEn.set(v, ru[k]);
}

let filled = 0;
for (const [k, v] of Object.entries(en)) {
  const translated = ru[k] !== undefined && ru[k] !== v;
  if (translated) continue;
  if (byEn.has(v)) { ru[k] = byEn.get(v); filled++; }
}

const sorted = {};
for (const k of Object.keys(ru).sort()) sorted[k] = ru[k];
writeFileSync(ruPath, JSON.stringify(sorted, null, 2) + '\n', 'utf-8');
console.log(`filled ${filled} duplicate keys in ${file}`);
