package server

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"

	"reviews/internal/store"
	"time"
)

const (
	previewPageMaxBytes = 2 << 20 // 2 MiB response cap
	previewPageTimeout  = 5 * time.Second
)

// previewPageLimiter throttles the preview-page proxy: it fetches arbitrary
// shop pages server-side, so a browser loop must not turn it into a crawler.
// Per-IP only: 3/hour and 10/day. (The submission limiter also dedupes
// email+article once per day, which would 429 the same preview URL on the
// editor's second open.)
type previewLimiter struct {
	mu   sync.Mutex
	byIP map[string][]time.Time
}

var previewPageLimiter = &previewLimiter{byIP: map[string][]time.Time{}}

func (l *previewLimiter) allow(now time.Time, ip string) (string, bool) {
	l.mu.Lock()
	defer l.mu.Unlock()
	day := now.Add(-24 * time.Hour)
	hits := filterSince(l.byIP[ip], day)
	if len(hits) == 0 {
		delete(l.byIP, ip)
	} else {
		l.byIP[ip] = hits
	}
	if countSince(hits, now.Add(-time.Hour)) >= 3 {
		return "too many preview requests from this network, try later", false
	}
	if len(hits) >= 10 {
		return "daily preview limit reached for this network", false
	}
	l.byIP[ip] = append(hits, now)
	return "", true
}

// previewPageLimiterReset empties the preview limiter for tests (the limiter
// is package-global, so tests would otherwise rate-limit each other).
func previewPageLimiterReset() {
	previewPageLimiter.mu.Lock()
	previewPageLimiter.byIP = map[string][]time.Time{}
	previewPageLimiter.mu.Unlock()
}

// previewPageSanitizer neutralizes inline script/iframe/base markup so the
// builder's iframe preview renders the page's own markup/CSS without executing
// site JavaScript. Structural tags only — the response is never used for
// anything but display.
var previewPageSanitizer = strings.NewReplacer(
	"<script", "&lt;script", "</script", "&lt;/script",
	"<iframe", "&lt;iframe", "</iframe", "&lt;/iframe",
	"<base", "&lt;base", "</base", "&lt;/base",
	"<object", "&lt;object", "</object", "&lt;/object",
	"<embed", "&lt;embed",
)

// previewPageSanitize removes script/iframe/noscript/base/object/embed
// elements (whole tags), keeps <style> blocks and https stylesheet links so
// the preview keeps the shop's own look. A real parser would be more precise,
// but for preview-only output a targeted regex pass over opening/closing tag
// pairs is enough and dependency-free.
func previewPageSanitize(html string) string {
	wholeTag := []struct{ start, end string }{
		{"<script", "</script>"},
		{"<iframe", "</iframe>"},
		{"<noscript", "</noscript>"},
		{"<object", "</object>"},
		{"<base", "</base>"},
	}
	for _, tag := range wholeTag {
		for {
			lower := strings.ToLower(html)
			start := strings.Index(lower, tag.start)
			if start < 0 {
				break
			}
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
	// Unpaired <embed ...> opening tags: drop them individually.
	for {
		lower := strings.ToLower(html)
		start := strings.Index(lower, "<embed")
		if start < 0 {
			break
		}
		gt := strings.Index(lower[start:], ">")
		if gt < 0 {
			html = html[:start]
			break
		}
		html = html[:start] + html[start+gt+1:]
	}
	// Stylesheet links: keep https ones (the shop's own look), drop the rest.
	return removeStyleLinks(html)
}

// removeStyleLinks keeps <link> tags whose href is absolute https (the shop's
// own stylesheets; the host is already vetted by the shop-origin host check)
// and deletes everything else that loads styles: rel=stylesheet/`as="style"`
// with relative or http hrefs.
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
		loadsStyles := strings.Contains(tag, "stylesheet") ||
			strings.Contains(tag, `as="style"`) || strings.Contains(tag, "as=style")
		if !loadsStyles {
			out += html[:end]
		} else if href := linkHref(tag); strings.HasPrefix(href, "https://") {
			out += html[:end]
		} else {
			out += html[:start]
		}
		html, lower = html[end:], lower[end:]
	}
}

// linkHref extracts the href attribute value from a single <link> tag string.
func linkHref(tag string) string {
	i := strings.Index(tag, "href")
	if i < 0 {
		return ""
	}
	rest := tag[i+len("href"):]
	rest = strings.TrimLeft(rest, " \t\r\n")
	if !strings.HasPrefix(rest, "=") {
		// hrefs / hrefx — not an assignment; keep scanning attrs naively.
		return ""
	}
	rest = strings.TrimPrefix(rest, "=")
	rest = strings.TrimLeft(rest, " \t\r\n")
	if strings.HasPrefix(rest, `"`) || strings.HasPrefix(rest, "'") {
		q := rest[:1]
		if end := strings.Index(rest[1:], q); end >= 0 {
			return rest[1 : 1+end]
		}
		return ""
	}
	if end := strings.IndexAny(rest, " \t\r\n>"); end >= 0 {
		return rest[:end]
	}
	return strings.TrimSuffix(rest, ">")
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

// previewEmbedAnchorDefault is the anchor the live snippet falls back to when
// the seller didn't configure anchorSelector (Embed page placeholder).
const previewEmbedAnchorDefault = "#reviews-widget"

// handlePreviewPage fetches a shop product page and returns sanitized HTML
// with the widget library injected for the builder's live preview. The loader
// is NOT injected: it would auto-mount from live API data, while the preview
// must show rail drafts. Instead, the page gets window.ReviewsWidget plus
// window.REVIEWS_EMBED_CONFIG, and the editor's parent frame mounts the
// widget itself (Editor.tsx same-origin bridge). GET /api/preview-page?url=...
// Public (the builder is a browser page); IP rate-limited like submissions;
// 5s timeout, 2MiB cap, shop-origin host check when configured.
func (s *Server) handlePreviewPage(w http.ResponseWriter, r *http.Request) {
	rawURL := strings.TrimSpace(r.URL.Query().Get("url"))
	anchor := strings.TrimSpace(r.URL.Query().Get("anchor"))
	if rawURL == "" {
		writeError(w, http.StatusBadRequest, errors.New("url is required"))
		return
	}
	if err := s.previewPageHostAllowed(r.Context(), rawURL); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if reason, ok := previewPageLimiter.allow(time.Now().UTC(), clientIP(r)); !ok {
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
	nonce, err := previewPageNonce()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	html := previewPageSanitize(string(body))
	html = previewPageInject(html, anchor, nonce)
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	// The page keeps its own look: https styles/images from the vetted shop
	// origin, our own widget script, one nonce'd inline bootstrap. The shop's
	// own script tags were cut by the sanitizer, so script-src 'self' is ours
	// only; the nonce whitelists the inline config bootstrap without
	// 'unsafe-inline'.
	w.Header().Set("Content-Security-Policy",
		"default-src 'none'; script-src 'self' 'nonce-"+nonce+
			"'; style-src 'self' https: 'unsafe-inline'; img-src https: data:; font-src https:; media-src 'self' https:; frame-ancestors 'self'")
	// securityHeaders sets X-Frame-Options: DENY for every response; the
	// builder's iframe (same origin) must be allowed to show this page.
	w.Header().Set("X-Frame-Options", "SAMEORIGIN")
	_, _ = w.Write([]byte(html))
}

// previewPageInject appends the widget script tag and the embed config right
// before </body> (or </html> / EOF when the tags are missing). The config is
// inert on its own — /reviews-widget.js only exposes window.ReviewsWidget and
// never mounts; the loader that consumes REVIEWS_EMBED_CONFIG is deliberately
// not injected, so no auto-mount races the editor's manual bridge. The inline
// bootstrap carries the CSP nonce declared for this response.
func previewPageInject(html, anchor, nonce string) string {
	if anchor == "" {
		anchor = previewEmbedAnchorDefault
	}
	cfg, err := json.Marshal(map[string]any{
		"widgetCssUrl":   "/reviews-widget.css",
		"useShadowDom":   true,
		"anchorSelector": anchor,
	})
	if err != nil {
		cfg = []byte("{}")
	}
	// json.Marshal HTML-escapes < and > (\u003c), so the payload cannot close
	// the script element from untrusted anchor/query input.
	inject := `<script nonce="` + nonce + `">window.REVIEWS_EMBED_CONFIG = ` + string(cfg) + ";</script>" +
		`<script src="/reviews-widget.js" defer></script>`
	lower := strings.ToLower(html)
	if i := strings.LastIndex(lower, "</body>"); i >= 0 {
		return html[:i] + inject + html[i:]
	}
	if i := strings.LastIndex(lower, "</html>"); i >= 0 {
		return html[:i] + inject + html[i:]
	}
	return html + inject
}

// previewPageNonce generates the per-response CSP nonce for the inline config
// script (script-src 'self' + nonce instead of 'unsafe-inline').
func previewPageNonce() (string, error) {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawStdEncoding.EncodeToString(buf), nil
}
