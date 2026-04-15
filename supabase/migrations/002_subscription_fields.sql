-- ─── Subscription fields on profiles ─────────────────────────────────────────
-- Adds Stripe lifecycle state and customer ID to user profiles.
-- subscription_status drives the post-login subscription gate in AppShell.
-- Run this after 001_initial_schema.sql.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'inactive'
    CHECK (subscription_status IN ('inactive', 'active', 'past_due')),
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT DEFAULT NULL;

-- Index for Stripe webhook lookups by customer ID
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id
  ON public.profiles (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- Helper function: activate subscription (called from Stripe webhook handler)
CREATE OR REPLACE FUNCTION public.activate_subscription(p_stripe_customer_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET subscription_status = 'active',
      updated_at           = now()
  WHERE stripe_customer_id = p_stripe_customer_id;
END;
$$;

-- Helper function: deactivate subscription (cancellation / payment failure)
CREATE OR REPLACE FUNCTION public.deactivate_subscription(
  p_stripe_customer_id TEXT,
  p_status TEXT DEFAULT 'inactive'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET subscription_status = p_status,
      updated_at           = now()
  WHERE stripe_customer_id = p_stripe_customer_id;
END;
$$;
