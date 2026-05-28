-- Student profiles cache table for personalisation engine
CREATE TABLE IF NOT EXISTS public.student_profiles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_data JSONB NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT student_profiles_user_id_key UNIQUE (user_id)
);

ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON public.student_profiles FOR SELECT
  USING (auth.uid() = user_id);

-- group_predictions: add title column if not already present
ALTER TABLE public.group_predictions
  ADD COLUMN IF NOT EXISTS title TEXT;
