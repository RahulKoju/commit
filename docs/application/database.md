# Database Schema

All tables use UUID primary keys (generated via `gen_random_uuid()` from the `pgcrypto` extension) and `TIMESTAMPTZ` timestamps. The database runs 021 SQL migration files tracked in the `schema_migrations` table.

## Entity Relationship Overview

```
users (1) ──< habit_categories (1) ──< habits (1) ──< habit_logs
  │
  ├──< topics (1) ──< learn_entries
  │            └──< flashcards
  │
  ├──< tasks (1) ──< focus_sessions (1) ──< focus_session_tags
  │    │
  │    └──< topics (optional, ON DELETE SET NULL)
  │
  ├──< notes ──> note_topics ──> topics  (many-to-many)
  │    └──< note_tags
  │    └──< note_links (bidirectional wiki-link graph)
  │
  ├──< reviews
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

### `topics`

User-defined subjects for learning, task association, note categorization, and flashcards.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` |
| `user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE CASCADE` |
| `name` | `TEXT` | `NOT NULL` |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` |

Constraints: `UNIQUE(user_id, name)`
Index: `idx_topics_user_id(user_id)`

---

### `learn_entries`

Records of study sessions tied to a topic.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` |
| `user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE CASCADE` |
| `topic_id` | `UUID` | `NOT NULL REFERENCES topics(id) ON DELETE CASCADE` |
| `duration_minutes` | `INTEGER` | `NOT NULL CHECK (> 0)` |
| `confidence` | `INTEGER` | `NOT NULL CHECK (BETWEEN 1 AND 5)` |
| `note` | `TEXT` | `NOT NULL DEFAULT ''` |
| `studied_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` |

Indexes: `idx_learn_entries_user_studied(user_id, studied_at DESC)`, `idx_learn_entries_topic_id(topic_id)`

---

### `tasks`

Todo-style tasks with priority, scheduling, recurrence, and status tracking.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` |
| `user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE CASCADE` |
| `topic_id` | `UUID` | `REFERENCES topics(id) ON DELETE SET NULL` |
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

Indexes: `idx_tasks_user_status(user_id, status)`, `idx_tasks_scheduled_date(user_id, scheduled_date)`, `idx_tasks_topic_id(topic_id)`

---

### `focus_sessions`

Pomodoro-style focus tracking linked to a task.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` |
| `user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE CASCADE` |
| `task_id` | `UUID` | `NOT NULL REFERENCES tasks(id) ON DELETE CASCADE` |
| `topic_id` | `UUID` | `REFERENCES topics(id) ON DELETE SET NULL` |
| `start_time` | `TIMESTAMPTZ` | `NOT NULL` |
| `duration_minutes` | `INTEGER` | `NOT NULL CHECK (> 0)` |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` |

Indexes: `idx_focus_sessions_user_start(user_id, start_time)`, `idx_focus_sessions_topic_id(topic_id)`

#### `focus_session_tags`

Tags associated with a focus session.

| Column | Type | Constraints |
|--------|------|-------------|
| `session_id` | `UUID` | `NOT NULL REFERENCES focus_sessions(id) ON DELETE CASCADE` |
| `tag` | `TEXT` | `NOT NULL` |
| | | `PRIMARY KEY (session_id, tag)` |

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

#### `note_topics` (junction table)

| Column | Type | Constraints |
|--------|------|-------------|
| `note_id` | `UUID` | `NOT NULL REFERENCES notes(id) ON DELETE CASCADE` |
| `topic_id` | `UUID` | `NOT NULL REFERENCES topics(id) ON DELETE CASCADE` |
| | | `PRIMARY KEY (note_id, topic_id)` |

Index: `idx_note_topics_topic_id(topic_id)`

#### `note_tags`

Tags attached to a note.

| Column | Type | Constraints |
|--------|------|-------------|
| `note_id` | `UUID` | `NOT NULL REFERENCES notes(id) ON DELETE CASCADE` |
| `tag` | `TEXT` | `NOT NULL` |
| | | `PRIMARY KEY (note_id, tag)` |

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

Trackable habits of type `boolean` (done/not done) or `numeric` (quantifiable). Supports soft delete.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` |
| `user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE CASCADE` |
| `category_id` | `UUID` | `NOT NULL REFERENCES habit_categories(id) ON DELETE RESTRICT` |
| `name` | `TEXT` | `NOT NULL` |
| `description` | `TEXT` | `NOT NULL DEFAULT ''` |
| `type` | `TEXT` | `NOT NULL CHECK (IN ('boolean','numeric'))` |
| `target_value` | `NUMERIC` | nullable |
| `target_unit` | `TEXT` | nullable |
| `frequency_type` | `TEXT` | `NOT NULL DEFAULT 'daily' CHECK (IN ('daily','weekly'))` |
| `frequency_days` | `INTEGER[]` | `NOT NULL DEFAULT '{}'` |
| `weekly_goal` | `INTEGER` | `NOT NULL DEFAULT 7 CHECK (> 0)` |
| `sort_order` | `INTEGER` | `NOT NULL DEFAULT 0` |
| `deleted_at` | `TIMESTAMPTZ` | nullable (soft delete) |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` |

Constraints: `UNIQUE(user_id, name)`
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

### `reviews`

Periodic (weekly/monthly) self-reflection entries with aggregated data stored as JSONB.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` |
| `user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE CASCADE` |
| `type` | `TEXT` | `NOT NULL CHECK (IN ('weekly','monthly'))` |
| `period_start` | `DATE` | `NOT NULL` |
| `period_end` | `DATE` | `NOT NULL` |
| `reflection_text` | `TEXT` | `NOT NULL DEFAULT ''` |
| `data` | `JSONB` | `NOT NULL DEFAULT '{}'::jsonb` |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` |

Constraints: `UNIQUE(user_id, type, period_start, period_end)`
Index: `idx_reviews_user_period(user_id, period_start DESC, period_end DESC)`

---

### `flashcards`

Spaced repetition flashcards using the SM-2 algorithm.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` |
| `user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE CASCADE` |
| `topic_id` | `UUID` | `REFERENCES topics(id) ON DELETE SET NULL` |
| `front` | `TEXT` | `NOT NULL` |
| `back` | `TEXT` | `NOT NULL` |
| `ease_factor` | `REAL` | `NOT NULL DEFAULT 2.5` |
| `interval_days` | `INTEGER` | `NOT NULL DEFAULT 0` |
| `repetitions` | `INTEGER` | `NOT NULL DEFAULT 0` |
| `next_review_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` |

Index: `idx_flashcards_next_review(user_id, next_review_at)`

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
- `topics` is a central entity referenced by `tasks`, `learn_entries`, `focus_sessions`, `flashcards`, and (via `note_topics`) `notes`
- `habit_categories` groups `habits`; deleting a category is restricted (`ON DELETE RESTRICT`) if habits reference it
- `habits` has daily logs in `habit_logs` (one row per habit per date, upsert semantics)
- Habits support soft delete via `deleted_at` timestamp
- `notes` has many-to-many with `topics` via `note_topics` junction table
- `notes` has tags via `note_tags` and wiki-link backlinks via `note_links`
- `focus_sessions` has tags via `focus_session_tags`
- `flashcards` uses the SM-2 algorithm with `ease_factor`, `interval_days`, `repetitions`, `next_review_at`
- `reviews` stores periodic reflection data with aggregated JSONB payloads
- `refresh_tokens` and `password_reset_tokens` support the auth flow
