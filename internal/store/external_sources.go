package store

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"gorm.io/gorm"
	"time"
)

var (
	ErrAutomaticImportLimit     = errors.New("automatic import limit exhausted")
	ErrAutomaticImportActiveJob = errors.New("target already has an active job")
)

type SourceConnection struct {
	ID         uint   `gorm:"primaryKey"`
	TenantID   uint   `gorm:"not null;index"`
	Kind       string `gorm:"size:24;not null"`
	Provider   string `gorm:"size:64;not null"`
	Method     string `gorm:"size:32;not null"`
	Name       string `gorm:"size:128;not null"`
	TokenHash  string `gorm:"size:64;uniqueIndex"`
	Status     string `gorm:"size:16;not null;default:active;index"`
	LastSeenAt *time.Time
	CreatedAt  time.Time
	UpdatedAt  time.Time
}
type ScrapeTarget struct {
	ID                 uint   `gorm:"primaryKey"`
	TenantID           uint   `gorm:"not null;index;uniqueIndex:idx_scrape_target_ozon_product,where:canonical = true"`
	SourceConnectionID uint   `gorm:"not null;index;uniqueIndex:idx_scrape_target_ozon_product,where:canonical = true"`
	URL                string `gorm:"size:2048;not null"`
	Marketplace        string `gorm:"size:32;not null;uniqueIndex:idx_scrape_target_ozon_product,where:canonical = true"`
	ExternalProductID  string `gorm:"size:128;uniqueIndex:idx_scrape_target_ozon_product,where:canonical = true"`
	Canonical          bool   `json:"-" gorm:"not null;default:false"`
	SellerArticle      string `gorm:"size:128"`
	Label              string `gorm:"size:128"`
	Enabled            bool   `gorm:"not null;default:true;index"`
	ScrapeConfig       string `gorm:"type:text"`
	LastCursor         string `gorm:"size:512"`
	LastStatus         string `gorm:"size:16"`
	LastError          string `gorm:"size:512"`
	CreatedAt          time.Time
	UpdatedAt          time.Time
}
type ScrapeJob struct {
	ID                 uint       `gorm:"primaryKey"`
	TenantID           uint       `gorm:"not null;index"`
	SourceConnectionID uint       `gorm:"not null;index"`
	TargetID           uint       `gorm:"not null;index"`
	Status             string     `gorm:"size:16;not null;default:queued;index"`
	LeaseUntil         *time.Time `gorm:"index"`
	Attempts           int        `gorm:"not null;default:0"`
	CursorBefore       string     `gorm:"size:512"`
	CursorAfter        string     `gorm:"size:512"`
	StartedAt          *time.Time
	FinishedAt         *time.Time
	Error              string `gorm:"size:512"`
	CreatedAt          time.Time
	UpdatedAt          time.Time
}
type ImportRun struct {
	ID                 uint   `gorm:"primaryKey"`
	TenantID           uint   `gorm:"not null;index"`
	SourceConnectionID uint   `gorm:"not null;index"`
	JobID              uint   `gorm:"not null;uniqueIndex"`
	Received           int    `gorm:"not null;default:0"`
	Created            int    `gorm:"not null;default:0"`
	Updated            int    `gorm:"not null;default:0"`
	Skipped            int    `gorm:"not null;default:0"`
	Failed             int    `gorm:"not null;default:0"`
	Status             string `gorm:"size:16;not null"`
	Error              string `gorm:"size:512"`
	CreatedAt          time.Time
}

func HashSourceToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
func (s *Store) FindSourceConnectionByToken(ctx context.Context, token string) (SourceConnection, error) {
	var c SourceConnection
	err := s.db.WithContext(ctx).Where("token_hash = ? AND status = ?", HashSourceToken(token), "active").First(&c).Error
	return c, err
}
func (s *Store) CreateSourceConnection(ctx context.Context, c *SourceConnection) error {
	c.TenantID = TenantIDFromCtx(ctx)
	return s.db.WithContext(ctx).Create(c).Error
}
func (s *Store) createScrapeTargetDB(db *gorm.DB, ctx context.Context, t *ScrapeTarget) error {
	tenant := TenantIDFromCtx(ctx)
	var c SourceConnection
	if err := db.WithContext(ctx).Where("id = ? AND tenant_id = ?", t.SourceConnectionID, tenant).First(&c).Error; err != nil {
		return err
	}
	t.TenantID = tenant
	if t.Marketplace != "ozon" || t.ExternalProductID == "" {
		return db.WithContext(ctx).Create(t).Error
	}
	findExisting := func() ([]ScrapeTarget, error) {
		var existing []ScrapeTarget
		err := db.WithContext(ctx).Where("tenant_id = ? AND source_connection_id = ? AND marketplace = ? AND external_product_id = ?", tenant, t.SourceConnectionID, t.Marketplace, t.ExternalProductID).Order("id").Limit(2).Find(&existing).Error
		return existing, err
	}
	if existing, err := findExisting(); err != nil {
		return err
	} else if len(existing) > 1 {
		return errors.New("ambiguous legacy scrape targets require manual resolution")
	} else if len(existing) == 1 {
		*t = existing[0]
		return nil
	}
	t.Canonical = true
	if err := db.WithContext(ctx).Create(t).Error; err == nil {
		return nil
	} else if existing, lookupErr := findExisting(); lookupErr == nil && len(existing) == 1 {
		*t = existing[0]
		return nil
	} else {
		return err
	}
}

func (s *Store) CreateScrapeTarget(ctx context.Context, t *ScrapeTarget) error {
	return s.createScrapeTargetDB(s.db, ctx, t)
}

// CreateAutomaticImportTarget locks the tenant row before checking quota and
// creating a target, so concurrent server instances cannot both consume the
// final slot. The caller has already canonicalized and selected a tenant-owned
// scraper connection; this method verifies both again in the transaction.
func (s *Store) CreateAutomaticImportTarget(ctx context.Context, t *ScrapeTarget, limit int) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		tenant := TenantIDFromCtx(ctx)
		if err := tx.Model(&Tenant{}).Where("id = ?", tenant).UpdateColumn("automatic_import_limit", gorm.Expr("automatic_import_limit")).Error; err != nil {
			return err
		}
		var count int64
		if err := tx.Model(&ScrapeTarget{}).Joins("JOIN source_connections ON source_connections.id = scrape_targets.source_connection_id AND source_connections.tenant_id = scrape_targets.tenant_id").Where("scrape_targets.tenant_id = ? AND scrape_targets.enabled = ? AND source_connections.method = ?", tenant, true, "scraper").Count(&count).Error; err != nil {
			return err
		}
		var existing []ScrapeTarget
		if err := tx.Model(&ScrapeTarget{}).Joins("JOIN source_connections ON source_connections.id = scrape_targets.source_connection_id AND source_connections.tenant_id = scrape_targets.tenant_id").Where("scrape_targets.tenant_id = ? AND scrape_targets.marketplace = ? AND scrape_targets.external_product_id = ? AND source_connections.method = ?", tenant, t.Marketplace, t.ExternalProductID, "scraper").Order("scrape_targets.id").Limit(2).Find(&existing).Error; err != nil {
			return err
		}
		if len(existing) > 1 {
			return errors.New("ambiguous legacy scrape targets require manual resolution")
		}
		if len(existing) == 1 {
			*t = existing[0]
			return nil
		}
		if limit <= 0 || count >= int64(limit) {
			return ErrAutomaticImportLimit
		}
		return s.createScrapeTargetDB(tx, ctx, t)
	})
}

// QueueAutomaticImportJob serializes the active-job check and insert on the
// tenant row. UPDATE obtains a row write lock on PostgreSQL and serializes
// writers on SQLite, avoiding process-local coordination.
func (s *Store) QueueAutomaticImportJob(ctx context.Context, targetID uint) (ScrapeJob, error) {
	var job ScrapeJob
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		tenant := TenantIDFromCtx(ctx)
		if err := tx.Model(&Tenant{}).Where("id = ?", tenant).UpdateColumn("automatic_import_limit", gorm.Expr("automatic_import_limit")).Error; err != nil {
			return err
		}
		var target ScrapeTarget
		if err := tx.Where("id = ? AND tenant_id = ? AND enabled = ?", targetID, tenant, true).First(&target).Error; err != nil {
			return err
		}
		var active int64
		if err := tx.Model(&ScrapeJob{}).Where("tenant_id = ? AND target_id = ? AND status IN ?", tenant, target.ID, []string{"queued", "leased"}).Count(&active).Error; err != nil {
			return err
		}
		if active != 0 {
			return ErrAutomaticImportActiveJob
		}
		job = ScrapeJob{TenantID: tenant, SourceConnectionID: target.SourceConnectionID, TargetID: target.ID, CursorBefore: target.LastCursor}
		return tx.Create(&job).Error
	})
	return job, err
}

func (s *Store) QueueScrapeJob(ctx context.Context, targetID uint) (ScrapeJob, error) {
	tenant := TenantIDFromCtx(ctx)
	var t ScrapeTarget
	if err := s.db.WithContext(ctx).Where("id = ? AND tenant_id = ? AND enabled = ?", targetID, tenant, true).First(&t).Error; err != nil {
		return ScrapeJob{}, err
	}
	j := ScrapeJob{TenantID: tenant, SourceConnectionID: t.SourceConnectionID, TargetID: t.ID, CursorBefore: t.LastCursor}
	return j, s.db.WithContext(ctx).Create(&j).Error
}
func (s *Store) QueuedJobs(ctx context.Context, connectionID uint) ([]ScrapeJob, error) {
	var jobs []ScrapeJob
	expired := "lease_until < ?"
	if s.db.Dialector.Name() == "sqlite" {
		expired = "julianday(lease_until) < julianday(?)"
	}
	err := s.db.WithContext(ctx).Where("source_connection_id = ? AND tenant_id = ? AND (status = 'queued' OR (status = 'leased' AND "+expired+"))", connectionID, TenantIDFromCtx(ctx), time.Now().UTC()).Order("id").Limit(20).Find(&jobs).Error
	return jobs, err
}
func (s *Store) TargetForJob(ctx context.Context, connectionID, jobID uint) (ScrapeTarget, error) {
	var j ScrapeJob
	if err := s.db.WithContext(ctx).Where("id = ? AND source_connection_id = ?", jobID, connectionID).First(&j).Error; err != nil {
		return ScrapeTarget{}, err
	}
	var t ScrapeTarget
	err := s.db.WithContext(ctx).Where("id = ? AND source_connection_id = ?", j.TargetID, connectionID).First(&t).Error
	return t, err
}
func (s *Store) ClaimScrapeJob(ctx context.Context, connectionID, jobID uint, lease time.Duration) (ScrapeJob, error) {
	if lease <= 0 {
		return ScrapeJob{}, errors.New("lease must be positive")
	}
	now := time.Now().UTC()
	until := now.Add(lease)
	expired := "lease_until < ?"
	if s.db.Dialector.Name() == "sqlite" {
		expired = "julianday(lease_until) < julianday(?)"
	}
	condition := "id = ? AND source_connection_id = ? AND tenant_id = ? AND (status = 'queued' OR (status = 'leased' AND " + expired + "))"
	res := s.db.WithContext(ctx).Model(&ScrapeJob{}).Where(condition, jobID, connectionID, TenantIDFromCtx(ctx), now).Updates(map[string]any{"status": "leased", "lease_until": until, "attempts": gorm.Expr("attempts + 1"), "started_at": now})
	if res.Error != nil {
		return ScrapeJob{}, res.Error
	}
	if res.RowsAffected != 1 {
		return ScrapeJob{}, gorm.ErrRecordNotFound
	}
	var j ScrapeJob
	err := s.db.WithContext(ctx).Where("id = ? AND source_connection_id = ?", jobID, connectionID).First(&j).Error
	return j, err
}
func (s *Store) HeartbeatScrapeJob(ctx context.Context, connectionID, jobID uint, attempt int, lease time.Duration) (ScrapeJob, error) {
	if lease <= 0 || attempt < 1 {
		return ScrapeJob{}, errors.New("lease and attempt must be positive")
	}
	now := time.Now().UTC()
	condition := "lease_until > ?"
	if s.db.Dialector.Name() == "sqlite" {
		condition = "julianday(lease_until) > julianday(?)"
	}
	res := s.db.WithContext(ctx).Model(&ScrapeJob{}).Where("id = ? AND source_connection_id = ? AND tenant_id = ? AND attempts = ? AND status = 'leased' AND "+condition, jobID, connectionID, TenantIDFromCtx(ctx), attempt, now).Update("lease_until", now.Add(lease))
	if res.Error != nil {
		return ScrapeJob{}, res.Error
	}
	if res.RowsAffected != 1 {
		return ScrapeJob{}, gorm.ErrRecordNotFound
	}
	var job ScrapeJob
	err := s.db.WithContext(ctx).Where("id = ? AND source_connection_id = ? AND tenant_id = ?", jobID, connectionID, TenantIDFromCtx(ctx)).First(&job).Error
	return job, err
}

func (s *Store) FinishScrapeJob(ctx context.Context, connectionID, jobID uint, status, cursor string, run ImportRun) error {
	if status != "succeeded" && status != "failed" {
		return errors.New("invalid scrape job status")
	}
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		now := time.Now().UTC()
		var j ScrapeJob
		leaseCondition := "lease_until > ?"
		if tx.Dialector.Name() == "sqlite" {
			leaseCondition = "julianday(lease_until) > julianday(?)"
		}
		if err := tx.Where("id = ? AND source_connection_id = ? AND tenant_id = ? AND status = ? AND "+leaseCondition, jobID, connectionID, TenantIDFromCtx(ctx), "leased", now).First(&j).Error; err != nil {
			return err
		}
		if err := tx.Model(&j).Updates(map[string]any{"status": status, "cursor_after": cursor, "finished_at": now, "lease_until": nil}).Error; err != nil {
			return err
		}
		run.TenantID, run.SourceConnectionID, run.JobID, run.CreatedAt = j.TenantID, connectionID, jobID, now
		if err := tx.Create(&run).Error; err != nil {
			return err
		}
		if status == "succeeded" {
			return tx.Model(&ScrapeTarget{}).Where("id = ? AND tenant_id = ?", j.TargetID, j.TenantID).Updates(map[string]any{"last_cursor": cursor, "last_status": status, "last_error": ""}).Error
		}
		return tx.Model(&ScrapeTarget{}).Where("id = ? AND tenant_id = ?", j.TargetID, j.TenantID).Updates(map[string]any{"last_status": status, "last_error": run.Error}).Error
	})
}

func (s *Store) FinishScrapeJobAttempt(ctx context.Context, connectionID, jobID uint, attempt int, status, cursor string, run ImportRun) error {
	if attempt < 1 {
		return gorm.ErrRecordNotFound
	}
	return s.WithScrapeJobLease(ctx, connectionID, jobID, attempt, func(tx *Store) error {
		return tx.FinishScrapeJob(ctx, connectionID, jobID, status, cursor, run)
	})
}
func (s *Store) ImportRunByJob(ctx context.Context, connectionID, jobID uint) (ImportRun, error) {
	var run ImportRun
	err := s.db.WithContext(ctx).Where("source_connection_id = ? AND job_id = ?", connectionID, jobID).First(&run).Error
	return run, err
}

// WithScrapeJobLease serializes result imports against completion and lease expiry.
// A rejected or expired lease rolls back every review written by fn.
func (s *Store) WithScrapeJobLease(ctx context.Context, connectionID, jobID uint, attempt int, fn func(*Store) error) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		now := time.Now().UTC()
		leaseCondition := "lease_until > ?"
		if tx.Dialector.Name() == "sqlite" {
			leaseCondition = "julianday(lease_until) > julianday(?)"
		}
		res := tx.Model(&ScrapeJob{}).Where("id = ? AND source_connection_id = ? AND tenant_id = ? AND attempts = ? AND status = ? AND "+leaseCondition, jobID, connectionID, TenantIDFromCtx(ctx), attempt, "leased", now).Update("updated_at", now)
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected != 1 {
			return gorm.ErrRecordNotFound
		}
		copy := *s
		copy.db = tx
		return fn(&copy)
	})
}
