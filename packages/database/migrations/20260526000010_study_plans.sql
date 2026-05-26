-- Study Plans: AI-generated day-by-day study schedules
CREATE TABLE IF NOT EXISTS study_plans (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text        NOT NULL,
  subject     text        NOT NULL,
  exam_date   date        NOT NULL,
  status      text        NOT NULL DEFAULT 'generating', -- generating | ready | failed
  note_ids    uuid[]      NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS study_plan_days (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id      uuid        NOT NULL REFERENCES study_plans(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  study_date   date        NOT NULL,
  day_number   int         NOT NULL,
  title        text        NOT NULL,
  description  text        NOT NULL,
  note_ids     uuid[]      NOT NULL DEFAULT '{}',
  is_completed boolean     NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE study_plans  ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_plan_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_plans"
  ON study_plans FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_own_plan_days"
  ON study_plan_days FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS study_plans_user_exam ON study_plans(user_id, exam_date);
CREATE INDEX IF NOT EXISTS study_plan_days_plan  ON study_plan_days(plan_id, study_date);
