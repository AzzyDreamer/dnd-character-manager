# План: поддержка тегов `@class` и `@subclass`

## Контекст

Теги `class` и `subclass` числятся в `LINK_TAGS` ([src/utils/entryRenderer.tsx:29-34](../src/utils/entryRenderer.tsx)), значит парсер пытается отрисовать их как ссылку с тултипом. Но в `lookupByTag` ([src/data/registry.ts:142-250](../src/data/registry.ts)) для них нет `case`, поэтому они всегда возвращают `undefined` и падают в фолбэк `<span class="tag-text-only">` — выглядят как обычный текст, без интерактивности.

Цель: сделать `@class Wizard|XPHB` и `@subclass Bladesinger|Wizard|TCE` кликабельными — открывать модалку или переходить в соответствующий раздел глоссария.

## Формат тегов в данных 5etools

### `@class`
```
{@class Wizard|XPHB}                                    # базовый
{@class Wizard|XPHB|wizard text}                        # с display-name
{@class Wizard|XPHB|gish||Bladesinger|TCE}              # с подклассом
```
Сегменты:
1. Имя класса (англ.)
2. Источник (опц.)
3. Display text (опц., для склонения)
4. Hash slug (опц., для якоря на 5etools — нам не нужен)
5. Имя подкласса (опц.)
6. Источник подкласса (опц.)

### `@subclass`
```
{@subclass Bladesinger|Wizard|TCE}                # имя|класс|источник
{@subclass Bladesinger|Wizard|TCE|Bladesong}      # + display text
```
Сегменты:
1. Имя подкласса
2. Имя родительского класса
3. Источник подкласса (опц.)
4. Display text (опц.)

## Что уже есть

- `getClassDataByName(name)` ([src/data/classes/classJsonLoader.ts:77](../src/data/classes/classJsonLoader.ts)) — после fix‑а ищет и по `_origName`.
- `ALL_SUBCLASS_DATA`, `getSubclassById(classId, subclassId)`, `getSubclassesByClass(classId)` ([src/data/classes/subclassJsonLoader.ts](../src/data/classes/subclassJsonLoader.ts)).
- В `Glossary` уже отдельные категории `classes` и `subclasses`, есть детальный рендер класса (со списком подклассов, фичами по уровням).
- Применение оверлея для классов/подклассов: `applyClassTranslations` / `applySubclassTranslations` ([src/data/translationOverlay.ts:128-221](../src/data/translationOverlay.ts)) — после fix‑а сохраняют `_origName`.

Чего не хватает:
- В `subclassJsonLoader` нет функции `getSubclassByName(className, subclassName)` — есть только по `id`.
- В `registry.ts` импортируются `_variantrule`, `_spells`, … но **нет** `_classes` и `_subclasses`.
- Тултип `TagTooltip` ожидает `RegistryEntry` с массивом `entries`. У класса/подкласса есть `description` + структурированные поля, единого `entries` нет.

## Архитектурные решения

### Реестр

Завести в `registry.ts`:
```ts
let _classes: any = null;
let _subclasses: any = null;
```
Подгружать в `init()` рядом с остальными:
```ts
_classes = await import('./classes/classJsonLoader');
await _classes.init();
_subclasses = await import('./classes/subclassJsonLoader');
await _subclasses.init();
```

### Lookup для подкласса

Добавить в `subclassJsonLoader.ts`:
```ts
export function getSubclassByName(className: string, subclassName: string): SubclassJsonData | undefined {
  const lcSub = subclassName.toLowerCase();
  const lcCls = className.toLowerCase();
  return ALL_SUBCLASS_DATA.find(s =>
    (s.name.toLowerCase() === lcSub || (s as any)._origName?.toLowerCase() === lcSub) &&
    // У подкласса есть classId либо className — уточнить по реальной структуре
    (s.className?.toLowerCase() === lcCls || (s as any)._origClassName?.toLowerCase() === lcCls)
  );
}
```
*Замечание:* нужно проверить, есть ли в данных подкласса поле, по которому однозначно ищется родительский класс (`classId`/`className`/`class.name`). Если оверлей переписывает это поле тоже — добавить сохранение `_origClassName` аналогично `_origName`.

### Кейсы в `lookupByTag`

```ts
case 'class': {
  if (!_classes) break;
  const parts = name.split('|');
  const className = parts[0].trim();
  // Игнорируем источник (parts[1]) при поиске — у нас один источник на класс
  const cls = _classes.getClassDataByName(className);
  if (cls) {
    // Собираем псевдо-entries для тултипа
    const entries: any[] = [];
    if (cls.description) entries.push(cls.description);
    return { type: 'class', name: cls.name, source: cls.source, entries, data: cls };
  }
  break;
}

case 'subclass': {
  if (!_subclasses) break;
  const parts = name.split('|');
  const subclassName = parts[0].trim();
  const className = parts[1]?.trim();
  if (!className) break; // без класса не разрулить
  const sub = _subclasses.getSubclassByName(className, subclassName);
  if (sub) {
    const entries: any[] = [];
    if (sub.shortDescription) entries.push(sub.shortDescription);
    else if (sub.description) entries.push(sub.description);
    return { type: 'subclass', name: sub.name, source: sub.source, entries, data: sub };
  }
  break;
}
```

### Что показывать в тултипе и модалке

Сейчас `TagTooltip` показывает первые несколько строк entries (см. `getTooltipContent` в `entryRenderer.tsx`), а `TagDetailModal` — полный рендер через `EntryRenderer`. Для класса/подкласса:

- **Тултип**: имя + 1–2 строки описания. Достаточно положить `description`/`shortDescription` в `entries`.
- **Модалка**: дать ссылку «Открыть в глоссарии» вместо попытки впихнуть полный класс в маленькое окно. Альтернатива — отрендерить description + базовую таблицу фич, но это много работы и дублирует Glossary.

Рекомендация: модалка для классов/подклассов сразу делегирует через `onNavigate?.({ type: 'class', data: cls })` в режим «открой глоссарий → классы → cls» (или `subclasses → sub`).

### Навигация

Если параллельно делается `PLAN_FILTER_TAG.md` (контекст `FilterNavigationContext`), переиспользовать тот же механизм: `onTagNavigate({ category: 'classes', itemId: cls.id })`. Это устранит дублирование между тегами `@class`/`@subclass`/`@filter`.

## Шаги реализации

1. **Реестр** ([src/data/registry.ts](../src/data/registry.ts))
   - Объявить `_classes`, `_subclasses`.
   - Импортировать в `init()`.
   - Положить в карту `// сводка для совместимости с Glossary` (последние строки registry).

2. **Lookup подкласса** ([src/data/classes/subclassJsonLoader.ts](../src/data/classes/subclassJsonLoader.ts))
   - Проверить структуру `SubclassJsonData` (есть ли `className`/`classId`).
   - При необходимости — расширить `applySubclassTranslations` для сохранения `_origClassName`.
   - Добавить `getSubclassByName(className, subclassName)`.

3. **Кейсы в lookupByTag** ([src/data/registry.ts](../src/data/registry.ts))
   - Добавить `case 'class'` и `case 'subclass'` (см. snippets выше).
   - Аккуратно с typeLabels в `TagDetailModal`: добавить `class: 'Класс'`, `subclass: 'Подкласс'`.

4. **EntryRenderer / Tooltip**
   - Убедиться, что когда `entries` маленькие (или пустые), тултип не ломается. Если description‑only, показывать только заголовок.
   - В `TagDetailModal` для type=class/subclass — показать кнопку «Открыть в глоссарии» (вместо/перед полным рендером).

5. **Навигация в глоссарий**
   - Если на момент реализации уже есть `FilterNavigationContext` из `PLAN_FILTER_TAG`, использовать его.
   - Иначе временно использовать `onNavigate` callback, передавая `{ category: 'classes' | 'subclasses', itemId }`.

6. **Документация**
   - Обновить [docs/TRANSLATION_GUIDE.md](TRANSLATION_GUIDE.md): для `@class` и `@subclass` уточнить формат с несколькими сегментами (склонение через 3‑й/4‑й параметр, см. ниже).

7. **Manual QA**
   - `{@class Wizard|XPHB}` в тексте → клик показывает тултип с описанием класса, по клику открывается модалка/глоссарий.
   - `{@class Wizard|XPHB|волшебника}` (если переводчики начнут использовать) → отображается «волшебника», клик работает.
   - `{@subclass Bladesinger|Wizard|TCE}` → клик ведёт на подкласс.
   - Несуществующий класс/подкласс → fallback в `tag-text-only`, без ошибок в консоли.

## Открытые вопросы

- В данных 5etools у класса бывает `source` отличный от XPHB (например `TCE`). Сейчас в репо хранится один `cls.source` на класс — нужно ли матчить по source при множественных вариантах? Скорее всего нет, у нас single‑source.
- Стоит ли при `@class Wizard|XPHB|gish||Bladesinger|TCE` (класс + подкласс одной ссылкой) считать целевой запись подкласса, а не класса? 5etools так и делает.
- Какой третий/четвёртый параметр считать display‑text’ом? У `@class` это сегмент 3, у `@subclass` — сегмент 4. `getTagDisplayName` сейчас слепо берёт `parts[2]` — нужно проверить, не ломается ли это для `@subclass`.

## Связь с другими планами

Эта задача делит инфраструктуру навигации с [docs/PLAN_FILTER_TAG.md](PLAN_FILTER_TAG.md). Имеет смысл реализовать оба тега одной серией изменений: сначала контекст навигации (из FILTER‑плана), затем поверх — кейсы для `class`/`subclass`/`filter`.

## Ссылки на код

- Парсер тегов: [src/utils/entryRenderer.tsx:46-82](../src/utils/entryRenderer.tsx)
- LINK_TAGS: [src/utils/entryRenderer.tsx:29-34](../src/utils/entryRenderer.tsx)
- Lookup: [src/data/registry.ts:142-253](../src/data/registry.ts)
- Класс‑лоадер: [src/data/classes/classJsonLoader.ts](../src/data/classes/classJsonLoader.ts)
- Подкласс‑лоадер: [src/data/classes/subclassJsonLoader.ts](../src/data/classes/subclassJsonLoader.ts)
- Оверлей переводов: [src/data/translationOverlay.ts:128-221](../src/data/translationOverlay.ts)
