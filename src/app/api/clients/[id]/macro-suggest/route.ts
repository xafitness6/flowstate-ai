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
    return NextResponse.json(
      { error: "This client's profile is missing weight/age/sex/height — fill in their onboarding for a calibrated suggestion." },
      { status: 422 },
    );
  }
  return NextResponse.json(result);
}
