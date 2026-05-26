-- Add the two remaining admin columns to the users (profiles) table so that
-- all admin state lives in one place. is_admin and admin_expires_at were
-- added in migration 20260526000006.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS admin_role       text,
  ADD COLUMN IF NOT EXISTS admin_privileges jsonb;
