// Staff-created calendar reminders for a client. These are visible to the
// client/member on their Calendar page.

import { NextResponse } from "next/server";
import { requireClientAccess } from "@/lib/admin/requireClientAccess";
import { notifyClient } from "@/lib/server/notifications";

type ReminderPayload = {
  id?: unknown;
  title?: unknown;
  notes?: unknown;
  due_at?: unknown;
  done?: unknown;
};

function normalizeDueAt(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return `${trimmed}T12:00:00.000Z`;
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function cleanTitle(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 200) : "";
}

function cleanNotes(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 1000) : null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireClientAccess(id);
  if (!auth.ok) return auth.response;

  const { data, error } = await (auth.admin as any)
    .from("calendar_reminders")
    .select("id,owner_id,created_by_user_id,title,notes,due_at,done,created_at,updated_at")
    .eq("owner_id", id)
    .order("done", { ascending: true })
    .order("due_at", { ascending: true });

  if (error) return NextResponse.json({ reminders: [], unavailable: true });
  return NextResponse.json({ reminders: data ?? [] });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireClientAccess(id);
  if (!auth.ok) return auth.response;

  let payload: ReminderPayload;
  try { payload = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = cleanTitle(payload.title);
  const due_at = normalizeDueAt(payload.due_at);
  if (!title) return NextResponse.json({ error: "Reminder title is required." }, { status: 400 });
  if (!due_at) return NextResponse.json({ error: "Choose a valid reminder date." }, { status: 400 });

  const { data, error } = await (auth.admin as any)
    .from("calendar_reminders")
    .insert({
      owner_id: id,
      created_by_user_id: auth.actorId,
      title,
      notes: cleanNotes(payload.notes),
      due_at,
    })
    .select("id,owner_id,created_by_user_id,title,notes,due_at,done,created_at,updated_at")
    .single();

  if (error) return NextResponse.json({ error: "Calendar reminders are not ready yet. Apply migration 026." }, { status: 503 });

  await notifyClient({
    userId: id,
    type: "general",
    title: "Calendar reminder added",
    body: title,
    actorName: auth.authorName,
    link: "/calendar",
  });

  return NextResponse.json({ reminder: data });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireClientAccess(id);
  if (!auth.ok) return auth.response;

  let payload: ReminderPayload;
  try { payload = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const reminderId = typeof payload.id === "string" ? payload.id : "";
  if (!reminderId) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof payload.done === "boolean") patch.done = payload.done;
  if (payload.title !== undefined) {
    const title = cleanTitle(payload.title);
    if (!title) return NextResponse.json({ error: "Reminder title is required." }, { status: 400 });
    patch.title = title;
  }
  if (payload.notes !== undefined) patch.notes = cleanNotes(payload.notes);
  if (payload.due_at !== undefined) {
    const due_at = normalizeDueAt(payload.due_at);
    if (!due_at) return NextResponse.json({ error: "Choose a valid reminder date." }, { status: 400 });
    patch.due_at = due_at;
  }

  const { data, error } = await (auth.admin as any)
    .from("calendar_reminders")
    .update(patch)
    .eq("id", reminderId)
    .eq("owner_id", id)
    .select("id,owner_id,created_by_user_id,title,notes,due_at,done,created_at,updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reminder: data });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireClientAccess(id);
  if (!auth.ok) return auth.response;

  const reminderId = new URL(req.url).searchParams.get("id");
  if (!reminderId) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const { error } = await (auth.admin as any)
    .from("calendar_reminders")
    .delete()
    .eq("id", reminderId)
    .eq("owner_id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
