-- 022 — Note sharing
-- client_notes are internal trainer notes by default. A trainer can flip a note
-- to "shared with client", which notifies the client and lets them read it.
ALTER TABLE public.client_notes
  ADD COLUMN IF NOT EXISTS shared_with_client BOOLEAN NOT NULL DEFAULT false;
