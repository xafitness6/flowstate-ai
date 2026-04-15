// GET /api/admin/users
// Returns all profiles with onboarding state merged in.
// Requires the requester to have role = "master" (verified server-side via session).
// Uses the service-role admin client to bypass RLS.

import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/supabase/types";

export async function GET() {
  // ── Auth: verify requester is master ──────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: actor } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!actor || actor.role !== "master") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── Service-role client check ─────────────────────────────────────────────
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is not configured. Add it to .env.local to enable admin features." },
      { status: 503 },
    );
  }

  // ── Fetch all profiles ────────────────────────────────────────────────────
  const admin = await createAdminClient();

  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 500 });
  }

  // ── Merge onboarding state ────────────────────────────────────────────────
  const { data: onboarding } = await admin
    .from("onboarding_state")
    .select("user_id, onboarding_complete");

  const onboardingMap = new Map(
    ((onboarding ?? []) as Array<{ user_id: string; onboarding_complete: boolean }>)
      .map((o) => [o.user_id, o.onboarding_complete])
  );

  const users = (profiles as Profile[]).map((p) => ({
    ...p,
    onboarding_complete: onboardingMap.get(p.id) ?? false,
  }));

  return NextResponse.json({ users });
}
