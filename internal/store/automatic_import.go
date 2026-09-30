package store

import (
	"context"
	"errors"
)

// AutomaticImportPolicy controls whether scraper targets may be imported for a tenant.
type AutomaticImportPolicy struct {
	Enabled bool
	Limit   int
}

var ErrInvalidAutomaticImportLimit = errors.New("automatic import limit must be non-negative")

// GetAutomaticImportPolicy returns a tenant's policy. Tenant fields default to
// disabled with no active targets, including rows created before this policy.
func (s *Store) GetAutomaticImportPolicy(ctx context.Context, tenantID uint) (AutomaticImportPolicy, error) {
	var tenant Tenant
	if err := s.db.WithContext(ctx).Select("automatic_import_enabled", "automatic_import_limit").First(&tenant, tenantID).Error; err != nil {
		return AutomaticImportPolicy{}, err
	}
	return AutomaticImportPolicy{Enabled: tenant.AutomaticImportEnabled, Limit: tenant.AutomaticImportLimit}, nil
}

// SetAutomaticImportPolicy updates a tenant's policy after validating the limit.
func (s *Store) SetAutomaticImportPolicy(ctx context.Context, tenantID uint, enabled bool, limit int) error {
	if limit < 0 {
		return ErrInvalidAutomaticImportLimit
	}
	result := s.db.WithContext(ctx).Model(&Tenant{}).Where("id = ?", tenantID).Updates(map[string]any{
		"automatic_import_enabled": enabled,
		"automatic_import_limit":   limit,
	})
	return result.Error
}

// CountEnabledScrapeTargets counts enabled targets owned by scraper connections
// for one tenant. The join prevents API-managed targets from consuming the limit.
func (s *Store) CountEnabledScrapeTargets(ctx context.Context, tenantID uint) (int64, error) {
	var count int64
	err := s.db.WithContext(ctx).Model(&ScrapeTarget{}).
		Joins("JOIN source_connections ON source_connections.id = scrape_targets.source_connection_id AND source_connections.tenant_id = scrape_targets.tenant_id").
		Where("scrape_targets.tenant_id = ? AND scrape_targets.enabled = ? AND source_connections.method = ?", tenantID, true, "scraper").
		Count(&count).Error
	return count, err
}
