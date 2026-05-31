import fs from 'fs';
const file = process.argv[2] || 'spells';
const en = JSON.parse(fs.readFileSync(`src/i18n/gamedata/en/${file}.json`, 'utf8'));
const ru = JSON.parse(fs.readFileSync(`src/i18n/gamedata/ru/${file}.json`, 'utf8'));
const strip = (s) => String(s).replace(/\{@[^}]*\}/g, '').trim();
const out = [];
for (const k of Object.keys(en)) {
  const e = en[k];
  if (typeof e !== 'string') continue;
  const stripped = strip(e);
  const latin = (stripped.match(/[a-zA-Z]/g) || []).length;
  if (latin < 2) continue;
  const r = ru[k];
  if (r === undefined || r === e) out.push(k);
}
console.log(`Total remaining translatable: ${out.length}`);
for (const k of out.slice(0, 40)) {
  console.log('---');
  console.log('KEY: ' + k);
  console.log('EN:  ' + en[k]);
}
