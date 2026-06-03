-- ─── Nutrition log sources: allow current app logging modes ──────────────────
-- Photo scan and barcode/manual quick-add flows write structured meals through
-- nutrition_logs. The original table constraint only allowed manual/voice/coach.

ALTER TABLE public.nutrition_logs
  DROP CONSTRAINT IF EXISTS nutrition_logs_source_check;

ALTER TABLE public.nutrition_logs
  ADD CONSTRAINT nutrition_logs_source_check
  CHECK (source IN ('manual', 'voice', 'coach', 'photo', 'barcode'));
