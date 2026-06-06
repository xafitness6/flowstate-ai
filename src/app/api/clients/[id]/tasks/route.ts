// Coach-assigned accountability tasks for a client.
//   GET    /api/clients/[id]/tasks            list (newest first)
//   POST   /api/clients/[id]/tasks            { title, detail?, due_date? } → assign
//   PATCH  /api/clients/[id]/tasks            { taskId, title?, detail?, due_date?, done? }
//   DELETE /api/clients/[id]/tasks?taskId=…   remove
// Admin: any client. Trainer: only assigned clients.

import { NextResponse } from "next/server";
import { requireClientAccess } from "@/lib/admin/requireClientAccess";
import { notifyClient } from "@/lib/server/notifications";

const SELECT = "id,title,detail,due_date,done,done_at,seen_at,assigned_by_name,created_at";
const cleanDate = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireClientAccess(id);
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.admin
    .from("client_tasks")
    .select(SELECT)
    .eq("client_id", id)
    .order("done", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ tasks: [] }); // table not migrated yet
  return NextResponse.json({ tasks: data ?? [] });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireClientAccess(id);
  if (!auth.ok) return auth.response;

  let body: { title?: unknown; detail?: unknown; due_date?: unknown };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ error: "Task needs a title." }, { status: 400 });

  const { data, error } = await auth.admin
    .from("client_tasks")
    .insert({
      client_id: id,
      assigned_by: auth.actorId,
      assigned_by_name: auth.authorName,
      title: title.slice(0, 300),
      detail: typeof body.detail === "string" && body.detail.trim() ? body.detail.trim().slice(0, 2000) : null,
      due_date: cleanDate(body.due_date),
    })
    .select(SELECT)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // In-app notification only (no email — these are nudges).
  await notifyClient({
    userId: id,
    type: "task",
    title: "New task from your coach",
    body: title,
    link: "/accountability",
    actorName: auth.authorName,
  });

  return NextResponse.json({ task: data });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireClientAccess(id);
  if (!auth.ok) return auth.response;

  let body: { taskId?: unknown; title?: unknown; detail?: unknown; due_date?: unknown; done?: unknown };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const taskId = typeof body.taskId === "string" ? body.taskId : "";
  if (!taskId) return NextResponse.json({ error: "Missing taskId" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body.title === "string") { const t = body.title.trim(); if (!t) return NextResponse.json({ error: "Title required." }, { status: 400 }); patch.title = t.slice(0, 300); }
  if (body.detail !== undefined) patch.detail = typeof body.detail === "string" && body.detail.trim() ? body.detail.trim().slice(0, 2000) : null;
  if (body.due_date !== undefined) patch.due_date = cleanDate(body.due_date);
  if (typeof body.done === "boolean") { patch.done = body.done; patch.done_at = body.done ? new Date().toISOString() : null; }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  const { data, error } = await auth.admin
    .from("client_tasks")
    .update(patch)
    .eq("id", taskId)
    .eq("client_id", id)
    .select(SELECT)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ task: data });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireClientAccess(id);
  if (!auth.ok) return auth.response;

  const taskId = new URL(req.url).searchParams.get("taskId");
  if (!taskId) return NextResponse.json({ error: "Missing taskId" }, { status: 400 });

  const { error } = await auth.admin.from("client_tasks").delete().eq("id", taskId).eq("client_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
