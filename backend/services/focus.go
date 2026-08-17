package services

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"commit/backend/models"
)

type FocusService struct {
	focus  models.FocusModel
	active models.ActiveFocusModel
}

type ListFocusSessionsInput struct {
	UserID   string
	DateFrom string
	DateTo   string
	Limit    int
	Offset   int
}

type StartActiveFocusInput struct {
	UserID                string
	TaskID                string
	SessionType           string
	PlannedDurationSeconds *int
	Tags                  []string
	Message               string
}

func NewFocusService(focus models.FocusModel, active models.ActiveFocusModel) FocusService {
	return FocusService{focus: focus, active: active}
}

func (service FocusService) Count(ctx context.Context, input ListFocusSessionsInput) (int, error) {
	return service.focus.CountFocusSessions(ctx, models.ListFocusSessionsParams{
		UserID:   input.UserID,
		DateFrom: strings.TrimSpace(input.DateFrom),
		DateTo:   strings.TrimSpace(input.DateTo),
	})
}

func (service FocusService) List(ctx context.Context, input ListFocusSessionsInput) ([]models.FocusSession, error) {
	if err := validateOptionalDate(input.DateFrom); err != nil {
		return nil, err
	}
	if err := validateOptionalDate(input.DateTo); err != nil {
		return nil, err
	}

	return service.focus.List(ctx, models.ListFocusSessionsParams{
		UserID:   input.UserID,
		DateFrom: strings.TrimSpace(input.DateFrom),
		DateTo:   strings.TrimSpace(input.DateTo),
		Limit:    input.Limit,
		Offset:   input.Offset,
	})
}

func (service FocusService) Stats(ctx context.Context, userID string) (models.FocusStats, error) {
	return service.focus.Stats(ctx, userID)
}

// Active returns the user's active (running or paused) session, or nil.
func (service FocusService) Active(ctx context.Context, userID string) (*models.ActiveFocusSession, error) {
	return service.active.GetActive(ctx, userID)
}

func (service FocusService) StartActive(ctx context.Context, input StartActiveFocusInput) (*models.ActiveFocusSession, error) {
	switch input.SessionType {
	case "work", "short_break", "long_break":
	default:
		return nil, fmt.Errorf("invalid session_type %q; must be one of work, short_break, long_break", input.SessionType)
	}

	taskID := strings.TrimSpace(input.TaskID)
	if input.SessionType == "work" && taskID == "" {
		return nil, fmt.Errorf("task_id is required for work sessions")
	}
	if input.PlannedDurationSeconds != nil && *input.PlannedDurationSeconds <= 0 {
		return nil, fmt.Errorf("planned_duration_seconds must be greater than 0")
	}

	return service.active.Start(ctx, models.StartActiveFocusParams{
		UserID:                input.UserID,
		TaskID:                taskID,
		SessionType:           input.SessionType,
		PlannedDurationSeconds: input.PlannedDurationSeconds,
		Tags:                  normalizeTags(input.Tags),
		Message:               input.Message,
	})
}

func (service FocusService) PauseActive(ctx context.Context, userID string, sessionID string) (*models.ActiveFocusSession, error) {
	session, err := service.active.Pause(ctx, userID, sessionID, time.Now())
	if errors.Is(err, models.ErrNotFound) {
		return nil, models.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if session.Status != models.ActiveFocusStatusPaused && session.Status != models.ActiveFocusStatusRunning {
		return nil, models.ErrInvalidState
	}
	return session, nil
}

func (service FocusService) ResumeActive(ctx context.Context, userID string, sessionID string) (*models.ActiveFocusSession, error) {
	return service.active.Resume(ctx, userID, sessionID, time.Now())
}

func (service FocusService) HeartbeatActive(ctx context.Context, userID string, sessionID string) error {
	return service.active.Heartbeat(ctx, userID, sessionID, time.Now())
}

func (service FocusService) CompleteActive(ctx context.Context, userID string, sessionID string, focusDailyMinimumMinute int) (*models.ActiveFocusSession, error) {
	return service.active.Complete(ctx, models.CompleteActiveFocusParams{
		UserID:                  userID,
		SessionID:               sessionID,
		Now:                     time.Now(),
		FocusDailyMinimumMinute: focusDailyMinimumMinute,
	})
}

func (service FocusService) DiscardActive(ctx context.Context, userID string, sessionID string) (*models.ActiveFocusSession, error) {
	return service.active.Discard(ctx, userID, sessionID, time.Now())
}

func (service FocusService) AutoExpireStale(ctx context.Context, runningGrace time.Duration, pausedGrace time.Duration) error {
	return service.active.AutoExpireStale(ctx, time.Now(), runningGrace, pausedGrace)
}

func validateOptionalDate(value string) error {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	if _, err := time.Parse("2006-01-02", value); err != nil {
		return fmt.Errorf("date must use YYYY-MM-DD format")
	}
	return nil
}

// StartFocusHeartbeatScheduler runs the focus session liveness loop on a 30s
// ticker (tighter than the once-a-minute reminder scheduler because this one
// is UX-facing). Each tick auto-pauses running sessions whose heartbeat is
// older than the grace window (handles tab-close where sendBeacon never
// fired) and auto-discards paused sessions untouched for 24h.
func StartFocusHeartbeatScheduler(service FocusService) {
	const runningGrace = 3 * time.Minute
	const pausedGrace = 24 * time.Hour
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			err := service.AutoExpireStale(ctx, runningGrace, pausedGrace)
			cancel()
			if err != nil {
				log.Printf("focus heartbeat scheduler tick failed: %v", err)
			}
		}
	}()
}