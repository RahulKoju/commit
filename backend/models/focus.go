package models

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type FocusSession struct {
	ID              string    `json:"id"`
	UserID          string    `json:"user_id"`
	TaskID          string    `json:"task_id"`
	TaskTitle       string    `json:"task_title"`
	TopicID         *string   `json:"topic_id"`
	Tags            []string  `json:"tags"`
	StartTime       time.Time `json:"start_time"`
	DurationMinutes int       `json:"duration_minutes"`
	CreatedAt       time.Time `json:"created_at"`
}

type FocusStats struct {
	TotalSessions      int     `json:"total_sessions"`
	TotalMinutes       int     `json:"total_minutes"`
	AverageMinutes     float64 `json:"average_minutes"`
	CurrentWeekMinutes int     `json:"current_week_minutes"`
	LastWeekMinutes    int     `json:"last_week_minutes"`
	LongestSession     int     `json:"longest_session"`
	SessionDays        int     `json:"session_days"`
}

type ListFocusSessionsParams struct {
	UserID   string
	DateFrom string
	DateTo   string
	TopicID  string
	Limit    int
	Offset   int
}

type CreateFocusSessionParams struct {
	UserID                  string
	TaskID                  string
	TopicID                 string
	Tags                    []string
	StartTime               time.Time
	DurationMinutes         int
	FocusDailyMinimumMinute int
}

type FocusModel struct {
	pool *pgxpool.Pool
}

func NewFocusModel(pool *pgxpool.Pool) FocusModel {
	return FocusModel{pool: pool}
}

func (model FocusModel) List(ctx context.Context, params ListFocusSessionsParams) ([]FocusSession, error) {
	rows, err := model.pool.Query(ctx, `
		SELECT fs.id, fs.user_id, fs.task_id, t.title, fs.topic_id, fs.start_time, fs.duration_minutes, fs.created_at
		FROM focus_sessions fs
		INNER JOIN tasks t ON t.id = fs.task_id AND t.user_id = fs.user_id
		WHERE fs.user_id = $1
		  AND ($2 = '' OR fs.start_time >= $2::date)
		  AND ($3 = '' OR fs.start_time < ($3::date + INTERVAL '1 day'))
		  AND ($4 = '' OR fs.topic_id = $4::uuid)
		ORDER BY fs.start_time DESC
		LIMIT $5 OFFSET $6
	`, params.UserID, params.DateFrom, params.DateTo, params.TopicID, params.Limit, params.Offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	sessions := make([]FocusSession, 0)
	for rows.Next() {
		session, err := scanFocusSession(rows)
		if err != nil {
			return nil, err
		}
		sessions = append(sessions, session)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return model.attachFocusTags(ctx, sessions)
}

func (model FocusModel) CountFocusSessions(ctx context.Context, params ListFocusSessionsParams) (int, error) {
	var count int
	err := model.pool.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM focus_sessions fs
		INNER JOIN tasks t ON t.id = fs.task_id AND t.user_id = fs.user_id
		WHERE fs.user_id = $1
		  AND ($2 = '' OR fs.start_time >= $2::date)
		  AND ($3 = '' OR fs.start_time < ($3::date + INTERVAL '1 day'))
		  AND ($4 = '' OR fs.topic_id = $4::uuid)
	`, params.UserID, params.DateFrom, params.DateTo, params.TopicID).Scan(&count)
	if err != nil {
		return 0, err
	}
	return count, nil
}

func (model FocusModel) Create(ctx context.Context, params CreateFocusSessionParams) (FocusSession, error) {
	tx, err := model.pool.Begin(ctx)
	if err != nil {
		return FocusSession{}, err
	}
	defer tx.Rollback(ctx)

	row := tx.QueryRow(ctx, `
		INSERT INTO focus_sessions (user_id, task_id, topic_id, start_time, duration_minutes)
		SELECT $1, t.id, COALESCE(NULLIF($3, '')::uuid, t.topic_id), $4, $5
		FROM tasks t
		WHERE t.user_id = $1 AND t.id = $2
		RETURNING id, user_id, task_id, (SELECT title FROM tasks WHERE id = $2), topic_id, start_time, duration_minutes, created_at
	`, params.UserID, params.TaskID, params.TopicID, params.StartTime, params.DurationMinutes)

	session, err := scanFocusSession(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return FocusSession{}, ErrNotFound
	}
	if err != nil {
		return FocusSession{}, err
	}

	if err := replaceFocusSessionTags(ctx, tx, session.ID, params.Tags); err != nil {
		return FocusSession{}, err
	}

	if err := model.autoCheckFocusedStudy(ctx, tx, params.UserID, session.StartTime, params.FocusDailyMinimumMinute); err != nil {
		return FocusSession{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return FocusSession{}, err
	}

	sessions, err := model.attachFocusTags(ctx, []FocusSession{session})
	if err != nil {
		return FocusSession{}, err
	}
	return sessions[0], nil
}

type focusScanner interface {
	Scan(dest ...interface{}) error
}

func (model FocusModel) autoCheckFocusedStudy(ctx context.Context, tx pgx.Tx, userID string, day time.Time, minimumMinutes int) error {
	var totalMinutes int
	err := tx.QueryRow(ctx, `
		SELECT COALESCE(SUM(duration_minutes), 0)
		FROM focus_sessions
		WHERE user_id = $1 AND start_time >= $2::date AND start_time < ($2::date + INTERVAL '1 day')
	`, userID, day).Scan(&totalMinutes)
	if err != nil {
		return err
	}
	if totalMinutes < minimumMinutes {
		return nil
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO habit_logs (user_id, habit_id, logged_date, value, note)
		SELECT $1, h.id, $2::date, 1, ''
		FROM habits h
		WHERE h.user_id = $1 AND h.name = 'Focused study' AND h.deleted_at IS NULL
		ON CONFLICT (habit_id, logged_date)
		DO UPDATE SET value = 1, updated_at = now()
	`, userID, day)
	return err
}

func scanFocusSession(scanner focusScanner) (FocusSession, error) {
	var session FocusSession
	var topicID pgtype.UUID

	err := scanner.Scan(
		&session.ID,
		&session.UserID,
		&session.TaskID,
		&session.TaskTitle,
		&topicID,
		&session.StartTime,
		&session.DurationMinutes,
		&session.CreatedAt,
	)
	if err != nil {
		return FocusSession{}, err
	}

	if topicID.Valid {
		value := formatUUID(topicID.Bytes)
		session.TopicID = &value
	}

	return session, nil
}

func (model FocusModel) attachFocusTags(ctx context.Context, sessions []FocusSession) ([]FocusSession, error) {
	if len(sessions) == 0 {
		return sessions, nil
	}

	sessionIDs := make([]string, 0, len(sessions))
	sessionIndex := make(map[string]int)
	for index, session := range sessions {
		sessionIDs = append(sessionIDs, session.ID)
		sessionIndex[session.ID] = index
		sessions[index].Tags = make([]string, 0)
	}

	rows, err := model.pool.Query(ctx, `
		SELECT session_id, tag
		FROM focus_session_tags
		WHERE session_id = ANY($1)
		ORDER BY tag
	`, sessionIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var sessionID string
		var tag string
		if err := rows.Scan(&sessionID, &tag); err != nil {
			return nil, err
		}
		index, ok := sessionIndex[sessionID]
		if ok {
			sessions[index].Tags = append(sessions[index].Tags, tag)
		}
	}

	return sessions, rows.Err()
}

func (model FocusModel) Stats(ctx context.Context, userID string) (FocusStats, error) {
	var stats FocusStats
	err := model.pool.QueryRow(ctx, `
		SELECT
			COUNT(*)::int,
			COALESCE(SUM(duration_minutes), 0)::int,
			COALESCE(ROUND(AVG(duration_minutes), 1), 0),
			COALESCE(SUM(duration_minutes) FILTER (WHERE start_time >= CURRENT_DATE - INTERVAL '6 days'), 0)::int,
			COALESCE(SUM(duration_minutes) FILTER (WHERE start_time >= CURRENT_DATE - INTERVAL '13 days' AND start_time < CURRENT_DATE - INTERVAL '6 days'), 0)::int,
			COALESCE(MAX(duration_minutes), 0)::int,
			COALESCE(COUNT(DISTINCT start_time::date), 0)::int
		FROM focus_sessions
		WHERE user_id = $1
	`, userID).Scan(
		&stats.TotalSessions,
		&stats.TotalMinutes,
		&stats.AverageMinutes,
		&stats.CurrentWeekMinutes,
		&stats.LastWeekMinutes,
		&stats.LongestSession,
		&stats.SessionDays,
	)
	return stats, err
}

func replaceFocusSessionTags(ctx context.Context, tx pgx.Tx, sessionID string, tags []string) error {
	if _, err := tx.Exec(ctx, "DELETE FROM focus_session_tags WHERE session_id = $1", sessionID); err != nil {
		return err
	}

	for _, tag := range tags {
		if _, err := tx.Exec(ctx, `
			INSERT INTO focus_session_tags (session_id, tag)
			VALUES ($1, $2)
			ON CONFLICT DO NOTHING
		`, sessionID, tag); err != nil {
			return err
		}
	}

	return nil
}
