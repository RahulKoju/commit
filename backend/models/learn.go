package models

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Topic struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type LearnEntry struct {
	ID              string    `json:"id"`
	UserID          string    `json:"user_id"`
	TopicID         string    `json:"topic_id"`
	TopicName       string    `json:"topic_name"`
	DurationMinutes int       `json:"duration_minutes"`
	Confidence      int       `json:"confidence"`
	Note            string    `json:"note"`
	StudiedAt       time.Time `json:"studied_at"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type WeakSpot struct {
	TopicID           string    `json:"topic_id"`
	TopicName         string    `json:"topic_name"`
	AverageConfidence float64   `json:"average_confidence"`
	LastStudiedAt     time.Time `json:"last_studied_at"`
}

type TopicStats struct {
	TopicID           string    `json:"topic_id"`
	TopicName         string    `json:"topic_name"`
	TotalMinutes      int       `json:"total_minutes"`
	AverageConfidence float64   `json:"average_confidence"`
	LastStudiedAt     time.Time `json:"last_studied_at"`
}

type StudyDay struct {
	Date         string `json:"date"`
	TotalMinutes int    `json:"total_minutes"`
}

type CreateTopicParams struct {
	UserID string
	Name   string
}

type CreateLearnEntryParams struct {
	UserID          string
	TopicID         string
	DurationMinutes int
	Confidence      int
	Note            string
	StudiedAt       time.Time
}

type UpdateTopicParams struct {
	UserID string
	ID     string
	Name   string
}

type UpdateLearnEntryParams struct {
	UserID          string
	ID              string
	TopicID         string
	DurationMinutes int
	Confidence      int
	Note            string
	StudiedAt       time.Time
}

type LearnModel struct {
	pool *pgxpool.Pool
}

func NewLearnModel(pool *pgxpool.Pool) LearnModel {
	return LearnModel{pool: pool}
}

func (model LearnModel) ListTopics(ctx context.Context, userID string) ([]Topic, error) {
	rows, err := model.pool.Query(ctx, `
		SELECT id, user_id, name, created_at, updated_at
		FROM topics
		WHERE user_id = $1
		ORDER BY lower(name)
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	topics := make([]Topic, 0)
	for rows.Next() {
		var topic Topic
		if err := rows.Scan(&topic.ID, &topic.UserID, &topic.Name, &topic.CreatedAt, &topic.UpdatedAt); err != nil {
			return nil, err
		}
		topics = append(topics, topic)
	}

	return topics, rows.Err()
}

func (model LearnModel) CreateTopic(ctx context.Context, params CreateTopicParams) (Topic, error) {
	var topic Topic
	err := model.pool.QueryRow(ctx, `
		INSERT INTO topics (user_id, name)
		VALUES ($1, $2)
		ON CONFLICT (user_id, name) DO UPDATE SET updated_at = now()
		RETURNING id, user_id, name, created_at, updated_at
	`, params.UserID, params.Name).Scan(&topic.ID, &topic.UserID, &topic.Name, &topic.CreatedAt, &topic.UpdatedAt)
	return topic, err
}

func (model LearnModel) GetTopicByID(ctx context.Context, userID string, id string) (Topic, error) {
	var topic Topic
	err := model.pool.QueryRow(ctx, `
		SELECT id, user_id, name, created_at, updated_at
		FROM topics
		WHERE user_id = $1 AND id = $2
	`, userID, id).Scan(&topic.ID, &topic.UserID, &topic.Name, &topic.CreatedAt, &topic.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return Topic{}, ErrNotFound
	}
	return topic, err
}

func (model LearnModel) UpdateTopic(ctx context.Context, params UpdateTopicParams) (Topic, error) {
	var topic Topic
	err := model.pool.QueryRow(ctx, `
		UPDATE topics
		SET name = $3, updated_at = now()
		WHERE user_id = $1 AND id = $2
		RETURNING id, user_id, name, created_at, updated_at
	`, params.UserID, params.ID, params.Name).Scan(&topic.ID, &topic.UserID, &topic.Name, &topic.CreatedAt, &topic.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return Topic{}, ErrNotFound
	}
	return topic, err
}

func (model LearnModel) DeleteTopic(ctx context.Context, userID string, id string) error {
	commandTag, err := model.pool.Exec(ctx, "DELETE FROM topics WHERE user_id = $1 AND id = $2", userID, id)
	if err != nil {
		return err
	}
	if commandTag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (model LearnModel) ListEntries(ctx context.Context, userID string) ([]LearnEntry, error) {
	rows, err := model.pool.Query(ctx, `
		SELECT le.id, le.user_id, le.topic_id, t.name, le.duration_minutes, le.confidence, le.note, le.studied_at, le.created_at, le.updated_at
		FROM learn_entries le
		INNER JOIN topics t ON t.id = le.topic_id AND t.user_id = le.user_id
		WHERE le.user_id = $1
		ORDER BY le.studied_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	entries := make([]LearnEntry, 0)
	for rows.Next() {
		entry, err := scanLearnEntry(rows)
		if err != nil {
			return nil, err
		}
		entries = append(entries, entry)
	}

	return entries, rows.Err()
}

func (model LearnModel) CreateEntry(ctx context.Context, params CreateLearnEntryParams) (LearnEntry, error) {
	row := model.pool.QueryRow(ctx, `
		INSERT INTO learn_entries (user_id, topic_id, duration_minutes, confidence, note, studied_at)
		SELECT $1, t.id, $3, $4, $5, $6
		FROM topics t
		WHERE t.user_id = $1 AND t.id = $2
		RETURNING id, user_id, topic_id, (SELECT name FROM topics WHERE id = $2), duration_minutes, confidence, note, studied_at, created_at, updated_at
	`, params.UserID, params.TopicID, params.DurationMinutes, params.Confidence, params.Note, params.StudiedAt)

	entry, err := scanLearnEntry(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return LearnEntry{}, ErrNotFound
	}
	return entry, err
}

func (model LearnModel) GetEntryByID(ctx context.Context, userID string, id string) (LearnEntry, error) {
	row := model.pool.QueryRow(ctx, `
		SELECT le.id, le.user_id, le.topic_id, t.name, le.duration_minutes, le.confidence, le.note, le.studied_at, le.created_at, le.updated_at
		FROM learn_entries le
		INNER JOIN topics t ON t.id = le.topic_id AND t.user_id = le.user_id
		WHERE le.user_id = $1 AND le.id = $2
	`, userID, id)

	entry, err := scanLearnEntry(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return LearnEntry{}, ErrNotFound
	}
	return entry, err
}

func (model LearnModel) UpdateEntry(ctx context.Context, params UpdateLearnEntryParams) (LearnEntry, error) {
	row := model.pool.QueryRow(ctx, `
		UPDATE learn_entries le
		SET topic_id = t.id,
		    duration_minutes = $4,
		    confidence = $5,
		    note = $6,
		    studied_at = $7,
		    updated_at = now()
		FROM topics t
		WHERE le.user_id = $1 AND le.id = $2 AND t.user_id = $1 AND t.id = $3
		RETURNING le.id, le.user_id, le.topic_id, t.name, le.duration_minutes, le.confidence, le.note, le.studied_at, le.created_at, le.updated_at
	`, params.UserID, params.ID, params.TopicID, params.DurationMinutes, params.Confidence, params.Note, params.StudiedAt)

	entry, err := scanLearnEntry(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return LearnEntry{}, ErrNotFound
	}
	return entry, err
}

func (model LearnModel) DeleteEntry(ctx context.Context, userID string, id string) error {
	commandTag, err := model.pool.Exec(ctx, "DELETE FROM learn_entries WHERE user_id = $1 AND id = $2", userID, id)
	if err != nil {
		return err
	}
	if commandTag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (model LearnModel) WeakSpots(ctx context.Context, userID string) ([]WeakSpot, error) {
	rows, err := model.pool.Query(ctx, `
		SELECT t.id, t.name, AVG(le.confidence)::float8, MAX(le.studied_at)
		FROM topics t
		INNER JOIN learn_entries le ON le.topic_id = t.id AND le.user_id = t.user_id
		WHERE t.user_id = $1
		GROUP BY t.id, t.name
		HAVING AVG(le.confidence) < 3
		ORDER BY MAX(le.studied_at) ASC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	spots := make([]WeakSpot, 0)
	for rows.Next() {
		var spot WeakSpot
		if err := rows.Scan(&spot.TopicID, &spot.TopicName, &spot.AverageConfidence, &spot.LastStudiedAt); err != nil {
			return nil, err
		}
		spots = append(spots, spot)
	}

	return spots, rows.Err()
}

func (model LearnModel) TopicStats(ctx context.Context, userID string) ([]TopicStats, error) {
	rows, err := model.pool.Query(ctx, `
		SELECT t.id, t.name, COALESCE(SUM(le.duration_minutes), 0)::int, COALESCE(AVG(le.confidence), 0)::float8, COALESCE(MAX(le.studied_at), t.created_at)
		FROM topics t
		LEFT JOIN learn_entries le ON le.topic_id = t.id AND le.user_id = t.user_id
		WHERE t.user_id = $1
		GROUP BY t.id, t.name, t.created_at
		ORDER BY t.name
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	stats := make([]TopicStats, 0)
	for rows.Next() {
		var item TopicStats
		if err := rows.Scan(&item.TopicID, &item.TopicName, &item.TotalMinutes, &item.AverageConfidence, &item.LastStudiedAt); err != nil {
			return nil, err
		}
		stats = append(stats, item)
	}

	return stats, rows.Err()
}

func (model LearnModel) StudyDays(ctx context.Context, userID string) ([]StudyDay, error) {
	rows, err := model.pool.Query(ctx, `
		SELECT studied_at::date::text, SUM(duration_minutes)::int
		FROM learn_entries
		WHERE user_id = $1 AND studied_at >= CURRENT_DATE - INTERVAL '180 days'
		GROUP BY studied_at::date
		ORDER BY studied_at::date
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	days := make([]StudyDay, 0)
	for rows.Next() {
		var day StudyDay
		if err := rows.Scan(&day.Date, &day.TotalMinutes); err != nil {
			return nil, err
		}
		days = append(days, day)
	}

	return days, rows.Err()
}

func (model LearnModel) StudyStreak(ctx context.Context, userID string) (int, error) {
	days, err := model.StudyDays(ctx, userID)
	if err != nil {
		return 0, err
	}

	studied := make(map[string]bool)
	for _, day := range days {
		studied[day.Date] = true
	}

	streak := 0
	current := time.Now().Format("2006-01-02")
	if !studied[current] {
		current = time.Now().AddDate(0, 0, -1).Format("2006-01-02")
	}

	for {
		if !studied[current] {
			break
		}
		streak++
		parsed, err := time.Parse("2006-01-02", current)
		if err != nil {
			return streak, nil
		}
		current = parsed.AddDate(0, 0, -1).Format("2006-01-02")
	}

	return streak, nil
}

func scanLearnEntry(scanner taskScanner) (LearnEntry, error) {
	var entry LearnEntry
	err := scanner.Scan(
		&entry.ID,
		&entry.UserID,
		&entry.TopicID,
		&entry.TopicName,
		&entry.DurationMinutes,
		&entry.Confidence,
		&entry.Note,
		&entry.StudiedAt,
		&entry.CreatedAt,
		&entry.UpdatedAt,
	)
	if err != nil {
		return LearnEntry{}, err
	}
	return entry, nil
}
