# Сервер обновлений и самообновление десктопа

Десктоп умеет сам проверять и ставить обновления (кнопка «Проверить обновления»
в Настройках). Куда ходить за манифестом — решает **pointer-файл** в Git, а не
вшитый адрес. Поэтому сервер можно сменить даже на уже установленных копиях.

```
Кнопка → check_update (Rust)
  ├─ читает pointer.json с GitHub          → актуальный endpoint
  │     (GitHub недоступен → вшитый фоллбэк https://upd.azzydreamer.ru/latest.json)
  ├─ updater_builder().endpoints(...).check()
  └─ есть новее? → диалог → install_update → скачать+проверить подпись+поставить → перезапуск
```

- Pointer: `https://raw.githubusercontent.com/AzzyDreamer/dnd-character-manager/updates/endpoint.json`
- Сервер (статика по HTTPS): `https://upd.azzydreamer.ru/` — `latest.json` + `*-setup.exe` + ничего лишнего.
- Подпись проверяется публичным ключом из `src-tauri/tauri.conf.json` (`plugins.updater.pubkey`).

---

## 0. Ключи подписи — сделать ПЕРВЫМ и НИКОГДА не терять

Это корень доверия. Какой бы сервер ни выдал pointer, установится только бинарь,
подписанный **этим** приватным ключом. Потеряешь приватный ключ — старые копии
больше не обновить ничем, только переустановка вручную.

```powershell
# Один раз, на своей машине (Windows). Запомни пароль ключа.
New-Item -ItemType Directory -Force $HOME\.tauri | Out-Null
npx tauri signer generate -w $HOME\.tauri\dndmanager.key
```

Команда выведет приватный (`dndmanager.key`) и публичный ключи.

1. **Публичный** ключ впиши в `src-tauri/tauri.conf.json` → `plugins.updater.pubkey`
   (заменив `REPLACE_WITH_TAURI_SIGNER_PUBLIC_KEY`).
2. **Приватный** ключ + пароль положи в 2–3 места: менеджер паролей и офлайн-копия
   (USB/бумага). В репозиторий и на сервер — НЕ класть.

---

## 1–2. Поднять сервер

Полная пошаговая инструкция (DNS, пользователь `deploy`, SSH-ключ, файрвол, nginx,
TLS, хардненинг) вынесена в отдельный гайд: **[SERVER_SETUP.md](SERVER_SETUP.md)**.

Итог после него: `upd.azzydreamer.ru` отдаёт статику из `/var/www/updates` по HTTPS;
доступ только по SSH (ключ, пользователь `deploy`) и по HTTPS (пользователям).

---

## 3. Pointer-файл (ветка `updates`)

Создаётся один раз. Нужен файл `endpoint.json` в корне ветки `updates`:
```json
{
  "endpoints": ["https://upd.azzydreamer.ru/latest.json"]
}
```

**Проще всего — через веб GitHub** (никакого шелла, ничего не ломает рабочее дерево):
1. На странице репозитория: переключатель веток → ввести `updates` → «Create branch updates».
2. На ветке `updates`: «Add file» → «Create new file» → имя `endpoint.json`, содержимое
   как выше (можно скопировать из `docs/update-pointer.example.json`) → Commit.

**Альтернатива — CLI (PowerShell, через временный клон, рабочее дерево не трогаем):**
```powershell
$tmp = Join-Path $env:TEMP "dnd-updates"
git clone --no-checkout . $tmp
Push-Location $tmp
git switch --orphan updates
'{ "endpoints": ["https://upd.azzydreamer.ru/latest.json"] }' | Set-Content endpoint.json -Encoding ascii
git add endpoint.json
git commit -m "chore: update endpoint pointer"
git push https://github.com/AzzyDreamer/dnd-character-manager updates
Pop-Location
Remove-Item -Recurse -Force $tmp
```

---

## 4. Публикация релиза

С твоей машины (Windows), из корня репозитория:
```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = "$HOME\.tauri\dndmanager.key"   # путь к ключу
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = '<пароль ключа>'
.\scripts\release.ps1 -Version 0.2.0 -Notes "Что нового в 0.2.0"
```
Скрипт: бампнет версию → соберёт и подпишет → сгенерит `latest.json` → зальёт
установщик и манифест на сервер по SSH. Детали и переменные (`UPD_SSH_HOST`,
`UPD_REMOTE_DIR`) — в шапке `scripts/release.ps1`.

> **Альтернатива — CI (GitHub Actions).** Можно автоматизировать сборку/подпись по
> тегу и заливку на сервер: приватный ключ и пароль кладутся в Secrets, артефакты
> собираются на `windows-latest`, `latest.json` и `*-setup.exe` уходят на сервер по
> SSH (`appleboy/scp-action` или `rsync`). Делаем, если решишь уйти от ручного
> скрипта — нужен deploy-ключ на сервере и секреты в репозитории.

---

## 5. Если потерял доступ к серверу

Старые копии всё равно спросят pointer на GitHub. Достаточно:
1. Поднять новый сервер по [SERVER_SETUP.md](SERVER_SETUP.md) (или временно отдать файлы с GitHub Releases).
2. В ветке `updates` поправить `endpoint.json` на новый адрес и `git push`.
3. (опц.) выпустить релиз на новом сервере тем же `release.ps1`.

Все установленные «с этой фичи» копии при следующей проверке поедут на новый адрес.
Главное условие — цел **приватный ключ подписи** (шаг 0).

> Копии, собранные ДО появления самообновления, переключить нельзя — их
> пользователям один раз нужно переустановить с прямой ссылки.
