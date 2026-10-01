package server

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"reviews/internal/reviewjson"
	"reviews/internal/store"
)

func (s *Server) handleGetShowcaseRule(w http.ResponseWriter, r *http.Request) {
	rule, err := s.store.GetShowcaseRule(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, rule)
}

func (s *Server) handlePutShowcaseRule(w http.ResponseWriter, r *http.Request) {
	var rule store.ShowcaseRule
	if err := json.NewDecoder(r.Body).Decode(&rule); err != nil {
		writeError(w, http.StatusBadRequest, errors.New("invalid request body"))
		return
	}
	if err := s.store.SaveShowcaseRule(r.Context(), rule); err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// handleShowcase is the public endpoint used by the homepage widget.
func (s *Server) handleShowcase(w http.ResponseWriter, r *http.Request) {
	rule, err := s.store.GetShowcaseRule(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	reviews, err := s.store.ShowcaseReviews(r.Context(), rule)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	marketplacePolicy := s.activeMarketplacePolicy(r.Context(), "homepage")
	mapper := reviewjson.Mapper{
		ProductURLTemplate: s.cfg.ProductURLTemplate,
		ProductLinks:       s.productLinks(r.Context()),
		MarketplacePolicy:  marketplacePolicy,
	}
	items := make([]reviewjson.Review, 0, len(reviews))
	for _, rv := range reviews {
		if mapper.ReviewHidden(rv) {
			continue
		}
		items = append(items, mapper.ToReview(rv))
	}
	aggregate, err := s.publicShowcaseAggregate(r.Context(), marketplacePolicy)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, showcaseResponse{
		Reviews:   items,
		Count:     len(items),
		Aggregate: aggregate,
	})
}

type showcaseResponse struct {
	Reviews   []reviewjson.Review     `json:"reviews"`
	Count     int                     `json:"count"`
	Aggregate reviewAggregateResponse `json:"aggregate"`
}

type reviewAggregateResponse struct {
	TotalReviews     int64   `json:"totalReviews"`
	RatingCount      int64   `json:"ratingCount"`
	AverageRating    float64 `json:"averageRating"`
	RecommendPercent int     `json:"recommendPercent"`
	RatingCounts     [5]int  `json:"ratingCounts"` // index 0 = 1 star
}

// publicShowcaseAggregate summarizes every public review in the store, not the
// showcase selection, so the widget header shows the store-wide totals.
func (s *Server) publicShowcaseAggregate(ctx context.Context, policy reviewjson.MarketplacePolicies) (reviewAggregateResponse, error) {
	reviews, err := s.store.ListVisibleReviews(ctx)
	if err != nil {
		return reviewAggregateResponse{}, err
	}
	mapper := reviewjson.Mapper{MarketplacePolicy: policy}
	var aggregate reviewAggregateResponse
	var sum, recommended int
	for _, rv := range reviews {
		if mapper.ReviewHidden(rv) {
			continue
		}
		aggregate.TotalReviews++
		if rv.Rating == nil || *rv.Rating < 1 || *rv.Rating > 5 {
			continue
		}
		aggregate.RatingCount++
		aggregate.RatingCounts[*rv.Rating-1]++
		sum += *rv.Rating
		if *rv.Rating >= 4 {
			recommended++
		}
	}
	if aggregate.RatingCount > 0 {
		aggregate.AverageRating = float64(sum) / float64(aggregate.RatingCount)
		aggregate.RecommendPercent = recommended * 100 / int(aggregate.RatingCount)
	}
	return aggregate, nil
}
