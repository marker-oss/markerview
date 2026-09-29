package server

import (
	"encoding/json"
	"errors"
	"net/http"
	"path/filepath"

	"reviews/internal/auth"
)

func (s *Server) handleDeleteTenant(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, errors.New("invalid request body"))
		return
	}
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, errors.New("authentication required"))
		return
	}
	user, err := s.store.GetAdminUserByID(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusUnauthorized, errors.New("authentication required"))
		return
	}
	valid, err := auth.VerifyPassword(user.PasswordHash, req.Password)
	if err != nil || !valid {
		writeError(w, http.StatusForbidden, errors.New("invalid password"))
		return
	}
	tenant, err := s.store.TenantByID(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	if err := s.store.DeleteTenant(r.Context(), tenant.ID, tenant.PublicKey, s.cfg.UploadDir, filepath.Join(s.cfg.StaticDir, "reviews-data")); err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	clearSessionCookie(w, s.cfg.SecureCookies)
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}
