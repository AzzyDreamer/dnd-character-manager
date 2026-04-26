#!/usr/bin/env node
/**
 * i18n Status Tracker
 *
 * Scans translated JSON files in `src/i18n/gamedata/<lang>/` and
 * regenerates the localization progress section in README.md.
 *
 * For each gamedata file we count keys whose Russian value differs
 * from the English source. Files in SKIP are excluded from totals
 * (e.g. items.json, where item names are resolved by the renderer
 * and don't need a JSON translation).
 *
 * The README is updated between two pairs of HTML-comment markers:
 *   <!-- i18n:badges:start --> ... <!-- i18n:badges:end -->
 *   <!-- i18n:status:start --> ... <!-- i18n:status:end -->
 *
 * Usage: node scripts/i18n-status.mjs
 *        npm run i18n:status
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const SOURCE_LANG = 'en';
const TARGET_LANG = 'ru';
const EN_DIR = path.join(ROOT, 'src', 'i18n', 'gamedata', SOURCE_LANG);
const RU_DIR = path.join(ROOT, 'src', 'i18n', 'gamedata', TARGET_LANG);
const README = path.join(ROOT, 'README.md');

// Files intentionally not counted toward translation progress.
// items.json — item names are looked up by the renderer; the JSON
// values mirror the source on purpose.
const SKIP = new Set(['items.json']);

const PROGRESS_BAR_WIDTH = 18;

function loadJson(p) {
  try { return JSON.parse(readFileSync(p, 'utf-8')); }
  catch { return null; }
}

function pctStr(pct) {
  if (pct >= 100) return '100%';
  if (pct === 0) return '0%';
  return `${pct.toFixed(1).replace(/\.0$/, '')}%`;
}

function badgeColor(pct) {
  if (pct >= 100) return 'brightgreen';
  if (pct >= 85) return 'green';
  if (pct >= 60) return 'yellowgreen';
  if (pct >= 40) return 'yellow';
  if (pct >= 20) return 'orange';
  return 'red';
}

function progressBar(pct, width = PROGRESS_BAR_WIDTH) {
  const filled = Math.round((pct / 100) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function shieldsBadge(label, pct) {
  // shields.io requires URL-encoded label and message; dashes inside the
  // label must be doubled and percent signs need to be escaped as %25.
  const enc = (s) => encodeURIComponent(s).replace(/-/g, '--').replace(/_/g, '__');
  const message = pctStr(pct).replace('%', '%25');
  return `https://img.shields.io/badge/${enc(label)}-${message}-${badgeColor(pct)}`;
}

function replaceBlock(text, marker, newContent) {
  const startTag = `<!-- ${marker}:start -->`;
  const endTag = `<!-- ${marker}:end -->`;
  const re = new RegExp(`${startTag}[\\s\\S]*?${endTag}`);
  if (!re.test(text)) {
    throw new Error(`README.md is missing markers ${startTag} ... ${endTag}`);
  }
  return text.replace(re, `${startTag}\n${newContent}\n${endTag}`);
}

// ── Compute stats ──

const allFiles = readdirSync(EN_DIR)
  .filter((f) => f.endsWith('.json'))
  .sort();

const stats = [];
let totalKeys = 0;
let totalTranslated = 0;

for (const file of allFiles) {
  if (SKIP.has(file)) continue;
  const en = loadJson(path.join(EN_DIR, file)) ?? {};
  const ru = loadJson(path.join(RU_DIR, file)) ?? {};
  const total = Object.keys(en).length;
  let translated = 0;
  for (const [k, v] of Object.entries(en)) {
    if (ru[k] !== undefined && ru[k] !== v) translated++;
  }
  const pct = total ? (translated / total) * 100 : 0;
  stats.push({ file, total, translated, pct });
  totalKeys += total;
  totalTranslated += translated;
}

stats.sort((a, b) => b.pct - a.pct || a.file.localeCompare(b.file));
const overallPct = totalKeys ? (totalTranslated / totalKeys) * 100 : 0;

// ── Build BADGES block ──

const overallBadgeUrl = shieldsBadge(`i18n ${TARGET_LANG.toUpperCase()}`, overallPct);
const overallBadge = `![i18n ${TARGET_LANG.toUpperCase()}](${overallBadgeUrl})`;

const fileBadges = stats
  .map((s) => {
    const label = s.file.replace(/\.json$/, '');
    return `![${label}](${shieldsBadge(label, s.pct)})`;
  })
  .join(' ');

const badgesBlock = [overallBadge, '', fileBadges].join('\n');

// ── Build TABLE block ──

const tableLines = [
  `Прогресс перевода игровых данных на русский язык. Цифры обновляются скриптом \`npm run i18n:status\`. Файл \`items.json\` исключён из подсчёта (имена предметов локализуются на уровне рендера).`,
  '',
  '| Файл | Прогресс | Переведено / Всего |',
  '|---|---|---:|',
];
for (const s of stats) {
  tableLines.push(
    `| \`${s.file}\` | \`${progressBar(s.pct)}\` ${pctStr(s.pct)} | ${s.translated} / ${s.total} |`,
  );
}
tableLines.push(
  `| **Всего** | \`${progressBar(overallPct)}\` **${pctStr(overallPct)}** | **${totalTranslated} / ${totalKeys}** |`,
);
const tableBlock = tableLines.join('\n');

// ── Patch README ──

let readme = readFileSync(README, 'utf-8');
readme = replaceBlock(readme, 'i18n:badges', badgesBlock);
readme = replaceBlock(readme, 'i18n:status', tableBlock);
writeFileSync(README, readme, 'utf-8');

console.log(`README.md updated.`);
console.log(`Overall: ${totalTranslated} / ${totalKeys} (${pctStr(overallPct)})`);
console.log(`Files tracked: ${stats.length}; skipped: ${[...SKIP].join(', ') || 'none'}`);
