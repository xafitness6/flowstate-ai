-- ─── Invite role support ─────────────────────────────────────────────────────
-- Adds an `invite_role` column to `public.invites` so admins can generate
-- signup links for members (self-directed) OR clients (trainer-assigned),
-- and the signup flow knows which role to create.
--
-- Defaults to "client" for legacy invites (no behavior change).

ALTER TABLE public.invites
  ADD COLUMN IF NOT EXISTS invite_role TEXT NOT NULL DEFAULT 'client';

-- Keep the column constrained to known roles. We allow member + client only
-- through invites — never create trainers/admins via public invite links.
ALTER TABLE public.invites
  ADD CONSTRAINT invites_invite_role_check
  CHECK (invite_role IN ('member', 'client'));

CREATE INDEX IF NOT EXISTS idx_invites_role ON public.invites(invite_role);
