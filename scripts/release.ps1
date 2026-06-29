# Релиз десктопа с самообновлением: бамп версии → сборка с подписью → генерация
# latest.json → заливка на сервер по SSH. Запуск из корня репозитория:
#
#   $env:TAURI_SIGNING_PRIVATE_KEY = "$HOME\.tauri\dndmanager.key"   # путь к ключу
#   $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = '<пароль ключа>'
#   .\scripts\release.ps1 -Version 0.2.0 -Notes "Что нового"
#
# Приватный ключ В РЕПОЗИТОРИЙ НЕ КЛАДЁМ. Он генерится один раз
# (tauri signer generate) и бэкапится отдельно — см. docs/UPDATE_SERVER.md.

param(
  [Parameter(Mandatory = $true)][string]$Version,
  [string]$Notes = "",
  # Куда заливать. Подставь свои значения или задай переменными окружения.
  [string]$SshHost   = $(if ($env:UPD_SSH_HOST)   { $env:UPD_SSH_HOST }   else { "deploy@upd.azzydreamer.ru" }),
  [string]$RemoteDir = $(if ($env:UPD_REMOTE_DIR) { $env:UPD_REMOTE_DIR } else { "/var/www/updates" }),
  # CI собирает с -SkipUpload: артефакты складываются в release/, а заливает их
  # отдельный job (scp-action). Локально флаг не нужен — скрипт сам зальёт по scp.
  [switch]$SkipUpload
)

$ErrorActionPreference = "Stop"
# Чтобы кириллица в Write-Host выводилась корректно независимо от кодовой страницы
# консоли. Сам файл должен быть сохранён в UTF-8 with BOM — иначе PowerShell 5.1
# прочитает его в ANSI и сломается на кириллице.
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$repo = Split-Path -Parent $PSScriptRoot

if (-not $env:TAURI_SIGNING_PRIVATE_KEY) {
  throw "TAURI_SIGNING_PRIVATE_KEY не задан — без него сборка не подпишет апдейтер-артефакты."
}

# Запись UTF-8 БЕЗ BOM: Set-Content -Encoding utf8 в Windows PowerShell 5.1 пишет
# BOM, а он ломает парсинг latest.json у апдейтера (serde_json) и мусорит конфиги.
function Write-Utf8NoBom([string]$Path, [string]$Content) {
  [System.IO.File]::WriteAllText($Path, $Content, (New-Object System.Text.UTF8Encoding($false)))
}

# Точечно меняем первую строку version в JSON, не пересобирая файл целиком
# (ConvertTo-Json переформатировал бы весь файл и шумел в диффах).
function Set-JsonVersion([string]$Path, [string]$Version) {
  $raw = Get-Content $Path -Raw
  $raw = ([regex]'("version"\s*:\s*")[^"]*(")').Replace($raw, ('${1}' + $Version + '${2}'), 1)
  Write-Utf8NoBom $Path $raw
}

# 1) Бамп версии в трёх местах (источник истины — tauri.conf.json).
Write-Host "==> Версия $Version" -ForegroundColor Cyan
$conf = Join-Path $repo "src-tauri\tauri.conf.json"
Set-JsonVersion $conf $Version
$pkg = Join-Path $repo "package.json"
Set-JsonVersion $pkg $Version

# Cargo.toml — точечная замена строки version в секции [package] (первая строка,
# начинающаяся с version=; deps вида `tauri = { version = ... }` не затрагиваются).
$cargo = Join-Path $repo "src-tauri\Cargo.toml"
$cargoRaw = Get-Content $cargo -Raw
$cargoRaw = ([regex]'(?m)^version\s*=\s*".*"').Replace($cargoRaw, "version = `"$Version`"", 1)
Write-Utf8NoBom $cargo $cargoRaw

# 2) Сборка с подписью. tauri build сам создаёт *-setup.exe и *.sig.
Write-Host "==> npm run tauri build" -ForegroundColor Cyan
Push-Location $repo
try { npm run tauri build } finally { Pop-Location }

# 3) Находим установщик и подпись.
$nsisDir = Join-Path $repo "src-tauri\target\release\bundle\nsis"
$setup = Get-ChildItem $nsisDir -Filter "*-setup.exe" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $setup) { throw "Не найден *-setup.exe в $nsisDir" }
$sigFile = "$($setup.FullName).sig"
if (-not (Test-Path $sigFile)) { throw "Не найдена подпись $sigFile (проверь createUpdaterArtifacts и ключ)" }
$signature = (Get-Content $sigFile -Raw).Trim()

# 4) Готовим папку release/ с консистентными именами и манифестом.
#    Пробелы в имени («DnD Character Manager…») заменяем на точки: иначе scp на
#    удалённой стороне разорвёт путь по пробелу, а URL в манифесте должен совпадать
#    с залитым файлом. Подпись считается по БАЙТАМ файла, переименование безопасно.
$assetName = ($setup.Name -replace '\s', '.')
$outDir = Join-Path $repo "release"
Remove-Item -Recurse -Force $outDir -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $outDir | Out-Null
Copy-Item $setup.FullName (Join-Path $outDir $assetName)

$manifest = [ordered]@{
  version   = $Version
  notes     = $Notes
  pub_date  = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  platforms = [ordered]@{
    "windows-x86_64" = [ordered]@{
      signature = $signature
      url       = "https://upd.azzydreamer.ru/$assetName"
    }
  }
}
Write-Utf8NoBom (Join-Path $outDir "latest.json") ($manifest | ConvertTo-Json -Depth 50)
Write-Host "==> release/ готов ($assetName + latest.json)" -ForegroundColor Green

# 5) Заливка. В CI пропускаем — артефакты из release/ зальёт отдельный job.
if ($SkipUpload) {
  Write-Host "==> -SkipUpload: scp пропущен (зальёт CI из release/)." -ForegroundColor Yellow
  return
}

# Format-оператор вместо интерполяции — чтобы двоеточие после хоста не уехало
# в scope-синтаксис PowerShell ($host:...).
$destSetup    = "{0}:{1}/{2}" -f $SshHost, $RemoteDir, $assetName
$destManifest = "{0}:{1}/latest.json" -f $SshHost, $RemoteDir
Write-Host "==> scp на $SshHost`:$RemoteDir" -ForegroundColor Cyan
scp (Join-Path $outDir $assetName)    $destSetup
scp (Join-Path $outDir "latest.json") $destManifest

Write-Host "Готово. Старые копии увидят $Version при следующей проверке." -ForegroundColor Green
Write-Host "Не забудь: git commit бампа версии и git tag v$Version." -ForegroundColor Yellow
