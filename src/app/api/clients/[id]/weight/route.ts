// Client bodyweight logs for Progress.
// Client/member: own logs. Admin: any client. Trainer: only assigned clients.

import { NextResponse } from "next/server";
import { requireClientAccess } from "@/lib/admin/requireClientAccess";
import { syncWeightLogFromIntake } from "@/lib/server/weightLogs";

type WeightPayload = {
  weight_kg?: unknown;
  logged_at?: unknown;
  note?: unknown;
};

function normalizeLoggedAt(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return new Date().toISOString();
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return `${trimmed}T12:00:00.000Z`;
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function parseWeight(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n) || n <= 0 || n > 1000) return null;
  return Math.round(n * 10) / 10;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireClientAccess(id, { allowSelf: true });
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.admin
    .from("weight_logs")
    .select("id,logged_at,weight_kg,note,created_at")
    .eq("user_id", id)
    .order("logged_at", { ascending: false })
    .limit(180);

  if (error) {
    return NextResponse.json({ logs: [], unavailable: true });
  }

  const logs = [...(data ?? [])].reverse();
  if (logs.length > 0) return NextResponse.json({ logs });

  const { data: onboarding } = await auth.admin
    .from("onboarding_state")
    .select("raw_answers,onboarding_completed_at,updated_at")
    .eq("user_id", id)
    .maybeSingle();

  const rawAnswers = onboarding?.raw_answers;
  const result = await syncWeightLogFromIntake(auth.admin, id, rawAnswers, {
    note: "Starting weight from onboarding",
    loggedAt: onboarding?.onboarding_completed_at ?? onboarding?.updated_at,
  });

  return NextResponse.json({ logs: result.log ? [result.log] : [] });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireClientAccess(id, { allowSelf: true });
  if (!auth.ok) return auth.response;

  let payload: WeightPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const weight_kg = parseWeight(payload.weight_kg);
  if (weight_kg == null) {
    return NextResponse.json({ error: "Enter a valid weight." }, { status: 400 });
  }

  const note = typeof payload.note === "string" ? payload.note.trim().slice(0, 1000) : null;

  const { data, error } = await auth.admin
    .from("weight_logs")
    .insert({
      user_id: id,
      weight_kg,
      logged_at: normalizeLoggedAt(payload.logged_at),
      note: note || null,
    })
    .select("id,logged_at,weight_kg,note,created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: "Progress tracking is not ready yet. Apply migration 024." }, { status: 503 });
  }

  return NextResponse.json({ log: data });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireClientAccess(id, { allowSelf: true });
  if (!auth.ok) return auth.response;

  const logId = new URL(req.url).searchParams.get("id");
  if (!logId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { error } = await auth.admin
    .from("weight_logs")
    .delete()
    .eq("id", logId)
    .eq("user_id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
