package handlers

import (
	"errors"
	"fmt"
	"net/http"
	"time"

	"commit/backend/metrics"
	"commit/backend/models"
	"commit/backend/services"

	"github.com/gin-gonic/gin"
)

type ReminderHandler struct {
	reminders services.ReminderService
}

type createReminderRequest struct {
	Type    string     `json:"type" binding:"required"`
	FireAt  *time.Time `json:"fire_at"`
	Cron    string     `json:"cron"`
	Message string     `json:"message"`
}

type updateReminderRequest struct {
	Cron     string  `json:"cron"`
	Message  *string `json:"message"`
	IsActive *bool   `json:"is_active"`
}

func NewReminderHandler(reminders services.ReminderService) ReminderHandler {
	return ReminderHandler{reminders: reminders}
}

func (handler ReminderHandler) ListByNote(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}

	reminders, err := handler.reminders.ListByNote(c.Request.Context(), userID, c.Param("id"))
	if err != nil {
		writeServerError(c, "failed to list reminders", err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"reminders": reminders})
}

// Due is the polling endpoint. It only ever returns rows belonging to the
// authenticated user: user_id is bound in SQL inside DueInWindow, and note
// ownership is verified via the notes join. The client passes `since` as its
// last checkpoint and catches up on anything fired after it.
func (handler ReminderHandler) Due(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}

	var since time.Time
	if raw := c.Query("since"); raw != "" {
		parsed, err := time.Parse(time.RFC3339, raw)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid since, expected RFC3339"})
			return
		}
		since = parsed
	}

	reminders, err := handler.reminders.DueInWindow(c.Request.Context(), userID, since, models.MaxLimit)
	if err != nil {
		writeServerError(c, "failed to fetch due reminders", err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"reminders": reminders})
}

// Create derives user_id exclusively from the authenticated session. The note
// must belong to that user: the INSERT is guarded by "FROM notes WHERE
// user_id = $1 AND id = $2", so a body can never pin a reminder to a note the
// session user doesn't own (returns 404).
func (handler ReminderHandler) Create(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}

	var request createReminderRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid reminder request"})
		return
	}

	reminder, err := handler.reminders.Create(c.Request.Context(), services.CreateReminderInput{
		UserID:  userID,
		NoteID:  c.Param("id"),
		Type:    request.Type,
		FireAt:  request.FireAt,
		Cron:    request.Cron,
		Message: request.Message,
	})
	if err != nil {
		writeReminderError(c, err)
		return
	}

	metrics.RemindersCreatedTotal.Inc()
	c.JSON(http.StatusCreated, gin.H{"reminder": reminder})
}

func (handler ReminderHandler) Update(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}

	var request updateReminderRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid reminder request"})
		return
	}

	if err := validateUpdateRequest(request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	reminder, err := handler.reminders.Update(c.Request.Context(), services.UpdateReminderInput{
		UserID:   userID,
		ID:       c.Param("reminderId"),
		Cron:     request.Cron,
		Message:  request.Message,
		IsActive: request.IsActive,
	})
	if err != nil {
		writeReminderError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"reminder": reminder})
}

func (handler ReminderHandler) Delete(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}

	if err := handler.reminders.Delete(c.Request.Context(), userID, c.Param("reminderId")); err != nil {
		writeReminderError(c, err)
		return
	}

	c.Status(http.StatusNoContent)
}

// validateUpdateRequest rejects a no-op update (the DB CHECK constraint would
// reject a cleared cron on a recurring reminder anyway; this returns a friendlier
// error first).
func validateUpdateRequest(request updateReminderRequest) error {
	if request.Message == nil && request.IsActive == nil && request.Cron == "" {
		return fmt.Errorf("nothing to update")
	}
	return nil
}

func writeReminderError(c *gin.Context, err error) {
	status := http.StatusBadRequest
	if errors.Is(err, models.ErrNotFound) {
		status = http.StatusNotFound
	}
	c.JSON(status, gin.H{"error": err.Error()})
}
