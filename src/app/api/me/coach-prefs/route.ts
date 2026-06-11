// GET + PATCH /api/me/coach-prefs
// User-controlled coach voice settings: nickname + intensity (1-5) + strong-
// language opt-in. Persisted on profiles so they roam across devices and are
// trusted server-side by /api/ai/coach.

import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/server/security";
import { createAdminClient } from "@/lib/supabase/server";

type Prefs = {
  nickname:            string  | null;
  coach_intensity:     number;
  coach_strong_language: boolean;
};

export async function GET() {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth.response;
  const admin = await createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("nickname, coach_intensity, coach_strong_language")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ prefs: null, unavailable: true });
  }
  const row = (data ?? {}) as Partial<Prefs>;
  return NextResponse.json({
    prefs: {
      nickname:            row.nickname ?? null,
      coach_intensity:     typeof row.coach_intensity === "number" ? row.coach_intensity : 3,
      coach_strong_language: row.coach_strong_language === true,
    } satisfies Prefs,
  });
}

export async function PATCH(req: Request) {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth.response;

  let body: { nickname?: unknown; coach_intensity?: unknown; coach_strong_language?: unknown };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: Partial<Prefs> = {};

  if ("nickname" in body) {
    if (body.nickname === null || body.nickname === "") patch.nickname = null;
    else if (typeof body.nickname === "string") {
      const trimmed = body.nickname.trim().slice(0, 60);
      if (trimmed.length === 0) patch.nickname = null;
      else patch.nickname = trimmed;
    } else {
      return NextResponse.json({ error: "Invalid nickname" }, { status: 400 });
    }
  }

  if ("coach_intensity" in body) {
    const v = typeof body.coach_intensity === "number" ? body.coach_intensity : Number(body.coach_intensity);
    if (!Number.isFinite(v) || v < 1 || v > 5) {
      return NextResponse.json({ error: "Intensity must be 1–5" }, { status: 400 });
    }
    patch.coach_intensity = Math.round(v);
  }

  if ("coach_strong_language" in body) {
    if (typeof body.coach_strong_language !== "boolean") {
      return NextResponse.json({ error: "coach_strong_language must be boolean" }, { status: 400 });
    }
    patch.coach_strong_language = body.coach_strong_language;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const admin = await createAdminClient();
  const { error } = await admin.from("profiles").update(patch).eq("id", auth.user.id);
  if (error) {
    return NextResponse.json({ error: "Couldn't save preferences. Apply migration 042." }, { status: 503 });
  }
  return NextResponse.json({ ok: true, prefs: patch });
}
