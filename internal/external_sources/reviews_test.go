package external_sources

import (
	"context"
	"strings"
	"testing"
	"time"

	"reviews/internal/config"
	"reviews/internal/marketplace"
	"reviews/internal/store"
)

func importTestService(t *testing.T) (*Service, *store.Store) {
	t.Helper()
	db, err := store.Open(config.DBConfig{Driver: "sqlite", DSN: ":memory:"})
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, err := db.DB().DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(1)
	t.Cleanup(func() { _ = sqlDB.Close() })
	if err := db.Migrate(context.Background()); err != nil {
		t.Fatal(err)
	}
	return NewService(db), db
}

func importTestReview() marketplace.Review {
	return marketplace.Review{ExternalProductID: "sku-1", AuthorName: "Alice", Text: "Отличный товар", CreatedAtMP: time.Date(2026, 9, 29, 10, 0, 0, 0, time.UTC)}
}

func TestServiceAcceptsRatingOnlyReviewAndRejectsEmpty(t *testing.T) {
	service, _ := importTestService(t)
	source := SourceContext{Marketplace: "wb", Method: marketplace.SourceMethodAPI}
	five := 5
	ratingOnly := importTestReview()
	ratingOnly.ExternalReviewID, ratingOnly.Text, ratingOnly.Rating = "wb-1", "", &five
	if _, err := service.ImportOne(context.Background(), source, ratingOnly); err != nil {
		t.Fatalf("rating-only review rejected: %v", err)
	}
	empty := importTestReview()
	empty.ExternalReviewID, empty.Text = "wb-2", " "
	if _, err := service.ImportOne(context.Background(), source, empty); err == nil {
		t.Fatal("review without text and rating accepted")
	}
}

func TestServiceScopesProviderIdentityByConnectionAndTenant(t *testing.T) {
	service, db := importTestService(t)
	input := InputReview{Review: importTestReview(), ProviderRecordID: "shared-provider-id"}
	for _, source := range []SourceContext{{Marketplace: "ozon", Method: "scraper", ConnectionID: 10}, {Marketplace: "ozon", Method: "scraper", ConnectionID: 20}} {
		first := service.Import(store.WithTenant(context.Background(), 1), source, []InputReview{input})
		if first.Created != 1 || first.Failed != 0 {
			t.Fatalf("first: %+v", first)
		}
		input.Review.Text = "Updated review"
		repeat := service.Import(store.WithTenant(context.Background(), 1), source, []InputReview{input})
		if repeat.Updated != 1 || repeat.Failed != 0 {
			t.Fatalf("repeat: %+v", repeat)
		}
	}
	other := service.Import(store.WithTenant(context.Background(), 2), SourceContext{Marketplace: "ozon", Method: "scraper", ConnectionID: 10}, []InputReview{input})
	if other.Created != 1 || other.Failed != 0 {
		t.Fatalf("other tenant: %+v", other)
	}
	var rows []store.Review
	if err := db.DB().Order("id").Find(&rows).Error; err != nil {
		t.Fatal(err)
	}
	if len(rows) != 3 || rows[0].ID == rows[1].ID || rows[0].ExternalReviewID == rows[1].ExternalReviewID || rows[0].TenantID == rows[2].TenantID {
		t.Fatalf("scoped rows: %+v", rows)
	}
}

func TestServiceScopesIDLessReviewsAndRepeatsFiles(t *testing.T) {
	service, db := importTestService(t)
	for _, source := range []SourceContext{{Marketplace: "ozon", Method: "scraper", ConnectionID: 10}, {Marketplace: "ozon", Method: "scraper", ConnectionID: 20}, {Marketplace: "ozon", Method: "csv"}} {
		input := InputReview{Review: importTestReview()}
		first := service.Import(context.Background(), source, []InputReview{input})
		repeat := service.Import(context.Background(), source, []InputReview{input})
		if first.Created != 1 || repeat.Updated != 1 || first.Failed+repeat.Failed != 0 {
			t.Fatalf("first/repeat: %+v / %+v", first, repeat)
		}
	}
	var count int64
	if err := db.DB().Model(&store.Review{}).Count(&count).Error; err != nil {
		t.Fatal(err)
	}
	if count != 3 {
		t.Fatalf("scoped count = %d", count)
	}
}

func TestServiceOnlyPromotesVerifiedRealIDsAndPreservesState(t *testing.T) {
	service, db := importTestService(t)
	ctx := context.Background()
	input := InputReview{Review: importTestReview(), MarketplaceIDVerified: true}
	input.Review.ExternalReviewID = "real-id"
	input.Review.Answer = &marketplace.Answer{Text: "Published answer", State: "published"}
	input.Review.Media = []marketplace.Media{{Kind: "photo", URL: "https://example.org/photo.jpg"}}
	report := service.Import(ctx, SourceContext{Marketplace: "ozon", Method: "scraper", ConnectionID: 10}, []InputReview{input})
	if report.Created != 1 || report.Failed != 0 {
		t.Fatalf("import: %+v", report)
	}
	var saved store.Review
	if err := db.DB().First(&saved).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.DB().Model(&saved).Updates(map[string]any{"visibility": "hidden", "status": "approved", "pinned": true, "admin_reply_text": "Admin answer", "reply_publish_state": "published"}).Error; err != nil {
		t.Fatal(err)
	}
	api := importTestReview()
	api.ExternalReviewID = "real-id"
	upgraded, err := service.ImportOne(ctx, SourceContext{Marketplace: "ozon", Method: "api"}, api)
	if err != nil || upgraded.Created || upgraded.Review.ID != saved.ID {
		t.Fatalf("upgrade: %+v / %v", upgraded, err)
	}
	got, err := db.ReviewByID(ctx, saved.ID)
	if err != nil {
		t.Fatal(err)
	}
	if err := db.DB().Preload("Media").First(&got, saved.ID).Error; err != nil {
		t.Fatal(err)
	}
	if got.SourceKind != "api" || got.Visibility != "hidden" || got.Status != "approved" || !got.Pinned || got.AdminReplyText == nil || *got.AdminReplyText != "Admin answer" || got.MPAnswerText == nil || *got.MPAnswerText != "Published answer" || len(got.Media) != 1 {
		t.Fatalf("lost state: %+v", got)
	}
	input.Review.Answer, input.Review.Media = nil, nil
	if report := service.Import(ctx, SourceContext{Marketplace: "ozon", Method: "scraper", ConnectionID: 10}, []InputReview{input}); report.Updated != 1 || report.Failed != 0 {
		t.Fatalf("reimport: %+v", report)
	}
	got, err = db.ReviewByID(ctx, saved.ID)
	if err != nil {
		t.Fatal(err)
	}
	if err := db.DB().Preload("Media").First(&got, saved.ID).Error; err != nil {
		t.Fatal(err)
	}
	if got.SourceKind != "api" || got.MPAnswerText == nil || len(got.Media) != 1 {
		t.Fatalf("downgraded API state: %+v", got)
	}
}

func TestServiceRejectsSyntheticToAPIAndRealSyntheticCollision(t *testing.T) {
	service, db := importTestService(t)
	ctx := context.Background()
	source := SourceContext{Marketplace: "ozon", Method: "scraper", ConnectionID: 10}
	input := InputReview{Review: importTestReview(), ProviderRecordID: "provider-id"}
	if report := service.Import(ctx, source, []InputReview{input}); report.Created != 1 {
		t.Fatalf("seed: %+v", report)
	}
	var synthetic store.Review
	if err := db.DB().First(&synthetic).Error; err != nil {
		t.Fatal(err)
	}
	api := importTestReview()
	api.ExternalReviewID = synthetic.ExternalReviewID
	if _, err := service.ImportOne(ctx, SourceContext{Marketplace: "ozon", Method: "api"}, api); err == nil {
		t.Fatal("synthetic ID gained API capability")
	}
	if _, err := service.ImportOne(store.WithTenant(ctx, 2), SourceContext{Marketplace: "ozon", Method: "api"}, api); err != nil {
		t.Fatalf("other tenant real ID: %v", err)
	}
	if report := service.Import(store.WithTenant(ctx, 2), source, []InputReview{input}); report.Failed != 1 {
		t.Fatalf("real collision accepted: %+v", report)
	}
	got, err := db.ReviewByID(ctx, synthetic.ID)
	if err != nil || got.SourceKind != "imported" {
		t.Fatalf("synthetic changed: %+v / %v", got, err)
	}
}

func TestServiceRejectsUnverifiedIDsEvenWhenFileClaimsVerification(t *testing.T) {
	service, db := importTestService(t)
	input := InputReview{Review: importTestReview(), MarketplaceIDVerified: true}
	input.Review.ExternalReviewID = "claimed-marketplace-id"
	if report := service.Import(context.Background(), SourceContext{Marketplace: "ozon", Method: "csv"}, []InputReview{input}); report.Created != 1 {
		t.Fatalf("file: %+v", report)
	}
	var row store.Review
	if err := db.DB().First(&row).Error; err != nil {
		t.Fatal(err)
	}
	if row.ExternalReviewID == input.Review.ExternalReviewID || row.IdentityKind != marketplace.IdentityKindSynthetic {
		t.Fatalf("file trusted marketplace ID: %+v", row)
	}
}

func TestServiceReportsInvalidRowsAndTrustsSourceMapping(t *testing.T) {
	service, db := importTestService(t)
	source := SourceContext{Marketplace: "ozon", Method: "scraper", ConnectionID: 10, ExternalProductID: "target-product", SellerArticle: "target-article"}
	badRating := 6
	good := importTestReview()
	good.Marketplace, good.SourceKind, good.SourceMethod = "spoofed", "api", "api"
	good.ExternalProductID, good.SellerArticle = "wrong-product", "wrong-article"
	bad := importTestReview()
	bad.Rating = &badRating
	long := importTestReview()
	long.Title = strings.Repeat("x", 513)
	report := service.Import(context.Background(), source, []InputReview{{Review: marketplace.Review{}}, {Review: good}, {Review: bad}, {Review: long}})
	if report.Failed != 3 || report.Created != 1 || len(report.Errors) != 3 || report.Errors[0].Index != 0 || report.Errors[1].Index != 2 || report.Errors[2].Index != 3 {
		t.Fatalf("report: %+v", report)
	}
	var row store.Review
	if err := db.DB().First(&row).Error; err != nil {
		t.Fatal(err)
	}
	if row.Marketplace != "ozon" || row.SourceKind != "imported" || row.SourceMethod != "scraper" || row.ExternalProductID != "target-product" || row.SellerArticle != "target-article" {
		t.Fatalf("untrusted routing: %+v", row)
	}
	if _, err := service.ImportOne(context.Background(), SourceContext{Marketplace: "ozon", Method: "api"}, good); err == nil {
		t.Fatal("API marketplace mismatch accepted")
	}
}

func TestServicePreservesLegacyOzonFileIdentity(t *testing.T) {
	service, db := importTestService(t)
	ctx := context.Background()
	legacy := store.Review{Marketplace: "ozon", ExternalReviewID: "order:ORDER-1|sku:sku-1", ExternalProductID: "sku-1", SourceKind: "imported", SourceMethod: "csv", Text: "Legacy text", CreatedAtMP: importTestReview().CreatedAtMP, FetchedAt: time.Now().UTC(), Visibility: "hidden", Pinned: true}
	if err := db.DB().Create(&legacy).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Migrate(ctx); err != nil {
		t.Fatal(err)
	}
	input := InputReview{Review: importTestReview()}
	input.Review.ExternalReviewID = legacy.ExternalReviewID
	for _, method := range []string{"csv", "xlsx"} {
		report := service.Import(ctx, SourceContext{Marketplace: "ozon", Method: method}, []InputReview{input})
		if report.Created != 0 || report.Updated != 1 || report.Failed != 0 {
			t.Fatalf("legacy %s: %+v", method, report)
		}
	}
	got, err := db.ReviewByID(ctx, legacy.ID)
	if err != nil || got.ExternalReviewID != legacy.ExternalReviewID || got.Visibility != "hidden" || !got.Pinned {
		t.Fatalf("legacy lost: %+v / %v", got, err)
	}
	api := importTestReview()
	api.ExternalReviewID = legacy.ExternalReviewID
	if _, err := service.ImportOne(ctx, SourceContext{Marketplace: "ozon", Method: "api"}, api); err == nil {
		t.Fatal("order key promoted to API")
	}
}
