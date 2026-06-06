// GET  /api/me/learn-progress — the signed-in user's completed Learn articles.
// POST /api/me/learn-progress  { articleId, done } — mark complete / incomplete.
// DB-backed so progress follows the user across devices and the coach can see it.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ completed: [] }, { status: 401 });

  const { data, error } = await supabase
    .from("learn_progress")
    .select("article_id")
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ completed: [] }); // table not migrated yet
  return NextResponse.json({ completed: (data ?? []).map((r) => r.article_id as string) });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: { articleId?: unknown; done?: unknown };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const articleId = typeof body.articleId === "string" ? body.articleId : "";
  if (!articleId) return NextResponse.json({ error: "Missing articleId" }, { status: 400 });

  // RLS lets a user write only their own rows.
  if (body.done === true) {
    const { error } = await supabase.from("learn_progress").upsert(
      { user_id: user.id, article_id: articleId, completed_at: new Date().toISOString() },
      { onConflict: "user_id,article_id" },
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabase.from("learn_progress").delete().eq("user_id", user.id).eq("article_id", articleId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
