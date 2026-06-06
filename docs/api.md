# Commit — API Reference

Base URL: `/api/v1`

## Authentication

Auth uses an HttpOnly cookie named `commit_token` containing a signed JWT. Protected endpoints require this cookie. The token is set on register/login and cleared on logout.

## Public Endpoints

### Health Check

```
GET /healthz
```

Response `200`:
```json
{ "status": "ok", "version": "1.0.0" }
```

### Register

```
POST /api/v1/auth/register
```

Request body:
```json
{
  "email": "string",
  "password": "string (min 8 characters)",
  "name": "string"
}
```

Response `201`:
```json
{
  "user": { "id": "uuid", "email": "string", "name": "string", "role": "user", "created_at": "rfc3339", "updated_at": "rfc3339" }
}
```
Sets `commit_token` cookie.

### Login

```
POST /api/v1/auth/login
```

Request body:
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
Sets `commit_token` cookie.

### Logout

```
POST /api/v1/auth/logout
```

Response `200`:
```json
{ "ok": true }
```
Clears `commit_token` cookie.

## Protected Endpoints

All protected endpoints require the `commit_token` cookie. If the token is missing or invalid, the API returns `401 Unauthorized`.

### Get Current User

```
GET /api/v1/auth/me
```

Response `200`:
```json
{
  "user": { "id": "uuid", "email": "string", "name": "string", "role": "string", "created_at": "rfc3339", "updated_at": "rfc3339" }
}
```

### Dashboard Summary

```
GET /api/v1/dashboard/summary
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
    "active_focus_session": { "id": "uuid", "task_id": "uuid", "task_title": "string", "start_time": "rfc3339", "duration_minutes": "int" } | null
  }
}
```

### Tasks

#### List Tasks

```
GET /api/v1/tasks
```

Query parameters:
- `view` — `today`, `backlog`, `completed`, or `all` (optional)
- `topic_id` — filter by topic (optional)
- `priority` — filter by priority (optional)
- `status` — `todo`, `in-progress`, or `done` (optional)

Response `200`:
```json
{
  "tasks": [{ "id": "uuid", "user_id": "uuid", "topic_id": "uuid | null", "title": "string", "description": "string", "priority": "low | medium | high", "scheduled_date": "date | null", "status": "todo | in-progress | done", "completed_at": "rfc3339 | null", "created_at": "rfc3339", "updated_at": "rfc3339" }]
}
```

#### Create Task

```
POST /api/v1/tasks
```

Request body:
```json
{
  "topic_id": "uuid | optional",
  "title": "string",
  "description": "string | optional",
  "priority": "low | medium | high | optional",
  "scheduled_date": "date | optional",
  "status": "todo | in-progress | done | optional"
}
```

Response `201`:
```json
{ "task": { "...Task" } }
```

#### Update Task

```
PATCH /api/v1/tasks/:id
```

Request body: same fields as Create (all optional).

Response `200`:
```json
{ "task": { "...Task" } }
```

#### Delete Task

```
DELETE /api/v1/tasks/:id
```

Response `204 No Content`.

### Focus Sessions

#### List Focus Sessions

```
GET /api/v1/focus/sessions
```

Query parameters:
- `date_from` — start date filter (optional)
- `date_to` — end date filter (optional)
- `topic_id` — filter by topic (optional)

Response `200`:
```json
{
  "sessions": [{ "id": "uuid", "user_id": "uuid", "task_id": "uuid", "task_title": "string", "topic_id": "uuid | null", "start_time": "rfc3339", "duration_minutes": "int", "created_at": "rfc3339" }]
}
```

#### Create Focus Session

```
POST /api/v1/focus/sessions
```

Request body:
```json
{
  "task_id": "uuid",
  "topic_id": "uuid | optional",
  "start_time": "rfc3339 | optional",
  "duration_minutes": "int"
}
```

Response `201`:
```json
{ "session": { "...FocusSession" } }
```

### Learning

#### List Learn Entries

```
GET /api/v1/learn/entries
```

Response `200`:
```json
{
  "entries": [{ "id": "uuid", "user_id": "uuid", "topic_id": "uuid", "topic_name": "string", "duration_minutes": "int", "confidence": "int (1-5)", "note": "string", "studied_at": "rfc3339", "created_at": "rfc3339", "updated_at": "rfc3339" }]
}
```

#### Create Learn Entry

```
POST /api/v1/learn/entries
```

Request body:
```json
{
  "topic_id": "uuid",
  "duration_minutes": "int (> 0)",
  "confidence": "int (1-5)",
  "note": "string | optional",
  "studied_at": "rfc3339 | optional"
}
```

Response `201`:
```json
{ "entry": { "...LearnEntry" } }
```

#### Update Learn Entry

```
PATCH /api/v1/learn/entries/:id
```

Request body: partial of Create fields.

Response `200`:
```json
{ "entry": { "...LearnEntry" } }
```

#### Delete Learn Entry

```
DELETE /api/v1/learn/entries/:id
```

Response `204 No Content`.

#### List Topics

```
GET /api/v1/learn/topics
```

Response `200`:
```json
{
  "topics": [{ "id": "uuid", "user_id": "uuid", "name": "string", "created_at": "rfc3339", "updated_at": "rfc3339" }]
}
```

#### Create Topic

```
POST /api/v1/learn/topics
```

Request body:
```json
{ "name": "string" }
```

Response `201`:
```json
{ "topic": { "...Topic" } }
```

#### Update Topic

```
PATCH /api/v1/learn/topics/:id
```

Request body:
```json
{ "name": "string" }
```

Response `200`:
```json
{ "topic": { "...Topic" } }
```

#### Delete Topic

```
DELETE /api/v1/learn/topics/:id
```

Response `204 No Content`.

#### Weak Spots

```
GET /api/v1/learn/weakspots
```

Response `200`:
```json
{
  "weak_spots": [{ "topic_id": "uuid", "topic_name": "string", "average_confidence": "float", "last_studied_at": "rfc3339" }]
}
```

#### Learn Summary

```
GET /api/v1/learn/summary
```

Response `200`:
```json
{
  "weak_spots": [],
  "topic_stats": [],
  "study_days": [],
  "streak": "int"
}
```

### Notes

#### List Notes

```
GET /api/v1/notes
```

Query parameters:
- `search` — full-text search query (optional)

Response `200`:
```json
{
  "notes": [{ "id": "uuid", "user_id": "uuid", "title": "string", "body": "string", "topics": [{ "id": "uuid", "name": "string" }], "created_at": "rfc3339", "updated_at": "rfc3339" }]
}
```

#### Create Note

```
POST /api/v1/notes
```

Request body:
```json
{
  "title": "string",
  "body": "string | optional",
  "topic_ids": ["uuid"] | optional
}
```

Response `201`:
```json
{ "note": { "...Note" } }
```

#### Update Note

```
PATCH /api/v1/notes/:id
```

Request body: partial of Create fields.

Response `200`:
```json
{ "note": { "...Note" } }
```

#### Delete Note

```
DELETE /api/v1/notes/:id
```

Response `204 No Content`.

### Habits

#### List Habit Categories

```
GET /api/v1/habit-categories
```

Response `200`:
```json
{
  "categories": [{ "id": "uuid", "user_id": "uuid", "name": "string", "created_at": "rfc3339", "updated_at": "rfc3339" }]
}
```

#### Create Habit Category

```
POST /api/v1/habit-categories
```

Request body:
```json
{ "name": "string" }
```

Response `201`:
```json
{ "category": { "...HabitCategory" } }
```

#### List Habits

```
GET /api/v1/habits
```

Response `200`:
```json
{
  "habits": [{ "id": "uuid", "user_id": "uuid", "category_id": "uuid", "category_name": "string", "name": "string", "description": "string", "type": "boolean | numeric", "target_value": "number | null", "target_unit": "string | null", "frequency_type": "daily | weekly", "frequency_days": ["int"], "weekly_goal": "int", "sort_order": "int", "today_log": { "...HabitLog" } | null, "created_at": "rfc3339", "updated_at": "rfc3339" }]
}
```

#### Create Habit

```
POST /api/v1/habits
```

Request body:
```json
{
  "category_id": "uuid",
  "name": "string",
  "description": "string | optional",
  "type": "boolean | numeric",
  "target_value": "number | optional",
  "target_unit": "string | optional",
  "frequency_type": "daily | weekly | optional",
  "frequency_days": ["int"] | optional,
  "weekly_goal": "int | optional",
  "sort_order": "int | optional"
}
```

Response `201`:
```json
{ "habit": { "...Habit" } }
```

#### Update Habit

```
PATCH /api/v1/habits/:id
```

Request body: partial of Create fields.

Response `200`:
```json
{ "habit": { "...Habit" } }
```

#### Delete Habit

```
DELETE /api/v1/habits/:id
```

Response `204 No Content`.

#### Log Habit

```
POST /api/v1/habits/:id/log
```

Request body:
```json
{
  "logged_date": "date | optional",
  "value": "number"
}
```

Response `200`:
```json
{ "log": { "id": "uuid", "user_id": "uuid", "habit_id": "uuid", "logged_date": "date", "value": "number", "created_at": "rfc3339", "updated_at": "rfc3339" } }
```

#### Habit Analytics

```
GET /api/v1/habits/:id/analytics
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
    "daily_completion": [],
    "category_completion": {}
  }
}
```

### Reviews

#### List Reviews

```
GET /api/v1/reviews
```

Query parameters:
- `type` — `weekly` or `monthly` (optional)

Response `200`:
```json
{
  "reviews": [{ "id": "uuid", "user_id": "uuid", "type": "weekly | monthly", "period_start": "date", "period_end": "date", "reflection_text": "string", "data": "jsonb", "created_at": "rfc3339", "updated_at": "rfc3339" }]
}
```

#### Create Review

```
POST /api/v1/reviews
```

Request body:
```json
{
  "type": "weekly | monthly",
  "period_start": "date | optional",
  "period_end": "date | optional",
  "reflection_text": "string | optional"
}
```

Response `201`:
```json
{ "review": { "...Review" } }
```

#### Get Review

```
GET /api/v1/reviews/:id
```

Response `200`:
```json
{ "review": { "...Review" } }
```

## Admin Endpoints

All admin endpoints require the `commit_token` cookie with a user whose role is `admin`.

### List Users

```
GET /api/v1/admin/users
```

Response `200`:
```json
{
  "users": [{ "id": "uuid", "email": "string", "name": "string", "role": "string", "created_at": "rfc3339", "updated_at": "rfc3339" }]
}
```

### Delete User

```
DELETE /api/v1/admin/users/:id
```

Response `204 No Content`.
