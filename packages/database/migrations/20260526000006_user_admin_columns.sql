-- Add admin status columns to the users table so middleware can check them
-- without querying the admin_users table (which requires the service role key).
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS admin_expires_at timestamptz;
