-- 037 — AI client breakdown
-- Cached GPT-4o read of the client's onboarding (how to coach them, injury
-- cautions, focus, red flags). Generated after onboarding / on demand; shown to
-- the coach on the client file.
ALTER TABLE public.onboarding_state ADD COLUMN IF NOT EXISTS ai_breakdown JSONB;
