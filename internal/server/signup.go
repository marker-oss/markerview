package server

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strings"
	"time"

	"reviews/internal/auth"
	"reviews/internal/store"
)

// signupRequest registers a new tenant (SaaS self-serve). Login+password
// become the tenant's first admin; shopOrigin is the seller's shop the
// widget will be embedded on (per-tenant CORS allowlist).
type signupRequest struct {
	Login      string `json:"login"`
	Password   string `json:"password"`
	ShopOrigin string `json:"shopOrigin"`
}

// handleSignup creates a tenant with a seven-day hosted trial and its first admin,
// then logs the new admin in. Single-tenant installs keep setup as onboarding.
func (s *Server) handleSignup(w http.ResponseWriter, r *http.Request) {
	if !store.StrictTenantMode() {
		writeError(w, http.StatusNotFound, errors.New("signup is not enabled"))
		return
	}

	var req signupRequest
	r.Body = http.MaxBytesReader(w, r.Body, 16<<10)
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, errors.New("invalid request body"))
		return
	}
	req.Login = strings.TrimSpace(req.Login)
	if s.cfg.NormalizeLogin != nil {
		canonical, err := s.cfg.NormalizeLogin(req.Login)
		if err != nil {
			writeError(w, http.StatusBadRequest, err)
			return
		}
		req.Login = canonical
	}
	if req.Login == "" {
		writeError(w, http.StatusBadRequest, errors.New("login is required"))
		return
	}
	if len(req.Login) > 64 {
		writeError(w, http.StatusBadRequest, errors.New("login must be at most 64 characters"))
		return
	}
	if len(req.Password) < 8 || len(req.Password) > 128 {
		writeError(w, http.StatusBadRequest, errors.New("password must be 8 to 128 characters"))
		return
	}
	shopOrigin, err := normalizeShopOrigin(req.ShopOrigin)
	if err != nil {
		writeError(w, http.StatusBadRequest, errors.New("адрес магазина должен быть HTTP(S)-адресом, например https://myshop.ru"))
		return
	}
	req.ShopOrigin = shopOrigin

	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}

	// Login is globally unique (admin_users.login uniqueIndex); a collision
	// is a plain 409 without leaking whether the login exists.
	if _, err := s.store.GetAdminUserByLogin(context.WithoutCancel(r.Context()), req.Login); err == nil {
		writeError(w, http.StatusConflict, errors.New("этот логин уже занят"))
		return
	}

	trialDuration := 14 * 24 * time.Hour
	if store.StrictTenantMode() {
		trialDuration = 7 * 24 * time.Hour
	}
	tenant, err := s.store.CreateTenantWithAdminFor(r.Context(), req.Login, hash, req.ShopOrigin, trialDuration, s.cfg.AdmitSignup)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE") || strings.Contains(err.Error(), "duplicate key") {
			writeError(w, http.StatusConflict, errors.New("этот логин уже занят"))
			return
		}
		writeError(w, http.StatusInternalServerError, err)
		return
	}

	if s.cfg.OnSignup != nil {
		if err := s.cfg.OnSignup(r.Context(), s.store, tenant.AdminID, req.Login); err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
	}

	if s.cfg.OnSignup != nil && store.StrictTenantMode() {
		writeJSON(w, http.StatusCreated, map[string]any{
			"status":    "verification_required",
			"publicKey": tenant.Tenant.PublicKey,
			"trialEnds": tenant.Tenant.TrialEndsAt,
		})
		return
	}

	// Log the admin in right away: the SPA lands on its own tenant.
	token, err := auth.NewSessionToken()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	expires := time.Now().Add(s.cfg.SessionTTL)
	if err := s.store.CreateSession(store.WithTenant(r.Context(), tenant.Tenant.ID), token, tenant.AdminID, tenant.Tenant.ID, expires); err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	setSessionCookie(w, token, expires, s.cfg.SecureCookies)
	writeJSON(w, http.StatusCreated, map[string]any{
		"status":    "ok",
		"publicKey": tenant.Tenant.PublicKey,
		"trialEnds": tenant.Tenant.TrialEndsAt,
	})
}

func normalizeShopOrigin(raw string) (string, error) {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || u.Host == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" || (u.Path != "" && u.Path != "/") {
		return "", errors.New("invalid origin")
	}
	scheme := strings.ToLower(u.Scheme)
	if scheme != "http" && scheme != "https" {
		return "", errors.New("invalid origin")
	}
	return scheme + "://" + strings.ToLower(u.Host), nil
}
