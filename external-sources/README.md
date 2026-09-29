# External sources worker

A small Clojure process for source connectors that must run outside the cloud. It only makes outbound HTTP(S) requests: it polls the cloud, claims work, fetches the configured provider JSON API, then posts a result or failure. Tenant and marketplace routing come only from the worker token and cloud job; the worker never accepts or sends a tenant identifier and keeps no database or cursor state.

## Run

Requires JDK 17+ and the Clojure CLI.

```sh
cd external-sources
EXTERNAL_SOURCES_CLOUD_BASE_URL=https://reviews.example.com \
EXTERNAL_SOURCES_WORKER_TOKEN=replace-me \
clojure -M:run
```

Create a worker `SourceConnection` through the authenticated admin API (`POST /admin/api/external-sources`, name/provider/marketplace and optional `method`: `scraper` or `external_service`). Keep the token from its creation response; it is the worker's credential, not a marketplace API key. Create its target with `POST /admin/api/external-sources/{id}/targets` (URL, marketplace, product mapping), then queue with `POST /admin/api/external-sources/{id}/targets/{target}/queue`. Admin mutations require the existing session and CSRF header. Jobs are assigned to the connection's tenant and poll/claim/result must use the same token. No periodic target scheduler is implied by these routes: queue a job explicitly.

For Ozon, the server canonicalizes a product share URL on target creation to HTTPS `www.ozon.ru/product/<slug>-<id>/`, removes its query/fragment and derives `external_product_id` from the path. The public JSON API connector does **not** scrape this card; use a separate compatible private scraper for an Ozon product URL. Provider API endpoints can instead use `config.connector: "json-api"`. Recreating the same Ozon target returns the existing target without resetting its cursor.

Optional environment variables:

- `EXTERNAL_SOURCES_POLL_INTERVAL_MS` (default `30000`)
- `EXTERNAL_SOURCES_MAX_JOBS` (default `10`)
- `EXTERNAL_SOURCES_REQUEST_TIMEOUT_MS` (default `30000`)
- `EXTERNAL_SOURCES_ALLOW_INSECURE_HTTP=true` permits HTTP for local development/tests only

Run the local HTTP integration test with `clojure -M:test`.

## JSON API connector

A claimed job uses `config.connector: "json-api"` (also the default) and an HTTPS `url`. The worker GETs that URL, adding the current job cursor as `?cursor=...`. `config.cursor_param` can rename the query parameter, and `config.headers` supplies provider authentication configured by a trusted cloud administrator.

Provider response:

```json
{
  "cursor": "next-page-token",
  "records": [
    {
      "id": "review-123",
      "author": "Ada",
      "rating": 5,
      "title": "Great",
      "body": "Useful product",
      "pros": "Fast",
      "cons": "",
      "created_at": "2026-09-29T10:00:00Z",
      "updated_at": "2026-09-29T11:00:00Z",
      "url": "https://provider.example/reviews/review-123"
    }
  ]
}
```

`id` and RFC3339 `created_at` are required. Generic provider `id` becomes `provider_record_id`. The worker may forward a provider's `marketplace_review_id`, but the Go server does not treat that claim as a verified marketplace ID unless a trusted provider-specific connector guarantees its provenance; a generic JSON API job cannot grant reply capability. Transport-native fields `external_product_id`, `seller_article`, `author_name`, and `text` are also accepted. The cloud's target product/article mapping is authoritative regardless of worker fields.

## Worker protocol

The cloud returns `contract_version: 1` with a `jobs` array. Each queued job and claim response uses the same fields: `job_id`, `attempt`, `target_id`, `url`, `marketplace`, `external_product_id`, `seller_article`, `config`, `cursor`, and `lease_until`. The claim response carries the active attempt number. The worker posts `{ "contract_version": 1, "attempt": N, "result": { "cursor": "...", "records": [...] } }` to `/external/v1/worker/jobs/{id}/result`. On execution failure it posts `{ "attempt": N, "status": "failed", "error": "..." }` to `/finish`. `/heartbeat` accepts `{ "attempt": N }` to extend the 15-minute lease; an expired or superseded attempt cannot submit a result or finish the job. Partial row errors return HTTP 409 with a report: valid rows remain imported, but the cursor stays unchanged so the job can be retried after correcting the source. A successful result advances the cursor and repeated delivery returns the saved run.

## Limitations

This is not an Ozon scraper and does not execute arbitrary user code. It supports only configured JSON APIs, one response page per claimed job, static request headers, and cursor-based GET pagination. The cloud advances the cursor only after accepting the posted result; connector or result-post failures are reported through the job failure endpoint.
