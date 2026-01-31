# Работа с данными 5etools

Это руководство объясняет, как работать с JSON данными из 5etools в этом приложении.

## 📚 Структура данных 5etools

### Типы данных

В папке `src/data/` хранятся JSON файлы с данными из 5etools:

- `spells/` - Заклинания
- `classes/` - Классы
- `races/` - Расы  
- `items/` - Предметы и экипировка
- `monsters/` - Монстры (для DM)

### Пример: Заклинание

В `src/data/spells/acid_splash.json` находится пример заклинания "Acid Splash".

Структура JSON:
```json
{
  "name": "Acid Splash",           // Название
  "level": 0,                      // Уровень (0 = заговор)
  "school": "V",                   // Школа магии (V = Evocation)
  "time": [...],                   // Время накладывания
  "range": {...},                  // Дистанция
  "components": {                  // Компоненты
    "v": true,                     // Вербальный
    "s": true,                     // Соматический
    "m": "..."                     // Материальный
  },
  "duration": [...],               // Длительность
  "entries": [...],                // Описание заклинания
  "damageInflict": ["acid"],       // Тип урона
  "savingThrow": ["dexterity"],    // Спасбросок
  "classes": {...}                 // Доступно классам
}
```

## 🔧 Загрузка данных в приложение

### Способ 1: Импорт в компонент

```typescript
import spellData from '../data/spells/acid_splash.json';
import { Spell } from '../types';

const spell: Spell = spellData as Spell;
```

### Способ 2: Динамическая загрузка

```typescript
// utils/dataLoader.ts
export const loadSpells = async (): Promise<Spell[]> => {
  // Загрузить все файлы заклинаний
  const spellFiles = import.meta.glob('../data/spells/*.json');
  
  const spells: Spell[] = [];
  for (const path in spellFiles) {
    const module = await spellFiles[path]() as any;
    spells.push(module.default);
  }
  
  return spells;
};
```

### Способ 3: Создание индекса

Создайте `src/data/spells/index.ts`:

```typescript
import acidSplash from './acid_splash.json';
import firebal from './fireball.json';
// ... другие заклинания

export const spells = [
  acidSplash,
  fireball,
  // ...
];

export default spells;
```

Затем в компоненте:
```typescript
import spells from '../data/spells';
```

## 🎨 Создание компонента для заклинаний

### Простой компонент списка заклинаний

```typescript
// components/SpellList.tsx
import React, { useState, useEffect } from 'react';
import { Spell } from '../types';

export const SpellList: React.FC = () => {
  const [spells, setSpells] = useState<Spell[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSpells();
  }, []);

  const loadSpells = async () => {
    try {
      // Загрузка всех файлов заклинаний
      const spellFiles = import.meta.glob('../data/spells/*.json');
      const loadedSpells: Spell[] = [];

      for (const path in spellFiles) {
        const module = await spellFiles[path]() as any;
        loadedSpells.push(module.default);
      }

      setSpells(loadedSpells);
    } catch (error) {
      console.error('Ошибка загрузки заклинаний:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Загрузка...</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Заклинания</h2>
      {spells.map((spell, index) => (
        <div key={index} className="p-4 border rounded">
          <h3 className="text-xl font-semibold">{spell.name}</h3>
          <p>Уровень: {spell.level === 0 ? 'Заговор' : spell.level}</p>
          <div className="mt-2">
            {spell.entries.map((entry, i) => (
              <p key={i}>{entry}</p>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
```

### Компонент карточки заклинания

```typescript
// components/SpellCard.tsx
import React from 'react';
import { Spell } from '../types';

interface SpellCardProps {
  spell: Spell;
  onSelect?: (spell: Spell) => void;
}

export const SpellCard: React.FC<SpellCardProps> = ({ spell, onSelect }) => {
  const getSchoolName = (school: string) => {
    const schools: Record<string, string> = {
      'V': 'Воплощение',
      'A': 'Преобразование',
      'N': 'Некромантия',
      'I': 'Иллюзия',
      'E': 'Очарование',
      'C': 'Прорицание',
      'T': 'Преобразование',
      'D': 'Ограждение'
    };
    return schools[school] || school;
  };

  const getComponents = () => {
    const comp = [];
    if (spell.components.v) comp.push('В');
    if (spell.components.s) comp.push('С');
    if (spell.components.m) comp.push('М');
    return comp.join(', ');
  };

  return (
    <div 
      className="bg-white p-4 rounded-lg shadow border-2 border-gray-200 hover:border-blue-500 cursor-pointer"
      onClick={() => onSelect?.(spell)}
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-lg font-bold">{spell.name}</h3>
        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
          {spell.level === 0 ? 'Заговор' : `${spell.level} ур.`}
        </span>
      </div>

      <div className="text-sm text-gray-600 mb-3">
        <div>Школа: {getSchoolName(spell.school)}</div>
        <div>Компоненты: {getComponents()}</div>
        {spell.time && (
          <div>
            Время: {spell.time[0].number} {spell.time[0].unit}
          </div>
        )}
        {spell.range && (
          <div>
            Дистанция: {spell.range.distance?.amount || 0} фт.
          </div>
        )}
      </div>

      <div className="text-sm">
        {spell.entries[0]}
      </div>

      {spell.damageInflict && (
        <div className="mt-2 flex gap-2">
          {spell.damageInflict.map(type => (
            <span 
              key={type}
              className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs"
            >
              {type}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
```

## 🔍 Фильтрация и поиск

### Компонент с поиском и фильтрами

```typescript
// components/SpellBrowser.tsx
import React, { useState, useMemo } from 'react';
import { Spell } from '../types';
import { SpellCard } from './SpellCard';

export const SpellBrowser: React.FC<{ spells: Spell[] }> = ({ spells }) => {
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<number | 'all'>('all');
  const [schoolFilter, setSchoolFilter] = useState<string>('all');

  const filteredSpells = useMemo(() => {
    return spells.filter(spell => {
      // Поиск по названию
      if (search && !spell.name.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }

      // Фильтр по уровню
      if (levelFilter !== 'all' && spell.level !== levelFilter) {
        return false;
      }

      // Фильтр по школе
      if (schoolFilter !== 'all' && spell.school !== schoolFilter) {
        return false;
      }

      return true;
    });
  }, [spells, search, levelFilter, schoolFilter]);

  return (
    <div className="space-y-4">
      {/* Фильтры */}
      <div className="grid grid-cols-3 gap-4">
        <input
          type="text"
          placeholder="Поиск заклинаний..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 border rounded"
        />

        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
          className="px-3 py-2 border rounded"
        >
          <option value="all">Все уровни</option>
          <option value="0">Заговоры</option>
          {[1,2,3,4,5,6,7,8,9].map(level => (
            <option key={level} value={level}>{level} уровень</option>
          ))}
        </select>

        <select
          value={schoolFilter}
          onChange={(e) => setSchoolFilter(e.target.value)}
          className="px-3 py-2 border rounded"
        >
          <option value="all">Все школы</option>
          <option value="V">Воплощение</option>
          <option value="A">Преобразование</option>
          {/* ... другие школы */}
        </select>
      </div>

      {/* Список заклинаний */}
      <div className="grid grid-cols-2 gap-4">
        {filteredSpells.map((spell, index) => (
          <SpellCard key={index} spell={spell} />
        ))}
      </div>
    </div>
  );
};
```

## 🌐 Перевод данных

### Использование Claude для перевода

```bash
# Пример использования Claude Code для перевода
claude-code "Переведи содержимое файла fireball.json на русский, сохрани структуру JSON"
```

### Ручной перевод

Ключевые поля для перевода:
- `name` - Название
- `entries` - Описание заклинания (массив строк)
- `entriesHigherLevel` - Описание на высоких уровнях

Не переводите:
- Технические поля (`source`, `page`, `level`, и т.д.)
- Значения в `components`, `damageInflict`, `savingThrow`

## 📋 Чек-лист добавления новых данных

- [ ] Скачать JSON файл из 5etools
- [ ] Перевести текстовые поля на русский
- [ ] Проверить корректность JSON (можно использовать jsonlint.com)
- [ ] Поместить в соответствующую папку (`src/data/spells/`, `src/data/classes/`, и т.д.)
- [ ] Обновить импорты, если используется индексный файл
- [ ] Протестировать загрузку в приложении

## 🔗 Полезные ссылки

- [5etools](https://5e.tools/) - Источник данных
- [D&D Beyond](https://www.dndbeyond.com/) - Справочник для перевода
- [JSON Lint](https://jsonlint.com/) - Валидация JSON
- [VS Code JSON Tools](https://code.visualstudio.com/docs/languages/json) - Работа с JSON в VS Code

---

**Удачи в добавлении данных! 📚**
