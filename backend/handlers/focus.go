package handlers

import (
	"errors"
	"net/http"

	"commit/backend/middleware"
	"commit/backend/models"
	"commit/backend/services"

	"github.com/gin-gonic/gin"
)

type FocusHandler struct {
	focus services.FocusService
}

type createFocusSessionRequest struct {
	TaskID          string `json:"task_id" binding:"required"`
	TopicID         string `json:"topic_id"`
	StartTime       string `json:"start_time"`
	DurationMinutes int    `json:"duration_minutes" binding:"required"`
}

func NewFocusHandler(focus services.FocusService) FocusHandler {
	return FocusHandler{focus: focus}
}

func (handler FocusHandler) List(c *gin.Context) {
	userID, ok := middleware.CurrentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
		return
	}

	sessions, err := handler.focus.List(c.Request.Context(), services.ListFocusSessionsInput{
		UserID:   userID,
		DateFrom: c.Query("date_from"),
		DateTo:   c.Query("date_to"),
		TopicID:  c.Query("topic_id"),
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"sessions": sessions})
}

func (handler FocusHandler) Create(c *gin.Context) {
	userID, ok := middleware.CurrentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
		return
	}

	var request createFocusSessionRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid focus session request"})
		return
	}

	session, err := handler.focus.Create(c.Request.Context(), services.CreateFocusSessionInput{
		UserID:          userID,
		TaskID:          request.TaskID,
		TopicID:         request.TopicID,
		StartTime:       request.StartTime,
		DurationMinutes: request.DurationMinutes,
	})
	if err != nil {
		status := http.StatusBadRequest
		if errors.Is(err, models.ErrNotFound) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"session": session})
}
