// ─── Stripe server-side client ────────────────────────────────────────────────
// Import ONLY in server components / API routes — never in client components.

import Stripe from "stripe";

// Stripe initializes with a placeholder when the key is absent.
// The checkout/portal routes detect this at request-time and return demo responses.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder", {
  apiVersion: "2025-03-31.basil",
  typescript: true,
});

export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";
