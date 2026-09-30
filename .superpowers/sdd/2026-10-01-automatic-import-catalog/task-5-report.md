# Task 5 report

## Status

Implemented the Task 5 isolated end-to-end coverage and workflow documentation. No production targets or jobs were created; tests use `t.TempDir()` SQLite stores and an in-memory HTTP handler.

## Changes

- Added `TestAutomaticImportTenantLifecycle` in `internal/server/automatic_import_test.go`.
  - Creates tenant A and tenant B with separate scraper connections and sessions.
  - Enables automatic import only for A, adds two products, rejects the third at the enabled-target limit.
  - Confirms B cannot see, queue, disable, claim, or receive A's targets/jobs.
  - Confirms disabling a target frees an enabled-target slot.
  - Carries A's canonical URL, product ID, seller article, and tenant-owned connection into the existing worker contract.
  - Sends spoofed tenant/product/marketplace fields in the worker result and verifies server-owned routing remains authoritative.
  - Verifies the imported review is tenant-scoped, marked `imported`/`scraper`, has authoritative Ozon product mapping, and cannot publish a marketplace reply.
  - Verifies the client status transitions to `succeeded` with a sync timestamp after result submission.
- Updated `docs/user-guide.md` with the exact operator-enable → add products → queue → status flow, worker-token boundary, tenant isolation, and enabled-target limit semantics.
- Updated `external-sources/README.md` with the tenant-facing flow and connection/job ownership rules.
- Updated `docs/technical/operations-and-security.md` with operator API policy controls and the no-production-local-verification rule.

## Verification

- `go test ./internal/external_sources ./internal/server ./internal/store -count=1` — passed.
- `cd external-sources && clojure -M:test` — passed: 3 tests, 13 assertions, 0 failures, 0 errors. The expected connector-failure case logs `Job 9 failed: Unsupported connector unknown` while the assertion suite remains green.
- `cd web/admin && npm run build` — passed (`vite v7.3.5`, 55 modules transformed).
- `git diff --check` — passed.
- `go test ./internal/server -run '^TestAutomaticImportTenantLifecycle$' -count=1` — passed independently.

## Concerns

- The requested frontend command is scoped to `web/admin`; running `npm run build` from repository root is not applicable because the root has no `package.json`.
- Existing worker test output includes the expected simulated failure log noted above; it does not fail the test command.
- Production provisioning/rollout remains intentionally out of scope.
