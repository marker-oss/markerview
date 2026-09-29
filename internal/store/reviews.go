package store

import (
	"context"
	"errors"
	"time"

	"reviews/internal/marketplace"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type UpsertResult struct {
	Created        bool
	PreviewChanged bool
	Review         Review
}

func (s *Store) UpsertReview(ctx context.Context, input marketplace.Review) (UpsertResult, error) {
	var result UpsertResult

	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		productID, err := resolveProductID(tx, TenantIDFromCtx(ctx), input.Marketplace, input.ExternalProductID)
		if err != nil {
			return err
		}

		answerText, answerState := answerFields(input.Answer)
		now := time.Now().UTC()
		authorName := AnonymizeAuthorName(input.AuthorName)
		next := Review{
			TenantID:           TenantIDFromCtx(ctx),
			Marketplace:        input.Marketplace,
			ExternalReviewID:   input.ExternalReviewID,
			ExternalProductID:  input.ExternalProductID,
			SellerArticle:      input.SellerArticle,
			SourceKind:         reviewSourceKind(input.SourceKind),
			SourceMethod:       reviewSourceMethod(input.SourceMethod),
			SourceFingerprint:  input.SourceFingerprint,
			IdentityKind:       reviewIdentityKind(input),
			IdentityScope:      input.IdentityScope,
			SourceConnectionID: input.SourceConnectionID,
			ProductID:          productID,
			Rating:             input.Rating,
			Title:              input.Title,
			AuthorName:         authorName,
			Text:               input.Text,
			Pros:               input.Pros,
			Cons:               input.Cons,
			CreatedAtMP:        input.CreatedAtMP,
			UpdatedAtMP:        input.UpdatedAtMP,
			MPAnswerText:       answerText,
			MPAnswerState:      answerState,
			Status:             "imported",
			Raw:                "",
			ProductName:        input.ProductName,
			ProductPrice:       input.ProductPrice,
			FetchedAt:          now,
		}

		var existing Review
		err = tx.Where(
			"tenant_id = ? AND marketplace = ? AND external_review_id = ?",
			TenantIDFromCtx(ctx),
			input.Marketplace,
			input.ExternalReviewID,
		).First(&existing).Error
		switch {
		case errors.Is(err, gorm.ErrRecordNotFound):
			if err := tx.Create(&next).Error; err != nil {
				return err
			}
			result.Created = true
			result.Review = next
		case err != nil:
			return err
		default:
			incomingKind := reviewSourceKind(input.SourceKind)
			incomingMethod := reviewSourceMethod(input.SourceMethod)
			if existing.IdentityKind == marketplace.IdentityKindSynthetic && incomingKind == marketplace.SourceKindAPI {
				return errors.New("synthetic review identity cannot be promoted to api")
			}
			if existing.IdentityKind == marketplace.IdentityKindReal && incomingKind != marketplace.SourceKindAPI {
				incomingKind = existing.SourceKind
				incomingMethod = existing.SourceMethod
			}
			if existing.SourceConnectionID != 0 && incomingKind != marketplace.SourceKindAPI && existing.SourceConnectionID != input.SourceConnectionID {
				return errors.New("review identity belongs to another source connection")
			}
			if input.IdentityKind == marketplace.IdentityKindSynthetic && existing.IdentityKind == marketplace.IdentityKindReal {
				return errors.New("synthetic review identity collides with real marketplace identity")
			}
			updates := map[string]any{
				"external_product_id": input.ExternalProductID,
				"seller_article":      input.SellerArticle,
				"product_id":          productID,
				"source_kind":         incomingKind,
				"source_method":       incomingMethod,
				"source_fingerprint":  input.SourceFingerprint,
				"rating":              input.Rating,
				"title":               input.Title,
				"author_name":         authorName,
				"text":                input.Text,
				"pros":                input.Pros,
				"cons":                input.Cons,
				"created_at_mp":       input.CreatedAtMP,
				"updated_at_mp":       input.UpdatedAtMP,
				"raw":                 "",
				"product_name":        input.ProductName,
				"product_price":       input.ProductPrice,
				"fetched_at":          now,
			}
			if incomingKind == marketplace.SourceKindAPI {
				updates["identity_kind"] = marketplace.IdentityKindReal
				updates["identity_scope"] = ""
				updates["source_connection_id"] = uint(0)
			}
			if input.Answer != nil {
				updates["mp_answer_text"] = answerText
				updates["mp_answer_state"] = answerState
			}
			if err := tx.Model(&existing).Updates(updates).Error; err != nil {
				return err
			}
			if err := tx.First(&existing, existing.ID).Error; err != nil {
				return err
			}
			result.Review = existing
		}

		for _, media := range input.Media {
			if media.Kind != "video" || media.PreviewURL == "" || result.Created {
				continue
			}
			var previous ReviewMedia
			if err := tx.Where("review_id = ? AND url = ?", result.Review.ID, media.URL).First(&previous).Error; err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
				return err
			} else if previous.PreviewURL == nil || *previous.PreviewURL != media.PreviewURL {
				result.PreviewChanged = true
			}
		}
		if input.Media != nil {
			if err := replaceMedia(tx, result.Review.ID, input.Media); err != nil {
				return err
			}
		}
		return nil
	})

	return result, err
}
func reviewIdentityKind(input marketplace.Review) string {
	if input.IdentityKind == marketplace.IdentityKindSynthetic {
		return marketplace.IdentityKindSynthetic
	}
	return marketplace.IdentityKindReal
}

func reviewSourceKind(value string) string {
	if value == marketplace.SourceKindImported {
		return marketplace.SourceKindImported
	}
	return marketplace.SourceKindAPI
}

func reviewSourceMethod(value string) string {
	switch value {
	case marketplace.SourceMethodScraper, marketplace.SourceMethodCSV, marketplace.SourceMethodXLSX, marketplace.SourceMethodExternalService:
		return value
	default:
		return marketplace.SourceMethodAPI
	}
}

func resolveProductID(tx *gorm.DB, tenantID uint, marketplaceID, externalProductID string) (*uint, error) {
	var link ProductMarketplaceLink
	err := tx.Where(
		"tenant_id = ? AND marketplace = ? AND external_product_id = ?",
		tenantID,
		marketplaceID,
		externalProductID,
	).First(&link).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &link.ProductID, nil
}

func replaceMedia(tx *gorm.DB, reviewID uint, media []marketplace.Media) error {
	if len(media) == 0 {
		return tx.Where("review_id = ?", reviewID).Delete(&ReviewMedia{}).Error
	}

	urls := make([]string, 0, len(media))
	for _, item := range media {
		urls = append(urls, item.URL)
	}

	if err := tx.Where("review_id = ? AND url NOT IN ?", reviewID, urls).Delete(&ReviewMedia{}).Error; err != nil {
		return err
	}

	for _, item := range media {
		row := ReviewMedia{
			ReviewID:   reviewID,
			Kind:       item.Kind,
			URL:        item.URL,
			PreviewURL: emptyStringAsNil(item.PreviewURL),
			Position:   item.Position,
			Likes:      item.Likes,
			Duration:   item.Duration,
		}
		if item.Kind == "video" && item.PreviewURL == "" {
			// A transiently unavailable Yandex player must not erase its poster.
			var previous ReviewMedia
			if err := tx.Where("review_id = ? AND url = ?", reviewID, item.URL).First(&previous).Error; err == nil {
				row.PreviewURL = previous.PreviewURL
			} else if !errors.Is(err, gorm.ErrRecordNotFound) {
				return err
			}
		}
		if err := tx.Clauses(clause.OnConflict{
			Columns: []clause.Column{{Name: "review_id"}, {Name: "url"}},
			DoUpdates: clause.AssignmentColumns([]string{
				"kind",
				"preview_url",
				"position",
				"likes",
				"duration",
			}),
		}).Create(&row).Error; err != nil {
			return err
		}
	}

	return nil
}

func answerFields(answer *marketplace.Answer) (*string, *string) {
	if answer == nil {
		return nil, nil
	}
	return &answer.Text, &answer.State
}

func emptyStringAsNil(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}
