package external_sources

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"reviews/internal/marketplace"
	"reviews/internal/store"
)

const (
	maxBatchRows = 10000
	maxFieldLen  = 64 * 1024
	maxTitleLen  = 512
)

type SourceContext struct {
	Marketplace       string
	Method            string
	ConnectionID      uint
	ExternalProductID string
	SellerArticle     string
}

type InputReview struct {
	Review                marketplace.Review
	ProviderRecordID      string
	MarketplaceIDVerified bool
}

type RowError struct {
	Index int
	Error string
}

type Report struct {
	Total   int
	Created int
	Updated int
	Skipped int
	Failed  int
	Errors  []RowError
}

type Service struct{ store *store.Store }

func NewService(s *store.Store) *Service { return &Service{store: s} }

func (s *Service) Import(ctx context.Context, source SourceContext, reviews []InputReview) Report {
	report := Report{Total: len(reviews)}
	if len(reviews) > maxBatchRows {
		report.Failed = len(reviews)
		report.Errors = []RowError{{Index: 0, Error: fmt.Sprintf("batch exceeds %d rows", maxBatchRows)}}
		return report
	}
	for i, input := range reviews {
		prepared, err := prepare(source, input)
		if err != nil {
			report.Failed++
			report.Errors = append(report.Errors, RowError{Index: i, Error: err.Error()})
			continue
		}
		result, err := s.store.UpsertReview(ctx, prepared)
		if err != nil {
			report.Failed++
			report.Errors = append(report.Errors, RowError{Index: i, Error: err.Error()})
			continue
		}
		if result.Created {
			report.Created++
		} else {
			report.Updated++
		}
	}
	return report
}

func (s *Service) ImportOne(ctx context.Context, source SourceContext, review marketplace.Review) (store.UpsertResult, error) {
	prepared, err := prepare(source, InputReview{Review: review, MarketplaceIDVerified: source.Method == marketplace.SourceMethodAPI})
	if err != nil {
		return store.UpsertResult{}, err
	}
	return s.store.UpsertReview(ctx, prepared)
}

func prepare(source SourceContext, input InputReview) (marketplace.Review, error) {
	if strings.TrimSpace(source.Marketplace) == "" {
		return marketplace.Review{}, fmt.Errorf("marketplace is required")
	}
	if !allowedMethod(source.Method) {
		return marketplace.Review{}, fmt.Errorf("unsupported source method %q", source.Method)
	}
	r := input.Review
	// Routing and provenance come from trusted source state, never the payload.
	r.Marketplace = source.Marketplace
	r.SourceKind = marketplace.SourceKindAPI
	if source.Method != marketplace.SourceMethodAPI {
		r.SourceKind = marketplace.SourceKindImported
	}
	r.SourceMethod = source.Method
	if source.ExternalProductID != "" {
		r.ExternalProductID = source.ExternalProductID
	}
	if source.SellerArticle != "" {
		r.SellerArticle = source.SellerArticle
	}
	if strings.TrimSpace(r.Text) == "" {
		return marketplace.Review{}, fmt.Errorf("text is required")
	}
	if r.CreatedAtMP.IsZero() {
		return marketplace.Review{}, fmt.Errorf("created_at is required")
	}
	if r.Rating != nil && (*r.Rating < 1 || *r.Rating > 5) {
		return marketplace.Review{}, fmt.Errorf("rating must be an integer from 1 to 5")
	}
	if len(r.Title) > maxTitleLen {
		return marketplace.Review{}, fmt.Errorf("title exceeds %d bytes", maxTitleLen)
	}
	if len(r.Text) > maxFieldLen || len(r.Pros) > maxFieldLen || len(r.Cons) > maxFieldLen || len(r.AuthorName) > maxFieldLen {
		return marketplace.Review{}, fmt.Errorf("review field exceeds %d bytes", maxFieldLen)
	}
	if source.Method == marketplace.SourceMethodAPI {
		if strings.TrimSpace(r.ExternalReviewID) == "" {
			return marketplace.Review{}, fmt.Errorf("marketplace review id is required for api source")
		}
		if !input.MarketplaceIDVerified {
			return marketplace.Review{}, fmt.Errorf("marketplace review id is not verified")
		}
		r.IdentityKind = marketplace.IdentityKindReal
		r.IdentityScope = ""
		r.SourceConnectionID = 0
	} else {
		providerID := strings.TrimSpace(input.ProviderRecordID)
		if providerID == "" {
			providerID = strings.TrimSpace(r.ExternalReviewID)
		}
		if input.MarketplaceIDVerified && providerID != "" && source.Method != marketplace.SourceMethodCSV && source.Method != marketplace.SourceMethodXLSX {
			r.IdentityKind = marketplace.IdentityKindReal
			r.ExternalReviewID = providerID
			r.IdentityScope = ""
		} else {
			scope := identityScope(source)
			if providerID != "" && (source.Method == marketplace.SourceMethodCSV || source.Method == marketplace.SourceMethodXLSX) && strings.HasPrefix(providerID, "order:") {
				r.ExternalReviewID = providerID
			} else if providerID != "" {
				r.ExternalReviewID = syntheticID("provider", scope, providerID)
			} else {
				fp := Fingerprint(r)
				r.SourceFingerprint = fp
				r.ExternalReviewID = syntheticID("fingerprint", scope, fp)
			}
			r.IdentityKind = marketplace.IdentityKindSynthetic
			r.IdentityScope = scope
			r.SourceConnectionID = source.ConnectionID
		}
	}
	return r, nil
}
func identityScope(source SourceContext) string {
	if source.ConnectionID != 0 {
		return fmt.Sprintf("connection:%d", source.ConnectionID)
	}
	return "file:" + strings.TrimSpace(source.Marketplace) + ":" + strings.TrimSpace(source.Method)
}

func syntheticID(kind, scope, value string) string {
	sum := sha256.Sum256([]byte(kind + "\x00" + scope + "\x00" + value))
	return "synthetic-" + hex.EncodeToString(sum[:])
}

func Fingerprint(review marketplace.Review) string {
	parts := []string{review.Marketplace, review.SourceMethod, review.ExternalProductID, review.SellerArticle, review.AuthorName, review.CreatedAtMP.UTC().Format(time.RFC3339Nano), review.Title, review.Text}
	var rating string
	if review.Rating != nil {
		rating = fmt.Sprint(*review.Rating)
	}
	parts = append(parts, rating)
	sum := sha256.Sum256([]byte(strings.Join(parts, "\x00")))
	return hex.EncodeToString(sum[:])
}
func allowedMethod(method string) bool {
	switch method {
	case marketplace.SourceMethodAPI, marketplace.SourceMethodScraper, marketplace.SourceMethodCSV, marketplace.SourceMethodXLSX, marketplace.SourceMethodExternalService:
		return true
	default:
		return false
	}
}
