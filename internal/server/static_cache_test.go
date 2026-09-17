package server

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// Static widget assets must demand revalidation so widget JS/CSS updates
// become visible without a hard refresh. External files use Last-Modified;
// binary-embedded files use an ETag derived from their bytes.
func TestStaticAssetsNoCache(t *testing.T) {
	s := newAuthTestServer(t)
	s.cfg.StaticDir = t.TempDir()
	if err := os.WriteFile(filepath.Join(s.cfg.StaticDir, "reviews-widget.js"), []byte("/* widget */"), 0o644); err != nil {
		t.Fatalf("write js: %v", err)
	}
	if err := os.WriteFile(filepath.Join(s.cfg.StaticDir, "reviews-widget.css"), []byte("/* css */"), 0o644); err != nil {
		t.Fatalf("write css: %v", err)
	}
	if err := os.WriteFile(filepath.Join(s.cfg.StaticDir, "product.html"), []byte("<html></html>"), 0o644); err != nil {
		t.Fatalf("write html: %v", err)
	}

	for _, name := range []string{"reviews-widget.js", "reviews-widget.css"} {
		rec := httptest.NewRecorder()
		s.handler().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/"+name, nil))
		if rec.Code != http.StatusOK {
			t.Fatalf("%s status = %d", name, rec.Code)
		}
		if got := rec.Header().Get("Cache-Control"); got != "no-cache" {
			t.Fatalf("%s Cache-Control = %q, want no-cache", name, got)
		}
		if rec.Header().Get("Last-Modified") == "" && rec.Header().Get("ETag") == "" {
			t.Fatalf("%s has no revalidation anchor", name)
		}
	}

	// Other static content still serves normally — only the caching hint is added.
	rec := httptest.NewRecorder()
	s.handler().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/product.html", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("product.html status = %d", rec.Code)
	}
	if got := rec.Header().Get("Cache-Control"); got != "no-cache" {
		t.Fatalf("product.html Cache-Control = %q, want no-cache", got)
	}
	if body := rec.Body.String(); body != "<html></html>" {
		t.Fatalf("product.html body = %q", body)
	}
}

// The admin editor and widget runtime are one versioned contract. A binary
// update must therefore replace both even when the external static directory
// still contains files from an older installation.
func TestBinaryServesEmbeddedWidgetBeforeStaleStaticDir(t *testing.T) {
	s := newAuthTestServer(t)
	s.cfg.StaticDir = t.TempDir()
	if err := os.WriteFile(filepath.Join(s.cfg.StaticDir, "reviews-widget.js"), []byte("/* stale widget */"), 0o644); err != nil {
		t.Fatal(err)
	}

	rec := httptest.NewRecorder()
	s.handler().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/reviews-widget.js", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("widget status = %d", rec.Code)
	}
	body := rec.Body.String()
	if body == "/* stale widget */" || !strings.Contains(body, "ReviewsWidget") {
		t.Fatalf("binary served stale external widget: %q", body)
	}
}
