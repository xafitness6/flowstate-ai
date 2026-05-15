import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getSupabaseServiceRoleKey, missingServiceRoleMessage } from "@/lib/supabase/env";
import type { Invite } from "@/lib/supabase/types";

type InviteRole = "member" | "client";
type InvitePlan = "foundation" | "training" | "performance" | "coaching";

const PLAN_RANK: Record<InvitePlan, number> = {
  foundation:  1,
  training:    2,
  performance: 3,
  coaching:    4,
};

function isExpired(invite: Invite): boolean {
  return Boolean(invite.expires_at && new Date(invite.expires_at).getTime() < Date.now());
}

function isPlan(value: unknown): value is InvitePlan {
  return typeof value === "string" && value in PLAN_RANK;
}

function minimumPlanForRole(role: InviteRole): InvitePlan {
  return role === "client" ? "training" : "foundation";
}

function resolveInvitePlan(existingPlan: unknown, role: InviteRole): InvitePlan {
  const minimum = minimumPlanForRole(role);
  if (isPlan(existingPlan) && PLAN_RANK[existingPlan] >= PLAN_RANK[minimum]) {
    return existingPlan;
  }
  return minimum;
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!token || token.length < 16) {
    return NextResponse.json({ error: "Invalid invite token." }, { status: 400 });
  }

  if (!getSupabaseServiceRoleKey()) {
    return NextResponse.json({ error: missingServiceRoleMessage() }, { status: 503 });
  }

  const admin = await createAdminClient();
  const { data, error } = await admin
    .from("invites")
    .select("*")
    .eq("invite_token", token)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Invite not found." }, { status: 404 });
  }

  return NextResponse.json({ invite: data });
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!token || token.length < 16) {
    return NextResponse.json({ error: "Invalid invite token." }, { status: 400 });
  }

  if (!getSupabaseServiceRoleKey()) {
    return NextResponse.json({ error: missingServiceRoleMessage() }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user?.email) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const admin = await createAdminClient();
  const { data: invite, error: inviteError } = await admin
    .from("invites")
    .select("*")
    .eq("invite_token", token)
    .maybeSingle();

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 500 });
  }

  if (!invite) {
    return NextResponse.json({ error: "Invite not found." }, { status: 404 });
  }

  if (invite.invite_status === "revoked") {
    return NextResponse.json({ error: "This invite has been revoked." }, { status: 410 });
  }

  if (isExpired(invite)) {
    await admin
      .from("invites")
      .update({ invite_status: "expired" })
      .eq("id", invite.id);
    return NextResponse.json({ error: "This invite has expired." }, { status: 410 });
  }

  const inviteEmail = invite.invite_email?.trim().toLowerCase() ?? "";
  const userEmail = user.email.trim().toLowerCase();
  if (inviteEmail && inviteEmail !== userEmail) {
    return NextResponse.json(
      { error: "This invite was sent to a different email address." },
      { status: 403 },
    );
  }

  if (
    invite.invite_type !== "open" &&
    invite.invite_status === "accepted" &&
    invite.accepted_by_user_id !== user.id
  ) {
    return NextResponse.json({ error: "This invite has already been used." }, { status: 409 });
  }

  const metadata = user.user_metadata ?? {};
  const metadataName = typeof metadata.full_name === "string" ? metadata.full_name.trim() : "";
  const invitedFullName = `${invite.first_name ?? ""} ${invite.last_name ?? ""}`.trim();
  const fallbackName = metadataName || invitedFullName || userEmail;
  const split = splitName(fallbackName);
  const firstName = invite.first_name?.trim() || split.firstName || null;
  const lastName = invite.last_name?.trim() || split.lastName || null;
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || fallbackName;

  const { data: existingProfile } = await admin
    .from("profiles")
    .select("plan,default_dashboard,push_level,subscription_status,assigned_trainer_id")
    .eq("id", user.id)
    .maybeSingle();

  const role: InviteRole = invite.invite_role === "member" ? "member" : "client";
  const plan = resolveInvitePlan(existingProfile?.plan, role);
  const now = new Date().toISOString();

  const { error: profileError } = await admin
    .from("profiles")
    .upsert(
      {
        id: user.id,
        email: userEmail,
        first_name: firstName,
        last_name: lastName,
        full_name: fullName,
        role,
        is_admin: false,
        assigned_trainer_id: invite.assigned_trainer_id ?? existingProfile?.assigned_trainer_id ?? null,
        plan,
        default_dashboard: existingProfile?.default_dashboard ?? "dashboard",
        push_level: existingProfile?.push_level ?? 5,
        subscription_status: existingProfile?.subscription_status ?? "active",
        updated_at: now,
      },
      { onConflict: "id" },
    );

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  if (invite.invite_type !== "open") {
    const { error: updateError } = await admin
      .from("invites")
      .update({
        invite_status: "accepted",
        accepted_at: now,
        accepted_by_user_id: user.id,
      })
      .eq("id", invite.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, inviteType: invite.invite_type, role });
}
