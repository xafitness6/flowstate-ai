-- Admin authority is DB-first after bootstrap.
-- setup-admin.mjs is responsible for granting master/is_admin to the owner.
-- New Auth users must not be promoted by a hardcoded email in the signup trigger.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_role text;
BEGIN
  requested_role := COALESCE(NEW.raw_user_meta_data->>'role', 'client');

  INSERT INTO public.profiles (id, email, full_name, first_name, last_name, role, is_admin)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    CASE
      WHEN requested_role IN ('trainer', 'client', 'member') THEN requested_role
      ELSE 'client'
    END,
    false
  );

  RETURN NEW;
END;
$$;
