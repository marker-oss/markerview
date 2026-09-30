package store

import (
	"context"
	"reviews/internal/config"
	"testing"
	"time"
)

func TestCreateScrapeTargetReturnsExistingOzonTarget(t *testing.T) {
	s := newTestStore(t)
	ctx := context.Background()
	c := SourceConnection{Kind: "worker", Provider: "ozon", Method: "scraper", Name: "worker", Status: "active", TokenHash: HashSourceToken("target-repeat")}
	if err := s.CreateSourceConnection(ctx, &c); err != nil {
		t.Fatal(err)
	}
	first := ScrapeTarget{SourceConnectionID: c.ID, URL: "https://www.ozon.ru/product/item-42/", Marketplace: "ozon", ExternalProductID: "42", LastCursor: "kept", Enabled: true}
	if err := s.CreateScrapeTarget(ctx, &first); err != nil {
		t.Fatal(err)
	}
	repeat := ScrapeTarget{SourceConnectionID: c.ID, URL: first.URL, Marketplace: "ozon", ExternalProductID: "42", Enabled: true}
	if err := s.CreateScrapeTarget(ctx, &repeat); err != nil {
		t.Fatal(err)
	}
	if repeat.ID != first.ID {
		t.Fatalf("repeat ID %d, want %d", repeat.ID, first.ID)
	}
	var targets []ScrapeTarget
	if err := s.db.Find(&targets).Error; err != nil {
		t.Fatal(err)
	}
	if len(targets) != 1 || targets[0].LastCursor != "kept" {
		t.Fatalf("targets=%+v", targets)
	}
	conflict := ScrapeTarget{TenantID: first.TenantID, SourceConnectionID: c.ID, URL: first.URL, Marketplace: "ozon", ExternalProductID: "42", Canonical: true, Enabled: true}
	if err := s.db.Create(&conflict).Error; err == nil {
		t.Fatal("database accepted duplicate canonical target")
	}
}
func TestScrapeTargetUniqueIndexKeepsLegacyDuplicates(t *testing.T) {
	s := newTestStore(t)
	ctx := context.Background()
	c := SourceConnection{Kind: "worker", Provider: "ozon", Method: "scraper", Name: "worker", Status: "active", TokenHash: HashSourceToken("legacy-targets")}
	if err := s.CreateSourceConnection(ctx, &c); err != nil {
		t.Fatal(err)
	}
	legacy := ScrapeTarget{TenantID: DefaultTenantID, SourceConnectionID: c.ID, URL: "https://www.ozon.ru/product/legacy-42/?share=one", Marketplace: "ozon", ExternalProductID: "42", Enabled: true}
	if err := s.db.Create(&legacy).Error; err != nil {
		t.Fatal(err)
	}
	legacy.ID, legacy.URL = 0, "https://www.ozon.ru/product/legacy-42/?share=two"
	if err := s.db.Create(&legacy).Error; err != nil {
		t.Fatal(err)
	}
	if err := s.Migrate(ctx); err != nil {
		t.Fatal(err)
	}
	var count int64
	if err := s.db.Model(&ScrapeTarget{}).Where("external_product_id = ?", "42").Count(&count).Error; err != nil {
		t.Fatal(err)
	}
	if count != 2 {
		t.Fatalf("legacy target count = %d", count)
	}
	repeat := ScrapeTarget{SourceConnectionID: c.ID, URL: "https://www.ozon.ru/product/legacy-42/", Marketplace: "ozon", ExternalProductID: "42", Enabled: true}
	if err := s.CreateScrapeTarget(ctx, &repeat); err == nil {
		t.Fatal("ambiguous legacy duplicates were silently selected")
	}
}

func TestClaimScrapeJobIsConnectionScopedAndReclaimsExpiredLease(t *testing.T) {
	s := newTestStore(t)
	ctx := context.Background()
	a := SourceConnection{Kind: "worker", Provider: "ozon", Method: "scraper", Name: "a", Status: "active", TokenHash: HashSourceToken("a")}
	b := SourceConnection{Kind: "worker", Provider: "ozon", Method: "scraper", Name: "b", Status: "active", TokenHash: HashSourceToken("b")}
	for _, c := range []*SourceConnection{&a, &b} {
		if err := s.CreateSourceConnection(ctx, c); err != nil {
			t.Fatal(err)
		}
	}
	target := ScrapeTarget{SourceConnectionID: a.ID, URL: "https://example.org/item", Marketplace: "ozon", Enabled: true}
	if err := s.CreateScrapeTarget(ctx, &target); err != nil {
		t.Fatal(err)
	}
	job, err := s.QueueScrapeJob(ctx, target.ID)
	if err != nil {
		t.Fatal(err)
	}
	if job.Status != "queued" {
		t.Fatalf("legacy queue response: %+v", job)
	}
	if _, err = s.ClaimScrapeJob(ctx, b.ID, job.ID, time.Minute); err == nil {
		t.Fatal("other connection claimed job")
	}
	if _, err = s.ClaimScrapeJob(ctx, a.ID, job.ID, time.Minute); err != nil {
		t.Fatal(err)
	}
	if _, err = s.ClaimScrapeJob(ctx, a.ID, job.ID, time.Minute); err == nil {
		t.Fatal("live lease claimed twice")
	}
	past := time.Now().Add(-time.Minute)
	if err := s.db.Model(&ScrapeJob{}).Where("id = ?", job.ID).Update("lease_until", past).Error; err != nil {
		t.Fatal(err)
	}
	if _, err = s.ClaimScrapeJob(ctx, a.ID, job.ID, time.Minute); err != nil {
		var actual ScrapeJob
		_ = s.db.First(&actual, job.ID).Error
		t.Fatalf("expired lease: %v, job=%+v", err, actual)
	}
}
func TestFinishScrapeJobRequiresLiveLeaseAndKeepsCursorUntilSuccess(t *testing.T) {
	s := newTestStore(t)
	ctx := context.Background()
	c := SourceConnection{Kind: "worker", Provider: "ozon", Method: "scraper", Name: "a", Status: "active", TokenHash: HashSourceToken("a")}
	if err := s.CreateSourceConnection(ctx, &c); err != nil {
		t.Fatal(err)
	}
	target := ScrapeTarget{SourceConnectionID: c.ID, URL: "https://example.org/item", Marketplace: "ozon", Enabled: true, LastCursor: "old"}
	if err := s.CreateScrapeTarget(ctx, &target); err != nil {
		t.Fatal(err)
	}
	job, err := s.QueueScrapeJob(ctx, target.ID)
	if err != nil {
		t.Fatal(err)
	}
	if err = s.FinishScrapeJob(ctx, c.ID, job.ID, "succeeded", "new", ImportRun{Status: "succeeded"}); err == nil {
		t.Fatal("unclaimed job finished")
	}
	if _, err = s.ClaimScrapeJob(ctx, c.ID, job.ID, time.Minute); err != nil {
		t.Fatal(err)
	}
	if err = s.FinishScrapeJob(ctx, c.ID, job.ID, "succeeded", "new", ImportRun{Status: "succeeded"}); err != nil {
		t.Fatal(err)
	}
	if err = s.FinishScrapeJob(ctx, c.ID, job.ID, "succeeded", "new", ImportRun{Status: "succeeded"}); err == nil {
		t.Fatal("finished twice")
	}
	if err = s.db.First(&target, target.ID).Error; err != nil {
		t.Fatal(err)
	}
	if target.LastCursor != "new" {
		t.Fatalf("cursor: %q", target.LastCursor)
	}
	if err := s.db.First(&job, job.ID).Error; err != nil {
		t.Fatal(err)
	}
	if target.LastSyncAt == nil || job.FinishedAt == nil || !target.LastSyncAt.Equal(*job.FinishedAt) {
		t.Fatalf("success timestamp target=%+v, job=%+v", target, job)
	}
	completedAt := *target.LastSyncAt
	job, err = s.QueueScrapeJob(ctx, target.ID)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.ClaimScrapeJob(ctx, c.ID, job.ID, time.Minute); err != nil {
		t.Fatal(err)
	}
	if err := s.db.First(&target, target.ID).Error; err != nil {
		t.Fatal(err)
	}
	if target.LastStatus != "running" || target.LastSyncAt == nil || !target.LastSyncAt.Equal(completedAt) {
		t.Fatalf("claim changed completion time: %+v", target)
	}
	if err := s.FinishScrapeJob(ctx, c.ID, job.ID, "failed", "discard", ImportRun{Status: "failed", Error: "timeout"}); err != nil {
		t.Fatal(err)
	}
	if err := s.db.First(&target, target.ID).Error; err != nil {
		t.Fatal(err)
	}
	if err := s.db.First(&job, job.ID).Error; err != nil {
		t.Fatal(err)
	}
	if target.LastCursor != "new" || target.LastStatus != "failed" || target.LastError != "timeout" || target.LastSyncAt == nil || job.FinishedAt == nil || !target.LastSyncAt.Equal(*job.FinishedAt) {
		t.Fatalf("failure timestamp/cursor target=%+v, job=%+v", target, job)
	}
}

func TestMigrateScrapeTargetLastSyncUsesOwnedCompletions(t *testing.T) {
	s := newTestStore(t)
	ctx := context.Background()
	old := time.Date(2026, 9, 1, 12, 0, 0, 0, time.UTC)
	latest := old.Add(time.Hour)
	for _, target := range []ScrapeTarget{
		{ID: 1, TenantID: 1, SourceConnectionID: 1, URL: "https://example.org/1", Marketplace: "ozon", LastStatus: "failed", UpdatedAt: latest.Add(time.Hour)},
		{ID: 2, TenantID: 1, SourceConnectionID: 1, URL: "https://example.org/2", Marketplace: "ozon", LastStatus: "queued", UpdatedAt: latest},
	} {
		if err := s.db.Create(&target).Error; err != nil {
			t.Fatal(err)
		}
	}
	for _, job := range []ScrapeJob{
		{TargetID: 1, TenantID: 1, SourceConnectionID: 1, Status: "succeeded", FinishedAt: &old},
		{TargetID: 1, TenantID: 1, SourceConnectionID: 1, Status: "failed", FinishedAt: &latest},
		{TargetID: 1, TenantID: 2, SourceConnectionID: 1, Status: "succeeded", FinishedAt: &latest},
		{TargetID: 2, TenantID: 2, SourceConnectionID: 1, Status: "succeeded", FinishedAt: &latest},
		{TargetID: 2, TenantID: 1, SourceConnectionID: 2, Status: "succeeded", FinishedAt: &latest},
		{TargetID: 2, TenantID: 1, SourceConnectionID: 1, Status: "queued"},
	} {
		if err := s.db.Create(&job).Error; err != nil {
			t.Fatal(err)
		}
	}
	// Recreate the pre-upgrade schema without the new nullable column.
	if err := s.db.Migrator().DropColumn(&ScrapeTarget{}, "LastSyncAt"); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 2; i++ {
		if err := s.Migrate(ctx); err != nil {
			t.Fatal(err)
		}
		var targets []ScrapeTarget
		if err := s.db.Order("id").Find(&targets).Error; err != nil {
			t.Fatal(err)
		}
		if len(targets) != 2 || targets[0].LastSyncAt == nil || !targets[0].LastSyncAt.Equal(latest) || targets[1].LastSyncAt != nil {
			t.Fatalf("migration lost completion provenance: %+v", targets)
		}
	}
}

func TestScrapeJobStateTransitionsRollbackWithTarget(t *testing.T) {
	s := newTestStore(t)
	ctx := WithTenant(context.Background(), DefaultTenantID)
	if err := s.SetAutomaticImportPolicy(ctx, DefaultTenantID, true, 1); err != nil {
		t.Fatal(err)
	}
	conn := SourceConnection{Kind: "worker", Provider: "ozon", Method: "scraper", Name: "atomic", Status: "active", TokenHash: HashSourceToken("atomic")}
	if err := s.CreateSourceConnection(ctx, &conn); err != nil {
		t.Fatal(err)
	}
	target := ScrapeTarget{SourceConnectionID: conn.ID, URL: "https://www.ozon.ru/product/item-42/", Marketplace: "ozon", ExternalProductID: "42", Enabled: true}
	if err := s.CreateAutomaticImportTarget(ctx, &target, 0); err != nil {
		t.Fatal(err)
	}
	blockUpdates := func() {
		t.Helper()
		if err := s.db.Exec("CREATE TRIGGER block_target_status BEFORE UPDATE OF last_status ON scrape_targets BEGIN SELECT RAISE(ABORT, 'target unavailable'); END").Error; err != nil {
			t.Fatal(err)
		}
	}
	blockUpdates()
	if _, err := s.QueueAutomaticImportJob(ctx, target.ID); err == nil {
		t.Fatal("queue succeeded despite target update failure")
	}
	assertCount(t, s, &ScrapeJob{}, 0)
	if err := s.db.Exec("DROP TRIGGER block_target_status").Error; err != nil {
		t.Fatal(err)
	}
	job, err := s.QueueAutomaticImportJob(ctx, target.ID)
	if err != nil {
		t.Fatal(err)
	}
	if job.Status != "queued" {
		t.Fatalf("queue result: %+v", job)
	}
	blockUpdates()
	if _, err := s.ClaimScrapeJob(ctx, conn.ID, job.ID, time.Minute); err == nil {
		t.Fatal("claim succeeded despite target update failure")
	}
	if err := s.db.First(&job, job.ID).Error; err != nil {
		t.Fatal(err)
	}
	if job.Status != "queued" || job.Attempts != 0 || job.LeaseUntil != nil {
		t.Fatalf("claim was not rolled back: %+v", job)
	}
}

func TestHeartbeatScrapeJobRequiresActiveOwnedLease(t *testing.T) {
	s := newTestStore(t)
	ctx := context.Background()
	c := SourceConnection{Kind: "worker", Provider: "ozon", Method: "scraper", Name: "a", Status: "active", TokenHash: HashSourceToken("heartbeat")}
	if err := s.CreateSourceConnection(ctx, &c); err != nil {
		t.Fatal(err)
	}
	target := ScrapeTarget{SourceConnectionID: c.ID, URL: "https://example.org/item", Marketplace: "ozon", Enabled: true}
	if err := s.CreateScrapeTarget(ctx, &target); err != nil {
		t.Fatal(err)
	}
	job, err := s.QueueScrapeJob(ctx, target.ID)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.HeartbeatScrapeJob(ctx, c.ID, job.ID, 1, time.Minute); err == nil {
		t.Fatal("heartbeat accepted unclaimed job")
	}
	claimed, err := s.ClaimScrapeJob(ctx, c.ID, job.ID, time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.HeartbeatScrapeJob(ctx, c.ID+1, job.ID, claimed.Attempts, 2*time.Minute); err == nil {
		t.Fatal("heartbeat accepted foreign token")
	}
	extended, err := s.HeartbeatScrapeJob(ctx, c.ID, job.ID, claimed.Attempts, 2*time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	if !extended.LeaseUntil.After(*claimed.LeaseUntil) {
		t.Fatalf("lease not extended: %v then %v", claimed.LeaseUntil, extended.LeaseUntil)
	}
	if err := s.db.Model(&ScrapeJob{}).Where("id = ?", job.ID).Update("lease_until", time.Now().Add(-time.Minute)).Error; err != nil {
		t.Fatal(err)
	}
	if _, err := s.HeartbeatScrapeJob(ctx, c.ID, job.ID, claimed.Attempts, time.Minute); err == nil {
		t.Fatal("heartbeat revived expired lease")
	}
}

func TestQueuedJobsIncludesExpiredLeases(t *testing.T) {
	s := newTestStore(t)
	ctx := context.Background()
	c := SourceConnection{Kind: "worker", Provider: "ozon", Method: "scraper", Name: "worker", Status: "active", TokenHash: HashSourceToken("requeue")}
	if err := s.CreateSourceConnection(ctx, &c); err != nil {
		t.Fatal(err)
	}
	target := ScrapeTarget{SourceConnectionID: c.ID, URL: "https://example.org/item", Marketplace: "ozon", Enabled: true}
	if err := s.CreateScrapeTarget(ctx, &target); err != nil {
		t.Fatal(err)
	}
	job, err := s.QueueScrapeJob(ctx, target.ID)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.ClaimScrapeJob(ctx, c.ID, job.ID, time.Minute); err != nil {
		t.Fatal(err)
	}
	jobs, err := s.QueuedJobs(ctx, c.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(jobs) != 0 {
		t.Fatalf("live lease offered: %+v", jobs)
	}
	if err := s.db.Model(&ScrapeJob{}).Where("id = ?", job.ID).Update("lease_until", time.Now().Add(-time.Minute)).Error; err != nil {
		t.Fatal(err)
	}
	jobs, err = s.QueuedJobs(ctx, c.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(jobs) != 1 || jobs[0].ID != job.ID {
		t.Fatalf("expired lease not offered: %+v", jobs)
	}
}

var _ = config.DBConfig{}
