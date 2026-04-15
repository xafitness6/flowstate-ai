import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { STRIPE_PRICE_IDS, STRIPE_PRICE_IDS_ANNUAL } from "@/lib/plans";
import { EARLY_ACCESS_ENABLED } from "@/lib/earlyAccess";
import type { Plan } from "@/types";

export async function POST(req: NextRequest) {
  // ── Early access mode: billing is not yet live ───────────────────────────────
  // Return a no-op response so the client knows checkout is disabled.
  // Remove this block when re-enabling live Stripe billing.
  if (EARLY_ACCESS_ENABLED) {
    return NextResponse.json({ earlyAccess: true });
  }

  try {
    const { plan, userId, email, billing = "monthly", successUrl, cancelUrl } =
      await req.json() as {
        plan:        Plan;
        userId:      string;
        email?:      string;
        billing?:    "monthly" | "annual";
        successUrl:  string;
        cancelUrl:   string;
      };

    const priceMap = billing === "annual" ? STRIPE_PRICE_IDS_ANNUAL : STRIPE_PRICE_IDS;
    const priceId  = priceMap[plan];
    if (!priceId) {
      return NextResponse.json(
        { error: "No price configured for this plan" },
        { status: 400 }
      );
    }

    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === "sk_test_placeholder") {
      // Demo mode: skip real Stripe, redirect to success page with mock data
      return NextResponse.json({
        url:  `${successUrl}?demo=true&plan=${plan}`,
        demo: true,
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode:       "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      // success_url includes session_id so /pricing/success can verify via webhook
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  cancelUrl,
      metadata:    { userId, plan, billing },
      // Pre-fill email and attach to customer record
      ...(email ? { customer_email: email } : {}),
      allow_promotion_codes: true,
      subscription_data: {
        metadata: { userId, plan },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
