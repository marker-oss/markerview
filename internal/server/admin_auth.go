package server

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"reviews/internal/auth"
	"reviews/internal/store"
)

type credentials struct {
	Login    string `json:"login"`
	Password string `json:"password"`
}

func (c credentials) validate() error {
	if strings.TrimSpace(c.Login) == "" {
		return errors.New("login is required")
	}
	if len(c.Password) < 8 {
		return errors.New("password must be at least 8 characters")
	}
	return nil
}

// handleSetup creates the first admin user. It only works while no admin exists.
func (s *Server) handleSetup(w http.ResponseWriter, r *http.Request) {
	if store.StrictTenantMode() {
		writeError(w, http.StatusNotFound, errors.New("setup is not enabled"))
		return
	}
	n, err := s.store.CountAdminUsers(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	if n > 0 {
		writeError(w, http.StatusConflict, errors.New("admin already configured"))
		return
	}

	var creds credentials
	if err := json.NewDecoder(r.Body).Decode(&creds); err != nil {
		writeError(w, http.StatusBadRequest, errors.New("invalid request body"))
		return
	}
	if err := creds.validate(); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	hash, err := auth.HashPassword(creds.Password)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	if _, err := s.store.CreateAdminUser(r.Context(), strings.TrimSpace(creds.Login), hash); err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"status": "ok"})
}

// handleLogin verifies credentials and starts a session.
func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var creds credentials
	if err := json.NewDecoder(r.Body).Decode(&creds); err != nil {
		writeError(w, http.StatusBadRequest, errors.New("invalid request body"))
		return
	}

	login := strings.TrimSpace(creds.Login)
	if s.cfg.NormalizeLogin != nil {
		canonical, err := s.cfg.NormalizeLogin(login)
		if err == nil {
			login = canonical
		}
	}
	user, err := s.store.GetAdminUserByLogin(r.Context(), login)
	if err != nil {
		writeError(w, http.StatusUnauthorized, errors.New("invalid login or password"))
		return
	}
	ok, err := auth.VerifyPassword(user.PasswordHash, creds.Password)
	if err != nil || !ok {
		writeError(w, http.StatusUnauthorized, errors.New("invalid login or password"))
		return
	}
	if store.StrictTenantMode() && s.cfg.RequireLoginVerification != nil && s.cfg.RequireLoginVerification(user) {
		writeError(w, http.StatusUnauthorized, errors.New("email verification required"))
		return
	}

	token, err := auth.NewSessionToken()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	expires := time.Now().Add(s.cfg.SessionTTL)
	if err := s.store.CreateSession(r.Context(), token, user.ID, user.TenantID, expires); err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	setSessionCookie(w, token, expires, s.cfg.SecureCookies)
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// handleLogout deletes the current session.
func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	if cookie, err := r.Cookie(sessionCookieName); err == nil {
		_ = s.store.DeleteSession(r.Context(), cookie.Value)
	}
	clearSessionCookie(w, s.cfg.SecureCookies)
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// handleMe reports the authenticated admin.
func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	id, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, errors.New("authentication required"))
		return
	}
	user, err := s.store.GetAdminUserByID(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusUnauthorized, errors.New("authentication required"))
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"user_id": id, "role": user.Role})
}

// handleSetupStatus tells the SPA which public authentication modes are
// available. Strict SaaS always starts at login/signup, even with an empty DB.
func (s *Server) handleSetupStatus(w http.ResponseWriter, r *http.Request) {
	strict := store.StrictTenantMode()
	needsSetup := false
	if !strict {
		n, err := s.store.CountAdminUsers(r.Context())
		if err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
		needsSetup = n == 0
	}
	signupEnabled := strict
	if s.cfg.SignupEnabled != nil {
		var err error
		signupEnabled, err = s.cfg.SignupEnabled(r.Context())
		if err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
	}
	writeJSON(w, http.StatusOK, map[string]bool{"needs_setup": needsSetup, "signup_enabled": signupEnabled})
}
