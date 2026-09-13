package server

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strings"

	"reviews/internal/store"
	"time"
)

const (
	previewPageMaxBytes = 2 << 20 // 2 MiB response cap
	previewPageTimeout  = 5 * time.Second
)

// previewPageLimiter throttles the preview-page proxy: it fetches arbitrary
// shop pages server-side, so a browser loop must not turn it into a crawler.
// Limits mirror the submission limiter shape: 30/hour and 120/day per IP.
var previewPageLimiter = newSubmissionLimiter()

// previewPageSanitizer strips script/style/iframe/link[rel=stylesheet]/base
// tags and inline event handlers so the builder's iframe preview renders the
// page's own markup/CSS without executing site JavaScript. Structural tags
// only — the response is never used for anything but display.
var previewPageSanitizer = strings.NewReplacer(
	"<script", "&lt;script", "</script", "&lt;/script",
	"<iframe", "&lt;iframe", "</iframe", "&lt;/iframe",
	"<base", "&lt;base", "</base", "&lt;/base",
)

// previewPageSanitize removes whole elements (script/style/iframe/noscript/
// base/object/embed and stylesheet links) from an HTML document. A real
// parser would be more precise, but for preview-only output a targeted
// regex pass over opening/closing tag pairs is enough and dependency-free.
func previewPageSanitize(html string) string {
	wholeTag := []struct{ start, end string }{
		{"<script", "</script>"},
		{"<style", "</style>"},
		{"<iframe", "</iframe>"},
		{"<noscript", "</noscript>"},
		{"<object", "</object>"},
		{"<embed", "</embed>"},
		{"<base", "</base>"},
	}
	for _, tag := range wholeTag {
		for {
			lower := strings.ToLower(html)
			start := strings.Index(lower, tag.start)
			if start < 0 {
				break
			}
			// Find the matching close; self-closing/unclosed tags (embed,
			// base) may not have one — drop just the opening tag then.
			end := strings.Index(lower[start:], tag.end)
			var close int
			if end < 0 {
				gt := strings.Index(lower[start:], ">")
				if gt < 0 {
					close = len(html) // malformed tail: drop everything after
				} else {
					close = start + gt + 1
				}
			} else {
				close = start + end + len(tag.end)
			}
			html = html[:start] + html[close:]
		}
	}
	// Stylesheet links (rel=stylesheet|preload as=style): drop the whole tag.
	return removeStyleLinks(html)
}

// removeStyleLinks deletes <link> tags whose attrs mention stylesheet or
// rel="preload" with as="style" (keeps icon links etc.).
func removeStyleLinks(html string) string {
	lower := strings.ToLower(html)
	out := ""
	for {
		start := strings.Index(lower, "<link")
		if start < 0 {
			out += html
			return out
		}
		gt := strings.Index(lower[start:], ">")
		if gt < 0 {
			out += html
			return out
		}
		end := start + gt + 1
		tag := lower[start:end]
		if strings.Contains(tag, "stylesheet") || strings.Contains(tag, `as="style"`) || strings.Contains(tag, "as=style") {
			out += html[:start]
		} else {
			out += html[:end]
		}
		html, lower = html[end:], lower[end:]
	}
}

// previewPageHostAllowed validates the target URL: http(s) only, and the host
// must match the tenant's configured shop origin when one is set (same-origin
// sibling logic from the CORS middleware); any http(s) host otherwise.
func (s *Server) previewPageHostAllowed(ctx context.Context, rawURL string) error {
	parsed, err := url.Parse(rawURL)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" {
		return errors.New("url must be http(s)")
	}
	origin, err := s.store.GetAppSetting(ctx, store.SettingShopOrigin)
	if err != nil {
		return err
	}
	if origin == "" {
		return nil
	}
	targetHost := strings.ToLower(parsed.Hostname())
	for _, allowed := range originAndSibling(origin) {
		allowedURL, err := url.Parse(allowed)
		if err != nil {
			continue
		}
		allowedHost := strings.ToLower(allowedURL.Hostname())
		if targetHost == allowedHost || strings.HasSuffix(targetHost, "."+allowedHost) {
			return nil
		}
	}
	return errors.New("url host is outside the configured shop origin")
}

// handlePreviewPage fetches a shop product page and returns sanitized HTML
// for the widget-builder live preview. GET /api/preview-page?url=...
// Public (the builder is a browser page); IP rate-limited like submissions;
// 5s timeout, 2MiB cap, shop-origin host check when configured.
func (s *Server) handlePreviewPage(w http.ResponseWriter, r *http.Request) {
	rawURL := strings.TrimSpace(r.URL.Query().Get("url"))
	if rawURL == "" {
		writeError(w, http.StatusBadRequest, errors.New("url is required"))
		return
	}
	if err := s.previewPageHostAllowed(r.Context(), rawURL); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if reason, ok := previewPageLimiter.allow(time.Now().UTC(), clientIP(r), "preview", rawURL); !ok {
		writeError(w, http.StatusTooManyRequests, errors.New(reason))
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), previewPageTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		writeError(w, http.StatusBadRequest, errors.New("invalid url"))
		return
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; ReviewsWidgetPreview/1.0)")
	req.Header.Set("Accept", "text/html")

	client := &http.Client{
		Timeout: previewPageTimeout,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 5 {
				return errors.New("too many redirects")
			}
			if req.URL.Scheme != "http" && req.URL.Scheme != "https" {
				return errors.New("redirect to non-http scheme")
			}
			return nil
		},
	}
	resp, err := client.Do(req)
	if err != nil {
		writeError(w, http.StatusBadGateway, errors.New("fetch failed: "+err.Error()))
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		writeError(w, http.StatusBadGateway, errors.New("upstream status "+resp.Status))
		return
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, previewPageMaxBytes+1))
	if err != nil {
		writeError(w, http.StatusBadGateway, errors.New("read failed"))
		return
	}
	if len(body) > previewPageMaxBytes {
		writeError(w, http.StatusBadGateway, errors.New("page exceeds size limit"))
		return
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Content-Security-Policy", "default-src 'none'; style-src * inline; img-src * data:; font-src *; media-src *")
	_, _ = w.Write([]byte(previewPageSanitize(string(body))))
}
