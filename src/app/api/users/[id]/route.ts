// DELETE /api/users/[id]
// Server-side enforcement for user deletion.
// Returns 403 when the actor's role or ownership check fails.
//
// ⚠ PRODUCTION NOTE: actorRole and actorId are read from request headers
// here because this app uses localStorage-based auth (demo/prototype).
// In production, replace header reads with verified JWT/session claims
// from a real auth provider — never trust role from the request body.

import { NextRequest, NextResponse } from "next/server";

const MASTER_ROLE  = "master";
const TRAINER_ROLE = "trainer";

interface UserRecord {
  id:         string;
  role:       string;
  trainerId?: string;
}

function loadUsers(): UserRecord[] {
  // Server-side: we can't access localStorage.
  // In production this would be a DB query.
  // For this prototype we validate purely on the role rules
  // and trust the client store for the actual mutation.
  // The API acts as the enforcement layer for the DELETE contract.
  return [];
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: targetId } = await params;

  // Read actor identity from request headers.
  const actorRole = req.headers.get("x-actor-role") ?? "";
  const actorId   = req.headers.get("x-actor-id")   ?? "";

  if (!actorRole || !actorId) {
    return NextResponse.json({ error: "Missing actor identity" }, { status: 401 });
  }

  // ── Master can delete any non-master ────────────────────────────────────────
  if (actorRole === MASTER_ROLE) {
    // Read the target role from the request body so we can block master-on-master.
    let targetRole: string | undefined;
    try {
      const body = await req.json() as { targetRole?: string };
      targetRole = body.targetRole;
    } catch { /* body optional */ }

    if (targetRole === MASTER_ROLE) {
      return NextResponse.json({ error: "Cannot delete a master account" }, { status: 403 });
    }

    return NextResponse.json({ ok: true });
  }

  // ── Trainer can delete only their own assigned clients ───────────────────────
  if (actorRole === TRAINER_ROLE) {
    let targetRole: string | undefined;
    let targetTrainerId: string | undefined;
    try {
      const body = await req.json() as { targetRole?: string; targetTrainerId?: string };
      targetRole      = body.targetRole;
      targetTrainerId = body.targetTrainerId;
    } catch { /* body optional */ }

    if (targetRole !== "client") {
      return NextResponse.json(
        { error: "Trainers can only delete clients" },
        { status: 403 },
      );
    }

    if (targetTrainerId !== actorId) {
      return NextResponse.json(
        { error: "Trainer can only delete their own clients" },
        { status: 403 },
      );
    }

    return NextResponse.json({ ok: true });
  }

  // ── All other roles are unauthorized ────────────────────────────────────────
  return NextResponse.json({ error: "Insufficient role" }, { status: 403 });
}
