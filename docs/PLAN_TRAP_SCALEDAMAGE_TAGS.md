# План: теги `@trap` и `@scaledamage`

Две слабо связанные задачи, объединённые в один план: оба тега касаются рендеринга в `entryRenderer.tsx` и встречаются в данных, но ведут себя неполноценно.

---

## Часть 1. `@trap`

### Контекст

Тег встречается в данных вариантных правил, например [src/data/variantrule/Haunted Traps.json:34-37](../src/data/variantrule/Haunted Traps.json):

```json
"{@trap Danse Macabre|VRGR}",
"{@trap Faceless Malice|VRGR}",
"{@trap Icon of the Lower Aerial Kingdoms|VRGR}",
"{@trap Morbid Memory|VRGR}"
```

Перевод в [src/i18n/gamedata/ru/variantrule.json:549-552](../src/i18n/gamedata/ru/variantrule.json) даёт display‑text: `{@trap Danse Macabre|VRGR|Пляска смерти}`.

Сейчас `@trap`:
- Не входит ни в `LINK_TAGS`, ни в `TEXT_TAGS`, ни в `BOOK_TAGS` ([src/utils/entryRenderer.tsx:29-43](../src/utils/entryRenderer.tsx)).
- Парсер выпадает в ветку «неизвестный тег» ([src/utils/entryRenderer.tsx:415-419](../src/utils/entryRenderer.tsx)) → рендерится как `<span>{displayText}</span>` — без стиля ссылки, без тултипа, без клика.
- Данных самих ловушек (`trap.json`) в репозитории нет — только отсылки на них из вариантных правил.

### Формат тега

```
{@trap Danse Macabre|VRGR}
{@trap Danse Macabre|VRGR|Пляска смерти}   # с display-name (3-й сегмент)
```

Сегменты:
1. Имя ловушки (англ.).
2. Источник (опц., обычно `VRGR`, `XGE` и т.п.).
3. Display text (опц., для русского склонения).

### Что уже есть

- В 5etools данные ловушек живут в `data/trapshazards/trapshazards-*.json`. У нас этих файлов нет — только в кросс‑ссылках.
- Псевдо‑тег `hazard` уже частично обрабатывается через фоллбэк на `_variantrule.getVariantRuleByName` ([src/data/registry.ts:239-247](../src/data/registry.ts)) — но `trap` туда не добавлен.

### Варианты реализации

#### Вариант A (минимальный, рекомендуемый): graceful render без клика

Не загружать данные ловушек, но прекратить рендерить тег как «битый» текст. Сделать его визуально похожим на статический тег (по аналогии с `tag-text-only`/`tag-filter-static` из [PLAN_FILTER_TAG.md](PLAN_FILTER_TAG.md)).

Шаги:

1. **`parseTagContent`** ([src/utils/entryRenderer.tsx:48-82](../src/utils/entryRenderer.tsx))
   Добавить специальный кейс для `trap`, чтобы корректно вернуть display‑text (берётся из `parts[2]` если есть, иначе `parts[0]`):
   ```ts
   if (tagType === 'trap' || tagType === 'hazard') {
     return getTagDisplayName(tagType, content);
   }
   ```
   На самом деле `getTagDisplayName` уже это делает — поэтому достаточно убедиться, что fallthrough в `default` ([:81](../src/utils/entryRenderer.tsx)) работает.

2. **`renderTaggedString`** ([src/utils/entryRenderer.tsx:415-419](../src/utils/entryRenderer.tsx))
   Заменить ветку «неизвестный тег» на проверку whitelist «known but unsupported» тегов: `trap` (и можно сразу добавить `creature` если данных нет, итд) → рендерить с CSS‑классом `tag-static-name` (текст с лёгким акцентом — курсив или приглушённый цвет, без cursor:pointer).

3. **CSS** — добавить класс `tag-static-name` (приглушённый, без подчёркивания, без hover‑состояния), чтобы пользователь видел, что это «имя сущности» а не обычный текст.

4. **TRANSLATION_GUIDE.md** — добавить строку в таблицу тегов: `@trap` — переводится только display‑text, ссылка не работает (нет данных).

#### Вариант B (полный): загрузить данные ловушек

Скачать `trapshazards.json` из 5etools, добавить:

1. Новую категорию данных `src/data/trapshazards/` с loader (по аналогии с `src/data/optionalfeatures/`).
2. Регистрацию в `registry.ts` (новый кейс `case 'trap'` в `lookupByTag`).
3. Добавить `'trap'` в `LINK_TAGS`.
4. Новую вкладку в Glossary (`traps`) — придётся править `GLOSSARY_SUB_TAB_KEYS` в [src/App.tsx:55-59](../src/App.tsx) и сам [Glossary.tsx](../src/components/Glossary.tsx).
5. Добавить переводы названий и описаний в `src/i18n/gamedata/ru/trapshazards.json`.

**Минусы:** большая поверхность изменений. Ловушки — это контент DM‑side, для player‑facing «D&D Character Manager» имеет низкую ценность.

**Рекомендация:** делать **Вариант A**. Если в будущем появится потребность в полноценной поддержке ловушек (например, добавится «бестиарий»), тогда переходить на Вариант B.

### Шаги реализации (Вариант A)

1. Добавить рендер `tag-static-name` в `renderTaggedString` для тегов из набора `STATIC_NAME_TAGS = new Set(['trap'])` (легко расширяемый).
2. Стиль `.tag-static-name` в общих стилях (приглушённый цвет, без курсора).
3. Прогнать `npx tsc --noEmit`.
4. Открыть глоссарий → правила → «Haunted Traps» → убедиться, что 4 имени ловушек больше не выглядят как обычный текст.
5. Обновить `docs/TRANSLATION_GUIDE.md`.
6. Коммит: `feat(tags): graceful render for @trap (no clickable data)`.

---

## Часть 2. `@scaledamage`

### Контекст

`@scaledamage` массово используется в `entriesHigherLevel` заклинаний — описывает, как растёт урон при использовании ячейки выше базовой. Примеры из [src/i18n/gamedata/ru/spells.json](../src/i18n/gamedata/ru/spells.json):

- `Burning Hands`: «Урон увеличивается на `{@scaledamage 3d6|1-9|1d6}` за каждый уровень ячейки выше 1‑го.»
- `Bigby's Hand`: «`{@scaledamage 5d8|5-9|2d8}` … `{@scaledamage 4d6|5-9|2d6}` …»
- `Chaos Bolt`: «`{@scaledamage 2d8 + 1d6|1-9|1d6}` …»

Сейчас `@scaledamage`:
- Входит в `TEXT_TAGS` ([entryRenderer.tsx:38-40](../src/utils/entryRenderer.tsx)) и `ROLLABLE_TAGS` ([entryRenderer.tsx:318](../src/utils/entryRenderer.tsx)).
- `parseTagContent` возвращает `parts[0]` — например, `"3d6"` ([entryRenderer.tsx:77-79](../src/utils/entryRenderer.tsx)).
- Если `\d+d\d+` совпадает — рендерится как `<DiceTag>`, бросает ровно `parts[0]`.
- **Контекста уровня каста нет**: при просмотре заклинания на листе персонажа (где известно, на каком уровне ячейки игрок собирается кастовать) — бросается базовое значение, не пересчитанное.

### Формат тега

```
{@scaledamage BASE|RANGE|PER_LEVEL}
```

Сегменты:
1. `BASE` — выражение, которое автор приготовил для отображения (обычно базовый урон, например `3d6`).
2. `RANGE` — диапазон уровней, на которых работает upcast, например `1-9`, `3-9`.
3. `PER_LEVEL` — прирост за каждый уровень выше базового, например `1d6`, `2d8`.

Пример: `{@scaledamage 3d6|1-9|1d6}` — заклинание базово наносит `3d6`, при касте на уровень N >= 1 добавляется `(N-baseLevel)*1d6`.

### Что уже есть

- Парсер upcast‑бонуса: `getUpcastBonusDice` в [src/utils/spellCasting.ts:75-102](../src/utils/spellCasting.ts) — принимает `entriesHigherLevel`, базовый и текущий уровень слота, возвращает строку вида `"6d6"` (готовый бросок). Логику суммирования пересчёта в `XdY` уже знает.
- DiceTag (генерик кликабельный) — [entryRenderer.tsx:320-348](../src/utils/entryRenderer.tsx).
- Контекст текущего уровня каста при просмотре заклинания: **этого пока нет** в `EntryRenderer`. Нужен механизм передачи.

### Цели

1. **Текстовый рендер `@scaledamage` сам по себе остаётся понятным**: в общем (не‑spell) контексте показывать всё ту же `parts[0]` строку (что и сейчас).
2. **В контексте спелла на character sheet** (где известны `baseLevel` и `castLevel`):
   - Показывать пересчитанную дайс‑строку: `BASE + (castLevel - baseLevel) * PER_LEVEL`, например для `Burning Hands` на 3 уровне: `5d6` вместо `3d6`.
   - При клике бросать пересчитанное значение.
   - Тултип/title — показывать формулу (`base 3d6 + 1d6 per slot level above 1st = 5d6 at slot 3`).

### Архитектурные решения

#### Контекст уровня каста

Добавить новый необязательный пропс `EntryRenderer`:

```ts
interface EntryRendererProps {
  entries: any[];
  context?: string;
  onNavigate?: (entry: RegistryEntry) => void;
  className?: string;
  spellContext?: { baseLevel: number; castLevel: number };  // NEW
}
```

Проброс через `EntryNode` → `renderTaggedString(text, context, onNavigate, spellContext)`. Это меняет сигнатуру `renderTaggedString` — но т.к. она экспортируется и используется в нескольких местах ([Grep по `renderTaggedString`]), сделать `spellContext` последним необязательным параметром, чтобы не сломать другие call‑sites.

Альтернатива — Context API (`SpellCastContext`). Плюс: меньше пропс‑drilling. Минус: ещё один контекст. Для одного‑двух мест использования проще пропс.

#### Парсер `@scaledamage`

Извлечь логику пересчёта в утилиту, чтобы переиспользовать с `getUpcastBonusDice`:

```ts
// src/utils/scaleDamage.ts (новый файл)
export interface ScaledDamageParts {
  base: string;        // "3d6" or "2d8 + 1d6"
  range: [number, number];  // [1, 9]
  perLevel: string;    // "1d6"
}

export function parseScaledDamage(content: string): ScaledDamageParts | null {
  // Split by '|', extract base, range, per-level
  // Return null if format invalid
}

export function computeScaledDice(
  parts: ScaledDamageParts,
  baseLevel: number,
  castLevel: number,
): string {
  // baseLevel <= castLevel: combine base + extra (castLevel - baseLevel) * perLevel
  // Suм dice of same kind: "3d6" + 2*"1d6" = "5d6"
  // Если base = "2d8 + 1d6" и perLevel = "1d6" — корректно слить с 1d6 частью
  // Если base = "3d6" и perLevel = "1d8" — оставить как сложение "3d6 + 2d8"
}
```

Юнит‑тесты:
- `parseScaledDamage("3d6|1-9|1d6")` → `{base:"3d6", range:[1,9], perLevel:"1d6"}`
- `computeScaledDice({base:"3d6", perLevel:"1d6", ...}, 1, 3)` → `"5d6"`
- `computeScaledDice({base:"2d8 + 1d6", perLevel:"1d6", ...}, 4, 6)` → `"2d8 + 3d6"`
- mismatched dice: `computeScaledDice({base:"3d6", perLevel:"1d8", ...}, 1, 3)` → `"3d6 + 2d8"`

Существующий `getUpcastBonusDice` в [spellCasting.ts:75](../src/utils/spellCasting.ts) после рефактора должен использовать те же утилиты — иначе будет два разных парсера на одни и те же данные.

#### Рендер

В `renderTaggedString` для `tagType === 'scaledamage'`:

```ts
if (tagType === 'scaledamage') {
  const parts = parseScaledDamage(tagContent);
  if (parts && spellContext) {
    const scaled = computeScaledDice(parts, spellContext.baseLevel, spellContext.castLevel);
    result.push(<DiceTag key={key} expression={scaled} tagType="scaledamage" title={`base ${parts.base}, +${parts.perLevel} per slot above ${spellContext.baseLevel}`} />);
  } else {
    // Fallback: текущее поведение (parts[0] как dice)
    const displayText = parts?.base || tagContent.split('|')[0].trim();
    if (/\d+d\d+/.test(displayText)) {
      result.push(<DiceTag key={key} expression={displayText} tagType="scaledamage" />);
    } else {
      result.push(<span key={key} className="tag-scaledamage">{displayText}</span>);
    }
  }
}
```

Обновить `DiceTag`:
- Добавить опциональный `title?: string` — прокинуть в HTML `title=` атрибут (нативный тултип браузера).
- Возможно, в будущем заменить на `SpellTooltip`‑подобный компонент с богатым тултипом.

#### Где передавать `spellContext`

Места, где `EntryRenderer` рендерит описание заклинания и где известен уровень каста:

- **CharacterSheet** → spell list / spell detail модалка / quick‑cast UI. Найти где рендерится `entries` спелла и в каких компонентах есть state выбранного слота.
- **SpellTooltip** ([src/components/ui](../src/components/ui)) — при показе тултипа спелла на карте действий.

Не передавать `spellContext` в:
- Glossary (там нет «уровня каста», есть только базовое описание заклинания).
- TagDetailModal (тултип через `@spell` ссылку — без контекста персонажа).

В этих местах сохраняется текущее поведение (показ `parts[0]`).

### Шаги реализации

1. **Утилита** ([src/utils/scaleDamage.ts](../src/utils/scaleDamage.ts), новый файл)
   - `parseScaledDamage`, `computeScaledDice`.
   - Юнит‑тесты на edge cases (см. выше).

2. **Рефактор `getUpcastBonusDice`** ([src/utils/spellCasting.ts:75-102](../src/utils/spellCasting.ts))
   - Переключить на `parseScaledDamage` + `computeScaledDice` (только prefer‑bonus вариант — без базы).
   - Прогнать существующие тесты, если есть; иначе вручную проверить пересчёт.

3. **Расширить `EntryRenderer`** ([src/utils/entryRenderer.tsx:432-453](../src/utils/entryRenderer.tsx))
   - Добавить пропс `spellContext`.
   - Прокинуть через `EntryNode` → `renderTaggedString`.
   - В `renderTaggedString` (5‑й параметр) — пересчёт для `scaledamage`.

4. **Обновить `DiceTag`** ([src/utils/entryRenderer.tsx:320-348](../src/utils/entryRenderer.tsx))
   - Принять `title?: string`, прокинуть в `title` атрибут JSX‑элемента.

5. **Подключить контекст в spell render** (CharacterSheet и/или SpellTooltip)
   - Найти все вызовы `<EntryRenderer entries={spell.entriesHigherLevel}` или `entries={spell.entries}` в spell‑related компонентах.
   - Передать `spellContext={{ baseLevel: spell.level, castLevel: selectedSlotLevel }}`.

6. **Manual QA**
   - Открыть `Burning Hands` (base 3d6, +1d6 per upcast) на лист персонажа, выбрать слот 3 → отображается `5d6`, клик бросает 5d6.
   - В глоссарии тот же спелл: отображается `3d6` (без spellContext) — клик бросает 3d6.
   - `Chaos Bolt` (`{@scaledamage 2d8 + 1d6|1-9|1d6}`) на слоте 4 → `2d8 + 4d6`.

7. **TypeScript**: `npx tsc --noEmit`.

### Открытые вопросы

- **Слот выбирается динамически или фиксирован?** Если у character sheet есть свитчер «Cast at level X», то при изменении слота описание заклинания должно перерендериться. Это влияет на то, где хранится `castLevel` (component state vs. хук). Посмотреть существующий UI каста.
- **Что показывать, если `castLevel < baseLevel`?** (Слот ниже базового — невозможно касовать). Вероятно, использовать `castLevel = baseLevel` и показывать как обычно.
- **Как быть с `{@scaledice}`?** Это сестринский тег — та же логика, но не damage (например, `{@scaledice 1d4|1-9|1d4}` для лечения). Имеет смысл сразу обработать оба тега одной утилитой.
- **Тултип vs HTML‑title.** HTML `title` срабатывает с задержкой и не стилизуется. Если хочется красиво — использовать тот же механизм, что у `SpellTooltip`. Это отдельная задача, не блокер.
- **Локализация прироста.** Текст в JSON «увеличивается на» — статический. После пересчёта мы показываем уже посчитанное число, что меняет смысл фразы. Возможно, стоит **не** пересчитывать в текстовом контексте (то есть видимая `3d6` остаётся как есть), но при клике бросать пересчитанное. Альтернатива — показывать оба: `3d6 → 5d6 на 3 уровне`. Решить до реализации шага 5.

---

## Ссылки на код

### `@trap`
- Парсер LINK_TAGS / TEXT_TAGS / BOOK_TAGS: [src/utils/entryRenderer.tsx:29-43](../src/utils/entryRenderer.tsx)
- Ветка «неизвестный тег»: [src/utils/entryRenderer.tsx:415-419](../src/utils/entryRenderer.tsx)
- Использование в данных: [src/data/variantrule/Haunted Traps.json:34-37](../src/data/variantrule/Haunted Traps.json)
- Похожий шаблон обработки (для `hazard`/`creature`): [src/data/registry.ts:239-247](../src/data/registry.ts)

### `@scaledamage`
- Текущий рендер: [src/utils/entryRenderer.tsx:394-400](../src/utils/entryRenderer.tsx)
- ROLLABLE_TAGS: [src/utils/entryRenderer.tsx:318](../src/utils/entryRenderer.tsx)
- `DiceTag`: [src/utils/entryRenderer.tsx:320-348](../src/utils/entryRenderer.tsx)
- Существующий парсер upcast: [src/utils/spellCasting.ts:75-102](../src/utils/spellCasting.ts)
- Использование в данных: массово в [src/i18n/gamedata/ru/spells.json](../src/i18n/gamedata/ru/spells.json) (поиск `@scaledamage`)
