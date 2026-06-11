// Аудит механики: сканирует бандлы данных на пассивные числовые эффекты
// (КД, скорость, HP, резисты, сенсы, инициатива, спасброски и т.д.) и
// сверяет их с подключёнными таблицами эффектов в src/utils/*.ts.
//
// Запуск: node scripts/audit-mechanics.mjs [--json out.json]
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const B = p => path.join(ROOT, 'src', 'data', '_bundles', p);

const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));

// ── Wired effect tables (extracted from TS source by key) ──
function extractRecordKeys(tsSource, recordName) {
  const m = tsSource.match(new RegExp(`${recordName}[^=]*=\\s*\\{`));
  if (!m) return [];
  let depth = 0, i = tsSource.indexOf('{', m.index);
  const start = i;
  for (; i < tsSource.length; i++) {
    if (tsSource[i] === '{') depth++;
    else if (tsSource[i] === '}') { depth--; if (depth === 0) break; }
  }
  const body = tsSource.slice(start + 1, i);
  const keys = [];
  // top-level keys: 'name': or name: at depth 1
  let d = 0;
  for (const line of body.split('\n')) {
    const open = (line.match(/\{/g) || []).length;
    const close = (line.match(/\}/g) || []).length;
    if (d === 0) {
      const km = line.match(/^\s*'([^']+)'\s*:/) || line.match(/^\s*"([^"]+)"\s*:/) || line.match(/^\s*([A-Za-z][\w-]*)\s*:\s*[\[{]/);
      if (km) keys.push(km[1]);
    }
    d += open - close;
  }
  return keys;
}

const classEffectsSrc = fs.readFileSync(path.join(ROOT, 'src/utils/classEffects.ts'), 'utf8');
const featEffectsSrc = fs.readFileSync(path.join(ROOT, 'src/utils/featEffects.ts'), 'utf8');
const WIRED = {
  classes: extractRecordKeys(classEffectsSrc, 'CLASS_EFFECTS'),
  subclasses: extractRecordKeys(classEffectsSrc, 'SUBCLASS_EFFECTS'),
  species: extractRecordKeys(classEffectsSrc, 'SPECIES_EFFECTS'),
  feats: extractRecordKeys(featEffectsSrc, 'FEAT_STAT_EFFECTS'),
};

// ── Text extraction ──
function flattenText(node, out = []) {
  if (node == null) return out;
  if (typeof node === 'string') { out.push(node); return out; }
  if (Array.isArray(node)) { for (const n of node) flattenText(n, out); return out; }
  if (typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (k.startsWith('_') || k === 'fluff' || k === 'fluffText') continue;
      if (k === 'name' && typeof v === 'string') continue;
      flattenText(v, out);
    }
  }
  return out;
}

const stripTags = s => s.replace(/\{@\w+ ([^|}]+)(\|[^}]*)?\}/g, '$1');

// ── Mechanical patterns ──
// Each: [key, regex, captureNote]. Run on lowercased tag-stripped text.
const PATTERNS = [
  ['speed+', /(?:speed|стандартн\w* скорость)[^.]{0,40}?increases? by (\d+)/g],
  ['speed+', /(\d+)[- ]foot bonus to (?:your )?(?:walking )?speed/g],
  ['speed+', /speed of (\d+) feet (?:while|when)/g],
  ['speed-', /speed (?:is reduced|decreases|is decreased) by (\d+)/g],
  ['fly', /fly(?:ing)? speed (?:of|equal to)/g],
  ['swim', /swim(?:ming)? speed (?:of|equal to)/g],
  ['climb', /climb(?:ing)? speed (?:of|equal to)/g],
  ['ac+', /\+(\d+) bonus to (?:your )?(?:ac\b|armor class)/g],
  ['ac+', /(?:ac|armor class) (?:increases? by|increased by) (\d+)/g],
  ['ac+', /gain a \+(\d+) bonus to armor class/g],
  ['acFormula', /(?:base )?armor class (?:equals?|is|becomes) (\d+)/g],
  ['acFormula', /your armor class (?:can'?t be less than|equals)/g],
  ['hp+', /hit point maximum increases by (\d+)/g],
  ['hp+', /gain (\d+) (?:additional |extra )?hit points/g],
  ['hpMaxReduce', /hit point maximum (?:is reduced|decreases|is decreased) by/g],
  ['resist', /resistance to ([a-z, and]+?) damage/g],
  ['resistAll', /resistance to all damage/g],
  ['immune', /immun(?:e|ity) to ([a-z, and]+?) damage/g],
  ['condImmune', /(?:immune to|immunity to) (?:the )?([a-z]+) condition/g],
  ['condImmune', /can'?t be ([a-z]+) (?:while|and)/g],
  ['vuln', /vulnerab(?:le|ility) to ([a-z, and]+?) damage/g],
  ['darkvision', /darkvision (?:out to a range of |with a range of |to a range of |of )?(\d+)/g],
  ['truesight', /truesight (?:out to a range of |with a range of |of )?(\d+)/g],
  ['blindsight', /blindsight (?:out to a range of |with a range of |of )?(\d+)/g],
  ['init+', /(?:bonus to|add(?:ed)? to|equal to your [a-z]+ modifier to) (?:your )?initiative/g],
  ['init+', /\+(\d+) bonus to initiative/g],
  ['initAdv', /advantage on initiative/g],
  ['saveProf', /(?:gain )?proficiency in ([a-z]+)(?:,? and [a-z]+)? saving throws/g],
  ['saveProf', /saving throw proficiency/g],
  ['saveBonus', /\+(\d+) bonus to (?:all )?saving throws/g],
  ['saveBonus', /bonus to all saving throws equal to/g],
  ['abilityCap', /(?:score )?maximum (?:is now|increases? (?:to|by)) (\d+)/g],
  ['ability+', /score increases by (\d+)/g],
  ['skillProf', /proficiency in the ([a-z' ]+?) skill/g],
  ['expertise', /\bexpertise\b/g],
  ['attackBonus', /\+(\d+) bonus to (?:your )?attack rolls/g],
  ['profBonusAdd', /add (?:twice )?your proficiency bonus to/g],
];

function scanText(rawTexts) {
  const text = stripTags(rawTexts.join('\n')).toLowerCase();
  const hits = [];
  for (const [key, re] of PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
      const ctxStart = Math.max(0, m.index - 60);
      const ctx = text.slice(ctxStart, m.index + m[0].length + 60).replace(/\s+/g, ' ');
      hits.push({ key, match: m[0], val: m[1], ctx: '…' + ctx + '…' });
    }
  }
  return hits;
}

// JSON-fields with direct mechanics (already-structured data)
const MECH_FIELDS = ['ability', 'resist', 'immune', 'vulnerable', 'conditionImmune', 'senses', 'bonusSenses',
  'skillProficiencies', 'toolProficiencies', 'languageProficiencies', 'weaponProficiencies',
  'armorProficiencies', 'savingThrowProficiencies', 'expertise', 'additionalSpells', 'skillToolLanguageProficiencies', 'feats'];

function fieldSummary(obj) {
  const out = {};
  for (const f of MECH_FIELDS) if (obj[f] != null) out[f] = JSON.stringify(obj[f]).slice(0, 120);
  return out;
}

// ── Audits ──
const report = {};

// Classes
{
  const classes = read(B('classes.json'));
  report.classes = classes.map(c => {
    const feats = (c.classFeatures ?? []).map(f => {
      const texts = flattenText([f.description, f.details]);
      const hits = scanText(texts);
      return hits.length ? { feature: f.name, level: f.level, hits } : null;
    }).filter(Boolean);
    return { id: c.id, name: c.name, wired: WIRED.classes.includes(c.id), mechFeatures: feats };
  });
}

// Subclasses
{
  const subs = read(B('subclasses.json'));
  report.subclasses = subs.map(s => {
    const feats = (s.features ?? []).map(f => {
      const texts = flattenText([f.description, f.details]);
      const hits = scanText(texts);
      return hits.length ? { feature: f.name, level: f.level, hits } : null;
    }).filter(Boolean);
    const key = `${s.classId}:${s.id}`;
    return { key, name: s.name, wired: WIRED.subclasses.includes(key), mechFeatures: feats };
  });
}

// Feats
{
  const feats = read(B('feats.json'));
  report.feats = feats.map(f => {
    const texts = flattenText(f.entries);
    const hits = scanText(texts);
    return {
      name: f.name, category: f.category,
      wiredStat: WIRED.feats.includes(f.name),
      fields: fieldSummary(f),
      hits,
    };
  });
}

// Species
{
  const species = read(B('species.json'));
  const flat = [];
  for (const raw of species) {
    const s = Array.isArray(raw) ? raw[0] : raw;
    if (!s?.name) continue;
    flat.push(s);
    // versions are expanded at runtime; scan base entries only (versions mostly override same fields)
  }
  report.species = flat.map(s => {
    const texts = flattenText(s.entries);
    const hits = scanText(texts);
    return {
      name: s.name, source: s.source,
      wired: WIRED.species.includes(s.name),
      speed: s.speed, darkvision: s.darkvision,
      fields: fieldSummary(s),
      hits,
    };
  });
}

// Backgrounds
{
  const bgs = read(B('backgrounds.json'));
  report.backgrounds = bgs.map(b => ({
    name: b.name, source: b.source,
    fields: fieldSummary(b),
    skillChoose: JSON.stringify(b.skillProficiencies ?? []).includes('choose'),
    hits: scanText(flattenText(b.entries)),
  }));
}

// Optional features (split: transformation boons/flaws vs class options)
{
  const ofs = read(B('optionalfeatures.json'));
  report.optionalfeatures = ofs.map(f => {
    const ft = (f.featureType ?? []).join(',');
    const isTransform = /:(TB|TF)\b/.test(ft);
    return {
      name: f.name, featureType: ft, isTransform,
      fields: fieldSummary(f),
      hits: scanText(flattenText(f.entries)),
    };
  });
}

// Char creation options
{
  const ccos = read(B('charactercreationoptions.json'));
  report.charoptions = ccos.map(c => ({
    name: c.name, optionType: (c.optionType ?? []).join(','),
    hits: scanText(flattenText(c.entries)),
  }));
}

// ── Output ──
const outIdx = process.argv.indexOf('--json');
if (outIdx >= 0) {
  const out = process.argv[outIdx + 1] ?? 'audit-mechanics.json';
  fs.writeFileSync(out, JSON.stringify({ wired: WIRED, report }, null, 1));
  console.log('written', out);
} else {
  // Summary to stdout
  console.log('WIRED TABLES:', JSON.stringify(WIRED, null, 1));
  const cnt = (arr, pred) => arr.filter(pred).length;
  console.log('\nclasses with mech features:', cnt(report.classes, c => c.mechFeatures.length));
  console.log('subclasses with mech features:', cnt(report.subclasses, s => s.mechFeatures.length), '/', report.subclasses.length, '(wired:', cnt(report.subclasses, s => s.wired) + ')');
  console.log('feats with text hits:', cnt(report.feats, f => f.hits.length), '/', report.feats.length);
  console.log('species:', report.species.length, 'darkvision:', cnt(report.species, s => s.darkvision), 'ability:', cnt(report.species, s => s.fields.ability), 'skillProf:', cnt(report.species, s => s.fields.skillProficiencies));
  console.log('backgrounds with skill choose:', cnt(report.backgrounds, b => b.skillChoose));
  console.log('optional features (transform):', cnt(report.optionalfeatures, o => o.isTransform), 'with hits:', cnt(report.optionalfeatures, o => o.isTransform && o.hits.length));
}
