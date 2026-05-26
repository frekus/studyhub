-- Flashcard performance tracking for spaced repetition (SM-2 algorithm)
CREATE TABLE IF NOT EXISTS flashcard_performance (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flashcard_id     uuid        NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
  note_id          uuid        NOT NULL REFERENCES study_notes(id) ON DELETE CASCADE,
  correct_count    int         NOT NULL DEFAULT 0,
  incorrect_count  int         NOT NULL DEFAULT 0,
  interval_days    int         NOT NULL DEFAULT 1,
  ease_factor      float       NOT NULL DEFAULT 2.5,
  next_review_at   timestamptz,
  last_reviewed_at timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, flashcard_id)
);

ALTER TABLE flashcard_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_performance"
  ON flashcard_performance FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS fp_user_next_review ON flashcard_performance(user_id, next_review_at);
CREATE INDEX IF NOT EXISTS fp_user_note        ON flashcard_performance(user_id, note_id);
