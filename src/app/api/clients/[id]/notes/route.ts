// Client notes — trainer/admin free-text notes on a client.
//   GET    /api/clients/[id]/notes        list (newest first)
//   POST   /api/clients/[id]/notes        { body }  → create
//   DELETE /api/clients/[id]/notes?noteId=…         delete one

import { NextResponse } from "next/server";
import { requireClientAccess } from "@/lib/admin/requireClientAccess";
import { notifyClient } from "@/lib/server/notifications";

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

  let payload: { body?: unknown; shared?: unknown };
  try { payload = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const body = typeof payload.body === "string" ? payload.body.trim() : "";
  if (!body) return NextResponse.json({ error: "Note body is required." }, { status: 400 });
  if (body.length > 5000) return NextResponse.json({ error: "Note is too long (max 5000 chars)." }, { status: 400 });
  const shared = payload.shared === true; // notes are internal unless shared

  const { data, error } = await auth.admin
    .from("client_notes")
    .insert({ client_id: id, author_id: auth.actorId, author_name: auth.authorName, body })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Only a shared note reaches the client (in-app notification, no email).
  // The shared flag is written best-effort so note-saving never breaks before
  // the shared_with_client column migration is applied.
  if (shared) {
    await auth.admin.from("client_notes").update({ shared_with_client: true }).eq("id", (data as { id: string }).id);
    await notifyClient({ userId: id, type: "note", title: "Your coach left you a note", body, actorName: auth.authorName });
  }
  return NextResponse.json({ note: { ...data, shared_with_client: shared } });
}

// PATCH — edit a note's text ({ noteId, body }), or toggle its "shared with
// client" state ({ noteId, shared }). Sharing a previously private note
// notifies the client; editing/un-sharing is silent.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireClientAccess(id);
  if (!auth.ok) return auth.response;

  let payload: { noteId?: unknown; shared?: unknown; body?: unknown };
  try { payload = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const noteId = typeof payload.noteId === "string" ? payload.noteId : "";
  if (!noteId) return NextResponse.json({ error: "Missing noteId" }, { status: 400 });

  // ── Edit the note text ───────────────────────────────────────────────────
  if (typeof payload.body === "string") {
    const body = payload.body.trim();
    if (!body) return NextResponse.json({ error: "Note body is required." }, { status: 400 });
    if (body.length > 5000) return NextResponse.json({ error: "Note is too long (max 5000 chars)." }, { status: 400 });

    // Non-admins may only edit their own notes (same rule as delete).
    const q = auth.admin.from("client_notes").update({ body }).eq("id", noteId).eq("client_id", id);
    if (!auth.isAdmin) q.eq("author_id", auth.actorId);

    const { data, error } = await q.select().maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Note not found." }, { status: 404 });
    return NextResponse.json({ note: data });
  }

  const shared = payload.shared === true;

  // Select only `body` (not the maybe-unmigrated column) so toggling works even
  // before the migration; the UI only sends shared=true from an unshared note.
  const { data: existing } = await auth.admin
    .from("client_notes")
    .select("body")
    .eq("id", noteId)
    .eq("client_id", id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Note not found." }, { status: 404 });

  await auth.admin
    .from("client_notes")
    .update({ shared_with_client: shared })
    .eq("id", noteId)
    .eq("client_id", id);

  if (shared) {
    await notifyClient({ userId: id, type: "note", title: "Your coach left you a note", body: (existing as { body: string }).body, actorName: auth.authorName });
  }
  return NextResponse.json({ ok: true, shared });
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
