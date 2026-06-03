-- ─── Client/member calendar reminders ───────────────────────────────────────
-- Visible on the owner's calendar. Owners can create their own reminders;
-- assigned trainers/admins can create reminders for clients.

CREATE TABLE IF NOT EXISTS public.calendar_reminders (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id           UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_by_user_id UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title              TEXT        NOT NULL CHECK (length(trim(title)) > 0),
  notes              TEXT,
  due_at             TIMESTAMPTZ NOT NULL,
  done               BOOLEAN     NOT NULL DEFAULT false,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calendar_reminders_owner_due
  ON public.calendar_reminders(owner_id, done, due_at);

ALTER TABLE public.calendar_reminders ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS calendar_reminders_updated_at ON public.calendar_reminders;
CREATE TRIGGER calendar_reminders_updated_at
  BEFORE UPDATE ON public.calendar_reminders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP POLICY IF EXISTS "calendar_reminders_select_authorized" ON public.calendar_reminders;
CREATE POLICY "calendar_reminders_select_authorized" ON public.calendar_reminders FOR SELECT
  USING (
    auth.uid() = owner_id
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = owner_id AND p.assigned_trainer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "calendar_reminders_insert_authorized" ON public.calendar_reminders;
CREATE POLICY "calendar_reminders_insert_authorized" ON public.calendar_reminders FOR INSERT
  WITH CHECK (
    created_by_user_id = auth.uid()
    AND (
      auth.uid() = owner_id
      OR public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = owner_id AND p.assigned_trainer_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "calendar_reminders_update_authorized" ON public.calendar_reminders;
CREATE POLICY "calendar_reminders_update_authorized" ON public.calendar_reminders FOR UPDATE
  USING (
    auth.uid() = owner_id
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = owner_id AND p.assigned_trainer_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = owner_id
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = owner_id AND p.assigned_trainer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "calendar_reminders_delete_authorized" ON public.calendar_reminders;
CREATE POLICY "calendar_reminders_delete_authorized" ON public.calendar_reminders FOR DELETE
  USING (
    auth.uid() = owner_id
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = owner_id AND p.assigned_trainer_id = auth.uid()
    )
  );
