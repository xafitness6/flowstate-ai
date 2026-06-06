// GET  /api/clients/[id]/program — the client's active training program.
// POST /api/clients/[id]/program — save a builder program to the client (build
//   or edit from the client file). { payload: BuilderProgramPayload, activate }.
// Admin: any client. Trainer: only their assigned clients. (Unlike the
// admin-only /api/admin/assign-workout, this is gated by requireClientAccess.)

import { NextResponse } from "next/server";
import { requireClientAccess } from "@/lib/admin/requireClientAccess";
import { builderPayloadToProgramRow, type BuilderProgramPayload } from "@/lib/db/programs";
import { isProgramSplitV2 } from "@/lib/program/types";
import { notifyClient } from "@/lib/server/notifications";

function isPayload(v: unknown): v is BuilderProgramPayload {
  if (!v || typeof v !== "object") return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p.name === "string"
    && typeof p.goal === "string"
    && typeof p.weeks === "number"
    && typeof p.daysPerWeek === "number"
    && isProgramSplitV2(p.split)
  );
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireClientAccess(id);
  if (!auth.ok) return auth.response;

  const [{ data: active, error: activeErr }, { count }] = await Promise.all([
    auth.admin
      .from("programs")
      .select("*")
      .eq("user_id", id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    auth.admin
      .from("programs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", id),
  ]);

  if (activeErr) return NextResponse.json({ error: activeErr.message }, { status: 500 });

  return NextResponse.json({ program: active ?? null, programCount: count ?? 0 });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireClientAccess(id);
  if (!auth.ok) return auth.response;

  let body: { payload?: unknown; activate?: unknown };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!isPayload(body.payload)) {
    return NextResponse.json({ error: "Program payload is invalid." }, { status: 400 });
  }
  const activate = body.activate === true;

  // Was there already an active program? Decides assigned vs changed messaging.
  const { data: prevActive } = await auth.admin
    .from("programs")
    .select("id")
    .eq("user_id", id)
    .eq("status", "active")
    .maybeSingle();

  if (activate && prevActive) {
    await auth.admin.from("programs").update({ status: "archived" }).eq("user_id", id).eq("status", "active");
  }

  const row = builderPayloadToProgramRow(body.payload, { status: activate ? "active" : "archived" });
  const { data, error } = await auth.admin
    .from("programs")
    .insert({ ...row, user_id: id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify + email the client when this becomes their active program.
  if (activate) {
    let email: string | null = null;
    try {
      const { data: prof } = await auth.admin.from("profiles").select("email").eq("id", id).maybeSingle();
      email = (prof?.email as string | null) ?? null;
    } catch { /* best-effort */ }
    const changed = !!prevActive;
    await notifyClient({
      userId: id,
      type: changed ? "program_changed" : "program_assigned",
      title: changed ? "Your program was updated" : "New program assigned",
      body: `Your coach ${changed ? "updated" : "assigned"} "${body.payload.name}". Tap to open your program.`,
      link: "/program",
      actorName: auth.authorName,
      email,
    });
  }

  return NextResponse.json({ ok: true, program: data });
}
