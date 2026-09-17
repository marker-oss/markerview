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
	previewPageLimiterReset()
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		fmt.Fprint(w, `<html><head><title>Shop</title>`+
			`<script>alert(1)</script>`+
			`<style>.x{color:red}</style>`+
			`<link rel="stylesheet" href="https://fonts.shop.test/a.css">`+
			`<link rel="stylesheet" href="/local.css">`+
			`</head><body><div data-page>Кроссовки</div><img src="/api/assets/review-icon.svg"><script src="https://evil.test/x.js"></script></body></html>`)
	}))
	defer upstream.Close()

	s := newAuthTestServer(t)
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/preview-page?url="+upstream.URL, nil)
	req.Header.Set("X-Forwarded-For", "203.0.113.10")
	s.handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body=%s", rec.Code, rec.Body.String())
	}
	body := rec.Body.String()
	if !strings.HasPrefix(rec.Header().Get("Content-Type"), "text/html") {
		t.Fatalf("content-type = %q", rec.Header().Get("Content-Type"))
	}
	lower := strings.ToLower(body)
	// The shop's own inline script is cut whole: only our injected bootstrap
	// and the defer'd library tag may remain.
	if strings.Contains(lower, "alert(1)") || strings.Contains(lower, "&lt;script") {
		t.Fatalf("shop script survived sanitization: %s", body)
	}
	if strings.Count(lower, "<script") != 2 {
		t.Fatalf("expected exactly the 2 injected script tags: %s", body)
	}
	// The shop's look must survive: inline styles and https stylesheet links.
	if !strings.Contains(lower, "<style>") || !strings.Contains(body, ".x{color:red}") {
		t.Fatalf("style block lost: %s", body)
	}
	if !strings.Contains(body, `href="https://fonts.shop.test/a.css"`) {
		t.Fatalf("https stylesheet link lost: %s", body)
	}
	if strings.Contains(body, `href="/local.css"`) {
		t.Fatalf("non-https stylesheet link survived: %s", body)
	}
	if !strings.Contains(body, `src="/api/assets/review-icon.svg"`) {
		t.Fatalf("same-origin image reference lost: %s", body)
	}
	if strings.Contains(body, `evil.test/x.js`) {
		t.Fatalf("external script survived sanitization: %s", body)
	}
	if !strings.Contains(body, "Кроссовки") {
		t.Fatalf("page body lost: %s", body)
	}
}
func TestPreviewPageInjectsWidgetBootstrap(t *testing.T) {
	previewPageLimiterReset()
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		fmt.Fprint(w, "<html><body><div id=\"reviews-widget\"></div></body></html>")
	}))
	defer upstream.Close()

	s := newAuthTestServer(t)
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet,
		"/api/preview-page?url="+upstream.URL+"&anchor="+url.QueryEscape("#custom-anchor"), nil)
	req.Header.Set("X-Forwarded-For", "203.0.113.11")
	s.handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body=%s", rec.Code, rec.Body.String())
	}
	body := rec.Body.String()
	if !strings.Contains(body, `<script src="/reviews-widget.js" defer></script>`) {
		t.Fatalf("widget script not injected: %s", body)
	}
	if !strings.Contains(body, `"useShadowDom":true`) {
		t.Fatalf("useShadowDom missing from embed config: %s", body)
	}
	if !strings.Contains(body, `"widgetCssUrl":"/reviews-widget.css"`) {
		t.Fatalf("widgetCssUrl missing from embed config: %s", body)
	}
	if !strings.Contains(body, `"anchorSelector":"#custom-anchor"`) {
		t.Fatalf("anchor from query missing: %s", body)
	}
	// Injection lands right before </body>.
	bi := strings.LastIndex(body, `<script nonce="`)
	if bi < 0 || !strings.Contains(body[bi:], "</body>") {
		t.Fatalf("bootstrap not before </body>: %s", body)
	}

	// Default anchor when the query param is absent. A second open of the same
	// URL must stay 200: the preview limiter throttles per IP, not per URL.
	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/api/preview-page?url="+upstream.URL, nil)
	req.Header.Set("X-Forwarded-For", "203.0.113.12")
	s.handler().ServeHTTP(rec, req)
	body = rec.Body.String()
	if rec.Code != http.StatusOK {
		t.Fatalf("same-URL second open status = %d, body=%s", rec.Code, body)
	}
	if !strings.Contains(body, `"anchorSelector":"#reviews-widget"`) {
		t.Fatalf("default anchor missing: %s", body)
	}
	if !strings.Contains(previewPageInject("no closing tags", "", ""), `<script src="/reviews-widget.js" defer></script>`) {
		t.Fatalf("injection must append at EOF without closing tags")
	}

	// A crafted anchor cannot break out of the config script element.
	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet,
		"/api/preview-page?url="+upstream.URL+"&anchor="+url.QueryEscape("</script><script>alert(1)</script>"), nil)
	req.Header.Set("X-Forwarded-For", "203.0.113.13")
	s.handler().ServeHTTP(rec, req)
	body = rec.Body.String()
	// json.Marshal escapes < > as \u003c\u003e inside the config literal, so
	// the payload stays inert: no real closing/inline script may appear.
	if strings.Contains(strings.ToLower(body), "<script>alert(1)") || strings.Contains(body, `</script><script>`) {
		t.Fatalf("anchor injection escaped config: %s", body)
	}
	if !strings.Contains(body, `\u003c/script\u003e`) {
		t.Fatalf("anchor payload not HTML-escaped: %s", body)
	}
}

func TestPreviewPageCSPAllowsShopStylesAndOurScript(t *testing.T) {
	previewPageLimiterReset()
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		fmt.Fprint(w, "<html><body>ok</body></html>")
	}))
	defer upstream.Close()

	s := newAuthTestServer(t)
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/preview-page?url="+upstream.URL, nil)
	req.Header.Set("X-Forwarded-For", "203.0.113.14")
	s.handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	csp := rec.Header().Get("Content-Security-Policy")
	for _, want := range []string{
		"script-src 'self' 'nonce-",
		"style-src 'self' https: 'unsafe-inline'",
		"img-src 'self' https: data:",
		"font-src 'self' https: data:",
		"media-src 'self' https:",
		"frame-ancestors 'self'",
	} {
		if !strings.Contains(csp, want) {
			t.Fatalf("CSP missing %q: %s", want, csp)
		}
	}
	// The inline bootstrap must be present and carry the response's nonce.
	if !strings.Contains(rec.Body.String(), `window.REVIEWS_EMBED_CONFIG`) {
		t.Fatalf("inline bootstrap missing: %s", rec.Body.String())
	}
	nonce := strings.Split(csp, "script-src 'self' 'nonce-")[1]
	nonce = strings.Split(nonce, "'")[0]
	if strings.Count(rec.Body.String(), `<script nonce="`+nonce+`">`) != 1 {
		t.Fatalf("inline bootstrap is not nonce'd exactly once: %s", rec.Body.String())
	}
	if rec.Header().Get("X-Frame-Options") != "SAMEORIGIN" {
		t.Fatalf("X-Frame-Options = %q, want SAMEORIGIN (builder iframe)", rec.Header().Get("X-Frame-Options"))
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
	previewPageLimiterReset()
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
	previewPageLimiterReset()
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
