package store

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"

	"gorm.io/gorm"
)

func (s *Store) DeleteTenant(ctx context.Context, tenantID uint, publicKey, uploadDir, exportDir string) error {
	if tenantID == 0 || tenantID == DefaultTenantID {
		return errors.New("cannot delete default tenant")
	}
	var paths []string
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var media []ReviewMedia
		if err := tx.Where("review_id IN (SELECT id FROM reviews WHERE tenant_id = ?)", tenantID).Find(&media).Error; err != nil {
			return err
		}
		for _, item := range media {
			if item.StoragePath != "" {
				paths = append(paths, item.StoragePath)
			}
		}
		if err := tx.Where("review_id IN (SELECT id FROM reviews WHERE tenant_id = ?)", tenantID).Delete(&ReviewMedia{}).Error; err != nil {
			return err
		}
		for _, model := range []any{
			&Review{}, &Question{}, &ProductMarketplaceLink{}, &Product{},
			&ReviewerIdentity{}, &MarketplaceCredential{}, &SyncState{}, &SyncRun{},
			&WidgetConfig{}, &ShowcasePin{}, &ShowcaseRule{}, &AppSetting{}, &Session{}, &AdminUser{},
		} {
			if err := tx.Where("tenant_id = ?", tenantID).Delete(model).Error; err != nil {
				return err
			}
		}
		return tx.Where("id = ?", tenantID).Delete(&Tenant{}).Error
	})
	if err != nil {
		return err
	}
	for _, path := range paths {
		if uploadDir == "" || !pathWithin(uploadDir, path) {
			continue
		}
		_ = os.Remove(path)
	}
	if exportDir != "" && publicKey != "" {
		_ = os.RemoveAll(filepath.Join(exportDir, filepath.Base(publicKey)))
	}
	return nil
}

func pathWithin(root, path string) bool {
	root, err := filepath.Abs(root)
	if err != nil {
		return false
	}
	path, err = filepath.Abs(path)
	if err != nil {
		return false
	}
	rel, err := filepath.Rel(root, path)
	return err == nil && rel != "." && rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator))
}
