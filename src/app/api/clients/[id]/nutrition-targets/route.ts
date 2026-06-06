// GET /api/clients/[id]/nutrition-targets — a client's saved target override.
// PUT /api/clients/[id]/nutrition-targets — set a client's targets (coach/admin).
// Writes the same nutrition_targets row the client's own app reads, so the
// edit lands on their device. Notifies + emails the client (nutrition_added).
// Admin: any client. Trainer: only their assigned clients.

import { NextResponse } from "next/server";
import { requireClientAccess } from "@/lib/admin/requireClientAccess";
import { notifyClient } from "@/lib/server/notifications";
import { rowToOverride, bodyToRow } from "@/lib/server/nutritionTargets";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireClientAccess(id);
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.admin
    .from("nutrition_targets")
    .select("calories,protein_g,carbs_g,fat_g,water_ml")
    .eq("user_id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ targets: null }); // table not migrated yet
  return NextResponse.json({ targets: rowToOverride(data) });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireClientAccess(id);
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const row = bodyToRow(body);
  const { data, error } = await auth.admin
    .from("nutrition_targets")
    .upsert({ user_id: id, ...row, updated_by: auth.actorId, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
    .select("calories,protein_g,carbs_g,fat_g,water_ml")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Best-effort: tell the client their targets changed (in-app + email).
  let email: string | null = null;
  try {
    const { data: prof } = await auth.admin.from("profiles").select("email").eq("id", id).maybeSingle();
    email = (prof?.email as string | null) ?? null;
  } catch { /* email is best-effort */ }
  const cals = row.calories;
  await notifyClient({
    userId: id,
    type: "nutrition_added",
    title: "Your coach updated your nutrition targets",
    body: cals ? `Your daily target is now ${cals} kcal. Open Flowstate to see your macros.` : "Open Flowstate to see your updated macros.",
    link: "/nutrition",
    actorName: auth.authorName,
    email,
  });

  return NextResponse.json({ targets: rowToOverride(data) });
}
