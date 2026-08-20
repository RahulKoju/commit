package models

import (
	"context"
	"errors"
	"fmt"
	"math"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type HabitType string
type HabitFrequencyType string
type HabitComparisonOperator string

const (
	HabitTypeBoolean HabitType = "boolean"
	HabitTypeNumeric HabitType = "numeric"

	HabitFrequencyDaily  HabitFrequencyType = "daily"
	HabitFrequencyWeekly HabitFrequencyType = "weekly"

	HabitComparisonGTE     HabitComparisonOperator = "gte"
	HabitComparisonLTE     HabitComparisonOperator = "lte"
	HabitComparisonEQ      HabitComparisonOperator = "eq"
	HabitComparisonBetween HabitComparisonOperator = "between"
)

type HabitCategory struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Habit struct {
	ID                 string                  `json:"id"`
	UserID             string                  `json:"user_id"`
	CategoryID         string                  `json:"category_id"`
	CategoryName       string                  `json:"category_name"`
	Name               string                  `json:"name"`
	Icon               *string                 `json:"icon"`
	Description        string                  `json:"description"`
	Type               HabitType               `json:"type"`
	TargetValue        *float64                `json:"target_value"`
	TargetValueMax     *float64                `json:"target_value_max"`
	ComparisonOperator HabitComparisonOperator `json:"comparison_operator"`
	TargetUnit         *string                 `json:"target_unit"`
	FrequencyType      HabitFrequencyType      `json:"frequency_type"`
	FrequencyDays      []int                   `json:"frequency_days"`
	WeeklyGoal         int                     `json:"weekly_goal"`
	SortOrder          int                     `json:"sort_order"`
	TodayLog           *HabitLog               `json:"today_log"`
	CurrentStreak      int                     `json:"current_streak"`
	LongestStreak      int                     `json:"longest_streak"`
	CreatedAt          time.Time               `json:"created_at"`
	UpdatedAt          time.Time               `json:"updated_at"`
	DeletedAt          *time.Time              `json:"deleted_at"`
}

type HabitLog struct {
	ID         string    `json:"id"`
	UserID     string    `json:"user_id"`
	HabitID    string    `json:"habit_id"`
	LoggedDate string    `json:"logged_date"`
	Value      float64   `json:"value"`
	Note       string    `json:"note"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

type HabitAnalytics struct {
	HabitID            string           `json:"habit_id"`
	CompletionRate30   float64          `json:"completion_rate_30"`
	CompletionRate90   float64          `json:"completion_rate_90"`
	CurrentStreak      int              `json:"current_streak"`
	LongestStreak      int              `json:"longest_streak"`
	BestWeek           int              `json:"best_week"`
	DailyCompletion    []HabitDayStatus `json:"daily_completion"`
	CategoryCompletion float64          `json:"category_completion"`
}

type HabitDayStatus struct {
	Date      string  `json:"date"`
	Value     float64 `json:"value"`
	Completed bool    `json:"completed"`
	Scheduled bool    `json:"scheduled"`
}

type CreateHabitCategoryParams struct {
	UserID string
	Name   string
}

type CreateHabitParams struct {
	UserID             string
	CategoryID         string
	Name               string
	Icon               *string
	Description        string
	Type               HabitType
	TargetValue        *float64
	TargetValueMax     *float64
	ComparisonOperator HabitComparisonOperator
	TargetUnit         *string
	FrequencyType      HabitFrequencyType
	FrequencyDays      []int
	WeeklyGoal         int
	SortOrder          int
}

type UpdateHabitParams struct {
	UserID             string
	ID                 string
	CategoryID         string
	Name               string
	Icon               *string
	Description        string
	Type               HabitType
	TargetValue        *float64
	TargetValueMax     *float64
	ComparisonOperator HabitComparisonOperator
	TargetUnit         *string
	FrequencyType      HabitFrequencyType
	FrequencyDays      []int
	WeeklyGoal         int
	SortOrder          int
}

type UpdateHabitCategoryParams struct {
	UserID string
	ID     string
	Name   string
}

type LogHabitParams struct {
	UserID     string
	HabitID    string
	LoggedDate string
	Value      float64
	Note       string
}

type HabitModel struct {
	pool *pgxpool.Pool
}

func NewHabitModel(pool *pgxpool.Pool) HabitModel {
	return HabitModel{pool: pool}
}

func (model HabitModel) ListCategories(ctx context.Context, userID string) ([]HabitCategory, error) {
	rows, err := model.pool.Query(ctx, `
		SELECT id, user_id, name, created_at, updated_at
		FROM habit_categories
		WHERE user_id = $1
		ORDER BY lower(name)
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	categories := make([]HabitCategory, 0)
	for rows.Next() {
		var category HabitCategory
		if err := rows.Scan(&category.ID, &category.UserID, &category.Name, &category.CreatedAt, &category.UpdatedAt); err != nil {
			return nil, err
		}
		categories = append(categories, category)
	}

	return categories, rows.Err()
}

func (model HabitModel) CreateCategory(ctx context.Context, params CreateHabitCategoryParams) (HabitCategory, error) {
	var category HabitCategory
	err := model.pool.QueryRow(ctx, `
		INSERT INTO habit_categories (user_id, name)
		VALUES ($1, $2)
		ON CONFLICT (user_id, name) DO UPDATE SET updated_at = now()
		RETURNING id, user_id, name, created_at, updated_at
	`, params.UserID, params.Name).Scan(&category.ID, &category.UserID, &category.Name, &category.CreatedAt, &category.UpdatedAt)
	return category, err
}

func (model HabitModel) UpdateCategory(ctx context.Context, params UpdateHabitCategoryParams) (HabitCategory, error) {
	var category HabitCategory
	err := model.pool.QueryRow(ctx, `
		UPDATE habit_categories
		SET name = $3, updated_at = now()
		WHERE user_id = $1 AND id = $2
		RETURNING id, user_id, name, created_at, updated_at
	`, params.UserID, params.ID, params.Name).Scan(&category.ID, &category.UserID, &category.Name, &category.CreatedAt, &category.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return HabitCategory{}, ErrNotFound
	}
	return category, err
}

func (model HabitModel) DeleteCategory(ctx context.Context, userID string, id string) error {
	var count int
	err := model.pool.QueryRow(ctx, `SELECT COUNT(*) FROM habits WHERE user_id = $1 AND category_id = $2`, userID, id).Scan(&count)
	if err != nil {
		return err
	}
	if count > 0 {
		return fmt.Errorf("category has %d habit(s); delete or reassign them first", count)
	}

	tag, err := model.pool.Exec(ctx, `DELETE FROM habit_categories WHERE user_id = $1 AND id = $2`, userID, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (model HabitModel) ListHabits(ctx context.Context, userID string) ([]Habit, error) {
	rows, err := model.pool.Query(ctx, `
		SELECT h.id, h.user_id, h.category_id, c.name, h.name, h.icon, h.description, h.type, h.target_value,
		       h.target_value_max, h.comparison_operator, h.target_unit,
		       h.frequency_type, h.frequency_days, h.weekly_goal, h.sort_order, h.created_at, h.updated_at
		FROM habits h
		INNER JOIN habit_categories c ON c.id = h.category_id AND c.user_id = h.user_id
		WHERE h.user_id = $1 AND h.deleted_at IS NULL
		ORDER BY c.name, h.sort_order, h.name
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	habits := make([]Habit, 0)
	for rows.Next() {
		habit, err := scanHabit(rows)
		if err != nil {
			return nil, err
		}
		habits = append(habits, habit)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return model.attachTodayLogs(ctx, habits)
}

func (model HabitModel) GetHabitByID(ctx context.Context, userID string, id string) (Habit, error) {
	row := model.pool.QueryRow(ctx, `
		SELECT h.id, h.user_id, h.category_id, c.name, h.name, h.icon, h.description, h.type, h.target_value,
		       h.target_value_max, h.comparison_operator, h.target_unit,
		       h.frequency_type, h.frequency_days, h.weekly_goal, h.sort_order, h.created_at, h.updated_at
		FROM habits h
		INNER JOIN habit_categories c ON c.id = h.category_id AND c.user_id = h.user_id
		WHERE h.user_id = $1 AND h.id = $2 AND h.deleted_at IS NULL
	`, userID, id)

	habit, err := scanHabit(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return Habit{}, ErrNotFound
	}
	return habit, err
}

func (model HabitModel) CreateHabit(ctx context.Context, params CreateHabitParams) (Habit, error) {
	frequencyDays := params.FrequencyDays
	if frequencyDays == nil {
		frequencyDays = []int{}
	}
	comparisonOperator := params.ComparisonOperator
	if comparisonOperator == "" {
		comparisonOperator = HabitComparisonGTE
	}
	row := model.pool.QueryRow(ctx, `
		INSERT INTO habits (user_id, category_id, name, icon, description, type, target_value, target_value_max, comparison_operator, target_unit, frequency_type, frequency_days, weekly_goal, sort_order)
		SELECT $1, c.id, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
		FROM habit_categories c
		WHERE c.user_id = $1 AND c.id = $2
		ON CONFLICT (user_id, name) DO UPDATE SET updated_at = now(), deleted_at = NULL
		RETURNING id
	`, params.UserID, params.CategoryID, params.Name, params.Icon, params.Description, params.Type, params.TargetValue, params.TargetValueMax, comparisonOperator, params.TargetUnit, params.FrequencyType, frequencyDays, params.WeeklyGoal, params.SortOrder)

	var id string
	if err := row.Scan(&id); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Habit{}, ErrNotFound
		}
		return Habit{}, err
	}
	return model.GetHabitByID(ctx, params.UserID, id)
}

func (model HabitModel) UpdateHabit(ctx context.Context, params UpdateHabitParams) (Habit, error) {
	row := model.pool.QueryRow(ctx, `
		UPDATE habits h
		SET category_id = c.id,
		    name = $3,
		    icon = $4,
		    description = $5,
		    type = $6,
		    target_value = $7,
		    target_value_max = $8,
		    comparison_operator = $9,
		    target_unit = $10,
		    frequency_type = $11,
		    frequency_days = $12,
		    weekly_goal = $13,
		    sort_order = $14,
		    updated_at = now()
		FROM habit_categories c
		WHERE h.user_id = $1 AND h.id = $2 AND c.user_id = $1 AND c.id = $15
		RETURNING h.id
	`, params.UserID, params.ID, params.Name, params.Icon, params.Description, params.Type, params.TargetValue, params.TargetValueMax, params.ComparisonOperator, params.TargetUnit, params.FrequencyType, params.FrequencyDays, params.WeeklyGoal, params.SortOrder, params.CategoryID)

	var id string
	if err := row.Scan(&id); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Habit{}, ErrNotFound
		}
		return Habit{}, err
	}
	return model.GetHabitByID(ctx, params.UserID, id)
}

func (model HabitModel) DeleteHabit(ctx context.Context, userID string, id string) error {
	commandTag, err := model.pool.Exec(ctx, "UPDATE habits SET deleted_at = now() WHERE user_id = $1 AND id = $2 AND deleted_at IS NULL", userID, id)
	if err != nil {
		return err
	}
	if commandTag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (model HabitModel) LogHabit(ctx context.Context, params LogHabitParams) (HabitLog, error) {
	if err := model.ensureScheduledDay(ctx, params); err != nil {
		return HabitLog{}, err
	}

	row := model.pool.QueryRow(ctx, `
		INSERT INTO habit_logs (user_id, habit_id, logged_date, value, note)
		SELECT $1, h.id, $3::date, $4, $5
		FROM habits h
		WHERE h.user_id = $1 AND h.id = $2 AND h.deleted_at IS NULL
		ON CONFLICT (habit_id, logged_date)
		DO UPDATE SET value = EXCLUDED.value, note = EXCLUDED.note, updated_at = now()
		RETURNING id, user_id, habit_id, logged_date::text, value::float8, note, created_at, updated_at
	`, params.UserID, params.HabitID, params.LoggedDate, params.Value, params.Note)

	log, err := scanHabitLog(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return HabitLog{}, ErrNotFound
	}
	return log, err
}

// ensureScheduledDay rejects logs written for a weekday that falls outside a
// weekday-restricted habit's frequency_days (1=Monday .. 7=Sunday). Daily
// habits are always scheduled, so they pass unconditionally.
func (model HabitModel) ensureScheduledDay(ctx context.Context, params LogHabitParams) error {
	row := model.pool.QueryRow(ctx, `
		SELECT h.frequency_type, h.frequency_days
		FROM habits h
		WHERE h.user_id = $1 AND h.id = $2 AND h.deleted_at IS NULL
	`, params.UserID, params.HabitID)

	var frequencyType HabitFrequencyType
	var frequencyDays []int32
	if err := row.Scan(&frequencyType, &frequencyDays); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		return err
	}

	if frequencyType != HabitFrequencyWeekly {
		return nil
	}

	loggedDate, err := time.Parse("2006-01-02", params.LoggedDate)
	if err != nil {
		return err
	}

	weekday := int(loggedDate.Weekday())
	if weekday == 0 {
		weekday = 7
	}
	for _, day := range frequencyDays {
		if int(day) == weekday {
			return nil
		}
	}
	return ErrHabitNotScheduled
}

func (model HabitModel) Analytics(ctx context.Context, userID string, habitID string) (HabitAnalytics, error) {
	habit, err := model.GetHabitByID(ctx, userID, habitID)
	if err != nil {
		return HabitAnalytics{}, err
	}

	days, err := model.habitDayStatuses(ctx, habit, 90)
	if err != nil {
		return HabitAnalytics{}, err
	}

	return HabitAnalytics{
		HabitID:            habitID,
		CompletionRate30:   completionRate(days[len(days)-30:]),
		CompletionRate90:   completionRate(days),
		CurrentStreak:      currentStreak(days),
		LongestStreak:      longestStreak(days),
		BestWeek:           bestWeek(days),
		DailyCompletion:    days,
		CategoryCompletion: completionRate(days),
	}, nil
}

type HabitMatrixLog struct {
	HabitID    string  `json:"habit_id"`
	LoggedDate string  `json:"logged_date"`
	Value      float64 `json:"value"`
}

type HabitMatrix struct {
	Habits []Habit          `json:"habits"`
	Logs   []HabitMatrixLog `json:"logs"`
}

type HabitExportRow struct {
	Date       string
	HabitName  string
	Category   string
	Value      float64
	TargetUnit *string
}

func (model HabitModel) ExportLogs(ctx context.Context, userID string) ([]HabitExportRow, error) {
	rows, err := model.pool.Query(ctx, `
		SELECT hl.logged_date::text, h.name, c.name, hl.value::float8, h.target_unit
		FROM habit_logs hl
		INNER JOIN habits h ON h.id = hl.habit_id AND h.user_id = hl.user_id
		INNER JOIN habit_categories c ON c.id = h.category_id
		WHERE hl.user_id = $1
		ORDER BY hl.logged_date DESC, h.name
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]HabitExportRow, 0)
	for rows.Next() {
		var row HabitExportRow
		if err := rows.Scan(&row.Date, &row.HabitName, &row.Category, &row.Value, &row.TargetUnit); err != nil {
			return nil, err
		}
		result = append(result, row)
	}
	return result, rows.Err()
}

// Matrix returns the flat habit list plus every habit log within [start, end]
// (inclusive) in one call, so the frontend can render the date×habit table
// without N+1 log queries. Habits carry their scheduling metadata
// (frequency_type/frequency_days) so the client can gate cells and compute
// weekday-aware averages.
func (model HabitModel) Matrix(ctx context.Context, userID string, start string, end string) (HabitMatrix, error) {
	habitRows, err := model.pool.Query(ctx, `
		SELECT h.id, h.user_id, h.category_id, c.name, h.name, h.icon, h.description, h.type, h.target_value,
		       h.target_value_max, h.comparison_operator, h.target_unit,
		       h.frequency_type, h.frequency_days, h.weekly_goal, h.sort_order, h.created_at, h.updated_at
		FROM habits h
		INNER JOIN habit_categories c ON c.id = h.category_id AND c.user_id = h.user_id
		WHERE h.user_id = $1 AND h.deleted_at IS NULL
		ORDER BY h.sort_order, h.name
	`, userID)
	if err != nil {
		return HabitMatrix{}, err
	}

	matrix := HabitMatrix{Habits: make([]Habit, 0), Logs: make([]HabitMatrixLog, 0)}
	for habitRows.Next() {
		habit, err := scanHabit(habitRows)
		if err != nil {
			habitRows.Close()
			return HabitMatrix{}, err
		}
		matrix.Habits = append(matrix.Habits, habit)
	}
	if err := habitRows.Err(); err != nil {
		habitRows.Close()
		return HabitMatrix{}, err
	}
	habitRows.Close()

	logRows, err := model.pool.Query(ctx, `
		SELECT habit_id, logged_date::text, value::float8
		FROM habit_logs
		WHERE user_id = $1 AND logged_date BETWEEN $2::date AND $3::date
		ORDER BY logged_date, habit_id
	`, userID, start, end)
	if err != nil {
		return HabitMatrix{}, err
	}
	defer logRows.Close()

	for logRows.Next() {
		var log HabitMatrixLog
		if err := logRows.Scan(&log.HabitID, &log.LoggedDate, &log.Value); err != nil {
			return HabitMatrix{}, err
		}
		matrix.Logs = append(matrix.Logs, log)
	}
	if err := logRows.Err(); err != nil {
		return HabitMatrix{}, err
	}

	return matrix, nil
}

func (model HabitModel) SeedDefaults(ctx context.Context, userID string) error {
	categories := map[string]string{}
	defaultCategoryNames := []string{
		"Exercise", "Learning", "Health",
		"Communication", "Deep Work", "Digital Health", "Technical",
	}
	for _, name := range defaultCategoryNames {
		category, err := model.CreateCategory(ctx, CreateHabitCategoryParams{UserID: userID, Name: name})
		if err != nil {
			return err
		}
		categories[name] = category.ID
	}

	defaults := defaultHabits(categories)
	for _, habit := range defaults {
		if _, err := model.CreateHabit(ctx, habit.withUser(userID)); err != nil {
			return err
		}
	}
	return nil
}

func (model HabitModel) attachTodayLogs(ctx context.Context, habits []Habit) ([]Habit, error) {
	if len(habits) == 0 {
		return habits, nil
	}

	habitIDs := make([]string, 0, len(habits))
	indexByID := make(map[string]int)
	for index, habit := range habits {
		habitIDs = append(habitIDs, habit.ID)
		indexByID[habit.ID] = index
	}

	rows, err := model.pool.Query(ctx, `
		SELECT id, user_id, habit_id, logged_date::text, value::float8, note, created_at, updated_at
		FROM habit_logs
		WHERE habit_id = ANY($1) AND logged_date = CURRENT_DATE
	`, habitIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		log, err := scanHabitLog(rows)
		if err != nil {
			return nil, err
		}
		index, ok := indexByID[log.HabitID]
		if ok {
			habits[index].TodayLog = &log
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return model.attachStreaks(ctx, habits, indexByID)
}

func (model HabitModel) attachStreaks(ctx context.Context, habits []Habit, indexByID map[string]int) ([]Habit, error) {
	habitIDs := make([]string, 0, len(habits))
	for _, h := range habits {
		habitIDs = append(habitIDs, h.ID)
	}

	rows, err := model.pool.Query(ctx, `
		SELECT habit_id, logged_date::text, value::float8
		FROM habit_logs
		WHERE habit_id = ANY($1) AND logged_date >= CURRENT_DATE - 89
		ORDER BY habit_id, logged_date
	`, habitIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type entry struct {
		date  string
		value float64
	}
	grouped := make(map[string][]entry)
	for rows.Next() {
		var habitID, date string
		var value float64
		if err := rows.Scan(&habitID, &date, &value); err != nil {
			return nil, err
		}
		grouped[habitID] = append(grouped[habitID], entry{date, value})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	for _, h := range habits {
		days := make([]HabitDayStatus, 0, 90)
		start := time.Now().AddDate(0, 0, -89)
		entries := grouped[h.ID]
		entryIndex := 0
		for i := 0; i < 90; i++ {
			date := start.AddDate(0, 0, i).Format("2006-01-02")
			var value float64
			if entryIndex < len(entries) && entries[entryIndex].date == date {
				value = entries[entryIndex].value
				entryIndex++
			}
			days = append(days, HabitDayStatus{
				Date:      date,
				Value:     value,
				Completed: habitCompleted(h, value),
				Scheduled: habitScheduledOn(h, date),
			})
		}
		h.CurrentStreak = currentStreak(days)
		h.LongestStreak = longestStreak(days)
		if idx, ok := indexByID[h.ID]; ok {
			habits[idx].CurrentStreak = h.CurrentStreak
			habits[idx].LongestStreak = h.LongestStreak
		}
	}

	return habits, nil
}

func (model HabitModel) habitDayStatuses(ctx context.Context, habit Habit, days int) ([]HabitDayStatus, error) {
	rows, err := model.pool.Query(ctx, `
		SELECT logged_date::text, value::float8
		FROM habit_logs
		WHERE habit_id = $1 AND logged_date >= CURRENT_DATE - ($2::int - 1)
		ORDER BY logged_date
	`, habit.ID, days)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	values := make(map[string]float64)
	for rows.Next() {
		var date string
		var value float64
		if err := rows.Scan(&date, &value); err != nil {
			return nil, err
		}
		values[date] = value
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	result := make([]HabitDayStatus, 0, days)
	start := time.Now().AddDate(0, 0, -(days - 1))
	for index := 0; index < days; index++ {
		date := start.AddDate(0, 0, index).Format("2006-01-02")
		value := values[date]
		result = append(result, HabitDayStatus{
			Date:      date,
			Value:     value,
			Completed: habitCompleted(habit, value),
			Scheduled: habitScheduledOn(habit, date),
		})
	}

	return result, nil
}

// habitScheduledOn reports whether a habit is scheduled on a given date.
// Daily habits are scheduled every day. Weekday-restricted (weekly) habits are
// scheduled only on weekdays in frequency_days (1=Monday .. 7=Sunday).
func habitScheduledOn(habit Habit, date string) bool {
	if habit.FrequencyType != HabitFrequencyWeekly {
		return true
	}
	parsed, err := time.Parse("2006-01-02", date)
	if err != nil {
		return true
	}
	weekday := int(parsed.Weekday())
	if weekday == 0 {
		weekday = 7
	}
	for _, day := range habit.FrequencyDays {
		if day == weekday {
			return true
		}
	}
	return false
}

type habitScanner interface {
	Scan(dest ...interface{}) error
}

func scanHabit(scanner habitScanner) (Habit, error) {
	var habit Habit
	var targetValue pgtype.Numeric
	var targetValueMax pgtype.Numeric
	var targetUnit *string
	var frequencyDays []int32

	err := scanner.Scan(
		&habit.ID,
		&habit.UserID,
		&habit.CategoryID,
		&habit.CategoryName,
		&habit.Name,
		&habit.Icon,
		&habit.Description,
		&habit.Type,
		&targetValue,
		&targetValueMax,
		&habit.ComparisonOperator,
		&targetUnit,
		&habit.FrequencyType,
		&frequencyDays,
		&habit.WeeklyGoal,
		&habit.SortOrder,
		&habit.CreatedAt,
		&habit.UpdatedAt,
	)
	if err != nil {
		return Habit{}, err
	}

	if targetValue.Valid {
		value, err := targetValue.Float64Value()
		if err == nil && value.Valid {
			habit.TargetValue = &value.Float64
		}
	}
	if targetValueMax.Valid {
		value, err := targetValueMax.Float64Value()
		if err == nil && value.Valid {
			habit.TargetValueMax = &value.Float64
		}
	}
	habit.TargetUnit = targetUnit
	habit.FrequencyDays = make([]int, 0, len(frequencyDays))
	for _, value := range frequencyDays {
		habit.FrequencyDays = append(habit.FrequencyDays, int(value))
	}

	return habit, nil
}

func scanHabitLog(scanner habitScanner) (HabitLog, error) {
	var log HabitLog
	err := scanner.Scan(&log.ID, &log.UserID, &log.HabitID, &log.LoggedDate, &log.Value, &log.Note, &log.CreatedAt, &log.UpdatedAt)
	if err != nil {
		return HabitLog{}, err
	}
	return log, nil
}

func habitCompleted(habit Habit, value float64) bool {
	if habit.Type == HabitTypeBoolean {
		return value >= 1
	}
	if habit.TargetValue == nil {
		return value > 0
	}
	switch habit.ComparisonOperator {
	case HabitComparisonLTE:
		return value <= *habit.TargetValue
	case HabitComparisonEQ:
		return value == *habit.TargetValue
	case HabitComparisonBetween:
		if habit.TargetValueMax == nil {
			return false
		}
		return value >= *habit.TargetValue && value <= *habit.TargetValueMax
	default:
		return value >= *habit.TargetValue
	}
}

func completionRate(days []HabitDayStatus) float64 {
	completed := 0
	scheduled := 0
	for _, day := range days {
		if !day.Scheduled {
			continue
		}
		scheduled++
		if day.Completed {
			completed++
		}
	}
	if scheduled == 0 {
		return 0
	}
	return math.Round((float64(completed)/float64(scheduled))*1000) / 10
}

func currentStreak(days []HabitDayStatus) int {
	streak := 0
	for index := len(days) - 1; index >= 0; index-- {
		if !days[index].Scheduled {
			continue
		}
		if !days[index].Completed {
			break
		}
		streak++
	}
	return streak
}

func longestStreak(days []HabitDayStatus) int {
	longest := 0
	current := 0
	for _, day := range days {
		if !day.Scheduled {
			continue
		}
		if day.Completed {
			current++
			if current > longest {
				longest = current
			}
		} else {
			current = 0
		}
	}
	return longest
}

func bestWeek(days []HabitDayStatus) int {
	best := 0
	for index := 0; index < len(days); index += 7 {
		end := index + 7
		if end > len(days) {
			end = len(days)
		}
		completed := 0
		scheduled := 0
		for _, day := range days[index:end] {
			if !day.Scheduled {
				continue
			}
			scheduled++
			if day.Completed {
				completed++
			}
		}
		if scheduled == 0 {
			continue
		}
		weekRate := int(math.Round((float64(completed) / float64(scheduled)) * 100))
		if weekRate > best {
			best = weekRate
		}
	}
	return best
}

type defaultHabit struct {
	categoryID    string
	name          string
	icon          string
	description   string
	habitType     HabitType
	targetValue   *float64
	targetUnit    *string
	frequencyType HabitFrequencyType
	frequencyDays []int
	weeklyGoal    int
	sortOrder     int
}

func (habit defaultHabit) withUser(userID string) CreateHabitParams {
	var icon *string
	if habit.icon != "" {
		icon = &habit.icon
	}
	return CreateHabitParams{
		UserID:        userID,
		CategoryID:    habit.categoryID,
		Name:          habit.name,
		Icon:          icon,
		Description:   habit.description,
		Type:          habit.habitType,
		TargetValue:   habit.targetValue,
		TargetUnit:    habit.targetUnit,
		FrequencyType: habit.frequencyType,
		FrequencyDays: habit.frequencyDays,
		WeeklyGoal:    habit.weeklyGoal,
		SortOrder:     habit.sortOrder,
	}
}

func defaultHabits(categories map[string]string) []defaultHabit {
	steps := 6000.0
	glasses := 8.0
	dwGoal := 3.0
	screenTimeGoal := 2.0
	stepsUnit := "steps/day"
	glassesUnit := "glasses/day"
	dwUnit := "sessions/day"
	screenTimeUnit := "hours (max 3)"
	return []defaultHabit{
		{categoryID: categories["Exercise"], name: "Steps walked", icon: "👟", habitType: HabitTypeNumeric, targetValue: &steps, targetUnit: &stepsUnit, frequencyType: HabitFrequencyDaily, weeklyGoal: 7, sortOrder: 1},
		{categoryID: categories["Health"], name: "Water intake", icon: "💧", habitType: HabitTypeNumeric, targetValue: &glasses, targetUnit: &glassesUnit, frequencyType: HabitFrequencyDaily, weeklyGoal: 7, sortOrder: 2},
		{categoryID: categories["Deep Work"], name: "Deep Work Session", icon: "🎯", habitType: HabitTypeNumeric, targetValue: &dwGoal, targetUnit: &dwUnit, frequencyType: HabitFrequencyDaily, weeklyGoal: 7, sortOrder: 3},
		{categoryID: categories["Communication"], name: "Formal Vocabulary", icon: "🗣️", habitType: HabitTypeBoolean, frequencyType: HabitFrequencyDaily, weeklyGoal: 7, sortOrder: 4},
		{categoryID: categories["Communication"], name: "Interview & Intro Prep", icon: "🤝", habitType: HabitTypeBoolean, frequencyType: HabitFrequencyDaily, weeklyGoal: 7, sortOrder: 5},
		{categoryID: categories["Technical"], name: "Commit to Side Project", icon: "💻", habitType: HabitTypeBoolean, frequencyType: HabitFrequencyDaily, weeklyGoal: 7, sortOrder: 6},
		{categoryID: categories["Digital Health"], name: "Posture & Ergonomics", icon: "🧍", habitType: HabitTypeBoolean, frequencyType: HabitFrequencyDaily, weeklyGoal: 7, sortOrder: 7},
		{categoryID: categories["Digital Health"], name: "Eye Rest (20-20-20)", icon: "👀", habitType: HabitTypeBoolean, frequencyType: HabitFrequencyDaily, weeklyGoal: 7, sortOrder: 8},
		{categoryID: categories["Digital Health"], name: "Less Instagram / Screen Time", icon: "📵", habitType: HabitTypeNumeric, targetValue: &screenTimeGoal, targetUnit: &screenTimeUnit, frequencyType: HabitFrequencyDaily, weeklyGoal: 7, sortOrder: 9},
		{categoryID: categories["Technical"], name: "Read Tech Blog/Paper", icon: "📰", habitType: HabitTypeBoolean, frequencyType: HabitFrequencyDaily, weeklyGoal: 7, sortOrder: 10},
		{categoryID: categories["Exercise"], name: "Gym", icon: "💪", habitType: HabitTypeBoolean, frequencyType: HabitFrequencyWeekly, frequencyDays: []int{1, 2, 3, 4, 5, 6, 7}, weeklyGoal: 4, sortOrder: 11},
		{categoryID: categories["Learning"], name: "Read", icon: "📚", habitType: HabitTypeBoolean, frequencyType: HabitFrequencyDaily, weeklyGoal: 7, sortOrder: 12},
		{categoryID: categories["Health"], name: "Sleep by midnight", icon: "😴", habitType: HabitTypeBoolean, frequencyType: HabitFrequencyDaily, weeklyGoal: 7, sortOrder: 13},
	}
}
