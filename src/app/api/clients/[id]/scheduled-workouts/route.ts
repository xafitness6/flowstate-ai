// Coach-scheduled workouts for a client (Trainerize-style).
//   GET    /api/clients/[id]/scheduled-workouts        list (date asc)
//   POST   /api/clients/[id]/scheduled-workouts        { title, scheduled_date, programId?, workoutRef? }
//   PATCH  /api/clients/[id]/scheduled-workouts        { id, scheduled_date?, status? }
//   DELETE /api/clients/[id]/scheduled-workouts?id=…   (coach only; clients can't delete)
// Admin: any client. Trainer: assigned only.

import { NextResponse } from "next/server";
import { requireClientAccess } from "@/lib/admin/requireClientAccess";
import { notifyClient } from "@/lib/server/notifications";

const SELECT = "id,title,scheduled_date,status,program_id,workout_ref,completed_log_id,created_at";
const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireClientAccess(id);
  if (!auth.ok) return auth.response;
  const { data, error } = await auth.admin
    .from("scheduled_workouts").select(SELECT).eq("client_id", id).order("scheduled_date", { ascending: true });
  if (error) return NextResponse.json({ scheduled: [] });
  return NextResponse.json({ scheduled: data ?? [] });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireClientAccess(id);
  if (!auth.ok) return auth.response;

  let body: { title?: unknown; scheduled_date?: unknown; programId?: unknown; workoutRef?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 200) : "";
  if (!title) return NextResponse.json({ error: "Workout title required." }, { status: 400 });
  if (!isDate(body.scheduled_date)) return NextResponse.json({ error: "Valid date required." }, { status: 400 });

  const { data, error } = await auth.admin.from("scheduled_workouts").insert({
    client_id: id, title, scheduled_date: body.scheduled_date,
    program_id: typeof body.programId === "string" ? body.programId : null,
    workout_ref: typeof body.workoutRef === "string" ? body.workoutRef : null,
    created_by: auth.actorId,
  }).select(SELECT).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    const { data: prof } = await auth.admin.from("profiles").select("email").eq("id", id).maybeSingle();
    await notifyClient({
      userId: id, type: "workout_added",
      title: "A workout was scheduled for you",
      body: `${title} · ${new Date(body.scheduled_date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}`,
      link: "/program", actorName: auth.authorName, email: (prof?.email as string | null) ?? null,
    });
  } catch { /* non-fatal */ }

  return NextResponse.json({ workout: data });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireClientAccess(id);
  if (!auth.ok) return auth.response;
  let body: { id?: unknown; scheduled_date?: unknown; status?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const swId = typeof body.id === "string" ? body.id : "";
  if (!swId) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (isDate(body.scheduled_date)) patch.scheduled_date = body.scheduled_date;
  if (body.status === "scheduled" || body.status === "completed" || body.status === "skipped") patch.status = body.status;

  const { data, error } = await auth.admin.from("scheduled_workouts").update(patch).eq("id", swId).eq("client_id", id).select(SELECT).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ workout: data });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireClientAccess(id);
  if (!auth.ok) return auth.response;
  const swId = new URL(req.url).searchParams.get("id");
  if (!swId) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const { error } = await auth.admin.from("scheduled_workouts").delete().eq("id", swId).eq("client_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
