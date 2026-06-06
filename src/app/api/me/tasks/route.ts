// The signed-in client's coach-assigned tasks.
//   GET   /api/me/tasks                 → { tasks, unseen }
//   PATCH /api/me/tasks  { id, done }    → check off / un-check
//   POST  /api/me/tasks  { action:"seen" } → clear the "new" highlight
// RLS lets a user read + update only their own client_tasks rows.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const SELECT = "id,title,detail,due_date,done,done_at,seen_at,assigned_by_name,created_at";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ tasks: [], unseen: 0 }, { status: 401 });

  const { data, error } = await supabase
    .from("client_tasks")
    .select(SELECT)
    .eq("client_id", user.id)
    .order("done", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ tasks: [], unseen: 0 }); // table not migrated yet
  const tasks = data ?? [];
  const unseen = tasks.filter((t) => !t.seen_at).length;
  return NextResponse.json({ tasks, unseen });
}

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: { id?: unknown; done?: unknown };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const id = typeof body.id === "string" ? body.id : "";
  if (!id || typeof body.done !== "boolean") return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const { error } = await supabase
    .from("client_tasks")
    .update({ done: body.done, done_at: body.done ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("client_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: { action?: unknown };
  try { body = await req.json(); } catch { body = {}; }
  if (body.action !== "seen") return NextResponse.json({ error: "Unknown action." }, { status: 400 });

  // Clear the "new" highlight: stamp seen_at on everything still unseen.
  await supabase
    .from("client_tasks")
    .update({ seen_at: new Date().toISOString() })
    .eq("client_id", user.id)
    .is("seen_at", null);

  return NextResponse.json({ ok: true });
}
