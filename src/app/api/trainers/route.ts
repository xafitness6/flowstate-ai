// POST   /api/trainers  — create a trainer (master only)
// DELETE /api/trainers  — delete a trainer (master only)
//
// ⚠ PRODUCTION NOTE: actorRole is read from a request header here because
// this app uses localStorage-based auth. In production, derive role from
// a verified JWT/session — never trust role from the request body.

import { NextRequest, NextResponse } from "next/server";

function requireMaster(req: NextRequest): Response | null {
  const actorRole = req.headers.get("x-actor-role") ?? "";
  if (actorRole !== "master") {
    return NextResponse.json({ error: "Master role required" }, { status: 403 });
  }
  return null;
}

// POST /api/trainers — create a new trainer
export async function POST(req: NextRequest) {
  const forbidden = requireMaster(req);
  if (forbidden) return forbidden;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { id, name, email, plan, joinDate } = body as Record<string, string>;
  if (!id || !name || !email) {
    return NextResponse.json({ error: "id, name, and email are required" }, { status: 400 });
  }

  // In production: insert into DB here.
  // Client store handles the localStorage write after this 200.
  return NextResponse.json({
    ok: true,
    trainer: { id, name, email, role: "trainer", plan: plan ?? "pro", joinDate: joinDate ?? "" },
  });
}

// DELETE /api/trainers — delete a trainer by id
export async function DELETE(req: NextRequest) {
  const forbidden = requireMaster(req);
  if (forbidden) return forbidden;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { trainerId } = body as { trainerId?: string };
  if (!trainerId) {
    return NextResponse.json({ error: "trainerId is required" }, { status: 400 });
  }

  // In production: delete from DB, unassign clients here.
  // Client store handles the localStorage mutation after this 200.
  return NextResponse.json({ ok: true, trainerId });
}
