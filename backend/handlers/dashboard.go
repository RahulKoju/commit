package handlers

import (
	"net/http"

	"commit/backend/models"
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
		writeServerError(c, "failed to load dashboard", err)
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
		writeServerError(c, "failed to load activity heatmap", err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"heatmap": heatmap})
}

func (handler DashboardHandler) GetLayout(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}

	layout, err := handler.dashboard.GetLayout(c.Request.Context(), userID)
	if err != nil {
		writeServerError(c, "failed to load layout", err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"layout": layout})
}

type saveLayoutRequest struct {
	Layout models.WidgetLayout `json:"layout" binding:"required"`
}

func (handler DashboardHandler) SaveLayout(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}

	var request saveLayoutRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid layout"})
		return
	}

	if err := handler.dashboard.SaveLayout(c.Request.Context(), userID, request.Layout); err != nil {
		writeServerError(c, "failed to save layout", err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"layout": request.Layout})
}
