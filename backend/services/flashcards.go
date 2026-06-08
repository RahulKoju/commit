package services

import (
	"context"
	"fmt"
	"math"
	"strings"
	"time"

	"commit/backend/models"
)

type FlashcardService struct {
	flashcards models.FlashcardModel
}

type CreateFlashcardInput struct {
	UserID  string
	TopicID string
	Front   string
	Back    string
}

type UpdateFlashcardInput struct {
	UserID  string
	ID      string
	TopicID string
	Front   string
	Back    string
}

type ReviewFlashcardInput struct {
	UserID  string
	ID      string
	Quality int
}

func NewFlashcardService(flashcards models.FlashcardModel) FlashcardService {
	return FlashcardService{flashcards: flashcards}
}

func (service FlashcardService) List(ctx context.Context, userID string, limit int, offset int, topicID string) ([]models.Flashcard, error) {
	return service.flashcards.List(ctx, models.ListFlashcardsParams{
		UserID:  userID,
		Limit:   limit,
		Offset:  offset,
		TopicID: strings.TrimSpace(topicID),
	})
}

func (service FlashcardService) Due(ctx context.Context, userID string, limit int) ([]models.Flashcard, error) {
	return service.flashcards.Due(ctx, userID, limit)
}

func (service FlashcardService) CountDue(ctx context.Context, userID string) (int, error) {
	return service.flashcards.CountDue(ctx, userID)
}

func (service FlashcardService) Create(ctx context.Context, input CreateFlashcardInput) (models.Flashcard, error) {
	front := strings.TrimSpace(input.Front)
	back := strings.TrimSpace(input.Back)
	if front == "" {
		return models.Flashcard{}, fmt.Errorf("front is required")
	}
	if back == "" {
		return models.Flashcard{}, fmt.Errorf("back is required")
	}

	return service.flashcards.Create(ctx, models.CreateFlashcardParams{
		UserID:  input.UserID,
		TopicID: strings.TrimSpace(input.TopicID),
		Front:   front,
		Back:    back,
	})
}

func (service FlashcardService) Update(ctx context.Context, input UpdateFlashcardInput) (models.Flashcard, error) {
	front := strings.TrimSpace(input.Front)
	back := strings.TrimSpace(input.Back)
	if front == "" {
		return models.Flashcard{}, fmt.Errorf("front is required")
	}
	if back == "" {
		return models.Flashcard{}, fmt.Errorf("back is required")
	}

	return service.flashcards.Update(ctx, models.UpdateFlashcardParams{
		UserID:  input.UserID,
		ID:      input.ID,
		TopicID: strings.TrimSpace(input.TopicID),
		Front:   front,
		Back:    back,
	})
}

func (service FlashcardService) Delete(ctx context.Context, userID string, id string) error {
	return service.flashcards.Delete(ctx, userID, id)
}

func (service FlashcardService) Review(ctx context.Context, input ReviewFlashcardInput) (models.Flashcard, error) {
	if input.Quality < 0 || input.Quality > 5 {
		return models.Flashcard{}, fmt.Errorf("quality must be between 0 and 5")
	}

	card, err := service.flashcards.GetByID(ctx, input.UserID, input.ID)
	if err != nil {
		return models.Flashcard{}, err
	}

	easeFactor := card.EaseFactor
	interval := card.IntervalDays
	repetitions := card.Repetitions

	if input.Quality < 3 {
		repetitions = 0
		interval = 1
	} else {
		if repetitions == 0 {
			interval = 1
		} else if repetitions == 1 {
			interval = 6
		} else {
			interval = int(math.Round(float64(interval) * easeFactor))
		}
		easeFactor = easeFactor + (0.1 - float64(5-input.Quality)*(0.08+float64(5-input.Quality)*0.02))
		if easeFactor < 1.3 {
			easeFactor = 1.3
		}
		repetitions++
	}

	nextReview := time.Now().AddDate(0, 0, interval)

	return service.flashcards.Review(ctx, models.ReviewFlashcardParams{
		UserID:       input.UserID,
		ID:           input.ID,
		EaseFactor:   easeFactor,
		IntervalDays: interval,
		Repetitions:  repetitions,
		NextReviewAt: nextReview,
	})
}
