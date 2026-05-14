// PATCH /api/admin/invites/[id]  — revoke an invite
// DELETE /api/admin/invites/[id] — delete an invite

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { admin } = auth;
  const { id } = await params;

  let body: { status?: unknown };
  try { body = (await req.json()) as { status?: unknown }; } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const allowed = ["revoked", "expired"] as const;
  const status = typeof body.status === "string" && (allowed as readonly string[]).includes(body.status)
    ? body.status as typeof allowed[number]
    : null;
  if (!status) {
    return NextResponse.json({ error: "status must be 'revoked' or 'expired'" }, { status: 400 });
  }

  const { error } = await admin
    .from("invites")
    .update({ invite_status: status })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { admin } = auth;
  const { id } = await params;

  const { error } = await admin.from("invites").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
