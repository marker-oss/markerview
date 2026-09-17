package server

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"reviews/internal/marketplace"
)

// Smoke: contract check for the widget — GET /api/reviews shape with the new
// fields, and /api/showcase aggregate.recommendPercent.
func TestPublicReviewsContractFieldsSmoke(t *testing.T) {
	s := newAuthTestServer(t)
	ctx := context.Background()
	rating := 5
	if _, err := s.store.UpsertReview(ctx, marketplace.Review{
		Marketplace:       "wb",
		ExternalReviewID:  "contract-1",
		ExternalProductID: "7001",
		SellerArticle:     "A-1",
		Rating:            &rating,
		Title:             "Тестовый заголовок",
		ProductName:       "Тестовый товар",
		ProductPrice:      "999 ₽",
		CreatedAtMP:       time.Now(),
		Media: []marketplace.Media{
			{Kind: "video", URL: "https://cdn.test/v.mp4", Position: 0, Likes: 3, Duration: 9.5},
		},
	}); err != nil {
		t.Fatalf("upsert: %v", err)
	}
	if err := s.store.SetReviewVisibility(ctx, 1, "visible"); err != nil {
		t.Fatalf("visibility: %v", err)
	}

	rec := httptest.NewRecorder()
	s.handler().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/reviews?article_exact=A-1", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("reviews status = %d, body=%s", rec.Code, rec.Body.String())
	}
	var payload struct {
		Reviews []struct {
			Title   string `json:"title"`
			Product *struct {
				Name  string `json:"name"`
				Price string `json:"price"`
			} `json:"product"`
			Media []struct {
				Kind     string  `json:"kind"`
				Likes    int     `json:"likes"`
				Duration float64 `json:"duration"`
			} `json:"media"`
		} `json:"reviews"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(payload.Reviews) != 1 {
		t.Fatalf("reviews = %+v", payload.Reviews)
	}
	rv := payload.Reviews[0]
	if rv.Title != "Тестовый заголовок" {
		t.Fatalf("title = %q", rv.Title)
	}
	if rv.Product == nil || rv.Product.Name != "Тестовый товар" || rv.Product.Price != "999 ₽" {
		t.Fatalf("product = %+v", rv.Product)
	}
	if len(rv.Media) != 1 || rv.Media[0].Likes != 3 || rv.Media[0].Duration != 9.5 {
		t.Fatalf("media = %+v", rv.Media)
	}
}

func TestPublicShowcaseRecommendPercentSmoke(t *testing.T) {
	s := newAuthTestServer(t)
	ctx := context.Background()
	rating := 4
	if _, err := s.store.UpsertReview(ctx, marketplace.Review{
		Marketplace: "wb", ExternalReviewID: "show-1", ExternalProductID: "p",
		Rating: &rating, CreatedAtMP: time.Now(),
	}); err != nil {
		t.Fatalf("upsert: %v", err)
	}
	if err := s.store.SetReviewVisibility(ctx, 1, "visible"); err != nil {
		t.Fatalf("visibility: %v", err)
	}

	rec := httptest.NewRecorder()
	s.handler().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/showcase", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("showcase status = %d, body=%s", rec.Code, rec.Body.String())
	}
	var payload struct {
		Aggregate struct {
			RecommendPercent int `json:"recommendPercent"`
		} `json:"aggregate"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if payload.Aggregate.RecommendPercent != 100 {
		t.Fatalf("recommendPercent = %d, want 100", payload.Aggregate.RecommendPercent)
	}
}
