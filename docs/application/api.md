# API Reference

Base URL: `/api/v1`

## Common

### Authentication

Auth uses an HttpOnly cookie named `commit_token` containing a signed JWT (access token). Protected endpoints require this cookie. A separate `refresh_token` cookie is used for token rotation.

| Cookie | Type | Expiry | Description |
|--------|------|--------|-------------|
| `commit_token` | HttpOnly | 24 hours | Access token JWT |
| `refresh_token` | HttpOnly | 7 days | Refresh token (rotated on use) |

On `401`, the frontend automatically calls `POST /auth/refresh` to rotate tokens and retry the request.

### Pagination

List endpoints support pagination via query parameters:

| Param | Type | Default | Max | Description |
|-------|------|---------|-----|-------------|
| `limit` | int | 20 | 100 | Items per page |
| `offset` | int | 0 | — | Items to skip |

### Error Response

```json
{ "error": "Human-readable message" }
```

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 204 | Deleted (no body) |
| 400 | Bad request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not found |
| 409 | Conflict |
| 429 | Rate limited |
| 500 | Internal error |

---

## Health Check

Public — no auth required.

```
GET /healthz
```

Response `200`:
```json
{ "status": "ok", "version": "1.0.0" }
```

---

## Auth

### Register

Rate-limited: 3 req/min/IP.

```
POST /auth/register
```

Request:
```json
{
  "email": "string",
  "password": "string (min 8 chars)",
  "name": "string"
}
```

Response `201`:
```json
{
  "user": { "id": "uuid", "email": "string", "name": "string", "role": "user", "created_at": "rfc3339", "updated_at": "rfc3339" }
}
```

Sets `commit_token` and `refresh_token` cookies. Seeds 12 default habits across 7 categories for the new user.

### Login

Rate-limited: 5 req/min/IP.

```
POST /auth/login
```

Request:
```json
{
  "email": "string",
  "password": "string"
}
```

Response `200`:
```json
{
  "user": { "id": "uuid", "email": "string", "name": "string", "role": "user", "created_at": "rfc3339", "updated_at": "rfc3339" }
}
```

Sets `commit_token` and `refresh_token` cookies.

### Logout

```
POST /auth/logout
```

Response `200`:
```json
{ "ok": true }
```

Clears cookies and revokes refresh tokens.

### Refresh Token

```
POST /auth/refresh
```

Reads `refresh_token` cookie, validates and rotates it.

Response `200`:
```json
{ "ok": true }
```

Updates both cookies with new tokens.

### Get Current User

Protected.

```
GET /auth/me
```

Response `200`:
```json
{
  "user": { "id": "uuid", "email": "string", "name": "string", "role": "string", "created_at": "rfc3339", "updated_at": "rfc3339" }
}
```

### Forgot Password

Rate-limited: 3 req/min/IP.

```
POST /auth/forgot-password
```

Request:
```json
{ "email": "string" }
```

Response `200`:
```json
{ "ok": true }
```

Sends reset email via Resend (or logs to stdout in dev). Returns generic response regardless of whether email exists.

### Reset Password

```
POST /auth/reset-password
```

Request:
```json
{
  "token": "string (from email link)",
  "password": "string (min 8 chars)"
}
```

Response `200`:
```json
{ "ok": true }
```

Token is SHA-256 hashed for lookup. Tokens expire after 1 hour and are single-use. Resetting revokes all existing refresh tokens for the user.

---

## Dashboard

Protected.

### Summary

```
GET /dashboard/summary
```

Response `200`:
```json
{
  "summary": {
    "today": "date",
    "task_summary": { "total": "int", "done": "int" },
    "habit_summary": { "total": "int", "checked": "int" },
    "recent_notes": [{ "id": "uuid", "title": "string", "updated_at": "rfc3339" }],
    "weekly_habit_chart": [{ "date": "date", "total": "int", "checked": "int" }],
    "weekly_productivity": [{ "date": "date", "tasks_done": "int", "focus_minutes": "int", "notes_created": "int", "reminders_created": "int" }],
    "week_comparison": {
      "tasks_done_this_week": "int", "tasks_done_last_week": "int",
      "habits_checked_this_week": "int", "habits_checked_last_week": "int",
      "focus_minutes_this_week": "int", "focus_minutes_last_week": "int"
    },
    "active_focus_session": { "id": "uuid", "task_id": "uuid", "task_title": "string", "start_time": "rfc3339", "duration_minutes": "int" } | null
  }
}
```

Habit counts (`habit_summary`, `weekly_habit_chart`) are weekday-aware: only habits scheduled on that date count toward `total`/`checked`.

### Activity Heatmap

```
GET /dashboard/activity-heatmap?year=YYYY
```

Query parameters:

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `year` | int | current year (Asia/Kathmandu) | Calendar year to render; must be between 1970 and 2100, otherwise `400` |

Returns a full calendar year (Jan 1 – Dec 31) of GitHub-style contribution-graph data: habit completions plus overall activity. Days after today within the current year — and days before the account was created in past years — are included with zero counts so the grid always covers the whole year.

Both heatmaps use relative intensity levels computed from quantile boundaries (p20/p40/p60/p80) over the user's own non-zero history, recomputed per request. Level `0` = none/low through `4` = highest.

Response `200`:
```json
{
  "year": "int",
  "earliest_year": "int",
  "habit_heatmap": [{ "date": "date", "total": "int", "completed": "int", "level": "int (0-4)" }],
  "activity_heatmap": [{ "date": "date", "points": "int", "level": "int (0-4)" }]
}
```

`activity_heatmap` points aggregate tasks (≤10/day), focus minutes (÷30, ≤240), notes (≤5), and reminders (≤5), capped per source so no single activity dominates.

### Get Widget Layout

```
GET /dashboard/layout
```

Response `200`:
```json
{
  "layout": [{ "id": "string", "order": "int" }]
}
```

### Save Widget Layout

```
PATCH /dashboard/layout
```

Request:
```json
{
  "layout": [{ "id": "string", "order": "int" }]
}
```

Response `200`:
```json
{ "ok": true }
```

---

## Tasks

Protected.

### List Tasks

```
GET /tasks
```

Query parameters:

| Param | Type | Description |
|-------|------|-------------|
| `view` | string | `today` (default), `active`, `backlog`, `completed`, or `all` |
| `priority` | string | `low`, `medium`, `high` (optional) |
| `status` | string | `todo`, `in-progress`, `done` (optional) |
| `limit` | int | Pagination (default 20, max 100) |
| `offset` | int | Pagination (default 0) |

View presets:
- `today` — scheduled_date is set and <= today, status != done (overdue tasks included)
- `active` — status != done regardless of date
- `backlog` — no scheduled_date, status != done
- `completed` — status = done
- `all` — no filter

`priority` and `status` apply as extra filters within any view; an invalid `view` value returns `400`.

Response `200`:
```json
{
  "tasks": [{
    "id": "uuid", "user_id": "uuid",
    "title": "string", "description": "string",
    "priority": "low | medium | high",
    "scheduled_date": "date | null",
    "status": "todo | in-progress | done",
    "recurrence_rule": "daily | weekdays | weekly | monthly | null",
    "estimated_minutes": "int | null",
    "completed_at": "rfc3339 | null",
    "created_at": "rfc3339", "updated_at": "rfc3339"
  }]
}
```

### Create Task

```
POST /tasks
```

Request:
```json
{
  "title": "string",
  "description": "string (optional)",
  "priority": "low | medium | high (optional)",
  "scheduled_date": "date (optional)",
  "status": "todo | in-progress | done (optional)",
  "recurrence_rule": "daily | weekdays | weekly | monthly (optional)",
  "estimated_minutes": "int (optional)"
}
```

Response `201`: `{ "task": { "...Task" } }`

### Update Task

```
PATCH /tasks/:id
```

Request: same fields as Create (all optional).

If status is set to `done` and the task has a `recurrence_rule`, the server auto-creates the next occurrence with status `todo`.

Response `200`: `{ "task": { "...Task" } }`

### Delete Task

```
DELETE /tasks/:id
```

Response `204 No Content`.

---

## Focus Sessions

Protected.

Focus sessions are **persistent and resumable**: while a session is in progress it lives in `active_focus_sessions` server-side (one active session per user, enforced by a partial unique index). The client ticks locally and reconciles against the server; state survives page refreshes and device switches.

### Active Session Lifecycle

| Endpoint | Purpose |
|----------|---------|
| `POST /focus/sessions/start` | Create a running session |
| `POST /focus/sessions/pause` | Pause the active session |
| `POST /focus/sessions/resume` | Resume a paused session |
| `POST /focus/sessions/heartbeat` | Keep-alive while running (client sends every 20s) |
| `POST /focus/sessions/complete` | Complete the session (persists to history; work sessions may auto-log a "Focused study" habit) |
| `POST /focus/sessions/discard` | Discard without recording |

### Start Session

```
POST /focus/sessions/start
```

Request:
```json
{
  "session_type": "work | short_break | long_break",
  "task_id": "uuid (optional)",
  "planned_duration_seconds": "int (optional — null/omitted means stopwatch mode)",
  "tags": ["string (optional)"],
  "message": "string (optional)"
}
```

Response `201`: `{ "session": { "...ActiveFocusSession" } }`

If an active session already exists (including a concurrent start from another tab/device), returns `409` with the existing session instead of creating one. Returns `404` if `task_id` does not exist.

### Pause / Resume / Complete / Discard

```
POST /focus/sessions/pause
POST /focus/sessions/resume
POST /focus/sessions/complete
POST /focus/sessions/discard
```

Request:
```json
{ "session_id": "uuid" }
```

(`pause` also accepts `session_id` as plain text or multipart form so it can be sent via `navigator.sendBeacon` on tab close.)

Response `200`: `{ "session": { "...ActiveFocusSession" } }`

Completing a `work` session records it in focus history and auto-logs a "Focused study" habit inside the same transaction when total daily focus minutes >= `FOCUS_DAILY_MINIMUM_MINUTES`.

### Heartbeat

```
POST /focus/sessions/heartbeat
```

Request: `{ "session_id": "uuid" }`. Response: `204 No Content`.

A background scheduler auto-pauses sessions whose heartbeat is stale by more than 3 minutes and auto-discards paused sessions untouched for 24 hours.

### Get Active Session

```
GET /focus/active
```

Returns the user's current running/paused session (or `null`) so clients can reconstruct timer state on load.

Response `200`: `{ "session": { "...ActiveFocusSession" } | null }`

### ActiveFocusSession

```json
{
  "id": "uuid", "user_id": "uuid",
  "task_id": "uuid | null", "task_title": "string",
  "session_type": "work | short_break | long_break",
  "status": "running | paused | completed | discarded",
  "elapsed_seconds": "int",
  "planned_duration_seconds": "int | null",
  "segment_started_at": "rfc3339 | null",
  "heartbeat_at": "rfc3339",
  "started_at": "rfc3339",
  "message": "string",
  "tags": ["string"],
  "completed_at": "rfc3339 | null",
  "created_at": "rfc3339", "updated_at": "rfc3339"
}
```

### List Sessions

Completed sessions (history).

```
GET /focus/sessions
```

Query parameters:

| Param | Type | Description |
|-------|------|-------------|
| `date_from` | date | Start date filter (optional) |
| `date_to` | date | End date filter (optional) |
| `limit` | int | Pagination (default 20, max 100) |
| `offset` | int | Pagination (default 0) |

Response `200`:
```json
{
  "sessions": [{
    "id": "uuid", "user_id": "uuid",
    "task_id": "uuid", "task_title": "string",
    "tags": ["string"],
    "start_time": "rfc3339", "duration_minutes": "int",
    "created_at": "rfc3339"
  }]
}
```

### Focus Stats

```
GET /focus/stats
```

Response `200`:
```json
{
  "stats": {
    "total_sessions": "int",
    "total_minutes": "int",
    "average_minutes": "float",
    "current_week_minutes": "int",
    "last_week_minutes": "int",
    "longest_session": "int",
    "session_days": "int"
  }
}
```

---

## Notes

Protected.

### List Notes

```
GET /notes
```

Query parameters:

| Param | Type | Description |
|-------|------|-------------|
| `search` | string | Full-text search query (optional, uses PostgreSQL `websearch_to_tsquery`) |
| `limit` | int | Pagination (default 20, max 100) |
| `offset` | int | Pagination (default 0) |

Full-text search uses `search_vector` (tsvector with weight A on title, weight B on body).

Response `200`:
```json
{
  "notes": [{
    "id": "uuid", "user_id": "uuid",
    "title": "string", "body": "string",
    "created_at": "rfc3339", "updated_at": "rfc3339"
  }]
}
```

### Create Note

```
POST /notes
```

Auto-parses `[[Wiki Link]]` syntax in body to create backlinks.

Request:
```json
{
  "title": "string",
  "body": "string (optional)"
}
```

Response `201`: `{ "note": { "...Note" } }`

### Update Note

```
PATCH /notes/:id
```

Re-parses wiki-links in body on update.

Request: partial of Create fields.

Response `200`: `{ "note": { "...Note" } }`

### Delete Note

```
DELETE /notes/:id
```

Response `204 No Content`.

### Note Backlinks

```
GET /notes/:id/backlinks
```

Returns all notes that link to this note via `[[Note Title]]` syntax.

Response `200`:
```json
{
  "backlinks": [{ "id": "uuid", "title": "string", "updated_at": "rfc3339" }]
}
```

---

## Reminders

Protected. Reminders are attached to notes and delivered by a background scheduler (email via Resend) plus browser notification polling.

### Reminder object

```json
{
  "id": "uuid", "note_id": "uuid", "user_id": "uuid",
  "user_email": "string",
  "note_title": "string",
  "type": "one_time | recurring",
  "next_fire_at": "rfc3339",
  "cron": "string | null (5-field cron, recurring only)",
  "message": "string",
  "is_active": "bool",
  "last_fired_at": "rfc3339 | null",
  "done_at": "rfc3339 | null",
  "created_at": "rfc3339", "updated_at": "rfc3339"
}
```

Recurrence is evaluated in the Asia/Kathmandu timezone.

### List Reminders for Note

```
GET /notes/:id/reminders
```

Response `200`: `{ "reminders": [{ "...Reminder" }] }`

### Create Reminder

```
POST /notes/:id/reminders
```

Returns `404` if the note does not belong to the authenticated user.

Request:
```json
{
  "type": "one_time | recurring",
  "fire_at": "rfc3339 (required for one_time)",
  "cron": "string (required for recurring, 5-field cron expression)",
  "message": "string (optional)"
}
```

The server computes `next_fire_at`: `fire_at` for one-time reminders, or the next cron occurrence for recurring ones. Invalid type/cron combinations return `400`.

Response `201`: `{ "reminder": { "...Reminder" } }`

### Update Reminder

```
PATCH /notes/:id/reminders/:reminderId
```

Request (at least one field required):
```json
{
  "cron": "string (optional)",
  "message": "string | null (optional)",
  "is_active": "bool (optional)"
}
```

Supplying a new `cron` re-validates it and recomputes `next_fire_at`. Clearing the cron on a recurring reminder is rejected. (`done_at` is managed by the scheduler, not this endpoint — see Due semantics below.)

Response `200`: `{ "reminder": { "...Reminder" } }`

### Delete Reminder

```
DELETE /notes/:id/reminders/:reminderId
```

Response `204 No Content`.

### Due Reminders (polling)

```
GET /reminders/due?since=RFC3339
```

Query parameters:

| Param | Type | Description |
|-------|------|-------------|
| `since` | rfc3339 | Checkpoint — returns reminders with `last_fired_at > since` (optional; defaults to all fires) |

Clients pass their last poll time as a watermark to avoid re-notifying on old fires across reconnects. Returns both active recurring and deactivated one-time reminders so one-time fires still notify. When the background scheduler fires a reminder it stamps `last_fired_at`; recurring reminders are rescheduled forward, while one-time reminders are deactivated with `done_at` set.

Response `200`: `{ "reminders": [{ "...Reminder" }] }`

---

## Habits

Protected.

### Habit Categories

#### List Categories

```
GET /habit-categories
```

Response `200`:
```json
{
  "categories": [{ "id": "uuid", "user_id": "uuid", "name": "string", "created_at": "rfc3339", "updated_at": "rfc3339" }]
}
```

#### Create Category

```
POST /habit-categories
```

Request: `{ "name": "string" }`

Response `201`: `{ "category": { "...HabitCategory" } }`

#### Update Category

```
PATCH /habit-categories/:id
```

Request: `{ "name": "string" }`

Response `200`: `{ "category": { "...HabitCategory" } }`

#### Delete Category

```
DELETE /habit-categories/:id
```

Fails with `409` if habits still reference this category (ON DELETE RESTRICT).

Response `204 No Content`.

### Habits

#### List Habits

```
GET /habits
```

Each habit includes its today log (if any), current streak, and longest streak. Streaks are schedule-aware: non-scheduled days are skipped entirely, and only a missed scheduled day breaks a streak.

Response `200`:
```json
{
  "habits": [{
    "id": "uuid", "user_id": "uuid",
    "category_id": "uuid", "category_name": "string",
    "name": "string", "description": "string", "icon": "string | null",
    "type": "boolean | numeric",
    "comparison_operator": "gte | lte | eq | between",
    "target_value": "number | null", "target_value_max": "number | null", "target_unit": "string | null",
    "frequency_type": "daily | weekly",
    "frequency_days": ["int"],
    "weekly_goal": "int",
    "sort_order": "int",
    "current_streak": "int",
    "longest_streak": "int",
    "today_log": { "id": "uuid", "value": "number", "note": "string", "logged_date": "date" } | null,
    "created_at": "rfc3339", "updated_at": "rfc3339"
  }]
}
```

#### Comparison Operators (numeric habits)

`comparison_operator` defines when a logged value counts as complete:

| Operator | Meaning | Complete when |
|----------|---------|---------------|
| `gte` (default) | At least | `value >= target_value` |
| `lte` | At most (inverse habit) | `value <= target_value` |
| `eq` | Exactly | `value == target_value` |
| `between` | Range (inverse habit) | `target_value <= value <= target_value_max` |

Inverse habits (`lte`, `between`) track limits rather than minimums — e.g. screen time at most 3 hours, or caffeine between 1–3 cups. For `between`, both `target_value` (minimum) and `target_value_max` (maximum) are required and `target_value_max > target_value` is enforced by a DB constraint. Operators only apply to numeric habits; boolean habits are complete when logged.

#### Create Habit

```
POST /habits
```

Request:
```json
{
  "category_id": "uuid",
  "name": "string",
  "icon": "string (optional)",
  "description": "string (optional)",
  "type": "boolean | numeric",
  "comparison_operator": "gte | lte | eq | between (optional, default gte)",
  "target_value": "number (optional)",
  "target_value_max": "number (optional, required for between)",
  "target_unit": "string (optional)",
  "frequency_type": "daily | weekly (optional)",
  "frequency_days": ["int (optional)"],
  "weekly_goal": "int (optional)",
  "sort_order": "int (optional)"
}
```

Returns `400` if `between` is used without both target values or with `target_value_max <= target_value`.

Response `201`: `{ "habit": { "...Habit" } }`

#### Update Habit

```
PATCH /habits/:id
```

Request: partial of Create fields.

Response `200`: `{ "habit": { "...Habit" } }`

#### Delete Habit

```
DELETE /habits/:id
```

Performs a soft delete (sets `deleted_at`).

Response `204 No Content`.

#### Reorder Habits

```
PATCH /habits/reorder
```

Atomically reassigns `sort_order` to match the given order. The ID list must exactly match the user's current non-deleted habits — same length, no duplicates, no unknown IDs — otherwise the request is rejected with `400` and nothing is modified.

Request:
```json
{
  "habit_ids": ["uuid", "uuid", "..."]
}
```

Response `400` (mismatch):
```json
{ "error": "reorder list does not match current habits" }
```

Response `200`: `{ "habits": [{ "...Habit" }] }` — full habit list in the new order.

#### Habit Matrix

```
GET /habits/matrix?start=YYYY-MM-DD&end=YYYY-MM-DD
```

Returns all habits plus their logs for an inclusive date range in one call, for rendering a date×habit matrix. Both params are required and must be valid `YYYY-MM-DD` dates.

Response `200`:
```json
{
  "habits": [{ "...Habit" }],
  "logs": [{ "habit_id": "uuid", "logged_date": "date", "value": "number" }]
}
```

#### Log Habit

```
POST /habits/:id/log
```

Upsert semantics — if a log exists for the same habit + date, it is updated. Returns `400` if the date is not scheduled for the habit's frequency (e.g. logging a weekly habit on an off-day).

Request:
```json
{
  "logged_date": "date (optional, defaults to today)",
  "value": "number",
  "note": "string (optional)"
}
```

Response `200`:
```json
{
  "log": { "id": "uuid", "user_id": "uuid", "habit_id": "uuid", "logged_date": "date", "value": "number", "note": "string", "created_at": "rfc3339", "updated_at": "rfc3339" }
}
```

#### Habit Analytics

```
GET /habits/:id/analytics
```

Response `200`:
```json
{
  "analytics": {
    "habit_id": "uuid",
    "completion_rate_30": "float",
    "completion_rate_90": "float",
    "current_streak": "int",
    "longest_streak": "int",
    "best_week": "int",
    "daily_completion": [{ "date": "date", "value": "number" }],
    "category_completion": { "category_name": { "completed": "int", "total": "int" } }
  }
}
```

#### Export CSV

```
GET /habits/export
```

Returns `text/csv` with columns: `date, habit_name, category, value, unit`.

Response `200` with `Content-Type: text/csv`.

---

## Admin

Requires `admin` role.

### List Users

```
GET /admin/users
```

Response `200`:
```json
{
  "users": [{ "id": "uuid", "email": "string", "name": "string", "role": "string", "created_at": "rfc3339", "updated_at": "rfc3339" }]
}
```

### Delete User

```
DELETE /admin/users/:id
```

Cannot delete own account.

Response `204 No Content`.
