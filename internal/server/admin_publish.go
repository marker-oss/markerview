package server

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	staticexport "reviews/internal/export"
	"reviews/internal/reviewjson"
	"reviews/internal/site"
	"reviews/internal/store"
)

type publishResult struct {
	GeneratedAt time.Time
	Articles    int
	Reviews     int
}

// publishReviewsData regenerates the static reviews-data export. Shared by
// the admin «Опубликовать» handler and the auto-publish loop.
func (s *Server) publishReviewsData(ctx context.Context) (publishResult, error) {
	s.exportMu.Lock()
	defer s.exportMu.Unlock()
	return s.publishReviewsDataLocked(ctx)
}

func (s *Server) publishReviewsDataLocked(ctx context.Context) (publishResult, error) {
	outDir, err := s.tenantExportDir(ctx)
	if err != nil {
		return publishResult{}, err
	}
	links, err := s.productCatalogLinks(ctx)
	if err != nil {
		return publishResult{}, err
	}
	s.setProductLinks(ctx, site.ProductLinkMap(links))
	reviews, err := s.store.ListVisibleReviews(ctx)
	if err != nil {
		return publishResult{}, err
	}
	pins, err := s.store.AllShowcasePins(ctx)
	if err != nil {
		return publishResult{}, err
	}
	mapper := reviewjson.Mapper{
		ProductURLTemplate: s.cfg.ProductURLTemplate,
		ProductLinks:       s.productLinks(ctx),
		MarketplacePolicy:  s.activeMarketplacePolicy(ctx, "product"),
	}
	bundles := staticexport.BuildBundles(reviews, mapper, pins)
	generatedAt := time.Now().UTC()
	if err := replaceExportDir(outDir, func(tmp string) error {
		if err := staticexport.Write(tmp, bundles, generatedAt); err != nil {
			return err
		}
		if len(links) > 0 {
			return staticexport.WriteLinks(tmp, staticexport.BuildLinkIndex(links, generatedAt))
		}
		return nil
	}); err != nil {
		return publishResult{}, err
	}
	return publishResult{GeneratedAt: generatedAt, Articles: len(bundles), Reviews: len(reviews)}, nil
}

func (s *Server) handlePublishReviewsData(w http.ResponseWriter, r *http.Request) {
	result, err := s.publishReviewsData(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	// A manual publish covers everything up to now.
	if err := s.store.MarkExportPublished(r.Context(), result.GeneratedAt); err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":      "ok",
		"generatedAt": result.GeneratedAt,
		"articles":    result.Articles,
		"reviews":     result.Reviews,
	})
}

func (s *Server) productCatalogLinks(ctx context.Context) ([]site.ProductLink, error) {
	path, err := s.productLinksPath(ctx)
	if err != nil || path == "" {
		return nil, err
	}
	file, err := os.Open(path)
	if os.IsNotExist(err) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	defer file.Close()
	return site.LoadProductLinks(file)
}

func (s *Server) productLinksPath(ctx context.Context) (string, error) {
	if s.cfg.ProductLinksPath == "" {
		return "", nil
	}
	if !store.StrictTenantMode() {
		return s.cfg.ProductLinksPath, nil
	}
	scope, err := s.tenantScopeSegment(ctx)
	if err != nil {
		return "", err
	}
	return filepath.Join(filepath.Dir(s.cfg.ProductLinksPath), scope, filepath.Base(s.cfg.ProductLinksPath)), nil
}

func (s *Server) tenantExportDir(ctx context.Context) (string, error) {
	base := filepath.Join(s.cfg.StaticDir, "reviews-data")
	if !store.StrictTenantMode() {
		return base, nil
	}
	scope, err := s.tenantScopeSegment(ctx)
	if err != nil {
		return "", err
	}
	return filepath.Join(base, scope), nil
}

func (s *Server) tenantScopeSegment(ctx context.Context) (string, error) {
	var scope string
	var err error
	if s.tenantExportScope != nil {
		scope, err = s.tenantExportScope(ctx)
	} else {
		var tenant store.Tenant
		tenant, err = s.store.TenantByID(ctx)
		scope = tenant.PublicKey
	}
	if err != nil {
		return "", err
	}
	if scope = strings.TrimSpace(scope); scope == "" || scope == "." || scope == ".." || filepath.Base(scope) != scope || strings.ContainsAny(scope, `/\\`) {
		return "", fmt.Errorf("invalid tenant export scope %q", scope)
	}
	return scope, nil
}

func writeProductLinksAtomic(path string, links []site.ProductLink) error {
	if path == "" {
		return nil
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(filepath.Dir(path), ".product-links-*")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	defer os.Remove(tmpName)
	if err = site.EncodeProductLinks(tmp, links); err == nil {
		err = tmp.Close()
	} else {
		_ = tmp.Close()
	}
	if err != nil {
		return err
	}
	if err := os.Chmod(tmpName, 0o644); err != nil {
		return err
	}
	return os.Rename(tmpName, path)
}

func replaceExportDir(dir string, write func(string) error) error {
	parent := filepath.Dir(dir)
	if err := os.MkdirAll(parent, 0o755); err != nil {
		return err
	}
	tmp, err := os.MkdirTemp(parent, ".reviews-data-*")
	if err != nil {
		return err
	}
	defer os.RemoveAll(tmp)
	if err := write(tmp); err != nil {
		return err
	}
	if err := os.Chmod(tmp, 0o755); err != nil {
		return err
	}
	backup := dir + ".old"
	_ = os.RemoveAll(backup)
	if err := os.Rename(dir, backup); err != nil && !os.IsNotExist(err) {
		return err
	}
	if err := os.Rename(tmp, dir); err != nil {
		_ = os.Rename(backup, dir)
		return err
	}
	return os.RemoveAll(backup)
}
