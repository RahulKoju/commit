package handlers

import (
	"net/http"

	"commit/backend/services"

	"github.com/gin-gonic/gin"
)

type DashboardHandler struct {
	dashboard services.DashboardService
}

func NewDashboardHandler(dashboard services.DashboardService) DashboardHandler {
	return DashboardHandler{dashboard: dashboard}
}

func (handler DashboardHandler) Summary(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}

	summary, err := handler.dashboard.Summary(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load dashboard"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"summary": summary})
}

func (handler DashboardHandler) ActivityHeatmap(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}

	heatmap, err := handler.dashboard.ActivityHeatmap(c.Request.Context(), userID, 365)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load activity heatmap"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"heatmap": heatmap})
}
