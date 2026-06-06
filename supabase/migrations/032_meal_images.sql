-- 032 — Cached per-dish meal images
--
-- A generated photo is keyed by the dish's food composition (dish_key), not by
-- the client or the plan. The image is generated ONCE per dish and reused
-- everywhere that dish appears — calories differ client-by-client but the
-- picture is shared. Files live in a PRIVATE Storage bucket ("meal-images",
-- created out-of-band like progress-photos) and are served via short-lived
-- signed URLs from the API. Writes happen via the service role.
CREATE TABLE IF NOT EXISTS public.meal_images (
  dish_key     TEXT        PRIMARY KEY,
  label        TEXT,
  prompt       TEXT,
  storage_path TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.meal_images ENABLE ROW LEVEL SECURITY;
-- No public read policy: access is mediated by the API (service role), which
-- returns signed URLs only to authenticated coaches/clients.
