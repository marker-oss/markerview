package server

import (
	"context"
	"time"

	"reviews/internal/store"
)

// pendingSignupRetention is how long an unconfirmed hosted signup is kept.
// It holds capacity until then; confirming restarts the clock as a trial.
const pendingSignupRetention = 7 * 24 * time.Hour

// StartTrialExpiry pauses trial tenants whose window has ended and removes
// hosted signups that were never confirmed. Runs hourly; both store methods
// are idempotent so frequent ticks are harmless. Disabled in single-tenant
// (compat) mode: the implicit default tenant has no billing lifecycle and
// existing installs may carry a zero trial_ends_at.
func (s *Server) StartTrialExpiry(ctx context.Context) {
	if !store.StrictTenantMode() {
		return
	}
	go func() {
		ticker := time.NewTicker(time.Hour)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if n, err := s.store.PauseExpiredTrials(ctx); err != nil {
					s.logger.Warn("trial expiry failed", "error", err)
				} else if n > 0 {
					s.logger.Info("trial expired: tenants paused", "count", n)
				}
				if n, err := s.store.DeleteExpiredPendingTenants(ctx, pendingSignupRetention); err != nil {
					s.logger.Warn("pending signup cleanup failed", "error", err)
				} else if n > 0 {
					s.logger.Info("unconfirmed signups removed", "count", n)
				}
			}
		}
	}()
}
