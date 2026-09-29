package server

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"path/filepath"
	imports "reviews/internal/external_sources"
	"reviews/internal/marketplace"
	"reviews/internal/store"
	"strings"
	"time"
)

type importPreview struct {
	TenantID uint
	Source   imports.SourceContext
	Records  []imports.InputReview
	Expires  time.Time
}

var allowedImportMarketplaces = map[string]bool{"wb": true, "ym": true, "ozon": true}

func importMarketplace(value string) bool {
	return allowedImportMarketplaces[strings.ToLower(strings.TrimSpace(value))]
}

func importMethod(format, ext string) (string, bool) {
	switch strings.ToLower(strings.TrimSpace(format)) {
	case "canonical", "ozon":
		if ext == ".csv" {
			return marketplace.SourceMethodCSV, true
		}
		if ext == ".xlsx" {
			return marketplace.SourceMethodXLSX, true
		}
	}
	return "", false
}

func (s *Server) handleOzonImportPreview(w http.ResponseWriter, r *http.Request) {
	const maxUpload = 20 << 20
	r.Body = http.MaxBytesReader(w, r.Body, maxUpload)
	if err := r.ParseMultipartForm(maxUpload); err != nil {
		writeError(w, http.StatusBadRequest, errors.New("invalid upload"))
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, errors.New("file is required"))
		return
	}
	defer file.Close()
	marketplaceName := strings.ToLower(strings.TrimSpace(r.FormValue("marketplace")))
	format := strings.ToLower(strings.TrimSpace(r.FormValue("format")))
	if marketplaceName == "" && format == "" {
		marketplaceName, format = "ozon", "ozon"
	}
	if !importMarketplace(marketplaceName) {
		writeError(w, http.StatusBadRequest, errors.New("unsupported marketplace"))
		return
	}
	ext := strings.ToLower(filepath.Ext(header.Filename))
	method, ok := importMethod(format, ext)
	if !ok || (format == "ozon" && marketplaceName != "ozon") {
		writeError(w, http.StatusBadRequest, errors.New("unsupported import format"))
		return
	}
	var records []imports.InputReview
	var rowErrors []imports.RowIssue
	if format == "canonical" {
		var parsed imports.CanonicalPreview
		if ext == ".csv" {
			parsed, err = imports.ParseCanonicalCSV(file)
		} else {
			parsed, err = imports.ParseCanonicalXLSX(file)
		}
		records, rowErrors = parsed.Reviews, parsed.Errors
	} else {
		var parsed imports.Preview
		if ext == ".csv" {
			parsed, err = imports.ParseOzonCSV(file)
		} else {
			parsed, err = imports.ParseOzonXLSX(file)
		}
		records = make([]imports.InputReview, 0, len(parsed.Reviews))
		for _, review := range parsed.Reviews {
			records = append(records, imports.InputReview{Review: review, ProviderRecordID: review.ExternalReviewID})
		}
		rowErrors = parsed.Errors
	}
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	tokenBytes := make([]byte, 16)
	if _, err := rand.Read(tokenBytes); err != nil {
		writeError(w, http.StatusInternalServerError, errors.New("cannot create import token"))
		return
	}
	token := hex.EncodeToString(tokenBytes)
	s.importMu.Lock()
	s.importPreviews[token] = importPreview{TenantID: store.TenantIDFromCtx(r.Context()), Source: imports.SourceContext{Marketplace: marketplaceName, Method: method}, Records: records, Expires: time.Now().Add(10 * time.Minute)}
	s.importMu.Unlock()
	writeJSON(w, http.StatusOK, map[string]any{"token": token, "total": len(records), "errors": len(rowErrors), "row_errors": rowErrors})
}

func (s *Server) handleOzonImportCommit(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Token string `json:"token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Token == "" {
		writeError(w, http.StatusBadRequest, errors.New("valid import token is required"))
		return
	}
	s.importMu.Lock()
	preview, ok := s.importPreviews[req.Token]
	if ok && (preview.Expires.Before(time.Now()) || preview.TenantID != store.TenantIDFromCtx(r.Context())) {
		ok = false
	}
	if ok {
		delete(s.importPreviews, req.Token)
	}
	s.importMu.Unlock()
	if !ok {
		writeError(w, http.StatusBadRequest, errors.New("import preview expired or invalid"))
		return
	}
	report := imports.NewService(s.store).Import(r.Context(), preview.Source, preview.Records)
	writeJSON(w, http.StatusOK, report)
}
