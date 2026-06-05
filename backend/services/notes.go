package services

import (
	"context"
	"fmt"
	"strings"

	"commit/backend/models"
)

type NoteService struct {
	notes models.NoteModel
}

type ListNotesInput struct {
	UserID string
	Search string
}

type CreateNoteInput struct {
	UserID   string
	Title    string
	Body     string
	TopicIDs []string
}

type UpdateNoteInput struct {
	UserID   string
	ID       string
	Title    *string
	Body     *string
	TopicIDs *[]string
}

func NewNoteService(notes models.NoteModel) NoteService {
	return NoteService{notes: notes}
}

func (service NoteService) List(ctx context.Context, input ListNotesInput) ([]models.Note, error) {
	return service.notes.List(ctx, models.ListNotesParams{
		UserID: input.UserID,
		Search: strings.TrimSpace(input.Search),
	})
}

func (service NoteService) Create(ctx context.Context, input CreateNoteInput) (models.Note, error) {
	title := strings.TrimSpace(input.Title)
	if title == "" {
		return models.Note{}, fmt.Errorf("title is required")
	}

	return service.notes.Create(ctx, models.CreateNoteParams{
		UserID:   input.UserID,
		Title:    title,
		Body:     input.Body,
		TopicIDs: normalizeTopicIDs(input.TopicIDs),
	})
}

func (service NoteService) Update(ctx context.Context, input UpdateNoteInput) (models.Note, error) {
	current, err := service.notes.GetByID(ctx, input.UserID, input.ID)
	if err != nil {
		return models.Note{}, err
	}

	params := models.UpdateNoteParams{
		UserID:   input.UserID,
		ID:       input.ID,
		Title:    current.Title,
		Body:     current.Body,
		TopicIDs: noteTopicIDs(current.Topics),
	}
	if input.Title != nil {
		params.Title = strings.TrimSpace(*input.Title)
	}
	if input.Body != nil {
		params.Body = *input.Body
	}
	if input.TopicIDs != nil {
		params.TopicIDs = normalizeTopicIDs(*input.TopicIDs)
	}
	if params.Title == "" {
		return models.Note{}, fmt.Errorf("title is required")
	}

	return service.notes.Update(ctx, params)
}

func (service NoteService) Delete(ctx context.Context, userID string, id string) error {
	return service.notes.Delete(ctx, userID, id)
}

func normalizeTopicIDs(values []string) []string {
	seen := make(map[string]bool)
	result := make([]string, 0)
	for _, value := range values {
		topicID := strings.TrimSpace(value)
		if topicID == "" || seen[topicID] {
			continue
		}
		seen[topicID] = true
		result = append(result, topicID)
	}
	return result
}

func noteTopicIDs(topics []models.NoteTopic) []string {
	result := make([]string, 0, len(topics))
	for _, topic := range topics {
		result = append(result, topic.ID)
	}
	return result
}
