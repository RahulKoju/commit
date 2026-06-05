package services

import (
	"context"
	"fmt"
	"strings"

	"commit/backend/models"
)

type TaskService struct {
	tasks models.TaskModel
}

type ListTasksInput struct {
	UserID   string
	View     string
	TopicID  string
	Priority string
	Status   string
}

type CreateTaskInput struct {
	UserID        string
	TopicID       string
	Title         string
	Description   string
	Priority      string
	ScheduledDate string
	Status        string
}

type UpdateTaskInput struct {
	UserID        string
	ID            string
	TopicID       *string
	Title         *string
	Description   *string
	Priority      *string
	ScheduledDate *string
	Status        *string
}

func NewTaskService(tasks models.TaskModel) TaskService {
	return TaskService{tasks: tasks}
}

func (service TaskService) List(ctx context.Context, input ListTasksInput) ([]models.Task, error) {
	view, err := parseTaskView(input.View)
	if err != nil {
		return nil, err
	}
	if input.Priority != "" {
		if _, err := parseTaskPriority(input.Priority); err != nil {
			return nil, err
		}
	}
	if input.Status != "" {
		if _, err := parseTaskStatus(input.Status); err != nil {
			return nil, err
		}
	}

	return service.tasks.List(ctx, models.ListTasksParams{
		UserID:   input.UserID,
		View:     view,
		TopicID:  strings.TrimSpace(input.TopicID),
		Priority: strings.TrimSpace(input.Priority),
		Status:   strings.TrimSpace(input.Status),
	})
}

func (service TaskService) Create(ctx context.Context, input CreateTaskInput) (models.Task, error) {
	priority, err := parseTaskPriority(defaultString(input.Priority, string(models.TaskPriorityMedium)))
	if err != nil {
		return models.Task{}, err
	}
	status, err := parseTaskStatus(defaultString(input.Status, string(models.TaskStatusTodo)))
	if err != nil {
		return models.Task{}, err
	}
	title := strings.TrimSpace(input.Title)
	if title == "" {
		return models.Task{}, fmt.Errorf("title is required")
	}

	return service.tasks.Create(ctx, models.CreateTaskParams{
		UserID:        input.UserID,
		TopicID:       strings.TrimSpace(input.TopicID),
		Title:         title,
		Description:   input.Description,
		Priority:      priority,
		ScheduledDate: strings.TrimSpace(input.ScheduledDate),
		Status:        status,
	})
}

func (service TaskService) Update(ctx context.Context, input UpdateTaskInput) (models.Task, error) {
	current, err := service.tasks.GetByID(ctx, input.UserID, input.ID)
	if err != nil {
		return models.Task{}, err
	}

	params := models.UpdateTaskParams{
		UserID:        input.UserID,
		ID:            input.ID,
		Title:         current.Title,
		Description:   current.Description,
		Priority:      current.Priority,
		Status:        current.Status,
		ScheduledDate: optionalStringValue(current.ScheduledDate),
		TopicID:       optionalStringValue(current.TopicID),
	}

	if input.TopicID != nil {
		params.TopicID = strings.TrimSpace(*input.TopicID)
	}
	if input.Title != nil {
		params.Title = strings.TrimSpace(*input.Title)
	}
	if input.Description != nil {
		params.Description = *input.Description
	}
	if input.Priority != nil {
		priority, err := parseTaskPriority(*input.Priority)
		if err != nil {
			return models.Task{}, err
		}
		params.Priority = priority
	}
	if input.ScheduledDate != nil {
		params.ScheduledDate = strings.TrimSpace(*input.ScheduledDate)
	}
	if input.Status != nil {
		status, err := parseTaskStatus(*input.Status)
		if err != nil {
			return models.Task{}, err
		}
		params.Status = status
	}
	if params.Title == "" {
		return models.Task{}, fmt.Errorf("title is required")
	}

	return service.tasks.Update(ctx, params)
}

func (service TaskService) Delete(ctx context.Context, userID string, id string) error {
	return service.tasks.Delete(ctx, userID, id)
}

func parseTaskView(value string) (models.TaskView, error) {
	switch models.TaskView(defaultString(value, string(models.TaskViewToday))) {
	case models.TaskViewToday:
		return models.TaskViewToday, nil
	case models.TaskViewBacklog:
		return models.TaskViewBacklog, nil
	case models.TaskViewCompleted:
		return models.TaskViewCompleted, nil
	case models.TaskViewAll:
		return models.TaskViewAll, nil
	default:
		return "", fmt.Errorf("invalid task view")
	}
}

func parseTaskPriority(value string) (models.TaskPriority, error) {
	switch models.TaskPriority(value) {
	case models.TaskPriorityLow:
		return models.TaskPriorityLow, nil
	case models.TaskPriorityMedium:
		return models.TaskPriorityMedium, nil
	case models.TaskPriorityHigh:
		return models.TaskPriorityHigh, nil
	default:
		return "", fmt.Errorf("invalid task priority")
	}
}

func parseTaskStatus(value string) (models.TaskStatus, error) {
	switch models.TaskStatus(value) {
	case models.TaskStatusTodo:
		return models.TaskStatusTodo, nil
	case models.TaskStatusInProgress:
		return models.TaskStatusInProgress, nil
	case models.TaskStatusDone:
		return models.TaskStatusDone, nil
	default:
		return "", fmt.Errorf("invalid task status")
	}
}

func defaultString(value string, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return strings.TrimSpace(value)
}

func optionalStringValue(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
