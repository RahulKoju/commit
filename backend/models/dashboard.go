package models

import (
	"context"
	"errors"
	"log"
	"math"
	"sort"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type DashboardWeekComparison struct {
	TasksDoneThisWeek     int `json:"tasks_done_this_week"`
	TasksDoneLastWeek     int `json:"tasks_done_last_week"`
	HabitsCheckedThisWeek int `json:"habits_checked_this_week"`
	HabitsCheckedLastWeek int `json:"habits_checked_last_week"`
	FocusMinutesThisWeek  int `json:"focus_minutes_this_week"`
	FocusMinutesLastWeek  int `json:"focus_minutes_last_week"`
}

type DashboardSummary struct {
	Today              string                           `json:"today"`
	TaskSummary        DashboardTaskSummary             `json:"task_summary"`
	HabitSummary       DashboardHabitSummary            `json:"habit_summary"`
	RecentNotes        []DashboardNote                  `json:"recent_notes"`
	WeeklyHabitChart   []DashboardHabitChartItem        `json:"weekly_habit_chart"`
	WeeklyProductivity []DashboardProductivityChartItem `json:"weekly_productivity"`
	WeekComparison     DashboardWeekComparison          `json:"week_comparison"`
	ActiveFocusSession *DashboardFocusSession           `json:"active_focus_session"`
}

type DashboardProductivityChartItem struct {
	Date             string `json:"date"`
	TasksDone        int    `json:"tasks_done"`
	FocusMinutes     int    `json:"focus_minutes"`
	NotesCreated     int    `json:"notes_created"`
	RemindersCreated int    `json:"reminders_created"`
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
	pool *pgxpool.Pool
}

const dashboardTimezone = "Asia/Kathmandu"

var dashboardLocation = loadDashboardLocation()

func loadDashboardLocation() *time.Location {
	location, err := time.LoadLocation(dashboardTimezone)
	if err != nil {
		log.Printf("load dashboard timezone %q: %v; falling back to UTC", dashboardTimezone, err)
		return time.UTC
	}
	return location
}

func dashboardNow() time.Time {
	return time.Now().In(dashboardLocation)
}

// DashboardYear returns the current calendar year in the dashboard timezone.
func DashboardYear() int {
	return dashboardNow().Year()
}

func NewDashboardModel(pool *pgxpool.Pool) DashboardModel {
	return DashboardModel{pool: pool}
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
		Today:              dashboardNow().Format("2006-01-02"),
		TaskSummary:        taskSummary,
		HabitSummary:       habitSummary,
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
			scheduled_date = (now() AT TIME ZONE $2)::date
			OR (status <> 'done' AND scheduled_date < (now() AT TIME ZONE $2)::date)
		)
	`, userID, dashboardTimezone).Scan(&summary.Total, &summary.Done)
	return summary, err
}

type habitDayCounts struct {
	total   int
	checked int
}

// habitDailyCounts returns per-day {total, checked} counts for the user's habits
// over the inclusive date range. Total counts only habits scheduled on that day
// and checked counts only completions among scheduled habits, so weekday-restricted
// habits never inflate off-day stats. Reuses habitScheduledOn/habitCompleted from
// habit.go to stay consistent with the habits matrix and analytics.
func (model DashboardModel) habitDailyCounts(ctx context.Context, userID string, startDate, endDate string) (map[string]habitDayCounts, error) {
	habitRows, err := model.pool.Query(ctx, `
		SELECT id, type, target_value, target_value_max, comparison_operator, frequency_type, frequency_days
		FROM habits
		WHERE user_id = $1 AND deleted_at IS NULL
	`, userID)
	if err != nil {
		return nil, err
	}
	defer habitRows.Close()

	type habitMeta struct {
		habit Habit
	}
	habits := make([]habitMeta, 0)
	for habitRows.Next() {
		var habit Habit
		var targetValue pgtype.Numeric
		var targetValueMax pgtype.Numeric
		var frequencyDays []int32
		if err := habitRows.Scan(&habit.ID, &habit.Type, &targetValue, &targetValueMax, &habit.ComparisonOperator, &habit.FrequencyType, &frequencyDays); err != nil {
			return nil, err
		}
		if targetValue.Valid {
			if value, err := targetValue.Float64Value(); err == nil && value.Valid {
				habit.TargetValue = &value.Float64
			}
		}
		if targetValueMax.Valid {
			if value, err := targetValueMax.Float64Value(); err == nil && value.Valid {
				habit.TargetValueMax = &value.Float64
			}
		}
		habit.FrequencyDays = make([]int, 0, len(frequencyDays))
		for _, day := range frequencyDays {
			habit.FrequencyDays = append(habit.FrequencyDays, int(day))
		}
		habits = append(habits, habitMeta{habit: habit})
	}
	if err := habitRows.Err(); err != nil {
		return nil, err
	}

	logRows, err := model.pool.Query(ctx, `
		SELECT habit_id, logged_date::text, value::float8
		FROM habit_logs
		WHERE user_id = $1 AND logged_date BETWEEN $2::date AND $3::date
	`, userID, startDate, endDate)
	if err != nil {
		return nil, err
	}
	defer logRows.Close()

	logs := make(map[string]map[string]float64)
	for logRows.Next() {
		var habitID string
		var date string
		var value float64
		if err := logRows.Scan(&habitID, &date, &value); err != nil {
			return nil, err
		}
		if logs[habitID] == nil {
			logs[habitID] = make(map[string]float64)
		}
		logs[habitID][date] = value
	}
	if err := logRows.Err(); err != nil {
		return nil, err
	}

	start, err := time.Parse("2006-01-02", startDate)
	if err != nil {
		return nil, err
	}
	end, err := time.Parse("2006-01-02", endDate)
	if err != nil {
		return nil, err
	}

	result := make(map[string]habitDayCounts)
	for day := start; !day.After(end); day = day.AddDate(0, 0, 1) {
		date := day.Format("2006-01-02")
		var counts habitDayCounts
		for _, meta := range habits {
			if !habitScheduledOn(meta.habit, date) {
				continue
			}
			counts.total++
			if value, ok := logs[meta.habit.ID][date]; ok && habitCompleted(meta.habit, value) {
				counts.checked++
			}
		}
		result[date] = counts
	}
	return result, nil
}

func (model DashboardModel) habitSummary(ctx context.Context, userID string) (DashboardHabitSummary, error) {
	today := dashboardNow().Format("2006-01-02")
	counts, err := model.habitDailyCounts(ctx, userID, today, today)
	if err != nil {
		return DashboardHabitSummary{}, err
	}
	summary := DashboardHabitSummary{Total: counts[today].total, Checked: counts[today].checked}
	return summary, nil
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
	now := dashboardNow()
	end := now.Format("2006-01-02")
	start := now.AddDate(0, 0, -13).Format("2006-01-02")
	counts, err := model.habitDailyCounts(ctx, userID, start, end)
	if err != nil {
		return nil, err
	}

	items := make([]DashboardHabitChartItem, 0, 14)
	for day := now.AddDate(0, 0, -13); !day.After(now); day = day.AddDate(0, 0, 1) {
		date := day.Format("2006-01-02")
		items = append(items, DashboardHabitChartItem{
			Date:    date,
			Total:   counts[date].total,
			Checked: counts[date].checked,
		})
	}
	return items, nil
}

type HabitHeatmapItem struct {
	Date      string `json:"date"`
	Total     int    `json:"total"`
	Completed int    `json:"completed"`
	Level     int    `json:"level"`
}

type ActivityHeatmapItem struct {
	Date   string `json:"date"`
	Points int    `json:"points"`
	Level  int    `json:"level"`
}

type DashboardHeatmap struct {
	Year         int                   `json:"year"`
	EarliestYear int                   `json:"earliest_year"`
	HabitHeatmap []HabitHeatmapItem    `json:"habit_heatmap"`
	ActivityHeatmap []ActivityHeatmapItem `json:"activity_heatmap"`
}

// activityPoints caps each contributor so no single source dominates the daily
// total (max ~28/day): tasks <= 10, focus <= 240min, notes <= 5, reminders <= 5.
func activityPoints(tasks, focusMinutes, notes, reminders int) int {
	return min(tasks, 10) + min(focusMinutes, 240)/30 + min(notes, 5) + min(reminders, 5)
}

// quantileBoundaries returns nearest-rank boundaries for the given percentages
// over sorted non-zero points. Re-computed on every request over whatever window
// of data actually exists (cold-start friendly: never errors, just coarser early).
func quantileBoundaries(sorted []int, percentages []float64) []int {
	n := len(sorted)
	if n == 0 {
		return make([]int, len(percentages))
	}
	boundaries := make([]int, len(percentages))
	for i, p := range percentages {
		index := int(math.Ceil(p/100*float64(n))) - 1
		if index < 0 {
			index = 0
		}
		if index >= n {
			index = n - 1
		}
		boundaries[i] = sorted[index]
	}
	return boundaries
}

// activityLevel buckets a day's points into 0-4 using the user's own distribution.
// Zero-activity days always render as level 0 regardless of the quantile math.
func activityLevel(points int, boundaries []int) int {
	if points <= 0 {
		return 0
	}
	if points <= boundaries[0] {
		return 1
	}
	if points <= boundaries[1] {
		return 2
	}
	if points <= boundaries[2] {
		return 3
	}
	if points <= boundaries[3] {
		return 4
	}
	return 4
}

func (model DashboardModel) weeklyProductivity(ctx context.Context, userID string) ([]DashboardProductivityChartItem, error) {
	now := dashboardNow()
	start := now.AddDate(0, 0, -13).Format("2006-01-02")
	end := now.Format("2006-01-02")
	rows, err := model.pool.Query(ctx, `
		WITH days AS (
			SELECT generate_series($2::date, $3::date, INTERVAL '1 day')::date AS day
		)
		SELECT d.day::text,
		       COALESCE(t.done_count, 0)::int,
		       COALESCE(f.minutes_sum, 0)::int,
		       COALESCE(n.note_count, 0)::int,
		       COALESCE(r.reminder_count, 0)::int
		FROM days d
		LEFT JOIN (
			SELECT (completed_at AT TIME ZONE $4)::date AS day, COUNT(*)::int AS done_count
			FROM tasks
			WHERE user_id = $1 AND status = 'done' AND completed_at IS NOT NULL
			GROUP BY (completed_at AT TIME ZONE $4)::date
		) t ON t.day = d.day
		LEFT JOIN (
			SELECT (start_time AT TIME ZONE $4)::date AS day, COALESCE(SUM(duration_minutes), 0)::int AS minutes_sum
			FROM focus_sessions
			WHERE user_id = $1
			GROUP BY (start_time AT TIME ZONE $4)::date
		) f ON f.day = d.day
		LEFT JOIN (
			SELECT (created_at AT TIME ZONE $4)::date AS day, COUNT(*)::int AS note_count
			FROM notes
			WHERE user_id = $1
			GROUP BY (created_at AT TIME ZONE $4)::date
		) n ON n.day = d.day
		LEFT JOIN (
			SELECT (created_at AT TIME ZONE $4)::date AS day, COUNT(*)::int AS reminder_count
			FROM reminders
			WHERE user_id = $1
			GROUP BY (created_at AT TIME ZONE $4)::date
		) r ON r.day = d.day
		ORDER BY d.day
	`, userID, start, end, dashboardTimezone)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]DashboardProductivityChartItem, 0)
	for rows.Next() {
		var item DashboardProductivityChartItem
		if err := rows.Scan(&item.Date, &item.TasksDone, &item.FocusMinutes, &item.NotesCreated, &item.RemindersCreated); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

// ActivityHeatmap renders a full calendar year (Jan 1 – Dec 31 in the
// dashboard timezone) for the given year. Days after today within the current
// year are included with zero counts so the grid covers the whole year.
func (model DashboardModel) ActivityHeatmap(ctx context.Context, userID string, year int) (DashboardHeatmap, error) {
	start := time.Date(year, time.January, 1, 0, 0, 0, 0, dashboardLocation)
	end := time.Date(year, time.December, 31, 0, 0, 0, 0, dashboardLocation)
	startDate := start.Format("2006-01-02")
	endDate := end.Format("2006-01-02")

	createdAt, err := model.accountCreatedAt(ctx, userID)
	if err != nil {
		return DashboardHeatmap{}, err
	}

	counts, err := model.habitDailyCounts(ctx, userID, startDate, endDate)
	if err != nil {
		return DashboardHeatmap{}, err
	}

	habitItems := make([]HabitHeatmapItem, 0, 366)
	for day := start; !day.After(end); day = day.AddDate(0, 0, 1) {
		date := day.Format("2006-01-02")
		item := HabitHeatmapItem{Date: date}
		// Days before the account existed have no scheduled habits.
		if !day.Before(time.Date(createdAt.Year(), createdAt.Month(), createdAt.Day(), 0, 0, 0, 0, dashboardLocation)) {
			item.Total = counts[date].total
			item.Completed = counts[date].checked
		}
		habitItems = append(habitItems, item)
	}

	// Quantile-bucket completed counts over the user's own non-zero days so
	// low-but-real activity never rounds down to an empty cell.
	var completedSorted []int
	for _, item := range habitItems {
		if item.Completed > 0 {
			completedSorted = append(completedSorted, item.Completed)
		}
	}
	sort.Ints(completedSorted)
	habitBoundaries := quantileBoundaries(completedSorted, []float64{20, 40, 60, 80})
	for i := range habitItems {
		habitItems[i].Level = activityLevel(habitItems[i].Completed, habitBoundaries)
	}

	rows, err := model.pool.Query(ctx, `
		WITH dates AS (
			SELECT generate_series($2::date, $3::date, INTERVAL '1 day')::date AS day
		)
		SELECT d.day::text,
		       COALESCE(t.done_count, 0)::int,
		       COALESCE(f.minutes_sum, 0)::int,
		       COALESCE(n.note_count, 0)::int,
		       COALESCE(r.reminder_count, 0)::int
		FROM dates d
		LEFT JOIN (
			SELECT (completed_at AT TIME ZONE $4)::date AS day, COUNT(*)::int AS done_count
			FROM tasks
			WHERE user_id = $1 AND status = 'done' AND completed_at IS NOT NULL
			GROUP BY (completed_at AT TIME ZONE $4)::date
		) t ON t.day = d.day
		LEFT JOIN (
			SELECT (start_time AT TIME ZONE $4)::date AS day, COALESCE(SUM(duration_minutes), 0)::int AS minutes_sum
			FROM focus_sessions
			WHERE user_id = $1
			GROUP BY (start_time AT TIME ZONE $4)::date
		) f ON f.day = d.day
		LEFT JOIN (
			SELECT (created_at AT TIME ZONE $4)::date AS day, COUNT(*)::int AS note_count
			FROM notes
			WHERE user_id = $1
			GROUP BY (created_at AT TIME ZONE $4)::date
		) n ON n.day = d.day
		LEFT JOIN (
			SELECT (created_at AT TIME ZONE $4)::date AS day, COUNT(*)::int AS reminder_count
			FROM reminders
			WHERE user_id = $1
			GROUP BY (created_at AT TIME ZONE $4)::date
		) r ON r.day = d.day
		ORDER BY d.day
	`, userID, startDate, endDate, dashboardTimezone)
	if err != nil {
		return DashboardHeatmap{}, err
	}
	defer rows.Close()

	activityItems := make([]ActivityHeatmapItem, 0, 366)
	var pointsByDate []int
	for rows.Next() {
		var item ActivityHeatmapItem
		var tasks, focusMinutes, notes, reminders int
		if err := rows.Scan(&item.Date, &tasks, &focusMinutes, &notes, &reminders); err != nil {
			return DashboardHeatmap{}, err
		}
		item.Points = activityPoints(tasks, focusMinutes, notes, reminders)
		if item.Points > 0 {
			pointsByDate = append(pointsByDate, item.Points)
		}
		activityItems = append(activityItems, item)
	}
	if err := rows.Err(); err != nil {
		return DashboardHeatmap{}, err
	}

	sorted := append([]int(nil), pointsByDate...)
	sort.Ints(sorted)
	boundaries := quantileBoundaries(sorted, []float64{20, 40, 60, 80})
	for i := range activityItems {
		activityItems[i].Level = activityLevel(activityItems[i].Points, boundaries)
	}

	return DashboardHeatmap{
		Year:            year,
		EarliestYear:    createdAt.Year(),
		HabitHeatmap:    habitItems,
		ActivityHeatmap: activityItems,
	}, nil
}

// accountCreatedAt returns when the user's account was created, converted to
// the dashboard timezone.
func (model DashboardModel) accountCreatedAt(ctx context.Context, userID string) (time.Time, error) {
	var createdAt time.Time
	err := model.pool.QueryRow(ctx, `
		SELECT created_at AT TIME ZONE $2 FROM users WHERE id = $1
	`, userID, dashboardTimezone).Scan(&createdAt)
	if err != nil {
		return time.Time{}, err
	}
	return createdAt, nil
}

func (model DashboardModel) weekComparison(ctx context.Context, userID string) (DashboardWeekComparison, error) {
	var comp DashboardWeekComparison

	now := dashboardNow()
	thisWeekStart := now.AddDate(0, 0, -6).Format("2006-01-02")
	thisWeekEnd := now.Format("2006-01-02")
	lastWeekStart := now.AddDate(0, 0, -13).Format("2006-01-02")
	lastWeekEnd := now.AddDate(0, 0, -7).Format("2006-01-02")

	counts, err := model.habitDailyCounts(ctx, userID, lastWeekStart, thisWeekEnd)
	if err != nil {
		return comp, err
	}
	for date, c := range counts {
		if date >= thisWeekStart && date <= thisWeekEnd {
			comp.HabitsCheckedThisWeek += c.checked
		}
		if date >= lastWeekStart && date <= lastWeekEnd {
			comp.HabitsCheckedLastWeek += c.checked
		}
	}

	err = model.pool.QueryRow(ctx, `
		WITH this_week AS (
			SELECT $2::date AS start_date, $3::date AS end_date
		), last_week AS (
			SELECT $4::date AS start_date, $5::date AS end_date
		)
		SELECT
			COALESCE((SELECT COUNT(*)::int FROM tasks WHERE user_id = $1 AND status = 'done' AND scheduled_date BETWEEN (SELECT start_date FROM this_week) AND (SELECT end_date FROM this_week)), 0),
			COALESCE((SELECT COUNT(*)::int FROM tasks WHERE user_id = $1 AND status = 'done' AND scheduled_date BETWEEN (SELECT start_date FROM last_week) AND (SELECT end_date FROM last_week)), 0),
			COALESCE((SELECT COALESCE(SUM(duration_minutes), 0)::int FROM focus_sessions WHERE user_id = $1 AND (start_time AT TIME ZONE $6)::date BETWEEN (SELECT start_date FROM this_week) AND (SELECT end_date FROM this_week)), 0),
			COALESCE((SELECT COALESCE(SUM(duration_minutes), 0)::int FROM focus_sessions WHERE user_id = $1 AND (start_time AT TIME ZONE $6)::date BETWEEN (SELECT start_date FROM last_week) AND (SELECT end_date FROM last_week)), 0)
	`, userID, thisWeekStart, thisWeekEnd, lastWeekStart, lastWeekEnd, dashboardTimezone).Scan(
		&comp.TasksDoneThisWeek,
		&comp.TasksDoneLastWeek,
		&comp.FocusMinutesThisWeek,
		&comp.FocusMinutesLastWeek,
	)
	return comp, err
}

func (model DashboardModel) activeFocusSession(ctx context.Context, userID string) (*DashboardFocusSession, error) {
	row := model.pool.QueryRow(ctx, `
		SELECT afs.id, afs.task_id, COALESCE(t.title, ''), afs.started_at,
		       GREATEST(1, CEIL((afs.elapsed_seconds + COALESCE(EXTRACT(EPOCH FROM (now() - afs.segment_started_at)), 0)) / 60.0))::int
		FROM active_focus_sessions afs
		LEFT JOIN tasks t ON t.id = afs.task_id AND t.user_id = afs.user_id
		WHERE afs.user_id = $1
		  AND afs.status IN ('running', 'paused')
		  AND (afs.started_at AT TIME ZONE $2)::date = (now() AT TIME ZONE $2)::date
		ORDER BY afs.started_at DESC
		LIMIT 1
	`, userID, dashboardTimezone)
	var session DashboardFocusSession
	var taskID *string
	err := row.Scan(&session.ID, &taskID, &session.TaskTitle, &session.StartTime, &session.DurationMinutes)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	if taskID != nil {
		session.TaskID = *taskID
	}
	return &session, nil
}
