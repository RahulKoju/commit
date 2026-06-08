package models

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Flashcard struct {
	ID           string    `json:"id"`
	UserID       string    `json:"user_id"`
	TopicID      *string   `json:"topic_id"`
	TopicName    string    `json:"topic_name"`
	Front        string    `json:"front"`
	Back         string    `json:"back"`
	EaseFactor   float64   `json:"ease_factor"`
	IntervalDays int       `json:"interval_days"`
	Repetitions  int       `json:"repetitions"`
	NextReviewAt time.Time `json:"next_review_at"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type CreateFlashcardParams struct {
	UserID  string
	TopicID string
	Front   string
	Back    string
}

type UpdateFlashcardParams struct {
	UserID  string
	ID      string
	TopicID string
	Front   string
	Back    string
}

type ReviewFlashcardParams struct {
	UserID       string
	ID           string
	EaseFactor   float64
	IntervalDays int
	Repetitions  int
	NextReviewAt time.Time
}

type ListFlashcardsParams struct {
	UserID string
	Limit  int
	Offset int
	TopicID string
}

type FlashcardModel struct {
	pool *pgxpool.Pool
}

func NewFlashcardModel(pool *pgxpool.Pool) FlashcardModel {
	return FlashcardModel{pool: pool}
}

func (model FlashcardModel) List(ctx context.Context, params ListFlashcardsParams) ([]Flashcard, error) {
	rows, err := model.pool.Query(ctx, `
		SELECT f.id, f.user_id, f.topic_id, COALESCE(t.name, ''), f.front, f.back, f.ease_factor, f.interval_days, f.repetitions, f.next_review_at, f.created_at, f.updated_at
		FROM flashcards f
		LEFT JOIN topics t ON t.id = f.topic_id
		WHERE f.user_id = $1
		  AND ($4 = '' OR f.topic_id = $4::uuid)
		ORDER BY f.created_at DESC
		LIMIT $2 OFFSET $3
	`, params.UserID, params.Limit, params.Offset, params.TopicID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	cards := make([]Flashcard, 0)
	for rows.Next() {
		card, err := scanFlashcard(rows)
		if err != nil {
			return nil, err
		}
		cards = append(cards, card)
	}
	return cards, rows.Err()
}

func (model FlashcardModel) Due(ctx context.Context, userID string, limit int) ([]Flashcard, error) {
	rows, err := model.pool.Query(ctx, `
		SELECT f.id, f.user_id, f.topic_id, COALESCE(t.name, ''), f.front, f.back, f.ease_factor, f.interval_days, f.repetitions, f.next_review_at, f.created_at, f.updated_at
		FROM flashcards f
		LEFT JOIN topics t ON t.id = f.topic_id
		WHERE f.user_id = $1 AND f.next_review_at <= now()
		ORDER BY f.next_review_at ASC
		LIMIT $2
	`, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	cards := make([]Flashcard, 0)
	for rows.Next() {
		card, err := scanFlashcard(rows)
		if err != nil {
			return nil, err
		}
		cards = append(cards, card)
	}
	return cards, rows.Err()
}

func (model FlashcardModel) CountDue(ctx context.Context, userID string) (int, error) {
	var count int
	err := model.pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM flashcards WHERE user_id = $1 AND next_review_at <= now()
	`, userID).Scan(&count)
	return count, err
}

func (model FlashcardModel) GetByID(ctx context.Context, userID string, id string) (Flashcard, error) {
	row := model.pool.QueryRow(ctx, `
		SELECT f.id, f.user_id, f.topic_id, COALESCE(t.name, ''), f.front, f.back, f.ease_factor, f.interval_days, f.repetitions, f.next_review_at, f.created_at, f.updated_at
		FROM flashcards f
		LEFT JOIN topics t ON t.id = f.topic_id
		WHERE f.id = $1 AND f.user_id = $2
	`, id, userID)
	return scanFlashcard(row)
}

func (model FlashcardModel) Create(ctx context.Context, params CreateFlashcardParams) (Flashcard, error) {
	row := model.pool.QueryRow(ctx, `
		INSERT INTO flashcards (user_id, topic_id, front, back)
		VALUES ($1, NULLIF($2, '')::uuid, $3, $4)
		RETURNING id, user_id, topic_id, (SELECT COALESCE(name, '') FROM topics WHERE id = $2), front, back, ease_factor, interval_days, repetitions, next_review_at, created_at, updated_at
	`, params.UserID, params.TopicID, params.Front, params.Back)

	card, err := scanFlashcard(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return Flashcard{}, ErrNotFound
	}
	return card, err
}

func (model FlashcardModel) Update(ctx context.Context, params UpdateFlashcardParams) (Flashcard, error) {
	row := model.pool.QueryRow(ctx, `
		UPDATE flashcards
		SET front = $3, back = $4, topic_id = NULLIF($5, '')::uuid, updated_at = now()
		WHERE id = $1 AND user_id = $2
		RETURNING id, user_id, topic_id, (SELECT COALESCE(name, '') FROM topics WHERE id = $5), front, back, ease_factor, interval_days, repetitions, next_review_at, created_at, updated_at
	`, params.ID, params.UserID, params.Front, params.Back, params.TopicID)

	card, err := scanFlashcard(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return Flashcard{}, ErrNotFound
	}
	return card, err
}

func (model FlashcardModel) Delete(ctx context.Context, userID string, id string) error {
	commandTag, err := model.pool.Exec(ctx, "DELETE FROM flashcards WHERE id = $1 AND user_id = $2", id, userID)
	if err != nil {
		return err
	}
	if commandTag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (model FlashcardModel) Review(ctx context.Context, params ReviewFlashcardParams) (Flashcard, error) {
	row := model.pool.QueryRow(ctx, `
		UPDATE flashcards
		SET ease_factor = $3, interval_days = $4, repetitions = $5, next_review_at = $6, updated_at = now()
		WHERE id = $1 AND user_id = $2
		RETURNING id, user_id, topic_id, COALESCE((SELECT name FROM topics WHERE id = flashcards.topic_id), ''), front, back, ease_factor, interval_days, repetitions, next_review_at, created_at, updated_at
	`, params.ID, params.UserID, params.EaseFactor, params.IntervalDays, params.Repetitions, params.NextReviewAt)

	card, err := scanFlashcard(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return Flashcard{}, ErrNotFound
	}
	return card, err
}

type flashcardScanner interface {
	Scan(dest ...interface{}) error
}

func scanFlashcard(scanner flashcardScanner) (Flashcard, error) {
	var card Flashcard
	var topicID pgtype.UUID

	err := scanner.Scan(
		&card.ID,
		&card.UserID,
		&topicID,
		&card.TopicName,
		&card.Front,
		&card.Back,
		&card.EaseFactor,
		&card.IntervalDays,
		&card.Repetitions,
		&card.NextReviewAt,
		&card.CreatedAt,
		&card.UpdatedAt,
	)
	if err != nil {
		return Flashcard{}, err
	}

	if topicID.Valid {
		value := formatUUID(topicID.Bytes)
		card.TopicID = &value
	}

	return card, nil
}
