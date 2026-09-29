package external_sources

import (
	"fmt"
	"strings"
	"time"

	"reviews/internal/marketplace"
)

type TransportBatch struct {
	ContractVersion int               `json:"contract_version"`
	Source          TransportSource   `json:"source"`
	Cursor          string            `json:"cursor"`
	Records         []TransportReview `json:"records"`
}

type TransportSource struct {
	Provider    string `json:"provider"`
	Marketplace string `json:"marketplace"`
	Method      string `json:"method"`
}

type TransportReview struct {
	MarketplaceReviewID string     `json:"marketplace_review_id"`
	ProviderRecordID    string     `json:"provider_record_id"`
	ExternalProductID   string     `json:"external_product_id"`
	SellerArticle       string     `json:"seller_article"`
	AuthorName          string     `json:"author_name"`
	Rating              *int       `json:"rating"`
	Title               string     `json:"title"`
	Text                string     `json:"text"`
	Pros                string     `json:"pros"`
	Cons                string     `json:"cons"`
	CreatedAt           time.Time  `json:"created_at"`
	UpdatedAt           *time.Time `json:"updated_at"`
	URL                 string     `json:"url"`
}

func NormalizeTransportBatch(batch TransportBatch) ([]InputReview, error) {
	if batch.ContractVersion != 1 {
		return nil, fmt.Errorf("unsupported contract version %d", batch.ContractVersion)
	}
	if strings.TrimSpace(batch.Source.Marketplace) == "" || strings.TrimSpace(batch.Source.Provider) == "" {
		return nil, fmt.Errorf("source provider and marketplace are required")
	}
	method := batch.Source.Method
	if method == "" {
		method = marketplace.SourceMethodExternalService
	}
	if !allowedMethod(method) || method == marketplace.SourceMethodAPI {
		return nil, fmt.Errorf("unsupported transport source method %q", method)
	}
	if len(batch.Records) > maxBatchRows {
		return nil, fmt.Errorf("batch exceeds %d rows", maxBatchRows)
	}
	reviews := make([]InputReview, 0, len(batch.Records))
	for _, record := range batch.Records {
		reviews = append(reviews, InputReview{Review: marketplace.Review{
			ExternalReviewID:  record.MarketplaceReviewID,
			ExternalProductID: record.ExternalProductID,
			SellerArticle:     record.SellerArticle,
			SourceKind:        marketplace.SourceKindImported,
			SourceMethod:      method,
			Rating:            record.Rating,
			Title:             record.Title,
			AuthorName:        record.AuthorName,
			Text:              record.Text,
			Pros:              record.Pros,
			Cons:              record.Cons,
			CreatedAtMP:       record.CreatedAt,
			UpdatedAtMP:       record.UpdatedAt,
		}, ProviderRecordID: record.ProviderRecordID, MarketplaceIDVerified: record.MarketplaceReviewID != ""})
	}
	return reviews, nil
}
