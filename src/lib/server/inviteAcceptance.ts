import type { Invite } from "@/lib/supabase/types";
import { notifyClient } from "@/lib/server/notifications";

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

function minimumPlanForRole(_role: InviteRole): InvitePlan {
  // Invite role decides member/client workflow; plan decides feature access.
  // New invite accepts should not override an admin's manual tier decision.
  return "foundation";
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

async function upsertInviteAcceptance(args: {
  admin: AdminClient;
  inviteId: string;
  userId: string;
  email: string;
  fullName: string;
  now: string;
}): Promise<{ ok: boolean; isNew: boolean }> {
  try {
    const { data: existing, error: selectError } = await args.admin
      .from("invite_acceptances")
      .select("id")
      .eq("invite_id", args.inviteId)
      .eq("user_id", args.userId)
      .maybeSingle();

    if (selectError) return { ok: false, isNew: false };

    if (existing?.id) {
      const { error: updateError } = await args.admin
        .from("invite_acceptances")
        .update({
          email: args.email,
          full_name: args.fullName || null,
          last_login_at: args.now,
        })
        .eq("id", existing.id);

      return { ok: !updateError, isNew: false };
    }

    const { error: insertError } = await args.admin
      .from("invite_acceptances")
      .insert({
        invite_id: args.inviteId,
        user_id: args.userId,
        email: args.email,
        full_name: args.fullName || null,
        accepted_at: args.now,
        last_login_at: args.now,
      });

    return { ok: !insertError, isNew: !insertError };
  } catch {
    return { ok: false, isNew: false };
  }
}

async function updateInviteTracking(args: {
  admin: AdminClient;
  invite: Invite;
  userId: string;
  email: string;
  fullName: string;
  now: string;
  isNewAcceptance: boolean;
}) {
  try {
    const currentCount = Number(args.invite.accepted_count ?? 0);
    const alreadyDirectAccepted =
      args.invite.invite_type !== "open" &&
      args.invite.invite_status === "accepted" &&
      args.invite.accepted_by_user_id === args.userId;
    const accepted_count = args.isNewAcceptance && !alreadyDirectAccepted
      ? Math.max(0, currentCount) + 1
      : Math.max(currentCount, alreadyDirectAccepted || args.invite.invite_status === "accepted" ? 1 : 0);

    const update: Record<string, unknown> = {
      accepted_count,
      logged_in_at: args.invite.logged_in_at ?? args.now,
      last_login_at: args.now,
    };

    if (args.isNewAcceptance) {
      update.last_accepted_at = args.now;
      update.last_accepted_by_user_id = args.userId;
      update.last_accepted_email = args.email;
      update.last_accepted_name = args.fullName || null;
    }

    await args.admin
      .from("invites")
      .update(update)
      .eq("id", args.invite.id);
  } catch {
    // Tracking columns are migration 025; acceptance must keep working without them.
  }
}

async function notifyInviteAccepted(args: {
  invite: Invite;
  acceptedName: string;
  acceptedEmail: string;
}) {
  const recipients = [
    args.invite.invited_by_user_id,
    args.invite.assigned_trainer_id,
  ].filter((id, index, all): id is string =>
    Boolean(id) && all.indexOf(id) === index,
  );

  await Promise.all(recipients.map((userId) =>
    notifyClient({
      userId,
      type: "general",
      title: "Invite accepted",
      body: `${args.acceptedName || args.acceptedEmail} accepted an invite and logged in.`,
      link: "/admin/invites",
      actorName: args.acceptedName || args.acceptedEmail,
    }),
  ));
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

  const acceptance = await upsertInviteAcceptance({
    admin,
    inviteId: invite.id,
    userId: user.id,
    email: userEmail,
    fullName,
    now,
  });

  if (invite.invite_type !== "open") {
    const alreadyAcceptedByThisUser =
      invite.invite_status === "accepted" &&
      invite.accepted_by_user_id === user.id;
    const { error: updateError } = await admin
      .from("invites")
      .update({
        invite_status: "accepted",
        accepted_at: alreadyAcceptedByThisUser ? invite.accepted_at ?? now : now,
        accepted_by_user_id: user.id,
      })
      .eq("id", invite.id);

    if (updateError) {
      return { ok: false, status: 500, error: updateError.message };
    }
  }

  await updateInviteTracking({
    admin,
    invite,
    userId: user.id,
    email: userEmail,
    fullName,
    now,
    isNewAcceptance: acceptance.isNew || (
      invite.invite_type !== "open" &&
      invite.invite_status !== "accepted"
    ),
  });

  if (acceptance.isNew || (invite.invite_type !== "open" && invite.invite_status !== "accepted")) {
    await notifyInviteAccepted({ invite, acceptedName: fullName, acceptedEmail: userEmail });
  }

  return { ok: true, role, inviteType: invite.invite_type };
}
