ALTER TABLE habits
  ADD COLUMN IF NOT EXISTS comparison_operator TEXT NOT NULL DEFAULT 'gte',
  ADD COLUMN IF NOT EXISTS target_value_max NUMERIC;

ALTER TABLE habits
  ADD CONSTRAINT habits_comparison_operator_check
  CHECK (comparison_operator IN ('gte', 'lte', 'eq', 'between'));

ALTER TABLE habits
  ADD CONSTRAINT habits_between_target_values_check
  CHECK (
    comparison_operator <> 'between'
    OR (
      target_value IS NOT NULL
      AND target_value_max IS NOT NULL
      AND target_value_max > target_value
    )
  );
