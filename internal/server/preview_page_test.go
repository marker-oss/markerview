package server

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"reviews/internal/store"
)

func TestPreviewPageReturnsSanitizedHTML(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		fmt.Fprint(w, `<html><head><title>Shop</title><script>alert(1)</script><style>.x{color:red}</style></head><body><div data-page>Кроссовки</div><img src="/a.png"></body></html>`)
	}))
	defer upstream.Close()

	s := newAuthTestServer(t)
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/preview-page?url="+upstream.URL, nil)
	s.handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body=%s", rec.Code, rec.Body.String())
	}
	body := rec.Body.String()
	if !strings.HasPrefix(rec.Header().Get("Content-Type"), "text/html") {
		t.Fatalf("content-type = %q", rec.Header().Get("Content-Type"))
	}
	if strings.Contains(strings.ToLower(body), "<script") || strings.Contains(strings.ToLower(body), "alert(1)") {
		t.Fatalf("script survived sanitization: %s", body)
	}
	if strings.Contains(strings.ToLower(body), "<style") {
		t.Fatalf("style survived sanitization: %s", body)
	}
	if !strings.Contains(body, "Кроссовки") {
		t.Fatalf("page body lost: %s", body)
	}
}

func TestPreviewPageRejectsNonHTTPTarget(t *testing.T) {
	s := newAuthTestServer(t)
	for _, raw := range []string{"ftp://example.test/page", "file:///etc/passwd", "javascript:alert(1)", "not a url"} {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/api/preview-page?url="+url.QueryEscape(raw), nil)
		s.handler().ServeHTTP(rec, req)
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("url %q: status = %d, want 400", raw, rec.Code)
		}
	}
}

func TestPreviewPageUptimeLimitOnSlowUpstream(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		select {
		case <-time.After(10 * time.Second):
			fmt.Fprint(w, "<html></html>")
		case <-req.Context().Done():
		}
	}))
	defer upstream.Close()

	s := newAuthTestServer(t)
	rec := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/preview-page?url="+upstream.URL, nil)
	start := time.Now()
	s.handler().ServeHTTP(rec, request)
	elapsed := time.Since(start)
	if rec.Code != http.StatusBadGateway {
		t.Fatalf("status = %d, want 502, body=%s", rec.Code, rec.Body.String())
	}
	if elapsed > 8*time.Second {
		t.Fatalf("proxy waited %v, want ~5s timeout", elapsed)
	}
}

func TestPreviewPageRejectsOversizedPage(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		_, _ = w.Write(make([]byte, previewPageMaxBytes+1024))
	}))
	defer upstream.Close()

	s := newAuthTestServer(t)
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/preview-page?url="+upstream.URL, nil)
	s.handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusBadGateway {
		t.Fatalf("status = %d, want 502", rec.Code)
	}
}

func TestPreviewPageHostCheckRespectsShopOrigin(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		fmt.Fprint(w, "<html><body>ok</body></html>")
	}))
	defer upstream.Close()

	s := newAuthTestServer(t)
	if err := s.store.SetAppSetting(context.Background(), store.SettingShopOrigin, "https://shop.test"); err != nil {
		t.Fatalf("set origin: %v", err)
	}

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/preview-page?url="+upstream.URL, nil)
	req.Header.Set("X-Forwarded-For", "203.0.113.1")
	s.handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("foreign host status = %d, want 400", rec.Code)
	}

	// Same-origin page passes.
	if err := s.store.SetAppSetting(context.Background(), store.SettingShopOrigin, upstream.URL); err != nil {
		t.Fatalf("set origin: %v", err)
	}
	rec = httptest.NewRecorder()
	s.handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("same-origin status = %d, body=%s", rec.Code, rec.Body.String())
	}
}

func TestPreviewPageRateLimited(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		fmt.Fprint(w, "<html><body>x</body></html>")
	}))
	defer upstream.Close()

	s := newAuthTestServer(t)
	var last int
	for i := 0; i < 5; i++ { // limiter: 3/hour per IP
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/api/preview-page?url="+upstream.URL, nil)
		s.handler().ServeHTTP(rec, req)
		last = rec.Code
	}
	if last != http.StatusTooManyRequests {
		t.Fatalf("status = %d, want 429 after burst", last)
	}
}
