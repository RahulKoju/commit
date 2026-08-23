package models

import (
	"context"
	"errors"
	"math"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ActiveFocusSession is the server-side, resumable state of an in-progress
// focus session (work or break). Elapsed time is tracked as accumulated
// active seconds (elapsed_seconds) plus the current running segment's start
// (segment_started_at, NULL while paused): total = elapsed_seconds + (now -
// segment_started_at) when running, elapsed_seconds when paused.
type ActiveFocusSession struct {
	ID                    string     `json:"id"`
	UserID                string     `json:"user_id"`
	TaskID                *string    `json:"task_id"`
	TaskTitle             string     `json:"task_title"`
	SessionType           string     `json:"session_type"`
	Status                string     `json:"status"`
	ElapsedSeconds        int        `json:"elapsed_seconds"`
	PlannedDurationSeconds *int      `json:"planned_duration_seconds"`
	SegmentStartedAt      *time.Time `json:"segment_started_at"`
	HeartbeatAt           time.Time  `json:"heartbeat_at"`
	StartedAt             time.Time  `json:"started_at"`
	Message               string     `json:"message"`
	Tags                  []string   `json:"tags"`
	CompletedAt           *time.Time `json:"completed_at"`
	CreatedAt             time.Time  `json:"created_at"`
	UpdatedAt             time.Time  `json:"updated_at"`
}

const ActiveFocusStatusRunning = "running"
const ActiveFocusStatusPaused = "paused"
const ActiveFocusStatusCompleted = "completed"
const ActiveFocusStatusDiscarded = "discarded"

type StartActiveFocusParams struct {
	UserID                string
	TaskID                string
	SessionType           string
	PlannedDurationSeconds *int
	Tags                  []string
	Message               string
}

type ActiveFocusModel struct {
	pool *pgxpool.Pool
}

func NewActiveFocusModel(pool *pgxpool.Pool) ActiveFocusModel {
	return ActiveFocusModel{pool: pool}
}

const activeFocusSelect = `
	SELECT afs.id, afs.user_id, afs.task_id, COALESCE(t.title, ''), afs.session_type, afs.status,
	       afs.elapsed_seconds, afs.planned_duration_seconds, afs.segment_started_at, afs.heartbeat_at,
	       afs.started_at, afs.message, afs.tags, afs.completed_at, afs.created_at, afs.updated_at
	FROM active_focus_sessions afs
	LEFT JOIN tasks t ON t.id = afs.task_id`

// GetActive returns the user's active (running or paused) session, or nil.
func (model ActiveFocusModel) GetActive(ctx context.Context, userID string) (*ActiveFocusSession, error) {
	row := model.pool.QueryRow(ctx, activeFocusSelect+`
		WHERE afs.user_id = $1 AND afs.status IN ($2, $3)
	`, userID, ActiveFocusStatusRunning, ActiveFocusStatusPaused)

	session, err := scanActiveFocusSession(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &session, nil
}

// GetByID returns any-status session owned by the user, for ownership checks.
func (model ActiveFocusModel) GetByID(ctx context.Context, userID string, id string) (*ActiveFocusSession, error) {
	row := model.pool.QueryRow(ctx, activeFocusSelect+`
		WHERE afs.user_id = $1 AND afs.id = $2
	`, userID, id)

	session, err := scanActiveFocusSession(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &session, nil
}

// Start creates a running session. The partial unique index
// uq_active_focus_one_per_user is the source of truth for the single-active
// invariant: a concurrent start that races the app-level pre-check violates it
// and is surfaced as ErrActiveFocusConflict.
func (model ActiveFocusModel) Start(ctx context.Context, params StartActiveFocusParams) (*ActiveFocusSession, error) {
	var id string
	err := model.pool.QueryRow(ctx, `
		INSERT INTO active_focus_sessions (user_id, task_id, session_type, planned_duration_seconds, tags, message, segment_started_at, started_at)
		VALUES ($1, $2, $3, $4, $5, $6, now(), now())
		RETURNING id
	`, params.UserID, nilIfEmpty(params.TaskID), params.SessionType, params.PlannedDurationSeconds, params.Tags, params.Message).Scan(&id)
	if isUniqueViolation(err) {
		return nil, ErrActiveFocusConflict
	}
	if err != nil {
		return nil, err
	}
	return model.GetByID(ctx, params.UserID, id)
}

// Pause folds the open running segment into elapsed_seconds and marks the
// session paused. Idempotent for an already-paused session.
func (model ActiveFocusModel) Pause(ctx context.Context, userID string, id string, now time.Time) (*ActiveFocusSession, error) {
	_, err := model.pool.Exec(ctx, `
		UPDATE active_focus_sessions
		SET elapsed_seconds = elapsed_seconds + COALESCE(EXTRACT(EPOCH FROM ($3::timestamptz - segment_started_at))::int, 0),
		    segment_started_at = NULL,
		    status = 'paused',
		    updated_at = now()
		WHERE user_id = $1 AND id = $2 AND status = 'running'
	`, userID, id, now)
	if err != nil {
		return nil, err
	}
	return model.GetByID(ctx, userID, id)
}

// Resume re-opens the running segment for a paused session.
func (model ActiveFocusModel) Resume(ctx context.Context, userID string, id string, now time.Time) (*ActiveFocusSession, error) {
	tag, err := model.pool.Exec(ctx, `
		UPDATE active_focus_sessions
		SET segment_started_at = $3,
		    heartbeat_at = $3,
		    status = 'running',
		    updated_at = now()
		WHERE user_id = $1 AND id = $2 AND status = 'paused'
	`, userID, id, now)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, ErrInvalidState
	}
	return model.GetByID(ctx, userID, id)
}

// Heartbeat refreshes the liveness timestamp of a running session.
func (model ActiveFocusModel) Heartbeat(ctx context.Context, userID string, id string, now time.Time) error {
	tag, err := model.pool.Exec(ctx, `
		UPDATE active_focus_sessions
		SET heartbeat_at = $3
		WHERE user_id = $1 AND id = $2 AND status = 'running'
	`, userID, id, now)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrInvalidState
	}
	return nil
}

// Discard folds the open segment and marks the session discarded. A discarded
// session is never folded into focus_sessions and never counted in stats or
// the habit check-in.
func (model ActiveFocusModel) Discard(ctx context.Context, userID string, id string, now time.Time) (*ActiveFocusSession, error) {
	_, err := model.pool.Exec(ctx, `
		UPDATE active_focus_sessions
		SET elapsed_seconds = elapsed_seconds + COALESCE(EXTRACT(EPOCH FROM ($3::timestamptz - segment_started_at))::int, 0),
		    segment_started_at = NULL,
		    status = 'discarded',
		    updated_at = now()
		WHERE user_id = $1 AND id = $2 AND status IN ('running', 'paused')
	`, userID, id, now)
	if err != nil {
		return nil, err
	}
	return model.GetByID(ctx, userID, id)
}

// Complete folds the open segment into elapsed_seconds and, for work
// sessions, inserts a completed row into focus_sessions (with tags and the
// habit check-in) in the same transaction — so stats and the "Focused study"
// habit only ever count completed sessions.
func (model ActiveFocusModel) Complete(ctx context.Context, params CompleteActiveFocusParams) (*ActiveFocusSession, error) {
	tx, err := model.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	row := tx.QueryRow(ctx, activeFocusSelect+`
		WHERE afs.user_id = $1 AND afs.id = $2
		FOR UPDATE OF afs
	`, params.UserID, params.SessionID)
	session, err := scanActiveFocusSession(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if session.Status != ActiveFocusStatusRunning && session.Status != ActiveFocusStatusPaused {
		return nil, ErrInvalidState
	}

	elapsed := activeElapsedSeconds(session, params.Now)

	if session.SessionType == "work" {
		if session.TaskID == nil {
			return nil, ErrInvalidState
		}
		var focusID string
		err = tx.QueryRow(ctx, `
			INSERT INTO focus_sessions (user_id, task_id, start_time, duration_minutes)
			VALUES ($1, $2, $3, $4)
			RETURNING id
		`, session.UserID, *session.TaskID, session.StartedAt, activeDurationMinutes(elapsed)).Scan(&focusID)
		if err != nil {
			return nil, err
		}

		if err := replaceFocusSessionTags(ctx, tx, focusID, session.Tags); err != nil {
			return nil, err
		}
		if err := autoCheckFocusedStudy(ctx, tx, session.UserID, session.StartedAt, params.FocusDailyMinimumMinute); err != nil {
			return nil, err
		}
	}

	now := params.Now
	_, err = tx.Exec(ctx, `
		UPDATE active_focus_sessions
		SET elapsed_seconds = $3,
		    segment_started_at = NULL,
		    status = 'completed',
		    completed_at = $4,
		    updated_at = now()
		WHERE user_id = $1 AND id = $2
	`, session.UserID, session.ID, elapsed, now)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	session.ElapsedSeconds = elapsed
	session.SegmentStartedAt = nil
	session.Status = ActiveFocusStatusCompleted
	session.CompletedAt = &now
	session.UpdatedAt = now
	return &session, nil
}

type CompleteActiveFocusParams struct {
	UserID                  string
	SessionID               string
	Now                     time.Time
	FocusDailyMinimumMinute int
}

// AutoExpireStale runs the heartbeat scheduler's two transitions in one tick:
//  1. auto-pause any running session whose heartbeat is older than
//     runningGrace, folding its open segment first (handles tab-closing when
//     the sendBeacon pause never arrived);
//  2. auto-discard any paused session untouched (updated_at — the last real
//     state change) for longer than pausedGrace, freeing the single-active slot.
func (model ActiveFocusModel) AutoExpireStale(ctx context.Context, now time.Time, runningGrace time.Duration, pausedGrace time.Duration) error {
	_, err := model.pool.Exec(ctx, `
		UPDATE active_focus_sessions
		SET elapsed_seconds = elapsed_seconds + COALESCE(EXTRACT(EPOCH FROM ($1::timestamptz - segment_started_at))::int, 0),
		    segment_started_at = NULL,
		    status = 'paused',
		    updated_at = now()
		WHERE status = 'running' AND heartbeat_at < $2
	`, now, now.Add(-runningGrace))
	if err != nil {
		return err
	}

	_, err = model.pool.Exec(ctx, `
		UPDATE active_focus_sessions
		SET status = 'discarded',
		    segment_started_at = NULL,
		    updated_at = now()
		WHERE status = 'paused' AND updated_at < $1::timestamptz
	`, now.Add(-pausedGrace))
	return err
}

func activeElapsedSeconds(session ActiveFocusSession, now time.Time) int {
	if session.SegmentStartedAt != nil {
		return session.ElapsedSeconds + int(now.Sub(*session.SegmentStartedAt).Seconds())
	}
	return session.ElapsedSeconds
}

// activeDurationMinutes rounds elapsed seconds up to whole minutes for the
// completed focus_sessions row, flooring at 1 to satisfy the CHECK constraint.
func activeDurationMinutes(elapsedSeconds int) int {
	return int(math.Max(1, math.Ceil(float64(elapsedSeconds)/60)))
}

func nilIfEmpty(value string) interface{} {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	return value
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

func scanActiveFocusSession(scanner interface{ Scan(dest ...interface{}) error }) (ActiveFocusSession, error) {
	var session ActiveFocusSession
	err := scanner.Scan(
		&session.ID,
		&session.UserID,
		&session.TaskID,
		&session.TaskTitle,
		&session.SessionType,
		&session.Status,
		&session.ElapsedSeconds,
		&session.PlannedDurationSeconds,
		&session.SegmentStartedAt,
		&session.HeartbeatAt,
		&session.StartedAt,
		&session.Message,
		&session.Tags,
		&session.CompletedAt,
		&session.CreatedAt,
		&session.UpdatedAt,
	)
	if err != nil {
		return ActiveFocusSession{}, err
	}
	return session, nil
}