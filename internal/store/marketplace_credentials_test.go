package store

import (
	"context"
	"testing"
	"time"
)

func ptr(value string) *string { return &value }
func TestMarketplaceCredentialPatchPreservesExistingSecrets(t *testing.T) {
	st := newTestStore(t)
	ctx := context.Background()

	enabled := true
	cred, err := st.SaveMarketplaceCredential(ctx, MarketplaceCredentialPatch{
		Marketplace: "wb",
		Enabled:     &enabled,
		Values:      map[string]string{"token": "token-1"},
	})
	if err != nil {
		t.Fatalf("save initial: %v", err)
	}
	if cred.PayloadMap()["token"] != "token-1" {
		t.Fatalf("token not saved: %+v", cred.PayloadMap())
	}

	disabled := false
	cred, err = st.SaveMarketplaceCredential(ctx, MarketplaceCredentialPatch{
		Marketplace: "wb",
		Enabled:     &disabled,
		Values:      map[string]string{"token": ""},
	})
	if err != nil {
		t.Fatalf("save patch: %v", err)
	}
	if cred.Enabled {
		t.Fatalf("expected disabled credential")
	}
	if cred.PayloadMap()["token"] != "token-1" {
		t.Fatalf("empty patch should preserve token: %+v", cred.PayloadMap())
	}

	items, err := st.ListMarketplaceCredentials(ctx)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(items) != 1 || items[0].Marketplace != "wb" {
		t.Fatalf("unexpected list: %+v", items)
	}
}

func TestPlanLimitsForReadsOperatorSettings(t *testing.T) {
	st := newTestStore(t)
	ctx := context.Background()
	tenant, err := st.CreateTenant(ctx, "limits-shop", "https://shop.example")
	if err != nil {
		t.Fatal(err)
	}
	if err := st.DB().Model(&Tenant{}).Where("id = ?", tenant.ID).Update("plan", "base").Error; err != nil {
		t.Fatal(err)
	}
	ctx = WithTenant(ctx, tenant.ID)
	if err := st.SetAppSetting(ctx, "plan_limits", `{"base":{"maxMarketplaces":1,"maxReviews":123}}`); err != nil {
		t.Fatal(err)
	}
	limits, err := st.PlanLimitsFor(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if limits.MaxMarketplaces != 1 || limits.MaxReviews != 123 {
		t.Fatalf("limits = %+v", limits)
	}
}

func TestMarketplaceCredentialQuotaBlocksNewEnabledConnection(t *testing.T) {
	st := newTestStore(t)
	ctx := context.Background()
	tenant, err := st.CreateTenant(ctx, "quota-shop", "https://shop.example")
	if err != nil {
		t.Fatal(err)
	}
	if err := st.DB().Model(&Tenant{}).Where("id = ?", tenant.ID).Update("plan", "base").Error; err != nil {
		t.Fatal(err)
	}
	ctx = WithTenant(ctx, tenant.ID)
	if _, err := st.SaveMarketplaceCredential(ctx, MarketplaceCredentialPatch{Marketplace: "wb", Values: map[string]string{"token": "wb"}}); err != nil {
		t.Fatal(err)
	}
	if _, err := st.SaveMarketplaceCredential(ctx, MarketplaceCredentialPatch{Marketplace: "ym", Values: map[string]string{"api_key": "ym"}}); err != ErrMarketplaceLimit {
		t.Fatalf("second connection error = %v, want %v", err, ErrMarketplaceLimit)
	}
}

func TestDeleteTenantSweepsTenantDataKeepsAudit(t *testing.T) {
	st := newTestStore(t)
	ctx := context.Background()
	tenant, err := st.CreateTenant(ctx, "delete-shop", "https://shop.example")
	if err != nil {
		t.Fatal(err)
	}
	tenantCtx := WithTenant(ctx, tenant.ID)
	if err := st.DB().Create(&Product{TenantID: tenant.ID, Title: new("product")}).Error; err != nil {
		t.Fatal(err)
	}
	if err := st.DB().Create(&DSRLog{TenantID: tenant.ID, Action: "delete", At: time.Now()}).Error; err != nil {
		t.Fatal(err)
	}
	if err := st.DeleteTenant(ctx, tenant.ID, tenant.PublicKey, "", ""); err != nil {
		t.Fatal(err)
	}
	var products int64
	if err := st.DB().Model(&Product{}).Where("tenant_id = ?", tenant.ID).Count(&products).Error; err != nil {
		t.Fatal(err)
	}
	if products != 0 {
		t.Fatalf("products after delete = %d", products)
	}
	var audit int64
	if err := st.DB().Model(&DSRLog{}).Where("tenant_id = ?", tenant.ID).Count(&audit).Error; err != nil {
		t.Fatal(err)
	}
	if audit != 1 {
		t.Fatalf("audit rows after delete = %d", audit)
	}
	if _, err := st.TenantByID(tenantCtx); err == nil {
		t.Fatal("tenant still exists")
	}
}
