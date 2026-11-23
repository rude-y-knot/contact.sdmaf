# Автоматическое размещение `contact.magmahome.ru` на VPS Beget (`159.194.209.18`) через GitHub Actions

Инструкция адаптирована под ваш сервер **`aygaevwwql` (`159.194.209.18`)** и настроена на **полностью автоматическое обновление**: после каждой выгрузки кода из AI Studio в GitHub (`rude-y-knot/visitcards`) сайт сам соберётся в GitHub Actions и обновится на VPS за ~30–60 секунд.

### Почему эта схема идеальна для вашего VPS
- **Нулевая нагрузка на сервер при сборке:** `npm ci` и `npm run build` выполняются на серверах GitHub (не нагружают 1.9 ГБ ОЗУ и CPU вашего VPS, где работают `magmahome.ru`, `magmakamin.ru`, `sdmaf`).
- **Атомарная подмена без даунтайма:** файлы распаковываются во временную папку `dist_new`, а затем мгновенно подменяют `dist` — посетители не увидят «полузагруженный» сайт.
- **Полная изоляция:** рабочий процесс `.github/workflows/deploy.yml` уже обновлён в проекте; он трогает **только** папку `/var/www/contact.magmahome.ru/` и никогда не меняет Nginx и другие сайты.
- **Docker не нужен:** статика раздаётся напрямую уже работающим Nginx из `/etc/nginx/conf.d/contact.magmahome.ru.conf`.

| Параметр сервера | Текущее состояние |
|---|---|
| Пользователь / IP | `root@aygaevwwql` / `159.194.209.18` |
| Веб-сервер | `nginx` на портах `80` и `443` |
| Конфиги Nginx | `/etc/nginx/conf.d/` (`magmahome.ru.conf`, `magmakamin.ru.conf`, `sdmaf.conf` — **не трогаем**) |
| Certbot | `4.0.0` (уже установлен) |
| Свободные ресурсы | Диск: `22 ГБ`, ОЗУ: `1.3 ГБ` + `2 ГБ` swap |

---

## Шаг 1. Настройка DNS в панели Beget

1. Откройте панель **Beget → Домены и поддомены → Управление DNS** для `magmahome.ru`.
2. Добавьте (или проверьте) **A-запись**:
   - **Поддомен:** `contact`
   - **Тип:** `A`
   - **Значение:** `159.194.209.18`
3. Проверьте с VPS, что запись применилась:
   ```bash
   dig +short A contact.magmahome.ru
   ```
   Ожидаемый ответ: `159.194.209.18`.

---

## Шаг 2. Выгрузка проекта в GitHub (`rude-y-knot/visitcards`)

Выгрузите текущую версию проекта из AI Studio в репозиторий **`rude-y-knot/visitcards`** (вместе с уже обновлённым файлом `.github/workflows/deploy.yml`).

> При первой выгрузке (до добавления секретов) GitHub Actions соберёт проект и безопасно пропустит шаг загрузки на VPS с предупреждением, без падения сборки.

---

## Шаг 3. Создание отдельного SSH-ключа на VPS для GitHub Actions

Создаём **отдельный** SSH-ключ специально для GitHub Actions, чтобы в любой момент его можно было отозвать одной строкой, не затрагивая ваш личный доступ к серверу.

Выполните на VPS (`root@aygaevwwql`):

```bash
mkdir -p /root/.ssh
chmod 700 /root/.ssh

# 1. Генерируем отдельный ключ ed25519 без парольной фразы для автодеплоя
ssh-keygen -t ed25519 -C "github-actions-contact-magmahome" -f /root/.ssh/id_ed25519_gh_actions_visitcards -N ""
chmod 600 /root/.ssh/id_ed25519_gh_actions_visitcards
chmod 644 /root/.ssh/id_ed25519_gh_actions_visitcards.pub

# 2. Разрешаем вход по этому публичному ключу (дописываем в конец authorized_keys)
cat /root/.ssh/id_ed25519_gh_actions_visitcards.pub >> /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys

# 3. Выводим ПРИВАТНЫЙ ключ (его нужно скопировать в GitHub Secrets на следующем шаге)
cat /root/.ssh/id_ed25519_gh_actions_visitcards
```

> Скопируйте **весь** вывод команды `cat` — от строки `-----BEGIN OPENSSH PRIVATE KEY-----` до `-----END OPENSSH PRIVATE KEY-----` включительно.
> После того как добавите его в GitHub Secrets, сам приватный файл на сервере можно удалить (`rm /root/.ssh/id_ed25519_gh_actions_visitcards`), оставив запись в `authorized_keys` — серверу для приёма подключений нужен только публичный ключ в `authorized_keys`.

---

## Шаг 4. Добавление секретов в GitHub (`rude-y-knot/visitcards`)

1. Откройте репозиторий: **`https://github.com/rude-y-knot/visitcards/settings/secrets/actions`**.
2. Нажмите **New repository secret** и добавьте 3 секрета:

| Name | Value |
|---|---|
| `BEGET_HOST` | `159.194.209.18` |
| `BEGET_USERNAME` | `root` |
| `BEGET_SSH_KEY` | Полный текст приватного ключа из Шага 3 (включая `BEGIN`/`END`) |

*(Опционально: если SSH на вашем VPS работает не на стандартном порту `22`, добавьте 4-й секрет `BEGET_PORT` с номером порта. Если порт стандартный `22`, добавлять не нужно.)*

---

## Шаг 5. Первый запуск деплоя из GitHub Actions

1. Перейдите в **`https://github.com/rude-y-knot/visitcards/actions`**.
2. Выберите слева workflow **Deploy to Beget VPS**.
3. Нажмите **Run workflow → Run workflow**.
4. Дождитесь зелёной галочки (~30–60 секунд).
5. Проверьте на VPS, что файлы появились:
   ```bash
   ls -la /var/www/contact.magmahome.ru/dist
   ```
   Внутри должен быть `index.html` и папка `assets/`.

---

## Шаг 6. Создание отдельного конфига Nginx (делается 1 раз)

Сначала убедитесь, что `contact.magmahome.ru` не перехватывается wildcard-записью (`*.magmahome.ru`) и конфиги Nginx валидны:

```bash
grep -rn "server_name" /etc/nginx/conf.d/
nginx -t
```

Создайте новый файл `/etc/nginx/conf.d/contact.magmahome.ru.conf` (файлы `magmahome.ru.conf`, `magmakamin.ru.conf`, `sdmaf.conf` **не трогаем**):

```bash
cat << 'EOF' > /etc/nginx/conf.d/contact.magmahome.ru.conf
server {
    listen 80;
    listen [::]:80;
    server_name contact.magmahome.ru;

    root /var/www/contact.magmahome.ru/dist;
    index index.html;

    access_log /var/log/nginx/contact.magmahome.ru.access.log;
    error_log  /var/log/nginx/contact.magmahome.ru.error.log;

    # Запрет доступа к скрытым файлам
    location ~ /\. {
        deny all;
    }

    # Долгое кеширование хешированных файлов Vite
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # SPA-маршрутизация (поддержка ?card=... и прямых ссылок)
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache";
    }

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/javascript application/javascript application/json image/svg+xml;
}
EOF
```

Проверьте синтаксис и примените **мягкую** перезагрузку (`reload` не прерывает работу остальных сайтов):

```bash
nginx -t && systemctl reload nginx
curl -I http://contact.magmahome.ru
```
Ожидается `HTTP/1.1 200 OK`.

---

## Шаг 7. Выпуск SSL-сертификата HTTPS через Certbot (делается 1 раз)

```bash
certbot --nginx -d contact.magmahome.ru --redirect
nginx -t
certbot renew --dry-run
```

Certbot добавит HTTPS и редирект только в `/etc/nginx/conf.d/contact.magmahome.ru.conf`.
Откройте **`https://contact.magmahome.ru`** и проверьте работу визиток, а также убедитесь, что `magmahome.ru`, `magmakamin.ru` и `sdmaf` продолжают работать штатно.

---

## Как теперь происходит обновление сайта

На сервер по SSH заходить больше **вообще не нужно**:

1. Вносите любые изменения здесь в AI Studio.
2. Выгружаете их в GitHub (`rude-y-knot/visitcards`, ветка `main` или `master`).
3. GitHub Actions автоматически:
   - собирает `dist/` с Node 22;
   - подключается к `159.194.209.18` по SSH;
   - атомарно обновляет `/var/www/contact.magmahome.ru/dist`.
4. Через ~40 секунд обновлённый сайт уже доступен на **`https://contact.magmahome.ru`**.

---

## Быстрый откат или отзыв доступа

### Отключить сайт в Nginx за 5 секунд (не затрагивая остальные проекты):
```bash
rm -f /etc/nginx/conf.d/contact.magmahome.ru.conf
nginx -t && systemctl reload nginx
```

### Откатить версию сайта на предыдущую:
Откройте в GitHub предыдущий успешный запуск во вкладке **Actions → Deploy to Beget VPS** и нажмите **Re-run all jobs** (или откатите коммит в GitHub — деплой запустится сам).

### Отозвать SSH-доступ для GitHub Actions (не затрагивая ваш личный вход):
Удалите одну строку с комментарием `github-actions-contact-magmahome` из `/root/.ssh/authorized_keys`:
```bash
sed -i '/github-actions-contact-magmahome/d' /root/.ssh/authorized_keys
```
