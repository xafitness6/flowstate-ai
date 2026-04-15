-- Migration 004: Early access defaults
-- Grants complimentary Elite access (plan='coaching', subscription_status='active')
-- to all existing users and sets these as the defaults for new signups.
--
-- This migration is safe to run repeatedly (idempotent via ALTER COLUMN DEFAULT).
--
-- To reverse when billing goes live:
--   1. Remove NEXT_PUBLIC_EARLY_ACCESS_MODE from .env.local
--   2. Run migration 005 to reset defaults back to 'foundation' / 'inactive'
--   3. Do NOT change existing user records — let Stripe webhooks set real status

-- ── New user defaults ──────────────────────────────────────────────────────────
-- New signups via DB trigger will inherit these column defaults.

ALTER TABLE profiles
  ALTER COLUMN plan               SET DEFAULT 'coaching',
  ALTER COLUMN subscription_status SET DEFAULT 'active';

-- ── Backfill existing users ────────────────────────────────────────────────────
-- Upgrades any user who hasn't paid (inactive/foundation) to complimentary Elite.
-- Skips users who already have an active paid subscription (stripe_customer_id set).
-- Never downgrades a paying user.

UPDATE profiles
SET
  plan                = 'coaching',
  subscription_status = 'active',
  updated_at          = now()
WHERE
  stripe_customer_id IS NULL        -- not a paying Stripe customer
  AND subscription_status != 'active' -- not already active
  OR (
    stripe_customer_id IS NULL
    AND plan != 'coaching'          -- paying users keep their plan
  );

-- Simpler, safer version: grant Elite to everyone without a Stripe customer ID.
-- Comment the block above and uncomment below if you want a clean blanket grant:
--
-- UPDATE profiles
-- SET plan = 'coaching', subscription_status = 'active', updated_at = now()
-- WHERE stripe_customer_id IS NULL;
