-- ============================================================
-- Migration: 20260522000000_initial_schema
-- Creates the core StudyHub schema in the public schema.
-- RLS is enabled on all tables; policies are added separately.
-- ============================================================

-- ------------------------------------------------------------
-- Helper: auto-update updated_at on row modification
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ------------------------------------------------------------
-- 1. users
--    Mirror of auth.users with app-level profile fields.
-- ------------------------------------------------------------
create table public.users (
  id          uuid        not null references auth.users (id) on delete cascade,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now(),

  constraint users_pkey primary key (id)
);

alter table public.users enable row level security;

-- ------------------------------------------------------------
-- 2. study_notes
-- ------------------------------------------------------------
create table public.study_notes (
  id          uuid        not null default gen_random_uuid(),
  user_id     uuid        not null references public.users (id) on delete cascade,
  title       text        not null,
  content     text,
  ai_summary  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint study_notes_pkey primary key (id)
);

create index study_notes_user_id_idx   on public.study_notes (user_id);
create index study_notes_updated_at_idx on public.study_notes (updated_at desc);

create trigger study_notes_set_updated_at
  before update on public.study_notes
  for each row execute function public.set_updated_at();

alter table public.study_notes enable row level security;

-- ------------------------------------------------------------
-- 3. flashcards
-- ------------------------------------------------------------
create table public.flashcards (
  id          uuid        not null default gen_random_uuid(),
  note_id     uuid        not null references public.study_notes (id) on delete cascade,
  user_id     uuid        not null references public.users (id) on delete cascade,
  question    text        not null,
  answer      text        not null,
  created_at  timestamptz not null default now(),

  constraint flashcards_pkey primary key (id)
);

create index flashcards_note_id_idx on public.flashcards (note_id);
create index flashcards_user_id_idx on public.flashcards (user_id);

alter table public.flashcards enable row level security;

-- ------------------------------------------------------------
-- 4. study_groups
-- ------------------------------------------------------------
create table public.study_groups (
  id          uuid        not null default gen_random_uuid(),
  name        text        not null,
  created_by  uuid        not null references public.users (id) on delete cascade,
  created_at  timestamptz not null default now(),

  constraint study_groups_pkey primary key (id)
);

create index study_groups_created_by_idx on public.study_groups (created_by);

alter table public.study_groups enable row level security;

-- ------------------------------------------------------------
-- 5. reminders
-- ------------------------------------------------------------
create table public.reminders (
  id          uuid        not null default gen_random_uuid(),
  user_id     uuid        not null references public.users (id) on delete cascade,
  title       text,
  remind_at   timestamptz,
  is_sent     boolean     not null default false,
  created_at  timestamptz not null default now(),

  constraint reminders_pkey primary key (id)
);

create index reminders_user_id_idx   on public.reminders (user_id);
create index reminders_remind_at_idx on public.reminders (remind_at)
  where is_sent = false;  -- partial index: only unsent reminders need fast lookup

alter table public.reminders enable row level security;
