package services

import (
	"context"
	"fmt"
	"strings"
	"time"

	"commit/backend/models"
)

type LearnService struct {
	learn models.LearnModel
}

type CreateTopicInput struct {
	UserID string
	Name   string
}

type UpdateTopicInput struct {
	UserID string
	ID     string
	Name   string
}

type CreateLearnEntryInput struct {
	UserID          string
	TopicID         string
	DurationMinutes int
	Confidence      int
	Note            string
	StudiedAt       string
}

type UpdateLearnEntryInput struct {
	UserID          string
	ID              string
	TopicID         *string
	DurationMinutes *int
	Confidence      *int
	Note            *string
	StudiedAt       *string
}

type LearnSummary struct {
	WeakSpots  []models.WeakSpot   `json:"weak_spots"`
	TopicStats []models.TopicStats `json:"topic_stats"`
	StudyDays  []models.StudyDay   `json:"study_days"`
	Streak     int                 `json:"streak"`
}

func NewLearnService(learn models.LearnModel) LearnService {
	return LearnService{learn: learn}
}

func (service LearnService) ListTopics(ctx context.Context, userID string) ([]models.Topic, error) {
	return service.learn.ListTopics(ctx, userID)
}

func (service LearnService) CreateTopic(ctx context.Context, input CreateTopicInput) (models.Topic, error) {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return models.Topic{}, fmt.Errorf("topic name is required")
	}
	return service.learn.CreateTopic(ctx, models.CreateTopicParams{UserID: input.UserID, Name: name})
}

func (service LearnService) UpdateTopic(ctx context.Context, input UpdateTopicInput) (models.Topic, error) {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return models.Topic{}, fmt.Errorf("topic name is required")
	}
	return service.learn.UpdateTopic(ctx, models.UpdateTopicParams{UserID: input.UserID, ID: input.ID, Name: name})
}

func (service LearnService) DeleteTopic(ctx context.Context, userID string, id string) error {
	return service.learn.DeleteTopic(ctx, userID, id)
}

func (service LearnService) CountEntries(ctx context.Context, userID string) (int, error) {
	return service.learn.CountLearnEntries(ctx, userID)
}

func (service LearnService) ListEntries(ctx context.Context, userID string, limit int, offset int) ([]models.LearnEntry, error) {
	return service.learn.ListEntries(ctx, models.ListLearnEntriesParams{
		UserID: userID,
		Limit:  limit,
		Offset: offset,
	})
}

func (service LearnService) CreateEntry(ctx context.Context, input CreateLearnEntryInput) (models.LearnEntry, error) {
	studiedAt, err := parseStudiedAt(input.StudiedAt)
	if err != nil {
		return models.LearnEntry{}, err
	}
	if err := validateLearnEntry(input.TopicID, input.DurationMinutes, input.Confidence); err != nil {
		return models.LearnEntry{}, err
	}

	return service.learn.CreateEntry(ctx, models.CreateLearnEntryParams{
		UserID:          input.UserID,
		TopicID:         strings.TrimSpace(input.TopicID),
		DurationMinutes: input.DurationMinutes,
		Confidence:      input.Confidence,
		Note:            input.Note,
		StudiedAt:       studiedAt,
	})
}

func (service LearnService) UpdateEntry(ctx context.Context, input UpdateLearnEntryInput) (models.LearnEntry, error) {
	current, err := service.learn.GetEntryByID(ctx, input.UserID, input.ID)
	if err != nil {
		return models.LearnEntry{}, err
	}

	params := models.UpdateLearnEntryParams{
		UserID:          input.UserID,
		ID:              input.ID,
		TopicID:         current.TopicID,
		DurationMinutes: current.DurationMinutes,
		Confidence:      current.Confidence,
		Note:            current.Note,
		StudiedAt:       current.StudiedAt,
	}
	if input.TopicID != nil {
		params.TopicID = strings.TrimSpace(*input.TopicID)
	}
	if input.DurationMinutes != nil {
		params.DurationMinutes = *input.DurationMinutes
	}
	if input.Confidence != nil {
		params.Confidence = *input.Confidence
	}
	if input.Note != nil {
		params.Note = *input.Note
	}
	if input.StudiedAt != nil {
		studiedAt, err := parseStudiedAt(*input.StudiedAt)
		if err != nil {
			return models.LearnEntry{}, err
		}
		params.StudiedAt = studiedAt
	}
	if err := validateLearnEntry(params.TopicID, params.DurationMinutes, params.Confidence); err != nil {
		return models.LearnEntry{}, err
	}

	return service.learn.UpdateEntry(ctx, params)
}

func (service LearnService) DeleteEntry(ctx context.Context, userID string, id string) error {
	return service.learn.DeleteEntry(ctx, userID, id)
}

func (service LearnService) WeakSpots(ctx context.Context, userID string) ([]models.WeakSpot, error) {
	return service.learn.WeakSpots(ctx, userID)
}

func (service LearnService) Summary(ctx context.Context, userID string) (LearnSummary, error) {
	weakSpots, err := service.learn.WeakSpots(ctx, userID)
	if err != nil {
		return LearnSummary{}, err
	}
	topicStats, err := service.learn.TopicStats(ctx, userID)
	if err != nil {
		return LearnSummary{}, err
	}
	studyDays, err := service.learn.StudyDays(ctx, userID)
	if err != nil {
		return LearnSummary{}, err
	}
	streak, err := service.learn.StudyStreak(ctx, userID)
	if err != nil {
		return LearnSummary{}, err
	}

	return LearnSummary{
		WeakSpots:  weakSpots,
		TopicStats: topicStats,
		StudyDays:  studyDays,
		Streak:     streak,
	}, nil
}

func validateLearnEntry(topicID string, durationMinutes int, confidence int) error {
	if strings.TrimSpace(topicID) == "" {
		return fmt.Errorf("topic_id is required")
	}
	if durationMinutes <= 0 {
		return fmt.Errorf("duration_minutes must be greater than 0")
	}
	if confidence < 1 || confidence > 5 {
		return fmt.Errorf("confidence must be between 1 and 5")
	}
	return nil
}

func parseStudiedAt(value string) (time.Time, error) {
	if strings.TrimSpace(value) == "" {
		return time.Now(), nil
	}
	parsed, err := time.Parse(time.RFC3339, value)
	if err != nil {
		return time.Time{}, fmt.Errorf("studied_at must use RFC3339 format")
	}
	return parsed, nil
}
