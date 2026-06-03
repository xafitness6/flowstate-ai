-- ─── Fix profiles RLS infinite recursion (live-targeted) ─────────────────────
-- 017 (the full recursion fix) was never applied to the live DB, which still had
-- the original self-referential policy:
--   profiles_select_trainer_clients USING (... EXISTS (SELECT 1 FROM profiles p ...))
-- Selecting from profiles inside a profiles policy triggers:
--   "infinite recursion detected in policy for relation 'profiles'"
-- which surfaced when saving a meal (the request also reads profiles).
--
-- Live is_admin() is already SECURITY DEFINER (safe), so this only adds the
-- role helper and rewrites the one recursive policy. Idempotent.

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

DROP POLICY IF EXISTS "profiles_select_trainer_clients" ON public.profiles;
CREATE POLICY "profiles_select_trainer_clients"
  ON public.profiles FOR SELECT
  USING (
    assigned_trainer_id = auth.uid()
    AND public.current_user_role() IN ('trainer', 'master')
  );

NOTIFY pgrst, 'reload schema';
