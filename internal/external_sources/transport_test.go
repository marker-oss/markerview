package external_sources

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestDecodeTransportBatchNormalizesImportedReviews(t *testing.T) {
	payload := `{"contract_version":1,"source":{"provider":"yandex_maps","marketplace":"yandex_maps","method":"scraper"},"cursor":"next","records":[{"marketplace_review_id":"r-1","provider_record_id":"p-1","external_product_id":"business-1","author_name":"A","rating":5,"text":"Отлично","created_at":"2026-09-29T10:00:00Z"}]}`
	var batch TransportBatch
	if err := json.Unmarshal([]byte(payload), &batch); err != nil {
		t.Fatal(err)
	}
	reviews, err := NormalizeTransportBatch(batch)
	if err != nil {
		t.Fatal(err)
	}
	if len(reviews) != 1 || reviews[0].Review.Marketplace != "" || reviews[0].Review.SourceKind != "imported" || reviews[0].Review.SourceMethod != "scraper" || reviews[0].Review.ExternalReviewID != "r-1" || reviews[0].ProviderRecordID != "p-1" {
		t.Fatalf("reviews = %+v", reviews)
	}
}

func TestDecodeTransportBatchRejectsUnsupportedVersion(t *testing.T) {
	var batch TransportBatch
	if err := json.Unmarshal([]byte(`{"contract_version":2}`), &batch); err != nil {
		t.Fatal(err)
	}
	if _, err := NormalizeTransportBatch(batch); err == nil || !strings.Contains(err.Error(), "contract version") {
		t.Fatalf("error = %v", err)
	}
}

func TestTransportProviderIDIsNotMarketplaceReviewID(t *testing.T) {
	batch := TransportBatch{ContractVersion: 1, Source: TransportSource{Provider: "third_party", Marketplace: "ozon"}, Records: []TransportReview{{ProviderRecordID: "local-123", Text: "Good"}}}
	reviews, err := NormalizeTransportBatch(batch)
	if err != nil {
		t.Fatal(err)
	}
	if len(reviews) != 1 || reviews[0].Review.ExternalReviewID != "" || reviews[0].ProviderRecordID != "local-123" {
		t.Fatalf("provider ID impersonates marketplace ID: %+v", reviews)
	}
}
