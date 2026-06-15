// One-shot repair: append RU display segments to bare reference tags in
// ru/backgrounds.json whose rendered slot still shows English (skill/item/feat/
// spell/creature/filter). These have ru===en so find-latin.mjs skipped them.
// RU pulled from sibling ru/ files (skills via in-file precedent, feats.json,
// spells.json) + manual dicts for creatures/filters. Run with --write to save.
import { readFileSync, writeFileSync } from 'node:fs';

const WRITE = process.argv.includes('--write');
const load = (p) => JSON.parse(readFileSync(p, 'utf-8'));
const ru = load('src/i18n/gamedata/ru/backgrounds.json');
const en = load('src/i18n/gamedata/en/backgrounds.json');
const spells = load('src/i18n/gamedata/ru/spells.json');
const spellsEn = load('src/i18n/gamedata/en/spells.json');
const feats = load('src/i18n/gamedata/ru/feats.json');
const featsEn = load('src/i18n/gamedata/en/feats.json');

const FIRST_SEG = new Set(['dice', 'damage', 'hit', 'scaledamage', 'scaledice', 'chance', 'dc', 'filter', 'link']);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const cyr = /[А-Яа-яЁё]/;
const latin = /[A-Za-z]{2,}/;

function renderTag(inner) {
  const sp = inner.indexOf(' ');
  if (sp < 0) return '';
  const tag = inner.slice(1, sp);
  const segs = inner.slice(sp + 1).split('|');
  if (tag === 'book' || tag === 'adventure') return '';
  if (FIRST_SEG.has(tag)) return segs[0] ?? '';
  if (tag === 'subclass') return segs[3] || segs[0] || '';
  if (segs.length >= 3 && segs[2]) return segs[2];
  return segs[0] ?? '';
}

// ---- skill map: in-file dominant cyrillic display, capitalized ----
const inFile = {};
for (const v of Object.values(ru)) {
  if (typeof v !== 'string') continue;
  for (const m of v.matchAll(/\{(@[^}]+)\}/g)) {
    const inner = m[1];
    const sp = inner.indexOf(' ');
    if (sp < 0) continue;
    const tag = inner.slice(1, sp);
    const segs = inner.slice(sp + 1).split('|');
    const d = renderTag(inner);
    if (!cyr.test(d)) continue;
    const id = (segs[0] || '').toLowerCase().trim();
    const key = tag + '|' + id;
    (inFile[key] = inFile[key] || {})[d] = (inFile[key][d] || 0) + 1;
  }
}
const dominant = (tag, id) => {
  const counts = inFile[tag + '|' + id.toLowerCase().trim()];
  if (!counts) return null;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
};

// ---- feats / spells indexes ----
const featIdx = {};
const normFeat = (s) => s.replace(/['’]/g, '').toLowerCase().trim();
for (const k of Object.keys(feats)) {
  if (!k.endsWith('.name')) continue;
  const base = k.slice(0, -5);
  if (feats[k] && feats[k] !== featsEn[k]) featIdx[normFeat(base)] = feats[k];
}
const spellIdx = {};
const normSpell = (s) => s.replace(/\//g, '-').toLowerCase().trim();
for (const k of Object.keys(spells)) {
  if (!k.endsWith('.name')) continue;
  const base = k.slice(0, -5);
  if (spells[k] && spells[k] !== spellsEn[k]) spellIdx[normSpell(base)] = spells[k];
}

// ---- manual dicts ----
const creatureMap = {
  'beholder': 'Созерцатель', 'centaur': 'Кентавр', 'cosmic horror': 'Космический ужас',
  'dryad': 'Дриада', 'faerie dragon (violet)': 'Фейский дракон', 'feyr': 'Фейр',
  'mind flayer': 'Свежеватель разума', 'neh-thalggu': 'Нэх-таллгу', 'neogi': 'Неоги',
  'pixie': 'Пикси', 'satyr': 'Сатир', 'space clown': 'Космический клоун',
  'sprite': 'Спрайт', 'unicorn': 'Единорог', 'vampirate': 'Вампират',
  'void scavver': 'Пустотный падальщик',
};
const filterMap = {
  'vehicles (land)': 'Транспорт (наземный)',
  'vehicles (water)': 'Транспорт (водный)',
  'vehicles (space)': 'Транспорт (космический)',
  'vehicles (water, land)': 'Транспорт (водный, наземный)',
  "artisan's tools": 'Инструменты ремесленника',
  'gaming set': 'Игровой набор',
  'musical instrument': 'Музыкальный инструмент',
  'lunar dragon': 'Лунный дракон',
};
const DEFAULT_SRC = { skill: 'XPHB' };

const unresolved = [];
let fixed = 0;

function rewrite(inner) {
  const sp = inner.indexOf(' ');
  if (sp < 0) return null;
  const tag = inner.slice(1, sp);
  const segs = inner.slice(sp + 1).split('|');
  const display = renderTag(inner);
  if (!latin.test(display)) return null; // already cyrillic / nothing to do

  const id = segs[0] || '';
  let ruDisp = null;
  if (tag === 'skill' || tag === 'item') ruDisp = dominant(tag, id);
  else if (tag === 'feat') ruDisp = featIdx[normFeat(id)];
  else if (tag === 'spell') ruDisp = spellIdx[normSpell(id)];
  else if (tag === 'creature') ruDisp = creatureMap[id.toLowerCase().trim()];
  else if (tag === 'filter') ruDisp = filterMap[id.toLowerCase().trim()];
  else return null;

  if (!ruDisp) { unresolved.push(tag + ' ' + id); return null; }
  if ((tag === 'skill' || tag === 'item') && /^[а-яё]/.test(ruDisp)) ruDisp = cap(ruDisp);

  let out;
  if (tag === 'filter') {
    segs[0] = ruDisp; // translate first segment in place
    out = '@' + tag + ' ' + segs.join('|');
  } else {
    // display lives in parts[2]
    if (segs.length < 2) segs[1] = DEFAULT_SRC[tag] ?? '';
    segs[2] = ruDisp;
    out = '@' + tag + ' ' + segs.join('|');
  }
  fixed++;
  return out;
}

for (const [k, v] of Object.entries(ru)) {
  if (typeof v !== 'string') continue;
  const nv = v.replace(/\{(@[^}]+)\}/g, (whole, inner) => {
    const r = rewrite(inner);
    return r == null ? whole : '{' + r + '}';
  });
  if (nv !== v) ru[k] = nv;
}

console.log(`Rewrote ${fixed} tag occurrences.`);
if (unresolved.length) {
  const uniq = [...new Set(unresolved)].sort();
  console.log(`Unresolved (${uniq.length}):`);
  for (const u of uniq) console.log('  ' + u);
}

if (WRITE) {
  // preserve existing key order (values edited in place) to keep the diff minimal
  writeFileSync('src/i18n/gamedata/ru/backgrounds.json', JSON.stringify(ru, null, 2) + '\n', 'utf-8');
  console.log('WROTE ru/backgrounds.json');
} else {
  console.log('(dry run — pass --write to save)');
}
