# API Reference

Base URL: `/api/v1`

## Common

### Authentication

Auth uses an HttpOnly cookie named `commit_token` containing a signed JWT (access token). Protected endpoints require this cookie. A separate `refresh_token` cookie is used for token rotation.

| Cookie | Type | Expiry | Description |
|--------|------|--------|-------------|
| `commit_token` | HttpOnly | 15 minutes | Access token JWT |
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

Sets `commit_token` and `refresh_token` cookies. Seeds 8 default habits across 3 categories for the new user.

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
    "learning_streak": "int",
    "recent_notes": [{ "id": "uuid", "title": "string", "updated_at": "rfc3339" }],
    "weekly_habit_chart": [{ "date": "date", "total": "int", "checked": "int" }],
    "weekly_productivity": [{ "date": "date", "tasks": "int", "habits": "int", "learning_sessions": "int", "focus_minutes": "int" }],
    "week_over_week": { "tasks_done": "float", "habits_checked": "float", "study_sessions": "float", "focus_minutes": "float" },
    "active_focus_session": { "id": "uuid", "task_id": "uuid", "task_title": "string", "start_time": "rfc3339", "duration_minutes": "int" } | null
  }
}
```

### Activity Heatmap

```
GET /dashboard/activity-heatmap
```

Returns 365 days of habit completion data for a GitHub-style contribution graph.

Response `200`:
```json
{
  "heatmap": [{ "date": "date", "total": "int", "completed": "int" }]
}
```

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
| `view` | string | `today`, `backlog`, `completed`, or `all` (optional) |
| `topic_id` | uuid | Filter by topic (optional) |
| `priority` | string | `low`, `medium`, `high` (optional) |
| `status` | string | `todo`, `in-progress`, `done` (optional) |
| `limit` | int | Pagination (default 20, max 100) |
| `offset` | int | Pagination (default 0) |

View presets:
- `today` — scheduled_date <= today, status != done
- `backlog` — no scheduled_date, status != done
- `completed` — status = done
- `all` — no filter

Response `200`:
```json
{
  "tasks": [{
    "id": "uuid", "user_id": "uuid", "topic_id": "uuid | null",
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
  "topic_id": "uuid (optional)",
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

### List Sessions

```
GET /focus/sessions
```

Query parameters:

| Param | Type | Description |
|-------|------|-------------|
| `date_from` | date | Start date filter (optional) |
| `date_to` | date | End date filter (optional) |
| `topic_id` | uuid | Filter by topic (optional) |
| `limit` | int | Pagination (default 20, max 100) |
| `offset` | int | Pagination (default 0) |

Response `200`:
```json
{
  "sessions": [{
    "id": "uuid", "user_id": "uuid",
    "task_id": "uuid", "task_title": "string",
    "topic_id": "uuid | null",
    "start_time": "rfc3339", "duration_minutes": "int",
    "tags": ["string"],
    "created_at": "rfc3339"
  }]
}
```

### Create Session

```
POST /focus/sessions
```

Auto-inherits the task's `topic_id` if not specified. May auto-log a "Focused study" habit if daily total >= `FOCUS_DAILY_MINIMUM_MINUTES` (default 120).

Request:
```json
{
  "task_id": "uuid",
  "topic_id": "uuid (optional)",
  "start_time": "rfc3339 (optional, defaults to now)",
  "duration_minutes": "int",
  "tags": ["string (optional)"]
}
```

Response `201`: `{ "session": { "...FocusSession" } }`

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
    "avg_minutes": "float",
    "current_week_minutes": "int",
    "last_week_minutes": "int",
    "longest_session": "int",
    "session_days": ["date"]
  }
}
```

---

## Learning

Protected.

### List Topics

```
GET /learn/topics
```

Response `200`:
```json
{
  "topics": [{ "id": "uuid", "user_id": "uuid", "name": "string", "created_at": "rfc3339", "updated_at": "rfc3339" }]
}
```

### Create Topic

```
POST /learn/topics
```

Request: `{ "name": "string" }`

Response `201`: `{ "topic": { "...Topic" } }`

### Update Topic

```
PATCH /learn/topics/:id
```

Request: `{ "name": "string" }`

Response `200`: `{ "topic": { "...Topic" } }`

### Delete Topic

```
DELETE /learn/topics/:id
```

Response `204 No Content`.

### List Learn Entries

```
GET /learn/entries
```

Query parameters: `limit`, `offset` (standard pagination).

Response `200`:
```json
{
  "entries": [{
    "id": "uuid", "user_id": "uuid",
    "topic_id": "uuid", "topic_name": "string",
    "duration_minutes": "int", "confidence": "int (1-5)",
    "note": "string", "studied_at": "rfc3339",
    "created_at": "rfc3339", "updated_at": "rfc3339"
  }]
}
```

### Create Learn Entry

```
POST /learn/entries
```

Request:
```json
{
  "topic_id": "uuid",
  "duration_minutes": "int (> 0)",
  "confidence": "int (1-5)",
  "note": "string (optional)",
  "studied_at": "rfc3339 (optional)"
}
```

Response `201`: `{ "entry": { "...LearnEntry" } }`

### Update Learn Entry

```
PATCH /learn/entries/:id
```

Request: partial of Create fields.

Response `200`: `{ "entry": { "...LearnEntry" } }`

### Delete Learn Entry

```
DELETE /learn/entries/:id
```

Response `204 No Content`.

### Weak Spots

```
GET /learn/weakspots
```

Returns topics with average confidence < 3, sorted by least recently studied.

Response `200`:
```json
{
  "weak_spots": [{
    "topic_id": "uuid", "topic_name": "string",
    "average_confidence": "float", "last_studied_at": "rfc3339"
  }]
}
```

### Learn Summary

```
GET /learn/summary
```

Response `200`:
```json
{
  "summary": {
    "weak_spots": [],
    "topic_stats": [{ "topic_id": "uuid", "topic_name": "string", "total_minutes": "int", "avg_confidence": "float", "last_studied_at": "rfc3339" }],
    "study_days": [{ "date": "date", "total_minutes": "int" }],
    "streak": "int"
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
    "topics": [{ "id": "uuid", "name": "string" }],
    "tags": ["string"],
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
  "body": "string (optional)",
  "topic_ids": ["uuid (optional)"],
  "tags": ["string (optional)"]
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

Each habit includes its today log (if any), current streak, and longest streak.

Response `200`:
```json
{
  "habits": [{
    "id": "uuid", "user_id": "uuid",
    "category_id": "uuid", "category_name": "string",
    "name": "string", "description": "string",
    "type": "boolean | numeric",
    "target_value": "number | null", "target_unit": "string | null",
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

#### Create Habit

```
POST /habits
```

Request:
```json
{
  "category_id": "uuid",
  "name": "string",
  "description": "string (optional)",
  "type": "boolean | numeric",
  "target_value": "number (optional)",
  "target_unit": "string (optional)",
  "frequency_type": "daily | weekly (optional)",
  "frequency_days": ["int (optional)"],
  "weekly_goal": "int (optional)",
  "sort_order": "int (optional)"
}
```

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

#### Log Habit

```
POST /habits/:id/log
```

Upsert semantics — if a log exists for the same habit + date, it is updated.

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

## Reviews

Protected.

### List Reviews

```
GET /reviews
```

Query parameters:

| Param | Type | Description |
|-------|------|-------------|
| `type` | string | `weekly` or `monthly` (optional) |
| `limit` | int | Pagination (default 20, max 100) |
| `offset` | int | Pagination (default 0) |

Response `200`:
```json
{
  "reviews": [{
    "id": "uuid", "user_id": "uuid",
    "type": "weekly | monthly",
    "period_start": "date", "period_end": "date",
    "reflection_text": "string",
    "data": "jsonb",
    "created_at": "rfc3339", "updated_at": "rfc3339"
  }]
}
```

### Create Review

```
POST /reviews
```

Auto-generates a `data` snapshot (JSONB) containing habit hits/misses, tasks completed, study hours, focus stats, top topics, best/most-missed habit.

Request:
```json
{
  "type": "weekly | monthly",
  "period_start": "date (optional, auto-calculated)",
  "period_end": "date (optional, auto-calculated)",
  "reflection_text": "string (optional)"
}
```

Response `201`: `{ "review": { "...Review" } }`

### Get Review

```
GET /reviews/:id
```

Response `200`: `{ "review": { "...Review" } }`

---

## Flashcards

Protected.

### List Flashcards

```
GET /flashcards
```

Query parameters:

| Param | Type | Description |
|-------|------|-------------|
| `topic_id` | uuid | Filter by topic (optional) |
| `limit` | int | Pagination (default 20, max 100) |
| `offset` | int | Pagination (default 0) |

Response `200`:
```json
{
  "flashcards": [{
    "id": "uuid", "user_id": "uuid",
    "topic_id": "uuid | null", "topic_name": "string | null",
    "front": "string", "back": "string",
    "ease_factor": "float", "interval_days": "int",
    "repetitions": "int", "next_review_at": "rfc3339",
    "created_at": "rfc3339", "updated_at": "rfc3339"
  }]
}
```

### Due Flashcards

```
GET /flashcards/due
```

Returns cards where `next_review_at <= now()`.

Query parameters:

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | int | 20 | Max cards to return |

Response `200`: `{ "flashcards": [{ "...Flashcard" }] }`

### Create Flashcard

```
POST /flashcards
```

Request:
```json
{
  "front": "string",
  "back": "string",
  "topic_id": "uuid (optional)"
}
```

New cards start with ease_factor=2.5, interval=0, repetitions=0, next_review_at=now.

Response `201`: `{ "flashcard": { "...Flashcard" } }`

### Update Flashcard

```
PATCH /flashcards/:id
```

Does not reset SM-2 parameters. Use for editing front/back/topic only.

Request: partial of Create fields.

Response `200`: `{ "flashcard": { "...Flashcard" } }`

### Delete Flashcard

```
DELETE /flashcards/:id
```

Response `204 No Content`.

### Review Flashcard (SM-2)

```
POST /flashcards/:id/review
```

Request:
```json
{
  "quality": "int (0-5)"
}
```

Quality scale:
| Value | Label |
|-------|-------|
| 0 | Complete blackout |
| 1 | Incorrect, but upon seeing answer remembered |
| 2 | Incorrect, but answer seemed easy to recall |
| 3 | Correct with serious difficulty |
| 4 | Correct after hesitation |
| 5 | Perfect response |

The server recalculates `ease_factor`, `interval_days`, `repetitions`, and `next_review_at` using the SM-2 algorithm.

Response `200`:
```json
{
  "flashcard": {
    "...Flashcard with updated SM-2 values"
  }
}
```

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
