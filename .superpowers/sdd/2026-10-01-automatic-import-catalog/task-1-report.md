# Task 1 report: tenant automatic-import policy/storage helpers

## Files changed
- `internal/store/tenant_models.go` — added tenant columns `AutomaticImportEnabled` (default false) and `AutomaticImportLimit` (default 0). Existing `Store.Migrate` already AutoMigrates `Tenant`, so no migration-list change was needed.
- `internal/store/automatic_import.go` — added `AutomaticImportPolicy`, `GetAutomaticImportPolicy`, `SetAutomaticImportPolicy`, `CountEnabledScrapeTargets`, and `ErrInvalidAutomaticImportLimit`.
- `internal/store/automatic_import_test.go` — focused tests for defaults, enable/disable, negative-limit validation, enabled/disabled target counting, scraper-only ownership, and tenant isolation.

## Design
Policy is stored directly on the tenant row, following the existing tenant/settings model and AutoMigrate convention. New and existing tenants read as disabled with limit 0 until explicitly enabled. Negative limits are rejected before any database operation. Target counts are filtered by tenant, enabled state, and a tenant-matched `SourceConnection` whose method is `scraper`; API-owned targets and disabled targets do not consume the count.

## Tests / commands / output
- Initial focused command: `go test ./internal/store -run 'AutomaticImport|Tenant' -count=1`
- Initial output: `ok reviews/internal/store 0.144s`
- Review regression command after unknown-tenant fix: `go test ./internal/store -run 'AutomaticImport|Tenant' -count=1`
- Review regression output: `ok reviews/internal/store 0.176s`

## Review fix
`SetAutomaticImportPolicy` now returns `ErrNotFound` when the tenant update affects zero rows. Added `TestSetAutomaticImportPolicyRejectsUnknownTenant`.

## Concerns
- `store.go` was not modified because its existing `AutoMigrate(&Tenant{})` automatically applies the new columns.
