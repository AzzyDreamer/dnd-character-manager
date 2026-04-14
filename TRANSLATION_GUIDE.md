# Translation Guide / Руководство для переводчиков

## Что переводить

Переводите весь текст **вокруг** тегов `{@...}`. Сами теги — это специальная разметка, которая превращается в кликабельные ссылки и игровые значения в приложении.

---

## Теги: как с ними работать

### Теги-ссылки (не удалять, можно добавить третий параметр)

Формат: `{@тип Название|Источник}`

| Тег | Пример | Что показывает |
|-----|--------|----------------|
| `@spell` | `{@spell Fireball\|XPHB}` | Ссылка на заклинание |
| `@item` | `{@item Dagger\|XPHB}` | Ссылка на предмет |
| `@condition` | `{@condition Charmed\|XPHB}` | Ссылка на состояние |
| `@variantrule` | `{@variantrule Long Rest\|XPHB}` | Ссылка на правило |
| `@action` | `{@action Bonus Action\|XPHB}` | Ссылка на действие |
| `@feat` | `{@feat Alert\|XPHB}` | Ссылка на черту |
| `@skill` | `{@skill Athletics}` | Ссылка на навык |
| `@optfeature` | `{@optfeature Agonizing Blast}` | Ссылка на способность |
| `@class` | `{@class Wizard}` | Ссылка на класс |
| `@subclass` | `{@subclass Berserker}` | Ссылка на подкласс |
| `@creature` | `{@creature Skeleton\|XMM}` | Ссылка на существо |
| `@disease` | `{@disease Sight Rot}` | Ссылка на болезнь |
| `@sense` | `{@sense Darkvision}` | Ссылка на чувство |
| `@status` | `{@status Concentration\|XPHB}` | Ссылка на статус |
| `@background` | `{@background Acolyte\|XPHB}` | Ссылка на предысторию |
| `@species` | `{@species Elf\|XPHB}` | Ссылка на вид |

### Склонение ссылок (третий параметр)

В русском языке нужны падежи. Используйте **третий параметр** тега для отображаемого текста:

```
Английский оригинал:
  You can make an {@variantrule Unarmed Strike|XPHB}.

Русский перевод:
  Вы можете совершить {@variantrule Unarmed Strike|XPHB|безоружный удар}.
```

Пользователь увидит: «Вы можете совершить **безоружный удар**» — кликабельная ссылка.

Ещё примеры:
```
с сопротивлением к {@condition Frightened|XPHB|Испугу}
при помощи {@item Thieves' Tools|XPHB|воровских инструментов}
после {@variantrule Long Rest|XPHB|продолжительного отдыха}
```

### Теги значений (не трогать вообще)

Эти теги отображают числа и кубики — переводить нечего:

| Тег | Пример | Что показывает |
|-----|--------|----------------|
| `@damage` | `{@damage 2d6}` | Урон: 2d6 |
| `@dice` | `{@dice 1d20+5}` | Бросок: 1d20+5 |
| `@dc` | `{@dc 15}` | СЛ 15 |
| `@hit` | `{@hit +7}` | +7 к попаданию |
| `@scaledamage` | `{@scaledamage 1d6\|1-9\|1d6}` | Масштабируемый урон |

### Теги форматирования

| Тег | Пример | Что показывает |
|-----|--------|----------------|
| `@b` | `{@b текст}` | **жирный** |
| `@i` | `{@i текст}` | *курсив* |
| `@note` | `{@note текст}` | Примечание |

Текст внутри `@b` и `@i` **переводится**.

### Теги книг (игнорируются)

`{@book Player's Handbook|PHB}` — приложение удаляет их при рендеринге. Не трогайте.

---

## Краткие правила

1. **Переводите** текст вокруг тегов
2. **Не удаляйте** теги `{@...}`
3. **Не меняйте** первые два параметра тега (название и источник)
4. **Добавляйте третий параметр** для склонения: `{@condition Charmed|XPHB|Очарованием}`
5. **Не трогайте** теги кубиков: `{@damage 1d8}`, `{@dc 15}`, `{@hit +5}`
6. **Переводите** текст внутри `{@b}` и `{@i}`
7. **Сохраняйте** переменные `{{name}}`, `{{count}}`, `{{level}}` как есть

---

## Примеры полных переводов

### Пример 1: Заклинание

**Оригинал:**
```
You create an acidic bubble at a point within range, where it explodes
in a 5-foot-radius {@variantrule Sphere [Area of Effect]|XPHB|Sphere}.
Each creature in that Sphere must succeed on a Dexterity saving throw
or take {@damage 1d6} Acid damage.
```

**Перевод:**
```
Вы создаёте кислотный пузырь в точке в пределах дистанции, где он
взрывается в {@variantrule Sphere [Area of Effect]|XPHB|Сфере} радиусом
5 футов. Каждое существо в этой Сфере должно преуспеть в спасброске
Ловкости или получить {@damage 1d6} урона Кислотой.
```

### Пример 2: Способность класса

**Оригинал:**
```
If you use {@feat Reckless Attack} while your {@variantrule Rage|XPHB}
is active, you deal extra damage to the first target you hit on your
turn with a Strength-based attack.
```

**Перевод:**
```
Если вы используете {@feat Reckless Attack|XPHB|Безрассудную атаку},
пока ваша {@variantrule Rage|XPHB|Ярость} активна, вы наносите
дополнительный урон первой цели, которую поразите в свой ход атакой,
основанной на Силе.
```

### Пример 3: UI-строка с переменными

**Оригинал:**
```
Level {{level}} Wizard
```

**Перевод:**
```
Волшебник {{level}}-го уровня
```

---

## Глоссарий ключевых терминов

| English | Russian |
|---------|---------|
| Strength | Сила |
| Dexterity | Ловкость |
| Constitution | Телосложение |
| Intelligence | Интеллект |
| Wisdom | Мудрость |
| Charisma | Харизма |
| Hit Points (HP) | Хиты |
| Armor Class (AC) | Класс Доспеха (КД) |
| Saving Throw | Спасбросок |
| Proficiency Bonus | Бонус Мастерства |
| Spell Slot | Ячейка Заклинаний |
| Cantrip | Заговор |
| Concentration | Концентрация |
| Long Rest | Продолжительный Отдых |
| Short Rest | Короткий Отдых |
| Bonus Action | Бонусное Действие |
| Reaction | Реакция |
| Advantage | Преимущество |
| Disadvantage | Помеха |
| Resistance | Сопротивление |
| Immunity | Иммунитет |
| Unarmed Strike | Безоружный Удар |
| Attunement | Настройка |
| Initiative | Инициатива |
