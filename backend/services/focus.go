package services

import (
	"context"
	"fmt"
	"strings"
	"time"

	"commit/backend/models"
)

type FocusService struct {
	focus models.FocusModel
}

type ListFocusSessionsInput struct {
	UserID   string
	DateFrom string
	DateTo   string
	TopicID  string
	Limit    int
	Offset   int
}

type CreateFocusSessionInput struct {
	UserID                  string
	TaskID                  string
	TopicID                 string
	StartTime               string
	DurationMinutes         int
	FocusDailyMinimumMinute int
}

func NewFocusService(focus models.FocusModel) FocusService {
	return FocusService{focus: focus}
}

func (service FocusService) Count(ctx context.Context, input ListFocusSessionsInput) (int, error) {
	return service.focus.CountFocusSessions(ctx, models.ListFocusSessionsParams{
		UserID:   input.UserID,
		DateFrom: strings.TrimSpace(input.DateFrom),
		DateTo:   strings.TrimSpace(input.DateTo),
		TopicID:  strings.TrimSpace(input.TopicID),
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
		TopicID:  strings.TrimSpace(input.TopicID),
		Limit:    input.Limit,
		Offset:   input.Offset,
	})
}

func (service FocusService) Create(ctx context.Context, input CreateFocusSessionInput) (models.FocusSession, error) {
	taskID := strings.TrimSpace(input.TaskID)
	if taskID == "" {
		return models.FocusSession{}, fmt.Errorf("task_id is required")
	}
	if input.DurationMinutes <= 0 {
		return models.FocusSession{}, fmt.Errorf("duration_minutes must be greater than 0")
	}

	startTime, err := parseStartTime(input.StartTime)
	if err != nil {
		return models.FocusSession{}, err
	}

	return service.focus.Create(ctx, models.CreateFocusSessionParams{
		UserID:                  input.UserID,
		TaskID:                  taskID,
		TopicID:                 strings.TrimSpace(input.TopicID),
		StartTime:               startTime,
		DurationMinutes:         input.DurationMinutes,
		FocusDailyMinimumMinute: input.FocusDailyMinimumMinute,
	})
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

func parseStartTime(value string) (time.Time, error) {
	if strings.TrimSpace(value) == "" {
		return time.Now(), nil
	}
	parsed, err := time.Parse(time.RFC3339, value)
	if err != nil {
		return time.Time{}, fmt.Errorf("start_time must use RFC3339 format")
	}
	return parsed, nil
}
