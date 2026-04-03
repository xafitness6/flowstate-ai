import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { STRIPE_PRICE_IDS } from "@/lib/plans";
import type { Plan } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const { plan, userId, successUrl, cancelUrl } = await req.json() as {
      plan: Plan;
      userId: string;
      successUrl: string;
      cancelUrl: string;
    };

    const priceId = STRIPE_PRICE_IDS[plan];
    if (!priceId) {
      return NextResponse.json({ error: "No price configured for this plan" }, { status: 400 });
    }

    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === "sk_test_placeholder") {
      // Demo mode: return a mock session
      return NextResponse.json({
        url: `${successUrl}?demo=true&plan=${plan}`,
        demo: true,
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}&plan=${plan}`,
      cancel_url:  cancelUrl,
      metadata:    { userId, plan },
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
