// Merge a patch {key: ru} (JSON on stdin or file arg) into ru/<file>.json,
// re-sorting keys and matching extract format (2-space indent + trailing NL).
import { readFileSync, writeFileSync } from 'node:fs';
const file = process.argv[2];               // e.g. feats
const patchPath = process.argv[3];          // path to patch json
const ruPath = `src/i18n/gamedata/ru/${file}.json`;
const ru = JSON.parse(readFileSync(ruPath,'utf-8'));
const patch = JSON.parse(readFileSync(patchPath,'utf-8'));
const en = JSON.parse(readFileSync(`src/i18n/gamedata/en/${file}.json`,'utf-8'));
let applied=0, skipped=[];
for (const [k,v] of Object.entries(patch)) {
  if (!(k in en)) { skipped.push(`MISSING_KEY ${k}`); continue; }
  ru[k]=v; applied++;
}
const sorted={};
for (const k of Object.keys(ru).sort()) sorted[k]=ru[k];
writeFileSync(ruPath, JSON.stringify(sorted,null,2)+'\n','utf-8');
console.log(`applied ${applied} to ${file}`);
if (skipped.length) console.log('SKIPPED:\n'+skipped.join('\n'));
