# Разработка

[Навигация](README.md) · [Контракты](data-and-contracts.md) · Срез исходников: 2026-09-17.

Документ для контрибьютора публичного Core. Он описывает **текущее состояние**, прослеженное по исходникам, а не обещанный runtime-результат. Команды ниже рассчитаны на локальный sandbox без реальных marketplace-ключей и без изменения production.

## Карта исходников

- Go-модуль и версия языка: [`go.mod`](../../go.mod).
- CLI и флаги: [`cmd/reviews/main.go`](../../cmd/reviews/main.go).
- Переменные окружения и значения по умолчанию: [`internal/config/config.go`](../../internal/config/config.go), [`.env.example`](../../.env.example).
- HTTP-маршруты, сессии и middleware: [`internal/server/server.go`](../../internal/server/server.go), [`internal/server/middleware.go`](../../internal/server/middleware.go).
- Админский React/Vite-проект: [`web/admin/package.json`](../../web/admin/package.json), [`web/admin/vite.config.ts`](../../web/admin/vite.config.ts), [`web/admin/src/`](../../web/admin/src/).
- Публичный виджет и browser-checks: [`web/reviews-widget/`](../../web/reviews-widget/), [`web/reviews-widget/test/`](../../web/reviews-widget/test/).
- Docker packaging: [`Dockerfile`](../../Dockerfile), [`docker-compose.yml`](../../docker-compose.yml).

## Требования к инструментам

Текущий Go-модуль требует Go **1.26.3 или совместимую более новую версию** (строка `go` в `go.mod`). CI получает версию из `go.mod`; проверьте `go version`. С `GOTOOLCHAIN=local` старый локальный Go завершится ошибкой, а не загрузит toolchain автоматически.

Dockerfile использует Node 22; для Vite 7 нужен совместимый patch-релиз, например **Node 22.12+**. Используйте актуальный Node 22 и npm; зависимости фиксируются `web/admin/package-lock.json`. `npm ci` не должен менять lockfile. Если менеджер пакетов блокирует install scripts, разберите конкретную зависимость, не отключайте проверки глобально.

Не добавляйте ключи marketplace в рабочий checkout. `.env` автоматически читается из текущего рабочего каталога при загрузке конфигурации; поэтому sandbox запускайте из отдельного временного каталога.

## Установка зависимостей

```sh
# Go-зависимости; изменяет только локальный модульный кэш
GOTOOLCHAIN=local go mod download

# Админка; lock-файл не редактируется
cd web/admin
npm ci
cd ../..
```

`npm run dev` и `npm run preview` уже привязаны к `127.0.0.1`; это локальные режимы Vite. В production сервер отдаёт встроенную SPA из `internal/server/admin_dist`.

## Админка и Vite base

[`vite.config.ts`](../../web/admin/vite.config.ts) устанавливает `base: '/admin/'`. Поэтому собранные JS/CSS-ссылки начинаются с `/admin/` и должны обслуживаться по пути `/admin/`.

В default-конфигурации Vite **нет `server.proxy`**. Dev-server не проксирует `/admin/api/*` к Go-серверу. Для настоящего API-потока запускайте Go отдельно и используйте серверную embedded-админку либо явно настраивайте локальную инфраструктуру в непубликуемом окружении; не документируйте отсутствующий proxy как существующий контракт.

Команда `npm run build` пишет `web/admin/dist`. Скрипт [`web/admin/build-embed.sh`](../../web/admin/build-embed.sh) затем копирует результат в `internal/server/admin_dist`, то есть изменяет checked-in/generated assets. Не запускайте его в обычной рабочей копии только для проверки.

Безопасные варианты получить свежую админку:

1. Для проверки сборки оставьте результат в `web/admin/dist` и не копируйте его в Go-дерево:

   ```sh
   cd web/admin
   npm ci
   npm run build
   ```

2. Для свежей встроенной SPA используйте Dockerfile в чистом публичном checkout: web-stage выполняет `npm ci` и сборку до компиляции Go. Не создавайте публичный образ из смешанного дерева с локальными закрытыми материалами без проверки build context.

3. Для локального embedded-бинаря подготовьте отдельную временную копию **только публичных исходников**. В ней выполняйте `(cd web/admin && ./build-embed.sh)`, затем `go build`. Скрипт зависит от рабочего каталога; запуск `./web/admin/build-embed.sh` из корня неверен. Оригинальные `internal/server/admin_dist` и lockfile не изменяйте.

## Изолированный локальный запуск

По умолчанию `serve` слушает `127.0.0.1:8080`, использует SQLite `./reviews.db`, включает безопасные cookies и запускает автопубликацию. Для sandbox задайте отдельный DSN и отдельный `--static-dir`; нельзя направлять writable static export в исходный `web/reviews-widget`.

Из корня Core; сборка и данные остаются в `$tmp`. Встроенная SPA здесь берётся из существующего `admin_dist`, поэтому этот сценарий проверяет запуск backend, не свежесть интерфейса:

```sh
tmp="$(mktemp -d)"
go build -o "$tmp/reviews" ./cmd/reviews
mkdir -p "$tmp/static"
cp -a web/reviews-widget/. "$tmp/static/"
(
  cd "$tmp"
  env -i PATH="$PATH" HOME="$HOME" \
    REVIEWS_DB_DRIVER=sqlite \
    REVIEWS_DB_DSN="$tmp/reviews.db" \
    REVIEWS_COMPAT_SINGLE_TENANT=true \
    REVIEWS_WB_ENABLED=false \
    REVIEWS_YM_ENABLED=false \
    REVIEWS_OZON_ENABLED=false \
    REVIEWS_UPDATE_CHECK=false \
    REVIEWS_SITE_PRODUCT_LINKS="$tmp/product-links.json" \
    REVIEWS_UPLOAD_DIR="$tmp/uploads" \
    REVIEWS_INSECURE_COOKIES=1 \
    "$tmp/reviews" serve --addr 127.0.0.1:18088 --static-dir "$tmp/static"
)
```

Пока процесс работает, откройте `http://127.0.0.1:18088/admin/`; свежая тестовая БД предложит создать администратора. Во втором терминале можно проверить `curl --fail http://127.0.0.1:18088/healthz`. После проверки остановите процесс и удалите только созданный `$tmp`; не используйте `rm -rf` с непроверенной переменной.

Текущая проверка, выполненная отдельно от документации 17.09.2026: бинарь был собран из `./cmd/reviews`; sandbox с копией widget assets стартовал на `127.0.0.1:18088`; `/healthz`, `/admin/`, widget JS/CSS и `/admin/api/setup-status` ответили ожидаемо. Это ограниченная smoke-проверка, не доказательство marketplace sync, auth-flow или свежести embedded SPA.

### Проверка через контейнер

`docker compose up --build` — существующая команда, но **не безопасный изолированный smoke по умолчанию**: Compose загружает локальный `.env`, публикует порт на всех интерфейсах и использует постоянные тома. Выполняйте её только в отдельном тестовом проекте с подготовленным окружением; контейнерные данные описаны в [эксплуатации](operations-and-security.md).

## CLI для локальной проверки

Актуальные команды печатает сам бинарь (`reviews` без аргументов):

```text
reviews migrate
reviews admin reset-password --login LOGIN --password PASSWORD
reviews install
reviews sync --once [--marketplace wb|ym|ozon]
reviews serve [--addr 127.0.0.1:8080] [--with-sync]
reviews discover-site-urls
reviews export [--out web/reviews-data]
```

`sync` требует `--once` и реальные credentials; в sandbox его не запускайте. `--with-sync` включает периодический sync всех tenants; это не безопасный default для изолированной проверки. `migrate` и `export` изменяют указанные данные, поэтому используйте только временный DSN и static directory.

Передача пароля через CLI может оставить его в истории shell и списке процессов; не используйте этот пример с реальными паролями в общем терминале или CI-логе.

## Тесты и browser checks

CI запускает `go test ./...` и затем [`deploy/build.sh`](../../deploy/build.sh), но проектный набор может затрагивать локальные файлы и внешние предпосылки. Перед PR предпочтительнее узкий пакетный тест:

```sh
go test ./internal/server -run '^(TestStrictStaticExportRequiresMatchingPathKey|TestCORSAllowsAnonymousSharedWidgetAssetsOnly)$' -count=1 -v
```

Это существующие тесты границ публичного экспорта и общих ресурсов. В выводе должны присутствовать оба имени, а не `no tests to run`. Фильтр `-run` не отменяет компиляцию остальных тестовых файлов пакета: известные конфликты рабочего дерева описаны в [статусе](status.md). Здесь эта Go-команда не объявляется прошедшей. Перед PR выполняйте полный набор в чистой воспроизводимой среде; зелёный unit-тест не доказывает внешнюю интеграцию.

Browser-проверки виджета — автономные HTML-страницы, например [`loader.test.html`](../../web/reviews-widget/test/loader.test.html) и [`widget.test.html`](../../web/reviews-widget/test/widget.test.html). Подайте каталог `web/reviews-widget` через stdlib static server и откройте HTML в Chromium:

```sh
python3 -m http.server 18080 --bind 127.0.0.1 --directory web/reviews-widget
```

Затем откройте `http://127.0.0.1:18080/test/loader.test.html` и `http://127.0.0.1:18080/test/widget.test.html`; проверьте `<pre>`/`document.title`: страница сама выводит `PASS`/`FAIL`. Остановите server после проверки. Не открывайте `file://`, если проверка использует fetch или module/security behavior.

После изменения `loader.js`, `reviews-widget.js`, CSS или config дополнительно откройте [`demo.html`](../../web/reviews-widget/demo.html) и страницу с реальным test fixture. Questions API без работающего сервера может быть пустым — это не ошибка browser harness.

Проверено 17.09.2026 через этот static-server в Chromium: `loader.test.html` — 53 passed, 0 failed; `widget.test.html` — 77 passed, 0 failed. Это результаты двух HTML-проверок текущего рабочего дерева, не полного browser-набора и не внешних интеграций.

## PR-практики

- Сначала опишите observable contract и затронутый маршрут/CLI-флаг; повторно используйте существующий config и middleware.
- Не коммитьте `.env`, токены, SQLite production DB, `dist`, временные uploads или случайно обновлённый `internal/server/admin_dist`.
- Для frontend-изменений приложите результат локальной Vite-сборки и browser-check, но не подменяйте generated asset ручным редактированием.
- Для API/security-изменений добавьте узкий тест на границу: auth, CSRF, tenant scope или CORS; не маскируйте внешнюю интеграцию mock-успехом.
- В описании PR явно разделяйте проверенное локально и не проверенное из-за отсутствия credentials/marketplace.
- CI workflow называется `CI`; release workflow собирает binaries и image на `v*` tag. Deployment не является частью обычного PR.

## Известные границы

**Current:** Go binary, static widget, embedded admin SPA и Docker image — разные packaging paths. `deploy/build.sh` и source-deploy компилируют Go, но не запускают Vite; Dockerfile запускает Vite в web-stage.

**Accepted target (не реализовано):** общая OSS App и явный private overlay для Cloud без замены Core-файла; pinned Core SHA и staged same-Go-module build. Не проектируйте plugin framework или npm registry.

**Open:** какой именно release-проверочный набор будет обязательным для свежего embedded admin; default proxy для frontend не утверждён. До решения используйте source-traced пути выше.

`reviews install` остаётся встроенным мастером настройки бинаря. Отдельного shell-bootstrap `install.sh` больше нет; contributor setup на нём не зависит.
