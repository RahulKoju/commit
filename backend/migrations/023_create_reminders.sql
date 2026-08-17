CREATE TABLE IF NOT EXISTS reminders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note_id       UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('one_time', 'recurring')),
  next_fire_at  TIMESTAMPTZ NOT NULL,
  cron          TEXT,
  message       TEXT NOT NULL DEFAULT '',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  last_fired_at TIMESTAMPTZ,
  done_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (type = 'one_time' OR (cron IS NOT NULL AND cron <> ''))
);

CREATE INDEX IF NOT EXISTS idx_reminders_next_fire
  ON reminders (is_active, next_fire_at);
CREATE INDEX IF NOT EXISTS idx_reminders_note
  ON reminders (note_id);