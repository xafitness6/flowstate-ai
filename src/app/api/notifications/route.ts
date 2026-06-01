// GET   /api/notifications        — the signed-in user's notifications (newest first) + unread count
// PATCH /api/notifications         — mark read. Body: { id } for one, or { all: true } for all.
// Own-row RLS; resilient if the table isn't migrated yet (returns empty).

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("notifications")
    .select("id,type,title,body,link,actor_name,read_at,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  // Table may not exist yet (migration not applied) — treat as no notifications.
  if (error) return NextResponse.json({ notifications: [], unread: 0 });

  const notifications = data ?? [];
  const unread = notifications.filter((n) => !n.read_at).length;
  return NextResponse.json({ notifications, unread });
}

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { id?: string; all?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  let q = supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id);
  if (body.all) q = q.is("read_at", null);
  else if (body.id) q = q.eq("id", body.id);
  else return NextResponse.json({ error: "Provide id or all:true" }, { status: 400 });

  const { error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
