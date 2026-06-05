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
)

type Task struct {
	ID            string       `json:"id"`
	UserID        string       `json:"user_id"`
	TopicID       *string      `json:"topic_id"`
	Title         string       `json:"title"`
	Description   string       `json:"description"`
	Priority      TaskPriority `json:"priority"`
	ScheduledDate *string      `json:"scheduled_date"`
	Status        TaskStatus   `json:"status"`
	CompletedAt   *time.Time   `json:"completed_at"`
	CreatedAt     time.Time    `json:"created_at"`
	UpdatedAt     time.Time    `json:"updated_at"`
}

type ListTasksParams struct {
	UserID   string
	View     TaskView
	TopicID  string
	Priority string
	Status   string
}

type CreateTaskParams struct {
	UserID        string
	TopicID       string
	Title         string
	Description   string
	Priority      TaskPriority
	ScheduledDate string
	Status        TaskStatus
}

type UpdateTaskParams struct {
	UserID        string
	ID            string
	TopicID       string
	Title         string
	Description   string
	Priority      TaskPriority
	ScheduledDate string
	Status        TaskStatus
}

type TaskModel struct {
	pool *pgxpool.Pool
}

func NewTaskModel(pool *pgxpool.Pool) TaskModel {
	return TaskModel{pool: pool}
}

func (model TaskModel) List(ctx context.Context, params ListTasksParams) ([]Task, error) {
	rows, err := model.pool.Query(ctx, `
		SELECT id, user_id, topic_id, title, description, priority, scheduled_date, status, completed_at, created_at, updated_at
		FROM tasks
		WHERE user_id = $1
		  AND (
		    $2 = 'all'
		    OR ($2 = 'today' AND status <> 'done' AND scheduled_date IS NOT NULL AND scheduled_date <= CURRENT_DATE)
		    OR ($2 = 'backlog' AND status <> 'done' AND scheduled_date IS NULL)
		    OR ($2 = 'completed' AND status = 'done')
		  )
		  AND ($3 = '' OR topic_id = $3::uuid)
		  AND ($4 = '' OR priority = $4)
		  AND ($5 = '' OR status = $5)
		ORDER BY
		  CASE WHEN status = 'done' THEN completed_at END DESC NULLS LAST,
		  scheduled_date ASC NULLS LAST,
		  created_at DESC
	`, params.UserID, params.View, params.TopicID, params.Priority, params.Status)
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

func (model TaskModel) GetByID(ctx context.Context, userID string, id string) (Task, error) {
	row := model.pool.QueryRow(ctx, `
		SELECT id, user_id, topic_id, title, description, priority, scheduled_date, status, completed_at, created_at, updated_at
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
		INSERT INTO tasks (user_id, topic_id, title, description, priority, scheduled_date, status, completed_at)
		VALUES ($1, NULLIF($2, '')::uuid, $3, $4, $5, NULLIF($6, '')::date, $7, CASE WHEN $7 = 'done' THEN now() ELSE NULL END)
		RETURNING id, user_id, topic_id, title, description, priority, scheduled_date, status, completed_at, created_at, updated_at
	`, params.UserID, params.TopicID, params.Title, params.Description, params.Priority, params.ScheduledDate, params.Status)

	return scanTask(row)
}

func (model TaskModel) Update(ctx context.Context, params UpdateTaskParams) (Task, error) {
	row := model.pool.QueryRow(ctx, `
		UPDATE tasks
		SET topic_id = NULLIF($3, '')::uuid,
		    title = $4,
		    description = $5,
		    priority = $6,
		    scheduled_date = NULLIF($7, '')::date,
		    status = $8,
		    completed_at = CASE
		      WHEN $8 = 'done' AND completed_at IS NULL THEN now()
		      WHEN $8 <> 'done' THEN NULL
		      ELSE completed_at
		    END,
		    updated_at = now()
		WHERE user_id = $1 AND id = $2
		RETURNING id, user_id, topic_id, title, description, priority, scheduled_date, status, completed_at, created_at, updated_at
	`, params.UserID, params.ID, params.TopicID, params.Title, params.Description, params.Priority, params.ScheduledDate, params.Status)

	task, err := scanTask(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return Task{}, ErrNotFound
	}
	return task, err
}

func (model TaskModel) Delete(ctx context.Context, userID string, id string) error {
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
	var topicID pgtype.UUID
	var scheduledDate pgtype.Date
	var completedAt pgtype.Timestamptz

	err := scanner.Scan(
		&task.ID,
		&task.UserID,
		&topicID,
		&task.Title,
		&task.Description,
		&task.Priority,
		&scheduledDate,
		&task.Status,
		&completedAt,
		&task.CreatedAt,
		&task.UpdatedAt,
	)
	if err != nil {
		return Task{}, err
	}

	if topicID.Valid {
		value := formatUUID(topicID.Bytes)
		task.TopicID = &value
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

func formatUUID(bytes [16]byte) string {
	return fmt.Sprintf("%x-%x-%x-%x-%x", bytes[0:4], bytes[4:6], bytes[6:8], bytes[8:10], bytes[10:16])
}
