-- Add first_login flag to profiles.
-- Defaults to true for new users; flipped to false on onboarding completion.
-- Existing users keep first_login = false since they already completed onboarding.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_login BOOLEAN NOT NULL DEFAULT false;

-- New users created after this migration will have first_login = true via default below.
-- We alter the column default for future inserts only.
ALTER TABLE public.profiles
  ALTER COLUMN first_login SET DEFAULT true;
