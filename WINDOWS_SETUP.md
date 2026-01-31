# Инструкции для Windows 10

Этот файл содержит специфичные для Windows инструкции по настройке и запуску проекта.

## 📦 Установка необходимых программ

### 1. Node.js

1. Перейдите на https://nodejs.org/
2. Скачайте LTS версию (рекомендуется)
3. Запустите установщик и следуйте инструкциям
4. Проверьте установку:
   ```cmd
   node --version
   npm --version
   ```

### 2. Git для Windows

1. Перейдите на https://git-scm.com/download/win
2. Скачайте установщик
3. Запустите установщик:
   - Рекомендуется оставить настройки по умолчанию
   - В опции "Adjusting your PATH environment" выберите "Git from the command line and also from 3rd-party software"
4. Проверьте установку:
   ```cmd
   git --version
   ```

### 3. Visual Studio Code (рекомендуется)

1. Перейдите на https://code.visualstudio.com/
2. Скачайте и установите
3. Установите расширения:
   - ESLint
   - Prettier
   - Tailwind CSS IntelliSense

## 🚀 Запуск проекта на Windows

### Способ 1: Командная строка (CMD)

```cmd
cd C:\путь\к\проекту\dnd-character-manager
npm install
npm run dev
```

### Способ 2: PowerShell

```powershell
cd C:\путь\к\проекту\dnd-character-manager
npm install
npm run dev
```

### Способ 3: Git Bash (рекомендуется)

После установки Git for Windows у вас будет Git Bash:

```bash
cd /c/путь/к/проекту/dnd-character-manager
npm install
npm run dev
```

### Способ 4: VS Code встроенный терминал

1. Откройте папку проекта в VS Code
2. Нажмите ``Ctrl + ` `` для открытия терминала
3. Выполните команды:
   ```bash
   npm install
   npm run dev
   ```

## 🔧 Настройка Git на Windows

### Первоначальная настройка

Откройте Git Bash или CMD и выполните:

```bash
git config --global user.name "Ваше Имя"
git config --global user.email "your.email@example.com"
```

### Настройка SSH для GitHub (опционально)

1. Откройте Git Bash
2. Создайте SSH ключ:
   ```bash
   ssh-keygen -t ed25519 -C "your.email@example.com"
   ```
3. Нажимайте Enter для всех вопросов (или задайте пароль)
4. Скопируйте публичный ключ:
   ```bash
   cat ~/.ssh/id_ed25519.pub
   ```
5. Зайдите на GitHub.com → Settings → SSH and GPG keys → New SSH key
6. Вставьте скопированный ключ

## 📁 Создание репозитория

### Через веб-интерфейс GitHub

1. Зайдите на github.com
2. Нажмите "+" → "New repository"
3. Название: `dnd-character-manager`
4. Приватность: выберите Public или Private
5. НЕ добавляйте README, .gitignore или лицензию
6. Нажмите "Create repository"

### Связывание с локальным проектом

В папке проекта выполните:

```bash
# Инициализация Git
git init

# Добавление всех файлов
git add .

# Первый коммит
git commit -m "Initial commit"

# Добавление remote (замените YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/dnd-character-manager.git

# Отправка на GitHub
git push -u origin main
```

Если получите ошибку про ветку 'master' вместо 'main':
```bash
git branch -M main
git push -u origin main
```

## 💻 Работа с Claude Code на Windows

### Установка

В PowerShell или CMD с правами администратора:

```powershell
npm install -g @anthropic-ai/claude-code
```

### Настройка

1. Получите API ключ на https://console.anthropic.com
2. Инициализируйте Claude Code:
   ```cmd
   claude-code init
   ```
3. Введите API ключ

### Использование

```cmd
# Перейдите в папку проекта
cd C:\путь\к\dnd-character-manager

# Используйте Claude Code
claude-code "Создай новый компонент для заклинаний"
```

## 🔍 Решение проблем на Windows

### Ошибка "команда не найдена"

Если команды `npm`, `git` или другие не работают:

1. Перезапустите терминал
2. Перезагрузите компьютер
3. Проверьте переменные среды PATH:
   - Win + X → Система → Дополнительные параметры системы
   - Переменные среды → Path
   - Убедитесь что есть пути к Node.js и Git

### Ошибка "execution policy" в PowerShell

Если PowerShell блокирует выполнение скриптов:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Проблемы с кириллицей в Git

```bash
git config --global core.quotepath off
```

### Медленная установка зависимостей

1. Используйте более быстрый DNS (8.8.8.8)
2. Или используйте альтернативный registry:
   ```cmd
   npm config set registry https://registry.npmjs.org/
   ```

### npm WARN deprecated

Эти предупреждения обычно не критичны, можно игнорировать.

## 📝 Полезные сочетания клавиш

### VS Code
- `Ctrl + `` ` - Открыть терминал
- `Ctrl + Shift + P` - Командная палитра
- `Ctrl + P` - Быстрый поиск файлов
- `Ctrl + B` - Показать/скрыть боковую панель
- `Alt + Up/Down` - Переместить строку

### Git Bash
- `Ctrl + C` - Остановить процесс
- `Ctrl + L` - Очистить экран
- `Tab` - Автодополнение

## 🌐 Открытие приложения

После запуска `npm run dev`:

1. Откройте браузер (Chrome, Firefox, Edge)
2. Перейдите по адресу: http://localhost:5173
3. Для остановки нажмите `Ctrl + C` в терминале

## 🎯 Быстрый старт (TL;DR)

```cmd
# 1. Клонировать репозиторий
git clone https://github.com/YOUR_USERNAME/dnd-character-manager.git
cd dnd-character-manager

# 2. Установить зависимости
npm install

# 3. Запустить приложение
npm run dev

# 4. Открыть в браузере
start http://localhost:5173
```

---

**Приятной разработки! 🚀**
