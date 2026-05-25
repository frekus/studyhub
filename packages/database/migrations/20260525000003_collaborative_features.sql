-- Collaborative study features

-- Feature 1: Live study sessions
CREATE TABLE IF NOT EXISTS study_sessions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id            UUID        NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
  host_id             UUID        NOT NULL REFERENCES users(id)        ON DELETE CASCADE,
  note_id             UUID        NOT NULL REFERENCES study_notes(id)  ON DELETE CASCADE,
  note_title          TEXT        NOT NULL,
  current_card_index  INT         NOT NULL DEFAULT 0,
  is_active           BOOLEAN     NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS session_participants (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID        NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES users(id)          ON DELETE CASCADE,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, user_id)
);

-- Feature 2: Collaborative group notes
CREATE TABLE IF NOT EXISTS group_notes (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        UUID        NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
  created_by      UUID        NOT NULL REFERENCES users(id)        ON DELETE CASCADE,
  title           TEXT        NOT NULL,
  content         TEXT,
  ai_summary      TEXT,
  last_edited_by  UUID        REFERENCES users(id)                 ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Feature 3: Mention notifications
CREATE TABLE IF NOT EXISTS group_notifications (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES users(id)        ON DELETE CASCADE,
  group_id      UUID        NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
  from_user_id  UUID        NOT NULL REFERENCES users(id)        ON DELETE CASCADE,
  type          TEXT        NOT NULL DEFAULT 'mention',
  message       TEXT        NOT NULL,
  note_id       UUID,
  is_read       BOOLEAN     NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Feature 4: Group exam uploads + predictions
CREATE TABLE IF NOT EXISTS group_exam_uploads (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     UUID        NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
  uploaded_by  UUID        NOT NULL REFERENCES users(id)        ON DELETE CASCADE,
  title        TEXT        NOT NULL,
  content      TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_predictions (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id       UUID        NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
  papers_count   INT         NOT NULL DEFAULT 0,
  members_count  INT         NOT NULL DEFAULT 0,
  status         TEXT        NOT NULL DEFAULT 'pending',
  predictions    JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Feature 6: Comments & reactions on shared notes
CREATE TABLE IF NOT EXISTS note_comments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID        NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
  note_id     UUID        NOT NULL REFERENCES study_notes(id)  ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES users(id)        ON DELETE CASCADE,
  content     TEXT,
  reaction    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT comment_has_content_or_reaction CHECK (content IS NOT NULL OR reaction IS NOT NULL)
);

-- RLS
ALTER TABLE study_sessions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_participants  ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_notes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_notifications   ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_exam_uploads    ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_predictions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_comments         ENABLE ROW LEVEL SECURITY;

-- Policies: group member checks are handled at API layer via admin client
CREATE POLICY "Authenticated users access study sessions"
  ON study_sessions FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users access session participants"
  ON session_participants FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users access group notes"
  ON group_notes FOR ALL USING (auth.uid() IS NOT NULL);

-- Notifications: users see and manage only their own
CREATE POLICY "Users see own notifications"
  ON group_notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service inserts notifications"
  ON group_notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Users update own notifications"
  ON group_notifications FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users access group exam uploads"
  ON group_exam_uploads FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users access group predictions"
  ON group_predictions FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users access note comments"
  ON note_comments FOR ALL USING (auth.uid() IS NOT NULL);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_study_sessions_group_active       ON study_sessions(group_id, is_active);
CREATE INDEX IF NOT EXISTS idx_session_participants_session_id   ON session_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_group_notes_group_id              ON group_notes(group_id);
CREATE INDEX IF NOT EXISTS idx_group_notifications_user_unread   ON group_notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_group_exam_uploads_group_id       ON group_exam_uploads(group_id);
CREATE INDEX IF NOT EXISTS idx_group_predictions_group_id        ON group_predictions(group_id);
CREATE INDEX IF NOT EXISTS idx_note_comments_note_group          ON note_comments(note_id, group_id);
