package server

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"
)

func postSubmission(t *testing.T, s *Server, fields map[string]string) *httptest.ResponseRecorder {
	t.Helper()
	body, contentType := submissionBody(t, fields, false)
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/review-submissions", body)
	req.Header.Set("Content-Type", contentType)
	req.RemoteAddr = "203.0.113.77:1234"
	s.handler().ServeHTTP(rec, req)
	return rec
}

func baseSubmissionFields() map[string]string {
	return map[string]string{
		"sellerArticle":  "673320",
		"rating":         "5",
		"authorName":     "Иван",
		"authorEmail":    "ivan-title@example.com",
		"text":           "Отличный товар",
		"privacyConsent": "true",
		"openedAt":       strconv.FormatInt(time.Now().Add(-5*time.Second).UnixMilli(), 10),
	}
}

func TestReviewSubmissionAcceptsTitle(t *testing.T) {
	s := newAuthTestServer(t)

	rec := postSubmission(t, s, func() map[string]string {
		fields := baseSubmissionFields()
		fields["authorEmail"] = "with-title@example.com"
		// \n and repeated spaces are collapsed to one space each.
		fields["title"] = "  Хорошая\nпокупка\t  супер "
		return fields
	}())
	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, body=%s", rec.Code, rec.Body.String())
	}

	var submitted struct {
		ReviewID uint `json:"reviewId"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&submitted); err != nil {
		t.Fatalf("decode: %v", err)
	}
	review, err := s.store.ReviewByID(context.Background(), submitted.ReviewID)
	if err != nil {
		t.Fatalf("load review: %v", err)
	}
	if review.Title != "Хорошая покупка супер" {
		t.Fatalf("title = %q", review.Title)
	}
}

func TestReviewSubmissionWithoutTitleLeavesItEmpty(t *testing.T) {
	s := newAuthTestServer(t)
	fields := baseSubmissionFields()
	fields["authorEmail"] = "no-title@example.com"

	rec := postSubmission(t, s, fields)
	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, body=%s", rec.Code, rec.Body.String())
	}
	var submitted struct {
		ReviewID uint `json:"reviewId"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&submitted); err != nil {
		t.Fatalf("decode: %v", err)
	}
	review, err := s.store.ReviewByID(context.Background(), submitted.ReviewID)
	if err != nil {
		t.Fatalf("load review: %v", err)
	}
	if review.Title != "" {
		t.Fatalf("title = %q, want empty", review.Title)
	}
}

func TestReviewSubmissionRejectsTooLongTitle(t *testing.T) {
	s := newAuthTestServer(t)
	fields := baseSubmissionFields()
	fields["authorEmail"] = "long-title@example.com"
	fields["title"] = strings.Repeat("а", maxSubmissionTitle+1)

	rec := postSubmission(t, s, fields)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400, body=%s", rec.Code, rec.Body.String())
	}
}

func TestCleanSubmissionTitleStripsControlCharacters(t *testing.T) {
	got := cleanSubmissionTitle("a\x00b\x1fc\n\rd e  f\t g ")
	want := "a b c d e f g"
	if got != want {
		t.Fatalf("cleanSubmissionTitle = %q, want %q", got, want)
	}
	if cleanSubmissionTitle("   \n\t ") != "" {
		t.Fatalf("whitespace-only title should collapse to empty")
	}
}
