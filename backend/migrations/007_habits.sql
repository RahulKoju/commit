CREATE TABLE IF NOT EXISTS habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES habit_categories(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL CHECK (type IN ('boolean', 'numeric')),
  target_value NUMERIC,
  target_unit TEXT,
  frequency_type TEXT NOT NULL CHECK (frequency_type IN ('daily', 'weekly')),
  frequency_days INTEGER[] NOT NULL DEFAULT '{}',
  weekly_goal INTEGER NOT NULL DEFAULT 7 CHECK (weekly_goal > 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_habits_user_sort ON habits(user_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_habits_category_id ON habits(category_id);
