package store

import (
	"context"
	"errors"
	"testing"
)

func TestAutomaticImportPolicyDefaultsAndUpdates(t *testing.T) {
	s := newTestStore(t)
	ctx := context.Background()
	tenant, err := s.CreateTenant(ctx, "automatic-import", "https://shop.example")
	if err != nil {
		t.Fatal(err)
	}

	got, err := s.GetAutomaticImportPolicy(ctx, tenant.ID)
	if err != nil {
		t.Fatalf("get defaults: %v", err)
	}
	if got.Enabled || got.Limit != 0 {
		t.Fatalf("defaults = %+v, want disabled with limit 0", got)
	}

	if err := s.SetAutomaticImportPolicy(ctx, tenant.ID, true, 3); err != nil {
		t.Fatalf("enable: %v", err)
	}
	got, err = s.GetAutomaticImportPolicy(ctx, tenant.ID)
	if err != nil {
		t.Fatalf("get enabled: %v", err)
	}
	if !got.Enabled || got.Limit != 3 {
		t.Fatalf("enabled policy = %+v", got)
	}

	if err := s.SetAutomaticImportPolicy(ctx, tenant.ID, false, 0); err != nil {
		t.Fatalf("disable: %v", err)
	}
	got, err = s.GetAutomaticImportPolicy(ctx, tenant.ID)
	if err != nil {
		t.Fatalf("get disabled: %v", err)
	}
	if got.Enabled || got.Limit != 0 {
		t.Fatalf("disabled policy = %+v", got)
	}
}

func TestSetAutomaticImportPolicyRejectsNegativeLimit(t *testing.T) {
	s := newTestStore(t)
	ctx := context.Background()
	tenant, err := s.CreateTenant(ctx, "automatic-import-invalid", "https://shop.example")
	if err != nil {
		t.Fatal(err)
	}

	if err := s.SetAutomaticImportPolicy(ctx, tenant.ID, true, -1); !errors.Is(err, ErrInvalidAutomaticImportLimit) {
		t.Fatalf("negative limit error = %v, want %v", err, ErrInvalidAutomaticImportLimit)
	}
	got, err := s.GetAutomaticImportPolicy(ctx, tenant.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.Enabled || got.Limit != 0 {
		t.Fatalf("negative update touched policy: %+v", got)
	}
}

func TestSetAutomaticImportPolicyRejectsUnknownTenant(t *testing.T) {
	s := newTestStore(t)
	if err := s.SetAutomaticImportPolicy(context.Background(), 999999, true, 1); !errors.Is(err, ErrNotFound) {
		t.Fatalf("unknown tenant error = %v, want %v", err, ErrNotFound)
	}
}

func TestCountEnabledScrapeTargetsIsTenantAndScraperScoped(t *testing.T) {
	s := newTestStore(t)
	ctx := context.Background()
	tenantA, err := s.CreateTenant(ctx, "automatic-import-a", "https://a.example")
	if err != nil {
		t.Fatal(err)
	}
	tenantB, err := s.CreateTenant(ctx, "automatic-import-b", "https://b.example")
	if err != nil {
		t.Fatal(err)
	}

	connection := func(tenantID uint, method string) SourceConnection {
		return SourceConnection{TenantID: tenantID, Kind: "worker", Provider: "catalog", Method: method, Name: method, TokenHash: HashSourceToken(method + string(rune(tenantID))), Status: "active"}
	}
	connA, connB, connOther := connection(tenantA.ID, "scraper"), connection(tenantB.ID, "scraper"), connection(tenantA.ID, "api")
	for _, conn := range []*SourceConnection{&connA, &connB, &connOther} {
		if err := s.DB().Create(conn).Error; err != nil {
			t.Fatal(err)
		}
	}

	createTarget := func(tenantID, connectionID uint, enabled bool) {
		target := ScrapeTarget{TenantID: tenantID, SourceConnectionID: connectionID, URL: "https://shop.example/item", Marketplace: "ozon", Enabled: true}
		if err := s.DB().Create(&target).Error; err != nil {
			t.Fatal(err)
		}
		if err := s.DB().Model(&target).Update("enabled", enabled).Error; err != nil {
			t.Fatal(err)
		}
	}
	createTarget(tenantA.ID, connA.ID, true)
	createTarget(tenantA.ID, connA.ID, false)
	createTarget(tenantA.ID, connOther.ID, true)
	createTarget(tenantB.ID, connB.ID, true)

	count, err := s.CountEnabledScrapeTargets(ctx, tenantA.ID)
	if err != nil {
		t.Fatalf("count tenant A: %v", err)
	}
	if count != 1 {
		t.Fatalf("tenant A count = %d, want 1", count)
	}
	count, err = s.CountEnabledScrapeTargets(ctx, tenantB.ID)
	if err != nil {
		t.Fatalf("count tenant B: %v", err)
	}
	if count != 1 {
		t.Fatalf("tenant B count = %d, want 1", count)
	}
}

func TestAutomaticImportHelpersRecheckCurrentPolicy(t *testing.T) {
	s := newTestStore(t)
	ctx := context.Background()
	tenant, err := s.CreateTenant(ctx, "automatic-import-helper", "https://helper.example")
	if err != nil {
		t.Fatal(err)
	}
	owner := WithTenant(ctx, tenant.ID)
	if err := s.SetAutomaticImportPolicy(ctx, tenant.ID, true, 2); err != nil {
		t.Fatal(err)
	}
	conn := SourceConnection{Kind: "worker", Provider: "ozon", Method: "scraper", Name: "helper", Status: "active", TokenHash: HashSourceToken("helper")}
	if err := s.CreateSourceConnection(owner, &conn); err != nil {
		t.Fatal(err)
	}
	target := ScrapeTarget{SourceConnectionID: conn.ID, URL: "https://www.ozon.ru/product/helper-1/", Marketplace: "ozon", ExternalProductID: "1", Enabled: true}
	if err := s.CreateAutomaticImportTarget(owner, &target, 999); err != nil {
		t.Fatal(err)
	}
	if err := s.SetAutomaticImportPolicy(ctx, tenant.ID, false, 2); err != nil {
		t.Fatal(err)
	}
	second := ScrapeTarget{SourceConnectionID: conn.ID, URL: "https://www.ozon.ru/product/helper-2/", Marketplace: "ozon", ExternalProductID: "2", Enabled: true}
	if !errors.Is(s.CreateAutomaticImportTarget(owner, &second, 999), ErrAutomaticImportDisabled) {
		t.Fatal("helper ignored disabled policy")
	}
	if !errors.Is(func() error { _, err := s.QueueAutomaticImportJob(owner, target.ID); return err }(), ErrAutomaticImportDisabled) {
		t.Fatal("queue helper ignored disabled policy")
	}
	if err := s.SetAutomaticImportPolicy(ctx, tenant.ID, true, 0); err != nil {
		t.Fatal(err)
	}
	if !errors.Is(func() error { _, err := s.QueueAutomaticImportJob(owner, target.ID); return err }(), ErrAutomaticImportLimit) {
		t.Fatal("queue helper ignored reduced limit")
	}
}

func TestAutomaticImportRejectsIneligibleConnections(t *testing.T) {
	for _, change := range []struct {
		field string
		value any
	}{
		{"tenant_id", DefaultTenantID},
		{"status", "disabled"},
		{"kind", "api"},
		{"provider", "wb"},
		{"method", "external_service"},
	} {
		t.Run(change.field, func(t *testing.T) {
			s := newTestStore(t)
			ctx := context.Background()
			tenant, err := s.CreateTenant(ctx, "client", "https://client.example")
			if err != nil {
				t.Fatal(err)
			}
			owner := WithTenant(ctx, tenant.ID)
			if err := s.SetAutomaticImportPolicy(ctx, tenant.ID, true, 3); err != nil {
				t.Fatal(err)
			}
			conn := SourceConnection{Kind: "worker", Provider: "ozon", Method: "scraper", Name: "worker", Status: "active", TokenHash: HashSourceToken("worker")}
			if err := s.CreateSourceConnection(owner, &conn); err != nil {
				t.Fatal(err)
			}
			target := ScrapeTarget{SourceConnectionID: conn.ID, URL: "https://www.ozon.ru/product/item-42/", Marketplace: "ozon", ExternalProductID: "42", Enabled: true}
			if err := s.CreateAutomaticImportTarget(owner, &target, 0); err != nil {
				t.Fatal(err)
			}
			// Change eligibility after selection, as an operator update could do.
			if err := s.DB().Model(&conn).UpdateColumn(change.field, change.value).Error; err != nil {
				t.Fatal(err)
			}
			second := ScrapeTarget{SourceConnectionID: conn.ID, URL: "https://www.ozon.ru/product/item-43/", Marketplace: "ozon", ExternalProductID: "43", Enabled: true}
			if err := s.CreateAutomaticImportTarget(owner, &second, 0); !errors.Is(err, ErrAutomaticImportConnection) {
				t.Errorf("create connection error = %v", err)
			}
			if _, err := s.QueueAutomaticImportJob(owner, target.ID); !errors.Is(err, ErrAutomaticImportConnection) {
				t.Errorf("queue connection error = %v", err)
			}
			assertCount(t, s, &ScrapeTarget{}, 1)
			assertCount(t, s, &ScrapeJob{}, 0)
		})
	}
}

func TestAutomaticImportCreateRejectsAmbiguousConnections(t *testing.T) {
	s := newTestStore(t)
	ctx := WithTenant(context.Background(), DefaultTenantID)
	if err := s.SetAutomaticImportPolicy(ctx, DefaultTenantID, true, 2); err != nil {
		t.Fatal(err)
	}
	var selected uint
	for _, name := range []string{"one", "two"} {
		conn := SourceConnection{Kind: "worker", Provider: "ozon", Method: "scraper", Name: name, Status: "active", TokenHash: HashSourceToken(name)}
		if err := s.CreateSourceConnection(ctx, &conn); err != nil {
			t.Fatal(err)
		}
		selected = conn.ID
	}
	target := ScrapeTarget{SourceConnectionID: selected, URL: "https://www.ozon.ru/product/item-42/", Marketplace: "ozon", ExternalProductID: "42", Enabled: true}
	if err := s.CreateAutomaticImportTarget(ctx, &target, 0); !errors.Is(err, ErrAutomaticImportConnection) {
		t.Fatalf("ambiguous connection error = %v", err)
	}
	assertCount(t, s, &ScrapeTarget{}, 0)
}
