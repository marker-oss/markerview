package server

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"regexp"
	imports "reviews/internal/external_sources"
	"reviews/internal/marketplace"
	"reviews/internal/store"
	"strconv"
	"strings"
	"time"

	"gorm.io/gorm"
)

var ozonProductIDPattern = regexp.MustCompile(`^.+-([0-9]+)$`)

func validWorkerMethod(method string) bool {
	return method == marketplace.SourceMethodScraper || method == marketplace.SourceMethodExternalService
}

func canonicalOzonTarget(raw string) (string, string, error) {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || u.Scheme != "https" || u.Host != "www.ozon.ru" || u.User != nil {
		return "", "", errors.New("URL must use HTTPS and the www.ozon.ru host")
	}
	parts := strings.Split(strings.Trim(u.Path, "/"), "/")
	if len(parts) != 2 || parts[0] != "product" {
		return "", "", errors.New("URL must point to an Ozon product card")
	}
	matches := ozonProductIDPattern.FindStringSubmatch(parts[1])
	if len(matches) != 2 {
		return "", "", errors.New("Ozon product ID is missing")
	}
	canonical := url.URL{Scheme: "https", Host: "www.ozon.ru", Path: "/product/" + parts[1] + "/"}
	return canonical.String(), matches[1], nil
}

func newWorkerToken() (string, string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", "", err
	}
	token := hex.EncodeToString(b)
	return token, store.HashSourceToken(token), nil
}
func (s *Server) handleAdminSourceCreate(w http.ResponseWriter, r *http.Request) {
	if store.StrictTenantMode() {
		writeError(w, 403, errors.New("worker provisioning is operator-managed"))
		return
	}
	var req struct{ Name, Provider, Marketplace, Method string }
	if json.NewDecoder(r.Body).Decode(&req) != nil || req.Name == "" || req.Provider == "" || req.Marketplace == "" {
		writeError(w, 400, errors.New("name, provider, and marketplace are required"))
		return
	}
	if req.Method == "" {
		req.Method = marketplace.SourceMethodScraper
	}
	if !validWorkerMethod(req.Method) {
		writeError(w, 400, errors.New("method must be scraper or external_service"))
		return
	}
	token, hash, err := newWorkerToken()
	if err != nil {
		writeError(w, 500, err)
		return
	}
	c := store.SourceConnection{Kind: "worker", Provider: req.Provider, Method: req.Method, Name: req.Name, TokenHash: hash, Status: "active"}
	if err := s.store.CreateSourceConnection(r.Context(), &c); err != nil {
		writeError(w, 500, err)
		return
	}
	writeJSON(w, 201, map[string]any{"id": c.ID, "token": token, "provider": req.Provider, "marketplace": req.Marketplace, "method": req.Method})
}
func (s *Server) handleAdminTargetCreate(w http.ResponseWriter, r *http.Request) {
	if store.StrictTenantMode() {
		writeError(w, 403, errors.New("use the automatic import API"))
		return
	}
	id, _ := strconv.ParseUint(r.PathValue("id"), 10, 64)
	var req struct {
		URL               string `json:"url"`
		Marketplace       string `json:"marketplace"`
		ExternalProductID string `json:"external_product_id"`
		SellerArticle     string `json:"seller_article"`
		Label             string `json:"label"`
	}
	if json.NewDecoder(r.Body).Decode(&req) != nil || req.URL == "" || req.Marketplace == "" {
		writeError(w, 400, errors.New("url and marketplace are required"))
		return
	}
	if strings.EqualFold(req.Marketplace, "ozon") {
		canonical, productID, err := canonicalOzonTarget(req.URL)
		if err != nil {
			writeError(w, 400, err)
			return
		}
		if req.ExternalProductID != "" && req.ExternalProductID != productID {
			writeError(w, 400, errors.New("external_product_id does not match Ozon URL"))
			return
		}
		req.URL, req.ExternalProductID, req.Marketplace = canonical, productID, "ozon"
	}
	t := store.ScrapeTarget{SourceConnectionID: uint(id), URL: req.URL, Marketplace: req.Marketplace, ExternalProductID: req.ExternalProductID, SellerArticle: req.SellerArticle, Label: req.Label, Enabled: true}
	if err := s.store.CreateScrapeTarget(r.Context(), &t); err != nil {
		writeError(w, 404, err)
		return
	}
	writeJSON(w, 201, t)
}
func (s *Server) handleAdminTargetQueue(w http.ResponseWriter, r *http.Request) {
	if store.StrictTenantMode() {
		writeError(w, 403, errors.New("use the automatic import API"))
		return
	}
	id, _ := strconv.ParseUint(r.PathValue("target"), 10, 64)
	job, err := s.store.QueueScrapeJob(r.Context(), uint(id))
	if err != nil {
		writeError(w, 404, err)
		return
	}
	writeJSON(w, 201, job)
}

// automaticImportTarget deliberately excludes worker configuration and cursors.
type automaticImportTarget struct {
	ID                uint   `json:"id"`
	URL               string `json:"url"`
	ExternalProductID string `json:"external_product_id"`
	SellerArticle     string `json:"seller_article"`
	Label             string `json:"label"`
	Enabled           bool   `json:"enabled"`
	LastStatus        string `json:"last_status"`
}

func automaticImportTargetJSON(t store.ScrapeTarget) automaticImportTarget {
	return automaticImportTarget{t.ID, t.URL, t.ExternalProductID, t.SellerArticle, t.Label, t.Enabled, t.LastStatus}
}

func (s *Server) automaticImportTargets(r *http.Request) *gorm.DB {
	return s.store.DB().WithContext(r.Context()).Model(&store.ScrapeTarget{}).
		Select("scrape_targets.*").
		Joins("JOIN source_connections ON source_connections.id = scrape_targets.source_connection_id AND source_connections.tenant_id = scrape_targets.tenant_id").
		Where("scrape_targets.tenant_id = ? AND source_connections.method = ?", store.TenantIDFromCtx(r.Context()), marketplace.SourceMethodScraper)
}

func (s *Server) handleAutomaticImport(w http.ResponseWriter, r *http.Request) {
	if _, ok := store.TenantIDFromCtxSafe(r.Context()); !ok {
		writeError(w, 403, errors.New("tenant session required"))
		return
	}
	policy, err := s.store.GetAutomaticImportPolicy(r.Context(), store.TenantIDFromCtx(r.Context()))
	if err != nil {
		writeError(w, 500, err)
		return
	}
	count, err := s.store.CountEnabledScrapeTargets(r.Context(), store.TenantIDFromCtx(r.Context()))
	if err != nil {
		writeError(w, 500, err)
		return
	}
	var targets []store.ScrapeTarget
	if err := s.automaticImportTargets(r).Order("scrape_targets.id").Find(&targets).Error; err != nil {
		writeError(w, 500, err)
		return
	}
	rows := make([]automaticImportTarget, 0, len(targets))
	for _, target := range targets {
		rows = append(rows, automaticImportTargetJSON(target))
	}
	writeJSON(w, 200, map[string]any{"enabled": policy.Enabled, "limit": policy.Limit, "active_count": count, "targets": rows})
}

func (s *Server) automaticImportPolicy(w http.ResponseWriter, r *http.Request) (store.AutomaticImportPolicy, bool) {
	if _, ok := store.TenantIDFromCtxSafe(r.Context()); !ok {
		writeError(w, 403, errors.New("tenant session required"))
		return store.AutomaticImportPolicy{}, false
	}
	policy, err := s.store.GetAutomaticImportPolicy(r.Context(), store.TenantIDFromCtx(r.Context()))
	if err != nil {
		writeError(w, 500, err)
		return policy, false
	}
	if !policy.Enabled {
		writeError(w, 403, errors.New("automatic import is disabled"))
		return policy, false
	}
	return policy, true
}

func (s *Server) automaticImportCapacity(w http.ResponseWriter, r *http.Request, limit int, creating bool) bool {
	count, err := s.store.CountEnabledScrapeTargets(r.Context(), store.TenantIDFromCtx(r.Context()))
	if err != nil {
		writeError(w, 500, err)
		return false
	}
	if limit <= 0 || count > int64(limit) || (creating && count == int64(limit)) {
		writeError(w, 409, errors.New("automatic import limit exhausted"))
		return false
	}
	return true
}

func (s *Server) handleAutomaticImportCreate(w http.ResponseWriter, r *http.Request) {
	var input struct {
		URL           string `json:"url"`
		Label         string `json:"label"`
		SellerArticle string `json:"seller_article"`
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8192))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&input) != nil || decoder.Decode(new(any)) != io.EOF || len(input.Label) > 128 || len(input.SellerArticle) > 128 {
		writeError(w, 400, errors.New("invalid automatic import target"))
		return
	}
	canonical, productID, err := canonicalOzonTarget(input.URL)
	if err != nil || len(canonical) > 2048 {
		writeError(w, 400, errors.New("invalid Ozon product URL"))
		return
	}
	s.automaticImportMu.Lock()
	defer s.automaticImportMu.Unlock()
	policy, ok := s.automaticImportPolicy(w, r)
	if !ok {
		return
	}
	var existing []store.ScrapeTarget
	if err := s.automaticImportTargets(r).Where("scrape_targets.marketplace = ? AND scrape_targets.external_product_id = ?", "ozon", productID).Limit(2).Find(&existing).Error; err != nil {
		writeError(w, 500, err)
		return
	}
	if len(existing) > 1 {
		writeError(w, 409, errors.New("ambiguous existing targets require operator resolution"))
		return
	}
	if len(existing) == 1 {
		writeJSON(w, 200, automaticImportTargetJSON(existing[0]))
		return
	}
	if !s.automaticImportCapacity(w, r, policy.Limit, true) {
		return
	}
	var connections []store.SourceConnection
	if err := s.store.DB().WithContext(r.Context()).Where("tenant_id = ? AND kind = ? AND provider = ? AND method = ? AND status = ?", store.TenantIDFromCtx(r.Context()), "worker", "ozon", marketplace.SourceMethodScraper, "active").Limit(2).Find(&connections).Error; err != nil {
		writeError(w, 500, err)
		return
	}
	// There is no secure worker credential delivery/provisioning service here.
	// Never create an unusable connection or borrow the operator's connection.
	if len(connections) != 1 {
		writeError(w, 503, errors.New("tenant scraper connection is not provisioned unambiguously"))
		return
	}
	target := store.ScrapeTarget{SourceConnectionID: connections[0].ID, URL: canonical, Marketplace: "ozon", ExternalProductID: productID, Label: input.Label, SellerArticle: input.SellerArticle, Enabled: true}
	if err := s.store.CreateScrapeTarget(r.Context(), &target); err != nil {
		writeError(w, 500, err)
		return
	}
	writeJSON(w, 201, automaticImportTargetJSON(target))
}

func (s *Server) automaticImportOwnedTarget(w http.ResponseWriter, r *http.Request) (store.ScrapeTarget, bool) {
	if _, ok := store.TenantIDFromCtxSafe(r.Context()); !ok {
		writeError(w, 403, errors.New("tenant session required"))
		return store.ScrapeTarget{}, false
	}
	id, err := strconv.ParseUint(r.PathValue("id"), 10, 64)
	if err != nil || id == 0 {
		writeError(w, 404, errors.New("target not found"))
		return store.ScrapeTarget{}, false
	}
	var target store.ScrapeTarget
	err = s.automaticImportTargets(r).Where("scrape_targets.id = ?", id).First(&target).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		writeError(w, 404, errors.New("target not found"))
		return target, false
	}
	if err != nil {
		writeError(w, 500, err)
		return target, false
	}
	return target, true
}

func (s *Server) handleAutomaticImportQueue(w http.ResponseWriter, r *http.Request) {
	s.automaticImportMu.Lock()
	defer s.automaticImportMu.Unlock()
	target, ok := s.automaticImportOwnedTarget(w, r)
	if !ok {
		return
	}
	if !target.Enabled {
		writeError(w, 404, errors.New("target not found"))
		return
	}
	policy, ok := s.automaticImportPolicy(w, r)
	if !ok || !s.automaticImportCapacity(w, r, policy.Limit, false) {
		return
	}
	var connection store.SourceConnection
	if err := s.store.DB().WithContext(r.Context()).Where("id = ? AND tenant_id = ? AND kind = ? AND method = ? AND status = ?", target.SourceConnectionID, store.TenantIDFromCtx(r.Context()), "worker", marketplace.SourceMethodScraper, "active").First(&connection).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			writeError(w, 503, errors.New("tenant scraper connection unavailable"))
		} else {
			writeError(w, 500, err)
		}
		return
	}
	var active int64
	// Expired leases are still active: workers reclaim the same job/attempt.
	if err := s.store.DB().WithContext(r.Context()).Model(&store.ScrapeJob{}).Where("tenant_id = ? AND target_id = ? AND status IN ?", store.TenantIDFromCtx(r.Context()), target.ID, []string{"queued", "leased"}).Count(&active).Error; err != nil {
		writeError(w, 500, err)
		return
	}
	if active != 0 {
		writeError(w, 409, errors.New("target already has an active job"))
		return
	}
	job, err := s.store.QueueScrapeJob(r.Context(), target.ID)
	if err != nil {
		writeError(w, 500, err)
		return
	}
	writeJSON(w, 201, map[string]any{"id": job.ID, "target_id": job.TargetID, "status": job.Status})
}

func (s *Server) handleAutomaticImportDisable(w http.ResponseWriter, r *http.Request) {
	s.automaticImportMu.Lock()
	defer s.automaticImportMu.Unlock()
	target, ok := s.automaticImportOwnedTarget(w, r)
	if !ok {
		return
	}
	if err := s.store.DB().WithContext(r.Context()).Model(&store.ScrapeTarget{}).Where("tenant_id = ? AND id = ?", store.TenantIDFromCtx(r.Context()), target.ID).Update("enabled", false).Error; err != nil {
		writeError(w, 500, err)
		return
	}
	target.Enabled = false
	writeJSON(w, 200, automaticImportTargetJSON(target))
}
func bearer(r *http.Request) string {
	v := strings.TrimSpace(r.Header.Get("Authorization"))
	if strings.HasPrefix(v, "Bearer ") {
		return strings.TrimSpace(strings.TrimPrefix(v, "Bearer "))
	}
	return ""
}
func (s *Server) workerConnection(r *http.Request) (store.SourceConnection, error) {
	if bearer(r) == "" {
		return store.SourceConnection{}, errors.New("unauthorized")
	}
	return s.store.FindSourceConnectionByToken(r.Context(), bearer(r))
}

type workerJob struct {
	ContractVersion   int             `json:"contract_version"`
	JobID             uint            `json:"job_id"`
	Attempt           int             `json:"attempt"`
	TargetID          uint            `json:"target_id"`
	URL               string          `json:"url"`
	Marketplace       string          `json:"marketplace"`
	ExternalProductID string          `json:"external_product_id"`
	SellerArticle     string          `json:"seller_article"`
	Config            json.RawMessage `json:"config"`
	Cursor            string          `json:"cursor"`
	LeaseUntil        *time.Time      `json:"lease_until"`
}

func writeWorkerJSON(w http.ResponseWriter, status int, value any) {
	encoded, err := json.Marshal(value)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	var payload map[string]any
	if err := json.Unmarshal(encoded, &payload); err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	payload["contract_version"] = 1
	writeJSON(w, status, payload)
}

func workerJobPayload(job store.ScrapeJob, target store.ScrapeTarget) workerJob {
	config := json.RawMessage(target.ScrapeConfig)
	if len(config) == 0 {
		config = json.RawMessage(`{}`)
	}
	return workerJob{ContractVersion: 1, JobID: job.ID, Attempt: job.Attempts, TargetID: job.TargetID, URL: target.URL, Marketplace: target.Marketplace, ExternalProductID: target.ExternalProductID, SellerArticle: target.SellerArticle, Config: config, Cursor: job.CursorBefore, LeaseUntil: job.LeaseUntil}
}

func (s *Server) handleWorkerJobs(w http.ResponseWriter, r *http.Request) {
	c, err := s.workerConnection(r)
	if err != nil {
		writeError(w, 401, err)
		return
	}
	ctx := store.WithTenant(r.Context(), c.TenantID)
	jobs, err := s.store.QueuedJobs(ctx, c.ID)
	if err != nil {
		writeError(w, 500, err)
		return
	}
	out := make([]workerJob, 0, len(jobs))
	for _, job := range jobs {
		target, err := s.store.TargetForJob(ctx, c.ID, job.ID)
		if err != nil {
			continue
		}
		out = append(out, workerJobPayload(job, target))
	}
	writeWorkerJSON(w, 200, map[string]any{"jobs": out})
}

func (s *Server) handleWorkerClaim(w http.ResponseWriter, r *http.Request) {
	c, err := s.workerConnection(r)
	if err != nil {
		writeError(w, 401, err)
		return
	}
	id, _ := strconv.ParseUint(r.PathValue("id"), 10, 64)
	ctx := store.WithTenant(r.Context(), c.TenantID)
	job, err := s.store.ClaimScrapeJob(ctx, c.ID, uint(id), 15*time.Minute)
	if err != nil {
		writeError(w, 409, errors.New("job unavailable"))
		return
	}
	target, err := s.store.TargetForJob(ctx, c.ID, job.ID)
	if err != nil {
		writeError(w, 500, err)
		return
	}
	writeWorkerJSON(w, 200, workerJobPayload(job, target))
}
func (s *Server) handleWorkerResult(w http.ResponseWriter, r *http.Request) {
	c, err := s.workerConnection(r)
	if err != nil {
		writeError(w, 401, err)
		return
	}
	id, _ := strconv.ParseUint(r.PathValue("id"), 10, 64)
	ctx := store.WithTenant(r.Context(), c.TenantID)
	if previous, lookupErr := s.store.ImportRunByJob(ctx, c.ID, uint(id)); lookupErr == nil {
		if previous.Status != "succeeded" {
			writeError(w, 409, errors.New("job unavailable"))
			return
		}
		writeWorkerJSON(w, 200, previous)
		return
	}
	var envelope struct {
		ContractVersion int                    `json:"contract_version"`
		Attempt         int                    `json:"attempt"`
		Result          imports.TransportBatch `json:"result"`
	}
	if json.NewDecoder(http.MaxBytesReader(w, r.Body, 10<<20)).Decode(&envelope) != nil {
		writeError(w, 400, errors.New("invalid result"))
		return
	}
	batch := envelope.Result
	batch.ContractVersion = envelope.ContractVersion
	target, err := s.store.TargetForJob(ctx, c.ID, uint(id))
	if err != nil {
		writeError(w, 404, err)
		return
	}
	batch.Source = imports.TransportSource{Provider: c.Provider, Marketplace: target.Marketplace, Method: c.Method}
	reviews, err := imports.NormalizeTransportBatch(batch)
	if err != nil {
		writeError(w, 400, err)
		return
	}
	for i := range reviews {
		reviews[i].MarketplaceIDVerified = false
	}
	var report imports.Report
	err = s.store.WithScrapeJobLease(ctx, c.ID, uint(id), envelope.Attempt, func(tx *store.Store) error {
		report = imports.NewService(tx).Import(ctx, imports.SourceContext{Marketplace: target.Marketplace, Method: c.Method, ConnectionID: c.ID, ExternalProductID: target.ExternalProductID, SellerArticle: target.SellerArticle}, reviews)
		if report.Failed != 0 {
			return nil
		}
		return tx.FinishScrapeJob(ctx, c.ID, uint(id), "succeeded", batch.Cursor, store.ImportRun{Received: report.Total, Created: report.Created, Updated: report.Updated, Failed: report.Failed, Skipped: report.Skipped, Status: "succeeded"})
	})
	if err != nil {
		writeError(w, 409, err)
		return
	}
	if report.Failed != 0 {
		writeWorkerJSON(w, 409, report)
		return
	}
	writeWorkerJSON(w, 200, report)
}
func (s *Server) handleWorkerFinish(w http.ResponseWriter, r *http.Request) {
	c, err := s.workerConnection(r)
	if err != nil {
		writeError(w, 401, err)
		return
	}
	var input struct {
		Status  string `json:"status"`
		Error   string `json:"error"`
		Attempt int    `json:"attempt"`
	}
	if json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&input) != nil || input.Status != "failed" || input.Error == "" || input.Attempt < 1 {
		writeError(w, 400, errors.New("failed status, attempt, and error are required"))
		return
	}
	if len(input.Error) > 512 {
		input.Error = input.Error[:512]
	}
	id, _ := strconv.ParseUint(r.PathValue("id"), 10, 64)
	ctx := store.WithTenant(r.Context(), c.TenantID)
	if err := s.store.FinishScrapeJobAttempt(ctx, c.ID, uint(id), input.Attempt, "failed", "", store.ImportRun{Status: "failed", Error: input.Error}); err != nil {
		writeError(w, 409, errors.New("job unavailable"))
		return
	}
	writeWorkerJSON(w, 200, map[string]string{"status": "failed"})
}

func (s *Server) handleWorkerHeartbeat(w http.ResponseWriter, r *http.Request) {
	c, err := s.workerConnection(r)
	if err != nil {
		writeError(w, 401, err)
		return
	}
	var input struct {
		Attempt int `json:"attempt"`
	}
	if json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&input) != nil || input.Attempt < 1 {
		writeError(w, 400, errors.New("attempt is required"))
		return
	}
	id, _ := strconv.ParseUint(r.PathValue("id"), 10, 64)
	job, err := s.store.HeartbeatScrapeJob(store.WithTenant(r.Context(), c.TenantID), c.ID, uint(id), input.Attempt, 15*time.Minute)
	if err != nil {
		writeError(w, 409, errors.New("job unavailable"))
		return
	}
	writeWorkerJSON(w, 200, map[string]any{"lease_until": job.LeaseUntil})
}
