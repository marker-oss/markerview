# Данные и контракты Core

[Навигация](README.md) · [Архитектура](architecture.md) · Срез исходников: 2026-09-17.

Документ — карта данных для контрибьютора OSS. Он описывает фактические модели и HTTP-контракты по исходникам; `Current` не означает, что здесь выполнен runtime smoke. `Accepted target` — согласованное, но ещё не реализованное направление. `Open question` — намеренно нерешённый контракт.

## Контекст tenant и идентичность

`Current.` [`Tenant`](../../internal/store/tenant_models.go) — shop boundary: `ID`, `Slug`, `PublicKey`, `ShopOrigin`, plan/status и trial timestamps. В standalone есть implicit tenant `1`; в strict mode публичный request должен содержать `public_key`. Ключ разрешается в tenant, проверяется origin и затем помещается в request context. Ошибка неизвестного ключа — 403, paused tenant — 402.

`public_key` — публичный идентификатор tenant для embed/API/static export. Это не пароль, session и не marketplace credential. Session хранится в [`Session`](../../internal/store/auth_models.go), идентифицирует `AdminUser` и tenant, имеет срок действия и передаётся hardened cookie. `requireSession` добавляет tenant/user context для admin handlers.

Персональные данные имеют отдельный контракт: [`ReviewerIdentity`](../../internal/store/models.go) хранит нормализованный email и SHA-256 hash (`HashPII` в `submissions.go`); `Review` хранит email/IP/UA hashes и время согласий. Хеширование не превращает эти данные автоматически в неперсональные. Публичный mapper не должен выдавать raw email. Имя автора marketplace анонимизируется при импорте.

## Основные ключи и deduplication

| Сущность | Логический ключ | Что делает код |
| --- | --- | --- |
| Tenant | `Tenant.ID`; public lookup по `PublicKey` | `tenantScope` выбирает tenant до store-вызова |
| Marketplace product link | `(tenant_id, marketplace, external_product_id)` | unique link в [`models.go`](../../internal/store/models.go); разрешает внутренний `ProductID` |
| Marketplace review | `(tenant_id, marketplace, external_review_id)` | unique index; [`UpsertReview`](../../internal/store/reviews.go) обновляет запись в транзакции |
| Marketplace question | `(tenant_id, marketplace, external_question_id)` | unique index; upsert в `questions.go` |
| Site review | `marketplace=site`, generated `site-<random token>` | token не повторяется при нормальном генераторе; дедупликация повторной формы отдельным ключом не обещана |
| Reviewer | `(tenant_id, email_normalized)` | transaction upserts identity, затем связывает `ReviewerIdentityID` |
| Review media | `(review_id, url)` | Составной уникальный индекс; одинаковый URL у разных отзывов допустим. `replaceMedia` синхронизирует строки конкретного отзыва. |
| Widget config | `(tenant_id, context, version)` | Уникальная версия; операция публикации переключает active в транзакции. Индекс active не уникальный, поэтому конкурентная публикация требует отдельной проверки. |
| App setting / credential | `(tenant_id, key)` / `(tenant_id, marketplace)` | одна строка credentials на marketplace |

Важное следствие: `(external_product_id)` не является глобальным product key — он уникален только вместе с tenant и marketplace. Один и тот же внешний ID на двух площадках может вести к разным links.

## Review и question lifecycle

### Marketplace ingestion

[`collector.Runner`](../../internal/collector/collector.go) получает страницы адаптера, сохраняет `SyncRun`, использует `SyncState.LastSyncedAt` и overlap, затем вызывает store upsert. Review создаётся с `status=imported`, `Raw` очищается. Обновление сохраняет status, visibility, pinned и административный ответ; текстовые поля источника обновляются. Media и ответ маркетплейса синхронизируются в той же транзакции.

Question fetcher — optional adapter capability. Ошибка вопросов логируется и не проваливает review sync; отдельные question upsert errors также не превращают весь run в failure. Новый review помечает export dirty, но сама база не ждёт успешного export.

### Site submission и moderation

`POST /api/review-submissions` принимает multipart, ограничивает тело, проверяет rating, author, email, text, consent, honeypot/rate limit и custom fields. Media сначала пишется во временно контролируемый upload path; при ошибке store вызывается cleanup. [`CreateSiteReview`](../../internal/store/submissions.go) создаёт identity и review одной транзакцией, с `marketplace=site`, `status=pending`, `visibility=hidden`, consent timestamps и hash-полями.

`SetReviewStatus` связывает статус с видимостью: `approved` делает запись видимой, `rejected`/`pending` скрывают её. Другие административные операции также меняют состояние; статус не единственная защита выдачи. Публичные запросы отбирают видимые отзывы в store, затем `Mapper.ReviewHidden` дополнительно исключает скрытые маркетплейсы.

Question answers и seller replies имеют отдельные `PublishState`, `PublishError`, `PublishedAt`. Ответ в store не равен подтверждённой публикации на marketplace: publisher/retry handler обновляет состояние только по результату внешнего вызова.

## Widget config: draft, version, active

`Current.` Client-side draft — `localStorage` key `reviews-draft-{context}` в [`Editor.tsx`](../../web/admin/src/pages/Editor.tsx). Это локальный незапубликованный JSON; private browsing или другой браузер его не обязаны сохранить. Editor читает published config и versions через `/admin/api/widget-config/{context}`.

Server-side [`WidgetConfig`](../../internal/store/widget_config_models.go) содержит `TenantID`, `Context` (`product` или `homepage`), integer `Version`, JSON `Payload`, `Active`, `CreatedAt`. POST publish в [`PublishWidgetConfig`](../../internal/store/widget_config.go) в одной transaction снимает active со старых строк и создаёт `MAX(version)+1`. Rollback выбирает уже существующий version и делает его active; payload не переписывается.

`GET /api/widget-config?context=...` отдаёт active public payload. Config publish помечает static export dirty: marketplace visibility/policy и custom form settings могут менять выдачу. Сейчас TypeScript [`widgetConfig.ts`](../../web/admin/src/widgetConfig.ts) и JS widget имеют частично дублирующиеся defaults/normalization.

**Принятое направление, не реализовано:** общий опубликованный формат, значения по умолчанию и нормализация редактора/виджета. Серверная проверка на границе доверия остаётся необходимой. Сейчас publish handler проверяет контекст, размер и синтаксис JSON, но это ещё не полная валидация схемы. Не путать порядковую версию сохранения конфигурации с версией её формата.

## HTTP routes по роли и CSRF

Полный route tree собирается в [`Server.handler`](../../internal/server/server.go); ниже группы, а не копия каждого response-типа.

### Public / embed (session и CSRF не нужны)

- `GET /api/reviews` — live reviews, filters, pagination и public mapper.
- `GET /api/showcase` — visible showcase.
- `GET /api/widget-config` — active config по context.
- `GET /api/review-submission-config`, `GET /api/question-submission-config` — limits/fields для widget.
- `POST /api/review-submissions`, `POST /api/questions` — public submissions, tenant resolved by `public_key` в strict mode; input validation/rate limits обязательны.
- `GET /api/questions` — answered+visible questions, live-only.
- `GET /api/preview-page` — preview helper.
- `GET /reviews-data/<tenant-key>/...` в strict mode — static files; path key должен совпасть с optional query key.
- `GET /user-media/{token}` — token media; visibility public only for approved/imported visible reviews, otherwise valid session required.
- `GET /media` — configured media proxy; provider allowlist is server-side.
- `GET /healthz` — health probe, tenantless.

Общие JS/CSS, loader и шрифты доступны без tenant-сессии. Их текущие URL не версионированы: это не неизменяемые по содержимому ресурсы; сервер требует перепроверку кеша. Wildcard CORS для общих ресурсов не распространяется автоматически на tenant API и данные.

### Setup/login (не защищены session)

`GET /admin/api/setup-status`, `POST /admin/api/login`, `POST /admin/api/setup`, `POST /admin/api/signup` — lifecycle of local admin/session. Cloud-specific auth hooks mount under `/admin/auth/`; их private behavior не является Core contract.

### Authenticated admin

Все следующие маршруты находятся под `requireSession`; mutating requests обёрнуты `requireCSRF` и требуют CSRF cookie/header pair:

- reviews: `POST /admin/api/reviews/publish`, bulk/PATCH/DELETE/restore/reply/retry;
- questions: answer и answer/retry;
- widget config: publish и rollback; reads config/versions;
- marketplace/settings: credentials PUT, settings PUT, sync POST, site-links refresh POST, showcase-rule PUT;
- tenant/dashboard/diagnostics/version/counts/marketplaces — reads; diagnostics probe — CSRF-protected POST;
- pins: replace/delete are protected, list is read-only;
- DSR delete — protected POST; DSR lookup/export — authenticated reads;
- logout — protected POST.

CSRF защищает browser mutation, но не заменяет tenant scope, role checks или input authorization. GET не должен менять данные только потому, что session присутствует.

## Static export contract

[`export.Bundle`](../../internal/export/export.go) имеет `article`, `aggregate` и `reviews`. Aggregate: `count`, `ratingCount`, rounded `ratingAvg`, integer `recommendPercent` для rating ≥4. [`Index`](../../internal/export/export.go) содержит `generatedAt` и map article → count/ratingAvg. Files лежат в `by-article/<normalized filename>.json` и `index.json`.

`links.json` — [`LinkIndex`](../../internal/export/export.go): `generatedAt`, `byPath`, `byID`, оба указывают на seller article. Loader использует links для SPA navigation, когда DOM request context уже не соответствует текущему URL.

Mapper output включает review ID, marketplace/external IDs, seller article, rating/text, dates, answer, media, product name/price, links, pins и custom data согласно policy. Media fields: kind, URL, optional preview/embed IDs, position, likes и duration. Не добавляйте store-only PII в `reviewjson.Review`.

Серверная публикация строит временный каталог и переключает экспорт через `replaceExportDir`; прямая `export.Write` удаляет старый `by-article` и записывает файлы последовательно. Гарантии при ошибке зависят от пути вызова: нельзя обещать сохранение старого набора для любого CLI export. Ни один путь не является общей транзакцией с БД и браузерным кешем. Dirty-маркер запускает последующую публикацию; live API уже может показывать новое состояние.

## Media, DSR и удаление

Visitor upload допускает только configured image/video MIME/size limits. Файл получает unguessable `AccessToken`, `StoragePath` и URL `/user-media/{token}`. При удалении review store умеет вернуть storage paths; caller должен удалить file, иначе возможен orphan. При замене imported media исчезнувшие URLs удаляются из rows, но удаление внешнего marketplace media не выполняется.

DSR lookup нормализует email, ищет identity и reviews по tenant-scoped hash/identity ID, preloads media. Export возвращает subject identity и review data оператору; delete вызывает hard-delete reviews и identity, записывает [`DSRLog`](../../internal/store/models.go) с email hash/action/time. Удаление может остановиться после частичного счётчика при ошибке; transactional all-or-nothing DSR purge не обещан.

`Open question.` Нужны окончательные retention/SLA правила для upload files, review rows, DSR logs и external marketplace deletion. До решения не документируйте автоматическое физическое удаление как гарантированное.

## Credentials и failure semantics

`MarketplaceCredential` хранит одну credential payload на `(tenant, marketplace)`. В текущем UI это одна учётка каждой подключённой площадки; несколько seller accounts одного marketplace не поддержаны. Payload может быть зашифрован при `REVIEWS_CREDENTIALS_KEY`; legacy plaintext мигрируется при startup. Public key никогда не должен использоваться как credential.

Sync не является all-or-nothing across pages: уже успешные upserts остаются в DB при поздней page/network ошибке, а `SyncRun` получает error. Watermark сохраняется только в конце успешного review path. Внешние reply/question publish failures сохраняются как retryable state. Export dirty — best effort; его ошибка не откатывает ingestion или moderation.

`Open question.` Для future multi-account quota/identity model нужно решить account ID в dedup key, credential rotation и ownership. Сейчас безопасный контракт — ровно одна credentials row на marketplace; не имитируйте multi-account через повторную запись.
