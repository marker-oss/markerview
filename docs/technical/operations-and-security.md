# Эксплуатация и безопасность

[Навигация](README.md) · [Разработка](development.md) · Срез исходников: 2026-09-17.

Документ для сопровождающего публичный Core. **Current** означает поведение, прослеженное по исходникам и packaging-файлам; это не обещание проверенной production-инсталляции. **Accepted target** — принятое направление, ещё не являющееся текущим контрактом. **Open** — вопрос, который нельзя молча решать в runbook.

## Что сейчас запускается

Основной процесс — `reviews serve`; CLI и флаги определены в [`cmd/reviews/main.go`](../../cmd/reviews/main.go). `GET /healthz` отвечает JSON `{"status":"ok"}` без проверки БД или marketplace ([`internal/server/server.go`](../../internal/server/server.go)). Это liveness-проба, не readiness: в compose нет `healthcheck`, а отдельного DB-ready endpoint нет.

Текущие entrypoints:

```sh
reviews migrate
reviews serve --addr 0.0.0.0:8080
reviews serve --addr 0.0.0.0:8080 --with-sync
reviews sync --once [--marketplace wb|ym|ozon]
reviews export --out web/reviews-data
```

`--with-sync` включает periodic sync внутри процесса; без него ручной `sync --once` всё равно требует credentials. Не включайте sync в smoke-инстансе с настоящими ключами без отдельного окна и наблюдения.

### Packaging paths

- [`Dockerfile`](../../Dockerfile) сначала собирает React/Vite-admin на Node 22, затем Go 1.26 и копирует свежий `dist` в builder перед компиляцией; итог — non-root distroless image.
- [`deploy/build.sh`](../../deploy/build.sh) компилирует только Go; [`deploy/server-deploy.sh`](../../deploy/server-deploy.sh) дополнительно копирует ресурсы виджета. Оба не запускают Vite и могут встроить старый `internal/server/admin_dist`.
- Текущий GitHub release workflow публикует binaries и multi-arch image при `v*` tag; image получает tag версии и mutable `latest` ([`.github/workflows/release.yml`](../../.github/workflows/release.yml)). `latest` нельзя считать неизменяемым deployment identity.
- `docker compose` сейчас делает `build: .`, а не pull из registry ([`docker-compose.yml`](../../docker-compose.yml)). Это локальный source build, не доказательство того, что запущен опубликованный image.

**Принятое направление:** согласованная контейнерная поставка и развёртывание по неизменяемому digest. Общие ресурсы должны происходить из того же снимка исходников, что и сервер; конкретный приватный pipeline не является частью OSS-инструкции.

Legacy installer (`reviews install`, [`install.sh`](../../install.sh)) отложен и не удалён. Container-first направление не означает, что старый source/binary deploy уже выключен.

## Compose и постоянные данные

Текущий compose монтирует:

| Путь | Содержимое | Compose storage |
| --- | --- | --- |
| `/data/reviews.db` | SQLite DB, admin/session/tenant/review records | `reviews-data` |
| `/data/review-uploads` | visitor-submitted review media (default при `/data/reviews.db`) | `reviews-data` |
| `/data/product-links.json` | catalog links (compose override) | `reviews-data` |
| `/app/web/reviews-widget/reviews-data` | published static export | `reviews-exports` |

Настройки и defaults находятся в [`internal/config/config.go`](../../internal/config/config.go), compose — в [`docker-compose.yml`](../../docker-compose.yml). В image исходный widget export находится под `/app/web/reviews-widget/reviews-data`, но named volume перекрывает этот путь.

**Важный gap:** `reviews-data` и `reviews-exports` — локальные Docker named volumes. Они не являются backup, не реплицируются и не защищают от удаления хоста/volume. `docker compose down` volumes обычно сохраняет, но `docker compose down -v` удаляет application data. Не используйте `-v` в routine restart. Compose также не монтирует отдельный log volume: логи идут в container stdout/stderr и зависят от runtime log retention.

Внешний PostgreSQL поддерживается драйвером, но текущий Compose принудительно задаёт SQLite DSN `/data/reviews.db`: замены только `REVIEWS_DB_DRIVER` в `.env` недостаточно. Перед переходом подготовьте отдельную конфигурацию DSN и явно задайте постоянный `REVIEWS_UPLOAD_DIR`. При PostgreSQL DSN default upload path становится относительным `data/review-uploads` и не обязан попасть в существующий том `/data`. Файлы медиа/каталога/экспорта сохраняются отдельно от PostgreSQL.

## Backup и restore

Бэкап должен содержать **все четыре** класса состояния:

1. SQLite database (или согласованный PostgreSQL dump);
2. `/data/review-uploads`;
3. `/data/product-links.json` и прочие operator-managed files под `/data`;
4. `/app/web/reviews-widget/reviews-data` (published export).

Если установлена `REVIEWS_CREDENTIALS_KEY`, сохраните её отдельно от БД в защищённом хранилище ключей. Без исходного 32-байтового ключа в base64 зашифрованные marketplace credentials не восстановить. Это касается любой поставки с включённым шифрованием. `.env` и DSN не должны попадать в Git или открытые архивы.

Пример безопасного SQLite backup выполняется на остановленном или quiesced instance и требует установленного `sqlite3`; путь назначения должен быть заранее созданным backup storage, не production volume:

```sh
install -d -m 700 /secure/reviews-backups
sqlite3 /srv/reviews-data/reviews.db ".backup '/secure/reviews-backups/reviews-$(date -u +%Y%m%dT%H%M%SZ).db'"
```

Команда выше предполагает, что host bind-mount действительно находится в `/srv/reviews-data`; это **пример layout, не текущий compose-путь**. Для named volumes сначала используйте инфраструктурный snapshot/экспорт volume, определённый оператором; не угадывайте mountpoint и не архивируйте живую SQLite-файл обычным `cp` во время записи.

Сделайте отдельный архив uploads, product links и published export с сохранением владельца/режимов. Не включайте в публичные issue/PR дампы БД, tokens, session rows или пользовательские media.

Restore-проверка — в отдельном временном проекте и отдельной DB:

Заблокируйте исходящий доступ к маркетплейсам и почте, отключите обновления и фоновые интеграции. Восстановленная БД содержит сохранённые credentials: флаг окружения сам по себе не доказывает, что все пути их проигнорируют. Для проверки используйте отдельного тестового пользователя и никогда не отправляйте реальные ответы/платежи.

1. восстановить DB, uploads, product links и export;
2. вернуть **тот же** credentials key до запуска процесса;
3. запустить `reviews migrate` на копии, затем `reviews serve` с отдельным `--addr` и `--static-dir`;
4. проверить `/healthz`, `/admin/api/setup-status`, вход тестовым администратором, чтение одного review и доступность одного widget asset;
5. проверить, что marketplace credentials не появились в логах и что media/export читаются;
6. зафиксировать длительность и дату backup/restore rehearsal.

Не называйте restore успешным только потому, что `/healthz` вернул 200: endpoint не проверяет БД readiness. Не проверяйте восстановление через production URL и не запускайте `docker compose down -v` как часть rehearsal.

## Миграции и rollback

`reviews migrate` вызывается source-deploy перед перезапуском ([`deploy/server-deploy.sh`](../../deploy/server-deploy.sh)); `openStore` также мигрирует при обычном запуске. Schema migration может быть необратимой относительно старого binary. Поэтому перед upgrade:

- сохранить DB snapshot и проверить, что key backup доступен;
- записать текущий binary/image digest, config и миграционный лог;
- сначала проверить новый binary на копии DB;
- после миграции не откатывать бинарь вслепую к старой версии.

Если новый релиз не стартует, остановите дальнейшую выкладку и сохраните логи. Сначала проверьте совместимость старого артефакта с текущей схемой и возможность исправления вперёд. Восстановление старой БД может потерять новые записи: оно требует явной оценки потерь и согласованного снимка медиа, а не автоматического шага при любой ошибке. Откат образа не откатывает тома или схему; автоматический down-migration в CLI не заявлен.

## Логи, наблюдение и readiness

Go использует `REVIEWS_LOG_LEVEL` (`info` default) и `REVIEWS_LOG_FORMAT` (`text` default; `.env.example` предлагает `json`). Собирайте stdout/stderr container runtime или supervisor, ограничивайте retention и не публикуйте request payloads, tokens, cookies или личные данные. Ошибки sync логируют tenant/marketplace и counts; это не повод включать debug с секретами.

Минимальный liveness check:

```sh
curl --fail --silent --show-error http://127.0.0.1:8080/healthz
```

Проверяйте также process/container state, DB connectivity, свободное место в `/data`, write/read для upload/export directories и свежесть backup. `/healthz` не является readiness и не проверяет внешние marketplace APIs. Для reverse proxy используйте HTTPS и отдельное защищённое admin exposure; не выставляйте raw `:8080` в Internet без perimeter controls.

Внутри middleware выставляются CSP, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, Referrer-Policy и Permissions-Policy ([`internal/server/middleware.go`](../../internal/server/middleware.go)). Static widget assets получают CORS wildcard; API CORS ограничивается configured shop origins. Смена CORS origin требует проверки фактического origin со scheme и host.

## Секреты, сессии и tenant isolation

- `.env.example` документирует env names; `.env` не должен попадать в Git. Оставляйте `REVIEWS_WB_ENABLED`, `REVIEWS_YM_ENABLED`, `REVIEWS_OZON_ENABLED` false, пока credentials не заведены намеренно.
- `REVIEWS_INSECURE_COOKIES` отключает `Secure` flag только для локального HTTP preview. В HTTPS deployment переменная должна отсутствовать.
- Session cookie `reviews_session` — HttpOnly, SameSite=Lax, с TTL 24 часа; state-changing admin calls используют double-submit CSRF cookie/header (`X-CSRF-Token`). Не проксируйте cookies на другой host и не собирайте их в логи.
- В compat mode Core использует неявный tenant. Для strict mode экспортируйте `REVIEWS_COMPAT_SINGLE_TENANT=false` **до запуска процесса**: Go-пакет вычисляет режим до загрузки `.env`. Публичные данные тогда требуют ключ и разделённый экспорт; каждый новый путь доступа всё равно нуждается в проверке tenant scope.
- Wildcard CORS относится к общим файлам виджета, не к tenant API. Неверсионированный URL файла не делает его неизменяемым; кеш и согласованность JS/CSS проверяются отдельно. Не добавляйте `*` в `REVIEWS_SHOP_ORIGIN`.
- Media proxy ограничивает allowlisted CDN host suffixes и размер ответа (default 8 MiB); не расширяйте allowlist до произвольного Internet без threat review. Uploads и user media — персональные данные, их backup access должен быть ограничен.
- `REVIEWS_CREDENTIALS_KEY` защищает stored marketplace credentials at rest только при задании key; self-host default может хранить их plaintext. Для hosted/strict mode key обязательна operational policy.

## Действия при инциденте

1. Остановить sync/rollout, сохранить timestamp и логи до ротации.
2. Отозвать marketplace tokens и session access, если была утечка; не копировать секрет в ticket.
3. Ограничить admin ingress и проверить CORS/public-key boundaries.
4. Сохранить immutable DB/media/export snapshot для расследования.
5. Восстановить проверенный artifact и key из контролируемого backup; migrations не откатывать вручную.
6. После восстановления проверить `/healthz`, login/CSRF, tenant-specific public data и отсутствие secret leakage в логах.

**Open:** точный backup backend/retention, PostgreSQL PITR, production readiness probe и Cloud digest promotion policy ещё не зафиксированы в Core. Не подставляйте в их место вымышленные provider commands или capacity guarantees.
