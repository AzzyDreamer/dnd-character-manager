// Гарантия чистоты веб-бандла: десктоп-онли код (@tauri-apps/*, src/online/*,
// fileCharacterStore, src/components/desktop/*) должен подключаться ТОЛЬКО
// динамически (lazy/await import) под isTauri(). Любой СТАТИЧЕСКИЙ import/реэкспорт
// такого модуля из обычного файла потянул бы его в веб-сборку (GitHub Pages),
// где Tauri-API отсутствует → распухание/падение. Этот скрипт ловит регрессию
// на уровне исходников (дёшево, без сборки). См. docs/PLAN_PARTY_LOCAL.md (LP0).

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');

// Файлы, которым РАЗРЕШЕНО статически импортировать десктоп-онли код:
// сами они грузятся лишь динамически (точки входа за isTauri()).
function isAllowlisted(rel) {
  return (
    rel.startsWith('src/online/') ||
    rel.startsWith('src/components/desktop/') ||
    rel === 'src/utils/fileCharacterStore.ts' ||
    rel === 'src/utils/openDataFolder.ts' ||
    rel === 'src/utils/updater.ts'
  );
}

function isForbiddenSpecifier(spec) {
  return (
    spec.includes('@tauri-apps') ||
    spec.includes('fileCharacterStore') ||
    /(^|\/)online(\/|$)/.test(spec) ||
    /(^|\/)components\/desktop(\/|$)/.test(spec)
  );
}

// Статические import/export-from. Намеренно НЕ матчит `import(...)` (динамический)
// и `lazy(() => import(...))`: после `import`/`export` нет `(`.
const STATIC_RE =
  /(?:import|export)(?:["'\s]*(?:[\w*{}\n\r\t, ]+)from\s*)?["']([^"']+)["']/g;

function collectFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...collectFiles(full));
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

const violations = [];
for (const file of collectFiles(SRC)) {
  const rel = relative(ROOT, file).split(sep).join('/');
  if (isAllowlisted(rel)) continue;
  const code = readFileSync(file, 'utf8');
  for (const match of code.matchAll(STATIC_RE)) {
    const spec = match[1];
    if (isForbiddenSpecifier(spec)) {
      violations.push(`${rel}: static import of "${spec}"`);
    }
  }
}

if (violations.length > 0) {
  console.error('Web-bundle purity check FAILED. Desktop-only code must be imported');
  console.error('dynamically (lazy/await import) under isTauri(), not statically:\n');
  for (const v of violations) console.error(`  ✗ ${v}`);
  console.error('\nIf this file is itself a desktop-only entry point, add it to the');
  console.error('allowlist in scripts/check-web-imports.mjs.');
  process.exit(1);
}

console.log('Web-bundle purity check passed: no static desktop-only imports.');
