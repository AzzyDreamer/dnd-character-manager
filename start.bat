@echo off
echo ========================================
echo D&D Character Manager - Quick Start
echo ========================================
echo.

REM Проверка наличия Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js не установлен!
    echo Пожалуйста, скачайте и установите Node.js с https://nodejs.org/
    pause
    exit /b 1
)

echo [OK] Node.js установлен
node --version
npm --version
echo.

REM Проверка наличия node_modules
if not exist "node_modules\" (
    echo [INFO] Установка зависимостей...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Ошибка при установке зависимостей!
        pause
        exit /b 1
    )
    echo [OK] Зависимости установлены
    echo.
)

echo ========================================
echo Запуск приложения...
echo ========================================
echo.
echo Приложение будет доступно по адресу:
echo http://localhost:5173
echo.
echo Для остановки нажмите Ctrl+C
echo ========================================
echo.

REM Запуск dev сервера
call npm run dev

pause
