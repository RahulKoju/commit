package models

import "errors"

var ErrNotFound = errors.New("not found")

// ErrActiveFocusConflict is returned when a session start races another
// concurrent start and the partial unique index rejects the INSERT.
var ErrActiveFocusConflict = errors.New("an active focus session already exists")

// ErrInvalidState is returned when an operation targets a session whose
// current status does not permit it (e.g. resuming a running session).
var ErrInvalidState = errors.New("focus session is not in the required state")
