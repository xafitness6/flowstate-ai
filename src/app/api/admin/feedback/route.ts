// GET   /api/admin/feedback           — list all reports
// PATCH /api/admin/feedback?id=...    — update status

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";

const ALLOWED_STATUS = new Set(["open", "in_progress", "resolved", "wontfix"]);

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.admin
    .from("feedback_reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reports: data ?? [] });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  let body: { status?: unknown };
  try { body = (await req.json()) as { status?: unknown }; } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const status = typeof body.status === "string" && ALLOWED_STATUS.has(body.status) ? body.status : null;
  if (!status) return NextResponse.json({ error: "invalid status" }, { status: 400 });

  const patch: { status: string; resolved_at?: string | null } = { status };
  if (status === "resolved") patch.resolved_at = new Date().toISOString();
  else if (status === "open" || status === "in_progress") patch.resolved_at = null;

  const { error } = await auth.admin.from("feedback_reports").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
