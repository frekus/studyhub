-- Add temporary admin privilege fields to admin_users
ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS privileges JSONB,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes TEXT;
