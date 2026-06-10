import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { STRIPE_PRICE_IDS, STRIPE_PRICE_IDS_ANNUAL } from "@/lib/plans";
import { EARLY_ACCESS_ENABLED } from "@/lib/earlyAccess";
import { createClient } from "@/lib/supabase/server";
import { appendQuery, sameOriginUrl } from "@/lib/server/security";
import type { Plan } from "@/types";

export async function POST(req: NextRequest) {
  // ── Early access mode: billing is not yet live ───────────────────────────────
  // Return a no-op response so the client knows checkout is disabled.
  // Remove this block when re-enabling live Stripe billing.
  if (EARLY_ACCESS_ENABLED) {
    return NextResponse.json({ earlyAccess: true });
  }

  try {
    const { plan, billing = "monthly", successUrl, cancelUrl } =
      await req.json() as {
        plan:        Plan;
        billing?:    "monthly" | "annual";
        successUrl:  string;
        cancelUrl:   string;
      };

    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const safeSuccessUrl = sameOriginUrl(req, successUrl, "/pricing/success");
    const safeCancelUrl = sameOriginUrl(req, cancelUrl, "/pricing");

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
        url:  appendQuery(safeSuccessUrl, { demo: "true", plan }),
        demo: true,
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode:       "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      // success_url includes session_id so /pricing/success can verify via webhook
      success_url: `${safeSuccessUrl}${safeSuccessUrl.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  safeCancelUrl,
      metadata:    { userId: user.id, plan, billing },
      // Pre-fill email and attach to customer record
      ...(user.email ? { customer_email: user.email } : {}),
      allow_promotion_codes: true,
      subscription_data: {
        metadata: { userId: user.id, plan },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
