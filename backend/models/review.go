package models

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ReviewType string

const (
	ReviewTypeWeekly  ReviewType = "weekly"
	ReviewTypeMonthly ReviewType = "monthly"
)

type Review struct {
	ID             string          `json:"id"`
	UserID         string          `json:"user_id"`
	Type           ReviewType      `json:"type"`
	PeriodStart    string          `json:"period_start"`
	PeriodEnd      string          `json:"period_end"`
	ReflectionText string          `json:"reflection_text"`
	Data           json.RawMessage `json:"data"`
	CreatedAt      time.Time       `json:"created_at"`
	UpdatedAt      time.Time       `json:"updated_at"`
}

type ListReviewsParams struct {
	UserID string
	Type   string
	Limit  int
	Offset int
}

type CreateReviewParams struct {
	UserID         string
	Type           ReviewType
	PeriodStart    string
	PeriodEnd      string
	ReflectionText string
	Data           json.RawMessage
}

type ReviewModel struct {
	pool *pgxpool.Pool
}

func NewReviewModel(pool *pgxpool.Pool) ReviewModel {
	return ReviewModel{pool: pool}
}

func (model ReviewModel) List(ctx context.Context, params ListReviewsParams) ([]Review, error) {
	rows, err := model.pool.Query(ctx, `
		SELECT id, user_id, type, period_start::text, period_end::text, reflection_text, data, created_at, updated_at
		FROM reviews
		WHERE user_id = $1 AND ($2 = '' OR type = $2)
		ORDER BY period_start DESC, created_at DESC
		LIMIT $3 OFFSET $4
	`, params.UserID, params.Type, params.Limit, params.Offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	reviews := make([]Review, 0)
	for rows.Next() {
		review, err := scanReview(rows)
		if err != nil {
			return nil, err
		}
		reviews = append(reviews, review)
	}

	return reviews, rows.Err()
}

func (model ReviewModel) CountReviews(ctx context.Context, params ListReviewsParams) (int, error) {
	var count int
	err := model.pool.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM reviews
		WHERE user_id = $1 AND ($2 = '' OR type = $2)
	`, params.UserID, params.Type).Scan(&count)
	if err != nil {
		return 0, err
	}
	return count, nil
}

func (model ReviewModel) GetByID(ctx context.Context, userID string, id string) (Review, error) {
	row := model.pool.QueryRow(ctx, `
		SELECT id, user_id, type, period_start::text, period_end::text, reflection_text, data, created_at, updated_at
		FROM reviews
		WHERE user_id = $1 AND id = $2
	`, userID, id)

	review, err := scanReview(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return Review{}, ErrNotFound
	}
	return review, err
}

func (model ReviewModel) Create(ctx context.Context, params CreateReviewParams) (Review, error) {
	row := model.pool.QueryRow(ctx, `
		INSERT INTO reviews (user_id, type, period_start, period_end, reflection_text, data)
		VALUES ($1, $2, $3::date, $4::date, $5, $6::jsonb)
		ON CONFLICT (user_id, type, period_start, period_end)
		DO UPDATE SET reflection_text = EXCLUDED.reflection_text, data = EXCLUDED.data, updated_at = now()
		RETURNING id, user_id, type, period_start::text, period_end::text, reflection_text, data, created_at, updated_at
	`, params.UserID, params.Type, params.PeriodStart, params.PeriodEnd, params.ReflectionText, string(params.Data))

	return scanReview(row)
}

func (model ReviewModel) BuildSnapshot(ctx context.Context, userID string, periodStart string, periodEnd string) (json.RawMessage, error) {
	var data json.RawMessage
	err := model.pool.QueryRow(ctx, `
		SELECT jsonb_build_object(
			'habit_hits', (
				SELECT COALESCE(jsonb_agg(jsonb_build_object(
					'habit_id', h.id,
					'habit_name', h.name,
					'category_name', c.name,
					'logged_days', COALESCE(logged.logged_days, 0),
					'completed_days', COALESCE(logged.completed_days, 0),
					'trend', 'consistent'
				) ORDER BY c.name, h.sort_order, h.name), '[]'::jsonb)
				FROM habits h
				INNER JOIN habit_categories c ON c.id = h.category_id
				LEFT JOIN LATERAL (
					SELECT COUNT(*)::int AS logged_days,
					       COUNT(*) FILTER (
					        WHERE CASE
					          WHEN h.type = 'boolean' THEN hl.value >= 1
					          WHEN h.target_value IS NULL THEN hl.value > 0
					          ELSE hl.value >= h.target_value
					        END
					       )::int AS completed_days
					FROM habit_logs hl
					WHERE hl.habit_id = h.id AND hl.logged_date BETWEEN $2::date AND $3::date
				) logged ON true
				WHERE h.user_id = $1
			),
			'tasks_completed', (
				SELECT COUNT(*)::int
				FROM tasks
				WHERE user_id = $1 AND status = 'done' AND completed_at::date BETWEEN $2::date AND $3::date
			),
			'total_study_hours', (
				SELECT ROUND((COALESCE(SUM(duration_minutes), 0)::numeric / 60), 2)
				FROM learn_entries
				WHERE user_id = $1 AND studied_at::date BETWEEN $2::date AND $3::date
			),
			'focus_sessions_count', (
				SELECT COUNT(*)::int
				FROM focus_sessions
				WHERE user_id = $1 AND start_time::date BETWEEN $2::date AND $3::date
			),
			'total_focus_hours', (
				SELECT ROUND((COALESCE(SUM(duration_minutes), 0)::numeric / 60), 2)
				FROM focus_sessions
				WHERE user_id = $1 AND start_time::date BETWEEN $2::date AND $3::date
			),
			'top_studied_topics', (
				SELECT COALESCE(jsonb_agg(jsonb_build_object(
					'topic_id', topic_id,
					'topic_name', topic_name,
					'total_minutes', total_minutes
				) ORDER BY total_minutes DESC), '[]'::jsonb)
				FROM (
					SELECT t.id AS topic_id, t.name AS topic_name, SUM(le.duration_minutes)::int AS total_minutes
					FROM learn_entries le
					INNER JOIN topics t ON t.id = le.topic_id
					WHERE le.user_id = $1 AND le.studied_at::date BETWEEN $2::date AND $3::date
					GROUP BY t.id, t.name
					ORDER BY total_minutes DESC
					LIMIT 3
				) topics
			),
			'best_habit', (
				SELECT h.name
				FROM habits h
				LEFT JOIN habit_logs hl ON hl.habit_id = h.id AND hl.logged_date BETWEEN $2::date AND $3::date
				WHERE h.user_id = $1
				GROUP BY h.id, h.name
				ORDER BY COUNT(*) FILTER (WHERE hl.value > 0) DESC, h.name
				LIMIT 1
			),
			'most_missed_habit', (
				SELECT h.name
				FROM habits h
				LEFT JOIN habit_logs hl ON hl.habit_id = h.id AND hl.logged_date BETWEEN $2::date AND $3::date
				WHERE h.user_id = $1
				GROUP BY h.id, h.name
				ORDER BY COUNT(*) FILTER (WHERE hl.value > 0) ASC, h.name
				LIMIT 1
			)
		)
	`, userID, periodStart, periodEnd).Scan(&data)
	return data, err
}

type reviewScanner interface {
	Scan(dest ...interface{}) error
}

func scanReview(scanner reviewScanner) (Review, error) {
	var review Review
	err := scanner.Scan(
		&review.ID,
		&review.UserID,
		&review.Type,
		&review.PeriodStart,
		&review.PeriodEnd,
		&review.ReflectionText,
		&review.Data,
		&review.CreatedAt,
		&review.UpdatedAt,
	)
	if err != nil {
		return Review{}, err
	}
	return review, nil
}
