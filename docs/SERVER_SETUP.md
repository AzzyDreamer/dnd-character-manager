# Пошаговая настройка сервера обновлений (с нуля)

Линейный гайд: делай шаги **сверху вниз, не пропуская**. Цель — поднять Ubuntu
24.04 так, чтобы он отдавал обновления по HTTPS и был доступен только по SSH (тебе)
и по HTTPS (пользователям приложения).

**Что нужно перед стартом:**
- Сервер Ubuntu 24.04 с доступом под `root` (IP и пароль root дал хостер).
- Доступ к DNS домена `azzydreamer.ru` (панель регистратора).
- Windows-машина с PowerShell (всё локальное делаем в нём).

В командах подставляй своё:
- `SERVER_IP` — IP твоего сервера (например `203.0.113.10`).
- Домен уже зашит в конфиги: `upd.azzydreamer.ru`.

> ⚠️ Два шага могут отрезать тебе доступ к серверу, если сделать не по порядку:
> включение файрвола (шаг 7) и хардненинг SSH (шаг 11). Поэтому хардненинг — **в
> самом конце**, когда вход по ключу уже проверен. Пока не дойдёшь до шага 11, у
> тебя остаётся запасной вход под root по паролю.

---

## Шаг 1 (на Windows). SSH-ключ

Проверь, есть ли уже ключ:
```powershell
Test-Path $HOME\.ssh\id_ed25519.pub
```

Если вывело `False` — создай ключ (на «Enter passphrase» можно задать пароль ключа или оставить пустым):
```powershell
ssh-keygen -t ed25519 -C "azzy-laptop"
```

Покажи **публичный** ключ — он понадобится на шаге 5, скопируй всю строку целиком:
```powershell
Get-Content $HOME\.ssh\id_ed25519.pub
```
Строка выглядит так: `ssh-ed25519 AAAAC3Nza... azzy-laptop`.

---

## Шаг 2 (у регистратора). DNS-запись

В панели домена `azzydreamer.ru` добавь A-запись:

| Тип | Имя (host) | Значение |
|-----|------------|----------|
| `A` | `upd`      | `SERVER_IP` |

Проверь с Windows, что имя резолвится в твой IP (может занять до часа):
```powershell
nslookup upd.azzydreamer.ru
```
Дальше идти, только когда `nslookup` показывает `SERVER_IP`. Это нужно для выпуска TLS-сертификата (шаг 9).

---

## Шаг 3 (на Windows). Первый вход на сервер под root

```powershell
ssh root@SERVER_IP
```
- На вопрос про fingerprint — введи `yes`.
- Введи пароль root от хостера (при вводе пароль не отображается — это нормально).

После входа приглашение станет вида `root@hostname:~#`. Все шаги 4–10 выполняются **в этом окне (как root)**.

---

## Шаг 4 (на сервере). Обновить систему

```bash
apt update && apt upgrade -y
```
Если в конце попросит перезагрузку — сделай `reboot`, подожди минуту и зайди снова (`ssh root@SERVER_IP`).

---

## Шаг 5 (на сервере). Создать пользователя `deploy` и дать ему твой ключ

Создать пользователя (придумай и **сохрани пароль** в менеджере паролей; на «Full Name» и прочее — просто Enter):
```bash
adduser deploy
```

Дать ему право `sudo` (админ-команды):
```bash
usermod -aG sudo deploy
```

Подготовить каталог для ключа:
```bash
mkdir -p /home/deploy/.ssh && chmod 700 /home/deploy/.ssh
```

Вставить **публичный** ключ из шага 1 (замени всю строку в кавычках на свою):
```bash
echo 'ssh-ed25519 AAAAC3Nza... azzy-laptop' > /home/deploy/.ssh/authorized_keys
```

Выставить права и владельца:
```bash
chmod 600 /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
```

---

## Шаг 6 (на Windows, НОВОЕ окно). Проверить вход по ключу

> Не закрывай окно root из шага 3! Открой **второе** окно PowerShell и проверь вход под `deploy`.

```powershell
ssh deploy@SERVER_IP
```
Должно пустить **без пароля** (или спросив пароль ключа, если ты его задавал на шаге 1) — приглашение `deploy@hostname:~$`.

Проверь, что работает sudo (спросит пароль пользователя `deploy` из шага 5):
```bash
sudo whoami
```
Ответ `root` — значит всё ок. Это второе окно можно закрыть; дальше продолжаем в окне root.

> Если под `deploy` войти НЕ удалось — вернись к шагу 5 (чаще всего ошибка в строке ключа или правах). **Не переходи к шагу 11**, пока этот вход не заработает.

---

## Шаг 7 (на сервере, окно root). Файрвол

Запретить всё входящее по умолчанию, разрешить исходящее:
```bash
ufw default deny incoming
ufw default allow outgoing
```

Открыть только три порта:
```bash
ufw allow 22/tcp     # SSH — тебе
ufw allow 80/tcp     # выпуск/продление TLS-сертификата
ufw allow 443/tcp    # обновления — пользователям
```

Включить файрвол (на вопрос `Proceed? (y|n)` ответь `y` — порт 22 уже открыт, текущая сессия не оборвётся):
```bash
ufw enable
```

Проверить:
```bash
ufw status verbose
```
Должны быть видны разрешённые 22, 80, 443 и `deny (incoming)` по умолчанию.

---

## Шаг 8 (на сервере). nginx и каталог обновлений

Поставить nginx:
```bash
apt install -y nginx
```

Создать каталог со статикой и отдать его пользователю `deploy` (чтобы заливать файлы без sudo):
```bash
mkdir -p /var/www/updates
chown -R deploy:deploy /var/www/updates
```

Записать конфиг сайта (скопируй блок целиком, вместе с `cat ... EOF`):
```bash
cat > /etc/nginx/sites-available/updates <<'EOF'
server {
    listen 80;
    server_name upd.azzydreamer.ru;
    root /var/www/updates;

    location / {
        try_files $uri =404;
        add_header Cache-Control "no-cache";
    }
}
EOF
```

Включить наш сайт вместо дефолтного:
```bash
ln -s /etc/nginx/sites-available/updates /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
```

Проверить конфиг и применить:
```bash
nginx -t && systemctl reload nginx
```
`nginx -t` должен сказать `syntax is ok` / `test is successful`.

---

## Шаг 9 (на сервере). HTTPS-сертификат (Let's Encrypt)

Поставить certbot:
```bash
apt install -y certbot python3-certbot-nginx
```

Выпустить сертификат и включить редирект на HTTPS (одной командой):
```bash
certbot --nginx -d upd.azzydreamer.ru --redirect -m dreemurrasriel79@gmail.com --agree-tos -n
```
Должно закончиться строкой `Successfully received certificate` / `Congratulations`.
Если ругается — почти всегда это DNS (шаг 2 ещё не прорастил) или закрыт порт 80 (шаг 7).

Автопродление уже настроено таймером systemd, проверить можно так:
```bash
systemctl list-timers | grep certbot
```

---

## Шаг 10 (на Windows). Проверить, что сервер отвечает по HTTPS

```powershell
curl.exe -I https://upd.azzydreamer.ru/
```
Ожидаемо `HTTP/... 404` — это **нормально**: каталог пока пуст, но HTTPS уже работает. Файлы появятся при первом релизе.

---

## Шаг 11 (на сервере, ПОСЛЕДНИЙ). Закрыть вход по паролю

> Делай это, только если шаг 6 (вход под `deploy` по ключу) прошёл успешно. Иначе пропусти и вернись позже.

Записать настройки SSH (вход только по ключу, root по паролю — нельзя):
```bash
cat > /etc/ssh/sshd_config.d/10-hardening.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
EOF
```

Применить:
```bash
systemctl restart ssh
```

**Сразу проверь** (новое окно PowerShell), что вход под `deploy` по ключу всё ещё работает:
```powershell
ssh deploy@SERVER_IP
```
Если пустило — готово. Если нет — у тебя ещё открыта старая root-сессия: верни `PasswordAuthentication yes` в том файле и `systemctl restart ssh`, затем разбирайся с ключом.

---

## Готово. Что дальше

Сервер поднят и ждёт файлы. Осталось (это уже не про сервер — см. [UPDATE_SERVER.md](UPDATE_SERVER.md)):

1. **Ветка `updates`** с `endpoint.json` — раздел 4 в `UPDATE_SERVER.md`.
2. **Первый релиз** — раздел 5: `scripts/release.ps1` соберёт, подпишет и зальёт
   установщик + `latest.json` в `/var/www/updates`. Для заливки используется тот же
   ключ и пользователь `deploy` (`UPD_SSH_HOST=deploy@upd.azzydreamer.ru`).

После первого релиза `https://upd.azzydreamer.ru/latest.json` начнёт отдавать манифест, и кнопка «Проверить обновления» в приложении заработает.
