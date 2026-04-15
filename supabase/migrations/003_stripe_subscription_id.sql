-- Migration 003: Add stripe_subscription_id and subscription_current_period_end
-- These are written by the Stripe webhook handler (server-side, service role)

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_subscription_id        TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS profiles_stripe_subscription_id_idx
  ON profiles (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;
