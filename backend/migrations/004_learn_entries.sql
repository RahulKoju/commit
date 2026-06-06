CREATE TABLE IF NOT EXISTS learn_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  confidence INTEGER NOT NULL CHECK (confidence BETWEEN 1 AND 5),
  note TEXT NOT NULL DEFAULT '',
  studied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learn_entries_user_studied ON learn_entries(user_id, studied_at DESC);
CREATE INDEX IF NOT EXISTS idx_learn_entries_topic_id ON learn_entries(topic_id);
