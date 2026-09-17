package server

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"reviews/internal/store"
)

// signupBody posts a signup request and returns the recorder.
func signupBody(t *testing.T, s *Server, payload string) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/admin/api/signup", strings.NewReader(payload))
	s.adminMux().ServeHTTP(rec, req)
	return rec
}

// TestSignupCreatesTenantAndLogsIn proves the SaaS self-serve path: signup
// creates an isolated trial tenant with its own admin, returns the public
// key, and establishes a session scoped to the new tenant.
func TestSignupCreatesTenantAndLogsIn(t *testing.T) {
	restore := store.SetStrictTenantModeForTest(true)
	defer restore()
	s := newAuthTestServer(t)

	rec := signupBody(t, s, `{"login":"seller1","password":"password1","shopOrigin":"HTTPS://Shop1.Example/"}`)
	if rec.Code != http.StatusCreated {
		t.Fatalf("signup status = %d, body=%s", rec.Code, rec.Body.String())
	}
	var resp struct {
		PublicKey string `json:"publicKey"`
		TrialEnds time.Time
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(resp.PublicKey) != 64 {
		t.Fatalf("public key = %q, want 64 hex chars", resp.PublicKey)
	}

	// The session cookie is scoped to the new tenant: /admin/api/me works
	// and tenant-scoped store calls resolve the new tenant, not tenant 1.
	cookie := rec.Result().Cookies()[0]
	req := httptest.NewRequest(http.MethodGet, "/admin/api/me", nil)
	req.AddCookie(cookie)
	rec2 := httptest.NewRecorder()
	s.adminMux().ServeHTTP(rec2, req)
	if rec2.Code != http.StatusOK {
		t.Fatalf("me status = %d, body=%s", rec2.Code, rec2.Body.String())
	}
	tenant, err := s.store.TenantByPublicKey(context.Background(), resp.PublicKey)
	if err != nil {
		t.Fatalf("tenant by key: %v", err)
	}
	tenantCtx := store.WithTenant(context.Background(), tenant.ID)
	shopOrigin, err := s.store.GetAppSetting(tenantCtx, store.SettingShopOrigin)
	if err != nil || shopOrigin != "https://shop1.example" || tenant.ShopOrigin != shopOrigin {
		t.Fatalf("shop origin = %q (tenant %q) err=%v, want normalized origin", shopOrigin, tenant.ShopOrigin, err)
	}

	// Duplicate login is rejected with 409.
	rec3 := signupBody(t, s, `{"login":"seller1","password":"password1","shopOrigin":"https://other.example"}`)
	if rec3.Code != http.StatusConflict {
		t.Fatalf("duplicate login status = %d, want 409", rec3.Code)
	}

	// Signup validates bounded credentials, request size, and an origin rather
	// than an arbitrary URL.
	badRequests := []string{
		`{"login":"s2","password":"short","shopOrigin":"https://x.example"}`,
		`{"login":"s2","password":"password1","shopOrigin":""}`,
		`{"login":"s2","password":"password1","shopOrigin":"shop.example"}`,
		`{"login":"s2","password":"password1","shopOrigin":"ftp://shop.example"}`,
		`{"login":"s2","password":"password1","shopOrigin":"https://user@shop.example"}`,
		`{"login":"s2","password":"password1","shopOrigin":"https://shop.example/path"}`,
		`{"login":"s2","password":"password1","shopOrigin":"https://shop.example?q=1"}`,
		`{"login":"s2","password":"password1","shopOrigin":"https://shop.example#fragment"}`,
		`{"login":"` + strings.Repeat("x", 65) + `","password":"password1","shopOrigin":"https://shop.example"}`,
		`{"login":"s2","password":"` + strings.Repeat("x", 129) + `","shopOrigin":"https://shop.example"}`,
		`{"login":"s2","password":"password1","shopOrigin":"https://shop.example","padding":"` + strings.Repeat("x", 17<<10) + `"}`,
	}
	for _, payload := range badRequests {
		if rec := signupBody(t, s, payload); rec.Code != http.StatusBadRequest {
			t.Fatalf("invalid signup status = %d, body=%s, payload=%q", rec.Code, rec.Body.String(), payload)
		}
	}

	// Signup disabled outside strict mode (single-tenant installs).
	restore()
	rec4 := signupBody(t, s, `{"login":"seller2","password":"password1","shopOrigin":"https://y.example"}`)
	if rec4.Code != http.StatusNotFound {
		t.Fatalf("compat signup status = %d, want 404", rec4.Code)
	}
}

// TestPausedTenantGets402 proves the billing gate: a paused tenant's widget
// data routes answer 402 while admin routes stay reachable (so the seller
// can log in and pay).
func TestPausedTenantGets402(t *testing.T) {
	restore := store.SetStrictTenantModeForTest(true)
	defer restore()
	s := newAuthTestServer(t)

	ctx := context.Background()
	tenant, err := s.store.CreateTenant(ctx, "paused-b", "https://b.example")
	if err != nil {
		t.Fatalf("create tenant: %v", err)
	}
	if err := s.store.SetTenantStatus(ctx, tenant.ID, "paused"); err != nil {
		t.Fatalf("pause tenant: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/reviews?public_key="+tenant.PublicKey, nil)
	rec := httptest.NewRecorder()
	s.handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusPaymentRequired {
		t.Fatalf("paused widget status = %d, want 402", rec.Code)
	}

	// Admin route is not key-scoped and must not 402.
	req2 := httptest.NewRequest(http.MethodGet, "/admin/api/setup-status", nil)
	rec2 := httptest.NewRecorder()
	s.handler().ServeHTTP(rec2, req2)
	if rec2.Code == http.StatusPaymentRequired {
		t.Fatal("admin route must not be gated by tenant status")
	}
}

// TestPendingTenantServesNoPublicData proves an unconfirmed signup cannot go
// live: its widget data answers 402 until the email is verified, and
// verification opens the tenant up in the same store call the auth route uses.
func TestPendingTenantServesNoPublicData(t *testing.T) {
	restore := store.SetStrictTenantModeForTest(true)
	defer restore()
	s := newAuthTestServer(t)

	ctx := context.Background()
	created, err := s.store.CreateTenantWithAdminFor(ctx, "pending@example.com", "hash", "https://pending.example", 0, nil)
	if err != nil {
		t.Fatalf("signup: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/reviews?public_key="+created.Tenant.PublicKey, nil)
	rec := httptest.NewRecorder()
	s.handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusPaymentRequired {
		t.Fatalf("pending widget status = %d, want 402", rec.Code)
	}

	if err := s.store.StartTrialOnVerification(ctx, created.AdminID, 7*24*time.Hour); err != nil {
		t.Fatalf("verify: %v", err)
	}
	rec2 := httptest.NewRecorder()
	s.handler().ServeHTTP(rec2, httptest.NewRequest(http.MethodGet, "/api/reviews?public_key="+created.Tenant.PublicKey, nil))
	if rec2.Code == http.StatusPaymentRequired {
		t.Fatal("verified tenant must serve public data")
	}
}
