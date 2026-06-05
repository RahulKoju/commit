package services

import (
	"context"

	"commit/backend/models"
)

type DashboardService struct {
	dashboard models.DashboardModel
}

func NewDashboardService(dashboard models.DashboardModel) DashboardService {
	return DashboardService{dashboard: dashboard}
}

func (service DashboardService) Summary(ctx context.Context, userID string) (models.DashboardSummary, error) {
	return service.dashboard.Summary(ctx, userID)
}
