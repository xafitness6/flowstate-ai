import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getSupabaseServiceRoleKey, missingServiceRoleMessage } from "@/lib/supabase/env";
import type { Invite } from "@/lib/supabase/types";
import { acceptInviteForUser } from "@/lib/server/inviteAcceptance";

type AdminClient = Awaited<ReturnType<typeof createAdminClient>>;

async function markInviteOpened(admin: AdminClient, invite: Invite, req: NextRequest) {
  try {
    const now = new Date().toISOString();
    const currentCount = Number((invite as { open_count?: unknown }).open_count ?? 0);
    const userAgent = (req.headers.get("user-agent") ?? "").slice(0, 500) || null;

    await admin
      .from("invites")
      .update({
        first_opened_at: invite.first_opened_at ?? now,
        last_opened_at: now,
        open_count: Math.max(0, currentCount) + 1,
        last_opened_user_agent: userAgent,
      })
      .eq("id", invite.id);
  } catch {
    // Tracking is non-critical and migration 025 may not be applied yet.
  }
}

export async function GET(
  req: NextRequest,
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

  await markInviteOpened(admin, data as Invite, req);

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

  const result = await acceptInviteForUser(admin, user, invite as Invite);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, inviteType: result.inviteType, role: result.role });
}
