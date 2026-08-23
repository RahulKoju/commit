# Database Schema

All tables use UUID primary keys (generated via `gen_random_uuid()` from the `pgcrypto` extension) and `TIMESTAMPTZ` timestamps. The database runs 027 SQL migration files tracked in the `schema_migrations` table.

## Entity Relationship Overview

```
users (1) ──< habit_categories (1) ──< habits (1) ──< habit_logs
  │
  ├──< tasks (1) ──< focus_sessions
  │    │             └──< focus_session_tags
  │    └──< active_focus_sessions (0..1 active per user)
  │
  ├──< notes ──< reminders
  │    └──< note_links (bidirectional wiki-link graph)
  │
  ├──< refresh_tokens
  │
  └──< password_reset_tokens
```

## Tables

### `users`

Core user accounts.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` |
| `email` | `TEXT` | `NOT NULL UNIQUE` |
| `password_hash` | `TEXT` | `NOT NULL` |
| `name` | `TEXT` | `NOT NULL` |
| `role` | `TEXT` | `NOT NULL DEFAULT 'user' CHECK (IN ('user','admin'))` |
| `widget_layout` | `JSONB` | `NOT NULL DEFAULT '[]'::jsonb` |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` |

Indexes: `idx_users_role(role)`

---

### `habit_categories`

User-defined groupings for habits.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` |
| `user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE CASCADE` |
| `name` | `TEXT` | `NOT NULL` |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` |

Constraints: `UNIQUE(user_id, name)`
Index: `idx_habit_categories_user_id(user_id)`

---

### `tasks`

Todo-style tasks with priority, scheduling, recurrence, and status tracking.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` |
| `user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE CASCADE` |
| `title` | `TEXT` | `NOT NULL` |
| `description` | `TEXT` | `NOT NULL DEFAULT ''` |
| `priority` | `TEXT` | `NOT NULL DEFAULT 'medium' CHECK (IN ('low','medium','high'))` |
| `scheduled_date` | `DATE` | nullable |
| `status` | `TEXT` | `NOT NULL DEFAULT 'todo' CHECK (IN ('todo','in-progress','done'))` |
| `recurrence_rule` | `TEXT` | nullable — `daily`, `weekdays`, `weekly`, `monthly` |
| `estimated_minutes` | `INTEGER` | nullable |
| `completed_at` | `TIMESTAMPTZ` | nullable |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` |

Indexes: `idx_tasks_user_status(user_id, status)`, `idx_tasks_scheduled_date(user_id, scheduled_date)`

---

### `focus_sessions`

Completed Pomodoro-style focus tracking linked to a task.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` |
| `user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE CASCADE` |
| `task_id` | `UUID` | `NOT NULL REFERENCES tasks(id) ON DELETE CASCADE` |
| `start_time` | `TIMESTAMPTZ` | `NOT NULL` |
| `duration_minutes` | `INTEGER` | `NOT NULL CHECK (> 0)` |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` |

Indexes: `idx_focus_sessions_user_start(user_id, start_time)`

#### `focus_session_tags`

Tags associated with a focus session.

| Column | Type | Constraints |
|--------|------|-------------|
| `session_id` | `UUID` | `NOT NULL REFERENCES focus_sessions(id) ON DELETE CASCADE` |
| `tag` | `TEXT` | `NOT NULL` |
| | | `PRIMARY KEY (session_id, tag)` |

---

### `active_focus_sessions`

Server-side in-progress focus sessions, making timers persistent and resumable across refreshes/devices. On completion (or discard) the session's final state is recorded in history; work sessions are inserted into `focus_sessions`.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` |
| `user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE CASCADE` |
| `task_id` | `UUID` | `REFERENCES tasks(id) ON DELETE SET NULL` |
| `session_type` | `TEXT` | `NOT NULL CHECK (IN ('work','short_break','long_break'))` |
| `status` | `TEXT` | `NOT NULL DEFAULT 'running' CHECK (IN ('running','paused','completed','discarded'))` |
| `elapsed_seconds` | `INTEGER` | `NOT NULL DEFAULT 0 CHECK (>= 0)` |
| `planned_duration_seconds` | `INTEGER` | nullable — null means stopwatch mode |
| `segment_started_at` | `TIMESTAMPTZ` | nullable |
| `heartbeat_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` |
| `started_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` |
| `message` | `TEXT` | `NOT NULL DEFAULT ''` |
| `tags` | `TEXT[]` | `NOT NULL DEFAULT '{}'` |
| `completed_at` | `TIMESTAMPTZ` | nullable |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` |

Constraints: partial unique index `uq_active_focus_one_per_user(user_id) WHERE status IN ('running','paused')` — one active session per user
Index: `idx_active_focus_heartbeat(status, heartbeat_at)`

---

### `notes`

Rich-text notes with full-text search via generated `tsvector`.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` |
| `user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE CASCADE` |
| `title` | `TEXT` | `NOT NULL` |
| `body` | `TEXT` | `NOT NULL DEFAULT ''` |
| `search_vector` | `TSVECTOR` | `GENERATED ALWAYS AS (setweight(to_tsvector('english', title),'A') \|\| setweight(to_tsvector('english', body),'B')) STORED` |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` |

Indexes: `idx_notes_user_updated(user_id, updated_at DESC)`, `idx_notes_search_vector` (GIN on `search_vector`)

#### `note_links`

Bidirectional wiki-link relationships between notes. Created automatically when note body contains `[[Note Title]]` syntax.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` |
| `source_note_id` | `UUID` | `NOT NULL REFERENCES notes(id) ON DELETE CASCADE` |
| `target_note_id` | `UUID` | `NOT NULL REFERENCES notes(id) ON DELETE CASCADE` |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` |

Constraints: `UNIQUE(source_note_id, target_note_id)`

---

### `habits`

Trackable habits of type `boolean` (done/not done) or `numeric` (quantifiable). Numeric habits use a comparison operator so targets can be minimums (`gte`), maximums (`lte`, inverse habits), exact values (`eq`), or ranges (`between`). Supports soft delete.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` |
| `user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE CASCADE` |
| `category_id` | `UUID` | `NOT NULL REFERENCES habit_categories(id) ON DELETE RESTRICT` |
| `name` | `TEXT` | `NOT NULL` |
| `icon` | `TEXT` | nullable |
| `description` | `TEXT` | `NOT NULL DEFAULT ''` |
| `type` | `TEXT` | `NOT NULL CHECK (IN ('boolean','numeric'))` |
| `comparison_operator` | `TEXT` | `NOT NULL DEFAULT 'gte' CHECK (IN ('gte','lte','eq','between'))` |
| `target_value` | `NUMERIC` | nullable |
| `target_value_max` | `NUMERIC` | nullable — required for `between`, must be > `target_value` |
| `target_unit` | `TEXT` | nullable |
| `frequency_type` | `TEXT` | `NOT NULL DEFAULT 'daily' CHECK (IN ('daily','weekly'))` |
| `frequency_days` | `INTEGER[]` | `NOT NULL DEFAULT '{}'` |
| `weekly_goal` | `INTEGER` | `NOT NULL DEFAULT 7 CHECK (> 0)` |
| `sort_order` | `INTEGER` | `NOT NULL DEFAULT 0` |
| `deleted_at` | `TIMESTAMPTZ` | nullable (soft delete) |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` |

Constraints: `UNIQUE(user_id, name)`; `habits_between_target_values_check` requires `target_value IS NOT NULL AND target_value_max IS NOT NULL AND target_value_max > target_value` when `comparison_operator = 'between'`
Indexes: `idx_habits_user_sort(user_id, sort_order)`, `idx_habits_category_id(category_id)`

---

### `habit_logs`

Daily logs for habit tracking.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` |
| `user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE CASCADE` |
| `habit_id` | `UUID` | `NOT NULL REFERENCES habits(id) ON DELETE CASCADE` |
| `logged_date` | `DATE` | `NOT NULL` |
| `value` | `NUMERIC` | `NOT NULL` |
| `note` | `TEXT` | `NOT NULL DEFAULT ''` |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` |

Constraints: `UNIQUE(habit_id, logged_date)`
Indexes: `idx_habit_logs_user_date(user_id, logged_date)`, `idx_habit_logs_habit_date(habit_id, logged_date)`

---

### `reminders`

One-time and cron-recurring reminders attached to notes.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` |
| `user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE CASCADE` |
| `note_id` | `UUID` | `NOT NULL REFERENCES notes(id) ON DELETE CASCADE` |
| `type` | `TEXT` | `NOT NULL CHECK (IN ('one_time','recurring'))` |
| `next_fire_at` | `TIMESTAMPTZ` | `NOT NULL` |
| `cron` | `TEXT` | nullable — required non-empty for recurring (CHECK) |
| `message` | `TEXT` | `NOT NULL DEFAULT ''` |
| `is_active` | `BOOLEAN` | `NOT NULL DEFAULT TRUE` |
| `last_fired_at` | `TIMESTAMPTZ` | nullable — watermark for the due-poll endpoint |
| `done_at` | `TIMESTAMPTZ` | nullable — set when a one-time reminder fires |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` |

Indexes: `idx_reminders_next_fire(is_active, next_fire_at)`, `idx_reminders_note(note_id)`

---

### `refresh_tokens`

Tracks active refresh token hashes for session management.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` |
| `user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE CASCADE` |
| `token_hash` | `TEXT` | `NOT NULL UNIQUE` |
| `expires_at` | `TIMESTAMPTZ` | `NOT NULL` |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` |

---

### `password_reset_tokens`

Single-use, time-limited tokens for password reset flow.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` |
| `user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE CASCADE` |
| `token_hash` | `TEXT` | `NOT NULL` |
| `expires_at` | `TIMESTAMPTZ` | `NOT NULL` |
| `used` | `BOOLEAN` | `NOT NULL DEFAULT false` |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` |

---

### `schema_migrations`

Internal tracking table created by the migration runner.

| Column | Type |
|--------|------|
| `version` | `TEXT` `PRIMARY KEY` |
| `applied_at` | `TIMESTAMPTZ` `NOT NULL DEFAULT now()` |

## Relationships Summary

- `users` owns all data — every content table has a `user_id` FK to `users(id)` with `ON DELETE CASCADE`
- `habit_categories` groups `habits`; deleting a category is restricted (`ON DELETE RESTRICT`) if habits reference it
- `habits` has daily logs in `habit_logs` (one row per habit per date, upsert semantics)
- Habits support soft delete via `deleted_at` timestamp; numeric habits compare logged values against targets via `comparison_operator` (`gte`/`lte`/`eq`/`between`)
- `tasks` group completed work in `focus_sessions`; in-progress sessions live in `active_focus_sessions` with at most one running/paused session per user
- `notes` have wiki-link backlinks via `note_links` and can carry any number of `reminders`
- `reminders` reference both their owner and their note; deleting either cascades
- `refresh_tokens` and `password_reset_tokens` support the auth flow
