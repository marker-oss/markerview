package server

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"reviews/internal/store"
)

func TestAutomaticImportTenantAPI(t *testing.T) {
	s := newAuthTestServer(t)
	ctx := context.Background()
	tenant, err := s.store.CreateTenant(ctx, "client", "https://client.example")
	if err != nil {
		t.Fatal(err)
	}
	owner := store.WithTenant(ctx, tenant.ID)
	user, err := s.store.CreateAdminUser(owner, "client", "unused")
	if err != nil {
		t.Fatal(err)
	}
	if err := s.store.CreateSession(ctx, "client-session", user.ID, tenant.ID, time.Now().Add(time.Hour)); err != nil {
		t.Fatal(err)
	}
	request := func(method, path, body string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, path, strings.NewReader(body))
		r.AddCookie(&http.Cookie{Name: sessionCookieName, Value: "client-session"})
		r.AddCookie(&http.Cookie{Name: csrfCookieName, Value: "csrf"})
		r.Header.Set(csrfHeaderName, "csrf")
		w := httptest.NewRecorder()
		s.adminMux().ServeHTTP(w, r)
		return w
	}
	check := func(w *httptest.ResponseRecorder, status int) {
		t.Helper()
		if w.Code != status {
			t.Fatalf("status %d, want %d: %s", w.Code, status, w.Body.String())
		}
		if strings.Contains(w.Body.String(), "worker-secret") || strings.Contains(w.Body.String(), store.HashSourceToken("worker-secret")) {
			t.Fatal("worker credential leaked")
		}
	}
	policy := func(enabled bool, limit int) {
		t.Helper()
		if err := s.store.SetAutomaticImportPolicy(ctx, tenant.ID, enabled, limit); err != nil {
			t.Fatal(err)
		}
	}
	const base = "/admin/api/automatic-import"
	const body = `{"url":"https://www.ozon.ru/product/item-42/?secret=discard#fragment","label":"Item","seller_article":"A42"}`
	check(request("POST", base+"/targets", body), 403)
	policy(true, 1)
	operator := store.SourceConnection{Kind: "worker", Provider: "ozon", Method: "scraper", Name: "operator", TokenHash: store.HashSourceToken("operator-secret"), Status: "active"}
	if err := s.store.CreateSourceConnection(store.WithTenant(ctx, store.DefaultTenantID), &operator); err != nil {
		t.Fatal(err)
	}
	foreign := store.ScrapeTarget{SourceConnectionID: operator.ID, Marketplace: "ozon", ExternalProductID: "99", URL: "https://www.ozon.ru/product/foreign-99/", Enabled: true}
	if err := s.store.CreateScrapeTarget(store.WithTenant(ctx, store.DefaultTenantID), &foreign); err != nil {
		t.Fatal(err)
	}
	check(request("POST", base+"/targets", body), 503)
	var unexpected int64
	if err := s.store.DB().Model(&store.ScrapeTarget{}).Where("tenant_id = ?", tenant.ID).Count(&unexpected).Error; err != nil || unexpected != 0 {
		t.Fatalf("503 created targets: %d, %v", unexpected, err)
	}
	connection := store.SourceConnection{Kind: "worker", Provider: "ozon", Method: "scraper", Name: "client", TokenHash: store.HashSourceToken("worker-secret"), Status: "active"}
	if err := s.store.CreateSourceConnection(owner, &connection); err != nil {
		t.Fatal(err)
	}
	for _, field := range []string{`"tenant_id":1`, `"source_connection_id":1`, `"method":"api"`, `"marketplace":"wb"`} {
		check(request("POST", base+"/targets", `{"url":"https://www.ozon.ru/product/item-42/",`+field+`}`), 400)
	}
	check(request("POST", base+"/targets", `{"url":"https://evil.example/product/item-42/"}`), 400)
	created := request("POST", base+"/targets", body)
	check(created, 201)
	var target struct {
		ID      uint   `json:"id"`
		URL     string `json:"url"`
		Article string `json:"seller_article"`
	}
	if err := json.Unmarshal(created.Body.Bytes(), &target); err != nil {
		t.Fatal(err)
	}
	if target.ID == 0 || target.URL != "https://www.ozon.ru/product/item-42/" || target.Article != "A42" {
		t.Fatalf("target %+v", target)
	}
	initialList := request("GET", base, "")
	if initialList.Code != 200 || strings.Contains(initialList.Body.String(), `"last_sync_at"`) {
		t.Fatalf("unsynced target timestamp leaked: %s", initialList.Body.String())
	}
	var stored store.ScrapeTarget
	if err := s.store.DB().First(&stored, target.ID).Error; err != nil {
		t.Fatal(err)
	}
	if stored.TenantID != tenant.ID || stored.SourceConnectionID != connection.ID {
		t.Fatalf("wrong owner: %+v", stored)
	}
	repeat := request("POST", base+"/targets", `{"url":"https://www.ozon.ru/product/other-slug-42/","seller_article":"changed"}`)
	check(repeat, 200)
	var repeated struct {
		ID      uint   `json:"id"`
		Article string `json:"seller_article"`
	}
	if err := json.Unmarshal(repeat.Body.Bytes(), &repeated); err != nil {
		t.Fatal(err)
	}
	if repeated.ID != target.ID || repeated.Article != target.Article {
		t.Fatalf("changed duplicate %+v", repeated)
	}
	check(request("POST", base+"/targets", `{"url":"https://www.ozon.ru/product/item-43/"}`), 409)
	if err := s.store.DB().Model(&store.ScrapeTarget{}).Where("id = ?", target.ID).Updates(map[string]any{"last_status": "failed", "last_error": "worker timeout", "updated_at": time.Date(2026, 9, 30, 12, 0, 0, 0, time.UTC)}).Error; err != nil {
		t.Fatal(err)
	}
	list := request("GET", base, "")
	check(list, 200)
	var state struct {
		Enabled     bool `json:"enabled"`
		Limit       int  `json:"limit"`
		ActiveCount int  `json:"active_count"`
		Targets     []struct {
			ID         uint    `json:"id"`
			LastStatus string  `json:"last_status"`
			LastError  string  `json:"last_error"`
			LastSyncAt *string `json:"last_sync_at"`
		} `json:"targets"`
	}
	if err := json.Unmarshal(list.Body.Bytes(), &state); err != nil {
		t.Fatal(err)
	}
	if !state.Enabled || state.Limit != 1 || state.ActiveCount != 1 || len(state.Targets) != 1 || state.Targets[0].ID != target.ID || state.Targets[0].LastStatus != "failed" || state.Targets[0].LastError != "worker timeout" || state.Targets[0].LastSyncAt == nil {
		t.Fatalf("state %+v", state)
	}
	for _, action := range []string{"queue", "disable"} {
		check(request("POST", fmt.Sprintf("%s/targets/%d/%s", base, foreign.ID, action), `{}`), 404)
	}
	queue := fmt.Sprintf("%s/targets/%d/queue", base, target.ID)
	policy(false, 1)
	check(request("POST", queue, `{}`), 403)
	policy(true, 0)
	check(request("POST", queue, `{}`), 409)
	policy(true, 1)
	var wg sync.WaitGroup
	results := make(chan *httptest.ResponseRecorder, 2)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); results <- request("POST", queue, `{}`) }()
	}
	wg.Wait()
	close(results)
	statuses := map[int]int{}
	for result := range results {
		statuses[result.Code]++
	}
	if statuses[201] != 1 || statuses[409] != 1 {
		t.Fatalf("concurrent queue statuses %v", statuses)
	}
	jobs, err := s.store.QueuedJobs(owner, connection.ID)
	if err != nil || len(jobs) != 1 || jobs[0].TargetID != target.ID {
		t.Fatalf("jobs %+v, %v", jobs, err)
	}
	if _, err := s.store.ClaimScrapeJob(owner, connection.ID, jobs[0].ID, time.Minute); err != nil {
		t.Fatal(err)
	}
	check(request("POST", queue, `{}`), 409)
	if err := s.store.DB().Model(&store.ScrapeJob{}).Where("id = ?", jobs[0].ID).Update("lease_until", time.Now().Add(-time.Minute)).Error; err != nil {
		t.Fatal(err)
	}
	check(request("POST", queue, `{}`), 409)
	policy(false, 1)
	check(request("POST", fmt.Sprintf("%s/targets/%d/disable", base, target.ID), `{}`), 200)
	policy(true, 1)
	check(request("POST", queue, `{}`), 404)
	check(request("PUT", base, `{"enabled":true,"limit":999}`), 405)
	restore := store.SetStrictTenantModeForTest(true)
	defer restore()
	check(request("POST", "/admin/api/external-sources", `{"name":"spoof","provider":"ozon","marketplace":"ozon"}`), 403)
	check(request("POST", fmt.Sprintf("/admin/api/external-sources/%d/targets", connection.ID), `{"url":"https://www.ozon.ru/product/bypass-999/","marketplace":"ozon"}`), 403)
	check(request("POST", fmt.Sprintf("/admin/api/external-sources/%d/targets/%d/queue", connection.ID, target.ID), `{}`), 403)
	for _, path := range []string{base, base + "/targets", queue, fmt.Sprintf("%s/targets/%d/disable", base, target.ID)} {
		method := "POST"
		if path == base {
			method = "GET"
		}
		r := httptest.NewRequest(method, path, strings.NewReader(body))
		w := httptest.NewRecorder()
		s.adminMux().ServeHTTP(w, r)
		check(w, 401)
		if method == "POST" {
			r = httptest.NewRequest(method, path, strings.NewReader(body))
			r.AddCookie(&http.Cookie{Name: sessionCookieName, Value: "client-session"})
			w = httptest.NewRecorder()
			s.adminMux().ServeHTTP(w, r)
			check(w, 403)
		}
	}
	if err := s.store.CreateSession(ctx, "owner-session", user.ID, 0, time.Now().Add(time.Hour)); err != nil {
		t.Fatal(err)
	}
	if err := s.store.DB().Model(&store.Session{}).Where("token = ?", "owner-session").Update("tenant_id", 0).Error; err != nil {
		t.Fatal(err)
	}
	r := httptest.NewRequest("GET", base, nil)
	r.AddCookie(&http.Cookie{Name: sessionCookieName, Value: "owner-session"})
	w := httptest.NewRecorder()
	s.adminMux().ServeHTTP(w, r)
	check(w, 403)
}
