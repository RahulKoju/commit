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
	focus                   services.FocusService
	focusDailyMinimumMinute int
}

type createFocusSessionRequest struct {
	TaskID          string   `json:"task_id" binding:"required"`
	TopicID         string   `json:"topic_id"`
	Tags            []string `json:"tags"`
	StartTime       string   `json:"start_time"`
	DurationMinutes int      `json:"duration_minutes" binding:"required"`
}

func NewFocusHandler(focus services.FocusService, focusDailyMinimumMinute int) FocusHandler {
	return FocusHandler{focus: focus, focusDailyMinimumMinute: focusDailyMinimumMinute}
}

func (handler FocusHandler) List(c *gin.Context) {
	userID, ok := middleware.CurrentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
		return
	}

	limit, offset := parsePagination(c)
	input := services.ListFocusSessionsInput{
		UserID:   userID,
		DateFrom: c.Query("date_from"),
		DateTo:   c.Query("date_to"),
		TopicID:  c.Query("topic_id"),
		Limit:    limit,
		Offset:   offset,
	}

	sessions, err := handler.focus.List(c.Request.Context(), input)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	total, err := handler.focus.Count(c.Request.Context(), input)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to count sessions"})
		return
	}

	c.JSON(http.StatusOK, models.PaginatedResult[models.FocusSession]{
		Data:   sessions,
		Total:  total,
		Limit:  limit,
		Offset: offset,
	})
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
		UserID:                  userID,
		TaskID:                  request.TaskID,
		TopicID:                 request.TopicID,
		Tags:                    request.Tags,
		StartTime:               request.StartTime,
		DurationMinutes:         request.DurationMinutes,
		FocusDailyMinimumMinute: handler.focusDailyMinimumMinute,
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

func (handler FocusHandler) Stats(c *gin.Context) {
	userID, ok := middleware.CurrentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
		return
	}

	stats, err := handler.focus.Stats(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get focus stats"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"stats": stats})
}
