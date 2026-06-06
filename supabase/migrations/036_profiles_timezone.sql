-- 036 — Per-user timezone (IANA, e.g. "America/New_York")
-- Auto-detected from the browser on first app open; user can override in Profile.
-- Scheduled times are stored as absolute instants and displayed in each
-- viewer's local zone, so 1pm EST shows as noon CST for a Central client.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS timezone TEXT;
