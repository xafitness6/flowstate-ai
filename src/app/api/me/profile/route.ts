// PATCH /api/me/profile — let the signed-in user update their own display name.
// Persists to profiles.full_name so it follows them across devices and shows
// everywhere their name/initials appear.

import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: { full_name?: unknown };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const full_name = typeof body.full_name === "string" ? body.full_name.trim().slice(0, 120) : "";
  if (!full_name) return NextResponse.json({ error: "Name is required." }, { status: 400 });

  const admin = await createAdminClient();
  const { error } = await admin.from("profiles").update({ full_name }).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, full_name });
}
