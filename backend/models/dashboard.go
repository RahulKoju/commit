package models

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type DashboardWeekComparison struct {
	TasksDoneThisWeek       int `json:"tasks_done_this_week"`
	TasksDoneLastWeek       int `json:"tasks_done_last_week"`
	HabitsCheckedThisWeek   int `json:"habits_checked_this_week"`
	HabitsCheckedLastWeek   int `json:"habits_checked_last_week"`
	StudySessionsThisWeek   int `json:"study_sessions_this_week"`
	StudySessionsLastWeek   int `json:"study_sessions_last_week"`
	FocusMinutesThisWeek    int `json:"focus_minutes_this_week"`
	FocusMinutesLastWeek    int `json:"focus_minutes_last_week"`
}

type DashboardSummary struct {
	Today              string                           `json:"today"`
	TaskSummary        DashboardTaskSummary             `json:"task_summary"`
	HabitSummary       DashboardHabitSummary            `json:"habit_summary"`
	LearningStreak     int                              `json:"learning_streak"`
	RecentNotes        []DashboardNote                  `json:"recent_notes"`
	WeeklyHabitChart   []DashboardHabitChartItem        `json:"weekly_habit_chart"`
	WeeklyProductivity []DashboardProductivityChartItem `json:"weekly_productivity"`
	WeekComparison     DashboardWeekComparison          `json:"week_comparison"`
	ActiveFocusSession *DashboardFocusSession           `json:"active_focus_session"`
}

type DashboardProductivityChartItem struct {
	Date             string `json:"date"`
	TasksDone        int    `json:"tasks_done"`
	HabitsChecked    int    `json:"habits_checked"`
	LearningSessions int    `json:"learning_sessions"`
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
	productivityChart, err := model.weeklyProductivity(ctx, userID)
	if err != nil {
		return DashboardSummary{}, err
	}
	focusSession, err := model.activeFocusSession(ctx, userID)
	if err != nil {
		return DashboardSummary{}, err
	}
	comparison, err := model.weekComparison(ctx, userID)
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
		WeeklyProductivity: productivityChart,
		WeekComparison:     comparison,
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
		WHERE h.user_id = $1 AND h.deleted_at IS NULL
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
			SELECT generate_series(CURRENT_DATE - INTERVAL '13 days', CURRENT_DATE, INTERVAL '1 day')::date AS day
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
		LEFT JOIN habits h ON h.user_id = $1 AND h.deleted_at IS NULL
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

type ActivityHeatmapItem struct {
	Date      string `json:"date"`
	Total     int    `json:"total"`
	Completed int    `json:"completed"`
}

func (model DashboardModel) weeklyProductivity(ctx context.Context, userID string) ([]DashboardProductivityChartItem, error) {
	rows, err := model.pool.Query(ctx, `
		WITH days AS (
			SELECT generate_series(CURRENT_DATE - INTERVAL '13 days', CURRENT_DATE, INTERVAL '1 day')::date AS day
		)
		SELECT d.day::text,
		       COALESCE(t.done_count, 0)::int,
		       COALESCE(h.checked_count, 0)::int,
		       COALESCE(l.session_count, 0)::int
		FROM days d
		LEFT JOIN (
			SELECT scheduled_date, COUNT(*)::int AS done_count
			FROM tasks
			WHERE user_id = $1 AND status = 'done'
			  AND scheduled_date >= CURRENT_DATE - INTERVAL '13 days'
			GROUP BY scheduled_date
		) t ON t.scheduled_date = d.day
		LEFT JOIN (
			SELECT hl.logged_date, COUNT(*)::int AS checked_count
			FROM habit_logs hl
			INNER JOIN habits h ON h.id = hl.habit_id
			WHERE h.user_id = $1 AND h.deleted_at IS NULL
			  AND hl.logged_date >= CURRENT_DATE - INTERVAL '13 days'
			GROUP BY hl.logged_date
		) h ON h.logged_date = d.day
		LEFT JOIN (
			SELECT studied_at::date AS study_date, COUNT(*)::int AS session_count
			FROM learn_entries
			WHERE user_id = $1
			  AND studied_at >= CURRENT_DATE - INTERVAL '13 days'
			GROUP BY studied_at::date
		) l ON l.study_date = d.day
		ORDER BY d.day
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]DashboardProductivityChartItem, 0)
	for rows.Next() {
		var item DashboardProductivityChartItem
		if err := rows.Scan(&item.Date, &item.TasksDone, &item.HabitsChecked, &item.LearningSessions); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (model DashboardModel) ActivityHeatmap(ctx context.Context, userID string, days int) ([]ActivityHeatmapItem, error) {
	if days <= 0 {
		days = 365
	}
	rows, err := model.pool.Query(ctx, `
		WITH dates AS (
			SELECT generate_series(CURRENT_DATE - ($2::int - 1), CURRENT_DATE, INTERVAL '1 day')::date AS day
		)
		SELECT d.day::text,
		       COUNT(h.id)::int AS total,
		       COUNT(h.id) FILTER (
		         WHERE CASE
		           WHEN h.type = 'boolean' THEN COALESCE(hl.value, 0) >= 1
		           WHEN h.target_value IS NULL THEN COALESCE(hl.value, 0) > 0
		           ELSE COALESCE(hl.value, 0) >= h.target_value
		         END
		       )::int AS completed
		FROM dates d
		LEFT JOIN habits h ON h.user_id = $1 AND h.deleted_at IS NULL
		LEFT JOIN habit_logs hl ON hl.habit_id = h.id AND hl.logged_date = d.day
		GROUP BY d.day
		ORDER BY d.day
	`, userID, days)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]ActivityHeatmapItem, 0)
	for rows.Next() {
		var item ActivityHeatmapItem
		if err := rows.Scan(&item.Date, &item.Total, &item.Completed); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (model DashboardModel) weekComparison(ctx context.Context, userID string) (DashboardWeekComparison, error) {
	var comp DashboardWeekComparison
	err := model.pool.QueryRow(ctx, `
		WITH this_week AS (
			SELECT CURRENT_DATE - INTERVAL '6 days' AS start, CURRENT_DATE AS end
		), last_week AS (
			SELECT CURRENT_DATE - INTERVAL '13 days' AS start, CURRENT_DATE - INTERVAL '7 days' AS end
		)
		SELECT
			COALESCE((SELECT COUNT(*)::int FROM tasks WHERE user_id = $1 AND status = 'done' AND scheduled_date BETWEEN (SELECT start FROM this_week) AND (SELECT end)), 0),
			COALESCE((SELECT COUNT(*)::int FROM tasks WHERE user_id = $1 AND status = 'done' AND scheduled_date BETWEEN (SELECT start FROM last_week) AND (SELECT end)), 0),
			COALESCE((SELECT COUNT(*)::int FROM habit_logs hl INNER JOIN habits h ON h.id = hl.habit_id WHERE h.user_id = $1 AND h.deleted_at IS NULL AND hl.logged_date BETWEEN (SELECT start FROM this_week) AND (SELECT end)), 0),
			COALESCE((SELECT COUNT(*)::int FROM habit_logs hl INNER JOIN habits h ON h.id = hl.habit_id WHERE h.user_id = $1 AND h.deleted_at IS NULL AND hl.logged_date BETWEEN (SELECT start FROM last_week) AND (SELECT end)), 0),
			COALESCE((SELECT COUNT(*)::int FROM learn_entries WHERE user_id = $1 AND studied_at::date BETWEEN (SELECT start FROM this_week) AND (SELECT end)), 0),
			COALESCE((SELECT COUNT(*)::int FROM learn_entries WHERE user_id = $1 AND studied_at::date BETWEEN (SELECT start FROM last_week) AND (SELECT end)), 0),
			COALESCE((SELECT COALESCE(SUM(duration_minutes), 0)::int FROM focus_sessions WHERE user_id = $1 AND start_time::date BETWEEN (SELECT start FROM this_week) AND (SELECT end)), 0),
			COALESCE((SELECT COALESCE(SUM(duration_minutes), 0)::int FROM focus_sessions WHERE user_id = $1 AND start_time::date BETWEEN (SELECT start FROM last_week) AND (SELECT end)), 0)
	`, userID).Scan(
		&comp.TasksDoneThisWeek,
		&comp.TasksDoneLastWeek,
		&comp.HabitsCheckedThisWeek,
		&comp.HabitsCheckedLastWeek,
		&comp.StudySessionsThisWeek,
		&comp.StudySessionsLastWeek,
		&comp.FocusMinutesThisWeek,
		&comp.FocusMinutesLastWeek,
	)
	return comp, err
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
