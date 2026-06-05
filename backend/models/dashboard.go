package models

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type DashboardSummary struct {
	Today              string                    `json:"today"`
	TaskSummary        DashboardTaskSummary      `json:"task_summary"`
	HabitSummary       DashboardHabitSummary     `json:"habit_summary"`
	LearningStreak     int                       `json:"learning_streak"`
	RecentNotes        []DashboardNote           `json:"recent_notes"`
	WeeklyHabitChart   []DashboardHabitChartItem `json:"weekly_habit_chart"`
	ActiveFocusSession *DashboardFocusSession    `json:"active_focus_session"`
}

type DashboardTaskSummary struct {
	Total int `json:"total"`
	Done  int `json:"done"`
}

type DashboardHabitSummary struct {
	Total   int `json:"total"`
	Checked int `json:"checked"`
}

type DashboardNote struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	UpdatedAt time.Time `json:"updated_at"`
}

type DashboardHabitChartItem struct {
	Date    string `json:"date"`
	Total   int    `json:"total"`
	Checked int    `json:"checked"`
}

type DashboardFocusSession struct {
	ID              string    `json:"id"`
	TaskID          string    `json:"task_id"`
	TaskTitle       string    `json:"task_title"`
	StartTime       time.Time `json:"start_time"`
	DurationMinutes int       `json:"duration_minutes"`
}

type DashboardModel struct {
	pool  *pgxpool.Pool
	learn LearnModel
}

func NewDashboardModel(pool *pgxpool.Pool, learn LearnModel) DashboardModel {
	return DashboardModel{pool: pool, learn: learn}
}

func (model DashboardModel) Summary(ctx context.Context, userID string) (DashboardSummary, error) {
	taskSummary, err := model.taskSummary(ctx, userID)
	if err != nil {
		return DashboardSummary{}, err
	}
	habitSummary, err := model.habitSummary(ctx, userID)
	if err != nil {
		return DashboardSummary{}, err
	}
	streak, err := model.learn.StudyStreak(ctx, userID)
	if err != nil {
		return DashboardSummary{}, err
	}
	recentNotes, err := model.recentNotes(ctx, userID)
	if err != nil {
		return DashboardSummary{}, err
	}
	habitChart, err := model.weeklyHabitChart(ctx, userID)
	if err != nil {
		return DashboardSummary{}, err
	}
	focusSession, err := model.activeFocusSession(ctx, userID)
	if err != nil {
		return DashboardSummary{}, err
	}

	return DashboardSummary{
		Today:              time.Now().Format("2006-01-02"),
		TaskSummary:        taskSummary,
		HabitSummary:       habitSummary,
		LearningStreak:     streak,
		RecentNotes:        recentNotes,
		WeeklyHabitChart:   habitChart,
		ActiveFocusSession: focusSession,
	}, nil
}

func (model DashboardModel) taskSummary(ctx context.Context, userID string) (DashboardTaskSummary, error) {
	var summary DashboardTaskSummary
	err := model.pool.QueryRow(ctx, `
		SELECT COUNT(*)::int,
		       COUNT(*) FILTER (WHERE status = 'done')::int
		FROM tasks
		WHERE user_id = $1 AND (
			scheduled_date = CURRENT_DATE
			OR (status <> 'done' AND scheduled_date < CURRENT_DATE)
		)
	`, userID).Scan(&summary.Total, &summary.Done)
	return summary, err
}

func (model DashboardModel) habitSummary(ctx context.Context, userID string) (DashboardHabitSummary, error) {
	var summary DashboardHabitSummary
	err := model.pool.QueryRow(ctx, `
		SELECT COUNT(h.id)::int,
		       COUNT(h.id) FILTER (
		         WHERE CASE
		           WHEN h.type = 'boolean' THEN COALESCE(hl.value, 0) >= 1
		           WHEN h.target_value IS NULL THEN COALESCE(hl.value, 0) > 0
		           ELSE COALESCE(hl.value, 0) >= h.target_value
		         END
		       )::int
		FROM habits h
		LEFT JOIN habit_logs hl ON hl.habit_id = h.id AND hl.logged_date = CURRENT_DATE
		WHERE h.user_id = $1
	`, userID).Scan(&summary.Total, &summary.Checked)
	return summary, err
}

func (model DashboardModel) recentNotes(ctx context.Context, userID string) ([]DashboardNote, error) {
	rows, err := model.pool.Query(ctx, `
		SELECT id, title, updated_at
		FROM notes
		WHERE user_id = $1
		ORDER BY updated_at DESC
		LIMIT 3
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	notes := make([]DashboardNote, 0)
	for rows.Next() {
		var note DashboardNote
		if err := rows.Scan(&note.ID, &note.Title, &note.UpdatedAt); err != nil {
			return nil, err
		}
		notes = append(notes, note)
	}
	return notes, rows.Err()
}

func (model DashboardModel) weeklyHabitChart(ctx context.Context, userID string) ([]DashboardHabitChartItem, error) {
	rows, err := model.pool.Query(ctx, `
		WITH days AS (
			SELECT generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, INTERVAL '1 day')::date AS day
		)
		SELECT d.day::text,
		       COUNT(h.id)::int AS total,
		       COUNT(h.id) FILTER (
		         WHERE CASE
		           WHEN h.type = 'boolean' THEN COALESCE(hl.value, 0) >= 1
		           WHEN h.target_value IS NULL THEN COALESCE(hl.value, 0) > 0
		           ELSE COALESCE(hl.value, 0) >= h.target_value
		         END
		       )::int AS checked
		FROM days d
		LEFT JOIN habits h ON h.user_id = $1
		LEFT JOIN habit_logs hl ON hl.habit_id = h.id AND hl.logged_date = d.day
		GROUP BY d.day
		ORDER BY d.day
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]DashboardHabitChartItem, 0)
	for rows.Next() {
		var item DashboardHabitChartItem
		if err := rows.Scan(&item.Date, &item.Total, &item.Checked); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (model DashboardModel) activeFocusSession(ctx context.Context, userID string) (*DashboardFocusSession, error) {
	rows, err := model.pool.Query(ctx, `
		SELECT fs.id, fs.task_id, t.title, fs.start_time, fs.duration_minutes
		FROM focus_sessions fs
		INNER JOIN tasks t ON t.id = fs.task_id
		WHERE fs.user_id = $1
		  AND fs.start_time::date = CURRENT_DATE
		ORDER BY fs.start_time DESC
		LIMIT 1
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	if !rows.Next() {
		return nil, rows.Err()
	}

	var session DashboardFocusSession
	if err := rows.Scan(&session.ID, &session.TaskID, &session.TaskTitle, &session.StartTime, &session.DurationMinutes); err != nil {
		return nil, err
	}
	return &session, rows.Err()
}
