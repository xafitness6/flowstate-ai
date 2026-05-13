// POST /api/admin/assign-workout
// Admin-only: insert a builder workout into another user's programs table.
// Self-assign uses the regular client + RLS — this route is for cross-user.
//
// Body: { targetUserId: string; payload: BuilderWorkoutPayload; activate: boolean }

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { builderPayloadToProgramRow, type BuilderWorkoutPayload } from "@/lib/db/programs";

type Body = {
  targetUserId?: unknown;
  payload?:      unknown;
  activate?:     unknown;
};

function isPayload(v: unknown): v is BuilderWorkoutPayload {
  if (!v || typeof v !== "object") return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p.workoutName === "string" &&
    typeof p.goal === "string" &&
    Array.isArray(p.exercises) &&
    Array.isArray(p.sections)
  );
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const targetUserId = typeof body.targetUserId === "string" ? body.targetUserId : "";
  const activate     = body.activate === true;

  if (!targetUserId) {
    return NextResponse.json({ error: "targetUserId is required" }, { status: 400 });
  }
  if (!isPayload(body.payload)) {
    return NextResponse.json({ error: "payload is invalid" }, { status: 400 });
  }

  const { admin } = auth;

  // Confirm the target exists
  const { data: target, error: targetErr } = await admin
    .from("profiles")
    .select("id,email,full_name")
    .eq("id", targetUserId)
    .maybeSingle();

  if (targetErr || !target) {
    return NextResponse.json({ error: "Target user not found" }, { status: 404 });
  }

  if (activate) {
    await admin
      .from("programs")
      .update({ status: "archived" })
      .eq("user_id", targetUserId)
      .eq("status", "active");
  }

  const row = builderPayloadToProgramRow(body.payload, { status: activate ? "active" : "archived" });

  const { data, error } = await admin
    .from("programs")
    .insert({ ...row, user_id: targetUserId })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, program: data, target });
}
