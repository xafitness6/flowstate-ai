// Trainer reminders for a client — PRIVATE to the acting trainer/admin, never
// shown to the client. Scoped by trainer_id = caller so each coach sees only
// their own. Resilient if the table isn't migrated yet (GET returns []).
//   GET    /api/clients/[id]/reminders            list (open first, by due date)
//   POST   /api/clients/[id]/reminders            { body, due_date? } → create
//   PATCH  /api/clients/[id]/reminders            { id, done?, body?, due_date? } → toggle/edit
//   DELETE /api/clients/[id]/reminders?id=…        delete one

import { NextResponse } from "next/server";
import { requireClientAccess } from "@/lib/admin/requireClientAccess";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireClientAccess(id);
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.admin
    .from("client_reminders")
    .select("id,body,due_date,done,created_at")
    .eq("client_id", id)
    .eq("trainer_id", auth.actorId)
    .order("done", { ascending: true })
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ reminders: [] }); // table not migrated yet
  return NextResponse.json({ reminders: data ?? [] });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireClientAccess(id);
  if (!auth.ok) return auth.response;

  let payload: { body?: unknown; due_date?: unknown };
  try { payload = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const body = typeof payload.body === "string" ? payload.body.trim() : "";
  if (!body) return NextResponse.json({ error: "Reminder text is required." }, { status: 400 });
  if (body.length > 1000) return NextResponse.json({ error: "Reminder is too long." }, { status: 400 });
  const due_date = typeof payload.due_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(payload.due_date)
    ? payload.due_date : null;

  const { data, error } = await auth.admin
    .from("client_reminders")
    .insert({ trainer_id: auth.actorId, client_id: id, body, due_date })
    .select("id,body,due_date,done,created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reminder: data });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireClientAccess(id);
  if (!auth.ok) return auth.response;

  let payload: { id?: unknown; done?: unknown; body?: unknown; due_date?: unknown };
  try { payload = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const reminderId = typeof payload.id === "string" ? payload.id : "";
  if (!reminderId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  // Build a partial update from whichever fields were supplied: toggle done,
  // edit the text, and/or change the due date.
  const patch: Record<string, unknown> = {};
  if (typeof payload.done === "boolean") patch.done = payload.done;
  if (payload.body !== undefined) {
    const body = typeof payload.body === "string" ? payload.body.trim() : "";
    if (!body) return NextResponse.json({ error: "Reminder text is required." }, { status: 400 });
    if (body.length > 1000) return NextResponse.json({ error: "Reminder is too long." }, { status: 400 });
    patch.body = body;
  }
  if (payload.due_date !== undefined) {
    patch.due_date = typeof payload.due_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(payload.due_date)
      ? payload.due_date : null;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { data, error } = await auth.admin
    .from("client_reminders")
    .update(patch)
    .eq("id", reminderId)
    .eq("client_id", id)
    .eq("trainer_id", auth.actorId)
    .select("id,body,due_date,done,created_at")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, reminder: data });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireClientAccess(id);
  if (!auth.ok) return auth.response;

  const reminderId = new URL(req.url).searchParams.get("id");
  if (!reminderId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { error } = await auth.admin
    .from("client_reminders")
    .delete()
    .eq("id", reminderId)
    .eq("client_id", id)
    .eq("trainer_id", auth.actorId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
