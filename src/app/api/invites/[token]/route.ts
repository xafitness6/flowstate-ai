import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getSupabaseServiceRoleKey, missingServiceRoleMessage } from "@/lib/supabase/env";
import type { Invite } from "@/lib/supabase/types";
import { acceptInviteForUser } from "@/lib/server/inviteAcceptance";

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

  const result = await acceptInviteForUser(admin, user, invite as Invite);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, inviteType: result.inviteType, role: result.role });
}
