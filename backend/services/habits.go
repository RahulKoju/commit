package services

import (
	"context"
	"fmt"
	"strings"

	"commit/backend/models"
)

type HabitService struct {
	habits models.HabitModel
}

type CreateHabitCategoryInput struct {
	UserID string
	Name   string
}

type CreateHabitInput struct {
	UserID        string
	CategoryID    string
	Name          string
	Description   string
	Type          string
	TargetValue   *float64
	TargetUnit    *string
	FrequencyType string
	FrequencyDays []int
	WeeklyGoal    int
	SortOrder     int
}

type UpdateHabitInput struct {
	UserID        string
	ID            string
	CategoryID    *string
	Name          *string
	Description   *string
	Type          *string
	TargetValue   *float64
	TargetUnit    *string
	FrequencyType *string
	FrequencyDays *[]int
	WeeklyGoal    *int
	SortOrder     *int
}

type LogHabitInput struct {
	UserID     string
	HabitID    string
	LoggedDate string
	Value      float64
}

func NewHabitService(habits models.HabitModel) HabitService {
	return HabitService{habits: habits}
}

func (service HabitService) ListCategories(ctx context.Context, userID string) ([]models.HabitCategory, error) {
	return service.habits.ListCategories(ctx, userID)
}

func (service HabitService) CreateCategory(ctx context.Context, input CreateHabitCategoryInput) (models.HabitCategory, error) {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return models.HabitCategory{}, fmt.Errorf("category name is required")
	}
	return service.habits.CreateCategory(ctx, models.CreateHabitCategoryParams{UserID: input.UserID, Name: name})
}

func (service HabitService) ListHabits(ctx context.Context, userID string) ([]models.Habit, error) {
	return service.habits.ListHabits(ctx, userID)
}

func (service HabitService) CreateHabit(ctx context.Context, input CreateHabitInput) (models.Habit, error) {
	params, err := createHabitParams(input)
	if err != nil {
		return models.Habit{}, err
	}
	return service.habits.CreateHabit(ctx, params)
}

func (service HabitService) UpdateHabit(ctx context.Context, input UpdateHabitInput) (models.Habit, error) {
	current, err := service.habits.GetHabitByID(ctx, input.UserID, input.ID)
	if err != nil {
		return models.Habit{}, err
	}

	params := models.UpdateHabitParams{
		UserID:        input.UserID,
		ID:            input.ID,
		CategoryID:    current.CategoryID,
		Name:          current.Name,
		Description:   current.Description,
		Type:          current.Type,
		TargetValue:   current.TargetValue,
		TargetUnit:    current.TargetUnit,
		FrequencyType: current.FrequencyType,
		FrequencyDays: current.FrequencyDays,
		WeeklyGoal:    current.WeeklyGoal,
		SortOrder:     current.SortOrder,
	}
	if input.CategoryID != nil {
		params.CategoryID = strings.TrimSpace(*input.CategoryID)
	}
	if input.Name != nil {
		params.Name = strings.TrimSpace(*input.Name)
	}
	if input.Description != nil {
		params.Description = *input.Description
	}
	if input.Type != nil {
		habitType, err := parseHabitType(*input.Type)
		if err != nil {
			return models.Habit{}, err
		}
		params.Type = habitType
	}
	if input.TargetValue != nil {
		params.TargetValue = input.TargetValue
	}
	if input.TargetUnit != nil {
		unit := strings.TrimSpace(*input.TargetUnit)
		params.TargetUnit = &unit
	}
	if input.FrequencyType != nil {
		frequencyType, err := parseFrequencyType(*input.FrequencyType)
		if err != nil {
			return models.Habit{}, err
		}
		params.FrequencyType = frequencyType
	}
	if input.FrequencyDays != nil {
		params.FrequencyDays = *input.FrequencyDays
	}
	if input.WeeklyGoal != nil {
		params.WeeklyGoal = *input.WeeklyGoal
	}
	if input.SortOrder != nil {
		params.SortOrder = *input.SortOrder
	}
	if err := validateHabit(params.Name, params.CategoryID, params.WeeklyGoal); err != nil {
		return models.Habit{}, err
	}

	return service.habits.UpdateHabit(ctx, params)
}

func (service HabitService) DeleteHabit(ctx context.Context, userID string, id string) error {
	return service.habits.DeleteHabit(ctx, userID, id)
}

func (service HabitService) LogHabit(ctx context.Context, input LogHabitInput) (models.HabitLog, error) {
	if strings.TrimSpace(input.LoggedDate) == "" {
		return models.HabitLog{}, fmt.Errorf("logged_date is required")
	}
	if input.Value < 0 {
		return models.HabitLog{}, fmt.Errorf("value cannot be negative")
	}
	return service.habits.LogHabit(ctx, models.LogHabitParams{
		UserID:     input.UserID,
		HabitID:    input.HabitID,
		LoggedDate: strings.TrimSpace(input.LoggedDate),
		Value:      input.Value,
	})
}

func (service HabitService) Analytics(ctx context.Context, userID string, habitID string) (models.HabitAnalytics, error) {
	return service.habits.Analytics(ctx, userID, habitID)
}

func (service HabitService) SeedDefaults(ctx context.Context, userID string) error {
	return service.habits.SeedDefaults(ctx, userID)
}

func createHabitParams(input CreateHabitInput) (models.CreateHabitParams, error) {
	habitType, err := parseHabitType(input.Type)
	if err != nil {
		return models.CreateHabitParams{}, err
	}
	frequencyType, err := parseFrequencyType(input.FrequencyType)
	if err != nil {
		return models.CreateHabitParams{}, err
	}
	weeklyGoal := input.WeeklyGoal
	if weeklyGoal == 0 {
		weeklyGoal = 7
	}
	name := strings.TrimSpace(input.Name)
	categoryID := strings.TrimSpace(input.CategoryID)
	if err := validateHabit(name, categoryID, weeklyGoal); err != nil {
		return models.CreateHabitParams{}, err
	}
	var unit *string
	if input.TargetUnit != nil {
		value := strings.TrimSpace(*input.TargetUnit)
		unit = &value
	}
	frequencyDays := input.FrequencyDays
	if frequencyDays == nil {
		frequencyDays = []int{}
	}

	return models.CreateHabitParams{
		UserID:        input.UserID,
		CategoryID:    categoryID,
		Name:          name,
		Description:   input.Description,
		Type:          habitType,
		TargetValue:   input.TargetValue,
		TargetUnit:    unit,
		FrequencyType: frequencyType,
		FrequencyDays: frequencyDays,
		WeeklyGoal:    weeklyGoal,
		SortOrder:     input.SortOrder,
	}, nil
}

func parseHabitType(value string) (models.HabitType, error) {
	switch models.HabitType(strings.TrimSpace(value)) {
	case models.HabitTypeBoolean:
		return models.HabitTypeBoolean, nil
	case models.HabitTypeNumeric:
		return models.HabitTypeNumeric, nil
	default:
		return "", fmt.Errorf("invalid habit type")
	}
}

func parseFrequencyType(value string) (models.HabitFrequencyType, error) {
	switch models.HabitFrequencyType(strings.TrimSpace(defaultHabitString(value, string(models.HabitFrequencyDaily)))) {
	case models.HabitFrequencyDaily:
		return models.HabitFrequencyDaily, nil
	case models.HabitFrequencyWeekly:
		return models.HabitFrequencyWeekly, nil
	default:
		return "", fmt.Errorf("invalid frequency type")
	}
}

func validateHabit(name string, categoryID string, weeklyGoal int) error {
	if strings.TrimSpace(name) == "" {
		return fmt.Errorf("habit name is required")
	}
	if strings.TrimSpace(categoryID) == "" {
		return fmt.Errorf("category_id is required")
	}
	if weeklyGoal <= 0 {
		return fmt.Errorf("weekly_goal must be greater than 0")
	}
	return nil
}

func defaultHabitString(value string, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return strings.TrimSpace(value)
}
