import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getSupabaseServiceRoleKey, missingServiceRoleMessage } from "@/lib/supabase/env";

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
