// POST /api/clients/[id]/macro-suggest  { calories? } → calibrated macros for a
// CLIENT, computed from THEIR profile (Mifflin BMR → TDEE → goal → methodology
// macros) — not a generic guess. Admin: any client. Trainer: assigned only.

import { NextResponse } from "next/server";
import { requireClientAccess } from "@/lib/admin/requireClientAccess";
import { suggestMacros } from "@/lib/server/macroSuggest";
import type { IntakeData } from "@/lib/data/intake";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireClientAccess(id);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({})) as { calories?: number };

  const { data: row } = await auth.admin
    .from("onboarding_state").select("raw_answers").eq("user_id", id).maybeSingle();
  const intake = (row?.raw_answers && typeof row.raw_answers === "object")
    ? row.raw_answers as IntakeData : null;

  const result = suggestMacros(intake, body.calories);
  if (!result) {
    const onboarded = !!intake && Object.keys(intake).length > 0;
    return NextResponse.json(
      {
        error: onboarded
          ? "This client's bodyweight is missing — add it to their profile for a calibrated suggestion."
          : "Fill in this client's onboarding for a calibrated suggestion.",
        needsOnboarding: !onboarded,
      },
      { status: 422 },
    );
  }
  return NextResponse.json(result);
}
