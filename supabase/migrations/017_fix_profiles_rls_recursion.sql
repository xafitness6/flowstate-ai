-- Fix profiles RLS self-recursion.
--
-- The old profiles policies queried public.profiles from inside policies on
-- public.profiles, which can trigger:
--   infinite recursion detected in policy for relation "profiles"
--
-- Use SECURITY DEFINER helper functions for role/admin checks, then keep the
-- profile policies themselves free of direct self-referential SELECTs.

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

CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT (is_admin OR role = 'master')
      FROM public.profiles
      WHERE id = auth.uid()
      LIMIT 1
    ),
    false
  );
$$;

-- Keep legacy callers working, but make the function role-aware.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.current_user_is_admin();
$$;

DROP POLICY IF EXISTS "profiles_select_trainer_clients" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;

CREATE POLICY "profiles_select_trainer_clients"
  ON public.profiles FOR SELECT
  USING (
    assigned_trainer_id = auth.uid()
    AND public.current_user_role() IN ('trainer', 'master')
  );

CREATE POLICY "profiles_select_admin"
  ON public.profiles FOR SELECT
  USING (public.current_user_is_admin());

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role <> 'master'
    AND is_admin = false
  );

CREATE POLICY "profiles_update_admin"
  ON public.profiles FOR UPDATE
  USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());
