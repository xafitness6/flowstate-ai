import type { Invite } from "@/lib/supabase/types";

type InviteRole = "member" | "client";
type InvitePlan = "foundation" | "training" | "performance" | "coaching";

type AuthUser = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
};

type AdminClient = {
  from: (table: string) => any;
};

const PLAN_RANK: Record<InvitePlan, number> = {
  foundation:  1,
  training:    2,
  performance: 3,
  coaching:    4,
};

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
    lastName:  parts.slice(1).join(" "),
  };
}

export function isInviteExpired(invite: Invite): boolean {
  return Boolean(invite.expires_at && new Date(invite.expires_at).getTime() < Date.now());
}

export type InviteAcceptanceResult =
  | { ok: true; role: InviteRole; inviteType: Invite["invite_type"] }
  | { ok: false; status: number; error: string };

export async function acceptInviteForUser(
  admin: AdminClient,
  user: AuthUser,
  invite: Invite,
): Promise<InviteAcceptanceResult> {
  if (!user.email) {
    return { ok: false, status: 401, error: "Not authenticated." };
  }

  if (invite.invite_status === "revoked") {
    return { ok: false, status: 410, error: "This invite has been revoked." };
  }

  if (isInviteExpired(invite)) {
    await admin
      .from("invites")
      .update({ invite_status: "expired" })
      .eq("id", invite.id);
    return { ok: false, status: 410, error: "This invite has expired." };
  }

  const inviteEmail = invite.invite_email?.trim().toLowerCase() ?? "";
  const userEmail = user.email.trim().toLowerCase();
  if (inviteEmail && inviteEmail !== userEmail) {
    return { ok: false, status: 403, error: "This invite was sent to a different email address." };
  }

  if (
    invite.invite_type !== "open" &&
    invite.invite_status === "accepted" &&
    invite.accepted_by_user_id !== user.id
  ) {
    return { ok: false, status: 409, error: "This invite has already been used." };
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
    return { ok: false, status: 500, error: profileError.message };
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
      return { ok: false, status: 500, error: updateError.message };
    }
  }

  return { ok: true, role, inviteType: invite.invite_type };
}
