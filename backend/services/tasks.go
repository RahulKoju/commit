package services

import (
	"context"
	"fmt"
	"strings"
	"time"

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
	Limit    int
	Offset   int
}

type CreateTaskInput struct {
	UserID           string
	TopicID          string
	Title            string
	Description      string
	Priority         string
	ScheduledDate    string
	Status           string
	RecurrenceRule   string
	EstimatedMinutes *int
}

type UpdateTaskInput struct {
	UserID           string
	ID               string
	TopicID          *string
	Title            *string
	Description      *string
	Priority         *string
	ScheduledDate    *string
	Status           *string
	RecurrenceRule   *string
	EstimatedMinutes *int
}

func NewTaskService(tasks models.TaskModel) TaskService {
	return TaskService{tasks: tasks}
}

func (service TaskService) Count(ctx context.Context, input ListTasksInput) (int, error) {
	return service.tasks.CountTasks(ctx, models.ListTasksParams{
		UserID:   input.UserID,
		View:     models.TaskView(input.View),
		TopicID:  strings.TrimSpace(input.TopicID),
		Priority: strings.TrimSpace(input.Priority),
		Status:   strings.TrimSpace(input.Status),
	})
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
		Limit:    input.Limit,
		Offset:   input.Offset,
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
	description := sanitizer.Sanitize(input.Description)

	recurrenceRule := strings.TrimSpace(input.RecurrenceRule)
	if recurrenceRule != "" {
		if _, err := parseRecurrenceRule(recurrenceRule); err != nil {
			return models.Task{}, err
		}
	}

	return service.tasks.Create(ctx, models.CreateTaskParams{
		UserID:           input.UserID,
		TopicID:          strings.TrimSpace(input.TopicID),
		Title:            title,
		Description:      description,
		Priority:         priority,
		ScheduledDate:    strings.TrimSpace(input.ScheduledDate),
		Status:           status,
		RecurrenceRule:   recurrenceRule,
		EstimatedMinutes: input.EstimatedMinutes,
	})
}

func (service TaskService) Update(ctx context.Context, input UpdateTaskInput) (models.Task, error) {
	current, err := service.tasks.GetByID(ctx, input.UserID, input.ID)
	if err != nil {
		return models.Task{}, err
	}

	params := models.UpdateTaskParams{
		UserID:           input.UserID,
		ID:               input.ID,
		Title:            current.Title,
		Description:      current.Description,
		Priority:         current.Priority,
		Status:           current.Status,
		ScheduledDate:    optionalStringValue(current.ScheduledDate),
		TopicID:          optionalStringValue(current.TopicID),
		RecurrenceRule:   current.RecurrenceRule,
		EstimatedMinutes: current.EstimatedMinutes,
	}

	if input.TopicID != nil {
		params.TopicID = strings.TrimSpace(*input.TopicID)
	}
	if input.Title != nil {
		params.Title = strings.TrimSpace(*input.Title)
	}
	if input.Description != nil {
		params.Description = sanitizer.Sanitize(*input.Description)
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
	if input.RecurrenceRule != nil {
		rule := strings.TrimSpace(*input.RecurrenceRule)
		if rule != "" {
			if _, err := parseRecurrenceRule(rule); err != nil {
				return models.Task{}, err
			}
		}
		params.RecurrenceRule = rule
	}
	if input.EstimatedMinutes != nil {
		params.EstimatedMinutes = input.EstimatedMinutes
	}
	if params.Title == "" {
		return models.Task{}, fmt.Errorf("title is required")
	}

	updated, err := service.tasks.Update(ctx, params)
	if err != nil {
		return models.Task{}, err
	}

	if params.Status == models.TaskStatusDone && current.RecurrenceRule != "" && current.Status != models.TaskStatusDone {
		if _, err := service.createRecurringTask(ctx, current); err != nil {
			return models.Task{}, fmt.Errorf("task updated but failed to create recurring instance: %w", err)
		}
	}

	return updated, nil
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

func parseRecurrenceRule(value string) (models.RecurrenceRule, error) {
	switch models.RecurrenceRule(value) {
	case models.RecurrenceDaily, models.RecurrenceWeekdays, models.RecurrenceWeekly, models.RecurrenceMonthly:
		return models.RecurrenceRule(value), nil
	default:
		return "", fmt.Errorf("invalid recurrence rule: %q", value)
	}
}

func (service TaskService) createRecurringTask(ctx context.Context, original models.Task) (models.Task, error) {
	nextDate := nextRecurrenceDate(original.ScheduledDate, models.RecurrenceRule(original.RecurrenceRule))
	if nextDate == "" {
		return models.Task{}, fmt.Errorf("unable to compute next recurrence date")
	}

	return service.tasks.Create(ctx, models.CreateTaskParams{
		UserID:         original.UserID,
		TopicID:        optionalStringValue(original.TopicID),
		Title:          original.Title,
		Description:    original.Description,
		Priority:       original.Priority,
		ScheduledDate:  nextDate,
		Status:         models.TaskStatusTodo,
		RecurrenceRule: original.RecurrenceRule,
	})
}

func nextRecurrenceDate(currentDate *string, rule models.RecurrenceRule) string {
	if currentDate == nil || *currentDate == "" {
		return time.Now().Format("2006-01-02")
	}

	parsed, err := time.Parse("2006-01-02", *currentDate)
	if err != nil {
		return ""
	}

	switch rule {
	case models.RecurrenceDaily:
		return parsed.AddDate(0, 0, 1).Format("2006-01-02")
	case models.RecurrenceWeekdays:
		next := parsed.AddDate(0, 0, 1)
		for next.Weekday() == time.Saturday || next.Weekday() == time.Sunday {
			next = next.AddDate(0, 0, 1)
		}
		return next.Format("2006-01-02")
	case models.RecurrenceWeekly:
		return parsed.AddDate(0, 0, 7).Format("2006-01-02")
	case models.RecurrenceMonthly:
		return parsed.AddDate(0, 1, 0).Format("2006-01-02")
	default:
		return ""
	}
}
