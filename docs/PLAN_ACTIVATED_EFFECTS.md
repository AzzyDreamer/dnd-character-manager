# План: система активируемых эффектов (формы, стойки, ярость)

> Статус: спроектировано, не реализовано.
> Продолжение работы по ветке `feat/effects-functional-audit` (пассивные эффекты).

## Контекст

После аудита «всё должно быть функциональным» пассивные always-on эффекты подключены к листу:
таблицы `CLASS_EFFECTS`/`SUBCLASS_EFFECTS` ([src/utils/classEffects.ts](../src/utils/classEffects.ts)),
дары/изъяны трансформаций ([src/utils/transformationEffects.ts](../src/utils/transformationEffects.ts)),
синхронизация ([src/utils/effectSync.ts](../src/utils/effectSync.ts)).

Сознательно НЕ покрыты **активируемые состояния** — способности, которые игрок включает на время
и которые меняют статы, пока активны:

- **Ярость** варвара (резист дробящему/колющему/рубящему, бонус урона) — самый частый кейс в игре;
- **Песнь клинка** (Bladesinger: +Инт к КД, +10 скорости);
- **Облик ужаса** (warlock:undead), **Мощь гиганта** (rune-knight), **Симбиотическая сущность** (spores);
- **Гнев моря** (druid:sea, на L10 даёт резисты холод/молния/гром);
- **Превосходная защита** монаха L18 (резист всему, кроме силового);
- аватары паладина L20 (Invincible Conqueror и т.п. — резист всему, 1/день);
- активируемые дары трансформаций: Ooze Form, Writhing Tendrils, Chitinous Shell (+2 КД, −10 скорости),
  Angelic Wings (полёт), Incorporeal Movement, Bow of Celestial Judgement (резист некротике);
- условные дары, работающие «пока в гибридной форме»: Iron Pelt (резист д/к/р), Shapeshifter's Savagery.

Единственный прецедент в коде — `activeTransformForm` (гибридные формы ликантропа): floor характеристик
через `getEffectiveAbilityScores` и живой бонус скорости. Этот план обобщает подход.

**Ключевой принцип, выработанный на пассивных эффектах:** активируемое НИКОГДА не вшивается (bake)
в хранимые статы (`armorClass`, `speed`, `damageResistances`, `abilityScores`). Только живые оверлеи
на этапе отображения/расчёта. Иначе двойное применение и порча данных при любом сбое снятия.

## Цели

1. Игрок включает/выключает состояние одним кликом на листе; пока оно активно, КД/скорость/резисты/
   характеристики на листе отражают его, с пометкой источника в тултипах.
2. Активация списывает ресурс (использования ярости, Wild Shape и т.д.), деактивация — нет.
3. Отдыхи и снятие персонажем состояний корректно завершают эффекты.
4. Гибридные формы ликантропа мигрируют в общую систему без потери данных.

## Не-цели (отдельные планы)

- **Wild Shape** с подменой стат-блока зверя — отдельная большая задача (полиморф, HP-пул зверя).
- Боевой трекер раундов: в приложении нет инициатив-трекера, длительность «1 минута/10 раундов»
  отображается бейджем и снимается вручную или по отдыху (см. «Длительности»).
- Автоматика бросков (преимущество на проверки Силы в ярости, +1d6 урона) — этап 3, частично
  только пометками.

## Модель данных

### Character ([src/types/index.ts](../src/types/index.ts))

```ts
// Активные эффекты (формы, стойки, ярость). Заменяет activeTransformForm.
activeEffects?: {
  key: string;          // стабильный ключ из реестра ('rage', 'bladesong', 'hybrid-wolf-form')
  activatedAt: string;  // ISO — для отображения и сортировки
  expiresAt?: string;   // ISO — для длительностей в минутах/часах (опц., см. «Длительности»)
}[];
```

`activeTransformForm?: string` остаётся в типе как deprecated; миграция — см. ниже.

### Реестр: `src/utils/activatedEffects.ts` (новый файл)

```ts
export interface ActiveStatDelta {
  // КД
  acBonus?: number;                          // Chitinous Shell: +2
  acBonusAbility?: keyof AbilityScores;      // Bladesong: +мод Инт
  acBonusMin?: number;                       // Bladesong: минимум +1
  // Скорость
  speedBonus?: number;                       // Bladesong: +10; Chitinous Shell: −10
  moveSpeeds?: { fly?: number; swim?: number; climb?: number };  // −1 = «равна ходьбе» (Angelic Wings)
  // Резисты/иммунитеты — ЖИВОЙ оверлей, не пишутся в damageResistances
  resistances?: string[];                    // Rage: ['bludgeoning','piercing','slashing']
  resistAllExcept?: string[];                // монах L18: всё, кроме ['force']
  immunities?: string[];
  // Характеристики
  abilityFloor?: Partial<AbilityScores>;     // гибридные формы: Сила становится 18/20
  // Не-числовое — пометки в чипе/тултипах (i18n-ключи game:activeEffects.notes.*)
  notes?: string[];                          // 'advStrChecks', 'rageDamage', 'cantConcentrate', …
}

export interface ActivatedEffectDef {
  key: string;                               // стабильный ключ (persisted!)
  // Источник определяет ДОСТУПНОСТЬ эффекта персонажу:
  source:
    | { type: 'class'; classId: string; level: number }
    | { type: 'subclass'; classId: string; subclassId: string; level: number }
    | { type: 'transformBoon'; boonNameEn: string }       // владение даром в optionalFeatures
    | { type: 'feat'; nameEn: string };
  nameKey: string;                           // i18n game:activeEffects.<key>.name
  // Условия активации (переиспользуем хелперы classEffects):
  requiresNoArmor?: boolean;                 // Bladesong
  requiresNoShield?: boolean;                // Bladesong
  requiresNoHeavyArmor?: boolean;            // Rage
  requiresActiveEffect?: string;             // Iron Pelt: только при активной hybrid-форме (см. linked)
  // Стоимость:
  resourceKey?: string;                      // ключ resourceTrackers ('rages', 'wildShape', 'bladesong'…)
  concentration?: boolean;                   // занимает concentratingOn (нет таких в фазе 1, задел)
  // Длительность:
  duration?:
    | { type: 'minutes' | 'hours'; amount: number }
    | { type: 'untilShortRest' | 'untilLongRest' }
    | { type: 'manual' };                    // по умолчанию manual
  // Одновременность:
  exclusiveGroup?: string;                   // 'transform-form': активна максимум одна из группы
  effects: ActiveStatDelta;
}

export const ACTIVATED_EFFECTS: Record<string, ActivatedEffectDef> = { /* каталог ниже */ };
```

### Связанные (условные) эффекты

Дары вида «пока ты в гибридной форме» не активируются сами — они включаются автоматически
вместе с родительским эффектом:

```ts
// в ActivatedEffectDef:
linked?: { key: string; whenOwned: string }[];
// hybrid-wolf-form.linked = [{ key: 'iron-pelt', whenOwned: 'Iron Pelt' }, …]
```

`getActiveDeltas(char)` разворачивает активные эффекты + их linked-эффекты (если дар во владении).
Это закрывает Iron Pelt, Shapeshifter's Savagery (notes), Savage Instincts (notes) без отдельных тумблеров.

## Каталог фазы 1

| key | Источник | Ресурс | Длительность | Эффекты |
|---|---|---|---|---|
| `rage` | class barbarian L1 | `rages` | manual (бейдж «1 мин») | resist д/к/р; notes: advStrChecks/Saves, rageDamage, noConcentration; requiresNoHeavyArmor |
| `bladesong` | subclass wizard:bladesinger L3 | `bladesong`* | minutes 1 | КД +мод Инт (min 1), скорость +10; notes: advAcrobatics; requiresNoArmor+NoShield |
| `form-of-dread` | subclass warlock:undead L3 | `formOfDread`* | minutes 1 | notes: tempHp, fearOnHit; immunity к Frightened — note |
| `giants-might` | subclass fighter:rune-knight L3 | `giantsMight`* | minutes 1 | notes: advStrChecks/Saves, +1d6 урона, размер Large |
| `symbiotic-entity` | subclass druid:spores L3 | `wildShape` | minutes 10 | notes: tempHp 4×lvl, +1d6 некротики в ближнем бою |
| `wrath-of-the-sea` | subclass druid:sea L3 | `wildShape` | minutes 10 | L10+: resist cold/lightning/thunder, fly −1 (эффект уровнезависимый: `minLevelFor` на полях) |
| `superior-defense` | class monk L18 | `focusPoints` (3) | minutes 1 | resistAllExcept ['force'] |
| `invincible-conqueror` (+2 аватара) | subclass paladin:* L20 | 1/long* | minutes 10 | resist all (resistAllExcept []) |
| `hybrid-wolf-form` | transformBoon 'Hybrid Wolf Form' | — | manual | abilityFloor Str 18, speed +10; exclusiveGroup 'transform-form'; linked: iron-pelt и др. |
| `hybrid-bear-form` / `hybrid-rat-form` | transformBoon | — | manual | floor Str 20 / Dex 18; та же группа |
| `ooze-form` | transformBoon 'Ooze Form' | — | minutes 1 | notes: amorphous, immune Grappled/Restrained; linked: Slimy Mien (immune Charmed — note), Corrosive Membrane (notes) |
| `writhing-tendrils` | transformBoon | — | minutes 1 | notes; linked: Poison Tendrils-аура (note) |
| `chitinous-shell` | transformBoon 'Aberrant Mutation' | — | minutes 1 | КД +2 (requiresNoHeavyArmor), скорость −10 |
| `angelic-wings` | transformBoon | — | hours 1 | fly −1; requiresNoHeavyArmor |
| `incorporeal-movement` | transformBoon | — | manual (до начала след. хода) | resistAllExcept ['force']; notes |
| `bow-celestial-judgement` | transformBoon | — | minutes 1 | resist necrotic (Domination: immunity — отдельный key или minStage-поле) |

\* — ресурса ещё нет в трекерах; добавить через `SUBCLASS_RESOURCES`
([src/utils/classResources.ts:85](../src/utils/classResources.ts)) — механизм уже поддерживает
`getMax(level)` и `restoreOn`. Bladesong/Form of Dread/Giant's Might: max = бонус мастерства, long rest.

Ресурс `rages`/`wildShape`/`focusPoints` уже есть в `TRACKABLE_RESOURCES`
([src/utils/classResources.ts:13](../src/utils/classResources.ts)) и в `character.resourceTrackers`.

## Точки интеграции (живые оверлеи)

Все уже существуют после ветки пассивных эффектов — добавляется по одному вызову:

| Что | Где | Изменение |
|---|---|---|
| КД | `getACBreakdown` ([src/utils/classEffects.ts](../src/utils/classEffects.ts)) | + части от активных дельт, `StatPart.key = 'state'` (новый, в `formatStatParts` + i18n `sidebar.breakdown.state`) |
| Скорость | `getEffectiveSpeed` ([src/utils/conditionEffects.ts](../src/utils/conditionEffects.ts)) | + `getActiveSpeedAdjust(char)` рядом с `getTransformSpeedAdjust`; тултипы скорости — строка «(состояние)» |
| Характеристики | `getEffectiveAbilityScores` ([src/utils/classEffects.ts](../src/utils/classEffects.ts)) | floor-блок уже есть для гибридных форм — заменить на общий `getActiveAbilityFloors(char)` |
| Резисты | **новое** `getEffectiveResistances(char)` | хранимые `damageResistances` + временные из активных дельт (с флагом `temporary: true`); использовать в `ResistancesSection` и бейджах. Временные не редактируются и не сохраняются |
| Доп. скорости | `MovementSection` | отображать `moveSpeeds` активных эффектов поверх хранимых (пометка) |
| Сайдбар | `CharacterStatsSidebar` | те же хелперы — изменений почти нет |

`resolveAC`/`computeInitiative` НЕ пересчитываются при активации — гарантия «ничего не бейкается».
Исключение: ничего. Даже КД от Bladesong живёт только в breakdown.

## Жизненный цикл

### Активация (ActiveFormsSection, новая секция на вкладке Stats)

1. Секция показывает все эффекты, ДОСТУПНЫЕ персонажу (по `source`: класс+уровень, подкласс,
   владение даром) — каждый чипом с тумблером, расходом ресурса «2/3» и кратким описанием дельт.
2. Клик «включить»:
   - проверка условий (броня/щит — хелперы `isWearingArmor`/`isWieldingShield`/`isWearingHeavyArmor`
     уже экспортируемы или легко экспортируются из classEffects);
   - проверка ресурса: `resourceTrackers[resourceKey].current > 0` → декремент (через существующий
     механизм трекеров), иначе чип disabled;
   - `exclusiveGroup`: активный эффект той же группы снимается;
   - `concentration`: если занято `concentratingOn` — подтверждение (как при касте);
   - запись в `activeEffects` + `expiresAt` для minutes/hours.
3. Клик «выключить» — удаление записи. Ресурс не возвращается.

### Автоснятие

- **Отдыхи**: `applyShortRest`/`applyLongRest` ([src/components/CharacterSheet.tsx](../src/components/CharacterSheet.tsx))
  чистят все `activeEffects` (любые формы не переживают отдых; этого достаточно для фазы 1 и проще
  честной матрицы длительностей).
- **`expiresAt`**: при рендере секции просроченный эффект подсвечивается «истёк», и удаляется
  при следующем открытии листа в `syncCharacterEffects` (sync уже идемпотентно вызывается на маунте;
  это единственное место, где sync касается activeEffects — только удаление просроченных).
- **Состояние Incapacitated** (и содержащие его) — снимает эффекты с `notes: 'endsIfIncapacitated'`
  (Rage, Bladesong): хук в обработчике добавления состояния в `ConditionsSection`.
- **Снятие дара/стадии** трансформации — уже реализовано для `activeTransformForm`
  (сброс в `handleStageDown`), перенести на общий `activeEffects` (фильтр по `source.boonNameEn`).

### Длительности

Раундовых таймеров нет (нет трекера боя). Решение фазы 1:
- `minutes`/`hours` → `expiresAt` от момента активации (реальное время — для игры за столом это
  «напоминалка», не строгий таймер) + всегда доступное ручное снятие;
- «до конца следующего хода» и пр. микродлительности → `manual` с note;
- бейдж длительности на чипе: «1 мин», «до отдыха», «вручную».

## UI

```
┌ Активные формы и стойки ────────────────────────────┐
│ [⚔ Ярость        2/3  ~1 мин   ● АКТИВНА]  [выкл]   │
│   резист: дробящий, колющий, рубящий · преим. на     │
│   проверки/спасы Силы · +2 урона (Сила, ближний бой) │
│ [🐺 Гибридная форма: волк       ○]                   │
│ [🎵 Песнь клинка  3/3  1 мин    ○]  (нужно: без брони)│
└──────────────────────────────────────────────────────┘
```

- Размещение: вкладка Stats, после `TransformationSection` (гибридные тумблеры переезжают сюда).
- Чип активного эффекта дублируется маленьким бейджем возле блока боевых статов (как индикатор
  концентрации) — игрок видит «почему КД 17».
- В `ResistancesSection` временные резисты — с иконкой ⏳ и тултипом «от: Ярость», без кнопки удаления.
- Описание дельт генерируется из `ActiveStatDelta` + `notes` (i18n), а не дублируется руками.

## Миграция `activeTransformForm`

1. Реестр получает `hybrid-*-form` ключи (см. каталог), `HYBRID_FORM_EFFECTS` из
   [src/utils/transformationEffects.ts](../src/utils/transformationEffects.ts) переезжает в дельты.
2. В `syncCharacterEffects`: если `char.activeTransformForm` задан — конвертировать в запись
   `activeEffects` (key по маппингу имени) и очистить старое поле.
3. `getHybridAbilityFloors`/`getTransformSpeedAdjust` переключаются на общие
   `getActiveAbilityFloors`/`getActiveSpeedAdjust` (внутренне читают `activeEffects`);
   внешние сигнатуры сохраняются, лишние удаляются после миграции.
4. Тумблер из `TransformationSection` удаляется в пользу общей секции.

## Этапы

**Этап 1 — ядро (≈ 1 сессия):**
реестр + типы + живые оверлеи (КД/скорость/резисты/floor) + `getEffectiveResistances` +
ActiveFormsSection с ручным вкл/выкл + очистка по отдыхам + миграция гибридных форм.
Каталог: rage, bladesong, superior-defense, гибридные формы, chitinous-shell, angelic-wings,
incorporeal-movement, ooze-form.

**Этап 2 — ресурсы и автоматика:**
декремент ресурсов при активации + новые `SUBCLASS_RESOURCES` (bladesong, formOfDread, giantsMight,
аватары L20) + `expiresAt` + автоснятие по Incapacitated + linked-эффекты (Iron Pelt и пр.) +
оставшийся каталог (giants-might, form-of-dread, symbiotic-entity, wrath-of-the-sea, аватары,
writhing-tendrils, bow-celestial-judgement).

**Этап 3 — интеграция с бросками (опционально):**
бонус урона ярости в [src/utils/weaponAttacks.ts](../src/utils/weaponAttacks.ts) (есть `rageDamage`
в levelTable как пассивный стат), пометки преимущества в DiceTab, запрет концентрации в ярости
(подсветка в `ConcentrationSection`).

## Риски и решения

| Риск | Решение |
|---|---|
| Двойное применение при смешении с baked-статами | Жёсткое правило: активные дельты НЕ пишутся в хранимые поля; sync их не материализует |
| Залипший эффект (закрыли вкладку в «ярости») | Все эффекты переживают перезагрузку (persisted), снимаются вручную/отдыхом; просроченные чистит sync |
| Конфликт с manualEdit | Оверлеи живые, manualEdit-персонажей не трогают; sync-очистка просроченных — безопасна (только удаление записей activeEffects) |
| i18n названий | `nameKey` в game.json (en/ru); ключи эффектов — стабильные английские слаги |
| Рост CharacterSheet.tsx (4k+ строк) | ActiveFormsSection — отдельный файл `src/components/ActiveFormsSection.tsx` |
| 2014 vs 2024 формулировки (Rage 2024 без «can't cast», Bladesong кол-во использований) | Берём редакцию данных приложения (XPHB 2024); notes формулируются по фактическому тексту фичи из бандла |

## Тест-план

1. Варвар L5: включить ярость → резисты д/к/р видны с пометкой «временно», `damageResistances`
   в localStorage НЕ изменился; выключить → исчезли. Использования 2/3.
2. Bladesinger L3 (Инт 16): без брони КД-тултип `10 + 2 (ЛВК) + 3 (состояние) = 15`; надеть броню →
   эффект снят/недоступен.
3. Монах L18: Superior Defense → все типы резистов кроме силового в отображении.
4. Ликантроп со старым `activeTransformForm` → после открытия листа поле сконвертировано,
   floor Силы работает как раньше; Iron Pelt даёт резист только при активной форме (этап 2).
5. Долгий отдых снимает все активные эффекты; короткий — тоже; ресурсы восстанавливаются
   по своим правилам.
6. Понижение стадии трансформации с активной формой → эффект снят вместе с даром.
7. `tsc -b --force` (не `tsc --noEmit` — он в этом репо холостой) + `npm run build`.
