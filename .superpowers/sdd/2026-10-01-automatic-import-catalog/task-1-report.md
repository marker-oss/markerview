# Task 1 report: tenant automatic-import policy/storage helpers

## Files changed
- `internal/store/tenant_models.go` — added tenant columns `AutomaticImportEnabled` (default false) and `AutomaticImportLimit` (default 0). Existing `Store.Migrate` already AutoMigrates `Tenant`, so no migration-list change was needed.
- `internal/store/automatic_import.go` — added `AutomaticImportPolicy`, `GetAutomaticImportPolicy`, `SetAutomaticImportPolicy`, `CountEnabledScrapeTargets`, and `ErrInvalidAutomaticImportLimit`.
- `internal/store/automatic_import_test.go` — focused tests for defaults, enable/disable, negative-limit validation, enabled/disabled target counting, scraper-only ownership, and tenant isolation.

## Design
Policy is stored directly on the tenant row, following the existing tenant/settings model and AutoMigrate convention. New and existing tenants read as disabled with limit 0 until explicitly enabled. Negative limits are rejected before any database operation. Target counts are filtered by tenant, enabled state, and a tenant-matched `SourceConnection` whose method is `scraper`; API-owned targets and disabled targets do not consume the count.

## Tests / commands / output
- `go test ./internal/store -run 'AutomaticImport|Tenant' -count=1`
- Output: `ok reviews/internal/store 0.144s`

## Concerns
- `SetAutomaticImportPolicy` follows existing update-helper behavior and returns nil for a nonexistent tenant because GORM reports no error for zero affected rows; later API validation may choose to enforce existence explicitly.
- `store.go` was not modified because its existing `AutoMigrate(&Tenant{})` automatically applies the new columns.
