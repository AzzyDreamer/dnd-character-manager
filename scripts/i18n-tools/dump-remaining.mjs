// Dump untranslated keys for ru/<file>.json (translation helper, untracked).
// A key is "remaining" if ru[k] is missing or byte-identical to en[k], AND the
// tag-stripped en value has 2+ latin letters (skips dice/number-only values).
// Output: "Total remaining: N" then `"key"\t"en value"` (raw, tags intact).
// Usage: node scripts/i18n-tools/dump-remaining.mjs <file> [limit=40] [offset=0]
import { readFileSync } from 'node:fs';

const file = process.argv[2];
const limit = Number(process.argv[3] ?? 40);
const offset = Number(process.argv[4] ?? 0);

const en = JSON.parse(readFileSync(`src/i18n/gamedata/en/${file}.json`, 'utf-8'));
const ru = JSON.parse(readFileSync(`src/i18n/gamedata/ru/${file}.json`, 'utf-8'));

const stripTags = (s) => String(s).replace(/\{@[^}]+\}/g, ' ');

const remaining = [];
for (const [k, v] of Object.entries(en)) {
  const translated = ru[k] !== undefined && ru[k] !== v;
  if (translated) continue;
  const latin = (stripTags(v).match(/[A-Za-z]/g) || []).length;
  if (latin < 2) continue;
  remaining.push(k);
}

console.log(`Total remaining: ${remaining.length}`);
for (const k of remaining.slice(offset, offset + limit)) {
  console.log(JSON.stringify(k) + '\t' + JSON.stringify(en[k]));
}
