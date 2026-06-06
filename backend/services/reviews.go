package services

import (
	"context"
	"fmt"
	"strings"
	"time"

	"commit/backend/models"
)

type ReviewService struct {
	reviews models.ReviewModel
}

type ListReviewsInput struct {
	UserID string
	Type   string
	Limit  int
	Offset int
}

type CreateReviewInput struct {
	UserID         string
	Type           string
	PeriodStart    string
	PeriodEnd      string
	ReflectionText string
}

func NewReviewService(reviews models.ReviewModel) ReviewService {
	return ReviewService{reviews: reviews}
}

func (service ReviewService) Count(ctx context.Context, input ListReviewsInput) (int, error) {
	return service.reviews.CountReviews(ctx, models.ListReviewsParams{
		UserID: input.UserID,
		Type:   strings.TrimSpace(input.Type),
	})
}

func (service ReviewService) List(ctx context.Context, input ListReviewsInput) ([]models.Review, error) {
	if input.Type != "" {
		if _, err := parseReviewType(input.Type); err != nil {
			return nil, err
		}
	}
	return service.reviews.List(ctx, models.ListReviewsParams{
		UserID: input.UserID,
		Type:   strings.TrimSpace(input.Type),
		Limit:  input.Limit,
		Offset: input.Offset,
	})
}

func (service ReviewService) GetByID(ctx context.Context, userID string, id string) (models.Review, error) {
	return service.reviews.GetByID(ctx, userID, id)
}

func (service ReviewService) Create(ctx context.Context, input CreateReviewInput) (models.Review, error) {
	reviewType, err := parseReviewType(input.Type)
	if err != nil {
		return models.Review{}, err
	}
	periodStart, periodEnd, err := reviewPeriod(reviewType, input.PeriodStart, input.PeriodEnd)
	if err != nil {
		return models.Review{}, err
	}
	data, err := service.reviews.BuildSnapshot(ctx, input.UserID, periodStart, periodEnd)
	if err != nil {
		return models.Review{}, err
	}

	return service.reviews.Create(ctx, models.CreateReviewParams{
		UserID:         input.UserID,
		Type:           reviewType,
		PeriodStart:    periodStart,
		PeriodEnd:      periodEnd,
		ReflectionText: input.ReflectionText,
		Data:           data,
	})
}

func parseReviewType(value string) (models.ReviewType, error) {
	switch models.ReviewType(strings.TrimSpace(value)) {
	case models.ReviewTypeWeekly:
		return models.ReviewTypeWeekly, nil
	case models.ReviewTypeMonthly:
		return models.ReviewTypeMonthly, nil
	default:
		return "", fmt.Errorf("invalid review type")
	}
}

func reviewPeriod(reviewType models.ReviewType, start string, end string) (string, string, error) {
	if strings.TrimSpace(start) != "" || strings.TrimSpace(end) != "" {
		if strings.TrimSpace(start) == "" || strings.TrimSpace(end) == "" {
			return "", "", fmt.Errorf("period_start and period_end are required together")
		}
		if _, err := time.Parse("2006-01-02", start); err != nil {
			return "", "", fmt.Errorf("period_start must use YYYY-MM-DD format")
		}
		if _, err := time.Parse("2006-01-02", end); err != nil {
			return "", "", fmt.Errorf("period_end must use YYYY-MM-DD format")
		}
		return start, end, nil
	}

	now := time.Now()
	if reviewType == models.ReviewTypeWeekly {
		weekday := int(now.Weekday())
		if weekday == 0 {
			weekday = 7
		}
		thisMonday := now.AddDate(0, 0, -(weekday - 1))
		lastMonday := thisMonday.AddDate(0, 0, -7)
		lastSunday := lastMonday.AddDate(0, 0, 6)
		return lastMonday.Format("2006-01-02"), lastSunday.Format("2006-01-02"), nil
	}

	firstThisMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	firstLastMonth := firstThisMonth.AddDate(0, -1, 0)
	lastLastMonth := firstThisMonth.AddDate(0, 0, -1)
	return firstLastMonth.Format("2006-01-02"), lastLastMonth.Format("2006-01-02"), nil
}
