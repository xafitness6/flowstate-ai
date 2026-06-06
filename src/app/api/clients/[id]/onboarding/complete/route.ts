// POST /api/clients/[id]/onboarding/complete — trainer/admin marks a client's
// onboarding complete (e.g. after filling it out together on a call). Sets the
// onboarding_state flags so the client isn't routed back into setup and the
// coach view reflects "Complete". Admin: any client. Trainer: assigned only.

import { NextResponse } from "next/server";
import { requireClientAccess } from "@/lib/admin/requireClientAccess";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireClientAccess(id);
  if (!auth.ok) return auth.response;

  const { error } = await auth.admin
    .from("onboarding_state")
    .upsert({
      user_id:              id,
      walkthrough_seen:     true,
      onboarding_complete:  true,
      profile_complete:     true,
      onboarding_completed_at: new Date().toISOString(),
      updated_at:           new Date().toISOString(),
    }, { onConflict: "user_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
