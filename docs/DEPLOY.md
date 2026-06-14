# Деплой: Этап 1 — PocketBase на VPS

> Соответствует `docs/PLAN_PARTY.md`, Этап 1. ОС: Ubuntu/Debian. Предполагается домен
> с A-записью на IP сервера. Все команды — из-под root (или через `sudo`).
>
> **Плейсхолдеры**, замени по тексту:
> - `dnd.example.com` — твой домен;
> - `203.0.113.10` — твой домашний/рабочий IP для доступа к админке;
> - `PB_VERSION` — зафиксированная версия PocketBase (см. шаг 2.1).

---

## Шаг 0. Ликвидация 3x-ui

3x-ui (панель xray, systemd-сервис `x-ui`) надо снять до nginx: он может держать
порты 80/443 и оставить acme.sh-сертификаты с крон-задачей.

### 0.1. Остановить и выключить

```bash
systemctl stop x-ui
systemctl disable x-ui
```

### 0.2. Удалить (штатно или вручную)

Штатно — открыть меню и выбрать пункт **Uninstall**:

```bash
x-ui          # в меню выбрать пункт удаления (номер зависит от версии)
```

Если меню недоступно/версия странная — снести вручную (детерминированно):

```bash
rm -f  /etc/systemd/system/x-ui.service
systemctl daemon-reload
systemctl reset-failed

rm -rf /usr/local/x-ui/      # бинарь панели + встроенный xray (bin/)
rm -rf /etc/x-ui/            # x-ui.db (настройки панели, инбаунды)
rm -f  /usr/bin/x-ui         # управляющий скрипт
rm -rf /var/log/x-ui/        # если есть
```

### 0.3. Проверить, что чисто

```bash
systemctl status x-ui            # должно быть "could not be found"
ss -tlnp | grep -E ':(80|443|2053)\b'   # кто держит порты — должно быть пусто
pgrep -a xray                    # процессов xray быть не должно
```

### 0.4. Хвосты: сертификаты и крон acme.sh

3x-ui часто ставит acme.sh для своих сертов и прописывает крон обновления.
Нам он не нужен — будет certbot.

```bash
crontab -l                       # удалить строки с acme.sh, если есть: crontab -e
ls -la ~/.acme.sh 2>/dev/null    # менеджер сертов 3x-ui
~/.acme.sh/acme.sh --uninstall 2>/dev/null   # снять крон/хуки acme
rm -rf ~/.acme.sh                # удалить, если эти серты больше не нужны
```

> Если на сервере есть **другие** сервисы, которыми ты дорожишь — сначала проверь,
> не их ли это серты, прежде чем удалять `~/.acme.sh`.

После этого сервер чист, порты 80/443 свободны.

---

## Шаг 1. Подготовка сервера

### 1.1. Базовые пакеты

```bash
apt update && apt upgrade -y
apt install -y nginx unzip curl ufw certbot python3-certbot-nginx
```

### 1.2. Firewall

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
ufw status
```

PocketBase будет слушать только `127.0.0.1:8090` — наружу его порт не открываем,
весь внешний трафик идёт через nginx (TLS).

### 1.3. Отдельный системный пользователь под PocketBase

```bash
useradd --system --home /opt/pocketbase --shell /usr/sbin/nologin pocketbase
mkdir -p /opt/pocketbase
```

---

## Шаг 2. Установка PocketBase

### 2.1. Зафиксировать версию и скачать

Открой https://github.com/pocketbase/pocketbase/releases, возьми **последний стабильный**
тег и впиши его. Версию НЕ обновляем стихийно — только по changelog.

```bash
PB_VERSION=0.39.3          # ← подставь актуальную; ЗАПИШИ её в этой доке
cd /opt/pocketbase
curl -L -o pb.zip "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip"
unzip pb.zip && rm pb.zip
chmod +x pocketbase
./pocketbase --version       # сверить
```

> **Зафиксированная версия PocketBase: `__________`** (заполни после установки).

### 2.2. Создать суперюзера (админа)

```bash
cd /opt/pocketbase
./pocketbase superuser create admin@dnd.example.com 'СГЕНЕРИРОВАННЫЙ_ДЛИННЫЙ_ПАРОЛЬ'
# В версиях < 0.23 команда называется: ./pocketbase admin create <email> <pass>
```

> `admin@dnd.example.com` здесь — это **email-логин суперюзера**, а не сетевой домен.
> Он нужен только для входа в админку и **не обязан быть рабочим ящиком** или совпадать
> с твоим доменом — подойдёт хоть `admin@local`. Реальный email имеет смысл только если
> позже настроишь SMTP в PocketBase (письма сброса пароля и т.п.).

### 2.3. Права на каталог

```bash
chown -R pocketbase:pocketbase /opt/pocketbase
```

### 2.4. systemd-юнит

systemd держит PocketBase живым: автозапуск при загрузке сервера, перезапуск при
падении, единые логи через journald.

**Сначала создать рабочие подкаталоги** (иначе при `ProtectSystem=strict` ниже
демону будет некуда писать):

```bash
mkdir -p /opt/pocketbase/pb_data /opt/pocketbase/pb_hooks /opt/pocketbase/pb_migrations
chown -R pocketbase:pocketbase /opt/pocketbase
```

**Создать юнит** (heredoc в одинарных кавычках — чтобы `$`/`\` не трогал шелл):

```bash
cat > /etc/systemd/system/pocketbase.service <<'EOF'
[Unit]
Description=PocketBase (dnd-character-manager)
After=network.target
# не уходить в бесконечный цикл рестартов при битой конфигурации
StartLimitIntervalSec=60
StartLimitBurst=5

[Service]
Type=simple
User=pocketbase
Group=pocketbase

# больше файловых дескрипторов: каждое realtime-SSE-соединение держит сокет
LimitNOFILE=8192

Restart=always
RestartSec=5

WorkingDirectory=/opt/pocketbase
ExecStart=/opt/pocketbase/pocketbase serve \
  --http=127.0.0.1:8090 \
  --dir=/opt/pocketbase/pb_data \
  --hooksDir=/opt/pocketbase/pb_hooks \
  --migrationsDir=/opt/pocketbase/pb_migrations

# --- sandbox (least privilege) ---
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/opt/pocketbase
ProtectHome=true
PrivateTmp=true
PrivateDevices=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6
RestrictNamespaces=true
LockPersonality=true
# демон слушает порт >1024 под обычным юзером — Linux-capabilities не нужны
CapabilityBoundingSet=
AmbientCapabilities=

[Install]
WantedBy=multi-user.target
EOF
```

**Запустить и включить автозапуск:**

```bash
systemctl daemon-reload
systemctl enable --now pocketbase
systemctl status pocketbase                 # active (running)
curl -s http://127.0.0.1:8090/api/health    # {"code":200,...}
```

**Что делают ключевые директивы:**

| Директива | Зачем |
|---|---|
| `User/Group=pocketbase` | демон не от root — least privilege |
| `--http=127.0.0.1:8090` | слушает только localhost; наружу выставляет nginx (TLS) |
| `--dir/--hooksDir/--migrationsDir` | где pb_data, JS-хуки (Этап 6) и миграции; для Этапа 1 хуки/миграции пусты |
| `Type=simple` | PB работает на переднем плане, не демонизируется сам |
| `Restart=always` + `RestartSec=5` | упал — systemd поднимет через 5 c |
| `StartLimitBurst/IntervalSec` | но не чаще 5 раз за 60 c — иначе при битом конфиге будет цикл |
| `WorkingDirectory` | относительные пути PB резолвит отсюда |
| `LimitNOFILE=8192` | лимит открытых сокетов под SSE-подключения |
| `ProtectSystem=strict` + `ReadWritePaths` | вся ФС read-only, писать можно только в `/opt/pocketbase` |
| `NoNewPrivileges`, `Protect*`, `Private*` | sandbox: нет эскалации прав, доступа к /home, девайсам, ядру |
| `CapabilityBoundingSet=` | снять все capabilities (порт >1024 их не требует) |

**Управление и логи:**

```bash
systemctl restart pocketbase
systemctl stop pocketbase
systemctl is-enabled pocketbase          # enabled → переживёт перезагрузку
journalctl -u pocketbase -f              # живой хвост логов
journalctl -u pocketbase -n 100 --no-pager
journalctl -u pocketbase --since "10 min ago"
```

> **Диагностика:**
> - `systemctl status` ругается на `ExecStart` → старый systemd (< 239) не понимает
>   переносы `\`; собери `ExecStart=` в одну строку.
> - в логах `read-only file system` на пути pb_data → проверь `ReadWritePaths` и `chown`.
> - хочешь жёстче — добавь `SystemCallFilter=@system-service` (для Go-сервиса
>   безопасно); если что-то отвалится, убитый syscall будет виден в `journalctl`.

---

## Шаг 3. nginx + TLS + защита админки

### 3.1. Получить сертификат

DNS A-запись `dnd.example.com` → IP сервера должна уже резолвиться.

```bash
certbot certonly --nginx -d dnd.example.com
# серты лягут в /etc/letsencrypt/live/dnd.example.com/
```

Автопродление уже стоит systemd-таймером `certbot.timer` (проверка: `systemctl list-timers | grep certbot`).

### 3.2. Каталог под фронт

```bash
mkdir -p /var/www/dnd/dist
# сюда позже зальётся сборка Vite (Этап 2 — онлайн-режим). Пока можно
# положить текущий локальный билд или index-заглушку.
```

### 3.3. Конфиг nginx

`/etc/nginx/sites-available/dnd`:

```nginx
server {
    listen 80;
    server_name dnd.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    http2 on;
    server_name dnd.example.com;

    ssl_certificate     /etc/letsencrypt/live/dnd.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dnd.example.com/privkey.pem;

    # портреты и т.п.
    client_max_body_size 10M;

    # приватный сервис — запрещаем поисковую индексацию.
    # X-Robots-Tag (в отличие от robots.txt) реально запрещает попадание в индекс,
    # включая страницу логина. add_header на уровне server наследуется во все
    # location ниже (т.к. в них нет своих add_header).
    add_header X-Robots-Tag "noindex, nofollow" always;

    location = /robots.txt {
        default_type text/plain;
        return 200 "User-agent: *\nDisallow: /\n";
    }

    # --- Админка PocketBase: только с доверенного IP ---
    location /_/ {
        allow 203.0.113.10;
        deny  all;
        proxy_pass http://127.0.0.1:8090;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # (опц.) усилить: закрыть и эндпоинт логина суперюзера тем же allowlist
    location = /api/collections/_superusers/auth-with-password {
        allow 203.0.113.10;
        deny  all;
        proxy_pass http://127.0.0.1:8090;
        proxy_set_header Host              $host;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # --- API PocketBase (включая realtime SSE) ---
    location /api/ {
        proxy_pass http://127.0.0.1:8090;
        proxy_http_version 1.1;
        proxy_set_header Connection        "";
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # realtime — не буферизуем и держим долго
        proxy_buffering off;
        proxy_read_timeout 360s;
    }

    # --- Статика фронта (SPA hash-routing) ---
    root /var/www/dnd/dist;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/dnd /etc/nginx/sites-enabled/dnd
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

### 3.4. Сказать PocketBase, что он за прокси

Зайти в админку `https://dnd.example.com/_/` (с доверенного IP) →
**Settings → Application** → включить чтение клиентского IP из заголовков прокси
(`X-Forwarded-For` / `X-Real-IP`). Иначе rate-limit и логи увидят IP nginx,
а не реальных пользователей.

---

## Шаг 4. Коллекции и правила

Объём для Этапа 1: полностью настраиваем `users` и `characters` (их и проверяет
критерий этапа). Коллекции `parties` / `party_members` / `game_events` создаём со
схемой полей, но правила доступа на основе членства (кросс-коллекционные) **доводим
в Этапах 4–5**, когда появятся данные и UI для проверки. Пока держим их закрытыми.

> Памятка по правилам PocketBase: **замок** (поле правила заблокировано/пусто) =
> «только суперюзер»; **разблокированное пустое** правило = «любой, включая
> анонима». Это разные вещи — не перепутай при `createRule = null`.

### 4.1. users (auth-коллекция, уже есть)

API rules:
- **List / View:** `@request.auth.id != ""` — любой авторизованный (нужно ГМу для выбора участников).
- **Create:** замок → `null` (создаёт только админ в админке). *Это и есть закрытая регистрация.*
- **Update:** `id = @request.auth.id` (только сам себя).
- **Delete:** замок → `null`.

Поля (добавить к стандартным auth-полям): `displayName` (text), `suspended` (bool),
`tosAcceptedAt` (date), `invitedBy` (relation→users, опц. — про запас).

### 4.2. characters (новая)

Поля:
- `owner` — relation→users, **required**, single, maxSelect 1;
- `data` — json (объект `Character` целиком, как в localStorage);
- `portrait` — file, single, опц. (заменит base64 `portraitDataUrl` на Этапе 3);
- `schemaVersion` — number.

API rules (Этап 1 — владелец видит/правит только своё):
- **List / View:** `owner = @request.auth.id`
- **Create:** `@request.auth.id != "" && owner = @request.auth.id`
- **Update:** `owner = @request.auth.id`
- **Delete:** `owner = @request.auth.id`

> View будет расширен на сопартийцев/ГМа в Этапе 5 (по `party_members.visibility`).

### 4.3. parties / party_members / game_events (схема сейчас, правила членства — позже)

Создать коллекции с полями по `PLAN_PARTY.md`. На Этапе 1 правила держим
закрытыми (владелец/создатель), кросс-коллекционные view-правила (видимость
по членству) добавим в Этапах 4–5.

- **parties:** `name` text, `gm` relation→users, `description` text(опц.).
  Create: `@request.auth.id != "" && gm = @request.auth.id`. Update/Delete/View/List: `gm = @request.auth.id` (членов откроем в Этапе 4).
- **party_members:** `party` rel→parties, `user` rel→users, `character` rel→characters(nullable), `visibility` select(`party`|`gm`|`hidden`).
  Правила доступа — Этап 4 (зависят от роли в партии).
- **game_events:** `party` rel, `actor` rel→users, `character` rel(nullable), `type` select(`roll`|`hp`|`rest`|`levelup`|`resource`|`system`), `payload` json.
  Update: `null` (никто). Остальное — Этап 6.

> Альтернатива ручному вводу: настроить одну коллекцию руками, затем
> **Settings → Import collections** перенести JSON-схему (формат зависит от версии PB).

---

## Шаг 5. Бэкап pb_data по крону

SQLite живёт в WAL-режиме — голый `tar` работающей БД может схватить неконсистентный
срез. Надёжный путь: **встроенный бэкап PocketBase** (консистентный zip) + вынос копий
с сервера по крону с ротацией.

### 5.1. Встроенный бэкап (рекомендуется)

Админка → **Settings → Backups** → включить расписание (cron) — PocketBase будет
класть консистентные zip в `pb_data/backups/`.

### 5.2. Вынос + ротация (требование плана: tar + ротация)

`/opt/pocketbase/backup.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
src=/opt/pocketbase/pb_data
dest=/var/backups/pocketbase
ts=$(date +%Y%m%d-%H%M%S)
mkdir -p "$dest"
# если включён встроенный бэкап — архивируем готовые консистентные zip;
# иначе tar всего каталога (для SQLite в WAL обычно восстанавливается, но менее надёжно).
tar czf "$dest/pb_data-$ts.tar.gz" -C "$(dirname "$src")" "$(basename "$src")"
# хранить последние 14
ls -1t "$dest"/pb_data-*.tar.gz | tail -n +15 | xargs -r rm -f
```

```bash
chmod +x /opt/pocketbase/backup.sh
crontab -e
# каждый день в 03:30
30 3 * * * /opt/pocketbase/backup.sh >> /var/log/pb-backup.log 2>&1
```

> Лучше всего — копировать бэкапы ещё и **за пределы VPS** (S3/другой хост):
> у встроенного бэкапа есть выгрузка в S3-совместимое хранилище.

---

## Шаг 6. Проверка (критерий Этапа 1)

Создание юзера в админке → логин через API → CRUD своего персонажа работает,
чужого — запрещён.

```bash
# 0) В админке создать двух юзеров: player1@…, player2@… (Create заблокирован для публики)

# 1) Логин player1 → токен
TOKEN1=$(curl -s -X POST https://dnd.example.com/api/collections/users/auth-with-password \
  -H 'Content-Type: application/json' \
  -d '{"identity":"player1@dnd.example.com","password":"PASS1"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')
UID1=$(curl -s https://dnd.example.com/api/collections/users/auth-refresh \
  -H "Authorization: $TOKEN1" | python3 -c 'import sys,json;print(json.load(sys.stdin)["record"]["id"])')

# 2) player1 создаёт персонажа
CHAR=$(curl -s -X POST https://dnd.example.com/api/collections/characters/records \
  -H "Authorization: $TOKEN1" -H 'Content-Type: application/json' \
  -d "{\"owner\":\"$UID1\",\"data\":{\"name\":\"Test\"},\"schemaVersion\":1}")
echo "$CHAR"                       # должен вернуться record с id
CHAR_ID=$(echo "$CHAR" | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')

# 3) player1 видит свой список
curl -s https://dnd.example.com/api/collections/characters/records \
  -H "Authorization: $TOKEN1"     # items: [тот самый персонаж]

# 4) player2 логинится и НЕ видит чужого
TOKEN2=$(curl -s -X POST https://dnd.example.com/api/collections/users/auth-with-password \
  -H 'Content-Type: application/json' \
  -d '{"identity":"player2@dnd.example.com","password":"PASS2"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')
curl -s "https://dnd.example.com/api/collections/characters/records/$CHAR_ID" \
  -H "Authorization: $TOKEN2"     # ожидаем 404 (правило view скрывает чужого)
curl -s https://dnd.example.com/api/collections/characters/records \
  -H "Authorization: $TOKEN2"     # items: [] (пусто)
```

Если шаги 1–3 проходят, а шаг 4 даёт 404/пусто — Этап 1 закрыт.

> PocketBase принимает токен в заголовке `Authorization` как есть (без префикса `Bearer`).

---

## Что дальше

- **Этап 2** — auth-гейт на фронте (`VITE_BACKEND_URL`, SDK `pocketbase`, логин-гейт, экран правил `tosAcceptedAt`). Сборка без `VITE_BACKEND_URL` остаётся локальным режимом для GH Pages.
- **Этап 3** — `RemoteCharacterStore` поверх коллекции `characters` (вторая реализация `CharacterStore` из Этапа 0), миграция localStorage → облако, портреты в file-поле.

## Чек-лист безопасности

- [ ] PocketBase слушает только `127.0.0.1:8090` (не наружу).
- [ ] ufw: открыты только 22/80/443.
- [ ] `/_/` (админка) закрыта allowlist'ом по IP.
- [ ] `users.createRule = null` (закрытая регистрация).
- [ ] characters: CRUD только владельцем (проверено шагом 6).
- [ ] `X-Robots-Tag: noindex` + `robots.txt` (сервис не индексируется).
- [ ] Версия PocketBase записана в этой доке.
- [ ] Бэкап pb_data по крону + (желательно) копия вне VPS.
- [ ] (Опц.) SSH: только ключи, fail2ban.
