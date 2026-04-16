-- Add walkthrough_seen to onboarding_state.
-- Default TRUE so existing users who already onboarded don't see the walkthrough retroactively.
-- New rows written by the app will have this omitted (treated as NULL/false until the app writes it).

ALTER TABLE public.onboarding_state
  ADD COLUMN IF NOT EXISTS walkthrough_seen BOOLEAN NOT NULL DEFAULT true;
