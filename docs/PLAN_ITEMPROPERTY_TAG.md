# Тег `@itemProperty` — статус

## Сделано

Полная реализация Variant B завершена. Тег `{@itemProperty CODE|SOURCE|DisplayName}` теперь рендерится как полноценная кликабельная ссылка с тултипом и модалкой описания свойства.

**Что было:**
`lookupByTag('itemProperty', 'L|XPHB|Light')` шёл фоллбэком на `_variantrule.getVariantRuleByName('L')` → `undefined` → `<span class="tag-text-only">` без тултипа.

**Что появилось:**
- `src/data/itemproperties/` — новая категория данных, 14 файлов свойств (Light/Heavy/Finesse/Thrown/Versatile/Two-Handed/Loading/Ammunition/Reach/Special/Range + XDMG: Ammunition (Firearm)/Burst Fire/Reload).
- `src/data/itemproperties/index.ts` — loader с `getItemPropertyByCode(code, source?)`. Case-insensitive по коду, предпочтение источника `XPHB > XDMG > PHB`. Корректно обрабатывает edge-кейсы из реальных данных:
  - `{@itemProperty L||light}` (пустой источник, Thri-kreen, Giff)
  - `{@itemProperty 2h|XPHB|Two-Handed}` (lowercase код, Great Weapon Fighting)
  - `{@itemProperty LD|PHB|loading}` (legacy PHB-источник, Gunner)
- `src/data/registry.ts` — `_itemProperties` подключён, отдельный case `'itemProperty'` в `lookupByTag` (выделен из общего блока с `hazard/quickref/creature/card`), фоллбэк на `_variantrule` сохранён для легаси-данных.
- `src/data/translationOverlay.ts` — добавлена категория `itemproperties` в `OVERLAY_MODULES`.
- `src/i18n/gamedata/{en,ru}/itemproperties.json` — RU-переводы (Лёгкое/Тяжёлое/Фехтовальное/Метательное/…).
- `src/i18n/locales/{en,ru}/game.json` — ключ `registry.itemProperties` для лоадер-индикатора.

## Что осталось

### Manual QA
- Открыть Crossbow Expert / Two-Weapon Fighting / Dual Wielder в EN и RU — клик по «Light» / «Лёгкое» открывает тултип.
- Powerful Build (Heavy), Sun Blade (Finesse), Whelm (Thrown), Great Weapon Fighting (`2h` lowercase).
- Thri-kreen / Giff с пустым источником.
- Firearms (Burst Fire, Reload, Ammunition AF).

### Документация
- [docs/TRANSLATION_GUIDE.md](TRANSLATION_GUIDE.md) и [docs/BROKEN_LINKS.md](BROKEN_LINKS.md) — убрать пометки про неработающий `@itemProperty`, если есть.

### Экстрактор переводов
- Если `scripts/i18n-extract.mjs` не подхватывает категорию `itemproperties` автоматически — добавить её в список обходимых.

## Связанные задачи (отдельные PR)

- **`@itemMastery`** — та же проблема: тег используется в `Firearms.json`, `Efficient Killer.json`, `Finger Guns.json`, `Tenmen Tincture.json`. Формат `{@itemMastery FullName|SOURCE}`. Лукап должен идти по `name` (не `abbreviation`). Данные mastery-свойств (Nick/Push/Sap/Slow/Topple/Vex/Cleave/Graze) уже частично лежат в `items-base/`. Решить: отдельная категория `itemmasteries` или объединить с `itemproperties` через поле `kind: 'mastery' | 'property'`.
- **`@itemType`** — пока не встречается в наших данных (использует те же коды HA/LA/MA/M/INS/SCF, но в `"type"`, а не `"property"`). Если появится — лукап по `abbreviation` в `items-base`.
