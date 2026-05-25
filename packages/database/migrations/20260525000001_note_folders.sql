-- Note folders / categories

CREATE TABLE IF NOT EXISTS note_folders (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 50),
  color      TEXT NOT NULL DEFAULT '#14B8A7',
  icon       TEXT NOT NULL DEFAULT 'folder',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add folder_id to study_notes
ALTER TABLE study_notes
  ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES note_folders(id) ON DELETE SET NULL;

-- Row Level Security
ALTER TABLE note_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own folders"
  ON note_folders FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for fast per-user folder lookup
CREATE INDEX IF NOT EXISTS idx_note_folders_user_id ON note_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_study_notes_folder_id ON study_notes(folder_id);
