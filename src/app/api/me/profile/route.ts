// PATCH /api/me/profile — let the signed-in user update their own display name.
// Persists to profiles.full_name so it follows them across devices and shows
// everywhere their name/initials appear.

import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ full_name: null, nickname: null }, { status: 401 });
  const { data } = await supabase.from("profiles").select("full_name,nickname").eq("id", user.id).maybeSingle();
  return NextResponse.json({ full_name: data?.full_name ?? null, nickname: data?.nickname ?? null });
}

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: { full_name?: unknown; nickname?: unknown };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const patch: Record<string, unknown> = {};
  if (typeof body.full_name === "string") {
    const n = body.full_name.trim().slice(0, 120);
    if (!n) return NextResponse.json({ error: "Name is required." }, { status: 400 });
    patch.full_name = n;
  }
  if (body.nickname !== undefined) {
    patch.nickname = typeof body.nickname === "string" && body.nickname.trim() ? body.nickname.trim().slice(0, 60) : null;
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  const admin = await createAdminClient();
  const { error } = await admin.from("profiles").update(patch).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, ...patch });
}
