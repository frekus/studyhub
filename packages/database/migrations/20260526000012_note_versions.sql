-- Note version history (auto-saved on each edit, last 10 kept)
CREATE TABLE IF NOT EXISTS note_versions (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id        uuid        NOT NULL REFERENCES study_notes(id) ON DELETE CASCADE,
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version_number int         NOT NULL,
  title          text        NOT NULL,
  content        text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE(note_id, version_number)
);

ALTER TABLE note_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_versions"
  ON note_versions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS note_versions_note ON note_versions(note_id, version_number DESC);
