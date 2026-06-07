package models

import (
	"context"
	"errors"
	"math"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type HabitType string
type HabitFrequencyType string

const (
	HabitTypeBoolean HabitType = "boolean"
	HabitTypeNumeric HabitType = "numeric"

	HabitFrequencyDaily  HabitFrequencyType = "daily"
	HabitFrequencyWeekly HabitFrequencyType = "weekly"
)

type HabitCategory struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Habit struct {
	ID            string             `json:"id"`
	UserID        string             `json:"user_id"`
	CategoryID    string             `json:"category_id"`
	CategoryName  string             `json:"category_name"`
	Name          string             `json:"name"`
	Description   string             `json:"description"`
	Type          HabitType          `json:"type"`
	TargetValue   *float64           `json:"target_value"`
	TargetUnit    *string            `json:"target_unit"`
	FrequencyType HabitFrequencyType `json:"frequency_type"`
	FrequencyDays []int              `json:"frequency_days"`
	WeeklyGoal    int                `json:"weekly_goal"`
	SortOrder     int                `json:"sort_order"`
	TodayLog      *HabitLog          `json:"today_log"`
	CreatedAt     time.Time          `json:"created_at"`
	UpdatedAt     time.Time          `json:"updated_at"`
}

type HabitLog struct {
	ID         string    `json:"id"`
	UserID     string    `json:"user_id"`
	HabitID    string    `json:"habit_id"`
	LoggedDate string    `json:"logged_date"`
	Value      float64   `json:"value"`
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
}

type CreateHabitCategoryParams struct {
	UserID string
	Name   string
}

type CreateHabitParams struct {
	UserID        string
	CategoryID    string
	Name          string
	Description   string
	Type          HabitType
	TargetValue   *float64
	TargetUnit    *string
	FrequencyType HabitFrequencyType
	FrequencyDays []int
	WeeklyGoal    int
	SortOrder     int
}

type UpdateHabitParams struct {
	UserID        string
	ID            string
	CategoryID    string
	Name          string
	Description   string
	Type          HabitType
	TargetValue   *float64
	TargetUnit    *string
	FrequencyType HabitFrequencyType
	FrequencyDays []int
	WeeklyGoal    int
	SortOrder     int
}

type LogHabitParams struct {
	UserID     string
	HabitID    string
	LoggedDate string
	Value      float64
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

func (model HabitModel) ListHabits(ctx context.Context, userID string) ([]Habit, error) {
	rows, err := model.pool.Query(ctx, `
		SELECT h.id, h.user_id, h.category_id, c.name, h.name, h.description, h.type, h.target_value, h.target_unit,
		       h.frequency_type, h.frequency_days, h.weekly_goal, h.sort_order, h.created_at, h.updated_at
		FROM habits h
		INNER JOIN habit_categories c ON c.id = h.category_id AND c.user_id = h.user_id
		WHERE h.user_id = $1
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
		SELECT h.id, h.user_id, h.category_id, c.name, h.name, h.description, h.type, h.target_value, h.target_unit,
		       h.frequency_type, h.frequency_days, h.weekly_goal, h.sort_order, h.created_at, h.updated_at
		FROM habits h
		INNER JOIN habit_categories c ON c.id = h.category_id AND c.user_id = h.user_id
		WHERE h.user_id = $1 AND h.id = $2
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
	row := model.pool.QueryRow(ctx, `
		INSERT INTO habits (user_id, category_id, name, description, type, target_value, target_unit, frequency_type, frequency_days, weekly_goal, sort_order)
		SELECT $1, c.id, $3, $4, $5, $6, $7, $8, $9, $10, $11
		FROM habit_categories c
		WHERE c.user_id = $1 AND c.id = $2
		ON CONFLICT (user_id, name) DO UPDATE SET updated_at = now()
		RETURNING id
	`, params.UserID, params.CategoryID, params.Name, params.Description, params.Type, params.TargetValue, params.TargetUnit, params.FrequencyType, frequencyDays, params.WeeklyGoal, params.SortOrder)

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
		    description = $4,
		    type = $5,
		    target_value = $6,
		    target_unit = $7,
		    frequency_type = $8,
		    frequency_days = $9,
		    weekly_goal = $10,
		    sort_order = $11,
		    updated_at = now()
		FROM habit_categories c
		WHERE h.user_id = $1 AND h.id = $2 AND c.user_id = $1 AND c.id = $12
		RETURNING h.id
	`, params.UserID, params.ID, params.Name, params.Description, params.Type, params.TargetValue, params.TargetUnit, params.FrequencyType, params.FrequencyDays, params.WeeklyGoal, params.SortOrder, params.CategoryID)

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
	commandTag, err := model.pool.Exec(ctx, "DELETE FROM habits WHERE user_id = $1 AND id = $2", userID, id)
	if err != nil {
		return err
	}
	if commandTag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (model HabitModel) LogHabit(ctx context.Context, params LogHabitParams) (HabitLog, error) {
	row := model.pool.QueryRow(ctx, `
		INSERT INTO habit_logs (user_id, habit_id, logged_date, value)
		SELECT $1, h.id, $3::date, $4
		FROM habits h
		WHERE h.user_id = $1 AND h.id = $2
		ON CONFLICT (habit_id, logged_date)
		DO UPDATE SET value = EXCLUDED.value, updated_at = now()
		RETURNING id, user_id, habit_id, logged_date::text, value::float8, created_at, updated_at
	`, params.UserID, params.HabitID, params.LoggedDate, params.Value)

	log, err := scanHabitLog(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return HabitLog{}, ErrNotFound
	}
	return log, err
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

func (model HabitModel) SeedDefaults(ctx context.Context, userID string) error {
	categories := map[string]string{}
	for _, name := range []string{"Exercise", "Learning", "Health"} {
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
		SELECT id, user_id, habit_id, logged_date::text, value::float8, created_at, updated_at
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

	return habits, rows.Err()
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
		})
	}

	return result, nil
}

type habitScanner interface {
	Scan(dest ...interface{}) error
}

func scanHabit(scanner habitScanner) (Habit, error) {
	var habit Habit
	var targetValue pgtype.Numeric
	var targetUnit *string
	var frequencyDays []int32

	err := scanner.Scan(
		&habit.ID,
		&habit.UserID,
		&habit.CategoryID,
		&habit.CategoryName,
		&habit.Name,
		&habit.Description,
		&habit.Type,
		&targetValue,
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
	habit.TargetUnit = targetUnit
	habit.FrequencyDays = make([]int, 0, len(frequencyDays))
	for _, value := range frequencyDays {
		habit.FrequencyDays = append(habit.FrequencyDays, int(value))
	}

	return habit, nil
}

func scanHabitLog(scanner habitScanner) (HabitLog, error) {
	var log HabitLog
	err := scanner.Scan(&log.ID, &log.UserID, &log.HabitID, &log.LoggedDate, &log.Value, &log.CreatedAt, &log.UpdatedAt)
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
	return value >= *habit.TargetValue
}

func completionRate(days []HabitDayStatus) float64 {
	if len(days) == 0 {
		return 0
	}
	completed := 0
	for _, day := range days {
		if day.Completed {
			completed++
		}
	}
	return math.Round((float64(completed)/float64(len(days)))*1000) / 10
}

func currentStreak(days []HabitDayStatus) int {
	streak := 0
	for index := len(days) - 1; index >= 0; index-- {
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
		for _, day := range days[index:end] {
			if day.Completed {
				completed++
			}
		}
		if completed > best {
			best = completed
		}
	}
	return best
}

type defaultHabit struct {
	categoryID    string
	name          string
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
	return CreateHabitParams{
		UserID:        userID,
		CategoryID:    habit.categoryID,
		Name:          habit.name,
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
	steps := 8000.0
	glasses := 8.0
	stepsUnit := "steps/day"
	glassesUnit := "glasses/day"
	return []defaultHabit{
		{categoryID: categories["Exercise"], name: "Steps walked", habitType: HabitTypeNumeric, targetValue: &steps, targetUnit: &stepsUnit, frequencyType: HabitFrequencyDaily, weeklyGoal: 7, sortOrder: 1},
		{categoryID: categories["Learning"], name: "Focused study", habitType: HabitTypeBoolean, frequencyType: HabitFrequencyDaily, weeklyGoal: 7, sortOrder: 2},
		{categoryID: categories["Health"], name: "Water intake", habitType: HabitTypeNumeric, targetValue: &glasses, targetUnit: &glassesUnit, frequencyType: HabitFrequencyDaily, weeklyGoal: 7, sortOrder: 3},
		{categoryID: categories["Learning"], name: "Touch typing AM", habitType: HabitTypeBoolean, frequencyType: HabitFrequencyDaily, weeklyGoal: 7, sortOrder: 4},
		{categoryID: categories["Learning"], name: "Touch typing PM", habitType: HabitTypeBoolean, frequencyType: HabitFrequencyDaily, weeklyGoal: 7, sortOrder: 5},
		{categoryID: categories["Exercise"], name: "Gym", habitType: HabitTypeBoolean, frequencyType: HabitFrequencyWeekly, frequencyDays: []int{1, 2, 3, 4, 5, 6, 7}, weeklyGoal: 4, sortOrder: 6},
		{categoryID: categories["Learning"], name: "Read", habitType: HabitTypeBoolean, frequencyType: HabitFrequencyDaily, weeklyGoal: 7, sortOrder: 7},
		{categoryID: categories["Health"], name: "Sleep by midnight", habitType: HabitTypeBoolean, frequencyType: HabitFrequencyDaily, weeklyGoal: 7, sortOrder: 8},
	}
}
