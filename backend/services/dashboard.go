package services

import (
	"context"

	"commit/backend/models"
)

type DashboardService struct {
	dashboard models.DashboardModel
	users     models.UserModel
}

func NewDashboardService(dashboard models.DashboardModel, users models.UserModel) DashboardService {
	return DashboardService{dashboard: dashboard, users: users}
}

func (service DashboardService) Summary(ctx context.Context, userID string) (models.DashboardSummary, error) {
	return service.dashboard.Summary(ctx, userID)
}

func (service DashboardService) ActivityHeatmap(ctx context.Context, userID string, days int) ([]models.ActivityHeatmapItem, error) {
	return service.dashboard.ActivityHeatmap(ctx, userID, days)
}

func (service DashboardService) GetLayout(ctx context.Context, userID string) (models.WidgetLayout, error) {
	return service.users.GetWidgetLayout(ctx, userID)
}

func (service DashboardService) SaveLayout(ctx context.Context, userID string, layout models.WidgetLayout) error {
	return service.users.SetWidgetLayout(ctx, userID, layout)
}
