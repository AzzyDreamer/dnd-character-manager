# D&D 5e Character Manager

Веб-приложение для создания и управления персонажами в D&D 5e с поддержкой JSON данных из 5etools (переведенных на русский).

## 🎲 Возможности

- ✨ Создание персонажей с полной настройкой характеристик
- 📊 Отслеживание HP, инвентаря, заклинаний
- 💾 Локальное хранение (работает оффлайн)
- 🔄 Поддержка нескольких персонажей
- 📥 Импорт/экспорт персонажей в JSON
- 🎨 Красивый UI в стиле D&D
- 🇷🇺 Полная локализация на русский язык

## 🚀 Установка и запуск

### Предварительные требования

- Node.js (версия 18 или выше) - [Скачать здесь](https://nodejs.org/)
- Git - [Скачать здесь](https://git-scm.com/download/win)

### Первый запуск

1. **Клонируйте репозиторий** (или скачайте ZIP)
```bash
git clone <URL_вашего_репозитория>
cd dnd-character-manager
```

2. **Установите зависимости**
```bash
npm install
```

3. **Запустите приложение**
```bash
npm run dev
```

4. **Откройте в браузере**
   - Приложение запустится на `http://localhost:5173`
   - Просто откройте эту ссылку в вашем браузере

### Остановка приложения

Нажмите `Ctrl+C` в терминале где запущен `npm run dev`

## 📁 Структура проекта

```
dnd-character-manager/
├── src/
│   ├── components/          # React компоненты
│   │   ├── CharacterCreator.tsx
│   │   ├── CharacterSheet.tsx
│   │   └── CharacterList.tsx
│   ├── data/               # JSON файлы из 5etools
│   │   └── spells/         # Заклинания
│   ├── types/              # TypeScript типы
│   │   └── index.ts
│   ├── utils/              # Вспомогательные функции
│   │   ├── storage.ts      # Работа с localStorage
│   │   └── dnd.ts          # Вычисления D&D
│   ├── hooks/              # React hooks
│   │   └── useCharacters.ts
│   ├── App.tsx             # Главный компонент
│   └── main.tsx
├── public/                 # Статические файлы
├── package.json
└── README.md
```

## 📚 Добавление данных из 5etools

### Структура данных

Все JSON файлы из 5etools должны быть размещены в папке `src/data/`:

```
src/data/
├── spells/           # Заклинания
├── classes/          # Классы
├── races/            # Расы
├── items/            # Предметы
└── monsters/         # Монстры (опционально)
```

### Пример добавления заклинаний

1. Создайте папку для заклинаний:
```bash
mkdir -p src/data/spells
```

2. Добавьте переведенный JSON файл (например, `acid_splash.json`) в `src/data/spells/`

3. В будущем можно будет создать компонент для загрузки и отображения этих данных

## 🔧 Работа с Git и GitHub

### Настройка Git (первый раз)

```bash
# Настройте свое имя и email
git config --global user.name "Ваше Имя"
git config --global user.email "your.email@example.com"

# Создайте SSH ключ для GitHub (опционально, но рекомендуется)
ssh-keygen -t ed25519 -C "your.email@example.com"

# Скопируйте содержимое ключа
cat ~/.ssh/id_ed25519.pub
# Добавьте его на GitHub: Settings → SSH and GPG keys → New SSH key
```

### Создание репозитория на GitHub

1. Перейдите на [github.com](https://github.com) и войдите в аккаунт
2. Нажмите **New repository** (зеленая кнопка)
3. Заполните:
   - Repository name: `dnd-character-manager`
   - Description: "D&D 5e Character Manager"
   - Сделайте репозиторий **Private** или **Public**
4. **НЕ** ставьте галочку "Initialize with README"
5. Нажмите **Create repository**

### Связывание локального проекта с GitHub

```bash
# Инициализируйте git (если еще не сделано)
cd dnd-character-manager
git init

# Добавьте все файлы
git add .

# Сделайте первый коммит
git commit -m "Initial commit: D&D Character Manager"

# Добавьте remote (замените YOUR_USERNAME на ваше имя)
git remote add origin https://github.com/YOUR_USERNAME/dnd-character-manager.git

# Отправьте код на GitHub
git push -u origin main
```

### Основные команды Git

```bash
# Проверить статус изменений
git status

# Добавить изменения в staging
git add .                    # Все файлы
git add src/App.tsx          # Конкретный файл

# Сделать коммит
git commit -m "Описание изменений"

# Отправить на GitHub
git push

# Получить последние изменения
git pull

# Посмотреть историю коммитов
git log --oneline

# Отменить изменения в файле
git checkout -- filename

# Создать новую ветку
git checkout -b feature/new-feature

# Переключиться на другую ветку
git checkout main
```

## 🤖 Работа с Claude Code

Claude Code - это инструмент командной строки для автоматизации разработки с помощью Claude AI.

### Установка Claude Code

```bash
npm install -g @anthropic-ai/claude-code
```

### Первоначальная настройка

1. Получите API ключ от Anthropic:
   - Зайдите на [console.anthropic.com](https://console.anthropic.com)
   - Создайте API ключ

2. Настройте Claude Code:
```bash
claude-code init
# Введите ваш API ключ когда попросят
```

### Примеры использования

```bash
# Попросить Claude создать новый компонент
claude-code "Создай компонент для отображения списка заклинаний из JSON файла"

# Попросить исправить баг
claude-code "Исправь ошибку в файле src/components/CharacterSheet.tsx"

# Добавить новую функциональность
claude-code "Добавь возможность редактирования инвентаря персонажа"

# Оптимизация кода
claude-code "Оптимизируй производительность компонента CharacterCreator"

# Написать тесты
claude-code "Напиши тесты для utils/dnd.ts"
```

### Работа в интерактивном режиме

```bash
# Запустить интерактивную сессию
claude-code chat

# Теперь можете вести диалог с Claude о вашем проекте
```

### Полезные команды

```bash
# Показать помощь
claude-code --help

# Показать версию
claude-code --version

# Работа с конкретным файлом
claude-code -f src/App.tsx "Добавь комментарии к коду"

# Работа с несколькими файлами
claude-code -f "src/components/*.tsx" "Добавь TypeScript strict mode"
```

## 🛠️ Разработка

### Доступные скрипты

```bash
# Запуск в режиме разработки
npm run dev

# Сборка для продакшена
npm run build

# Предпросмотр production build
npm run preview

# Проверка TypeScript
npm run type-check
```

### Рекомендуемые расширения VS Code

- ESLint
- Prettier
- Tailwind CSS IntelliSense
- TypeScript and JavaScript Language Features

## 💡 Советы по использованию

### Хранение данных

- Все персонажи хранятся в `localStorage` браузера
- Данные сохраняются автоматически при каждом изменении
- Для резервного копирования используйте экспорт персонажей

### Импорт/Экспорт

- **Экспорт**: Нажмите кнопку скачивания рядом с персонажем
- **Импорт**: Нажмите "Импорт" и выберите .json файл

### Работа с 5etools данными

1. Скачайте данные из 5etools
2. Переведите их на русский (можно использовать Claude!)
3. Поместите в `src/data/`
4. Создайте соответствующие компоненты для отображения

## 🐛 Решение проблем

### Приложение не запускается

```bash
# Удалите node_modules и переустановите
rm -rf node_modules package-lock.json
npm install
```

### Порт 5173 занят

```bash
# Измените порт в vite.config.ts
# или закройте процесс на порту 5173
```

### Ошибки TypeScript

```bash
# Проверьте типы
npm run type-check
```

## 📝 Roadmap

- [ ] Интеграция с API 5etools
- [ ] Компонент выбора заклинаний
- [ ] Автоматический расчет AC
- [ ] Система бросков костей
- [ ] Темная тема
- [ ] Печать листа персонажа
- [ ] Мультиязычность
- [ ] Синхронизация между устройствами

## 🤝 Вклад в проект

Contributions are welcome! Пожалуйста:

1. Форкните репозиторий
2. Создайте feature ветку (`git checkout -b feature/AmazingFeature`)
3. Закоммитьте изменения (`git commit -m 'Add some AmazingFeature'`)
4. Запушьте в ветку (`git push origin feature/AmazingFeature`)
5. Откройте Pull Request

## 📄 Лицензия

MIT License - свободно используйте для личных и коммерческих проектов.

## 🙏 Благодарности

- [5etools](https://5e.tools/) - за отличные данные по D&D 5e
- [React](https://react.dev/) - UI библиотека
- [Vite](https://vitejs.dev/) - Build tool
- [Tailwind CSS](https://tailwindcss.com/) - CSS framework
- [Lucide React](https://lucide.dev/) - Иконки

## 📞 Контакты

Если у вас есть вопросы или предложения, создайте Issue на GitHub!

---

**Приятной игры! 🎲**
