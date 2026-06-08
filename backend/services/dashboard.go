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

func (service DashboardService) ActivityHeatmap(ctx context.Context, userID string, days int) ([]models.ActivityHeatmapItem, error) {
	return service.dashboard.ActivityHeatmap(ctx, userID, days)
}
