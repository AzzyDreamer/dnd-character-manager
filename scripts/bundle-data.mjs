// Склеивает множество мелких JSON-файлов данных в один файл-бандл на категорию.
//
// Зачем: исходные данные лежат как тысячи отдельных .json (items — 1733,
// spells — 700, ...). Раньше загрузчики тянули их через import.meta.glob, что
// превращало каждый файл в отдельный модуль/сетевой запрос. В dev это терпимо
// (диск), но на проде (GitHub Pages) экран инициализации висел минутами из-за
// тысяч HTTP-запросов. Склейка в один файл на категорию = один модуль в dev и
// один чанк в проде.
//
// Бандлы пишутся в src/data/_bundles/<категория>.json и НЕ коммитятся
// (см. .gitignore). Скрипт запускается автоматически на predev/prebuild.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, parse } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA = join(ROOT, 'src', 'data');
const OUT = join(DATA, '_bundles');
const sep = process.platform === 'win32' ? '\\' : '/';

// Рекурсивно собирает все .json по предикату пути.
function collectJson(dir, accept) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...collectJson(full, accept));
    } else if (name.endsWith('.json') && accept(full)) {
      out.push(full);
    }
  }
  return out;
}

// Описание категорий: имя бандла -> как находить исходные файлы.
// Пути и вложенность повторяют прежние import.meta.glob паттерны.
const CATEGORIES = {
  actions:                  () => flat('actions'),
  charactercreationoptions: () => flat('charactercreationoptions'),
  conditionsdiseases:       () => flat('conditionsdiseases'),
  creatures:                () => flat('creatures'),
  feats:                    () => flat('feats'),
  itemproperties:           () => flat('itemproperties'),
  items:                    () => flat('items'),
  'items-base':             () => flat('items-base'),
  optionalfeatures:         () => flat('optionalfeatures'),
  senses:                   () => flat('senses'),
  skills:                   () => flat('skills'),
  species:                  () => flat('species'),
  spells:                   () => flat('spells'),
  variantrule:              () => flat('variantrule'),
  // backgrounds: ./backgrounds/backgrounds/*.json
  backgrounds:              () => listDir(join(DATA, 'backgrounds', 'backgrounds')),
  // classes: ./classes/<class>/<class>.json (ровно 2 уровня, без subclasses)
  classes:                  () => collectJson(join(DATA, 'classes'),
                              p => !p.includes(`${sep}subclasses${sep}`) && depthUnder(join(DATA, 'classes'), p) === 2),
  // subclasses: ./classes/<class>/subclasses/*.json
  subclasses:               () => collectJson(join(DATA, 'classes'),
                              p => p.includes(`${sep}subclasses${sep}`)),
};

function flat(dirName) {
  return listDir(join(DATA, dirName));
}

function listDir(dir) {
  return readdirSync(dir)
    .filter(n => n.endsWith('.json'))
    .map(n => join(dir, n));
}

function depthUnder(base, full) {
  const rel = full.slice(base.length).replace(/^[\\/]/, '');
  return rel.split(/[\\/]/).length;
}

mkdirSync(OUT, { recursive: true });

let totalFiles = 0;
const summary = [];

for (const [name, finder] of Object.entries(CATEGORIES)) {
  const files = finder();
  const items = [];
  for (const file of files) {
    try {
      const obj = JSON.parse(readFileSync(file, 'utf8'));
      // Для backgrounds/species ключ перевода = имя файла (см. i18n-extract.mjs),
      // а не obj.name: несколько записей делят одно name (предыстории Courtier из
      // SCAG и GHPG24; виды Dhampir/Dragonborn/Elf/… из XPHB и GrimHollowPG24).
      // Прокидываем стем файла, чтобы оверлей переводов сопоставлял каждый файл
      // с его собственным ключом, а не валил двойников в один перевод
      // (иначе переводы одного файла позиционно накладываются на тёзку: чужие
      // заголовки протекают, а несовпавшие позиции остаются на английском).
      if (name === 'backgrounds' || name === 'species') obj._i18nStem = parse(file).name;
      items.push(obj);
    } catch (e) {
      console.warn(`[bundle-data] не удалось разобрать ${file}: ${e.message}`);
    }
  }
  writeFileSync(join(OUT, `${name}.json`), JSON.stringify(items));
  totalFiles += files.length;
  summary.push(`${name}: ${items.length}`);
}

console.log(`[bundle-data] склеено ${totalFiles} файлов в ${Object.keys(CATEGORIES).length} бандлов`);
console.log('[bundle-data] ' + summary.join(', '));
