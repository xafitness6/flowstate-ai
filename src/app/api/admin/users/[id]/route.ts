// PATCH /api/admin/users/[id]
// Updates role, plan, subscription_status, and/or onboarding_complete for a user.
// Requires the requester to be a platform admin (verified server-side via session).
// Uses the service-role admin client to bypass RLS.

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import type { Role, Plan, SubscriptionStatus } from "@/lib/supabase/types";

const ALLOWED_ROLES: Role[]                       = ["member", "client", "trainer", "master"];
const ALLOWED_PLANS: Plan[]                       = ["foundation", "training", "performance", "coaching"];
const ALLOWED_STATUSES: SubscriptionStatus[]      = ["inactive", "active", "past_due"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: targetId } = await params;

  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: {
    role?:                  Role;
    plan?:                  Plan;
    subscription_status?:   SubscriptionStatus;
    onboarding_complete?:   boolean;
  };
  try {
    body = await req.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // ── Validate ──────────────────────────────────────────────────────────────
  if (body.role !== undefined && !ALLOWED_ROLES.includes(body.role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  if (body.plan !== undefined && !ALLOWED_PLANS.includes(body.plan)) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }
  if (body.subscription_status !== undefined && !ALLOWED_STATUSES.includes(body.subscription_status)) {
    return NextResponse.json({ error: "Invalid subscription_status" }, { status: 400 });
  }

  const { admin } = auth;
  const now   = new Date().toISOString();

  // ── Update profiles ───────────────────────────────────────────────────────
  const profileFields: Record<string, unknown> = {};
  if (body.role               !== undefined) profileFields.role               = body.role;
  if (body.plan               !== undefined) profileFields.plan               = body.plan;
  if (body.subscription_status !== undefined) profileFields.subscription_status = body.subscription_status;

  if (Object.keys(profileFields).length > 0) {
    profileFields.updated_at = now;
    const { error } = await (admin as any)
      .from("profiles")
      .update(profileFields)
      .eq("id", targetId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // ── Update onboarding_state ───────────────────────────────────────────────
  if (body.onboarding_complete !== undefined) {
    const { error } = await (admin as any)
      .from("onboarding_state")
      .update({ onboarding_complete: body.onboarding_complete, updated_at: now })
      .eq("user_id", targetId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
