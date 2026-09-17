package server

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"reviews/internal/store"
)

// allowedOrigin is a representative seller shop origin for CORS tests.
const allowedOrigin = "https://shop.example"

func TestCORSAllowsConfiguredOrigin(t *testing.T) {
	s := newAuthTestServer(t)
	s.cfg.AllowedOrigins = []string{allowedOrigin}

	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	req.Header.Set("Origin", allowedOrigin)
	rec := httptest.NewRecorder()
	s.handler().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("healthz status = %d", rec.Code)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != allowedOrigin {
		t.Fatalf("Access-Control-Allow-Origin = %q, want %q", got, allowedOrigin)
	}
	if vary := rec.Header().Get("Vary"); !strings.Contains(vary, "Origin") {
		t.Fatalf("Vary = %q, want it to contain Origin", vary)
	}
}

func TestCORSPreflightReturns204(t *testing.T) {
	s := newAuthTestServer(t)
	s.cfg.AllowedOrigins = []string{allowedOrigin}

	req := httptest.NewRequest(http.MethodOptions, "/api/reviews", nil)
	req.Header.Set("Origin", allowedOrigin)
	req.Header.Set("Access-Control-Request-Method", "GET")
	rec := httptest.NewRecorder()
	s.handler().ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("preflight status = %d, want 204", rec.Code)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != allowedOrigin {
		t.Fatalf("preflight Access-Control-Allow-Origin = %q, want %q", got, allowedOrigin)
	}
	if methods := rec.Header().Get("Access-Control-Allow-Methods"); !strings.Contains(methods, "GET") {
		t.Fatalf("Access-Control-Allow-Methods = %q, want it to contain GET", methods)
	}
}

func TestCORSRejectsUnknownOrigin(t *testing.T) {
	s := newAuthTestServer(t)
	s.cfg.AllowedOrigins = []string{allowedOrigin}

	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	req.Header.Set("Origin", "https://evil.example")
	rec := httptest.NewRecorder()
	s.handler().ServeHTTP(rec, req)

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("Access-Control-Allow-Origin = %q, want empty for unknown origin", got)
	}
}

func TestCORSSkipsAdminRoutes(t *testing.T) {
	s := newAuthTestServer(t)
	s.cfg.AllowedOrigins = []string{allowedOrigin}

	req := httptest.NewRequest(http.MethodGet, "/admin/api/setup-status", nil)
	req.Header.Set("Origin", allowedOrigin)
	rec := httptest.NewRecorder()
	s.handler().ServeHTTP(rec, req)

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("admin Access-Control-Allow-Origin = %q, want empty (admin is same-origin)", got)
	}
}

func TestCORSAllowsAnonymousSharedWidgetAssetsOnly(t *testing.T) {
	s := newAuthTestServer(t)
	s.cfg.StaticDir = t.TempDir()
	if err := os.WriteFile(filepath.Join(s.cfg.StaticDir, "reviews-widget.css"), []byte("body{}"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(s.cfg.StaticDir, "assets", "fonts"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(s.cfg.StaticDir, "assets", "fonts", "widget.woff2"), []byte("font"), 0o644); err != nil {
		t.Fatal(err)
	}
	h := s.handler()
	check := func(method, path string, wantWildcard bool) {
		t.Helper()
		req := httptest.NewRequest(method, path, nil)
		req.Header.Set("Origin", "https://unconfigured.example")
		if method == http.MethodOptions {
			req.Header.Set("Access-Control-Request-Method", http.MethodGet)
		}
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if got := rec.Header().Get("Access-Control-Allow-Origin"); (got == "*") != wantWildcard {
			t.Fatalf("%s %s Allow-Origin = %q, wildcard want %v", method, path, got, wantWildcard)
		}
		if vary := rec.Header().Values("Vary"); len(vary) == 0 || !strings.Contains(strings.Join(vary, ","), "Origin") {
			t.Fatalf("%s %s Vary = %q, want Origin", method, path, vary)
		}
	}
	check(http.MethodGet, "/reviews-widget.css", true)
	check(http.MethodHead, "/assets/fonts/widget.woff2", true)
	check(http.MethodOptions, "/reviews-widget.js", true)
	check(http.MethodGet, "/api/reviews", false)
	check(http.MethodGet, "/reviews-data/index.json", false)
	check(http.MethodGet, "/demo.html", false)
}

func TestCORSAllowsAdminConfiguredShopOrigin(t *testing.T) {
	s := newAuthTestServer(t)
	// No env origins — only the admin-stored shop origin, saved with a
	// trailing slash the way sellers typically type it.
	if err := s.store.SetAppSetting(context.Background(), store.SettingShopOrigin, "https://shop.example/"); err != nil {
		t.Fatalf("set shop origin: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	req.Header.Set("Origin", allowedOrigin)
	rec := httptest.NewRecorder()
	s.handler().ServeHTTP(rec, req)

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != allowedOrigin {
		t.Fatalf("Access-Control-Allow-Origin = %q, want %q (admin shop origin)", got, allowedOrigin)
	}
}

func TestCORSAllowsWWWSiblingOfAdminOrigin(t *testing.T) {
	s := newAuthTestServer(t)
	if err := s.store.SetAppSetting(context.Background(), store.SettingShopOrigin, allowedOrigin); err != nil {
		t.Fatalf("set shop origin: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	req.Header.Set("Origin", "https://www.shop.example")
	rec := httptest.NewRecorder()
	s.handler().ServeHTTP(rec, req)

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "https://www.shop.example" {
		t.Fatalf("Access-Control-Allow-Origin = %q, want www sibling allowed", got)
	}
}

func TestCORSAdminOriginAppliesWithoutRestart(t *testing.T) {
	s := newAuthTestServer(t)
	h := s.handler() // built once, as in a running process

	probe := func() string {
		req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
		req.Header.Set("Origin", allowedOrigin)
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		return rec.Header().Get("Access-Control-Allow-Origin")
	}

	if got := probe(); got != "" {
		t.Fatalf("Access-Control-Allow-Origin = %q before configuration, want empty", got)
	}

	rec := httptest.NewRecorder()
	body := strings.NewReader(`{"shopOrigin":"` + allowedOrigin + `"}`)
	s.handlePutSettings(rec, httptest.NewRequest(http.MethodPut, "/admin/api/settings", body))
	if rec.Code != http.StatusOK {
		t.Fatalf("put settings status = %d, body=%s", rec.Code, rec.Body.String())
	}

	if got := probe(); got != allowedOrigin {
		t.Fatalf("Access-Control-Allow-Origin = %q after saving setting, want %q without restart", got, allowedOrigin)
	}
}

func TestOriginAndSibling(t *testing.T) {
	cases := []struct {
		in   string
		want []string
	}{
		{"https://shop.ru/", []string{"https://shop.ru", "https://www.shop.ru"}},
		{"https://www.shop.ru/some/path", []string{"https://www.shop.ru", "https://shop.ru"}},
		{"http://shop.ru:8443", []string{"http://shop.ru:8443", "http://www.shop.ru:8443"}},
		{"http://192.168.1.10:8080", []string{"http://192.168.1.10:8080"}},
		{"http://localhost:3000", []string{"http://localhost:3000"}},
		{"  https://shop.ru  ", []string{"https://shop.ru", "https://www.shop.ru"}},
		{"", nil},
		{"not a url", nil},
		{"ftp://shop.ru", nil},
	}
	for _, c := range cases {
		got := originAndSibling(c.in)
		if len(got) != len(c.want) {
			t.Fatalf("originAndSibling(%q) = %v, want %v", c.in, got, c.want)
			continue
		}
		for i := range got {
			if got[i] != c.want[i] {
				t.Fatalf("originAndSibling(%q)[%d] = %q, want %q", c.in, i, got[i], c.want[i])
			}
		}
	}
}

func TestCORSDisabledWhenNoOriginsConfigured(t *testing.T) {
	s := newAuthTestServer(t)
	// AllowedOrigins left empty — preserves prior behavior.

	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	req.Header.Set("Origin", allowedOrigin)
	rec := httptest.NewRecorder()
	s.handler().ServeHTTP(rec, req)

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("Access-Control-Allow-Origin = %q, want empty when CORS disabled", got)
	}
}
