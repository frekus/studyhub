-- Run AFTER the study_group_members SQL you already ran.

CREATE TABLE public.group_notes (
  id         UUID        NOT NULL DEFAULT gen_random_uuid(),
  group_id   UUID        NOT NULL REFERENCES public.study_groups(id)   ON DELETE CASCADE,
  note_id    UUID        NOT NULL REFERENCES public.study_notes(id)     ON DELETE CASCADE,
  shared_by  UUID        NOT NULL REFERENCES public.users(id)           ON DELETE CASCADE,
  shared_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT group_notes_pkey   PRIMARY KEY (id),
  CONSTRAINT group_notes_unique UNIQUE (group_id, note_id)
);

CREATE INDEX group_notes_group_id_idx ON public.group_notes(group_id);

ALTER TABLE public.group_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can view shared notes"
ON public.group_notes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.study_group_members
    WHERE group_id = group_notes.group_id
    AND   user_id  = auth.uid()
  )
);

CREATE POLICY "Group members can share notes"
ON public.group_notes FOR INSERT
WITH CHECK (
  auth.uid() = shared_by
  AND EXISTS (
    SELECT 1 FROM public.study_group_members
    WHERE group_id = group_notes.group_id
    AND   user_id  = auth.uid()
  )
);
