// Persistent AI-coach conversations for the signed-in user (cross-device).
//   GET    /api/me/coach-conversations         → list (id, preview, updatedAt)
//   GET    /api/me/coach-conversations?id=…     → one conversation's transcript
//   PUT    /api/me/coach-conversations  { id?, transcript } → upsert, returns { id }
//   DELETE /api/me/coach-conversations?id=…     → remove one
// Stored in coach_conversations.transcript (JSONB). Auth'd; written via service role.

import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

type Msg = { role: string; text: string };

function preview(transcript: unknown): string {
  if (!Array.isArray(transcript)) return "New conversation";
  const firstUser = (transcript as Msg[]).find((m) => m?.role === "user" && m.text?.trim());
  return (firstUser?.text ?? (transcript as Msg[]).find((m) => m?.text)?.text ?? "New conversation").slice(0, 80);
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ conversations: [] }, { status: 401 });
  const admin = await createAdminClient();
  const id = new URL(req.url).searchParams.get("id");

  if (id) {
    const { data } = await admin.from("coach_conversations").select("transcript").eq("id", id).eq("user_id", user.id).maybeSingle();
    return NextResponse.json({ transcript: Array.isArray(data?.transcript) ? data!.transcript : [] });
  }

  const { data, error } = await admin
    .from("coach_conversations")
    .select("id,transcript,updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(40);
  if (error) return NextResponse.json({ conversations: [] }); // table not migrated yet
  return NextResponse.json({
    conversations: (data ?? []).map((c) => ({ id: c.id as string, updatedAt: c.updated_at as string, preview: preview(c.transcript) })),
  });
}

export async function PUT(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  let body: { id?: unknown; transcript?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const transcript = Array.isArray(body.transcript) ? body.transcript : [];
  const admin = await createAdminClient();

  if (typeof body.id === "string" && body.id) {
    const { error } = await admin.from("coach_conversations")
      .update({ transcript, updated_at: new Date().toISOString() })
      .eq("id", body.id).eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ id: body.id });
  }
  const { data, error } = await admin.from("coach_conversations")
    .insert({ user_id: user.id, context_type: "chat", transcript })
    .select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: (data as { id: string }).id });
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const admin = await createAdminClient();
  const { error } = await admin.from("coach_conversations").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
