# План: поддержка тега `@invocation`

## Контекст

В данных встречается тег вида `{@invocation Pact of the Tome|XPHB}` (см. описание базового колдуна в [src/data/classes/warlock/warlock.json:61](../src/data/classes/warlock/warlock.json) и зеркало в [src/i18n/gamedata/en/classes.json:1092](../src/i18n/gamedata/en/classes.json)). Сейчас тег не работает:

- В `LINK_TAGS` ([src/utils/entryRenderer.tsx:29-34](../src/utils/entryRenderer.tsx)) `'invocation'` не указан.
- В `TEXT_TAGS`, `BOOK_TAGS` его тоже нет.
- Парсер выпадает в ветку «неизвестный тег» ([src/utils/entryRenderer.tsx:415-419](../src/utils/entryRenderer.tsx)) и рендерит просто `<span>{displayText}</span>` — без стиля ссылки, без тултипа, без клика.

В 5etools `@invocation` — это алиас для `@optfeature`, неявно отфильтрованный по `featureType=EI` (Eldritch Invocation). «Pact of the Tome» в наших данных лежит как optional feature: [src/data/optionalfeatures/Pact of the Tome.json](../src/data/optionalfeatures/Pact of the Tome.json) с `featureType: ["EI"]`.

Цель: сделать `@invocation` кликабельным, как `@optfeature`/`@spell` — с тултипом и переходом к деталям. С учётом того, что данные уже есть в `optionalfeatures`, ничего нового грузить не надо — нужен только маппинг тега в lookup.

## Формат тега

```
{@invocation Pact of the Tome|XPHB}
{@invocation Agonizing Blast|XPHB|Болезненный взрыв}     # с display-name (склонение)
```

Сегменты:
1. Имя инвокейшена (англ.)
2. Источник (опц., обычно XPHB)
3. Display text (опц., для русского склонения)

## Архитектурные решения

### Минимальный фикс (рекомендуемый)

Считать `@invocation` синонимом `@optfeature` с подстраховкой: по возможности проверять, что найденный optional feature действительно имеет `featureType.includes('EI')`. Если такой проверки строго придерживаться, нерелевантные `@invocation Foo` (где Foo — не EI) останутся не‑кликабельными — это ОК, такие случаи аномальны.

Шаги:

1. **LINK_TAGS** ([src/utils/entryRenderer.tsx:29-34](../src/utils/entryRenderer.tsx))
   Добавить `'invocation'` в Set.

2. **lookupByTag** ([src/data/registry.ts:142-253](../src/data/registry.ts))
   Добавить кейс перед `default`:
   ```ts
   case 'invocation': {
     if (!_optfeatures) break;
     const opt = _optfeatures.getOptionalFeatureByName(entityName);
     // Опциональная строгая проверка типа:
     // if (opt && !opt.featureType?.includes('EI')) break;
     if (opt) {
       return {
         type: 'optfeature',  // используем общий тип, чтобы модалка/тултип знали как рендерить
         name: opt.name,
         source: opt.source,
         entries: opt.entries,
         data: opt,
       };
     }
     break;
   }
   ```

3. **typeLabels в TagDetailModal** ([src/utils/entryRenderer.tsx:243-248](../src/utils/entryRenderer.tsx))
   Возвращать `type: 'optfeature'` (как уже есть) — отдельный лейбл «Воззвание» не нужен, у нас уже есть `optfeature: 'Способность'`. Если хочется именно «Воззвание» (которое FEATURE_TYPE_NAMES.EI), можно вернуть `type: 'invocation'` и добавить `invocation: 'Воззвание'` в typeLabels — но это потянет ещё пару мест, см. ниже.

4. **Документация** ([docs/TRANSLATION_GUIDE.md](TRANSLATION_GUIDE.md))
   Добавить `@invocation` в таблицу «Теги‑ссылки», с примером и пояснением, что переводится только display‑text (3‑й параметр), как у остальных ссылок.

### Альтернатива: отдельный type='invocation'

Если хочется, чтобы в тултипе/модалке писалось «Воззвание» вместо «Способность»:

- Вернуть `type: 'invocation'` в lookupByTag.
- Добавить `invocation: 'Воззвание'` в typeLabels.
- Проверить, не валится ли где‑то `entry.type === 'optfeature'`‑switch (в Glossary деталей, навигации).

Минусы: больше точек изменения, выше риск пропустить место. Плюс минимальный — заголовок в тултипе.

**Рекомендация:** делать вариант 1 (минимальный) — он покрывает основную ценность (кликабельность + тултип) с минимальным риском.

## Шаги реализации (в порядке выполнения)

1. Добавить `'invocation'` в `LINK_TAGS`.
2. Добавить `case 'invocation'` в `lookupByTag` (без строгой проверки EI или со строгой — на усмотрение).
3. Прогнать `npx tsc --noEmit`.
4. Запустить приложение, открыть глоссарий → классы → колдун → проверить, что `Pact of the Tome` в описании Eldritch Invocations теперь подсвечен как ссылка, открывает тултип/модалку с описанием.
5. Обновить [docs/TRANSLATION_GUIDE.md](TRANSLATION_GUIDE.md): строка таблицы:
   ```
   | `@invocation` | `{@invocation Pact of the Tome\|XPHB}` | Ссылка на воззвание (Eldritch Invocation) |
   ```
6. Закоммитить с понятным сообщением (`feat(tags): support @invocation as alias for optfeature(EI)`).

## Открытые вопросы

- Стоит ли строго требовать `featureType.includes('EI')` при матче? Pro: ловит data‑ошибки, когда `@invocation` указывает на не‑EI. Contra: если в будущем 5etools добавит `featureType=AI` (Artificer Infusion) и переиспользует `@invocation` как‑то иначе, мы будем терять матчи. Сейчас безопасно — оставить без строгой проверки, в реальных данных конфликтов нет.
- В русском глоссарии есть `FEATURE_TYPE_NAMES.EI = 'Воззвание'` — может стоит при отрисовке тултипа `optfeature` подписывать `Воззвание` вместо `Способность`, если у данного opt есть `featureType=EI`? Это улучшение UX, но к самой починке `@invocation` не относится.
- Аналогичных «алиасов» 5etools может быть больше: `@maneuver`, `@boon`, `@metamagic` и т.п. — все мапятся в `optfeature` с разным `featureType`. Имеет смысл сделать общий механизм через таблицу `TAG_TO_OPTFEATURE_TYPE`. Если решим — выносим в отдельную задачу.

## Ссылки на код

- LINK_TAGS: [src/utils/entryRenderer.tsx:29-34](../src/utils/entryRenderer.tsx)
- Парсер тегов и неизвестная ветка: [src/utils/entryRenderer.tsx:415-419](../src/utils/entryRenderer.tsx)
- Lookup: [src/data/registry.ts:142-253](../src/data/registry.ts)
- Loader optionalfeatures: [src/data/optionalfeatures/index.ts](../src/data/optionalfeatures/index.ts)
- Карта типов: `FEATURE_TYPE_NAMES` в [src/data/optionalfeatures/index.ts](../src/data/optionalfeatures/index.ts) (`EI = 'Воззвание'`)
- Пример вхождения: [src/data/classes/warlock/warlock.json:61](../src/data/classes/warlock/warlock.json)
