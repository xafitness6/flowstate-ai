// Trainer ↔ client direct messages (coach side).
//   GET  /api/clients/[id]/messages → thread (marks client→coach msgs read)
//   POST /api/clients/[id]/messages { text } → coach sends, notifies the client
// Admin: any client. Trainer: assigned only.

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
    .from("client_messages")
    .select("id,from_coach,text,created_at,read_at")
    .eq("client_id", id)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) return NextResponse.json({ messages: [] });

  // Mark the client's messages as read now that the coach is viewing.
  await auth.admin.from("client_messages").update({ read_at: new Date().toISOString() })
    .eq("client_id", id).eq("from_coach", false).is("read_at", null);

  return NextResponse.json({ messages: data ?? [] });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireClientAccess(id);
  if (!auth.ok) return auth.response;

  let body: { text?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const text = typeof body.text === "string" ? body.text.trim().slice(0, 4000) : "";
  if (!text) return NextResponse.json({ error: "Empty message." }, { status: 400 });

  const { data, error } = await auth.admin
    .from("client_messages")
    .insert({ client_id: id, sender_id: auth.actorId, from_coach: true, text })
    .select("id,from_coach,text,created_at,read_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let email: string | null = null;
  try { const { data: p } = await auth.admin.from("profiles").select("email").eq("id", id).maybeSingle(); email = (p?.email as string | null) ?? null; } catch { /* best-effort */ }
  await notifyClient({
    userId: id, type: "general",
    title: `Message from ${auth.authorName ?? "your coach"}`,
    body: text.slice(0, 140), link: "/messages", actorName: auth.authorName, email,
  });

  return NextResponse.json({ message: data });
}
