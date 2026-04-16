# План: кликабельный тег `@filter`

## Контекст

Сейчас `@filter` рендерится в [src/utils/entryRenderer.tsx:388-390](../src/utils/entryRenderer.tsx) как `<span class="tag-filter">{displayText}</span>` — без обработчика клика. У спана при этом link‑подобный стиль, что вводит пользователя в заблуждение.

Цель: при клике открывать соответствующую категорию глоссария с применённым префильтром.

## Формат тега

`{@filter Display text|category|param=value;value2|param2=value}`

- `parts[0]` — отображаемый текст (видимая часть, переводимая).
- `parts[1]` — категория 5etools (`feats`, `spells`, `items`, `bestiary`, …).
- `parts[2..]` — опциональные параметры фильтра в формате `key=value` (несколько значений через `;`).

Примеры из текущих данных:
- `{@filter Origin feat|feats|category=o}`
- `{@filter Spells of 3rd level or lower|spells|level=0;1;2;3}`

## Что уже есть

- Глоссарий ([src/components/Glossary.tsx](../src/components/Glossary.tsx)) принимает `activeCategory` через проп — переход к категории уже поддержан.
- Категории глоссария: `spells`, `feats`, `items`, `conditions`, `senses`, `skills`, `rules`, `optionalfeatures`, `species`, `backgrounds`, `classes`, `subclasses`, `charoptions`, `actions`.
- Каждая категория грузит данные через `categoryCache` и имеет `filteredItems` — поиск по тексту.
- Префильтра по полям (категория черты, уровень заклинания, источник) **нет** — только текстовый поиск.

## Архитектурные решения

### Маппинг 5etools → app категории

| 5etools | app | Поддержка params |
|---------|-----|------------------|
| `feats` | `feats` | `category` (Origin/General/Fighting/Epic Boon) |
| `spells` | `spells` | `level` (0–9), `school` (A/C/D/E/V/I/N/T), `class` |
| `items` | `items` | `type`, `rarity` |
| `bestiary` | — | нет такой категории в приложении (bestiary не реализован) |
| `races` | `species` | — |
| `backgrounds` | `backgrounds` | — |
| `optionalfeatures` | `optionalfeatures` | `featureType` |
| `conditionsdiseases` | `conditions` | — |
| `actions` | `actions` | — |
| `variantrules` | `rules` | — |

Если категория не поддерживается (`bestiary` и т.п.) — `@filter` должен вести себя как обычный текст (без клика), чтобы не было «битой» навигации.

### Параметры фильтра

Распарсить `key=value;value2` в `{ [key]: string[] }`. Передавать в Glossary как новый проп `prefilter?: { category, params }`. Glossary применяет на mount: если категория совпадает, дополнительно фильтрует `filteredItems` по `params`.

Реализовать предикаты по категориям в отдельном модуле `src/data/glossaryFilter.ts`:

```ts
const PREDICATES: Record<string, (item: any, params: Record<string, string[]>) => boolean> = {
  feats: (item, p) => !p.category || p.category.includes(item.category?.toLowerCase()),
  spells: (item, p) => (!p.level || p.level.includes(String(item.level)))
                     && (!p.school || p.school.includes(item.school)),
  items: (item, p) => (!p.rarity || p.rarity.includes(item.rarity?.toLowerCase()))
                    && (!p.type || p.type.includes(item.type)),
  // …
};
```

Неизвестные ключи параметров игнорируем (логируем `console.warn` в dev).

### Навигация

EntryRenderer вызывается из:
1. `Glossary.tsx` (рендер деталей записи).
2. `TagDetailModal` внутри самого `entryRenderer.tsx` (тултип/модалка по клику на ссылку).
3. Других местах (характеристики персонажа, заклинания и т.п.).

Нужен callback‑механизм, не привязанный к Glossary. Варианты:

- **Контекст** `FilterNavigationContext` (предпочтительно): провайдер на уровне `App.tsx` хранит обработчик. Glossary его подменяет, когда смонтирован; в остальных местах дефолт — открыть глоссарий через смену активного таба.
- Проп через `EntryRenderer` — повторяется в каждом call‑site, не подходит.

`onFilterClick({ category, params, displayText })` → провайдер решает как реагировать (открыть глоссарий, навигировать к категории, передать params).

### UI префильтра в Glossary

Чтобы пользователь видел «откуда я тут»:
- Над списком элементов показать chip‑и активных параметров: `Категория: Origin ✕`.
- Клик `✕` сбрасывает конкретный параметр.
- Кнопка «Сбросить все» — очищает префильтр и возвращает обычный режим.

## Шаги реализации (в порядке выполнения)

1. **Парсер** ([src/utils/filterTag.ts](../src/utils/filterTag.ts), новый файл)
   - `parseFilterTag(content: string): { displayText, category5etools, params }`.
   - `mapCategory(category5etools): AppCategory | null`.
   - Юнит‑тесты на типичные входы и edge cases (пустые params, `;`‑списки, неизвестные категории).

2. **Контекст навигации** ([src/components/FilterNavigationProvider.tsx](../src/components/FilterNavigationProvider.tsx))
   - Контекст с `onFilterClick` callback.
   - Провайдер в `App.tsx` с дефолтным обработчиком (переключение таба на глоссарий + установка прероплоф).

3. **Рендер `@filter`** ([src/utils/entryRenderer.tsx](../src/utils/entryRenderer.tsx))
   - Заменить `<span>` на `<button>` (для accessibility) с `onClick`, вызывающим контекстный `onFilterClick`.
   - Если `mapCategory` вернул `null` — рендерить просто `<span class="tag-filter-static">` без обработчика, не styled как ссылка.

4. **Префильтр в Glossary** ([src/components/Glossary.tsx](../src/components/Glossary.tsx))
   - Принять `prefilter?: { category, params }` (либо подписаться на тот же контекст).
   - Применить params к `filteredItems` через `PREDICATES`.
   - Chip‑и активных параметров над списком, кнопка сброса.

5. **Предикаты** ([src/data/glossaryFilter.ts](../src/data/glossaryFilter.ts), новый файл)
   - Реализовать предикаты для категорий из таблицы выше.
   - Покрыть юнит‑тестами для каждой категории.

6. **Стили**
   - `.tag-filter` — link‑подобный с курсором pointer и hover (как сейчас, но добавить focus‑state).
   - `.tag-filter-static` — обычный текст, без подсветки.

7. **Документация**
   - Обновить [docs/TRANSLATION_GUIDE.md](TRANSLATION_GUIDE.md): убрать пометку «не кликается», описать поведение и какие категории/параметры реально работают.

8. **Manual QA**
   - Кликнуть `@filter` на «Гибкий» (Human species) → должен открыть глоссарий черт с фильтром Origin.
   - Кликнуть `@filter` на заклинаниях с `level=0;1;2` → глоссарий заклинаний с фильтром по уровням.
   - Тег с неподдержанной категорией (если найдётся `bestiary`) → отрисовка без клика, нет ошибки в консоли.

## Открытые вопросы

- Нужно ли запоминать предыдущее место (breadcrumb «← вернуться к Human»), чтобы пользователь мог вернуться откуда пришёл? Возможно, стоит хранить стек переходов в контексте навигации.
- Как поведение должно отличаться при клике из тултипа `TagDetailModal` (там модалка перекрывает экран) — закрывать модалку и переходить, или открывать в новом окне?
- Стоит ли переименовать категорию `conditions` → `conditionsdiseases` для прямого совпадения с 5etools (или оставить маппинг)?

## Ссылки на код

- Парсер тегов: [src/utils/entryRenderer.tsx:46-82](../src/utils/entryRenderer.tsx)
- Текущий рендер `@filter`: [src/utils/entryRenderer.tsx:388-390](../src/utils/entryRenderer.tsx)
- Glossary categories: [src/components/Glossary.tsx](../src/components/Glossary.tsx)
- Текущая инструкция для переводчиков по `@filter`: [docs/TRANSLATION_GUIDE.md](TRANSLATION_GUIDE.md)
