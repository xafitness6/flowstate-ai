-- Default brand-new self-signups to 'member' (was 'client'). Invite links still
-- pass an explicit role ('member' | 'client') via raw_user_meta_data.role.
-- The owner is never promoted here — admin authority stays DB-first / email
-- safety net in the app layer (see src/lib/auth/owner.ts).

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
      WHEN requested_role IN ('trainer', 'client', 'member') THEN requested_role
      ELSE 'member'
    END,
    false
  );

  RETURN NEW;
END;
$$;
