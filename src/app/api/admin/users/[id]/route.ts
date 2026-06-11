// GET    /api/admin/users/[id]  → full profile + onboarding + active program
// PATCH  /api/admin/users/[id]  → update role, plan, subscription_status, onboarding
// Requires the requester to be a platform admin (verified server-side via session).
// Uses the service-role admin client to bypass RLS.

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { audit } from "@/lib/server/audit";
import type { Role, Plan, SubscriptionStatus } from "@/lib/supabase/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_ROLES: Role[]                       = ["member", "client", "trainer", "master"];
const ALLOWED_PLANS: Plan[]                       = ["foundation", "training", "performance", "coaching"];
const ALLOWED_STATUSES: SubscriptionStatus[]      = ["inactive", "active", "past_due"];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: targetId } = await params;

  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { admin } = auth;

  const [profileRes, onboardingRes, programRes] = await Promise.all([
    admin.from("profiles").select("*").eq("id", targetId).maybeSingle(),
    admin.from("onboarding_state").select("*").eq("user_id", targetId).maybeSingle(),
    admin
      .from("programs")
      .select("*")
      .eq("user_id", targetId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!profileRes.data) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (profileRes.error) {
    return NextResponse.json({ error: profileRes.error.message }, { status: 500 });
  }

  return NextResponse.json({
    profile:        profileRes.data,
    onboarding:     onboardingRes.data ?? null,
    activeProgram:  programRes.data ?? null,
  });
}

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
    assigned_trainer_id?:   string | null;
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
  if (body.role               !== undefined) {
    profileFields.role = body.role;
    profileFields.is_admin = body.role === "master";
  }
  if (body.plan               !== undefined) {
    profileFields.plan = body.plan;
    // Manual admin plan edits are temporary comp/access controls until the
    // paywall is wired. Keep status in sync unless the request sets it directly.
    if (body.subscription_status === undefined) {
      profileFields.subscription_status = body.plan === "foundation" ? "inactive" : "active";
    }
  }
  if (body.subscription_status !== undefined) profileFields.subscription_status = body.subscription_status;

  // ── Trainer assignment (assign / change / remove) ─────────────────────────
  // null or "" clears it. A UUID assigns that trainer — verified to actually be
  // a trainer/admin — and stores their name so it's "known" on both files.
  // Only assigned_trainer_id is stored (profiles has no assigned_trainer_name).
  if ("assigned_trainer_id" in body) {
    const tid = body.assigned_trainer_id;
    if (tid === null || tid === "") {
      profileFields.assigned_trainer_id = null;
    } else if (typeof tid === "string" && UUID_RE.test(tid)) {
      const { data: trainer } = await (admin as any)
        .from("profiles")
        .select("id,role,is_admin")
        .eq("id", tid)
        .maybeSingle();
      if (!trainer || !(trainer.role === "trainer" || trainer.role === "master" || trainer.is_admin === true)) {
        return NextResponse.json({ error: "Assigned trainer must be a trainer or admin." }, { status: 400 });
      }
      profileFields.assigned_trainer_id = trainer.id;
    } else {
      return NextResponse.json({ error: "Invalid assigned_trainer_id" }, { status: 400 });
    }
  }

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

  // ── Audit trail ───────────────────────────────────────────────────────────
  // Only emit when something actually changed — log spam adds noise.
  const changedKeys = Object.keys(profileFields).filter((k) => k !== "updated_at");
  if (changedKeys.length > 0 || body.onboarding_complete !== undefined) {
    const summaryBits: string[] = [];
    if (body.role !== undefined)                summaryBits.push(`role → ${body.role}`);
    if (body.plan !== undefined)                summaryBits.push(`plan → ${body.plan}`);
    if (body.subscription_status !== undefined) summaryBits.push(`subscription → ${body.subscription_status}`);
    if ("assigned_trainer_id" in body) {
      summaryBits.push(body.assigned_trainer_id ? `trainer → ${String(body.assigned_trainer_id).slice(0, 8)}` : "trainer cleared");
    }
    if (body.onboarding_complete !== undefined) summaryBits.push(`onboarding ${body.onboarding_complete ? "complete" : "reset"}`);
    await audit({
      actorId:    auth.user.id,
      actorEmail: auth.user.email ?? null,
      actorRole:  "master",
      action:     "admin_update_user",
      targetKind: "user",
      targetId:   targetId,
      summary:    summaryBits.join(" · ") || "admin update",
      details:    { ...profileFields, onboarding_complete: body.onboarding_complete } as Record<string, unknown>,
    });
  }

  return NextResponse.json({ ok: true });
}
