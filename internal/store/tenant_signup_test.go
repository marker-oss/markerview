package store

import (
	"context"
	"testing"
	"time"
)

// TestPauseExpiredTrials proves the trial job's store method flips only
// expired trials and is idempotent. Uses the raw db handle (store-package
// tests may) to backdate one tenant's trial window.
func TestPauseExpiredTrials(t *testing.T) {
	s := newTestStore(t)
	ctx := context.Background()

	expired, err := s.CreateTenant(ctx, "expired", "https://e.example")
	if err != nil {
		t.Fatalf("create expired: %v", err)
	}
	active, err := s.CreateTenant(ctx, "active", "https://a.example")
	if err != nil {
		t.Fatalf("create active: %v", err)
	}
	if err := s.db.Model(&Tenant{}).Where("id = ?", expired.ID).
		Update("trial_ends_at", time.Now().UTC().Add(-time.Hour)).Error; err != nil {
		t.Fatalf("backdate trial: %v", err)
	}

	n, err := s.PauseExpiredTrials(ctx)
	if err != nil {
		t.Fatalf("pause expired: %v", err)
	}
	if n != 1 {
		t.Fatalf("paused %d tenants, want 1", n)
	}
	// Idempotent: the second run matches nothing.
	n2, err := s.PauseExpiredTrials(ctx)
	if err != nil || n2 != 0 {
		t.Fatalf("second run paused %d, err=%v; want 0", n2, err)
	}

	got, err := s.TenantByPublicKey(ctx, expired.PublicKey)
	if err != nil || got.Status != "paused" {
		t.Fatalf("expired tenant status = %q err=%v, want paused", got.Status, err)
	}
	gotActive, err := s.TenantByPublicKey(ctx, active.PublicKey)
	if err != nil || gotActive.Status != "trial" {
		t.Fatalf("active tenant status = %q err=%v, want trial", gotActive.Status, err)
	}
}

// TestCreateTenantWithAdmin proves the atomic signup: tenant + admin in one
// transaction, admin scoped to the new tenant, globally unique login.
func TestCreateTenantWithAdmin(t *testing.T) {
	s := newTestStore(t)
	ctx := context.Background()

	result, err := s.CreateTenantWithAdmin(ctx, "seller1", "hash-1", "https://shop1.example")
	if err != nil {
		t.Fatalf("signup: %v", err)
	}
	if result.AdminID == 0 || result.Tenant.ID == 0 {
		t.Fatalf("result = %+v, want nonzero ids", result)
	}
	if result.Tenant.Status != "trial" {
		t.Fatalf("status = %q, want trial", result.Tenant.Status)
	}
	if result.Tenant.TrialEndsAt.Before(time.Now().UTC()) {
		t.Fatal("trial window must start in the future")
	}

	// The admin belongs to the new tenant, not tenant 1.
	admin, err := s.GetAdminUserByLogin(ctx, "seller1")
	if err != nil {
		t.Fatalf("lookup admin: %v", err)
	}
	if admin.TenantID != result.Tenant.ID {
		t.Fatalf("admin tenant = %d, want %d", admin.TenantID, result.Tenant.ID)
	}
	shopOrigin, err := s.GetAppSetting(WithTenant(ctx, result.Tenant.ID), SettingShopOrigin)
	if err != nil || shopOrigin != "https://shop1.example" {
		t.Fatalf("shop origin setting = %q err=%v", shopOrigin, err)
	}

	// Duplicate login fails the transaction; no tenant row leaks.
	if _, err := s.CreateTenantWithAdmin(ctx, "seller1", "hash-2", "https://shop2.example"); err == nil {
		t.Fatal("duplicate login must fail")
	}
	var count int64
	s.db.Model(&Tenant{}).Where("slug = ?", "seller1").Count(&count)
	if count != 1 {
		t.Fatalf("tenant rows with slug seller1 = %d, want 1 (transaction must roll back)", count)
	}
}

// TestPendingSignupHoldsNoTrialUntilVerified proves the hosted lifecycle:
// a signup without a trial duration parks the tenant in pending with no trial
// window, confirming the email opens exactly one 7-day window, and a replayed
// confirmation cannot extend it.
func TestPendingSignupHoldsNoTrialUntilVerified(t *testing.T) {
	s := newTenantIsolationStore(t)
	ctx := WithTenant(context.Background(), DefaultTenantID)

	created, err := s.CreateTenantWithAdminFor(ctx, "seller@example.com", "hash", "https://shop.example", 0, nil)
	if err != nil {
		t.Fatalf("signup: %v", err)
	}
	if created.Tenant.Status != TenantStatusPending {
		t.Fatalf("status = %q, want %q", created.Tenant.Status, TenantStatusPending)
	}
	if !created.Tenant.TrialEndsAt.IsZero() {
		t.Fatalf("pending tenant must not carry a trial window, got %v", created.Tenant.TrialEndsAt)
	}

	if err := s.StartTrialOnVerification(ctx, created.AdminID, 7*24*time.Hour); err != nil {
		t.Fatalf("start trial: %v", err)
	}
	verified, err := s.TenantByPublicKey(ctx, created.Tenant.PublicKey)
	if err != nil {
		t.Fatal(err)
	}
	if verified.Status != "trial" {
		t.Fatalf("status after verification = %q, want trial", verified.Status)
	}
	remaining := time.Until(verified.TrialEndsAt)
	if remaining < 6*24*time.Hour || remaining > 7*24*time.Hour+time.Minute {
		t.Fatalf("trial window = %v, want ~7 days", remaining)
	}

	// A replayed confirmation must not move the deadline.
	if err := s.StartTrialOnVerification(ctx, created.AdminID, 30*24*time.Hour); err != nil {
		t.Fatalf("replayed verification: %v", err)
	}
	again, err := s.TenantByPublicKey(ctx, created.Tenant.PublicKey)
	if err != nil {
		t.Fatal(err)
	}
	if !again.TrialEndsAt.Equal(verified.TrialEndsAt) {
		t.Fatalf("replay extended trial from %v to %v", verified.TrialEndsAt, again.TrialEndsAt)
	}
}

// TestExpiredPendingSignupsAreRemoved proves unconfirmed signups free the
// capacity they hold, while confirmed and fresh ones survive.
func TestExpiredPendingSignupsAreRemoved(t *testing.T) {
	s := newTenantIsolationStore(t)
	ctx := WithTenant(context.Background(), DefaultTenantID)

	stale, err := s.CreateTenantWithAdminFor(ctx, "stale@example.com", "hash", "https://stale.example", 0, nil)
	if err != nil {
		t.Fatal(err)
	}
	fresh, err := s.CreateTenantWithAdminFor(ctx, "fresh@example.com", "hash", "https://fresh.example", 0, nil)
	if err != nil {
		t.Fatal(err)
	}
	live, err := s.CreateTenantWithAdminFor(ctx, "live@example.com", "hash", "https://live.example", 7*24*time.Hour, nil)
	if err != nil {
		t.Fatal(err)
	}
	old := time.Now().UTC().Add(-8 * 24 * time.Hour)
	if err := s.DB().Model(&Tenant{}).Where("id = ?", stale.Tenant.ID).Update("created_at", old).Error; err != nil {
		t.Fatal(err)
	}

	n, err := s.DeleteExpiredPendingTenants(ctx, 7*24*time.Hour)
	if err != nil {
		t.Fatalf("cleanup: %v", err)
	}
	if n != 1 {
		t.Fatalf("removed = %d, want 1", n)
	}
	if _, err := s.TenantByPublicKey(ctx, stale.Tenant.PublicKey); err == nil {
		t.Fatal("expired pending tenant must be gone")
	}
	for _, kept := range []Tenant{fresh.Tenant, live.Tenant} {
		if _, err := s.TenantByPublicKey(ctx, kept.PublicKey); err != nil {
			t.Fatalf("tenant %s must survive cleanup: %v", kept.Slug, err)
		}
	}
	var admins int64
	if err := s.DB().Model(&AdminUser{}).Where("tenant_id = ?", stale.Tenant.ID).Count(&admins).Error; err != nil {
		t.Fatal(err)
	}
	if admins != 0 {
		t.Fatalf("admin rows left behind = %d", admins)
	}
}
