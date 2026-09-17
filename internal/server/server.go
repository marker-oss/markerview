package server

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"

	"reviews/internal/config"
	"reviews/internal/mediaproxy"
	"reviews/internal/reviewjson"
	"reviews/internal/site"

	"gorm.io/gorm"

	"reviews/internal/store"
)

type Config struct {
	Addr               string
	StaticDir          string
	ProductURLTemplate string
	ProductLinks       map[string]string
	// ProductLinksPath is where the crawled product-link list is persisted so
	// the in-admin "refresh products" action can rewrite it.
	ProductLinksPath string
	// SitemapURL is the shop sitemap crawled by the refresh action.
	SitemapURL    string
	SessionTTL    time.Duration
	SecureCookies bool
	TriggerSync   TriggerSyncFunc
	Marketplaces  []MarketplaceStatus
	// AllowedOrigins lists shop origins permitted to fetch public reviews
	// data cross-origin (the embedding site). Empty disables CORS.
	AllowedOrigins []string
	// Media configures the face-blur image proxy (/media route).
	Media config.MediaConfig
	// Review submission settings.
	UploadDir      string
	PrivacyURL     string
	ReviewTermsURL string
	// ResolveReplyPublisher returns a fresh publisher for posting seller
	// replies back to the marketplace, reading current credentials. Nil or
	// an erroring resolver marks the publication "failed"/"unsupported"
	// per the publish path.
	ResolveReplyPublisher ReplyPublisherResolver
	// ResolveQuestionPublisher returns a fresh publisher for posting
	// seller answers to product questions back to the marketplace.
	ResolveQuestionPublisher QuestionPublisherResolver
	// Version is the running release tag (vX.Y.Z), stamped at build time;
	// "dev" for local builds.
	Version string
	// LatestReleaseURL is the JSON feed of the newest release (GitHub
	// releases/latest API). Empty disables the update check.
	LatestReleaseURL string
	// OzonProductsProbe checks whether the current Ozon credentials can list
	// products (the role review→article mapping needs). nil disables the
	// admin-panel warning; the closure must use the effective (DB-overlaid)
	// credentials at call time.
	OzonProductsProbe func(ctx context.Context) error
	// ExtraAdminRoutes lets a closed-source overlay (operator panel,
	// billing) register protected /admin/api routes: the returned mux is
	// mounted inside requireSession. The overlay receives the server so it
	// can reach the store and logger. nil in the open-source build.
	ExtraAdminRoutes func(s *Server) *http.ServeMux
	// ExtraPublicRoutes lets the overlay register public routes (payment
	// webhooks that must not require a session). Mounted at the root mux.
	ExtraPublicRoutes func(s *Server) *http.ServeMux
	// ExtraAuthRoutes exposes public password/email auth endpoints below /auth/.
	ExtraAuthRoutes func(s *Server) *http.ServeMux
	// OnSignup runs after a tenant/admin transaction and before any session is
	// created. Cloud uses it to issue and send account verification mail.
	OnSignup func(context.Context, *store.Store, uint, string) error
	// RequireLoginVerification gates login for selected users (cloud tenant
	// admins). A nil callback preserves public/self-hosted behavior.
	RequireLoginVerification func(store.AdminUser) bool
	// NormalizeLogin canonicalizes the hosted account identifier.
	NormalizeLogin func(string) (string, error)
	// SignupEnabled reports whether self-service registration is open.
	SignupEnabled func(context.Context) (bool, error)
	// AdmitSignup runs inside tenant creation for hosted admission control.
	AdmitSignup func(*gorm.DB) error
}
type Server struct {
	store         *store.Store
	cfg           Config
	logger        *slog.Logger
	server        *http.Server
	submissions   *submissionLimiter
	tenantLimiter *tenantRateLimiter
	// linksMu guards per-tenant article→URL maps refreshed at runtime.
	linksMu              sync.RWMutex
	productLinksByTenant map[uint]map[string]string

	// siteLinksMu guards per-tenant catalog refresh status/job slots.
	siteLinksMu   sync.Mutex
	siteLinksJobs map[uint]siteLinksStatus
	// exportMu serializes catalog and static export replacements. A single lock
	// is sufficient for infrequent admin/background writes.
	exportMu sync.Mutex

	// originsMu guards shopOrigins — the admin-configured CORS origins merged
	// into the env whitelist; rebuilt whenever the shop_origin setting changes.
	originsMu   sync.RWMutex
	shopOrigins map[string]bool

	// versionMu guards the cached latest-release lookup (update banner).
	versionMu        sync.Mutex
	versionCache     latestRelease
	versionCheckedAt time.Time

	// ozonProbeMu guards the cached Ozon products-role probe result shown as a
	// warning on the admin Marketplaces page.
	ozonProbeMu      sync.Mutex
	ozonProbeAt      time.Time
	ozonProbeWarning string

	// tenantExportScope resolves the per-tenant static export subdirectory
	// (the tenant's public key) on SaaS. nil keeps the legacy shared
	// reviews-data path for single-tenant deployments.
	tenantExportScope func(ctx context.Context) (string, error)
}

// Store exposes the store for overlay route handlers (operator panel,
// billing webhooks mounted through Config.Extra*Routes).
func (s *Server) Store() *store.Store {
	return s.store
}

// productLinks returns the current tenant's article→URL map under a read lock.
func (s *Server) productLinks(ctx context.Context) map[string]string {
	tenantID := store.TenantIDFromCtx(ctx)
	s.linksMu.RLock()
	links := s.productLinksByTenant[tenantID]
	s.linksMu.RUnlock()
	if links != nil {
		return links
	}
	if !store.StrictTenantMode() {
		return s.cfg.ProductLinks
	}
	persisted, err := s.productCatalogLinks(ctx)
	if err != nil {
		s.logger.Error("load tenant product links", "tenant", tenantID, "error", err)
		return nil
	}
	links = site.ProductLinkMap(persisted)
	s.setProductLinks(ctx, links)
	return links
}

// SetTenantExportScope installs the per-tenant static export resolver (SaaS).
// Call before Run; nil keeps the legacy shared reviews-data directory.
func (s *Server) SetTenantExportScope(resolve func(ctx context.Context) (string, error)) {
	s.tenantExportScope = resolve
}

// SetOperatorRoutesForTest installs the overlay route hooks the way Run
// does, so overlay integration tests exercise the real mounting path
// (requireSession wrap included). Production wiring goes through Config.
func (s *Server) SetOperatorRoutesForTest(admin, public func(*Server) *http.ServeMux) {
	if admin != nil {
		s.cfg.ExtraAdminRoutes = admin
	}
	if public != nil {
		s.cfg.ExtraPublicRoutes = public
	}
}

// HandlerForTest builds the full middleware-wrapped handler for overlay
// integration tests (the same chain Run installs).
func (s *Server) HandlerForTest() http.Handler {
	return s.handler()
}

// setProductLinks atomically swaps the tenant's in-memory article→URL map.
func (s *Server) setProductLinks(ctx context.Context, links map[string]string) {
	s.linksMu.Lock()
	defer s.linksMu.Unlock()
	if s.productLinksByTenant == nil {
		s.productLinksByTenant = make(map[uint]map[string]string)
	}
	s.productLinksByTenant[store.TenantIDFromCtx(ctx)] = links
	if !store.StrictTenantMode() {
		s.cfg.ProductLinks = links
	}
}

func New(store *store.Store, cfg Config, logger *slog.Logger) *Server {
	if cfg.Addr == "" {
		cfg.Addr = "127.0.0.1:8080"
	}
	if cfg.StaticDir == "" {
		cfg.StaticDir = "web/reviews-widget"
	}
	if cfg.SessionTTL <= 0 {
		cfg.SessionTTL = 24 * time.Hour
	}
	return &Server{
		store:                store,
		cfg:                  cfg,
		logger:               logger,
		productLinksByTenant: make(map[uint]map[string]string),
		siteLinksJobs:        make(map[uint]siteLinksStatus),
	}
}

// handler builds the full public + admin route tree wrapped in the middleware
// chain. Exposed for tests so the CORS/security middleware is exercised.
func (s *Server) handler() http.Handler {
	s.reloadShopOrigins(store.WithTenant(context.Background(), store.DefaultTenantID))
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/reviews", s.handleReviews)
	mux.HandleFunc("GET /api/showcase", s.handleShowcase)
	mux.HandleFunc("GET /api/widget-config", s.handlePublicWidgetConfig)
	mux.HandleFunc("GET /api/review-submission-config", s.handleReviewSubmissionConfig)
	mux.HandleFunc("POST /api/review-submissions", s.handleCreateReviewSubmission)
	mux.HandleFunc("GET /api/questions", s.handlePublicQuestions)
	mux.HandleFunc("GET /api/question-submission-config", s.handleQuestionSubmissionConfig)
	mux.HandleFunc("POST /api/questions", s.handleCreateQuestionSubmission)
	mux.HandleFunc("GET /api/preview-page", s.handlePreviewPage)
	mux.HandleFunc("GET /healthz", s.handleHealthz)
	mux.HandleFunc("GET /user-media/{token}", s.handleUserMedia)
	if mediaHandler, err := mediaproxy.NewHandler(s.cfg.Media, nil); err == nil {
		mux.Handle("GET /media", mediaHandler)
	} else {
		s.logger.Error("media proxy disabled", "error", err)
	}
	if s.cfg.ExtraPublicRoutes != nil {
		inner := s.cfg.ExtraPublicRoutes(s)
		mux.Handle("/billing/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.StripPrefix("/billing", inner).ServeHTTP(w, r)
		}))
	}
	mux.Handle("/admin/", s.adminMux())
	mux.Handle("/", noCacheStatic(http.FileServer(http.Dir(s.cfg.StaticDir))))

	return securityHeaders(s.tenantScope(s.tenantRateLimit(s.cors(s.logRequests(mux)))))
}

// noCacheStatic marks static-dir assets revalidation-required: browsers may
// cache them but must revalidate (If-Modified-Since/ETag against the
// FileServer's Last-Modified), so widget JS/CSS updates become visible on the
// next load instead of after a hard refresh.
func noCacheStatic(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-cache")
		next.ServeHTTP(w, r)
	})
}

// tenantScope resolves the tenant for every request that reaches the store.
// Authenticated admin routes are stamped by requireSession; public routes
// resolve the tenant here. In strict mode (SaaS) a valid public_key is
// required — unknown or missing keys get 403. In compat mode the implicit
// default tenant serves requests with or without a key, so existing
// open-source snippets keep working unchanged.
func (s *Server) tenantScope(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		// Admin routes authenticate by session (requireSession stamps the
		// tenant from the session row). A tenant-scoped static export carries
		// its public key as the first path segment instead of a query parameter.
		admin := strings.HasPrefix(r.URL.Path, "/admin/")
		if !admin && r.Header.Get("Origin") != "" {
			w.Header().Set("Vary", "Origin")
		}
		staticExport := r.URL.Path == "/reviews-data" || strings.HasPrefix(r.URL.Path, "/reviews-data/")
		staticKey := ""
		if store.StrictTenantMode() && staticExport {
			rest := strings.TrimPrefix(r.URL.Path, "/reviews-data/")
			staticKey, rest, _ = strings.Cut(rest, "/")
			// Only files below a tenant key are public. Rejecting roots and
			// trailing-slash paths also prevents FileServer directory listings.
			if staticKey == "" || rest == "" || strings.HasSuffix(r.URL.Path, "/") {
				writeError(w, http.StatusForbidden, errors.New("tenant-scoped data file required"))
				return
			}
			if queryKey := r.URL.Query().Get("public_key"); queryKey != "" && queryKey != staticKey {
				writeError(w, http.StatusForbidden, errors.New("public key does not match data path"))
				return
			}
		}
		tenantless := r.URL.Path == "/healthz" || (!strings.HasPrefix(r.URL.Path, "/api/") && !staticExport)
		key := r.URL.Query().Get("public_key")
		if staticKey != "" {
			key = staticKey
		}
		if key != "" {
			tenant, err := s.store.TenantByPublicKey(ctx, key)
			if err != nil {
				writeError(w, http.StatusForbidden, errors.New("unknown public key"))
				return
			}
			// Cross-tenant CORS guard: a browser Origin must belong to the
			// tenant the key resolves to. Tenants without a recorded origin
			// (the compat default) keep the AppSetting/env CORS mechanism.
			if tenant.ShopOrigin != "" {
				origins := originAndSibling(tenant.ShopOrigin)
				if origin := r.Header.Get("Origin"); origin != "" && !slices.Contains(origins, origin) {
					writeError(w, http.StatusForbidden, errors.New("origin not allowed for this public key"))
					return
				}
				ctx = context.WithValue(ctx, tenantOriginsKey, origins)
			}
			ctx = store.WithTenant(ctx, tenant.ID)
			if tenant.Status == "paused" {
				writeError(w, http.StatusPaymentRequired, errors.New("подписка приостановлена"))
				return
			}
		} else if store.StrictTenantMode() && !admin && !tenantless {
			writeError(w, http.StatusForbidden, errors.New("public key required"))
			return
		}
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (s *Server) Run(ctx context.Context) error {
	s.server = &http.Server{
		Addr:              s.cfg.Addr,
		Handler:           s.handler(),
		ReadHeaderTimeout: 5 * time.Second,
	}

	errs := make(chan error, 1)
	go func() {
		s.logger.Info("server listening", "addr", s.cfg.Addr, "static_dir", s.cfg.StaticDir)
		errs <- s.server.ListenAndServe()
	}()

	select {
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := s.server.Shutdown(shutdownCtx); err != nil {
			return err
		}
		return nil
	case err := <-errs:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	}
}

// adminMux builds the admin API + SPA routes. Setup and login are public;
// everything below /admin/api/ requires a valid session.
func (s *Server) adminMux() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /admin/api/setup-status", s.handleSetupStatus)
	mux.HandleFunc("POST /admin/api/login", s.handleLogin)
	mux.HandleFunc("POST /admin/api/setup", s.handleSetup)
	mux.HandleFunc("POST /admin/api/signup", s.handleSignup)
	if s.cfg.ExtraAuthRoutes != nil {
		inner := s.cfg.ExtraAuthRoutes(s)
		mux.Handle("/admin/auth/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			r2 := r.Clone(r.Context())
			r2.URL.Path = "/auth" + strings.TrimPrefix(r.URL.Path, "/admin/auth")
			http.StripPrefix("/auth", inner).ServeHTTP(w, r2)
		}))
	}
	protected := http.NewServeMux()
	protected.HandleFunc("GET /admin/api/me", s.handleMe)
	protected.HandleFunc("GET /admin/api/csrf", s.handleCSRFToken)
	protected.HandleFunc("GET /admin/api/reviews", s.handleAdminReviews)
	protected.Handle("POST /admin/api/reviews/publish", requireCSRF(http.HandlerFunc(s.handlePublishReviewsData)))
	protected.Handle("POST /admin/api/reviews/bulk", requireCSRF(http.HandlerFunc(s.handleAdminReviewsBulkModerate)))
	protected.Handle("PATCH /admin/api/reviews/{id}", requireCSRF(http.HandlerFunc(s.handleAdminReviewModerate)))
	protected.Handle("DELETE /admin/api/reviews/{id}", requireCSRF(http.HandlerFunc(s.handleAdminReviewDelete)))
	protected.Handle("DELETE /admin/api/reviews/{id}/purge", requireCSRF(http.HandlerFunc(s.handleAdminReviewPurge)))
	protected.Handle("POST /admin/api/reviews/{id}/restore", requireCSRF(http.HandlerFunc(s.handleAdminReviewRestore)))
	protected.Handle("PUT /admin/api/reviews/{id}/reply", requireCSRF(http.HandlerFunc(s.handleAdminReviewReply)))
	protected.Handle("POST /admin/api/reviews/{id}/reply/retry", requireCSRF(http.HandlerFunc(s.handleAdminReviewReplyRetry)))
	protected.HandleFunc("GET /admin/api/articles/{article}/pins", s.handleListArticlePins)
	protected.Handle("PUT /admin/api/articles/{article}/pins", requireCSRF(http.HandlerFunc(s.handleReplaceArticlePins)))
	protected.Handle("DELETE /admin/api/articles/{article}/pins/{reviewID}", requireCSRF(http.HandlerFunc(s.handleRemoveArticlePin)))
	protected.HandleFunc("GET /admin/api/version", s.handleVersion)
	protected.HandleFunc("GET /admin/api/tenant", s.handleTenant)
	protected.HandleFunc("GET /admin/api/dashboard", s.handleDashboard)
	protected.HandleFunc("GET /admin/api/diagnostics", s.handleDiagnostics)
	protected.Handle("POST /admin/api/diagnostics/probe", requireCSRF(http.HandlerFunc(s.handleDiagnosticsProbe)))
	protected.HandleFunc("GET /admin/api/counts", s.handleCounts)
	protected.HandleFunc("GET /admin/api/marketplaces", s.handleMarketplaces)
	protected.Handle("PUT /admin/api/marketplaces/{id}/credentials", requireCSRF(http.HandlerFunc(s.handleSaveMarketplaceCredentials)))
	protected.HandleFunc("GET /admin/api/settings", s.handleGetSettings)
	protected.Handle("PUT /admin/api/settings", requireCSRF(http.HandlerFunc(s.handlePutSettings)))
	protected.Handle("POST /admin/api/sync", requireCSRF(http.HandlerFunc(s.handleTriggerSync)))
	protected.Handle("POST /admin/api/site-links/refresh", requireCSRF(http.HandlerFunc(s.handleRefreshSiteLinks)))
	protected.HandleFunc("GET /admin/api/site-links/refresh", s.handleSiteLinksRefreshStatus)
	protected.HandleFunc("GET /admin/api/showcase-rule", s.handleGetShowcaseRule)
	protected.Handle("PUT /admin/api/showcase-rule", requireCSRF(http.HandlerFunc(s.handlePutShowcaseRule)))
	protected.HandleFunc("GET /admin/api/widget-config/{context}", s.handleGetWidgetConfig)
	protected.HandleFunc("GET /admin/api/widget-config/{context}/versions", s.handleListWidgetConfigVersions)
	protected.Handle("POST /admin/api/widget-config/{context}", requireCSRF(http.HandlerFunc(s.handlePublishWidgetConfig)))
	protected.Handle("POST /admin/api/widget-config/{context}/rollback/{version}", requireCSRF(http.HandlerFunc(s.handleRollbackWidgetConfig)))
	protected.Handle("POST /admin/api/logout", requireCSRF(http.HandlerFunc(s.handleLogout)))
	protected.HandleFunc("GET /admin/api/questions", s.handleAdminQuestions)
	protected.Handle("PUT /admin/api/questions/{id}/answer", requireCSRF(http.HandlerFunc(s.handleAdminQuestionAnswer)))
	protected.Handle("POST /admin/api/questions/{id}/answer/retry", requireCSRF(http.HandlerFunc(s.handleAdminQuestionAnswerRetry)))
	protected.HandleFunc("GET /admin/api/dsr/lookup", s.handleDSRLookup)
	protected.HandleFunc("GET /admin/api/dsr/export", s.handleDSRExport)
	protected.Handle("POST /admin/api/dsr/delete", requireCSRF(http.HandlerFunc(s.handleDSRDelete)))
	mux.Handle("/admin/api/", s.requireSession(protected))
	if s.cfg.ExtraAdminRoutes != nil {
		inner := s.cfg.ExtraAdminRoutes(s)
		mux.Handle("/admin/api/saas/", s.requireSession(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.StripPrefix("/admin/api/saas", inner).ServeHTTP(w, r)
		})))
	}

	mux.Handle("/admin/", s.adminSPAHandler())
	return mux
}

func (s *Server) handleReviews(w http.ResponseWriter, r *http.Request) {
	filter, err := parseReviewFilter(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	customFilters, err := s.customFieldFilters(r.Context(), r.URL.Query())
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	filter.CustomFilters = customFilters
	filter.Visibility = "visible"
	filter.Status = "public"

	var reviews []store.Review
	defaults, ranking, marketplacePolicy, useWidgetRules := s.reviewRulesForRequest(r)
	filter.ExcludedMarketplaces = marketplacePolicy.ExcludedMarketplaces()
	if useWidgetRules {
		reviews, err = s.store.ListReviewsByWidgetRules(r.Context(), filter, defaults, ranking)
	} else {
		reviews, err = s.store.ListReviews(r.Context(), filter)
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	mapper := reviewjson.Mapper{
		ProductURLTemplate: s.cfg.ProductURLTemplate,
		ProductLinks:       s.productLinks(r.Context()),
		MarketplacePolicy:  marketplacePolicy,
	}
	items := make([]reviewjson.Review, 0, len(reviews))
	for _, review := range reviews {
		items = append(items, mapper.ToReview(review))
	}
	writeJSON(w, http.StatusOK, reviewsResponse{Reviews: items, Count: len(items)})
}

func (s *Server) handleHealthz(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// publicQuestion is the minimal public shape returned by GET /api/questions.
// Static export of questions is deferred (live API only for now).
type publicQuestion struct {
	Question string    `json:"question"`
	Answer   string    `json:"answer"`
	Date     time.Time `json:"date"`
}

// handlePublicQuestions returns answered+visible questions for an article.
// Questions are served live-API-only; static bundle inclusion is deferred.
func (s *Server) handlePublicQuestions(w http.ResponseWriter, r *http.Request) {
	article := strings.TrimSpace(r.URL.Query().Get("article"))
	questions, err := s.store.ListQuestions(r.Context(), store.QuestionFilter{
		Visibility:    "visible",
		SellerArticle: article,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	items := make([]publicQuestion, 0, len(questions))
	for _, q := range questions {
		if q.AnswerText == nil || *q.AnswerText == "" {
			continue
		}
		date := q.CreatedAtMP
		if q.AnswerAt != nil {
			date = *q.AnswerAt
		}
		items = append(items, publicQuestion{
			Question: q.Text,
			Answer:   *q.AnswerText,
			Date:     date,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"questions": items})
}

func (s *Server) logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		s.logger.Debug("http request", "method", r.Method, "path", r.URL.Path, "duration", time.Since(start))
	})
}

func parseReviewFilter(r *http.Request) (store.ReviewListFilter, error) {
	query := r.URL.Query()
	filter := store.ReviewListFilter{
		Marketplace: query.Get("marketplace"),
		Limit:       parseInt(query.Get("limit"), 100),
		Offset:      parseInt(query.Get("offset"), 0),
		SortBy:      query.Get("sort"),
	}

	if rating := query.Get("rating"); rating != "" && rating != "all" {
		parsed, err := strconv.Atoi(rating)
		if err != nil {
			return store.ReviewListFilter{}, fmt.Errorf("rating must be a number")
		}
		filter.Rating = parsed
	}
	return filter, nil
}

// customFieldFilters validates custom_<fieldId> query params against the
// configured customFields. Only filterable fields with a configured option
// pass; anything else is a 400 so the public API can't be probed.
func (s *Server) customFieldFilters(ctx context.Context, query url.Values) ([]store.CustomFilter, error) {
	var filters []store.CustomFilter
	for key, values := range query {
		if !strings.HasPrefix(key, "custom_") {
			continue
		}
		fieldID := strings.TrimPrefix(key, "custom_")
		value := ""
		if len(values) > 0 {
			value = values[0]
		}
		var match *customField
		for i, field := range s.customFields(ctx) {
			if field.ID == fieldID {
				match = &s.customFields(ctx)[i]
				break
			}
		}
		if match == nil || !match.Filterable {
			return nil, fmt.Errorf("unknown custom field filter %q", fieldID)
		}
		if !slices.Contains(match.Options, value) {
			return nil, fmt.Errorf("invalid value for custom field %q", fieldID)
		}
		filters = append(filters, store.CustomFilter{FieldID: fieldID, Value: value})
	}
	return filters, nil
}

type widgetRulesPayload struct {
	Defaults          *store.WidgetReviewDefaults    `json:"defaults"`
	Ranking           []store.ReviewRankingRule      `json:"ranking"`
	MarketplacePolicy reviewjson.MarketplacePolicies `json:"marketplacePolicy"`
}

func (s *Server) reviewRulesForRequest(r *http.Request) (store.WidgetReviewDefaults, []store.ReviewRankingRule, reviewjson.MarketplacePolicies, bool) {
	query := r.URL.Query()
	if query.Get("apply_config") == "0" || query.Get("applyConfig") == "0" {
		return store.WidgetReviewDefaults{}, nil, nil, false
	}
	contextName := query.Get("context")
	if contextName == "" {
		contextName = "product"
	}
	if err := validateWidgetContext(contextName); err != nil {
		return store.WidgetReviewDefaults{}, nil, nil, false
	}
	cfg, err := s.store.GetActiveWidgetConfig(r.Context(), contextName)
	if err != nil {
		return store.WidgetReviewDefaults{}, nil, nil, false
	}
	var payload widgetRulesPayload
	if err := json.Unmarshal([]byte(cfg.Payload), &payload); err != nil {
		return store.WidgetReviewDefaults{}, nil, nil, false
	}
	defaults := store.DefaultWidgetReviewDefaults()
	if payload.Defaults != nil {
		defaults = *payload.Defaults
	}
	ranking := payload.Ranking
	if len(ranking) == 0 {
		ranking = store.DefaultReviewRanking()
	}
	return defaults, ranking, payload.MarketplacePolicy.Normalized(), true
}

func (s *Server) activeMarketplacePolicy(ctx context.Context, widgetContext string) reviewjson.MarketplacePolicies {
	if err := validateWidgetContext(widgetContext); err != nil {
		return nil
	}
	cfg, err := s.store.GetActiveWidgetConfig(ctx, widgetContext)
	if err != nil {
		return nil
	}
	return reviewjson.ParseMarketplacePolicies(cfg.Payload)
}

func parseInt(value string, fallback int) int {
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func writeError(w http.ResponseWriter, status int, err error) {
	writeJSON(w, status, map[string]string{"error": err.Error()})
}

type reviewsResponse struct {
	Reviews []reviewjson.Review `json:"reviews"`
	Count   int                 `json:"count"`
}

func StaticDirExists(path string) error {
	info, err := os.Stat(filepath.Clean(path))
	if err != nil {
		return err
	}
	if !info.IsDir() {
		return fmt.Errorf("%s is not a directory", path)
	}
	return nil
}
