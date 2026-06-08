ALTER TABLE habits ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_habits_user_active ON habits(user_id) WHERE deleted_at IS NULL;
