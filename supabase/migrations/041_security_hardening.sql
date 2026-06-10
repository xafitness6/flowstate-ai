-- 041 — Security hardening
-- - New signups can only request member/client via metadata; trainer/master are DB-admin only.
-- - Self profile updates cannot change authority, billing, assignment, or archive fields.
-- - Sensitive coach-visible data requires explicit profile opt-ins.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS coach_chat_visible BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS photos_visible BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS meal_logs_visible BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_role text;
BEGIN
  requested_role := COALESCE(NEW.raw_user_meta_data->>'role', 'member');

  INSERT INTO public.profiles (id, email, full_name, first_name, last_name, role, is_admin)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    CASE
      WHEN requested_role IN ('client', 'member') THEN requested_role
      ELSE 'member'
    END,
    false
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.profile_self_update_allowed(
  target_id uuid,
  new_role text,
  new_is_admin boolean,
  new_assigned_trainer_id uuid,
  new_plan text,
  new_subscription_status text,
  new_stripe_customer_id text,
  new_stripe_subscription_id text,
  new_subscription_current_period_end timestamptz,
  new_archived_at timestamptz
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT
      p.id = auth.uid()
      AND p.role = new_role
      AND p.is_admin = new_is_admin
      AND p.assigned_trainer_id IS NOT DISTINCT FROM new_assigned_trainer_id
      AND p.plan = new_plan
      AND p.subscription_status = new_subscription_status
      AND p.stripe_customer_id IS NOT DISTINCT FROM new_stripe_customer_id
      AND p.stripe_subscription_id IS NOT DISTINCT FROM new_stripe_subscription_id
      AND p.subscription_current_period_end IS NOT DISTINCT FROM new_subscription_current_period_end
      AND p.archived_at IS NOT DISTINCT FROM new_archived_at
    FROM public.profiles p
    WHERE p.id = target_id
    LIMIT 1
  ), false);
$$;

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    public.profile_self_update_allowed(
      id,
      role,
      is_admin,
      assigned_trainer_id,
      plan,
      subscription_status,
      stripe_customer_id,
      stripe_subscription_id,
      subscription_current_period_end,
      archived_at
    )
  );

DROP POLICY IF EXISTS "profiles_insert_trigger" ON public.profiles;
CREATE POLICY "profiles_insert_trigger"
  ON public.profiles FOR INSERT
  WITH CHECK (false);

DROP POLICY IF EXISTS "nutrition_logs_select_trainer" ON public.nutrition_logs;
CREATE POLICY "nutrition_logs_select_trainer"
  ON public.nutrition_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = user_id
        AND p.assigned_trainer_id = auth.uid()
        AND p.meal_logs_visible = true
    )
  );

DROP POLICY IF EXISTS "coach_conv_select_trainer" ON public.coach_conversations;
CREATE POLICY "coach_conv_select_trainer"
  ON public.coach_conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = user_id
        AND p.assigned_trainer_id = auth.uid()
        AND p.coach_chat_visible = true
    )
  );

DROP POLICY IF EXISTS "progress_photos_select_trainer" ON public.progress_photos;
CREATE POLICY "progress_photos_select_trainer" ON public.progress_photos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = user_id
        AND p.assigned_trainer_id = auth.uid()
        AND p.photos_visible = true
    )
  );

DROP POLICY IF EXISTS "progress_photos_insert_authorized" ON public.progress_photos;
CREATE POLICY "progress_photos_insert_authorized" ON public.progress_photos FOR INSERT
  WITH CHECK (
    bucket_id = 'progress-photos'
    AND (
      auth.uid() = user_id
      OR public.is_admin()
    )
  );

DROP POLICY IF EXISTS "progress_photos_delete_authorized" ON public.progress_photos;
CREATE POLICY "progress_photos_delete_authorized" ON public.progress_photos FOR DELETE
  USING (
    auth.uid() = user_id
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "progress_photos_storage_select_authorized" ON storage.objects;
CREATE POLICY "progress_photos_storage_select_authorized" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'progress-photos'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id::text = (storage.foldername(name))[1]
          AND p.assigned_trainer_id = auth.uid()
          AND p.photos_visible = true
      )
    )
  );

DROP POLICY IF EXISTS "progress_photos_storage_insert_authorized" ON storage.objects;
CREATE POLICY "progress_photos_storage_insert_authorized" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'progress-photos'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.is_admin()
    )
  );

DROP POLICY IF EXISTS "progress_photos_storage_delete_authorized" ON storage.objects;
CREATE POLICY "progress_photos_storage_delete_authorized" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'progress-photos'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.is_admin()
    )
  );

NOTIFY pgrst, 'reload schema';
