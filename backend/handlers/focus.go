package handlers

import (
	"errors"
	"io"
	"net/http"
	"strings"

	"commit/backend/metrics"
	"commit/backend/middleware"
	"commit/backend/models"
	"commit/backend/services"

	"github.com/gin-gonic/gin"
)

type FocusHandler struct {
	focus                   services.FocusService
	focusDailyMinimumMinute int
}

type startFocusSessionRequest struct {
	SessionType           string   `json:"session_type" binding:"required"`
	TaskID                string   `json:"task_id"`
	PlannedDurationSeconds *int    `json:"planned_duration_seconds"`
	Tags                  []string `json:"tags"`
	Message               string   `json:"message"`
}

type sessionIDRequest struct {
	SessionID string `json:"session_id" binding:"required"`
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
		writeServerError(c, "failed to count sessions", err)
		return
	}

	c.JSON(http.StatusOK, models.PaginatedResult[models.FocusSession]{
		Data:   sessions,
		Total:  total,
		Limit:  limit,
		Offset: offset,
	})
}

// GetActive returns the user's active session (running or paused) so the
// frontend can reconstruct timer state on app load / refresh / device switch.
func (handler FocusHandler) GetActive(c *gin.Context) {
	userID, ok := middleware.CurrentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
		return
	}

	session, err := handler.focus.Active(c.Request.Context(), userID)
	if err != nil {
		writeServerError(c, "failed to get active focus session", err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"session": session})
}

// Start creates a running session. The partial unique index is the source of
// truth for single-active: if a concurrent start (two tabs/devices) wins the
// race between the app-level pre-check and the INSERT, the constraint
// violation surfaces as the same 409 + existing-session response.
func (handler FocusHandler) Start(c *gin.Context) {
	userID, ok := middleware.CurrentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
		return
	}

	var request startFocusSessionRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid focus session request"})
		return
	}

	existing, err := handler.focus.Active(c.Request.Context(), userID)
	if err != nil {
		writeServerError(c, "failed to check active focus session", err)
		return
	}
	if existing != nil {
		handler.writeActiveConflict(c, existing)
		return
	}

	session, err := handler.focus.StartActive(c.Request.Context(), services.StartActiveFocusInput{
		UserID:                 userID,
		TaskID:                 request.TaskID,
		SessionType:            request.SessionType,
		PlannedDurationSeconds: request.PlannedDurationSeconds,
		Tags:                   request.Tags,
		Message:                request.Message,
	})
	if errors.Is(err, models.ErrActiveFocusConflict) {
		existing, _ = handler.focus.Active(c.Request.Context(), userID)
		handler.writeActiveConflict(c, existing)
		return
	}
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

// Pause is sendBeacon-compatible: navigator.sendBeacon cannot set custom
// headers or send JSON, so it accepts a text/plain body containing the raw
// session_id (Blob with type "text/plain"), or a JSON body. The httpOnly auth
// cookie rides along automatically on the same-origin request.
func (handler FocusHandler) Pause(c *gin.Context) {
	userID, ok := middleware.CurrentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
		return
	}

	sessionID, err := sessionIDFromBody(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "session_id required"})
		return
	}

	session, err := handler.focus.PauseActive(c.Request.Context(), userID, sessionID)
	if writeActiveFocusError(c, err) {
		return
	}
	c.JSON(http.StatusOK, gin.H{"session": session})
}

func (handler FocusHandler) Resume(c *gin.Context) {
	userID, ok := middleware.CurrentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
		return
	}

	var request sessionIDRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "session_id required"})
		return
	}

	session, err := handler.focus.ResumeActive(c.Request.Context(), userID, request.SessionID)
	if writeActiveFocusError(c, err) {
		return
	}
	c.JSON(http.StatusOK, gin.H{"session": session})
}

func (handler FocusHandler) Heartbeat(c *gin.Context) {
	userID, ok := middleware.CurrentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
		return
	}

	sessionID, err := sessionIDFromBody(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "session_id required"})
		return
	}

	if err := handler.focus.HeartbeatActive(c.Request.Context(), userID, sessionID); err != nil {
		if writeActiveFocusError(c, err) {
			return
		}
	}
	c.Status(http.StatusNoContent)
}

func (handler FocusHandler) Complete(c *gin.Context) {
	userID, ok := middleware.CurrentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
		return
	}

	var request sessionIDRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "session_id required"})
		return
	}

	session, err := handler.focus.CompleteActive(c.Request.Context(), userID, request.SessionID, handler.focusDailyMinimumMinute)
	if writeActiveFocusError(c, err) {
		return
	}

	if session.SessionType == "work" {
		metrics.FocusSessionsTotal.Inc()
	}
	c.JSON(http.StatusOK, gin.H{"session": session})
}

func (handler FocusHandler) Discard(c *gin.Context) {
	userID, ok := middleware.CurrentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
		return
	}

	var request sessionIDRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "session_id required"})
		return
	}

	session, err := handler.focus.DiscardActive(c.Request.Context(), userID, request.SessionID)
	if writeActiveFocusError(c, err) {
		return
	}
	c.JSON(http.StatusOK, gin.H{"session": session})
}

func (handler FocusHandler) Stats(c *gin.Context) {
	userID, ok := middleware.CurrentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
		return
	}

	stats, err := handler.focus.Stats(c.Request.Context(), userID)
	if err != nil {
		writeServerError(c, "failed to get focus stats", err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"stats": stats})
}

func (handler FocusHandler) writeActiveConflict(c *gin.Context, existing *models.ActiveFocusSession) {
	if existing == nil {
		existing = &models.ActiveFocusSession{}
	}
	c.JSON(http.StatusConflict, gin.H{
		"error":   "an active focus session already exists; finish or discard it first",
		"session": existing,
	})
}

// writeActiveFocusError writes the mapped error response and returns true if
// the error was handled. It returns false for nil errors.
func writeActiveFocusError(c *gin.Context, err error) bool {
	switch {
	case err == nil:
		return false
	case errors.Is(err, models.ErrNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": "focus session not found"})
	case errors.Is(err, models.ErrInvalidState):
		c.JSON(http.StatusConflict, gin.H{"error": "focus session is not in the required state"})
	default:
		writeServerError(c, "focus session request failed", err)
	}
	return true
}

// sessionIDFromBody reads the session id from either a JSON body
// ({"session_id": "..."}) or a text/plain body (the raw session id as sent by
// navigator.sendBeacon with a Blob of type "text/plain").
func sessionIDFromBody(c *gin.Context) (string, error) {
	if strings.HasPrefix(c.GetHeader("Content-Type"), "text/plain") {
		body, err := io.ReadAll(c.Request.Body)
		if err != nil {
			return "", err
		}
		id := strings.TrimSpace(string(body))
		if id == "" {
			return "", errors.New("empty session id")
		}
		return id, nil
	}

	var request sessionIDRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		return "", err
	}
	return request.SessionID, nil
}