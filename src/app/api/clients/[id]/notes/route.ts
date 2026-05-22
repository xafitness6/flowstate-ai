// Client notes — trainer/admin free-text notes on a client.
//   GET    /api/clients/[id]/notes        list (newest first)
//   POST   /api/clients/[id]/notes        { body }  → create
//   DELETE /api/clients/[id]/notes?noteId=…         delete one

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
    .from("client_notes")
    .select("*")
    .eq("client_id", id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notes: data ?? [] });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireClientAccess(id);
  if (!auth.ok) return auth.response;

  let payload: { body?: unknown };
  try { payload = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const body = typeof payload.body === "string" ? payload.body.trim() : "";
  if (!body) return NextResponse.json({ error: "Note body is required." }, { status: 400 });
  if (body.length > 5000) return NextResponse.json({ error: "Note is too long (max 5000 chars)." }, { status: 400 });

  const { data, error } = await auth.admin
    .from("client_notes")
    .insert({ client_id: id, author_id: auth.actorId, author_name: auth.authorName, body })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ note: data });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireClientAccess(id);
  if (!auth.ok) return auth.response;

  const noteId = new URL(req.url).searchParams.get("noteId");
  if (!noteId) return NextResponse.json({ error: "Missing noteId" }, { status: 400 });

  // Non-admins may only delete their own notes.
  const query = auth.admin.from("client_notes").delete().eq("id", noteId).eq("client_id", id);
  if (!auth.isAdmin) query.eq("author_id", auth.actorId);

  const { error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
