package models

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type NoteTopic struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type Note struct {
	ID        string      `json:"id"`
	UserID    string      `json:"user_id"`
	Title     string      `json:"title"`
	Body      string      `json:"body"`
	Topics    []NoteTopic `json:"topics"`
	CreatedAt time.Time   `json:"created_at"`
	UpdatedAt time.Time   `json:"updated_at"`
}

type ListNotesParams struct {
	UserID string
	Search string
}

type CreateNoteParams struct {
	UserID   string
	Title    string
	Body     string
	TopicIDs []string
}

type UpdateNoteParams struct {
	UserID   string
	ID       string
	Title    string
	Body     string
	TopicIDs []string
}

type NoteModel struct {
	pool *pgxpool.Pool
}

func NewNoteModel(pool *pgxpool.Pool) NoteModel {
	return NoteModel{pool: pool}
}

func (model NoteModel) List(ctx context.Context, params ListNotesParams) ([]Note, error) {
	rows, err := model.pool.Query(ctx, `
		SELECT id, user_id, title, body, created_at, updated_at
		FROM notes
		WHERE user_id = $1
		  AND ($2 = '' OR search_vector @@ websearch_to_tsquery('english', $2))
		ORDER BY updated_at DESC
	`, params.UserID, params.Search)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	notes := make([]Note, 0)
	for rows.Next() {
		note, err := scanNoteWithoutTopics(rows)
		if err != nil {
			return nil, err
		}
		notes = append(notes, note)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return model.attachTopics(ctx, notes)
}

func (model NoteModel) GetByID(ctx context.Context, userID string, id string) (Note, error) {
	row := model.pool.QueryRow(ctx, `
		SELECT id, user_id, title, body, created_at, updated_at
		FROM notes
		WHERE user_id = $1 AND id = $2
	`, userID, id)

	note, err := scanNoteWithoutTopics(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return Note{}, ErrNotFound
	}
	if err != nil {
		return Note{}, err
	}

	notes, err := model.attachTopics(ctx, []Note{note})
	if err != nil {
		return Note{}, err
	}
	if len(notes) == 0 {
		return Note{}, ErrNotFound
	}
	return notes[0], nil
}

func (model NoteModel) Create(ctx context.Context, params CreateNoteParams) (Note, error) {
	tx, err := model.pool.Begin(ctx)
	if err != nil {
		return Note{}, err
	}
	defer tx.Rollback(ctx)

	row := tx.QueryRow(ctx, `
		INSERT INTO notes (user_id, title, body)
		VALUES ($1, $2, $3)
		RETURNING id, user_id, title, body, created_at, updated_at
	`, params.UserID, params.Title, params.Body)

	note, err := scanNoteWithoutTopics(row)
	if err != nil {
		return Note{}, err
	}
	if err := replaceNoteTopics(ctx, tx, params.UserID, note.ID, params.TopicIDs); err != nil {
		return Note{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Note{}, err
	}

	return model.GetByID(ctx, params.UserID, note.ID)
}

func (model NoteModel) Update(ctx context.Context, params UpdateNoteParams) (Note, error) {
	tx, err := model.pool.Begin(ctx)
	if err != nil {
		return Note{}, err
	}
	defer tx.Rollback(ctx)

	row := tx.QueryRow(ctx, `
		UPDATE notes
		SET title = $3, body = $4, updated_at = now()
		WHERE user_id = $1 AND id = $2
		RETURNING id, user_id, title, body, created_at, updated_at
	`, params.UserID, params.ID, params.Title, params.Body)

	note, err := scanNoteWithoutTopics(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return Note{}, ErrNotFound
	}
	if err != nil {
		return Note{}, err
	}
	if err := replaceNoteTopics(ctx, tx, params.UserID, note.ID, params.TopicIDs); err != nil {
		return Note{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Note{}, err
	}

	return model.GetByID(ctx, params.UserID, note.ID)
}

func (model NoteModel) Delete(ctx context.Context, userID string, id string) error {
	commandTag, err := model.pool.Exec(ctx, "DELETE FROM notes WHERE user_id = $1 AND id = $2", userID, id)
	if err != nil {
		return err
	}
	if commandTag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (model NoteModel) attachTopics(ctx context.Context, notes []Note) ([]Note, error) {
	if len(notes) == 0 {
		return notes, nil
	}

	noteIDs := make([]string, 0, len(notes))
	noteIndex := make(map[string]int)
	for index, note := range notes {
		noteIDs = append(noteIDs, note.ID)
		noteIndex[note.ID] = index
		notes[index].Topics = make([]NoteTopic, 0)
	}

	rows, err := model.pool.Query(ctx, `
		SELECT nt.note_id, t.id, t.name
		FROM note_topics nt
		INNER JOIN topics t ON t.id = nt.topic_id
		WHERE nt.note_id = ANY($1)
		ORDER BY lower(t.name)
	`, noteIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var noteID string
		var topic NoteTopic
		if err := rows.Scan(&noteID, &topic.ID, &topic.Name); err != nil {
			return nil, err
		}
		index, ok := noteIndex[noteID]
		if ok {
			notes[index].Topics = append(notes[index].Topics, topic)
		}
	}

	return notes, rows.Err()
}

type noteScanner interface {
	Scan(dest ...interface{}) error
}

func scanNoteWithoutTopics(scanner noteScanner) (Note, error) {
	var note Note
	err := scanner.Scan(&note.ID, &note.UserID, &note.Title, &note.Body, &note.CreatedAt, &note.UpdatedAt)
	if err != nil {
		return Note{}, err
	}
	return note, nil
}

func replaceNoteTopics(ctx context.Context, tx pgx.Tx, userID string, noteID string, topicIDs []string) error {
	if _, err := tx.Exec(ctx, "DELETE FROM note_topics WHERE note_id = $1", noteID); err != nil {
		return err
	}

	for _, topicID := range topicIDs {
		commandTag, err := tx.Exec(ctx, `
			INSERT INTO note_topics (note_id, topic_id)
			SELECT $1, t.id
			FROM topics t
			WHERE t.user_id = $2 AND t.id = $3
			ON CONFLICT DO NOTHING
		`, noteID, userID, topicID)
		if err != nil {
			return err
		}
		if commandTag.RowsAffected() == 0 {
			return ErrNotFound
		}
	}

	return nil
}
