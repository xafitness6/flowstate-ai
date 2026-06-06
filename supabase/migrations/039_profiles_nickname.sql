-- 039 — Display nickname (preferred name shown app-wide for coaches + clients)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nickname TEXT;
