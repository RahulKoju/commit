-- FEAT-T3a: Add estimated_minutes to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_minutes INTEGER DEFAULT NULL;
