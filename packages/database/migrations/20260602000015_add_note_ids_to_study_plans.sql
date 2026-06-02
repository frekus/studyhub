-- Add note_ids column to study_plans and study_plan_days if missing
-- (original migration used CREATE TABLE IF NOT EXISTS which silently skipped
--  the column when the table already existed from an earlier schema)

ALTER TABLE study_plans
  ADD COLUMN IF NOT EXISTS note_ids uuid[] NOT NULL DEFAULT '{}';

ALTER TABLE study_plan_days
  ADD COLUMN IF NOT EXISTS note_ids uuid[] NOT NULL DEFAULT '{}';
