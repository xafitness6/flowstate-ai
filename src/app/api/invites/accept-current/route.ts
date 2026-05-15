import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getSupabaseServiceRoleKey, missingServiceRoleMessage } from "@/lib/supabase/env";
import type { Invite } from "@/lib/supabase/types";
import { acceptInviteForUser } from "@/lib/server/inviteAcceptance";

export async function POST() {
  if (!getSupabaseServiceRoleKey()) {
    return NextResponse.json({ error: missingServiceRoleMessage() }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user?.email) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const email = user.email.trim().toLowerCase();
  const admin = await createAdminClient();
  const { data: invites, error: inviteError } = await admin
    .from("invites")
    .select("*")
    .eq("invite_type", "direct")
    .in("invite_status", ["pending", "sent", "accepted"])
    .ilike("invite_email", email)
    .order("invited_at", { ascending: false })
    .limit(5);

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 500 });
  }

  for (const invite of (invites ?? []) as Invite[]) {
    const result = await acceptInviteForUser(admin, user, invite);
    if (result.ok) {
      return NextResponse.json({ ok: true, inviteType: result.inviteType, role: result.role });
    }
    if (![409, 410].includes(result.status)) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
  }

  return NextResponse.json({ ok: false, reason: "no_pending_invite" });
}
