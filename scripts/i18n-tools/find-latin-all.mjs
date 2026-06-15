// Like find-latin.mjs but does NOT skip keys where ru===en. The render-slot bug
// for bare reference tags ({@skill Insight}, {@item Tinker's Tools|XPHB}, ...)
// leaves ru identical to en, so the original helper's `ru===en` skip hides them.
// Usage: node scripts/i18n-tools/find-latin-all.mjs <file> [limit=9999]
import { readFileSync } from 'node:fs';

const file = process.argv[2];
const limit = Number(process.argv[3] ?? 9999);
const en = JSON.parse(readFileSync(`src/i18n/gamedata/en/${file}.json`, 'utf-8'));
const ru = JSON.parse(readFileSync(`src/i18n/gamedata/ru/${file}.json`, 'utf-8'));

const FIRST_SEG = new Set([
  'dice', 'damage', 'hit', 'scaledamage', 'scaledice', 'chance', 'dc',
  'filter', 'link',
]);

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

function render(s) {
  return String(s).replace(/\{(@[^}]+)\}/g, (_, inner) => ' ' + renderTag(inner) + ' ');
}

const hits = [];
const tagCounts = {};
for (const [k, v] of Object.entries(ru)) {
  if (typeof v !== 'string') continue;
  const rendered = render(v);
  const m = rendered.match(/[A-Za-z]{2,}/g);
  if (m) {
    hits.push([k, [...new Set(m)].join(', '), v, ru[k] === en[k]]);
    // collect the offending tag-name from the raw value for a summary
    for (const [, inner] of v.matchAll(/\{(@[^}]+)\}/g)) {
      const sp = inner.indexOf(' ');
      const tag = sp < 0 ? inner.slice(1) : inner.slice(1, sp);
      const disp = renderTag(inner);
      if (/[A-Za-z]{2,}/.test(disp)) tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
    }
  }
}

console.log(`Latin leaks: ${hits.length}  (incl. ru===en)`);
console.log('By tag:', JSON.stringify(tagCounts));
console.log('---');
for (const [k, words, v, same] of hits.slice(0, limit)) {
  console.log(`${same ? '[ru=en] ' : ''}${JSON.stringify(k)}  [${words}]`);
  console.log(`   ${v}`);
}
