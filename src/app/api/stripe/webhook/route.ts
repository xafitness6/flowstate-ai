import { NextRequest, NextResponse } from "next/server";
import { stripe, STRIPE_WEBHOOK_SECRET } from "@/lib/stripe";
import { STRIPE_PRICE_IDS, STRIPE_PRICE_IDS_ANNUAL } from "@/lib/plans";
import type Stripe from "stripe";
import type { Plan, SubscriptionStatus } from "@/types";

// ─── IMPORTANT: History retention guarantee ───────────────────────────────────
// Webhook handlers NEVER delete user data (workouts, nutrition, streaks,
// heatmap, accountability logs). On downgrade, user plan is updated to
// "foundation" but all historical data remains intact in storage.
// Feature gating is enforced client-side via usePlan() hook — visibility only.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Plan lookup from Stripe price ID ────────────────────────────────────────

function planFromPriceId(priceId: string): Plan | null {
  // Check monthly IDs first
  for (const [plan, id] of Object.entries(STRIPE_PRICE_IDS)) {
    if (id && id === priceId) return plan as Plan;
  }
  // Check annual IDs
  for (const [plan, id] of Object.entries(STRIPE_PRICE_IDS_ANNUAL)) {
    if (id && id === priceId) return plan as Plan;
  }
  return null;
}

// Map Stripe subscription status → our SubscriptionStatus
function stripeStatusToOurs(status: Stripe.Subscription.Status): SubscriptionStatus {
  if (status === "active" || status === "trialing") return "active";
  if (status === "past_due" || status === "unpaid")  return "past_due";
  return "inactive";
}

// ─── DB update helpers (require admin client — server-side only) ──────────────

type ProfileUpdate = Record<string, unknown>;

async function updateByUserId(userId: string, updates: ProfileUpdate): Promise<void> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin.from("profiles") as any)
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw new Error(`[webhook] updateByUserId failed: ${(error as { message: string }).message}`);
}

async function updateByCustomerId(customerId: string, updates: ProfileUpdate): Promise<void> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin.from("profiles") as any)
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("stripe_customer_id", customerId);
  if (error) throw new Error(`[webhook] updateByCustomerId failed: ${(error as { message: string }).message}`);
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body      = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;

  try {
    if (STRIPE_WEBHOOK_SECRET) {
      event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);
    } else {
      // Dev mode: parse without verification (never in production)
      event = JSON.parse(body) as Stripe.Event;
    }
  } catch (err) {
    console.error("[webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Only run DB writes when Supabase is configured
  const supabaseConfigured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    switch (event.type) {

      // ── Checkout completed: initial subscription purchase ──────────────────
      case "checkout.session.completed": {
        const session    = event.data.object as Stripe.Checkout.Session;
        const { userId, plan } = session.metadata ?? {};
        const customerId = typeof session.customer === "string" ? session.customer : null;
        const subId      = typeof session.subscription === "string" ? session.subscription : null;

        console.log(`[webhook] checkout.session.completed user=${userId} plan=${plan}`);

        if (userId && plan && supabaseConfigured) {
          // Fetch subscription to get period end
          let periodEnd: string | null = null;
          if (subId) {
            try {
              const sub = await stripe.subscriptions.retrieve(subId);
              // In Stripe SDK v22+, period_end is on SubscriptionItem
              const itemPeriodEnd = sub.items?.data?.[0]?.current_period_end;
              if (itemPeriodEnd) {
                periodEnd = new Date(itemPeriodEnd * 1000).toISOString();
              }
            } catch { /* non-blocking */ }
          }

          await updateByUserId(userId, {
            plan,
            subscription_status:             "active",
            stripe_customer_id:              customerId,
            stripe_subscription_id:          subId,
            subscription_current_period_end: periodEnd,
          });
        }
        break;
      }

      // ── Subscription updated (plan change, renewal, status change) ─────────
      case "customer.subscription.updated": {
        const sub        = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : null;
        const priceId    = sub.items.data[0]?.price?.id ?? null;
        const plan       = priceId ? planFromPriceId(priceId) : null;
        const status     = stripeStatusToOurs(sub.status);
        // In Stripe SDK v22+, period_end is on SubscriptionItem
        const itemPeriodEnd = sub.items?.data?.[0]?.current_period_end;
        const periodEnd  = itemPeriodEnd ? new Date(itemPeriodEnd * 1000).toISOString() : null;

        console.log(`[webhook] customer.subscription.updated sub=${sub.id} status=${sub.status} plan=${plan ?? "unknown"}`);

        if (customerId && supabaseConfigured) {
          await updateByCustomerId(customerId, {
            ...(plan ? { plan } : {}),
            subscription_status:             status,
            stripe_subscription_id:          sub.id,
            subscription_current_period_end: periodEnd,
          });
        }
        break;
      }

      // ── Subscription cancelled: downgrade to foundation ────────────────────
      case "customer.subscription.deleted": {
        const sub        = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : null;

        console.log(`[webhook] customer.subscription.deleted sub=${sub.id} — downgrading to foundation`);

        // DATA IS NEVER DELETED. Plan downgraded only, history stays intact.
        if (customerId && supabaseConfigured) {
          await updateByCustomerId(customerId, {
            plan:                            "foundation",
            subscription_status:             "inactive",
            stripe_subscription_id:          null,
            subscription_current_period_end: null,
          });
        }
        break;
      }

      // ── Invoice paid: keep subscription active (handles renewals) ─────────
      case "invoice.payment_succeeded": {
        const invoice    = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === "string" ? invoice.customer : null;

        console.log(`[webhook] invoice.payment_succeeded customer=${customerId}`);

        if (customerId && supabaseConfigured) {
          await updateByCustomerId(customerId, {
            subscription_status: "active",
          });
        }
        break;
      }

      // ── Payment failed: mark as past_due ──────────────────────────────────
      case "invoice.payment_failed": {
        const invoice    = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === "string" ? invoice.customer : null;

        console.log(`[webhook] invoice.payment_failed customer=${customerId}`);

        if (customerId && supabaseConfigured) {
          await updateByCustomerId(customerId, {
            subscription_status: "past_due",
          });
        }
        break;
      }

      default:
        // Unhandled event type — ignore safely
        break;
    }
  } catch (err) {
    console.error("[webhook] Handler error:", err);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// Required: disable body parsing so we get the raw body for signature verification
export const runtime = "nodejs";
