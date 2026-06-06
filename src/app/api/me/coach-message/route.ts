// POST /api/me/coach-message — the AI coach relays a message to the client's
// HUMAN coach (when they say "tell my coach…" / "ask my coach to change my
// workout"). Drops an in-app notification on the trainer (bell + client file).

import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: { message?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 1000) : "";
  if (!message) return NextResponse.json({ ok: false });

  const admin = await createAdminClient();
  const { data: prof } = await admin
    .from("profiles")
    .select("assigned_trainer_id,full_name,first_name,email")
    .eq("id", user.id)
    .maybeSingle();
  const trainerId = (prof?.assigned_trainer_id as string | null) ?? null;
  if (!trainerId) return NextResponse.json({ ok: false, noCoach: true });

  const who = (prof?.full_name as string) || (prof?.first_name as string) || (prof?.email as string) || "Your client";
  try {
    await admin.from("notifications").insert({
      user_id: trainerId,
      type: "general",
      title: `${who} asked their coach`,
      body: message,
      link: `/clients/${user.id}`,
      actor_name: who,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't notify coach." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
