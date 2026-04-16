# Полный гайд по локализации dnd-character-manager через Crowdin

> Этот гайд написан для тех, кто никогда не работал с i18n (интернационализацией) и Crowdin.
> Каждый шаг объяснён максимально подробно.

---

## Оглавление

1. [Что такое i18n и зачем это нужно](#1-что-такое-i18n-и-зачем-это-нужно)
2. [Что такое Crowdin](#2-что-такое-crowdin)
3. [Текущее состояние проекта](#3-текущее-состояние-проекта)
4. [Выбор библиотеки i18n](#4-выбор-библиотеки-i18n)
5. [Архитектура файлов переводов](#5-архитектура-файлов-переводов)
6. [Настройка i18next в проекте](#6-настройка-i18next-в-проекте)
7. [Формат ключей и правила написания переводов](#7-формат-ключей-и-правила-написания-переводов)
8. [Рефакторинг компонентов — как вынимать строки](#8-рефакторинг-компонентов--как-вынимать-строки)
9. [Рефакторинг констант и утилит](#9-рефакторинг-констант-и-утилит)
10. [Проблема игрового контента (JSON-данные)](#10-проблема-игрового-контента-json-данные)
11. [Порядок рефакторинга (пошаговый план)](#11-порядок-рефакторинга-пошаговый-план)
12. [Настройка Crowdin — с нуля](#12-настройка-crowdin--с-нуля)
13. [Интеграция Crowdin с GitHub](#13-интеграция-crowdin-с-github)
14. [Переключатель языка в UI](#14-переключатель-языка-в-ui)
15. [TypeScript — строгая типизация ключей](#15-typescript--строгая-типизация-ключей)
16. [Подводные камни и частые ошибки](#16-подводные-камни-и-частые-ошибки)
17. [Тестирование локализации](#17-тестирование-локализации)
18. [Чеклист перед запуском](#18-чеклист-перед-запуском)
19. [Полезные ссылки](#19-полезные-ссылки)

---

## 1. Что такое i18n и зачем это нужно

**i18n** — сокращение от "internationalization" (между "i" и "n" — 18 букв). Это процесс подготовки приложения к работе на нескольких языках.

### Как это работает (простыми словами)

Без i18n у вас в коде:
```tsx
<button>Удалить персонажа</button>
```

С i18n у вас в коде:
```tsx
<button>{t('buttons.delete')}</button>
```

А сами тексты живут в отдельных JSON-файлах:
```
locales/en/common.json → { "buttons": { "delete": "Delete character" } }
locales/ru/common.json → { "buttons": { "delete": "Удалить персонажа" } }
locales/de/common.json → { "buttons": { "delete": "Charakter löschen" } }
```

Приложение подставляет нужный текст в зависимости от выбранного языка. Код пишется один раз — переводы добавляются без изменения кода.

### Ключевые термины

| Термин | Что значит |
|--------|-----------|
| **i18n** | Internationalization — подготовка кода к мультиязычности |
| **l10n** | Localization — сам процесс перевода на конкретный язык |
| **locale** | Код языка: `ru`, `en`, `de`, `ja` |
| **source language** | Исходный язык, с которого переводят (у нас — английский) |
| **target language** | Язык, НА который переводят (у нас — русский и другие) |
| **namespace** | Группа переводов в отдельном файле (`common.json`, `combat.json`) |
| **translation key** | Идентификатор строки: `buttons.delete`, `nav.characters` |
| **interpolation** | Подстановка переменных: `"Уровень {{level}}"` |
| **fallback** | Запасной язык, если перевод не найден |

---

## 2. Что такое Crowdin

[Crowdin](https://crowdin.com) — это платформа для управления переводами. Она решает проблему: "как удобно переводить сотни строк и не потерять синхронизацию с кодом?"

### Что Crowdin делает за вас

1. **Хранит все переводы** в одном месте с удобным веб-интерфейсом
2. **Синхронизируется с GitHub** — при добавлении новых строк автоматически создаёт задачи для перевода
3. **Создаёт PR с переводами** — переводчик перевёл строку → Crowdin сам присылает PR в ваш репозиторий
4. **Translation Memory** — если вы уже переводили "Delete" как "Удалить", Crowdin предложит тот же перевод для новых строк
5. **Глоссарий** — список терминов с утверждённым переводом (например, "Strength" = "Сила", не "Сила", не "Мощь")
6. **Контроль качества** — проверяет, что переводчик не потерял `{{переменные}}`, не оставил пустых строк

### Бесплатный тариф

Crowdin бесплатен для open-source проектов. Для приватных проектов — есть бесплатный тариф с ограничениями (обычно хватает для небольших проектов).

### Как выглядит рабочий процесс

```
Вы пишете код → строки в en/common.json → пуш в GitHub
     ↓
Crowdin подхватывает новые строки
     ↓
Переводчик видит новые строки в веб-интерфейсе Crowdin
     ↓
Переводчик переводит → Crowdin создаёт PR в ваш репозиторий
     ↓
Вы мержите PR → ru/common.json обновлён → приложение показывает перевод
```

---

## 3. Текущее состояние проекта

### Технический стек
- **React 19** + **TypeScript** + **Vite 7** + **Tailwind CSS**
- **0 зависимостей для i18n** — инфраструктуры локализации нет вообще

### Где живут тексты сейчас

| Что | Язык | Где | Объём |
|-----|------|-----|-------|
| UI-строки (кнопки, заголовки, подтверждения) | Русский | 22 файла `.tsx` в `src/components/` | ~350 уникальных строк |
| Игровые константы (навыки, характеристики) | Русский | `src/utils/dnd.ts`, `src/data/items/constants.ts` | ~40 строк |
| Названия/описания классов | Русский | `src/data/classes/*.json` (поле `name`, `description`) | ~17 классов |
| Заклинания | Английский | `src/data/spells/*.json` | 701 файл |
| Предметы | Английский | `src/data/items/*.json` | 1739 файлов |
| Черты | Английский | `src/data/feats/*.json` | 257 файлов |
| Расы, предыстории и т.д. | Английский | `src/data/` (разные папки) | сотни файлов |

### Главный вывод

**Английского контента на порядок больше** (~2700 JSON-файлов), чем русского (~350 UI-строк). Поэтому **source language = English**, а русский — целевой язык перевода.

Это значит:
- Файлы-источники (source) пишем на английском: `locales/en/*.json`
- Русские переводы — целевые: `locales/ru/*.json`
- Crowdin будет показывать английские строки переводчику, а тот переводит их на русский (и другие языки)
- Текущие русские строки из компонентов вы знаете — просто заполняете оба файла (en и ru) одновременно

---

## 4. Выбор библиотеки i18n

### Рекомендация: `react-i18next` + `i18next`

Есть несколько библиотек для i18n в React:

| Библиотека | Плюсы | Минусы |
|------------|-------|--------|
| **react-i18next** | Зрелая (10+ лет), огромное сообщество, отличная документация, интеграция с Crowdin | Чуть больше boilerplate при настройке |
| react-intl (FormatJS) | Стандарт ICU Message Format | Сложнее синтаксис, хуже экосистема плагинов |
| lingui | Компактный, быстрый | Меньше сообщество, хуже интеграция с Crowdin |
| typesafe-i18n | Отличная типизация | Маленькое сообщество |

**Выбираем `react-i18next`**, потому что:
1. Crowdin нативно поддерживает формат JSON i18next
2. Огромное количество туториалов и StackOverflow-ответов
3. Поддержка плюрализации, интерполяции, контекстов из коробки
4. TypeScript-типизация ключей (автодополнение в IDE)

### Что устанавливать

```bash
npm install i18next react-i18next i18next-browser-languagedetector
```

| Пакет | Зачем |
|-------|-------|
| `i18next` | Ядро библиотеки — работа с переводами, плюрализация, интерполяция |
| `react-i18next` | React-обёртка — хук `useTranslation()`, компонент `<Trans>` |
| `i18next-browser-languagedetector` | Автоопределение языка браузера пользователя |

> **Что НЕ нужно на старте:** Пакет `i18next-http-backend` загружает переводы по сети (fetch). Вам это не нужно — у вас SPA, переводы бандлятся вместе с кодом через Vite. Если проект вырастет до 10+ языков и файлы станут тяжёлыми, тогда добавите.

---

## 5. Архитектура файлов переводов

### Структура папок

```
src/
├── i18n/
│   ├── index.ts                 ← Конфигурация и инициализация i18next
│   ├── i18next.d.ts             ← TypeScript-декларация для автодополнения
│   └── locales/
│       ├── en/                  ← SOURCE (исходный язык — английский)
│       │   ├── common.json      ← Общее: кнопки, навигация, ошибки, подтверждения
│       │   ├── character.json   ← Создание и лист персонажа
│       │   ├── spells.json      ← Вкладка заклинаний, модалки кастинга
│       │   ├── combat.json      ← Боевая вкладка, дайсы, состояния
│       │   ├── inventory.json   ← Инвентарь, экипировка
│       │   ├── glossary.json    ← База знаний
│       │   └── game.json        ← Игровые термины (навыки, характеристики, редкость)
│       └── ru/                  ← TARGET (русский перевод)
│           ├── common.json
│           ├── character.json
│           ├── spells.json
│           ├── combat.json
│           ├── inventory.json
│           ├── glossary.json
│           └── game.json
```

### Почему несколько файлов, а не один большой

**Namespaces** (пространства имён) — это способ разбить переводы на логические группы. Каждый файл = один namespace.

**Плюсы:**
- Crowdin удобнее работать с файлами до ~200 ключей (переводчик не теряется)
- Переводчик видит контекст: файл `combat.json` — это про бой, не про инвентарь
- Удобнее ревьюить PR: изменились строки боя — смотришь только `combat.json`
- Если проект вырастет — можно подгружать namespace'ы лениво (lazy loading)

**Минусы:**
- Чуть больше импортов при настройке
- Нужно указывать namespace при вызове `t()` из "чужого" файла

> **Предупреждение:** Не делайте по файлу на каждый компонент — получите 30+ файлов, и это будет кошмар. 5-7 файлов — золотая середина для проекта такого размера.

### Какие строки куда

| Namespace | Что внутри | Примеры ключей |
|-----------|-----------|----------------|
| `common` | Кнопки, навигация, ошибки, подтверждения, поиск | `buttons.delete`, `nav.characters`, `errors.loadError` |
| `character` | Создание персонажа, лист персонажа, ASI, уровни | `creation.title`, `sheet.hitPoints`, `asi.chooseAbility` |
| `spells` | Заклинания: списки, подготовка, кастинг | `cast.title`, `preparation.slotsUsed`, `level.cantrip` |
| `combat` | Дайсы, бой, инициатива, спасброски, состояния | `dice.roll`, `initiative.title`, `conditions.stunned` |
| `inventory` | Предметы, экипировка, рюкзак | `bag.full`, `equip.slot`, `item.attune` |
| `glossary` | База знаний, вкладки глоссария | `tabs.spells`, `tabs.items`, `search.noResults` |
| `game` | Игровые термины: характеристики, навыки, редкость, категории | `abilities.strength`, `skills.acrobatics`, `rarity.legendary` |

---

## 6. Настройка i18next в проекте

### Шаг 1: Создайте файл конфигурации

Файл `src/i18n/index.ts`:

```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Импорт английских переводов (source)
import enCommon from './locales/en/common.json';
import enCharacter from './locales/en/character.json';
import enSpells from './locales/en/spells.json';
import enCombat from './locales/en/combat.json';
import enInventory from './locales/en/inventory.json';
import enGlossary from './locales/en/glossary.json';
import enGame from './locales/en/game.json';

// Импорт русских переводов (target)
import ruCommon from './locales/ru/common.json';
import ruCharacter from './locales/ru/character.json';
import ruSpells from './locales/ru/spells.json';
import ruCombat from './locales/ru/combat.json';
import ruInventory from './locales/ru/inventory.json';
import ruGlossary from './locales/ru/glossary.json';
import ruGame from './locales/ru/game.json';

i18n
  // Определение языка браузера (автоматически)
  .use(LanguageDetector)
  // Подключение к React (даёт хук useTranslation и компонент <Trans>)
  .use(initReactI18next)
  // Настройки
  .init({
    resources: {
      en: {
        common: enCommon,
        character: enCharacter,
        spells: enSpells,
        combat: enCombat,
        inventory: enInventory,
        glossary: enGlossary,
        game: enGame,
      },
      ru: {
        common: ruCommon,
        character: ruCharacter,
        spells: ruSpells,
        combat: ruCombat,
        inventory: ruInventory,
        glossary: ruGlossary,
        game: ruGame,
      },
    },

    // Язык по умолчанию (fallback), если перевод не найден
    // Английский — потому что это source language
    fallbackLng: 'en',

    // Namespace по умолчанию (если не указан явно)
    defaultNS: 'common',

    // Список всех namespace'ов
    ns: ['common', 'character', 'spells', 'combat', 'inventory', 'glossary', 'game'],

    interpolation: {
      // React сам экранирует HTML — не нужно двойное экранирование
      escapeValue: false,
    },

    detection: {
      // Порядок проверки языка: сначала localStorage, потом язык браузера
      order: ['localStorage', 'navigator'],
      // Где кешировать выбранный язык
      caches: ['localStorage'],
    },
  });

export default i18n;
```

### Шаг 2: Подключите в точке входа

В файле `src/main.tsx` (или где у вас `createRoot`):

```typescript
import './i18n';  // Просто импорт — i18next инициализируется автоматически

import { createRoot } from 'react-dom/client';
import App from './App';
// ...
```

> **Важно:** Импорт `'./i18n'` должен быть ДО импорта `App` и любых компонентов, которые используют `useTranslation()`. Иначе i18next не успеет инициализироваться.

### Что здесь происходит (для понимания)

1. `LanguageDetector` при загрузке страницы проверяет:
   - Есть ли в `localStorage` сохранённый язык? (ключ `i18nextLng`)
   - Если нет — смотрит язык браузера (`navigator.language`)
   - Если браузер на русском → выбирает `ru`, если на английском → `en`
2. `initReactI18next` связывает i18next с React — при смене языка компоненты перерисовываются
3. `resources` — все переводы, сгруппированные по языкам и namespace'ам
4. `fallbackLng: 'en'` — если для ключа нет перевода на текущем языке, покажет английский текст (а не пустоту или ключ типа `common:buttons.delete`)

---

## 7. Формат ключей и правила написания переводов

### Пример файла `en/common.json`

```json
{
  "nav": {
    "characters": "Characters",
    "creation": "Creation",
    "glossary": "Knowledge Base"
  },
  "buttons": {
    "select": "Select",
    "remove": "Remove",
    "create": "Create",
    "delete": "Delete",
    "export": "Export",
    "import": "Import",
    "cancel": "Cancel",
    "confirm": "Confirm",
    "save": "Save",
    "close": "Close",
    "back": "Back",
    "reset": "Reset"
  },
  "search": {
    "placeholder": "Search...",
    "spells": "Search spells...",
    "species": "Search species...",
    "items": "Search items..."
  },
  "errors": {
    "renderError": "Application render error",
    "importError": "Character import error",
    "loadError": "Loading error"
  },
  "confirm": {
    "deleteCharacter": "Delete character \"{{name}}\"?"
  },
  "loading": {
    "progress": "Loading data... {{percent}}%",
    "complete": "Loading complete"
  }
}
```

### Пример `ru/common.json`

```json
{
  "nav": {
    "characters": "Персонажи",
    "creation": "Создание",
    "glossary": "База знаний"
  },
  "buttons": {
    "select": "Выбрать",
    "remove": "Убрать",
    "create": "Создать",
    "delete": "Удалить",
    "export": "Экспортировать",
    "import": "Импортировать",
    "cancel": "Отмена",
    "confirm": "Подтвердить",
    "save": "Сохранить",
    "close": "Закрыть",
    "back": "Назад",
    "reset": "Сбросить"
  },
  "search": {
    "placeholder": "Поиск...",
    "spells": "Поиск заклинаний...",
    "species": "Поиск видов...",
    "items": "Поиск предметов..."
  },
  "errors": {
    "renderError": "Ошибка рендеринга приложения",
    "importError": "Ошибка импорта персонажа",
    "loadError": "Ошибка загрузки"
  },
  "confirm": {
    "deleteCharacter": "Удалить персонажа \"{{name}}\"?"
  },
  "loading": {
    "progress": "Загрузка данных... {{percent}}%",
    "complete": "Загрузка завершена"
  }
}
```

### Пример `en/game.json`

```json
{
  "abilities": {
    "strength": "Strength",
    "dexterity": "Dexterity",
    "constitution": "Constitution",
    "intelligence": "Intelligence",
    "wisdom": "Wisdom",
    "charisma": "Charisma"
  },
  "abilitiesShort": {
    "strength": "STR",
    "dexterity": "DEX",
    "constitution": "CON",
    "intelligence": "INT",
    "wisdom": "WIS",
    "charisma": "CHA"
  },
  "skills": {
    "acrobatics": "Acrobatics",
    "animalHandling": "Animal Handling",
    "arcana": "Arcana",
    "athletics": "Athletics",
    "deception": "Deception",
    "history": "History",
    "insight": "Insight",
    "intimidation": "Intimidation",
    "investigation": "Investigation",
    "medicine": "Medicine",
    "nature": "Nature",
    "perception": "Perception",
    "performance": "Performance",
    "persuasion": "Persuasion",
    "religion": "Religion",
    "sleightOfHand": "Sleight of Hand",
    "stealth": "Stealth",
    "survival": "Survival"
  },
  "rarity": {
    "common": "Common",
    "uncommon": "Uncommon",
    "rare": "Rare",
    "very_rare": "Very Rare",
    "legendary": "Legendary",
    "artifact": "Artifact"
  },
  "categories": {
    "weapon": "Weapons",
    "armor": "Armor",
    "shield": "Shields",
    "helmet": "Helmets",
    "boots": "Boots",
    "gloves": "Gloves",
    "cloak": "Cloaks",
    "amulet": "Amulets",
    "ring": "Rings",
    "potion": "Potions",
    "scroll": "Scrolls",
    "wand": "Wands",
    "ammunition": "Ammunition",
    "tool": "Tools",
    "treasure": "Treasures",
    "misc": "Miscellaneous"
  },
  "equipmentSlots": {
    "helmet": "Helmet",
    "armor": "Armor",
    "gloves": "Gloves",
    "boots": "Boots",
    "cloak": "Cloak",
    "accessory1": "Accessory 1",
    "accessory2": "Accessory 2"
  }
}
```

### Правила именования ключей

| Правило | Хорошо | Плохо |
|---------|--------|-------|
| Максимум 2 уровня вложенности | `nav.characters` | `ui.layout.nav.tabs.characters` |
| camelCase для ключей | `deleteCharacter` | `delete_character`, `delete-character` |
| Группировка по смыслу | `buttons.save`, `buttons.delete` | `save`, `deleteButton` |
| Уникальные, понятные имена | `confirm.deleteCharacter` | `msg1`, `text42` |

### Интерполяция (подстановка переменных)

Когда строка содержит динамические данные (имя, число, уровень), используйте `{{двойные фигурные скобки}}`:

```json
{
  "greeting": "Hello, {{name}}!",
  "levelInfo": "Level {{level}} {{className}}",
  "hpStatus": "HP: {{current}} / {{max}}"
}
```

```tsx
t('greeting', { name: 'Gandalf' })     // "Hello, Gandalf!"
t('levelInfo', { level: 5, className: 'Wizard' })  // "Level 5 Wizard"
```

> **Почему нельзя просто склеивать строки?** Потому что в разных языках порядок слов разный. По-русски: "Волшебник 5-го уровня". По-английски: "Level 5 Wizard". По-японски: "レベル5のウィザード". Интерполяция позволяет переводчику расставить переменные в правильном порядке.

### Плюрализация (множественное число)

Русский язык имеет **3 формы множественного числа** (1 ячейка, 2 ячейки, 5 ячеек), английский — 2 (1 slot, 2 slots). i18next это поддерживает:

**en/spells.json:**
```json
{
  "spellSlots_one": "{{count}} spell slot",
  "spellSlots_other": "{{count}} spell slots"
}
```

**ru/spells.json:**
```json
{
  "spellSlots_one": "{{count}} ячейка заклинаний",
  "spellSlots_few": "{{count}} ячейки заклинаний",
  "spellSlots_many": "{{count}} ячеек заклинаний"
}
```

```tsx
t('spells:spellSlots', { count: 1 })  // "1 ячейка заклинаний"
t('spells:spellSlots', { count: 3 })  // "3 ячейки заклинаний"
t('spells:spellSlots', { count: 7 })  // "7 ячеек заклинаний"
```

> **Как i18next определяет форму?** Через встроенные правила плюрализации для каждого языка. Для русского: `_one` (1, 21, 31...), `_few` (2-4, 22-24...), `_many` (5-20, 25-30...). Вам не нужно писать эту логику — библиотека делает это сама.

> **Предупреждение:** В Crowdin переводчик увидит нужное количество полей для каждого языка автоматически. Но в русском source-файле вы ДОЛЖНЫ задать все 3 формы (`_one`, `_few`, `_many`), иначе i18next не найдёт перевод и покажет fallback.

---

## 8. Рефакторинг компонентов — как вынимать строки

### Базовый паттерн

**Шаг 1:** Импортируйте хук `useTranslation`
**Шаг 2:** Вызовите его с нужным namespace
**Шаг 3:** Замените захардкоженные строки на `t('ключ')`

### Пример: App.tsx

**ДО:**
```tsx
const MAIN_TABS: NavTab[] = [
  { key: 'main', label: 'Персонажи', icon: Users },
  { key: 'creator', label: 'Создание', icon: Scroll },
  { key: 'glossary', label: 'База знаний', icon: Library },
];
```

**ПОСЛЕ:**
```tsx
import { useTranslation } from 'react-i18next';

function App() {
  const { t } = useTranslation('common');

  // Теперь MAIN_TABS внутри компонента, потому что t() — это хук
  const MAIN_TABS: NavTab[] = [
    { key: 'main', label: t('nav.characters'), icon: Users },
    { key: 'creator', label: t('nav.creation'), icon: Scroll },
    { key: 'glossary', label: t('nav.glossary'), icon: Library },
  ];

  // ...
}
```

> **Важный нюанс:** Хуки можно вызывать только внутри React-компонентов или других хуков. Поэтому если `MAIN_TABS` был объявлен снаружи компонента (на уровне модуля), его нужно перенести внутрь. Это неизбежный шаг при i18n.

### Пример: кнопки и подтверждения

**ДО:**
```tsx
<button onClick={handleDelete}>Удалить</button>
{showConfirm && (
  <p>Удалить персонажа "{character.name}"?</p>
)}
```

**ПОСЛЕ:**
```tsx
const { t } = useTranslation('common');

<button onClick={handleDelete}>{t('buttons.delete')}</button>
{showConfirm && (
  <p>{t('confirm.deleteCharacter', { name: character.name })}</p>
)}
```

### Пример: плейсхолдеры

**ДО:**
```tsx
<input placeholder="Поиск заклинаний..." />
```

**ПОСЛЕ:**
```tsx
<input placeholder={t('search.spells')} />
```

### Пример: строки из другого namespace

Если компонент использует строки из разных файлов:

```tsx
// Основной namespace — character
const { t } = useTranslation('character');

// Строка из character namespace — просто t('ключ')
<h1>{t('sheet.title')}</h1>

// Строка из другого namespace — указываем явно через ns
<button>{t('buttons.save', { ns: 'common' })}</button>

// Или второй вариант — через префикс namespace:key
<button>{t('common:buttons.save')}</button>
```

### Пример: ErrorBoundary (class component)

Хуки не работают в class components. Используйте `withTranslation` HOC:

```tsx
import { withTranslation, WithTranslation } from 'react-i18next';

class ErrorBoundary extends Component<
  { children: ReactNode } & WithTranslation,
  { hasError: boolean; error: Error | null }
> {
  render() {
    const { t } = this.props;
    if (this.state.hasError) {
      return <h1>{t('errors.renderError')}</h1>;
    }
    return this.props.children;
  }
}

export default withTranslation('common')(ErrorBoundary);
```

---

## 9. Рефакторинг констант и утилит

### Проблема

`SKILL_NAMES`, `ABILITY_NAMES`, `CATEGORY_NAMES` и другие словари объявлены как **статические объекты на уровне модуля**. Хук `useTranslation()` внутри них вызвать нельзя — он работает только в React-компонентах.

### Решение: функции вместо словарей

**ДО (`src/utils/dnd.ts`):**
```typescript
export const ABILITY_NAMES: Record<keyof AbilityScores, string> = {
  strength: 'Сила',
  dexterity: 'Ловкость',
  constitution: 'Телосложение',
  intelligence: 'Интеллект',
  wisdom: 'Мудрость',
  charisma: 'Харизма'
};
```

**ПОСЛЕ (`src/utils/dnd.ts`):**
```typescript
import i18n from '../i18n';

// Функция вместо статического объекта
export const getAbilityName = (key: keyof AbilityScores): string => {
  return i18n.t(`abilities.${key}`, { ns: 'game' });
};

export const getAbilityShort = (key: keyof AbilityScores): string => {
  return i18n.t(`abilitiesShort.${key}`, { ns: 'game' });
};

export const getSkillName = (key: string): string => {
  return i18n.t(`skills.${key}`, { ns: 'game' });
};
```

### Как вызов `i18n.t()` отличается от `useTranslation()`

| | `useTranslation()` (хук) | `i18n.t()` (прямой вызов) |
|--|--------------------------|--------------------------|
| Где можно использовать | Только в React-компонентах | Везде (утилиты, хелперы, вне React) |
| Реактивность | Компонент перерисуется при смене языка | **НЕ** вызывает перерисовку |
| Когда использовать | Строки в JSX | Утилитные функции, форматирование |

> **Предупреждение о реактивности:** Если пользователь переключит язык в рантайме, компоненты с `useTranslation()` обновятся автоматически. Но строки, полученные через `i18n.t()` в утилитных функциях, НЕ обновятся до следующего вызова этих функций. На практике это редко проблема — обычно компонент перерисовывается и вызывает `getAbilityName()` снова.

### Альтернативный подход: передавать `t` как параметр

Если вам важна 100% реактивность:

```typescript
import type { TFunction } from 'i18next';

export const getAbilityName = (key: keyof AbilityScores, t: TFunction): string => {
  return t(`abilities.${key}`, { ns: 'game' });
};
```

```tsx
// В компоненте:
const { t } = useTranslation('game');
const name = getAbilityName('strength', t); // Реактивно обновится при смене языка
```

### Рефакторинг `data/items/constants.ts`

Тот же принцип — замена `CATEGORY_NAMES`, `RARITY_NAMES`, `EQUIPMENT_SLOT_NAMES` на функции:

```typescript
import i18n from '../../i18n';
import type { ItemCategory, ItemRarity, EquipmentSlot } from '../../types';

export const getCategoryName = (key: ItemCategory): string => {
  return i18n.t(`categories.${key}`, { ns: 'game' });
};

export const getRarityName = (key: ItemRarity): string => {
  return i18n.t(`rarity.${key}`, { ns: 'game' });
};

export const getSlotName = (key: EquipmentSlot): string => {
  return i18n.t(`equipmentSlots.${key}`, { ns: 'game' });
};
```

### Обновление компонентов, использующих старые словари

Найдите все места, где используется `ABILITY_NAMES[key]`, `SKILL_NAMES[key]` и т.д., и замените на вызов функции:

```tsx
// ДО:
<span>{ABILITY_NAMES[ability]}</span>
<span>{SKILL_NAMES[skill]}</span>
<span>{RARITY_NAMES[item.rarity]}</span>

// ПОСЛЕ:
<span>{getAbilityName(ability)}</span>
<span>{getSkillName(skill)}</span>
<span>{getRarityName(item.rarity)}</span>
```

---

## 10. Проблема игрового контента (JSON-данные)

### Это самый сложный вопрос проекта

У вас 2700+ JSON-файлов с игровыми данными. Что с ними делать?

### Что НЕ стоит переводить через Crowdin

**Заклинания** (`src/data/spells/*.json`) и **предметы** (`src/data/items/*.json`):

1. **Это структурированные данные**, не UI-строки. Они содержат сложную разметку: `{@damage 1d6}`, `{@variantrule Sphere [Area of Effect]|XPHB|Sphere}` — переводчик в Crowdin не поймёт, что с этим делать
2. **Объём огромный** — 2440 файлов. Загрузка их всех в Crowdin непрактична
3. **Переводы уже существуют** — русское D&D-сообщество давно перевело все заклинания и предметы

### Рекомендуемый подход для игровых данных

**Вариант A: Маппинг-файлы (рекомендуется для начала)**

Создайте JSON-файлы только с названиями:

```json
// src/i18n/locales/en/spellNames.json (автогенерация из имён файлов)
{
  "Acid Splash": "Acid Splash",
  "Alarm": "Alarm",
  "Alter Self": "Alter Self"
}

// src/i18n/locales/ru/spellNames.json
{
  "Acid Splash": "Брызги кислоты",
  "Alarm": "Сигнал тревоги",
  "Alter Self": "Изменение облика"
}
```

Эти файлы можно загрузить в Crowdin как отдельный namespace. Переводчик переведёт названия, а описания останутся на английском (или вы найдёте готовый русский датасет).

**Вариант B: Оставить английские данные, переводить только UI**

Если вам не критичны русские названия заклинаний в интерфейсе — просто оставьте данные как есть. Многие D&D-игроки знают английские названия.

**Вариант C: Найти готовый русский датасет**

Русские данные D&D 5e существуют в различных фанатских проектах. Если найдёте подходящий — можно заменить JSON-файлы целиком.

### Что СТОИТ переводить через Crowdin

- Русские `name` и `description` из class-файлов → вынесите в `game.json`
- Все UI-строки из компонентов (~350 строк)
- Метаданные (категории, редкость, слоты) → уже в `game.json`

### Описания классов

Сейчас в `data/classes/wizard/wizard.json`:
```json
{
  "name": "Волшебник",
  "description": "Учёный маг, постигающий тайны мироздания..."
}
```

Рекомендация: добавьте в `game.json` и ссылайтесь по `id`:

```json
// en/game.json
{
  "classes": {
    "wizard": {
      "name": "Wizard",
      "description": "A scholarly mage who studies the mysteries of the universe..."
    }
  }
}

// ru/game.json
{
  "classes": {
    "wizard": {
      "name": "Волшебник",
      "description": "Учёный маг, постигающий тайны мироздания..."
    }
  }
}
```

---

## 11. Порядок рефакторинга (пошаговый план)

> **Главное правило:** Не пытайтесь переделать всё за один PR. Разбейте на этапы. Каждый этап — отдельный PR, который можно протестировать.

### Этап 1: Инфраструктура (1 PR)

**Цель:** Убедиться, что i18next работает в проекте.

1. `npm install i18next react-i18next i18next-browser-languagedetector`
2. Создать `src/i18n/index.ts`
3. Создать `src/i18n/locales/en/common.json` с 5-10 строками (навигация)
4. Создать `src/i18n/locales/ru/common.json` с теми же ключами
5. Импортировать `./i18n` в `main.tsx`
6. Перевести навигацию в `App.tsx` (3 строки) как proof of concept
7. Проверить: `npm run build` проходит, UI не сломан

### Этап 2: Общие строки (1 PR)

- Все кнопки, ошибки, подтверждения → `common.json`
- Файлы: `App.tsx`, `HomePage.tsx`, `CharacterList.tsx`

### Этап 3: Игровые термины (1 PR)

- `utils/dnd.ts` → рефакторинг `ABILITY_NAMES`, `SKILL_NAMES` → функции + `game.json`
- `data/items/constants.ts` → рефакторинг `CATEGORY_NAMES`, `RARITY_NAMES` → функции + `game.json`
- Обновить все компоненты, использующие эти словари

### Этап 4: Создание персонажа (1 PR)

- `CharacterCreator.tsx` — самый большой файл (~74 русских строки)
- Модалки пикеров: `FeatPickerModal.tsx`, `FeatSpellPickerModal.tsx`, `ExpertisePickerModal.tsx`

### Этап 5: Лист персонажа + бой (1 PR)

- `CharacterSheet.tsx` (~100 русских строк — самый насыщенный компонент)
- `DiceTab.tsx`, `RoleplayTab.tsx`, `DiceRollProvider.tsx`

### Этап 6: Заклинания + инвентарь + глоссарий (1 PR)

- `SpellsTab.tsx`, `SpellCastModal.tsx`, `SpellPreparationModal.tsx`, `SpellLevelUpModal.tsx`
- `InventoryGrid.tsx`
- `Glossary.tsx`

### Этап 7: Настройка Crowdin + GitHub-интеграция (1 PR)

- Создать `crowdin.yml`
- Настроить проект в Crowdin
- Подключить GitHub-интеграцию
- Загрузить существующие русские переводы

### Этап 8: Финальные штрихи (1 PR)

- Переключатель языка в UI
- TypeScript-декларация `i18next.d.ts`
- Глоссарий в Crowdin
- Загрузка скриншотов для контекста

---

## 12. Настройка Crowdin — с нуля

### Шаг 1: Регистрация

1. Зайдите на [crowdin.com](https://crowdin.com)
2. Создайте аккаунт (можно через GitHub)

### Шаг 2: Создание проекта

1. Нажмите **"Create Project"**
2. **Project name**: `dnd-character-manager`
3. **Source language**: **English** (это важно!)
4. **Target languages**: Russian — и любые другие, которые захотите
5. **Project visibility**: Private (или Public, если хотите открытый перевод от сообщества)

### Шаг 3: Получение API-токена

1. Зайдите в **Account Settings → API**
2. Создайте **Personal Access Token**
3. Скопируйте токен — он понадобится для CLI и GitHub Actions

> **Предупреждение:** Никогда не коммитьте токен в репозиторий! Храните его в переменных окружения или секретах GitHub.

### Шаг 4: Установка Crowdin CLI

```bash
npm install -g @crowdin/cli
```

Или без глобальной установки:
```bash
npx @crowdin/cli --version
```

### Шаг 5: Конфигурационный файл

Создайте файл `crowdin.yml` в **корне** проекта:

```yaml
# crowdin.yml
#
# Переменные окружения с ID проекта и токеном
project_id_env: CROWDIN_PROJECT_ID
api_token_env: CROWDIN_PERSONAL_TOKEN

# Сохранять структуру папок
preserve_hierarchy: true

files:
  # Откуда брать исходные файлы (английские)
  - source: /src/i18n/locales/en/**/*.json
    # Куда класть переводы
    # %two_letters_code% → ru, de, fr и т.д.
    # %original_file_name% → common.json, game.json и т.д.
    translation: /src/i18n/locales/%two_letters_code%/**/%original_file_name%
```

**Что это значит простыми словами:**
- Crowdin берёт файлы из `src/i18n/locales/en/` (ваши английские исходники)
- Когда переводчик переводит на русский, Crowdin создаёт файлы в `src/i18n/locales/ru/`
- Если добавите немецкий — файлы появятся в `src/i18n/locales/de/`

### Шаг 6: Настройка переменных окружения

```bash
# В терминале (для локального использования)
export CROWDIN_PROJECT_ID=123456
export CROWDIN_PERSONAL_TOKEN=your_token_here

# Или в .env файле (добавьте .env в .gitignore!)
CROWDIN_PROJECT_ID=123456
CROWDIN_PERSONAL_TOKEN=your_token_here
```

### Шаг 7: Первая загрузка

```bash
# Проверить, что конфиг корректен
crowdin lint

# Загрузить английские исходники в Crowdin
crowdin upload sources

# Загрузить существующие русские переводы
crowdin upload translations -l ru --auto-approve
```

> **Что делает `--auto-approve`:** Пометит загруженные русские переводы как одобренные. Без этого флага они будут в статусе "suggested" и потребуют ручного одобрения.

### Шаг 8: Скачивание переводов

```bash
# Скачать все готовые переводы из Crowdin в ваш проект
crowdin download
```

Эта команда скачает `ru/common.json`, `ru/game.json` и т.д. в `src/i18n/locales/ru/`.

### Основные команды CLI (шпаргалка)

| Команда | Что делает |
|---------|-----------|
| `crowdin lint` | Проверяет `crowdin.yml` на ошибки |
| `crowdin upload sources` | Загружает исходные файлы (en) в Crowdin |
| `crowdin upload translations -l ru` | Загружает существующие переводы (ru) |
| `crowdin download` | Скачивает все переводы из Crowdin |
| `crowdin status` | Показывает прогресс перевода по языкам |
| `crowdin list sources` | Показывает, какие файлы Crowdin видит как source |

### Настройки проекта в веб-интерфейсе Crowdin

После создания проекта зайдите в **Settings** и настройте:

1. **General → Source strings context**: Включите — переводчики будут видеть комментарии к ключам
2. **Export → Export file format**: JSON (должно быть по умолчанию)
3. **Quality Assurance**: Включите проверки:
   - **Missing placeholders** — если переводчик забыл `{{name}}`, Crowdin предупредит
   - **Extra whitespace** — лишние пробелы
   - **Empty translations** — пустые переводы
4. **Translation Memory (TM)**: Включите — Crowdin запоминает переводы и предлагает их для похожих строк
5. **Machine Translation**: Можно подключить Google Translate или DeepL как подсказку для переводчиков (опционально)

### Глоссарий

Создайте глоссарий D&D-терминов в Crowdin (**Resources → Glossary**). Это таблица "термин → утверждённый перевод":

| English | Russian | Комментарий |
|---------|---------|-------------|
| Strength | Сила | Характеристика |
| Dexterity | Ловкость | Характеристика |
| Hit Points | Хиты | Сокращение: HP |
| Spell Slot | Ячейка заклинаний | |
| Cantrip | Заговор | 0-й круг заклинаний |
| Proficiency Bonus | Бонус мастерства | |
| Saving Throw | Спасбросок | |
| Armor Class | Класс доспеха | Сокращение: КД |
| Initiative | Инициатива | |

Когда переводчик работает со строкой, Crowdin подсвечивает термины из глоссария — это снижает количество ошибок.

### Скриншоты для контекста

Crowdin позволяет загружать скриншоты и привязывать к ним ключи. Переводчик видит, ГДЕ в интерфейсе отображается строка — это очень помогает:

1. Сделайте скриншоты основных экранов приложения
2. В Crowdin: **Resources → Screenshots → Upload**
3. Привяжите строки к элементам на скриншоте (drag & drop)

---

## 13. Интеграция Crowdin с GitHub

### Зачем это нужно

Без интеграции процесс ручной:
1. Вы добавили строку → `crowdin upload sources`
2. Переводчик перевёл → `crowdin download`
3. Вы коммитите переводы

С интеграцией всё автоматически:
1. Вы пушите код в `main` → Crowdin сам подхватывает новые строки
2. Переводчик перевёл → Crowdin сам создаёт PR с переводами
3. Вы просто мержите PR

### Вариант A: Нативная GitHub-интеграция (рекомендуется, проще)

1. В Crowdin: **Integrations → GitHub**
2. Авторизуйте Crowdin в вашем GitHub
3. Выберите репозиторий `dnd-character-manager`
4. Настройте:
   - **Branch for sync**: `main`
   - **Service branch name**: `l10n_main` (Crowdin создаст эту ветку для PR)
   - **Configuration file**: `crowdin.yml` (он найдёт его в корне)
   - **Update source files**: отметьте (при пуше в main обновляются source-файлы)
   - **Push translations**: отметьте (переводы пушатся обратно как PR)

Crowdin будет:
- При каждом пуше в `main` — проверять `en/*.json` на новые строки
- При появлении новых переводов — обновлять ветку `l10n_main` и PR

### Вариант B: GitHub Actions (больше контроля)

Создайте файл `.github/workflows/crowdin.yml`:

```yaml
name: Crowdin Sync

on:
  push:
    branches: [main]
    paths:
      - 'src/i18n/locales/en/**'

jobs:
  synchronize-with-crowdin:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Crowdin Action
        uses: crowdin/github-action@v2
        with:
          upload_sources: true
          download_translations: true
          create_pull_request: true
          pull_request_title: 'chore(i18n): new translations from Crowdin'
          pull_request_base_branch_name: 'main'
          localization_branch_name: 'l10n_main'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          CROWDIN_PROJECT_ID: ${{ secrets.CROWDIN_PROJECT_ID }}
          CROWDIN_PERSONAL_TOKEN: ${{ secrets.CROWDIN_PERSONAL_TOKEN }}
```

**Как добавить секреты в GitHub:**
1. Зайдите в репозиторий → **Settings → Secrets and variables → Actions**
2. Добавьте `CROWDIN_PROJECT_ID` и `CROWDIN_PERSONAL_TOKEN`

> **Совет:** Начните с Варианта A — он проще в настройке и не требует знания GitHub Actions. Переключитесь на B, только если нужна более тонкая настройка.

---

## 14. Переключатель языка в UI

### Простой переключатель

```tsx
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    // Переключаем между ru и en
    const newLang = i18n.language === 'ru' ? 'en' : 'ru';
    i18n.changeLanguage(newLang);
    // i18next-browser-languagedetector автоматически сохранит выбор в localStorage
  };

  return (
    <button
      onClick={toggleLanguage}
      className="flex items-center gap-1 px-2 py-1 rounded hover:bg-white/10"
      title="Switch language"
    >
      <Globe size={16} />
      <span className="text-sm uppercase">{i18n.language}</span>
    </button>
  );
}
```

### Где разместить

Добавьте в навигационную панель (`TopNavBar` или `App.tsx`) — рядом с табами или в правом углу.

### Для более чем 2 языков

Если добавите больше языков, замените toggle на выпадающий список:

```tsx
function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const languages = [
    { code: 'en', label: 'English' },
    { code: 'ru', label: 'Русский' },
    // { code: 'de', label: 'Deutsch' },
  ];

  return (
    <select
      value={i18n.language}
      onChange={(e) => i18n.changeLanguage(e.target.value)}
      className="bg-transparent text-sm"
    >
      {languages.map(lang => (
        <option key={lang.code} value={lang.code}>{lang.label}</option>
      ))}
    </select>
  );
}
```

### Что происходит при смене языка

1. `i18n.changeLanguage('en')` — i18next переключает активный язык
2. `LanguageDetector` сохраняет выбор в `localStorage` (ключ `i18nextLng`)
3. Все компоненты с `useTranslation()` автоматически перерисовываются с новыми строками
4. При следующем визите пользователь сразу увидит выбранный язык

---

## 15. TypeScript — строгая типизация ключей

### Зачем это нужно

Без типизации:
```tsx
t('buttns.dlete')  // Опечатка — TypeScript не ругается, в рантайме показывает ключ
```

С типизацией:
```tsx
t('buttns.dlete')  // TypeScript ошибка: "buttns.dlete" не существует в common.json
t('buttons.delete') // ✓ Автодополнение подсказывает
```

### Файл декларации

Создайте `src/i18n/i18next.d.ts`:

```typescript
import 'i18next';

// Импортируем типы из исходных (английских) файлов
import type common from './locales/en/common.json';
import type character from './locales/en/character.json';
import type spells from './locales/en/spells.json';
import type combat from './locales/en/combat.json';
import type inventory from './locales/en/inventory.json';
import type glossary from './locales/en/glossary.json';
import type game from './locales/en/game.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof common;
      character: typeof character;
      spells: typeof spells;
      combat: typeof combat;
      inventory: typeof inventory;
      glossary: typeof glossary;
      game: typeof game;
    };
  }
}
```

### Что это даёт

- `t('nav.characters')` — IDE подсказывает все доступные ключи
- `t('nav.typo')` — TypeScript ошибка на этапе компиляции
- `t('abilities.strength', { ns: 'game' })` — подсказки для ключей из других namespace'ов

### Требование в tsconfig

Убедитесь, что в `tsconfig.app.json` есть:

```json
{
  "compilerOptions": {
    "resolveJsonModule": true,
    "esModuleInterop": true
  }
}
```

Скорее всего оба параметра уже включены (Vite-проект), но проверьте.

---

## 16. Подводные камни и частые ошибки

### 16.1 Конкатенация строк — главный враг i18n

**ПЛОХО:**
```tsx
<span>{'Уровень ' + level + ' ' + className}</span>
<span>{`${character.name} — уровень ${character.level}`}</span>
```

**ХОРОШО:**
```json
{ "levelInfo": "Level {{level}} {{className}}" }
```
```tsx
<span>{t('levelInfo', { level, className })}</span>
```

**Почему:** В разных языках порядок слов разный:
- EN: "Level 5 Wizard"
- RU: "Волшебник 5-го уровня"
- JA: "レベル5のウィザード"

Конкатенация фиксирует порядок — переводчик не сможет его изменить.

### 16.2 Динамические ключи — Crowdin не увидит

```tsx
// Crowdin CLI при сканировании кода НЕ найдёт эти ключи
t(`rarity.${item.rarity}`)
t(`abilities.${ability}`)
```

Это **работает в рантайме**, но при автоматическом извлечении ключей (если настроите) Crowdin не поймёт, что `rarity.common`, `rarity.rare` и т.д. нужно переводить.

**Решение:** Убедитесь, что все динамические ключи присутствуют в JSON-файлах. Добавьте комментарий рядом для документации:

```tsx
// i18n: game:rarity.common, game:rarity.uncommon, game:rarity.rare,
//       game:rarity.very_rare, game:rarity.legendary, game:rarity.artifact
t(`rarity.${item.rarity}`, { ns: 'game' })
```

### 16.3 HTML внутри переводов

Иногда нужно вставить жирный текст, ссылку или иконку внутри переведённой строки.

**Используйте компонент `<Trans>`:**

```json
{
  "criticalHit": "Critical hit! Damage: <bold>{{damage}}</bold>"
}
```

```tsx
import { Trans } from 'react-i18next';

<Trans
  i18nKey="combat:criticalHit"
  values={{ damage: 24 }}
  components={{ bold: <strong className="text-red-500" /> }}
/>
// Результат: "Critical hit! Damage: <strong>24</strong>"
```

> **Предупреждение:** Не вставляйте настоящий HTML в JSON-файлы переводов! Это уязвимость XSS. Используйте только именованные компоненты через `components` prop.

### 16.4 Пробелы и форматирование

Crowdin может обрезать пробелы в начале/конце строки. Не полагайтесь на них:

```json
// ПЛОХО:
{ "prefix": "Уровень: " }  // Пробел в конце может потеряться

// ХОРОШО:
{ "levelLabel": "Level: {{value}}" }  // Пробел внутри строки — безопасен
```

### 16.5 Одно слово — разные значения (контекст)

Слово "Level" может означать "Уровень" (персонажа) или "Круг" (заклинания). Используйте суффикс контекста:

```json
// en/common.json
{
  "level": "Level",
  "level_spell": "Spell Level"
}
```

```tsx
t('level')                          // "Level" (персонажа)
t('level', { context: 'spell' })    // "Spell Level" (заклинания)
```

Crowdin покажет это как 2 отдельные строки для перевода.

### 16.6 Числа и даты

i18next не форматирует числа и даты. Используйте нативный `Intl`:

```typescript
// Форматирование чисел по локали
const formatter = new Intl.NumberFormat(i18n.language);
formatter.format(1234);  // "1,234" (en) vs "1 234" (ru)
```

### 16.7 Не переводите ключи объектов

```json
// ПЛОХО — ключи на русском:
{
  "Сила": "Strength"
}

// ХОРОШО — ключи на английском:
{
  "strength": "Strength"
}
```

Ключи — это идентификаторы в коде, они должны быть на английском, стабильными и не содержать спецсимволов.

### 16.8 Длина строк

Немецкие и французские переводы обычно на 20-30% длиннее английских. Русские — примерно такие же или чуть длиннее. Убедитесь, что UI не ломается при длинных строках:

- Используйте Tailwind-классы `truncate`, `line-clamp-2`
- Тестируйте с псевдолокализацией (см. раздел 17)
- Проверяйте кнопки — "Export" (6 букв) vs "Экспортировать" (16 букв)

### 16.9 Не забывайте про `title` и `aria-label`

Легко пропустить атрибуты доступности:

```tsx
// Легко забыть:
<button title="Сбросить" aria-label="Удалить элемент">
  <X size={16} />
</button>

// Тоже нужно переводить:
<button title={t('buttons.reset')} aria-label={t('buttons.deleteItem')}>
  <X size={16} />
</button>
```

---

## 17. Тестирование локализации

### Способ 1: Псевдолокализация

Псевдолокализация заменяет символы на похожие, но заметные: "Characters" → "[Ĉĥàŕàĉţéŕš]". Это позволяет:
- Найти строки, которые забыли вынести в JSON (они останутся без скобок)
- Проверить, что UI не ломается при длинных строках (псевдо-текст длиннее)

**Простой способ:** Временно поменяйте `fallbackLng` на несуществующий язык:

```typescript
i18n.init({
  fallbackLng: 'xx',  // Нет такого языка → покажутся ключи
});
```

Если в UI вместо текста видите `common:buttons.delete` — значит i18n работает. Если видите "Удалить" — значит эта строка ещё не вынесена.

### Способ 2: Ручное переключение

1. Добавьте переключатель языка (раздел 14)
2. Переключитесь на английский
3. Пройдитесь по всем экранам
4. Если видите русский текст — эта строка ещё не вынесена

### Способ 3: Grep по кириллице

Найдите оставшиеся захардкоженные русские строки:

```bash
# В компонентах (tsx)
grep -rn "[а-яА-ЯёЁ]" src/components/ --include="*.tsx"

# В утилитах (ts)
grep -rn "[а-яА-ЯёЁ]" src/utils/ --include="*.ts"
```

Всё, что найдётся (кроме комментариев) — потенциально нужно вынести.

---

## 18. Чеклист перед запуском

### Инфраструктура
- [ ] Установлены `i18next`, `react-i18next`, `i18next-browser-languagedetector`
- [ ] Создан `src/i18n/index.ts` с конфигурацией
- [ ] Импорт `'./i18n'` добавлен в `main.tsx` ДО импорта `App`
- [ ] Создана структура `src/i18n/locales/en/*.json` и `ru/*.json`
- [ ] Билд проходит: `npm run build`

### Перевод строк
- [ ] Все русские строки из `.tsx`-компонентов вынесены в JSON-файлы
- [ ] Все `title`, `placeholder`, `aria-label` атрибуты переведены
- [ ] Константы (`SKILL_NAMES`, `ABILITY_NAMES` и т.д.) рефакторены
- [ ] Нет конкатенации строк — везде интерполяция `{{переменных}}`
- [ ] Плюрализация настроена для русского (3 формы: `_one`, `_few`, `_many`)
- [ ] `grep` по кириллице в `src/components/` не находит захардкоженных строк

### Crowdin
- [ ] Проект создан в Crowdin (source = English)
- [ ] `crowdin.yml` создан и проверен: `crowdin lint`
- [ ] Source-файлы загружены: `crowdin upload sources`
- [ ] Русские переводы загружены: `crowdin upload translations -l ru --auto-approve`
- [ ] GitHub-интеграция настроена (Вариант A или B)
- [ ] Глоссарий D&D-терминов создан
- [ ] (Опционально) Скриншоты загружены для контекста

### UI
- [ ] Переключатель языка добавлен в интерфейс
- [ ] Переключение ru ↔ en работает корректно
- [ ] Выбранный язык сохраняется после перезагрузки страницы

### TypeScript
- [ ] Создан `src/i18n/i18next.d.ts`
- [ ] Автодополнение ключей работает в IDE
- [ ] `npm run type-check` проходит без ошибок

### .gitignore
- [ ] `.env` в `.gitignore` (если используете для токенов)
- [ ] Токен Crowdin НЕ закоммичен в репозиторий

---

## 19. Полезные ссылки

### Документация
- [i18next — официальная документация](https://www.i18next.com/)
- [react-i18next — документация](https://react.i18next.com/)
- [Crowdin — документация](https://support.crowdin.com/)
- [Crowdin CLI — документация](https://crowdin.github.io/crowdin-cli/)
- [Crowdin GitHub Integration](https://support.crowdin.com/github-integration/)
- [Crowdin GitHub Action](https://github.com/crowdin/github-action)

### Туториалы
- [i18next + React — пошаговый гайд](https://react.i18next.com/getting-started)
- [i18next — плюрализация](https://www.i18next.com/translation-function/plurals)
- [i18next — интерполяция](https://www.i18next.com/translation-function/interpolation)
- [i18next — TypeScript](https://www.i18next.com/overview/typescript)

### Русская плюрализация
- [Правила плюрализации по языкам (Unicode CLDR)](https://www.unicode.org/cldr/charts/latest/supplemental/language_plural_rules.html)
- Русский: `one` (1, 21, 31...), `few` (2-4, 22-24...), `many` (0, 5-20, 25-30...)

---

## Итого

| Что | Объём |
|-----|-------|
| UI-строк для перевода | ~300-350 уникальных |
| PR'ов для полного рефакторинга | 7-8 |
| Файлов переводов (namespaces) | 7 |
| Новых npm-зависимостей | 3 |
| Конфигурационных файлов | 3 (`i18n/index.ts`, `i18next.d.ts`, `crowdin.yml`) |

Начните с Этапа 1 (инфраструктура + 1 компонент) и убедитесь, что всё работает end-to-end. Только потом разворачивайте на остальной проект.
