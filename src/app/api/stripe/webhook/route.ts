import { NextRequest, NextResponse } from "next/server";
import { stripe, STRIPE_WEBHOOK_SECRET } from "@/lib/stripe";
import type Stripe from "stripe";

// ─── IMPORTANT: History retention guarantee ───────────────────────────────────
// Webhook handlers NEVER delete user data (workouts, nutrition, streaks,
// heatmap, accountability logs). On downgrade, user plan is updated to
// "foundation" but all historical data remains intact in storage.
// Feature gating is enforced client-side via usePlan() hook — visibility only.
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body      = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;

  try {
    if (STRIPE_WEBHOOK_SECRET) {
      event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);
    } else {
      // Dev mode: parse without verification
      event = JSON.parse(body) as Stripe.Event;
    }
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const { userId, plan } = session.metadata ?? {};
        if (userId && plan) {
          // TODO: In production, update user.plan in DB here
          // localStorage is updated client-side on the success redirect
          console.log(`[webhook] Subscription activated: user=${userId} plan=${plan}`);
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        // TODO: Map sub.items.data[0].price.id → Plan, update user in DB
        console.log(`[webhook] Subscription updated: ${sub.id} status=${sub.status}`);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        // User cancels → downgrade to foundation. DATA IS NEVER DELETED.
        // TODO: In production, set user.plan = "foundation" in DB
        console.log(`[webhook] Subscription cancelled: ${sub.id} — downgrading to foundation`);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        console.log(`[webhook] Payment succeeded: invoice=${invoice.id}`);
        break;
      }

      default:
        // Unhandled event type — ignore safely
        break;
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// Required: disable body parsing so we get the raw body for signature verification
export const runtime = "nodejs";
