package server

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reviews/internal/store"
	"strconv"
	"strings"
	"testing"
	"time"
)

func TestAdminTargetCanonicalizesOzonCardURL(t *testing.T) {
	s := newAuthTestServer(t)
	cookie := loginTestAdmin(t, s)
	csrf := getCSRFToken(t, s, cookie)
	r := httptest.NewRequest("POST", "/admin/api/external-sources", strings.NewReader(`{"name":"Ozon scraper","provider":"ozon","marketplace":"ozon"}`))
	r.AddCookie(cookie)
	r.AddCookie(&http.Cookie{Name: csrfCookieName, Value: csrf})
	r.Header.Set(csrfHeaderName, csrf)
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	s.adminMux().ServeHTTP(w, r)
	if w.Code != http.StatusCreated {
		t.Fatalf("source %d %s", w.Code, w.Body.String())
	}
	var source struct {
		ID    uint   `json:"id"`
		Token string `json:"token"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &source); err != nil {
		t.Fatal(err)
	}
	r = httptest.NewRequest("POST", "/admin/api/external-sources/"+strconv.Itoa(int(source.ID))+"/targets", strings.NewReader(`{"url":"https://www.ozon.ru/product/indikator-golov-samogona-test-na-aldegidy-30-ml-3421330164/?from=share_android&perehod=secret&sh=secret&short=secret&__rr=1","marketplace":"ozon"}`))
	r.AddCookie(cookie)
	r.AddCookie(&http.Cookie{Name: csrfCookieName, Value: csrf})
	r.Header.Set(csrfHeaderName, csrf)
	r.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	s.adminMux().ServeHTTP(w, r)
	if w.Code != http.StatusCreated {
		t.Fatalf("target %d %s", w.Code, w.Body.String())
	}
	var target store.ScrapeTarget
	if err := json.Unmarshal(w.Body.Bytes(), &target); err != nil {
		t.Fatal(err)
	}
	if target.URL != "https://www.ozon.ru/product/indikator-golov-samogona-test-na-aldegidy-30-ml-3421330164/" || target.ExternalProductID != "3421330164" {
		t.Fatalf("target=%+v", target)
	}
	var stored store.ScrapeTarget
	if err := s.store.DB().First(&stored, target.ID).Error; err != nil {
		t.Fatal(err)
	}
	if stored.URL != target.URL || strings.Contains(stored.URL, "secret") || strings.Contains(w.Body.String(), "secret") {
		t.Fatalf("secret persisted: stored=%q response=%s", stored.URL, w.Body.String())
	}
	job, err := s.store.QueueScrapeJob(store.WithTenant(context.Background(), store.DefaultTenantID), target.ID)
	if err != nil {
		t.Fatal(err)
	}
	r = httptest.NewRequest("GET", "/external/v1/worker/jobs", nil)
	r.Header.Set("Authorization", "Bearer "+source.Token)
	w = httptest.NewRecorder()
	s.handler().ServeHTTP(w, r)
	if w.Code != http.StatusOK || !strings.Contains(w.Body.String(), `"url":"`+target.URL+`"`) || strings.Contains(w.Body.String(), "secret") || !strings.Contains(w.Body.String(), `"job_id":`+strconv.Itoa(int(job.ID))) {
		t.Fatalf("poll %d %s", w.Code, w.Body.String())
	}
}

func TestWorkerPollAndClaimUseConnectionTenant(t *testing.T) {
	s := newAuthTestServer(t)
	ctx := context.Background()
	tenant, err := s.store.CreateTenant(ctx, "Worker owner", "https://worker.example")
	if err != nil {
		t.Fatal(err)
	}
	owner := store.WithTenant(ctx, tenant.ID)
	const token = "tenant-worker-token"
	connection := store.SourceConnection{Kind: "worker", Provider: "fixture", Method: "external_service", Name: "fixture", Status: "active", TokenHash: store.HashSourceToken(token)}
	if err := s.store.CreateSourceConnection(owner, &connection); err != nil {
		t.Fatal(err)
	}
	target := store.ScrapeTarget{SourceConnectionID: connection.ID, Marketplace: "wb", URL: "https://example.test/reviews", ExternalProductID: "p1", Enabled: true}
	if err := s.store.CreateScrapeTarget(owner, &target); err != nil {
		t.Fatal(err)
	}
	job, err := s.store.QueueScrapeJob(owner, target.ID)
	if err != nil {
		t.Fatal(err)
	}
	request := func(method, path string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, path, nil)
		r.Header.Set("Authorization", "Bearer "+token)
		w := httptest.NewRecorder()
		s.handler().ServeHTTP(w, r)
		return w
	}
	poll := request(http.MethodGet, "/external/v1/worker/jobs")
	if poll.Code != http.StatusOK || !strings.Contains(poll.Body.String(), `"job_id":`+strconv.Itoa(int(job.ID))) {
		t.Fatalf("poll %d %s", poll.Code, poll.Body.String())
	}
	claim := request(http.MethodPost, "/external/v1/worker/jobs/"+strconv.Itoa(int(job.ID))+"/claim")
	if claim.Code != http.StatusOK || !strings.Contains(claim.Body.String(), `"attempt":1`) {
		t.Fatalf("claim %d %s", claim.Code, claim.Body.String())
	}
}
func TestAdminTargetRepeatDoesNotResetCursorOrQueue(t *testing.T) {
	s := newAuthTestServer(t)
	cookie := loginTestAdmin(t, s)
	csrf := getCSRFToken(t, s, cookie)
	r := httptest.NewRequest("POST", "/admin/api/external-sources", strings.NewReader(`{"name":"Ozon scraper","provider":"ozon","marketplace":"ozon"}`))
	r.AddCookie(cookie)
	r.AddCookie(&http.Cookie{Name: csrfCookieName, Value: csrf})
	r.Header.Set(csrfHeaderName, csrf)
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	s.adminMux().ServeHTTP(w, r)
	if w.Code != http.StatusCreated {
		t.Fatalf("source %d %s", w.Code, w.Body.String())
	}
	var created struct {
		ID uint `json:"id"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}
	path := "/admin/api/external-sources/" + strconv.Itoa(int(created.ID)) + "/targets"
	create := func(body string) *httptest.ResponseRecorder {
		r := httptest.NewRequest("POST", path, strings.NewReader(body))
		r.AddCookie(cookie)
		r.AddCookie(&http.Cookie{Name: csrfCookieName, Value: csrf})
		r.Header.Set(csrfHeaderName, csrf)
		r.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		s.adminMux().ServeHTTP(w, r)
		return w
	}
	first := create(`{"url":"https://www.ozon.ru/product/example-3421330164/","marketplace":"ozon"}`)
	if first.Code != http.StatusCreated {
		t.Fatalf("first target %d %s", first.Code, first.Body.String())
	}
	var target store.ScrapeTarget
	if err := json.Unmarshal(first.Body.Bytes(), &target); err != nil {
		t.Fatal(err)
	}
	target.LastCursor = "kept"
	if err := s.store.DB().Model(&store.ScrapeTarget{}).Where("id = ?", target.ID).Update("last_cursor", target.LastCursor).Error; err != nil {
		t.Fatal(err)
	}
	repeat := create(`{"url":"https://www.ozon.ru/product/example-3421330164/?secret=do-not-store","marketplace":"ozon"}`)
	var repeated store.ScrapeTarget
	if err := json.Unmarshal(repeat.Body.Bytes(), &repeated); err != nil {
		t.Fatal(err)
	}
	if repeat.Code != http.StatusCreated || repeated.ID != target.ID || strings.Contains(repeat.Body.String(), "secret") {
		t.Fatalf("repeat target %d %s", repeat.Code, repeat.Body.String())
	}
	var stored store.ScrapeTarget
	if err := s.store.DB().First(&stored, target.ID).Error; err != nil {
		t.Fatal(err)
	}
	if stored.LastCursor != "kept" {
		t.Fatalf("cursor reset: %q", stored.LastCursor)
	}
	var jobs int64
	if err := s.store.DB().Model(&store.ScrapeJob{}).Count(&jobs).Error; err != nil {
		t.Fatal(err)
	}
	if jobs != 0 {
		t.Fatalf("repeat queued %d jobs", jobs)
	}
}

func TestAdminTargetRejectsUnsafeOrConflictingOzonURL(t *testing.T) {
	s := newAuthTestServer(t)
	cookie := loginTestAdmin(t, s)
	csrf := getCSRFToken(t, s, cookie)
	createSource := func() uint {
		r := httptest.NewRequest("POST", "/admin/api/external-sources", strings.NewReader(`{"name":"Ozon scraper","provider":"ozon","marketplace":"ozon"}`))
		r.AddCookie(cookie)
		r.AddCookie(&http.Cookie{Name: csrfCookieName, Value: csrf})
		r.Header.Set(csrfHeaderName, csrf)
		r.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		s.adminMux().ServeHTTP(w, r)
		var source struct {
			ID uint `json:"id"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &source); err != nil {
			t.Fatal(err)
		}
		return source.ID
	}
	id := createSource()
	for _, tc := range []struct{ name, body string }{
		{"userinfo", `{"url":"https://attacker@www.ozon.ru/product/item-3421330164/","marketplace":"ozon"}`},
		{"HTTP", `{"url":"http://www.ozon.ru/product/item-3421330164/","marketplace":"ozon"}`},
		{"bare host", `{"url":"https://ozon.ru/product/item-3421330164/","marketplace":"ozon"}`},
		{"host suffix", `{"url":"https://www.ozon.ru.attacker.example/product/item-3421330164/","marketplace":"ozon"}`},
		{"missing product ID", `{"url":"https://www.ozon.ru/product/item/","marketplace":"ozon"}`},
		{"conflict", `{"url":"https://www.ozon.ru/product/item-3421330164/","marketplace":"ozon","external_product_id":"other"}`},
	} {
		r := httptest.NewRequest("POST", "/admin/api/external-sources/"+strconv.Itoa(int(id))+"/targets", strings.NewReader(tc.body))
		r.AddCookie(cookie)
		r.AddCookie(&http.Cookie{Name: csrfCookieName, Value: csrf})
		r.Header.Set(csrfHeaderName, csrf)
		r.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		s.adminMux().ServeHTTP(w, r)
		if w.Code != http.StatusBadRequest {
			t.Errorf("%s: status %d body %s", tc.name, w.Code, w.Body.String())
		}
	}
}

func TestWorkerResultRoutesToTokenTenantAndTarget(t *testing.T) {
	s := newAuthTestServer(t)
	cookie := loginTestAdmin(t, s)
	csrf := getCSRFToken(t, s, cookie)
	admin := func(method, path, body string) *httptest.ResponseRecorder {
		t.Helper()
		r := httptest.NewRequest(method, path, strings.NewReader(body))
		r.AddCookie(cookie)
		r.AddCookie(&http.Cookie{Name: csrfCookieName, Value: csrf})
		r.Header.Set(csrfHeaderName, csrf)
		r.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		s.adminMux().ServeHTTP(w, r)
		return w
	}
	created := admin("POST", "/admin/api/external-sources", `{"name":"Local scraper","provider":"ozon","marketplace":"ozon"}`)
	if created.Code != http.StatusCreated {
		t.Fatalf("create source %d %s", created.Code, created.Body.String())
	}
	var source struct {
		ID    uint   `json:"id"`
		Token string `json:"token"`
	}
	if err := json.Unmarshal(created.Body.Bytes(), &source); err != nil {
		t.Fatal(err)
	}
	target := admin("POST", "/admin/api/external-sources/"+strconv.Itoa(int(source.ID))+"/targets", `{"url":"https://www.ozon.ru/product/example-1/","marketplace":"ozon","seller_article":"article1"}`)
	if target.Code != http.StatusCreated {
		t.Fatalf("target %d %s", target.Code, target.Body.String())
	}
	var targetID struct {
		ID uint `json:"id"`
	}
	if err := json.Unmarshal(target.Body.Bytes(), &targetID); err != nil {
		t.Fatal(err)
	}
	queued := admin("POST", "/admin/api/external-sources/"+strconv.Itoa(int(source.ID))+"/targets/"+strconv.Itoa(int(targetID.ID))+"/queue", `{}`)
	if queued.Code != http.StatusCreated {
		t.Fatalf("queue %d %s", queued.Code, queued.Body.String())
	}
	var job struct {
		ID uint `json:"id"`
	}
	if err := json.Unmarshal(queued.Body.Bytes(), &job); err != nil {
		t.Fatal(err)
	}
	worker := func(method, path, body string) *httptest.ResponseRecorder {
		t.Helper()
		r := httptest.NewRequest(method, path, bytes.NewBufferString(body))
		r.Header.Set("Authorization", "Bearer "+source.Token)
		r.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		s.handler().ServeHTTP(w, r)
		return w
	}
	polled := worker("GET", "/external/v1/worker/jobs", "")
	if polled.Code != 200 || !strings.Contains(polled.Body.String(), "example-1") {
		t.Fatalf("poll %d %s", polled.Code, polled.Body.String())
	}
	path := "/external/v1/worker/jobs/" + strconv.Itoa(int(job.ID))
	claim := worker("POST", path+"/claim", `{}`)
	if claim.Code != 200 || !strings.Contains(claim.Body.String(), `"url":"https://www.ozon.ru/product/example-1/"`) || !strings.Contains(claim.Body.String(), `"job_id":`) {
		t.Fatalf("claim %d %s", claim.Code, claim.Body.String())
	}
	result := worker("POST", path+"/result", `{"contract_version":1,"attempt":1,"result":{"cursor":"cursor-2","source":{"provider":"spoof-provider","marketplace":"wb","method":"api"},"records":[{"marketplace_review_id":"ozon-real-1","external_product_id":"spoof","seller_article":"spoof","text":"Отличный товар","created_at":"2026-09-29T10:00:00Z"}]},"tenant_id":999,"marketplace":"wb"}`)

	if result.Code != 200 {
		t.Fatalf("result %d %s", result.Code, result.Body.String())
	}
	second := worker("POST", path+"/result", `{"contract_version":1,"attempt":1,"result":{"cursor":"cursor-2","records":[]}}`)
	if second.Code != 200 {
		t.Fatalf("repeat result %d %s", second.Code, second.Body.String())
	}
	rows, err := s.store.ListReviews(store.WithTenant(context.Background(), store.DefaultTenantID), store.ReviewListFilter{})
	if err != nil {
		t.Fatal(err)
	}
	if len(rows) != 1 || rows[0].Marketplace != "ozon" || rows[0].ExternalProductID != "1" || rows[0].SellerArticle != "article1" || rows[0].SourceKind != "imported" || rows[0].SourceMethod != "scraper" {
		t.Fatalf("rows=%+v", rows)
	}
	var stored store.ScrapeTarget
	if err := s.store.DB().First(&stored, targetID.ID).Error; err != nil {
		t.Fatal(err)
	}
	if stored.LastCursor != "cursor-2" {
		t.Fatalf("cursor = %q", stored.LastCursor)
	}
	if second.Body.String() == "" || !strings.Contains(second.Body.String(), `"Created":1`) {
		t.Fatalf("repeat report = %s", second.Body.String())
	}
}

// Every successful worker response carries the negotiated contract version so
// strict external clients can validate the whole request lifecycle.
func TestWorkerResponsesCarryContractVersion(t *testing.T) {
	s := newAuthTestServer(t)
	ctx := store.WithTenant(context.Background(), store.DefaultTenantID)
	c := store.SourceConnection{Kind: "worker", Provider: "ozon", Method: "scraper", Name: "worker", Status: "active", TokenHash: store.HashSourceToken("contract-token")}
	if err := s.store.CreateSourceConnection(ctx, &c); err != nil {
		t.Fatal(err)
	}
	target := store.ScrapeTarget{SourceConnectionID: c.ID, Marketplace: "ozon", URL: "https://www.ozon.ru/product/item-1/", Enabled: true}
	if err := s.store.CreateScrapeTarget(ctx, &target); err != nil {
		t.Fatal(err)
	}
	job, err := s.store.QueueScrapeJob(ctx, target.ID)
	if err != nil {
		t.Fatal(err)
	}
	send := func(method, path, body string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, path, strings.NewReader(body))
		r.Header.Set("Authorization", "Bearer contract-token")
		w := httptest.NewRecorder()
		s.handler().ServeHTTP(w, r)
		return w
	}
	check := func(w *httptest.ResponseRecorder) {
		t.Helper()
		if w.Code < 200 || w.Code >= 300 || !strings.Contains(w.Body.String(), `"contract_version":1`) {
			t.Fatalf("response %d %s", w.Code, w.Body.String())
		}
	}
	check(send("GET", "/external/v1/worker/jobs", ""))
	path := "/external/v1/worker/jobs/" + strconv.Itoa(int(job.ID))
	check(send("POST", path+"/claim", `{}`))
	check(send("POST", path+"/heartbeat", `{"attempt":1}`))
	check(send("POST", path+"/result", `{"contract_version":1,"attempt":1,"result":{"cursor":"after","records":[]}}`))
}

func TestWorkerFailureLeavesCursorAndReportsError(t *testing.T) {
	s := newAuthTestServer(t)
	c := store.SourceConnection{Kind: "worker", Provider: "ozon", Method: "scraper", Name: "worker", Status: "active", TokenHash: store.HashSourceToken("failure-token")}
	ctx := store.WithTenant(context.Background(), store.DefaultTenantID)
	if err := s.store.CreateSourceConnection(ctx, &c); err != nil {
		t.Fatal(err)
	}
	target := store.ScrapeTarget{SourceConnectionID: c.ID, Marketplace: "ozon", URL: "https://www.ozon.ru/product/1", LastCursor: "before", Enabled: true}
	if err := s.store.CreateScrapeTarget(ctx, &target); err != nil {
		t.Fatal(err)
	}
	job, err := s.store.QueueScrapeJob(ctx, target.ID)
	if err != nil {
		t.Fatal(err)
	}
	path := "/external/v1/worker/jobs/" + strconv.Itoa(int(job.ID))
	send := func(suffix string, body string) *httptest.ResponseRecorder {
		r := httptest.NewRequest("POST", path+suffix, strings.NewReader(body))
		r.Header.Set("Authorization", "Bearer failure-token")
		w := httptest.NewRecorder()
		s.handler().ServeHTTP(w, r)
		return w
	}
	if w := send("/claim", `{}`); w.Code != 200 {
		t.Fatalf("claim: %d %s", w.Code, w.Body.String())
	}
	if w := send("/heartbeat", `{"attempt":1}`); w.Code != 200 || !strings.Contains(w.Body.String(), `"lease_until"`) {
		t.Fatalf("heartbeat: %d %s", w.Code, w.Body.String())
	}
	if w := send("/finish", `{"attempt":1,"status":"failed","error":"fetch failed"}`); w.Code != 200 {
		t.Fatalf("finish: %d %s", w.Code, w.Body.String())
	}
	if w := send("/result", `{"contract_version":1,"result":{"cursor":"after","records":[]}}`); w.Code == 200 {
		t.Fatal("accepted result after failure")
	}
	var stored store.ScrapeTarget
	if err := s.store.DB().First(&stored, target.ID).Error; err != nil {
		t.Fatal(err)
	}
	if stored.LastCursor != "before" || stored.LastStatus != "failed" {
		t.Fatalf("target: %+v", stored)
	}
}

func TestWorkerExpiredResultDoesNotImportOrAdvanceCursor(t *testing.T) {
	s := newAuthTestServer(t)
	ctx := store.WithTenant(context.Background(), store.DefaultTenantID)
	c := store.SourceConnection{Kind: "worker", Provider: "ozon", Method: "scraper", Name: "worker", Status: "active", TokenHash: store.HashSourceToken("expired-token")}
	if err := s.store.CreateSourceConnection(ctx, &c); err != nil {
		t.Fatal(err)
	}
	target := store.ScrapeTarget{SourceConnectionID: c.ID, Marketplace: "ozon", URL: "https://www.ozon.ru/product/1", LastCursor: "before", Enabled: true}
	if err := s.store.CreateScrapeTarget(ctx, &target); err != nil {
		t.Fatal(err)
	}
	job, err := s.store.QueueScrapeJob(ctx, target.ID)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.store.ClaimScrapeJob(ctx, c.ID, job.ID, time.Minute); err != nil {
		t.Fatal(err)
	}
	if err := s.store.DB().Model(&store.ScrapeJob{}).Where("id = ?", job.ID).Update("lease_until", time.Now().Add(-time.Minute)).Error; err != nil {
		t.Fatal(err)
	}
	r := httptest.NewRequest("POST", "/external/v1/worker/jobs/"+strconv.Itoa(int(job.ID))+"/result", strings.NewReader(`{"contract_version":1,"result":{"cursor":"after","records":[{"marketplace_review_id":"expired-1","text":"should not import","created_at":"2026-09-29T10:00:00Z"}]}}`))
	r.Header.Set("Authorization", "Bearer expired-token")
	w := httptest.NewRecorder()
	s.handler().ServeHTTP(w, r)
	if w.Code != 409 {
		t.Fatalf("result %d %s", w.Code, w.Body.String())
	}
	rows, err := s.store.ListReviews(ctx, store.ReviewListFilter{})
	if err != nil {
		t.Fatal(err)
	}
	if len(rows) != 0 {
		t.Fatalf("reviews after expired result: %+v", rows)
	}
	if err := s.store.DB().First(&target, target.ID).Error; err != nil {
		t.Fatal(err)
	}
	if target.LastCursor != "before" {
		t.Fatalf("cursor = %q", target.LastCursor)
	}
}

func TestWorkerPartialBatchKeepsCursorAndValidReviews(t *testing.T) {
	s := newAuthTestServer(t)
	ctx := store.WithTenant(context.Background(), store.DefaultTenantID)
	c := store.SourceConnection{Kind: "worker", Provider: "ozon", Method: "scraper", Name: "worker", Status: "active", TokenHash: store.HashSourceToken("batch-token")}
	if err := s.store.CreateSourceConnection(ctx, &c); err != nil {
		t.Fatal(err)
	}
	target := store.ScrapeTarget{SourceConnectionID: c.ID, Marketplace: "ozon", URL: "https://www.ozon.ru/product/1", LastCursor: "before", Enabled: true}
	if err := s.store.CreateScrapeTarget(ctx, &target); err != nil {
		t.Fatal(err)
	}
	job, err := s.store.QueueScrapeJob(ctx, target.ID)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.store.ClaimScrapeJob(ctx, c.ID, job.ID, time.Minute); err != nil {
		t.Fatal(err)
	}
	r := httptest.NewRequest("POST", "/external/v1/worker/jobs/"+strconv.Itoa(int(job.ID))+"/result", strings.NewReader(`{"contract_version":1,"attempt":1,"result":{"cursor":"after","records":[{"marketplace_review_id":"valid","text":"valid","created_at":"2026-09-29T10:00:00Z"},{"marketplace_review_id":"invalid","text":"","created_at":"2026-09-29T10:00:00Z"}]}}`))
	r.Header.Set("Authorization", "Bearer batch-token")
	w := httptest.NewRecorder()
	s.handler().ServeHTTP(w, r)
	if w.Code != 409 || !strings.Contains(w.Body.String(), `"Failed":1`) {
		t.Fatalf("result %d %s", w.Code, w.Body.String())
	}
	rows, err := s.store.ListReviews(ctx, store.ReviewListFilter{})
	if err != nil {
		t.Fatal(err)
	}
	if len(rows) != 1 || rows[0].Text != "valid" || rows[0].SourceMethod != "scraper" || rows[0].SourceKind != "imported" {
		t.Fatalf("valid reviews after partial batch: %+v", rows)
	}
	if err := s.store.DB().First(&target, target.ID).Error; err != nil {
		t.Fatal(err)
	}
	if target.LastCursor != "before" {
		t.Fatalf("cursor = %q", target.LastCursor)
	}
}

func TestWorkerStaleAttemptCannotSubmitAfterReclaim(t *testing.T) {
	s := newAuthTestServer(t)
	ctx := store.WithTenant(context.Background(), store.DefaultTenantID)
	c := store.SourceConnection{Kind: "worker", Provider: "ozon", Method: "scraper", Name: "worker", Status: "active", TokenHash: store.HashSourceToken("reclaim-token")}
	if err := s.store.CreateSourceConnection(ctx, &c); err != nil {
		t.Fatal(err)
	}
	target := store.ScrapeTarget{SourceConnectionID: c.ID, Marketplace: "ozon", URL: "https://www.ozon.ru/product/1", LastCursor: "before", Enabled: true}
	if err := s.store.CreateScrapeTarget(ctx, &target); err != nil {
		t.Fatal(err)
	}
	job, err := s.store.QueueScrapeJob(ctx, target.ID)
	if err != nil {
		t.Fatal(err)
	}
	path := "/external/v1/worker/jobs/" + strconv.Itoa(int(job.ID))
	send := func(suffix, body string) *httptest.ResponseRecorder {
		r := httptest.NewRequest("POST", path+suffix, strings.NewReader(body))
		r.Header.Set("Authorization", "Bearer reclaim-token")
		w := httptest.NewRecorder()
		s.handler().ServeHTTP(w, r)
		return w
	}
	first := send("/claim", `{}`)
	if first.Code != 200 {
		t.Fatalf("first claim %d %s", first.Code, first.Body.String())
	}
	if err := s.store.DB().Model(&store.ScrapeJob{}).Where("id = ?", job.ID).Update("lease_until", time.Now().Add(-time.Minute)).Error; err != nil {
		t.Fatal(err)
	}
	second := send("/claim", `{}`)
	if second.Code != 200 {
		t.Fatalf("reclaim %d %s", second.Code, second.Body.String())
	}
	stale := send("/result", `{"contract_version":1,"attempt":1,"result":{"cursor":"after","records":[{"marketplace_review_id":"stale","text":"stale","created_at":"2026-09-29T10:00:00Z"}]}}`)
	if stale.Code != 409 {
		t.Fatalf("stale result %d %s", stale.Code, stale.Body.String())
	}
	if w := send("/finish", `{"attempt":1,"status":"failed","error":"late failure"}`); w.Code != 409 {
		t.Fatalf("stale finish %d %s", w.Code, w.Body.String())
	}
	if w := send("/heartbeat", `{"attempt":1}`); w.Code != 409 {
		t.Fatalf("stale heartbeat %d %s", w.Code, w.Body.String())
	}
	rows, err := s.store.ListReviews(ctx, store.ReviewListFilter{})
	if err != nil {
		t.Fatal(err)
	}
	if len(rows) != 0 {
		t.Fatalf("stale rows: %+v", rows)
	}
	if err := s.store.DB().First(&target, target.ID).Error; err != nil {
		t.Fatal(err)
	}
	if target.LastCursor != "before" {
		t.Fatalf("cursor %q", target.LastCursor)
	}
}

func TestWorkerProviderRecordIDsAreScopedToConnection(t *testing.T) {
	s := newAuthTestServer(t)
	ctx := store.WithTenant(context.Background(), store.DefaultTenantID)
	for _, token := range []string{"provider-a", "provider-b"} {
		c := store.SourceConnection{Kind: "worker", Provider: "aggregator", Method: "scraper", Name: token, Status: "active", TokenHash: store.HashSourceToken(token)}
		if err := s.store.CreateSourceConnection(ctx, &c); err != nil {
			t.Fatal(err)
		}
		target := store.ScrapeTarget{SourceConnectionID: c.ID, Marketplace: "ozon", URL: "https://example.org/item", Enabled: true}
		if err := s.store.CreateScrapeTarget(ctx, &target); err != nil {
			t.Fatal(err)
		}
		job, err := s.store.QueueScrapeJob(ctx, target.ID)
		if err != nil {
			t.Fatal(err)
		}
		path := "/external/v1/worker/jobs/" + strconv.Itoa(int(job.ID))
		for _, part := range []string{"claim", "result"} {
			body := `{}`
			if part == "result" {
				body = `{"contract_version":1,"attempt":1,"result":{"records":[{"provider_record_id":"local-1","text":"Good","created_at":"2026-09-29T10:00:00Z"}]}}`
			}
			r := httptest.NewRequest("POST", path+"/"+part, strings.NewReader(body))
			r.Header.Set("Authorization", "Bearer "+token)
			w := httptest.NewRecorder()
			s.handler().ServeHTTP(w, r)
			if w.Code != 200 {
				t.Fatalf("%s %d %s", part, w.Code, w.Body.String())
			}
		}
	}
	rows, err := s.store.ListReviews(ctx, store.ReviewListFilter{})
	if err != nil {
		t.Fatal(err)
	}
	if len(rows) != 2 || rows[0].ExternalReviewID == rows[1].ExternalReviewID || rows[0].ExternalReviewID == "local-1" || rows[1].ExternalReviewID == "local-1" {
		t.Fatalf("provider identity collision: %+v", rows)
	}
}
