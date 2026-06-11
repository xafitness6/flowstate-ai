// DELETE /api/me/account
// User-initiated account deletion. Cascades:
//   1. Cancels active Stripe subscription (so we don't keep charging).
//   2. Removes private Supabase Storage objects (progress-photos/<id>/).
//   3. Deletes the auth.users row — FK ON DELETE CASCADE wipes profiles +
//      every user_id-keyed table (workout_logs, nutrition_logs, weight_logs,
//      coach_conversations, onboarding_state, etc.).
//   4. Audit log entry (see audit_logs table) so a future investigation has
//      a record that a self-delete happened.
//
// Returns 200 on success. The client should then sign out + redirect to /.

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { requireAuthenticatedUser } from "@/lib/server/security";
import { createAdminClient } from "@/lib/supabase/server";
import { log } from "@/lib/server/log";

const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey ? new Stripe(stripeKey) : null;

export async function DELETE() {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth.response;
  const userId = auth.user.id;

  const admin = await createAdminClient();
  const errors: string[] = [];

  // 1. Cancel Stripe subscription if any.
  try {
    const { data: profileRow } = await admin
      .from("profiles")
      .select("stripe_customer_id, stripe_subscription_id")
      .eq("id", userId)
      .maybeSingle();
    const customerId     = (profileRow as { stripe_customer_id?: string | null } | null)?.stripe_customer_id ?? null;
    const subscriptionId = (profileRow as { stripe_subscription_id?: string | null } | null)?.stripe_subscription_id ?? null;
    if (stripe && subscriptionId) {
      await stripe.subscriptions.cancel(subscriptionId);
    } else if (stripe && customerId) {
      // No subscription tracked — defensive: cancel any active ones on the customer.
      const subs = await stripe.subscriptions.list({ customer: customerId, status: "active", limit: 5 });
      for (const sub of subs.data) {
        await stripe.subscriptions.cancel(sub.id);
      }
    }
  } catch (err: unknown) {
    log.warn("[me/account] stripe cancel", err as Error);
    errors.push("Couldn't fully cancel Stripe — contact support if you're still billed.");
  }

  // 2. Remove the user's private storage objects.
  try {
    const { data: list } = await admin.storage.from("progress-photos").list(userId);
    if (list && list.length > 0) {
      await admin.storage
        .from("progress-photos")
        .remove(list.map((entry) => `${userId}/${entry.name}`));
    }
  } catch (err: unknown) {
    log.warn("[me/account] storage remove", err as Error);
  }

  // 3. Audit row BEFORE the auth row is deleted (FK to actor_id would vanish).
  const { audit } = await import("@/lib/server/audit");
  await audit({
    actorId:    userId,
    actorEmail: auth.user.email ?? null,
    actorRole:  "self",
    action:     "self_account_delete",
    targetKind: "user",
    targetId:   userId,
    summary:    "User initiated account deletion",
  });

  // 4. Delete the auth.users row — cascades everywhere else via FK.
  const { error: deleteErr } = await admin.auth.admin.deleteUser(userId);
  if (deleteErr) {
    log.error("[me/account] auth delete", deleteErr);
    return NextResponse.json(
      { error: "Couldn't delete your account. Please contact support." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, errors });
}
