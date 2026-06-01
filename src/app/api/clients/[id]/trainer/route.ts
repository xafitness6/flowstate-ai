// GET   /api/clients/[id]/trainer — list assignable trainers (trainers + admins)
// PATCH /api/clients/[id]/trainer — assign / change / remove this client's trainer
//   body { assigned_trainer_id: string | null }  (null or "" clears it)
// GET: admin or the client's trainer. PATCH: admin only (reassigning is privileged).

import { NextResponse } from "next/server";
import { requireClientAccess } from "@/lib/admin/requireClientAccess";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const labelFor = (p: { full_name?: string | null; email?: string | null }) =>
  (typeof p.full_name === "string" && p.full_name.trim()) || p.email || "Coach";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireClientAccess(id);
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.admin
    .from("profiles")
    .select("id,full_name,email,role")
    .in("role", ["trainer", "master"])
    .order("full_name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const options = (data ?? []).map((p) => ({ value: p.id as string, label: labelFor(p) }));
  return NextResponse.json({ options });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireClientAccess(id);
  if (!auth.ok) return auth.response;
  if (!auth.isAdmin) {
    return NextResponse.json({ error: "Only admins can change a client's trainer." }, { status: 403 });
  }

  let body: { assigned_trainer_id?: unknown };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const tid = body.assigned_trainer_id;
  let fields: { assigned_trainer_id: string | null; assigned_trainer_name: string | null };

  if (tid === null || tid === "") {
    fields = { assigned_trainer_id: null, assigned_trainer_name: null };
  } else if (typeof tid === "string" && UUID_RE.test(tid)) {
    const { data: trainer } = await auth.admin
      .from("profiles")
      .select("id,role,is_admin,full_name,email")
      .eq("id", tid)
      .maybeSingle();
    if (!trainer || !(trainer.role === "trainer" || trainer.role === "master" || trainer.is_admin === true)) {
      return NextResponse.json({ error: "Assigned trainer must be a trainer or admin." }, { status: 400 });
    }
    fields = { assigned_trainer_id: trainer.id, assigned_trainer_name: labelFor(trainer) };
  } else {
    return NextResponse.json({ error: "Invalid assigned_trainer_id" }, { status: 400 });
  }

  const { error } = await auth.admin
    .from("profiles")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, ...fields });
}
