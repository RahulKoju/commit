package models

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Reminder struct {
	ID          string     `json:"id"`
	NoteID      string     `json:"note_id"`
	UserID      string     `json:"user_id"`
	UserEmail   string     `json:"user_email,omitempty"`
	NoteTitle   string     `json:"note_title"`
	Type        string     `json:"type"`
	NextFireAt  time.Time  `json:"next_fire_at"`
	Cron        *string    `json:"cron"`
	Message     string     `json:"message"`
	IsActive    bool       `json:"is_active"`
	LastFiredAt *time.Time `json:"last_fired_at"`
	DoneAt      *time.Time `json:"done_at"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

type CreateReminderParams struct {
	UserID     string
	NoteID     string
	Type       string
	NextFireAt time.Time
	Cron       *string
	Message    string
}

type UpdateReminderParams struct {
	UserID     string
	ID         string
	NextFireAt *time.Time
	Cron       *string
	Message    *string
	IsActive   *bool
}

type ReminderModel struct {
	pool *pgxpool.Pool
}

const reminderSelectColumns = `r.id, r.note_id, r.user_id, u.email, n.title,
	r.type, r.next_fire_at, r.cron, r.message,
	r.is_active, r.last_fired_at, r.done_at, r.created_at, r.updated_at`

func NewReminderModel(pool *pgxpool.Pool) ReminderModel {
	return ReminderModel{pool: pool}
}

func (model ReminderModel) ListByNote(ctx context.Context, userID string, noteID string) ([]Reminder, error) {
	rows, err := model.pool.Query(ctx, `
		SELECT `+reminderSelectColumns+`
		FROM reminders r
		INNER JOIN notes n ON n.id = r.note_id AND n.user_id = r.user_id
		INNER JOIN users u ON u.id = r.user_id
		WHERE r.user_id = $1 AND r.note_id = $2
		ORDER BY r.next_fire_at ASC
	`, userID, noteID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	reminders := make([]Reminder, 0)
	for rows.Next() {
		reminder, err := scanReminder(rows)
		if err != nil {
			return nil, err
		}
		reminders = append(reminders, reminder)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return reminders, nil
}

func (model ReminderModel) GetByID(ctx context.Context, userID string, id string) (Reminder, error) {
	row := model.pool.QueryRow(ctx, `
		SELECT `+reminderSelectColumns+`
		FROM reminders r
		INNER JOIN notes n ON n.id = r.note_id AND n.user_id = r.user_id
		INNER JOIN users u ON u.id = r.user_id
		WHERE r.user_id = $1 AND r.id = $2
	`, userID, id)

	reminder, err := scanReminder(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return Reminder{}, ErrNotFound
	}
	if err != nil {
		return Reminder{}, err
	}
	return reminder, nil
}

func (model ReminderModel) Create(ctx context.Context, params CreateReminderParams) (Reminder, error) {
	row := model.pool.QueryRow(ctx, `
		INSERT INTO reminders (user_id, note_id, type, next_fire_at, cron, message)
		SELECT $1, $2, $3, $4, $5, $6
		FROM notes
		WHERE notes.user_id = $1 AND notes.id = $2
		RETURNING id, note_id, user_id, (SELECT email FROM users WHERE id = $1),
		          (SELECT title FROM notes WHERE id = $2),
		          type, next_fire_at, cron, message,
		          is_active, last_fired_at, done_at, created_at, updated_at
	`, params.UserID, params.NoteID, params.Type, params.NextFireAt, params.Cron, params.Message)

	reminder, err := scanReminder(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return Reminder{}, ErrNotFound
	}
	if err != nil {
		return Reminder{}, err
	}
	return reminder, nil
}

func (model ReminderModel) Update(ctx context.Context, params UpdateReminderParams) (Reminder, error) {
	row := model.pool.QueryRow(ctx, `
		UPDATE reminders r
		SET next_fire_at = COALESCE($3, r.next_fire_at),
		    cron = CASE WHEN $4::boolean THEN $5 ELSE COALESCE($5, r.cron) END,
		    message = COALESCE($6, r.message),
		    is_active = COALESCE($7, r.is_active),
		    updated_at = now()
		WHERE r.user_id = $1 AND r.id = $2
		RETURNING r.id, r.note_id, r.user_id, (SELECT email FROM users WHERE id = r.user_id),
		          (SELECT title FROM notes WHERE id = r.note_id),
		          r.type, r.next_fire_at, r.cron, r.message,
		          r.is_active, r.last_fired_at, r.done_at, r.created_at, r.updated_at
	`, params.UserID, params.ID, params.NextFireAt,
		params.Cron != nil, params.Cron,
		params.Message,
		params.IsActive,
	)

	reminder, err := scanReminder(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return Reminder{}, ErrNotFound
	}
	if err != nil {
		return Reminder{}, err
	}
	return reminder, nil
}

func (model ReminderModel) Delete(ctx context.Context, userID string, id string) error {
	commandTag, err := model.pool.Exec(ctx, "DELETE FROM reminders WHERE user_id = $1 AND id = $2", userID, id)
	if err != nil {
		return err
	}
	if commandTag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// DueInWindow returns reminders that fired after the given "since" checkpoint,
// for the authenticated user. Both active (recurring, re-scheduled forward) and
// deactivated one_time reminders surface, so the browser can notify on one-time
// fires too; the `since` watermark (last_fired_at) prevents re-notifying on old
// ones across reconnects. user_id is bound in SQL, never derived from the body.
func (model ReminderModel) DueInWindow(ctx context.Context, userID string, since time.Time, limit int) ([]Reminder, error) {
	rows, err := model.pool.Query(ctx, `
		SELECT `+reminderSelectColumns+`
		FROM reminders r
		INNER JOIN notes n ON n.id = r.note_id AND n.user_id = r.user_id
		INNER JOIN users u ON u.id = r.user_id
		WHERE r.user_id = $1
		  AND r.last_fired_at > $2
		ORDER BY r.last_fired_at ASC
		LIMIT $3
	`, userID, since, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	reminders := make([]Reminder, 0)
	for rows.Next() {
		reminder, err := scanReminder(rows)
		if err != nil {
			return nil, err
		}
		reminders = append(reminders, reminder)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return reminders, nil
}

// ClaimDue atomically claims up to limit due reminders so a slow email send on
// one tick cannot cause a double-fire on the next tick.
//
// Because Postgres cannot evaluate the cron library, the claim + reschedule is
// NOT a single SQL UPDATE. Instead the whole operation runs inside a
// transaction that holds FOR UPDATE SKIP LOCKED locks on the exact due rows:
//
//  1. SELECT the due rows FOR UPDATE SKIP LOCKED (any concurrent tick skips rows
//     we've locked, so each reminder is claimed by exactly one run),
//  2. compute each recurring reminder's next occurrence in Go (via the injected
//     computeNext callback),
//  3. UPDATE each locked row in the same transaction (set last_fired_at; advance
//     next_fire_at for recurring; deactivate + done_at for one_time),
//  4. COMMIT — so the claim, reschedule, and deactivate all commit atomically.
//
// Emails are sent by the caller AFTER this returns, using the returned rows. A
// failed send just means one missed notification; the reminder is already
// correctly rescheduled/deactivated.
func (model ReminderModel) ClaimDue(ctx context.Context, now time.Time, limit int, computeNext func(nextFireAt time.Time, cron *string) time.Time) ([]Reminder, error) {
	tx, err := model.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	rows, err := tx.Query(ctx, `
		SELECT `+reminderSelectColumns+`
		FROM reminders r
		INNER JOIN notes n ON n.id = r.note_id AND n.user_id = r.user_id
		INNER JOIN users u ON u.id = r.user_id
		WHERE r.is_active AND r.next_fire_at <= $1
		ORDER BY r.next_fire_at ASC
		LIMIT $2
		FOR UPDATE SKIP LOCKED
	`, now, limit)
	if err != nil {
		return nil, err
	}

	claimed := make([]Reminder, 0, limit)
	for rows.Next() {
		reminder, err := scanReminder(rows)
		if err != nil {
			rows.Close()
			return nil, err
		}
		claimed = append(claimed, reminder)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	for index := range claimed {
		reminder := claimed[index]
		var nextAt time.Time
		if reminder.Type == "recurring" && reminder.Cron != nil {
			nextAt = computeNext(reminder.NextFireAt, reminder.Cron)
		}
		_, err := tx.Exec(ctx, `
			UPDATE reminders r
			SET last_fired_at = $1,
			    next_fire_at = CASE WHEN r.type = 'recurring' THEN $2 ELSE r.next_fire_at END,
			    is_active = CASE WHEN r.type = 'one_time' THEN FALSE ELSE r.is_active END,
			    done_at = CASE WHEN r.type = 'one_time' THEN $1 ELSE r.done_at END,
			    updated_at = now()
			WHERE r.id = $3
		`, now, nextAt, reminder.ID)
		if err != nil {
			return nil, err
		}

		claimed[index].LastFiredAt = &now
		claimed[index].IsActive = reminder.Type == "recurring"
		if reminder.Type == "one_time" {
			claimed[index].DoneAt = &now
		} else if reminder.Cron != nil {
			claimed[index].NextFireAt = nextAt
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return claimed, nil
}

type reminderScanner interface {
	Scan(dest ...interface{}) error
}

func scanReminder(scanner reminderScanner) (Reminder, error) {
	var reminder Reminder
	err := scanner.Scan(
		&reminder.ID,
		&reminder.NoteID,
		&reminder.UserID,
		&reminder.UserEmail,
		&reminder.NoteTitle,
		&reminder.Type,
		&reminder.NextFireAt,
		&reminder.Cron,
		&reminder.Message,
		&reminder.IsActive,
		&reminder.LastFiredAt,
		&reminder.DoneAt,
		&reminder.CreatedAt,
		&reminder.UpdatedAt,
	)
	if err != nil {
		return Reminder{}, err
	}
	return reminder, nil
}
