// POST /api/me/nutrition-request — a coached client asks their coach for a
// nutrition change (targets, foods, etc.). Drops an in-app notification on the
// coach (links to the client's file). The coach approves/applies from their
// side; clients don't edit coach-controlled targets directly.

import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: { message?: unknown };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return NextResponse.json({ error: "Describe the change you'd like." }, { status: 400 });
  if (message.length > 1000) return NextResponse.json({ error: "Keep it under 1000 characters." }, { status: 400 });

  const admin = await createAdminClient();
  const { data: prof } = await admin
    .from("profiles")
    .select("assigned_trainer_id,full_name,first_name,email")
    .eq("id", user.id)
    .maybeSingle();
  const trainerId = (prof?.assigned_trainer_id as string | null) ?? null;
  if (!trainerId) return NextResponse.json({ error: "You don't have a coach assigned." }, { status: 400 });

  const clientName = (prof?.full_name as string) || (prof?.first_name as string) || (prof?.email as string) || "Your client";

  // Notify the coach (their NotificationBell picks this up). Best-effort.
  try {
    await admin.from("notifications").insert({
      user_id: trainerId,
      type: "general",
      title: `Nutrition change request from ${clientName}`,
      body: message,
      link: `/clients/${user.id}`,
      actor_name: clientName,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't send the request." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
