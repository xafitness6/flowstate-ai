// GET /api/clients/[id]/program — the client's active training program.
// Admin: any client. Trainer: only their assigned clients.
// Returns the active program (or null) plus a count of all programs the
// client owns, so the trainer can see whether they have a history.

import { NextResponse } from "next/server";
import { requireClientAccess } from "@/lib/admin/requireClientAccess";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireClientAccess(id);
  if (!auth.ok) return auth.response;

  const [{ data: active, error: activeErr }, { count }] = await Promise.all([
    auth.admin
      .from("programs")
      .select("*")
      .eq("user_id", id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    auth.admin
      .from("programs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", id),
  ]);

  if (activeErr) return NextResponse.json({ error: activeErr.message }, { status: 500 });

  return NextResponse.json({ program: active ?? null, programCount: count ?? 0 });
}
