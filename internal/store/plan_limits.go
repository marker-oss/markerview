package store

import (
	"context"
	"encoding/json"
	"errors"

	"gorm.io/gorm"
)

var ErrMarketplaceLimit = errors.New("marketplace connection limit reached")

type PlanLimits struct {
	MaxMarketplaces int   `json:"maxMarketplaces"`
	MaxReviews      int64 `json:"maxReviews"`
}

const planLimitsSetting = "plan_limits"

var defaultPlanLimits = map[string]PlanLimits{
	"trial": {MaxMarketplaces: 1, MaxReviews: 10000},
	"free":  {MaxMarketplaces: 1, MaxReviews: 10000},
	"base":  {MaxMarketplaces: 1, MaxReviews: 10000},
	"pro":   {MaxMarketplaces: 3, MaxReviews: 50000},
	"pro+":  {MaxMarketplaces: 10, MaxReviews: 0},
}

func (s *Store) PlanLimitsFor(ctx context.Context) (PlanLimits, error) {
	return planLimitsForDB(s.db.WithContext(ctx), ctx)
}

func planLimitsForDB(db *gorm.DB, ctx context.Context) (PlanLimits, error) {
	var tenant Tenant
	if err := db.First(&tenant, TenantIDFromCtx(ctx)).Error; err != nil {
		return PlanLimits{}, err
	}
	limits := defaultPlanLimits[tenant.Plan]
	if limits == (PlanLimits{}) {
		limits = defaultPlanLimits["trial"]
	}
	var setting AppSetting
	if err := db.Where("tenant_id = ? AND key = ?", TenantIDFromCtx(ctx), planLimitsSetting).First(&setting).Error; err == nil && setting.Value != "" {
		var configured map[string]PlanLimits
		if json.Unmarshal([]byte(setting.Value), &configured) == nil {
			if override, ok := configured[tenant.Plan]; ok {
				limits = override
			}
		}
	}
	return limits, nil
}
