package models

import "errors"

var ErrNotFound = errors.New("not found")

// ErrActiveFocusConflict is returned when a session start races another
// concurrent start and the partial unique index rejects the INSERT.
var ErrActiveFocusConflict = errors.New("an active focus session already exists")

// ErrInvalidState is returned when an operation targets a session whose
// current status does not permit it (e.g. resuming a running session).
var ErrInvalidState = errors.New("focus session is not in the required state")

// ErrHabitNotScheduled is returned when a habit log is written for a date whose
// weekday is outside the habit's frequency_days (weekday-restricted habits).
var ErrHabitNotScheduled = errors.New("habit is not scheduled on this date")

// ErrReorderMismatch is returned when a habit reorder request's ID list does
// not exactly match the user's current non-deleted habit IDs.
var ErrReorderMismatch = errors.New("reorder list does not match current habits")
