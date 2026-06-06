// GET /api/clients/[id]/engagement — coach-facing engagement summary:
//   - Learn progress (overall + per category)
//   - App activity: last seen, active days in the last 30, last sign-in, joined
// Admin: any client. Trainer: only assigned clients. Resilient to unmigrated DB.

import { NextResponse } from "next/server";
import { requireClientAccess } from "@/lib/admin/requireClientAccess";
import { LEARN_ARTICLES, LEARN_CATEGORIES } from "@/lib/learn/content";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireClientAccess(id);
  if (!auth.ok) return auth.response;

  // ── Learn progress ──
  let completed: string[] = [];
  try {
    const { data } = await auth.admin.from("learn_progress").select("article_id").eq("user_id", id);
    completed = (data ?? []).map((r) => r.article_id as string);
  } catch { /* table missing */ }
  const doneSet = new Set(completed);
  const learn = {
    done: LEARN_ARTICLES.filter((a) => doneSet.has(a.id)).length,
    total: LEARN_ARTICLES.length,
    byCategory: LEARN_CATEGORIES.map((c) => {
      const arts = LEARN_ARTICLES.filter((a) => a.category === c.id);
      return { id: c.id, label: c.label, done: arts.filter((a) => doneSet.has(a.id)).length, total: arts.length };
    }),
  };

  // ── App activity (last 30 days) + last seen ──
  let activeDays30 = 0;
  let lastSeenAt: string | null = null;
  try {
    const since = new Date(Date.now() - 30 * DAY_MS).toISOString().slice(0, 10);
    const { count } = await auth.admin
      .from("app_activity")
      .select("day", { count: "exact", head: true })
      .eq("user_id", id)
      .gte("day", since);
    activeDays30 = count ?? 0;
    const { data: prof } = await auth.admin.from("profiles").select("last_seen_at").eq("id", id).maybeSingle();
    lastSeenAt = (prof?.last_seen_at as string | null) ?? null;
  } catch { /* columns missing */ }

  // ── Accountability tasks roll-up ──
  let tasks = { done: 0, open: 0, overdue: 0 };
  try {
    const { data } = await auth.admin.from("client_tasks").select("done,due_date").eq("client_id", id);
    const today = new Date().toISOString().slice(0, 10);
    const rows = (data ?? []) as { done: boolean; due_date: string | null }[];
    tasks = {
      done: rows.filter((t) => t.done).length,
      open: rows.filter((t) => !t.done).length,
      overdue: rows.filter((t) => !t.done && t.due_date && t.due_date < today).length,
    };
  } catch { /* table missing */ }

  // ── Auth timestamps (last sign-in / joined) ──
  let lastSignInAt: string | null = null;
  let joinedAt: string | null = null;
  try {
    const { data } = await auth.admin.auth.admin.getUserById(id);
    lastSignInAt = data.user?.last_sign_in_at ?? null;
    joinedAt = data.user?.created_at ?? null;
  } catch { /* ignore */ }

  return NextResponse.json({ learn, tasks, activeDays30, lastSeenAt, lastSignInAt, joinedAt });
}
