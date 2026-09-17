package store

import (
	"context"
	"testing"

	"reviews/internal/marketplace"
)

func TestUpsertReviewPersistsMediaLikesDurationAndTitle(t *testing.T) {
	s := newTestStore(t)
	ctx := context.Background()
	rating := 5
	_, err := s.UpsertReview(ctx, marketplace.Review{
		Marketplace:       "wb",
		ExternalReviewID:  "r-likes",
		ExternalProductID: "p1",
		Rating:            &rating,
		Title:             "Отличный товар",
		ProductName:       "Куртка зимняя",
		ProductPrice:      "1 799 ₽",
		Media: []marketplace.Media{
			{Kind: "photo", URL: "https://cdn.test/p.jpg", Position: 0, Likes: 12},
			{Kind: "video", URL: "https://cdn.test/v.mp4", Position: 1, Duration: 15.75},
		},
	})
	if err != nil {
		t.Fatalf("upsert: %v", err)
	}

	var review Review
	if err := s.db.Preload("Media").First(&review, "marketplace = ? AND external_review_id = ?", "wb", "r-likes").Error; err != nil {
		t.Fatalf("load: %v", err)
	}
	if review.Title != "Отличный товар" {
		t.Fatalf("title = %q", review.Title)
	}
	if review.ProductName != "Куртка зимняя" || review.ProductPrice != "1 799 ₽" {
		t.Fatalf("product = %q / %q", review.ProductName, review.ProductPrice)
	}
	if len(review.Media) != 2 {
		t.Fatalf("media len = %d", len(review.Media))
	}
	if review.Media[0].Likes != 12 {
		t.Fatalf("likes = %d", review.Media[0].Likes)
	}
	if review.Media[1].Duration != 15.75 {
		t.Fatalf("duration = %v", review.Media[1].Duration)
	}

	// Re-upsert with cleared fields: likes/duration ride the media snapshot.
	_, err = s.UpsertReview(ctx, marketplace.Review{
		Marketplace:       "wb",
		ExternalReviewID:  "r-likes",
		ExternalProductID: "p1",
		Rating:            &rating,
		Media: []marketplace.Media{
			{Kind: "video", URL: "https://cdn.test/v.mp4", Position: 0, Duration: 18.2},
		},
	})
	if err != nil {
		t.Fatalf("re-upsert: %v", err)
	}
	var media ReviewMedia
	if err := s.db.First(&media, "review_id = ? AND url = ?", review.ID, "https://cdn.test/v.mp4").Error; err != nil {
		t.Fatalf("load media: %v", err)
	}
	if media.Duration != 18.2 {
		t.Fatalf("duration after update = %v", media.Duration)
	}
}
