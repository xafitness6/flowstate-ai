// The signed-in client's scheduled workouts.
//   GET   /api/me/scheduled-workouts          → list (date asc)
//   PATCH /api/me/scheduled-workouts { id, scheduled_date } → RESCHEDULE only
// Clients can move a workout to another day but cannot delete it (RLS: no delete
// policy; this route only updates the date).

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const SELECT = "id,title,scheduled_date,status,completed_log_id";
const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ scheduled: [] }, { status: 401 });
  const { data, error } = await supabase
    .from("scheduled_workouts").select(SELECT).eq("client_id", user.id).order("scheduled_date", { ascending: true });
  if (error) return NextResponse.json({ scheduled: [] });
  return NextResponse.json({ scheduled: data ?? [] });
}

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  let body: { id?: unknown; scheduled_date?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const swId = typeof body.id === "string" ? body.id : "";
  if (!swId || !isDate(body.scheduled_date)) return NextResponse.json({ error: "Need id + a valid date." }, { status: 400 });

  // Reschedule only — date column. (Client cannot delete.)
  const { error } = await supabase
    .from("scheduled_workouts")
    .update({ scheduled_date: body.scheduled_date, updated_at: new Date().toISOString() })
    .eq("id", swId).eq("client_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
