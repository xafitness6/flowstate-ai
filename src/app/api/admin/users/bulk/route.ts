// POST /api/admin/users/bulk
// Bulk archive or hard-delete users. Master/admin only.
//
// Body shape:
//   { action: "archive" | "unarchive" | "delete", userIds: string[] }
//
// - archive   → sets profiles.archived_at = NOW() (reversible, blocks app access)
// - unarchive → clears profiles.archived_at
// - delete    → removes auth.users (cascades to profile via FK) — irreversible
//
// Self-action protection: the requesting admin cannot archive/delete themselves
// in the same call. Removes the "lock yourself out by accident" footgun.

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";

type BulkAction = "archive" | "unarchive" | "delete";

type BulkBody = {
  action: BulkAction;
  userIds: string[];
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { user, admin } = auth;

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: BulkBody;
  try {
    body = (await req.json()) as BulkBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { action, userIds } = body;
  if (action !== "archive" && action !== "unarchive" && action !== "delete") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return NextResponse.json({ error: "userIds must be a non-empty array" }, { status: 400 });
  }
  if (userIds.length > 200) {
    return NextResponse.json({ error: "Cannot bulk-act on more than 200 users at once" }, { status: 400 });
  }
  if (userIds.some((id) => typeof id !== "string" || !UUID_RE.test(id))) {
    return NextResponse.json({ error: "All userIds must be UUIDs" }, { status: 400 });
  }

  // Refuse to touch the requester's own account in a bulk op.
  const targets = userIds.filter((id) => id !== user.id);
  if (targets.length === 0) {
    return NextResponse.json({ error: "Cannot bulk-act on your own account" }, { status: 400 });
  }

  // ── Execute ───────────────────────────────────────────────────────────────
  if (action === "archive" || action === "unarchive") {
    const archivedAt = action === "archive" ? new Date().toISOString() : null;
    const { error } = await admin
      .from("profiles")
      .update({ archived_at: archivedAt })
      .in("id", targets);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, action, count: targets.length });
  }

  // action === "delete": remove each auth user. Profile + onboarding_state +
  // related rows cascade via ON DELETE in the schema.
  const failures: Array<{ id: string; error: string }> = [];
  for (const id of targets) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) failures.push({ id, error: error.message });
  }

  if (failures.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        action: "delete",
        deleted: targets.length - failures.length,
        failed: failures,
      },
      { status: failures.length === targets.length ? 500 : 207 },
    );
  }

  return NextResponse.json({ ok: true, action: "delete", count: targets.length });
}
