// GET /api/admin/users
// Returns all profiles with onboarding state merged in.
// Requires the requester to be a platform admin (verified server-side via session).
// Uses the service-role admin client to bypass RLS.

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import type { Profile } from "@/lib/supabase/types";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  // ── Fetch all profiles ────────────────────────────────────────────────────
  const { admin } = auth;

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
