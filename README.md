<!-- i18n:badges:start -->
![i18n RU](https://img.shields.io/badge/i18n%20RU-81.3%25-yellowgreen)

![actions](https://img.shields.io/badge/actions-100%25-brightgreen) ![conditionsdiseases](https://img.shields.io/badge/conditionsdiseases-100%25-brightgreen) ![creatures](https://img.shields.io/badge/creatures-100%25-brightgreen) ![itemproperties](https://img.shields.io/badge/itemproperties-100%25-brightgreen) ![items-base](https://img.shields.io/badge/items--base-100%25-brightgreen) ![senses](https://img.shields.io/badge/senses-100%25-brightgreen) ![skills](https://img.shields.io/badge/skills-100%25-brightgreen) ![subclasses](https://img.shields.io/badge/subclasses-99.9%25-green) ![optionalfeatures](https://img.shields.io/badge/optionalfeatures-98.5%25-green) ![spells](https://img.shields.io/badge/spells-97.3%25-green) ![classes](https://img.shields.io/badge/classes-96.9%25-green) ![species](https://img.shields.io/badge/species-91.6%25-green) ![feats](https://img.shields.io/badge/feats-89.9%25-green) ![variantrule](https://img.shields.io/badge/variantrule-86%25-green) ![charactercreationoptions](https://img.shields.io/badge/charactercreationoptions-85.9%25-green) ![backgrounds](https://img.shields.io/badge/backgrounds-52.1%25-yellow)
<!-- i18n:badges:end -->

# D&D Character Manager

Веб-приложение для создания и ведения персонажей Dungeons & Dragons 5e. Поддерживает создание персонажа пошаговым мастером, лист персонажа, инвентарь, заклинания, броски кубов, глоссарий игровых правил и локализацию RU/EN.

## Возможности

- Мастер создания персонажа: раса, класс, предыстория, характеристики, черты, заклинания, снаряжение.
- Лист персонажа с вкладками: боёвка, заклинания, инвентарь, отыгрыш, кубы.
- Инвентарь с сеткой слотов и портретом персонажа.
- Подготовка и использование заклинаний, повышение уровня заклинателя, свапы заклинаний от черт.
- Встроенный глоссарий: классы, подклассы, виды, черты, предметы, заклинания, умения, условия.
- Хранение персонажей в `localStorage`, импорт и экспорт JSON.
- Локализация (RU/EN) интерфейса и игровых данных через i18next.

## Стек

- React 19 + TypeScript
- Vite 7
- Tailwind CSS 4
- i18next + react-i18next
- lucide-react (иконки)

## Быстрый старт

Требуется Node.js 20+.

```bash
npm install
npm run dev
```

Приложение откроется на `http://localhost:5173`.

На Windows можно запустить `start.bat` — он установит зависимости и поднимет dev-сервер.

## Скрипты npm

| Команда | Назначение |
| --- | --- |
| `npm run dev` | Dev-сервер Vite с HMR. |
| `npm run build` | Проверка типов (`tsc -b`) и production-сборка в `dist/`. |
| `npm run preview` | Локальный просмотр собранного билда. |
| `npm run lint` | Проверка кода ESLint. |
| `npm run type-check` | Проверка типов без сборки. |
| `npm run i18n:extract` | Извлечение строк из игровых JSON-данных в `src/i18n/gamedata/<lang>/`. |
| `npm run i18n:status` | Пересчитать прогресс перевода и обновить таблицу в README. |

## Структура проекта

```
src/
  components/        компоненты UI (CharacterCreator, CharacterSheet, …)
  data/              игровые данные 5e и registry-загрузчик
  hooks/             useCharacters и другие хуки
  i18n/
    index.ts         инициализация i18next
    locales/<lang>/  строки интерфейса
    gamedata/<lang>/ локализованные игровые данные
  types/             TypeScript-типы доменных сущностей
  utils/             storage, экспорт/импорт, вспомогательные функции
scripts/
  i18n-extract.mjs   извлечение переводимых строк из игровых данных
  i18n-status.mjs    пересчёт прогресса перевода и обновление README
```

## Локализация

Поддерживаемые языки: английский (исходный) и русский. Строки интерфейса лежат в `src/i18n/locales/<lang>/`, локализованные игровые данные — в `src/i18n/gamedata/<lang>/`.

После добавления переводов запустите:

```bash
npm run i18n:status
```

Скрипт пересчитает прогресс по всем файлам игровых данных и обновит секцию ниже.

<!-- i18n:status:start -->
Прогресс перевода игровых данных на русский язык. Цифры обновляются скриптом `npm run i18n:status`. Файл `items.json` исключён из подсчёта (имена предметов локализуются на уровне рендера).

| Файл | Прогресс | Переведено / Всего |
|---|---|---:|
| `actions.json` | `██████████████████` 100% | 165 / 165 |
| `conditionsdiseases.json` | `██████████████████` 100% | 280 / 280 |
| `creatures.json` | `██████████████████` 100% | 106 / 106 |
| `itemproperties.json` | `██████████████████` 100% | 29 / 29 |
| `items-base.json` | `██████████████████` 100% | 264 / 264 |
| `senses.json` | `██████████████████` 100% | 19 / 19 |
| `skills.json` | `██████████████████` 100% | 36 / 36 |
| `subclasses.json` | `██████████████████` 99.9% | 2599 / 2602 |
| `optionalfeatures.json` | `██████████████████` 98.5% | 2202 / 2236 |
| `spells.json` | `██████████████████` 97.3% | 3839 / 3946 |
| `classes.json` | `█████████████████░` 96.9% | 1205 / 1244 |
| `species.json` | `████████████████░░` 91.6% | 1902 / 2077 |
| `feats.json` | `████████████████░░` 89.9% | 1597 / 1776 |
| `variantrule.json` | `███████████████░░░` 86% | 1805 / 2098 |
| `charactercreationoptions.json` | `███████████████░░░` 85.9% | 942 / 1096 |
| `backgrounds.json` | `█████████░░░░░░░░░` 52.1% | 4236 / 8123 |
| **Всего** | `███████████████░░░` **81.3%** | **21226 / 26097** |
<!-- i18n:status:end -->

## Хранение данных

Персонажи сохраняются в `localStorage` браузера. Кнопки импорта и экспорта позволяют переносить персонажей между устройствами в виде JSON-файла. Серверной части нет — приложение полностью клиентское.

## Лицензия

Не определена. Игровые данные D&D 5e принадлежат Wizards of the Coast и используются в соответствии с их условиями.
