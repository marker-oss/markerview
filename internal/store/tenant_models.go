package store

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"time"

	"gorm.io/gorm"
)

var (
	ErrSignupClosed     = errors.New("signup closed")
	ErrTenantCapReached = errors.New("tenant capacity reached")
)

// Tenant is one seller shop on a shared instance (SaaS) — or the single
// implicit tenant (ID 1) in open-source single-tenant mode.
type Tenant struct {
	ID          uint      `gorm:"primaryKey"`
	Slug        string    `gorm:"size:64;not null;uniqueIndex"`
	PublicKey   string    `gorm:"size:64;not null;uniqueIndex"` // 32 bytes hex
	ShopOrigin  string    `gorm:"size:255;not null"`
	Plan        string    `gorm:"size:16;not null;default:'trial'"` // trial|free|base|pro|pro+
	Status      string    `gorm:"size:16;not null;default:'trial'"` // trial|active|grace|paused
	TrialEndsAt time.Time `gorm:"not null"`
	// PaidUntil extends with each successful payment (billing overlay):
	// an active tenant past PaidUntil degrades to grace/paused. nil for
	// trial/free tenants; the core never sets it.
	PaidUntil *time.Time
	CreatedAt time.Time
}

// EnsureDefaultTenant seeds the implicit tenant 1 once. PublicKey is
// generated per installation; slug and origin stay fixed for the single
// open-source tenant.
func (s *Store) EnsureDefaultTenant(ctx context.Context, shopOrigin string) error {
	var count int64
	if err := s.db.WithContext(ctx).Model(&Tenant{}).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	key := make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		return err
	}
	return s.db.WithContext(ctx).Create(&Tenant{
		ID:         DefaultTenantID,
		Slug:       "default",
		PublicKey:  hex.EncodeToString(key),
		ShopOrigin: shopOrigin,
		// The implicit single-tenant install has no billing lifecycle; it
		// must never be flipped to paused by the trial-expiry job.
		Plan:        "pro+",
		Status:      "active",
		TrialEndsAt: time.Now().UTC().Add(100 * 365 * 24 * time.Hour),
	}).Error
}

// TenantByID loads a tenant by primary key (resolved from the context).
func (s *Store) TenantByID(ctx context.Context) (Tenant, error) {
	var tenant Tenant
	err := s.db.WithContext(ctx).First(&tenant, TenantIDFromCtx(ctx)).Error
	return tenant, err
}

// UpdateTenantShopOrigin keeps the tenant row in sync when the admin edits
// the shop origin setting, so key-scoped CORS on SaaS follows shop moves.
func (s *Store) UpdateTenantShopOrigin(ctx context.Context, tenantID uint, shopOrigin string) error {
	return s.db.WithContext(ctx).Model(&Tenant{}).Where("id = ?", tenantID).
		Update("shop_origin", shopOrigin).Error
}

// TenantByPublicKey resolves a tenant by its public key. Returns ErrNotFound
// for an unknown key.
func (s *Store) TenantByPublicKey(ctx context.Context, publicKey string) (Tenant, error) {
	var tenant Tenant
	err := s.db.WithContext(ctx).Where("public_key = ?", publicKey).First(&tenant).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return Tenant{}, ErrNotFound
	}
	return tenant, err
}

// ListTenants returns every tenant, oldest first. Background loops (sync,
// auto-publish, catalog refresh) iterate it to serve all tenants; admin
// routes never use it.
func (s *Store) ListTenants(ctx context.Context) ([]Tenant, error) {
	var tenants []Tenant
	err := s.db.WithContext(ctx).Order("id asc").Find(&tenants).Error
	return tenants, err
}

// TenantWithAdmin is the result of an atomic signup: the tenant row and its
// first admin user id.
type TenantWithAdmin struct {
	Tenant  Tenant
	AdminID uint
}

// CreateTenantWithAdmin registers a tenant and its first admin in one
// transaction using the self-hosted default 14-day trial.
func (s *Store) CreateTenantWithAdmin(ctx context.Context, login, passwordHash, shopOrigin string) (TenantWithAdmin, error) {
	return s.CreateTenantWithAdminFor(ctx, login, passwordHash, shopOrigin, 14*24*time.Hour, nil)
}

// TenantSignupAdmission runs inside the tenant-creation transaction. A cloud
// overlay can use it to enforce registration state and capacity atomically.
type TenantSignupAdmission func(*gorm.DB) error

// TenantStatusPending marks a hosted tenant whose owner has not confirmed
// their email yet: it occupies capacity but has no trial window and no
// public access. StartTrialOnVerification turns it into a real trial.
const TenantStatusPending = "pending"

// CreateTenantWithAdminFor creates the tenant, its first admin and the shop
// origin setting in one transaction. A non-positive trialDuration creates the
// tenant as pending: the trial only starts once the email is confirmed, so an
// unconfirmed signup can never consume trial days.
func (s *Store) CreateTenantWithAdminFor(ctx context.Context, login, passwordHash, shopOrigin string, trialDuration time.Duration, admission TenantSignupAdmission) (TenantWithAdmin, error) {
	key := make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		return TenantWithAdmin{}, err
	}
	pending := trialDuration <= 0
	var result TenantWithAdmin
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if admission != nil {
			if err := admission(tx); err != nil {
				return err
			}
		}
		tenant := Tenant{
			Slug:       login,
			PublicKey:  hex.EncodeToString(key),
			ShopOrigin: shopOrigin,
		}
		if pending {
			tenant.Status = TenantStatusPending
		} else {
			tenant.TrialEndsAt = time.Now().UTC().Add(trialDuration)
		}
		if err := tx.Create(&tenant).Error; err != nil {
			return err
		}
		admin := AdminUser{TenantID: tenant.ID, Login: login, PasswordHash: passwordHash}
		if err := tx.Create(&admin).Error; err != nil {
			return err
		}
		if err := tx.Create(&AppSetting{TenantID: tenant.ID, Key: SettingShopOrigin, Value: shopOrigin}).Error; err != nil {
			return err
		}
		result = TenantWithAdmin{Tenant: tenant, AdminID: admin.ID}
		return nil
	})
	return result, err
}

// StartTrialOnVerification opens the trial window for a pending tenant once
// its owner confirms the email. Idempotent and single-shot: a tenant that
// already left pending (verified twice, paused, paid) keeps its current
// status and trial end, so a replayed link cannot extend anything.
func (s *Store) StartTrialOnVerification(ctx context.Context, userID uint, trialDuration time.Duration) error {
	if trialDuration <= 0 {
		trialDuration = 7 * 24 * time.Hour
	}
	return s.db.WithContext(ctx).Model(&Tenant{}).
		Where("status = ?", TenantStatusPending).
		Where("id = (?)", s.db.Model(&AdminUser{}).Select("tenant_id").Where("id = ?", userID)).
		Updates(map[string]any{
			"status":        "trial",
			"trial_ends_at": time.Now().UTC().Add(trialDuration),
		}).Error
}

// DeleteExpiredPendingTenants removes hosted signups that were never
// confirmed within the retention window, freeing the capacity they held.
// Returns how many tenants were removed.
func (s *Store) DeleteExpiredPendingTenants(ctx context.Context, retention time.Duration) (int64, error) {
	cutoff := time.Now().UTC().Add(-retention)
	var removed int64
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var ids []uint
		if err := tx.Model(&Tenant{}).
			Where("status = ? AND created_at < ? AND id <> ?", TenantStatusPending, cutoff, DefaultTenantID).
			Pluck("id", &ids).Error; err != nil {
			return err
		}
		if len(ids) == 0 {
			return nil
		}
		if err := tx.Where("tenant_id IN ?", ids).Delete(&AppSetting{}).Error; err != nil {
			return err
		}
		if err := tx.Where("tenant_id IN ?", ids).Delete(&AdminUser{}).Error; err != nil {
			return err
		}
		res := tx.Where("id IN ?", ids).Delete(&Tenant{})
		removed = res.RowsAffected
		return res.Error
	})
	return removed, err
}

// PauseExpiredTrials flips trial tenants whose window has ended to paused.
// Returns how many tenants were paused. Idempotent: already-paused tenants
// are not matched.
func (s *Store) PauseExpiredTrials(ctx context.Context) (int64, error) {
	res := s.db.WithContext(ctx).
		Model(&Tenant{}).
		Where("status = ? AND trial_ends_at < ?", "trial", time.Now().UTC()).
		Update("status", "paused")
	return res.RowsAffected, res.Error
}

// SetTenantStatus updates a tenant's billing status (trial|active|grace|
// paused). Billing webhooks and manual operator actions use it.
func (s *Store) SetTenantStatus(ctx context.Context, tenantID uint, status string) error {
	return s.db.WithContext(ctx).Model(&Tenant{}).
		Where("id = ?", tenantID).
		Update("status", status).Error
}

// CreateTenant registers a new tenant with a generated 32-byte hex public key
// and a 14-day trial window.
func (s *Store) CreateTenant(ctx context.Context, slug, shopOrigin string) (Tenant, error) {
	key := make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		return Tenant{}, err
	}
	tenant := Tenant{
		Slug:        slug,
		PublicKey:   hex.EncodeToString(key),
		ShopOrigin:  shopOrigin,
		TrialEndsAt: time.Now().UTC().Add(14 * 24 * time.Hour),
	}
	err := s.db.WithContext(ctx).Create(&tenant).Error
	return tenant, err
}
