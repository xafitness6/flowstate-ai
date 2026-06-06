// The signed-in client's message thread with their human coach.
//   GET  /api/me/messages → { messages, hasCoach, coachName, unread }
//          (marks coach→client messages read)
//   POST /api/me/messages { text } → client sends, notifies the coach

import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ messages: [], hasCoach: false, unread: 0 }, { status: 401 });

  const admin = await createAdminClient();
  const { data: prof } = await admin.from("profiles").select("assigned_trainer_id").eq("id", user.id).maybeSingle();
  const trainerId = (prof?.assigned_trainer_id as string | null) ?? null;
  let coachName: string | null = null;
  if (trainerId) {
    const { data: tr } = await admin.from("profiles").select("nickname,full_name,first_name,email").eq("id", trainerId).maybeSingle();
    coachName = (tr?.nickname as string) || (tr?.full_name as string) || (tr?.first_name as string) || (tr?.email as string) || "Your coach";
  }

  const { data } = await supabase
    .from("client_messages")
    .select("id,from_coach,text,created_at,read_at")
    .eq("client_id", user.id)
    .order("created_at", { ascending: true })
    .limit(200);

  // Mark the coach's messages read now that the client is viewing.
  await admin.from("client_messages").update({ read_at: new Date().toISOString() })
    .eq("client_id", user.id).eq("from_coach", true).is("read_at", null);

  return NextResponse.json({ messages: data ?? [], hasCoach: !!trainerId, coachName, unread: 0 });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: { text?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const text = typeof body.text === "string" ? body.text.trim().slice(0, 4000) : "";
  if (!text) return NextResponse.json({ error: "Empty message." }, { status: 400 });

  // Client insert allowed by RLS (from_coach=false, own client_id).
  const { data, error } = await supabase
    .from("client_messages")
    .insert({ client_id: user.id, sender_id: user.id, from_coach: false, text })
    .select("id,from_coach,text,created_at,read_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify the coach (in-app).
  try {
    const admin = await createAdminClient();
    const { data: prof } = await admin.from("profiles").select("assigned_trainer_id,nickname,full_name,first_name,email").eq("id", user.id).maybeSingle();
    const trainerId = (prof?.assigned_trainer_id as string | null) ?? null;
    if (trainerId) {
      const who = (prof?.nickname as string) || (prof?.full_name as string) || (prof?.first_name as string) || (prof?.email as string) || "Your client";
      await admin.from("notifications").insert({
        user_id: trainerId, type: "general", title: `Message from ${who}`, body: text.slice(0, 140), link: `/clients/${user.id}`, actor_name: who,
      });
    }
  } catch { /* non-fatal */ }

  return NextResponse.json({ message: data });
}
