-- Study streaks and activity tracking

CREATE TABLE IF NOT EXISTS study_streaks (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  current_streak    INT         NOT NULL DEFAULT 0,
  longest_streak    INT         NOT NULL DEFAULT 0,
  last_study_date   DATE,
  total_study_days  INT         NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS study_activity (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_date       DATE        NOT NULL,
  notes_created       INT         NOT NULL DEFAULT 0,
  flashcards_reviewed INT         NOT NULL DEFAULT 0,
  exams_uploaded      INT         NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, activity_date)
);

-- RLS
ALTER TABLE study_streaks  ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own streaks"
  ON study_streaks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own activity"
  ON study_activity FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_study_streaks_user_id    ON study_streaks(user_id);
CREATE INDEX IF NOT EXISTS idx_study_activity_user_date ON study_activity(user_id, activity_date DESC);

-- RPC: atomic upsert + increment for a single activity column
CREATE OR REPLACE FUNCTION public.increment_activity(
  p_user_id UUID,
  p_date    DATE,
  p_column  TEXT
) RETURNS void AS $$
BEGIN
  INSERT INTO public.study_activity
    (user_id, activity_date, notes_created, flashcards_reviewed, exams_uploaded)
  VALUES (p_user_id, p_date, 0, 0, 0)
  ON CONFLICT (user_id, activity_date) DO NOTHING;

  IF p_column = 'notes_created' THEN
    UPDATE public.study_activity
    SET notes_created = notes_created + 1, updated_at = now()
    WHERE user_id = p_user_id AND activity_date = p_date;
  ELSIF p_column = 'flashcards_reviewed' THEN
    UPDATE public.study_activity
    SET flashcards_reviewed = flashcards_reviewed + 1, updated_at = now()
    WHERE user_id = p_user_id AND activity_date = p_date;
  ELSIF p_column = 'exams_uploaded' THEN
    UPDATE public.study_activity
    SET exams_uploaded = exams_uploaded + 1, updated_at = now()
    WHERE user_id = p_user_id AND activity_date = p_date;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
