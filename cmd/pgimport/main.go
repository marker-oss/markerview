// sqlite-to-postgres data migration for the Reviews server.
//
// Reads every table from the production SQLite database and inserts the rows
// into a freshly migrated (schema-only) Postgres database, preserving IDs.
// Column lists are read dynamically per table (no positional coupling); the
// only hardcoded knowledge is the table list in dependency order and the
// boolean column names, because SQLite stores booleans as 0/1 while the
// Postgres driver expects true/false.
//
// Usage:
//
//	REVIEWS_SQLITE_PATH=/srv/reviews/reviews.db \
//	REVIEWS_PG_DSN='host=127.0.0.1 port=5432 user=reviews password=... dbname=reviews sslmode=disable' \
//	go run ./cmd/pgimport
package main

import (
	"fmt"
	"log/slog"
	"os"

	"github.com/glebarez/sqlite"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"gorm.io/gorm/logger"
)

// FK-safe order: parents before children.
var tables = []string{
	"tenants",
	"admin_users",
	"sessions",
	"products",
	"product_marketplace_links",
	"reviewer_identities",
	"marketplace_credentials",
	"sync_states",
	"sync_runs",
	"showcase_rules",
	"showcase_pins",
	"app_settings",
	"widget_configs",
	"dsr_logs",
	"questions",
	"reviews",
	"review_media",
}

// SQLite stores booleans as integers 0/1; postgres boolean columns reject
// bare numbers, so these columns get an explicit typed conversion.
var boolColumns = map[string]map[string]bool{
	"reviews":                   {"pinned": true},
	"sync_states":               {"backfilled": true},
	"showcase_rules":            {"require_photo": true},
	"widget_configs":            {"active": true},
	"marketplace_credentials":   {"enabled": true},
	"products":                  {},
	"product_marketplace_links": {},
	"tenants":                   {},
}

func main() {
	sqlitePath := os.Getenv("REVIEWS_SQLITE_PATH")
	pgDSN := os.Getenv("REVIEWS_PG_DSN")
	if sqlitePath == "" || pgDSN == "" {
		fmt.Fprintln(os.Stderr, "REVIEWS_SQLITE_PATH and REVIEWS_PG_DSN are required")
		os.Exit(2)
	}

	src, err := gorm.Open(sqlite.Open(sqlitePath), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		fatal("open sqlite", err)
	}
	dst, err := gorm.Open(postgres.Open(pgDSN), &gorm.Config{Logger: logger.Default.LogMode(logger.Warn)})
	if err != nil {
		fatal("open postgres", err)
	}

	for _, table := range tables {
		if err := migrateTable(src, dst, table); err != nil {
			fatal("migrate "+table, err)
		}
	}

	for _, table := range []string{"reviews", "questions", "dsr_logs"} {
		var maxID int64
		if err := dst.Raw("SELECT COALESCE(MAX(id), 0) FROM " + table).Scan(&maxID).Error; err != nil {
			fatal("max id "+table, err)
		}
		if maxID == 0 {
			continue // empty table: sequence stays at the migration default
		}
		if err := dst.Exec("SELECT setval(pg_get_serial_sequence(?, 'id'), ?)", table, maxID).Error; err != nil {
			fatal("setval "+table, err)
		}
	}

	slog.Info("migration complete")
}

func migrateTable(src, dst *gorm.DB, table string) error {
	var columns []struct {
		Name string
	}
	if err := src.Raw("SELECT name FROM pragma_table_info(?) ORDER BY cid", table).Scan(&columns).Error; err != nil {
		return fmt.Errorf("read columns: %w", err)
	}
	if len(columns) == 0 {
		return fmt.Errorf("table %s not found", table)
	}
	names := make([]string, len(columns))
	for i, c := range columns {
		names[i] = c.Name
	}

	var rows []map[string]any
	if err := src.Raw("SELECT * FROM " + table).Find(&rows).Error; err != nil {
		return fmt.Errorf("read rows: %w", err)
	}
	if len(rows) == 0 {
		slog.Info("table skipped (empty)", "table", table)
		return nil
	}

	// Convert bools per column.
	for _, row := range rows {
		for name, raw := range row {
			if boolColumns[table][name] {
				switch v := raw.(type) {
				case int64:
					row[name] = v != 0
				case float64:
					row[name] = v != 0
				}
			}
		}
	}

	// Postgres binds at most 65535 parameters per statement; thousands of
	// reviews × 36 columns exceed that, so insert in chunks.
	const chunk = 500
	var inserted int64
	for start := 0; start < len(rows); start += chunk {
		end := start + chunk
		if end > len(rows) {
			end = len(rows)
		}
		part := rows[start:end]
		res := dst.Table(table).
			Clauses(clause.OnConflict{DoNothing: true}).
			Create(&part)
		if res.Error != nil {
			return fmt.Errorf("insert rows %d..%d: %w", start, end, res.Error)
		}
		inserted += res.RowsAffected
	}
	slog.Info("table migrated", "table", table, "rows", len(rows), "inserted", inserted)
	return nil
}

func fatal(what string, err error) {
	slog.Error(what, "error", err)
	os.Exit(1)
}
