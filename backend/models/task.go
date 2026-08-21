package models

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type TaskPriority string
type TaskStatus string
type TaskView string

const (
	TaskPriorityLow    TaskPriority = "low"
	TaskPriorityMedium TaskPriority = "medium"
	TaskPriorityHigh   TaskPriority = "high"

	TaskStatusTodo       TaskStatus = "todo"
	TaskStatusInProgress TaskStatus = "in-progress"
	TaskStatusDone       TaskStatus = "done"

	TaskViewToday     TaskView = "today"
	TaskViewBacklog   TaskView = "backlog"
	TaskViewCompleted TaskView = "completed"
	TaskViewAll       TaskView = "all"
	TaskViewActive    TaskView = "active"
)

type Task struct {
	ID               string       `json:"id"`
	UserID           string       `json:"user_id"`
	Title            string       `json:"title"`
	Description      string       `json:"description"`
	Priority         TaskPriority `json:"priority"`
	ScheduledDate    *string      `json:"scheduled_date"`
	Status           TaskStatus   `json:"status"`
	RecurrenceRule   string       `json:"recurrence_rule"`
	EstimatedMinutes *int         `json:"estimated_minutes"`
	CompletedAt      *time.Time   `json:"completed_at"`
	CreatedAt        time.Time    `json:"created_at"`
	UpdatedAt        time.Time    `json:"updated_at"`
}

type RecurrenceRule string

const (
	RecurrenceDaily     RecurrenceRule = "daily"
	RecurrenceWeekdays  RecurrenceRule = "weekdays"
	RecurrenceWeekly    RecurrenceRule = "weekly"
	RecurrenceMonthly   RecurrenceRule = "monthly"
)

type ListTasksParams struct {
	UserID   string
	View     TaskView
	Priority string
	Status   string
	Limit    int
	Offset   int
}

type CreateTaskParams struct {
	UserID           string
	Title            string
	Description      string
	Priority         TaskPriority
	ScheduledDate    string
	Status           TaskStatus
	RecurrenceRule   string
	EstimatedMinutes *int
}

type UpdateTaskParams struct {
	UserID           string
	ID               string
	Title            string
	Description      string
	Priority         TaskPriority
	ScheduledDate    string
	Status           TaskStatus
	RecurrenceRule   string
	EstimatedMinutes *int
}

type TaskModel struct {
	pool *pgxpool.Pool
}

func NewTaskModel(pool *pgxpool.Pool) TaskModel {
	return TaskModel{pool: pool}
}

func (model TaskModel) List(ctx context.Context, params ListTasksParams) ([]Task, error) {
	rows, err := model.pool.Query(ctx, `
		SELECT id, user_id, title, description, priority, scheduled_date, status, recurrence_rule, estimated_minutes, completed_at, created_at, updated_at
		FROM tasks
		WHERE user_id = $1
		  AND (
		    $2 = 'all'
		    OR ($2 = 'today' AND status <> 'done' AND scheduled_date IS NOT NULL AND scheduled_date <= CURRENT_DATE)
		    OR ($2 = 'backlog' AND status <> 'done' AND scheduled_date IS NULL)
		    OR ($2 = 'completed' AND status = 'done')
		    OR ($2 = 'active' AND status <> 'done')
		  )
		  AND ($3 = '' OR priority = $3)
		  AND ($4 = '' OR status = $4)
		ORDER BY
		  CASE WHEN status = 'done' THEN completed_at END DESC NULLS LAST,
		  scheduled_date ASC NULLS LAST,
		  created_at DESC
		LIMIT $5 OFFSET $6
	`, params.UserID, params.View, params.Priority, params.Status, params.Limit, params.Offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tasks := make([]Task, 0)
	for rows.Next() {
		task, err := scanTask(rows)
		if err != nil {
			return nil, err
		}
		tasks = append(tasks, task)
	}

	return tasks, rows.Err()
}

func (model TaskModel) CountTasks(ctx context.Context, params ListTasksParams) (int, error) {
	var count int
	err := model.pool.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM tasks
		WHERE user_id = $1
		  AND (
		    $2 = 'all'
		    OR ($2 = 'today' AND status <> 'done' AND scheduled_date IS NOT NULL AND scheduled_date <= CURRENT_DATE)
		    OR ($2 = 'backlog' AND status <> 'done' AND scheduled_date IS NULL)
		    OR ($2 = 'completed' AND status = 'done')
		    OR ($2 = 'active' AND status <> 'done')
		  )
		  AND ($3 = '' OR priority = $3)
		  AND ($4 = '' OR status = $4)
	`, params.UserID, params.View, params.Priority, params.Status).Scan(&count)
	if err != nil {
		return 0, err
	}
	return count, nil
}

func (model TaskModel) GetByID(ctx context.Context, userID string, id string) (Task, error) {
	row := model.pool.QueryRow(ctx, `
		SELECT id, user_id, title, description, priority, scheduled_date, status, recurrence_rule, estimated_minutes, completed_at, created_at, updated_at
		FROM tasks
		WHERE user_id = $1 AND id = $2
	`, userID, id)

	task, err := scanTask(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return Task{}, ErrNotFound
	}
	return task, err
}

func (model TaskModel) Create(ctx context.Context, params CreateTaskParams) (Task, error) {
	row := model.pool.QueryRow(ctx, `
		INSERT INTO tasks (user_id, title, description, priority, scheduled_date, status, recurrence_rule, estimated_minutes, completed_at)
		VALUES ($1, $2, $3, $4, NULLIF($5, '')::date, $6, $7, $8, CASE WHEN $6 = 'done' THEN now() ELSE NULL END)
		RETURNING id, user_id, title, description, priority, scheduled_date, status, recurrence_rule, estimated_minutes, completed_at, created_at, updated_at
	`, params.UserID, params.Title, params.Description, params.Priority, params.ScheduledDate, params.Status, params.RecurrenceRule, params.EstimatedMinutes)

	return scanTask(row)
}

func (model TaskModel) Update(ctx context.Context, params UpdateTaskParams) (Task, error) {
	row := model.pool.QueryRow(ctx, `
		UPDATE tasks
		SET title = $3,
		    description = $4,
		    priority = $5,
		    scheduled_date = NULLIF($6, '')::date,
		    status = $7,
		    recurrence_rule = $8,
		    estimated_minutes = $9,
		    completed_at = CASE
		      WHEN $7 = 'done' AND completed_at IS NULL THEN now()
		      WHEN $7 <> 'done' THEN NULL
		      ELSE completed_at
		    END,
		    updated_at = now()
		WHERE user_id = $1 AND id = $2
		RETURNING id, user_id, title, description, priority, scheduled_date, status, recurrence_rule, estimated_minutes, completed_at, created_at, updated_at
	`, params.UserID, params.ID, params.Title, params.Description, params.Priority, params.ScheduledDate, params.Status, params.RecurrenceRule, params.EstimatedMinutes)

	task, err := scanTask(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return Task{}, ErrNotFound
	}
	return task, err
}

func (model TaskModel) Delete(ctx context.Context, userID string, id string) error {
	var activeCount int
	err := model.pool.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM active_focus_sessions
		WHERE user_id = $1 AND task_id = $2 AND status IN ('running', 'paused')
	`, userID, id).Scan(&activeCount)
	if err != nil {
		return err
	}
	if activeCount > 0 {
		return fmt.Errorf("%w: finish or discard the active focus session first", ErrActiveFocusConflict)
	}

	commandTag, err := model.pool.Exec(ctx, "DELETE FROM tasks WHERE user_id = $1 AND id = $2", userID, id)
	if err != nil {
		return err
	}
	if commandTag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

type taskScanner interface {
	Scan(dest ...interface{}) error
}

func scanTask(scanner taskScanner) (Task, error) {
	var task Task
	var scheduledDate pgtype.Date
	var completedAt pgtype.Timestamptz

	err := scanner.Scan(
		&task.ID,
		&task.UserID,
		&task.Title,
		&task.Description,
		&task.Priority,
		&scheduledDate,
		&task.Status,
		&task.RecurrenceRule,
		&task.EstimatedMinutes,
		&completedAt,
		&task.CreatedAt,
		&task.UpdatedAt,
	)
	if err != nil {
		return Task{}, err
	}

	if scheduledDate.Valid {
		value := scheduledDate.Time.Format("2006-01-02")
		task.ScheduledDate = &value
	}
	if completedAt.Valid {
		value := completedAt.Time
		task.CompletedAt = &value
	}

	return task, nil
}
