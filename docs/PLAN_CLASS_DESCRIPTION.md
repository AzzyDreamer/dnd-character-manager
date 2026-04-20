# План: заменить short `description` класса на полноценный fluff

## Контекст

Сейчас в каждом source‑файле класса (`src/data/classes/*/[name].json`) есть корневое поле `description` — короткий русский summary («Маг, заключивший пакт с могущественной сущностью…»). Этот текст:

- Лежит в source как готовая русская строка, **обходя i18n**.
- Попадает в `src/i18n/gamedata/en/classes.json` через [scripts/i18n-extract.mjs:153](../scripts/i18n-extract.mjs) **как есть** — то есть в EN‑локали оказывается русский текст, и Crowdin предлагает его переводить (см. также [docs/PLAN_INVOCATION_TAG.md](PLAN_INVOCATION_TAG.md), мимо которого мы наткнулись на эту проблему).
- В UI используется **только в одном месте**: [Glossary.tsx:1188-1190](../src/components/Glossary.tsx) — нижняя секция в детальной панели класса.

Цель: убрать корневой short `description` совсем и заменить его на полноценный многоабзацный английский fluff из официальных данных 5etools (для всех 15 классов, включая хоумбрю `monster-hunter` и `gunslinger` — у них fluff тоже есть в исходных данных).

## Обоснование

- Полный fluff — это нормальный английский source, который Crowdin переведёт штатно (никаких русских строк в EN).
- Detail‑панель глоссария — единственное место использования; туда длинный текст вписывается без проблем (это уже секция, не карточка/превью).
- Round‑trip потерь нет: переводчик видит оригинальный английский лор, а не сжатую авторскую формулировку.
- Внутри fluff‑а живут теги `{@variantrule …}`, `{@spell …}` и т.п. — после рендера через `EntryRenderer` они станут кликабельными, в отличие от текущего plain‑text вывода.

## Архитектурные решения

### Имя поля и формат

5etools‑конвенция: класс имеет **отдельный fluff‑файл** `fluff-class-<name>.json` со структурой:
```json
{ "classFluff": [ { "name": "Wizard", "source": "XPHB", "entries": [ "<paragraph 1>", "<paragraph 2>", … ] } ] }
```
Для нашего проекта проще не выносить в отдельные файлы, а держать в том же JSON класса — добавляем поле `fluff: string[]` (массив абзацев). Если в будущем понадобится поддержать вложенные блоки (заголовки, списки) — расширим до `fluff: any[]` (как `entries` в class features), это обратно совместимо.

### Что делать со старыми ключами в Crowdin

Ключи `*.description` исчезают из `gamedata/en/classes.json` после регенерации экстракта. На стороне Crowdin это означает:
- Старые переводы попадут в "obsolete strings" и не будут предлагаться больше.
- Если хочется не терять уже сделанные русские переводы — можно перед удалением сохранить их как комментарий в `docs/` (вряд ли нужно: оригинал и так живёт в репо как старая версия `description`).

## Шаги реализации

1. **Подготовить fluff‑тексты** (15 классов)
   - Взять из 5etools (или того источника, откуда брали данные классов изначально).
   - Для `monster-hunter` и `gunslinger` — из их хоумбрю‑источника.
   - Сохранить как `fluff: ["абзац 1", "абзац 2", …]`.
   - Сохранить теги вида `{@variantrule chapter 7|XPHB}` как есть — они станут ссылками после рендера.

2. **Удалить корневой `description`** из всех 15 source‑файлов (`src/data/classes/*/[name].json`).
   *Только корневой! Внутри `classFeatures[*].description` — это другое поле, его не трогать.*

3. **Обновить [scripts/i18n-extract.mjs](../scripts/i18n-extract.mjs)** в функции `extractClassFile`:
   - Удалить строку:
     ```js
     if (typeof data.description === 'string') output[`${stem}.description`] = data.description;
     ```
   - Добавить экстракт fluff:
     ```js
     if (Array.isArray(data.fluff)) {
       for (let i = 0; i < data.fluff.length; i++) {
         if (typeof data.fluff[i] === 'string') {
           output[`${stem}.fluff.${i}`] = data.fluff[i];
         }
       }
     }
     ```
     (или переиспользовать `extractEntriesArray`/аналогичный walker, если он уже умеет в обычные строки и `entries`).

4. **Обновить [src/data/translationOverlay.ts](../src/data/translationOverlay.ts)** в `applyClassTranslations`:
   - Удалить:
     ```ts
     if (translations[`${stem}.description`] !== undefined) item.description = translations[`${stem}.description`];
     ```
   - Добавить применение перевода для `item.fluff[i]` по аналогии с `applyEntryTranslations` (она уже умеет в массив строк по индексу, можно передать `item.fluff`).

5. **Обновить тип `ClassJsonData`** в [src/data/classes/classJsonLoader.ts](../src/data/classes/classJsonLoader.ts):
   - Удалить `description?: string`.
   - Добавить `fluff?: string[]`.
   - Прогнать `npx tsc --noEmit`, поправить места, если где‑то TS ругнётся на отсутствие `description`.

6. **Обновить [src/components/Glossary.tsx:1188-1190](../src/components/Glossary.tsx)**:
   ```tsx
   {d.fluff?.length > 0 && (
     <div className="pt-2 border-t border-border-default text-text-primary">
       <EntryRenderer entries={d.fluff} context={d.name} />
     </div>
   )}
   ```
   (вместо текущего `<div>{d.description}</div>`).

7. **Регенерировать локали:**
   ```bash
   npm run i18n:extract
   ```
   После этого ключи `*.description` пропадут из `gamedata/en/classes.json` и `gamedata/ru/classes.json` (последнее — если экстрактор перезаписывает RU; иначе нужно вручную почистить осиротевшие ключи).

8. **Проверка:**
   - TypeScript: `npx tsc --noEmit`.
   - Запустить приложение, открыть глоссарий → классы → пройтись по всем 15: убедиться, что fluff отображается абзацами, теги кликабельны.
   - Переключить локаль на ru: убедиться, что после применения оверлея fluff остался отрисованным (даже если перевод ещё пуст — должен показываться английский).

9. **Документация и Crowdin:**
   - В [docs/CROWDIN_GUIDE.md](CROWDIN_GUIDE.md) — упомянуть, что `description` удалён, теперь переводится `fluff`.
   - На Crowdin старые ключи попадут в obsolete; русские переводы там можно скопировать, если будет нужно (вряд ли понадобится — мы заменяем на новый текст).

## Открытые вопросы

- **Нужен ли вообще короткий summary где‑либо ещё в будущем?** Например, в выпадающем списке выбора класса при создании персонажа сейчас показываются только имена. Если когда‑нибудь захочется тултип/подсказку, можно либо взять первую строку fluff‑а через `fluff[0]`, либо добавить отдельное поле `summary` (и тогда уже завести его сразу через i18n‑ключ, не как русскую строку в source).
- **Структура fluff внутри:** оставить плоский `string[]` или сразу позволить `any[]` (с заголовками/подсписками как в `entries`)? Рекомендация — начать с `string[]`, расширить при первой необходимости.
- **Версионирование fluff:** некоторые классы между PHB и XPHB имеют слегка разный fluff. Брать XPHB по умолчанию (он у нас источник для остальных полей).

## Ссылки на код

- Source‑файлы классов: `src/data/classes/*/[name].json` (15 штук)
- Extractor: [scripts/i18n-extract.mjs:147-206](../scripts/i18n-extract.mjs)
- Translation overlay: [src/data/translationOverlay.ts:128-187](../src/data/translationOverlay.ts)
- Тип данных класса: [src/data/classes/classJsonLoader.ts](../src/data/classes/classJsonLoader.ts)
- UI вывод: [src/components/Glossary.tsx:1188-1190](../src/components/Glossary.tsx)
- EN/RU локали: [src/i18n/gamedata/en/classes.json](../src/i18n/gamedata/en/classes.json), [src/i18n/gamedata/ru/classes.json](../src/i18n/gamedata/ru/classes.json)
