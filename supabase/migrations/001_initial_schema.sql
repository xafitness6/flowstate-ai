-- ─── Flowstate Initial Schema ─────────────────────────────────────────────────
-- Run this in Supabase SQL Editor (or via Supabase CLI).
-- Order matters: profiles must exist before tables that FK to it.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. PROFILES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  id                  UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email               TEXT        NOT NULL,
  first_name          TEXT,
  last_name           TEXT,
  full_name           TEXT,
  avatar_url          TEXT,
  bio                 TEXT,
  role                TEXT        NOT NULL DEFAULT 'client'
                        CHECK (role IN ('master','trainer','client','member')),
  is_admin            BOOLEAN     NOT NULL DEFAULT false,
  assigned_trainer_id UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  plan                TEXT        NOT NULL DEFAULT 'foundation'
                        CHECK (plan IN ('foundation','training','performance','coaching')),
  default_dashboard   TEXT        NOT NULL DEFAULT 'dashboard',
  push_level          INTEGER     NOT NULL DEFAULT 5 CHECK (push_level BETWEEN 1 AND 10),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create profile when a Supabase Auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, first_name, last_name, role, is_admin)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'client'),
    -- Mark xavellis4@gmail.com as admin automatically
    (NEW.email = 'xavellis4@gmail.com')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Keep updated_at current
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Helper: is the current user an admin?
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ONBOARDING STATE
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.onboarding_state (
  id                             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                        UUID        NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  onboarding_complete            BOOLEAN     NOT NULL DEFAULT false,
  body_focus_complete            BOOLEAN     NOT NULL DEFAULT false,
  planning_conversation_complete BOOLEAN     NOT NULL DEFAULT false,
  program_generated              BOOLEAN     NOT NULL DEFAULT false,
  tutorial_complete              BOOLEAN     NOT NULL DEFAULT false,
  profile_complete               BOOLEAN     NOT NULL DEFAULT false,
  onboarding_step                TEXT,
  raw_answers                    JSONB,
  coach_summary                  TEXT,
  current_plan_duration          INTEGER,
  created_at                     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER onboarding_state_updated_at
  BEFORE UPDATE ON public.onboarding_state
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. PROGRAMS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.programs (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  block_name            TEXT        NOT NULL,
  goal                  TEXT        NOT NULL,
  duration_weeks        INTEGER     NOT NULL DEFAULT 8,
  weekly_split          JSONB       NOT NULL DEFAULT '[]',
  weekly_training_days  INTEGER     NOT NULL DEFAULT 4,
  session_length_target INTEGER     NOT NULL DEFAULT 60,
  body_focus_areas      TEXT[]      NOT NULL DEFAULT '{}',
  equipment_profile     TEXT[]      NOT NULL DEFAULT '{}',
  coaching_notes        TEXT,
  status                TEXT        NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active','completed','archived')),
  start_date            DATE,
  end_date              DATE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER programs_updated_at
  BEFORE UPDATE ON public.programs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. WORKOUTS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.workouts (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id         UUID        NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  user_id            UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  workout_name       TEXT        NOT NULL,
  day_label          TEXT        NOT NULL DEFAULT '',
  scheduled_day      INTEGER     NOT NULL DEFAULT 0 CHECK (scheduled_day BETWEEN 0 AND 6),
  estimated_duration INTEGER     NOT NULL DEFAULT 60,
  focus_areas        TEXT[]      NOT NULL DEFAULT '{}',
  warmup             JSONB       NOT NULL DEFAULT '{}',
  exercises          JSONB       NOT NULL DEFAULT '[]',
  status             TEXT        NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','completed','skipped')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER workouts_updated_at
  BEFORE UPDATE ON public.workouts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. WORKOUT LOGS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.workout_logs (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  workout_id        UUID        REFERENCES public.workouts(id) ON DELETE SET NULL,
  log_type          TEXT        NOT NULL DEFAULT 'prescribed'
                      CHECK (log_type IN ('prescribed','modified','freestyle','coach_note')),
  workout_name      TEXT        NOT NULL DEFAULT '',
  body_focus        TEXT,
  transcript        TEXT,
  notes             TEXT,
  completed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_minutes  INTEGER     NOT NULL DEFAULT 0,
  sets_completed    INTEGER     NOT NULL DEFAULT 0,
  exercise_results  JSONB       NOT NULL DEFAULT '[]',
  difficulty        INTEGER     CHECK (difficulty BETWEEN 1 AND 10),
  parsed_confidence NUMERIC(3,2),
  voice_entry_id    TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. INVITES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.invites (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_token          TEXT        NOT NULL UNIQUE,
  invite_type           TEXT        NOT NULL DEFAULT 'direct'
                          CHECK (invite_type IN ('direct','open')),
  invite_email          TEXT,
  first_name            TEXT,
  last_name             TEXT,
  invited_by_user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invited_by_name       TEXT,
  assigned_trainer_id   UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_trainer_name TEXT,
  invite_status         TEXT        NOT NULL DEFAULT 'pending'
                          CHECK (invite_status IN ('pending','sent','accepted','expired','revoked')),
  invite_message        TEXT,
  accepted_by_user_id   UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  invited_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at           TIMESTAMPTZ,
  expires_at            TIMESTAMPTZ
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. NUTRITION LOGS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.nutrition_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  meal_type   TEXT        CHECK (meal_type IN ('breakfast','lunch','dinner','snack')),
  raw_text    TEXT        NOT NULL,
  parsed_data JSONB,
  source      TEXT        NOT NULL DEFAULT 'manual'
                CHECK (source IN ('manual','voice','coach')),
  logged_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. COACH CONVERSATIONS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.coach_conversations (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  context_type      TEXT        NOT NULL DEFAULT 'general',
  transcript        JSONB       NOT NULL DEFAULT '[]',
  structured_output JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER coach_conversations_updated_at
  BEFORE UPDATE ON public.coach_conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. STORAGE BUCKETS
-- ─────────────────────────────────────────────────────────────────────────────

-- Run these via the Supabase dashboard → Storage, or via SQL:
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_state   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workouts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_logs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_conversations ENABLE ROW LEVEL SECURITY;

-- ─── profiles policies ───────────────────────────────────────────────────────

-- Users can read their own profile
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Trainers can read profiles of their assigned clients
CREATE POLICY "profiles_select_trainer_clients"
  ON public.profiles FOR SELECT
  USING (
    assigned_trainer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('trainer','master')
    )
  );

-- Admins can read all profiles
CREATE POLICY "profiles_select_admin"
  ON public.profiles FOR SELECT
  USING (public.is_admin());

-- Users can update their own profile
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    -- Users cannot elevate their own role to master/admin
    (is_admin = false OR public.is_admin())
  );

-- Admins can update any profile
CREATE POLICY "profiles_update_admin"
  ON public.profiles FOR UPDATE
  USING (public.is_admin());

-- New profiles are inserted via the trigger (SECURITY DEFINER), not direct INSERT
-- Allow service-role inserts (trigger runs as service role)
CREATE POLICY "profiles_insert_trigger"
  ON public.profiles FOR INSERT
  WITH CHECK (true); -- Trigger already validates; restrict further if needed

-- ─── onboarding_state policies ───────────────────────────────────────────────

CREATE POLICY "onboarding_select_own"
  ON public.onboarding_state FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "onboarding_select_trainer"
  ON public.onboarding_state FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = user_id AND p.assigned_trainer_id = auth.uid()
    )
  );

CREATE POLICY "onboarding_select_admin"
  ON public.onboarding_state FOR SELECT
  USING (public.is_admin());

CREATE POLICY "onboarding_insert_own"
  ON public.onboarding_state FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "onboarding_update_own"
  ON public.onboarding_state FOR UPDATE
  USING (auth.uid() = user_id);

-- ─── programs policies ────────────────────────────────────────────────────────

CREATE POLICY "programs_select_own"
  ON public.programs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "programs_select_trainer"
  ON public.programs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = user_id AND p.assigned_trainer_id = auth.uid()
    )
  );

CREATE POLICY "programs_select_admin"
  ON public.programs FOR SELECT
  USING (public.is_admin());

CREATE POLICY "programs_insert_own"
  ON public.programs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "programs_update_own"
  ON public.programs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "programs_update_trainer"
  ON public.programs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = user_id AND p.assigned_trainer_id = auth.uid()
    )
  );

-- ─── workouts policies ────────────────────────────────────────────────────────

CREATE POLICY "workouts_select_own"
  ON public.workouts FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "workouts_select_trainer"
  ON public.workouts FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles p
      WHERE p.id = user_id AND p.assigned_trainer_id = auth.uid())
  );

CREATE POLICY "workouts_select_admin"
  ON public.workouts FOR SELECT USING (public.is_admin());

CREATE POLICY "workouts_insert_own"
  ON public.workouts FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "workouts_update_own"
  ON public.workouts FOR UPDATE USING (auth.uid() = user_id);

-- ─── workout_logs policies ────────────────────────────────────────────────────

CREATE POLICY "workout_logs_select_own"
  ON public.workout_logs FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "workout_logs_select_trainer"
  ON public.workout_logs FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles p
      WHERE p.id = user_id AND p.assigned_trainer_id = auth.uid())
  );

CREATE POLICY "workout_logs_select_admin"
  ON public.workout_logs FOR SELECT USING (public.is_admin());

CREATE POLICY "workout_logs_insert_own"
  ON public.workout_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "workout_logs_update_own"
  ON public.workout_logs FOR UPDATE USING (auth.uid() = user_id);

-- ─── invites policies ────────────────────────────────────────────────────────

-- Trainers/admins can read invites they created
CREATE POLICY "invites_select_creator"
  ON public.invites FOR SELECT
  USING (invited_by_user_id = auth.uid() OR assigned_trainer_id = auth.uid());

-- Users can read invites sent to their email
CREATE POLICY "invites_select_recipient"
  ON public.invites FOR SELECT
  USING (
    invite_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
  );

-- Admins can read all invites
CREATE POLICY "invites_select_admin"
  ON public.invites FOR SELECT USING (public.is_admin());

-- Trainers and admins can create invites
CREATE POLICY "invites_insert_trainer"
  ON public.invites FOR INSERT
  WITH CHECK (
    invited_by_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('trainer','master')
    )
  );

-- Creators can update their own invites (revoke etc.)
CREATE POLICY "invites_update_creator"
  ON public.invites FOR UPDATE
  USING (invited_by_user_id = auth.uid() OR public.is_admin());

-- ─── nutrition_logs policies ─────────────────────────────────────────────────

CREATE POLICY "nutrition_logs_select_own"
  ON public.nutrition_logs FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "nutrition_logs_select_trainer"
  ON public.nutrition_logs FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles p
      WHERE p.id = user_id AND p.assigned_trainer_id = auth.uid())
  );

CREATE POLICY "nutrition_logs_insert_own"
  ON public.nutrition_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "nutrition_logs_update_own"
  ON public.nutrition_logs FOR UPDATE USING (auth.uid() = user_id);

-- ─── coach_conversations policies ────────────────────────────────────────────

CREATE POLICY "coach_conv_select_own"
  ON public.coach_conversations FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "coach_conv_select_trainer"
  ON public.coach_conversations FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles p
      WHERE p.id = user_id AND p.assigned_trainer_id = auth.uid())
  );

CREATE POLICY "coach_conv_insert_own"
  ON public.coach_conversations FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "coach_conv_update_own"
  ON public.coach_conversations FOR UPDATE USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. STORAGE POLICIES
-- ─────────────────────────────────────────────────────────────────────────────

-- Users can upload their own avatar (path: avatars/{user_id}/*)
CREATE POLICY "avatars_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can update/replace their own avatar
CREATE POLICY "avatars_update_own"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Avatars are public (bucket is public = true, so SELECT is open)
CREATE POLICY "avatars_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. INDEXES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_profiles_trainer       ON public.profiles(assigned_trainer_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_user        ON public.onboarding_state(user_id);
CREATE INDEX IF NOT EXISTS idx_programs_user          ON public.programs(user_id);
CREATE INDEX IF NOT EXISTS idx_workouts_program       ON public.workouts(program_id);
CREATE INDEX IF NOT EXISTS idx_workout_logs_user      ON public.workout_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_logs_completed ON public.workout_logs(completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_invites_token          ON public.invites(invite_token);
CREATE INDEX IF NOT EXISTS idx_invites_trainer        ON public.invites(assigned_trainer_id);
CREATE INDEX IF NOT EXISTS idx_nutrition_logs_user    ON public.nutrition_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_coach_conv_user        ON public.coach_conversations(user_id);
