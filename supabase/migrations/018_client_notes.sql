-- ─── Client notes ────────────────────────────────────────────────────────────
-- Free-text notes a trainer or admin keeps on a client's profile. Distinct
-- from `programs.coaching_notes` (program-level) and workout `notes`.
-- One client can have many notes; each records who wrote it.

CREATE TABLE IF NOT EXISTS public.client_notes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_id   UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  author_name TEXT,
  body        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_notes_client  ON public.client_notes(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_notes_author  ON public.client_notes(author_id);

ALTER TABLE public.client_notes ENABLE ROW LEVEL SECURITY;

-- Admins see + manage everything.
CREATE POLICY "client_notes_admin_all"
  ON public.client_notes FOR ALL
  USING (public.is_admin());

-- Trainers can read/write notes for clients assigned to them.
CREATE POLICY "client_notes_trainer_select"
  ON public.client_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = client_notes.client_id
        AND p.assigned_trainer_id = auth.uid()
    )
  );

CREATE POLICY "client_notes_trainer_insert"
  ON public.client_notes FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = client_notes.client_id
        AND p.assigned_trainer_id = auth.uid()
    )
  );

-- Authors can delete their own notes.
CREATE POLICY "client_notes_author_delete"
  ON public.client_notes FOR DELETE
  USING (author_id = auth.uid() OR public.is_admin());
