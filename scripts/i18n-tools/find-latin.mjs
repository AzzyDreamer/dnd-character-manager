// Flag leftover latin in rendered RU display (translation helper, untracked).
// Approximates the renderer's getTagDisplayName: for each {@tag a|b|c|d} it keeps
// the segment that actually renders, then reports ru values that still contain a
// run of 2+ latin letters (i.e. untranslated English leaking into the UI).
// Usage: node scripts/i18n-tools/find-latin.mjs <file> [limit=40]
import { readFileSync } from 'node:fs';

const file = process.argv[2];
const limit = Number(process.argv[3] ?? 40);
const en = JSON.parse(readFileSync(`src/i18n/gamedata/en/${file}.json`, 'utf-8'));
const ru = JSON.parse(readFileSync(`src/i18n/gamedata/ru/${file}.json`, 'utf-8'));

// Tags whose visible text is the FIRST arg segment (rendered as-is / id-like).
const FIRST_SEG = new Set([
  'dice', 'damage', 'hit', 'scaledamage', 'scaledice', 'chance', 'dc',
  'filter', 'link',
]);

// inner is the text between { and }, e.g. "@skill Athletics|XPHB|Атлетика".
// 5etools format: "@tagName arg0|arg1|arg2" (tag name split from args by a space).
function renderTag(inner) {
  const sp = inner.indexOf(' ');
  if (sp < 0) return ''; // bare tag, nothing visible
  const tag = inner.slice(1, sp);
  const segs = inner.slice(sp + 1).split('|'); // [name, source, display, ...]
  if (tag === 'book' || tag === 'adventure') return ''; // stripped on render
  if (FIRST_SEG.has(tag)) return segs[0] ?? '';
  if (tag === 'subclass') return segs[3] || segs[0] || ''; // {name|class|src|display}
  if (segs.length >= 3 && segs[2]) return segs[2]; // generic: parts[2]
  return segs[0] ?? '';
}

function render(s) {
  return String(s).replace(/\{(@[^}]+)\}/g, (_, inner) => ' ' + renderTag(inner) + ' ');
}

const hits = [];
for (const [k, v] of Object.entries(ru)) {
  if (typeof v !== 'string') continue;
  if (ru[k] === en[k]) continue; // untranslated — dump-remaining reports those
  const rendered = render(v);
  const m = rendered.match(/[A-Za-z]{2,}/g);
  if (m) hits.push([k, [...new Set(m)].join(', '), v]);
}

console.log(`Latin leaks: ${hits.length}`);
for (const [k, words, v] of hits.slice(0, limit)) {
  console.log(`${JSON.stringify(k)}  [${words}]`);
  console.log(`   ${v}`);
}
