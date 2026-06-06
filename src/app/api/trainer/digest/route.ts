// GET /api/trainer/digest — yesterday's activity across the signed-in trainer's
// assigned clients, so a coach can scan the whole roster in a couple minutes:
// who trained, who logged meals (on target / under / over), tasks completed,
// weigh-ins, and who didn't open the app. Service-role read after verifying the
// caller is a trainer/admin.

import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

type Num = number | null;
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await createAdminClient();
  const { data: actor } = await admin.from("profiles").select("role,is_admin").eq("id", user.id).maybeSingle();
  if (!actor || !(actor.role === "trainer" || actor.role === "master" || actor.is_admin === true)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: clientRows } = await admin
    .from("profiles")
    .select("id,full_name,first_name,last_name,email")
    .eq("assigned_trainer_id", user.id);
  const clients = clientRows ?? [];
  const ids = clients.map((c) => c.id);
  if (ids.length === 0) return NextResponse.json({ date: null, clients: [] });

  // Yesterday window (UTC day boundaries).
  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const yStart = new Date(todayUTC.getTime() - 86400000);
  const yStartISO = yStart.toISOString();
  const yEndISO = todayUTC.toISOString();
  const yDate = yStartISO.slice(0, 10);
  const today = todayUTC.toISOString().slice(0, 10);

  // Bulk pulls scoped to the client set.
  const [workouts, meals, targets, tasks, weights, activity, programs] = await Promise.all([
    admin.from("workout_logs").select("user_id,workout_name,completed_at").in("user_id", ids).gte("completed_at", yStartISO).lt("completed_at", yEndISO),
    admin.from("nutrition_logs").select("user_id,calories,protein,logged_at,deleted_at").in("user_id", ids).gte("logged_at", yStartISO).lt("logged_at", yEndISO),
    admin.from("nutrition_targets").select("user_id,calories,protein_g").in("user_id", ids),
    admin.from("client_tasks").select("client_id,done,done_at,due_date").in("client_id", ids),
    admin.from("weight_logs").select("user_id,weight_kg,logged_at").in("user_id", ids).gte("logged_at", yStartISO).lt("logged_at", yEndISO),
    admin.from("app_activity").select("user_id").in("user_id", ids).eq("day", yDate),
    admin.from("programs").select("user_id").eq("status", "active").in("user_id", ids),
  ]);

  const byUser = <T extends { user_id?: string; client_id?: string }>(rows: T[] | null, key: "user_id" | "client_id" = "user_id") => {
    const m = new Map<string, T[]>();
    for (const r of rows ?? []) { const k = (r[key] as string); if (!m.has(k)) m.set(k, []); m.get(k)!.push(r); }
    return m;
  };

  const wByU = byUser(workouts.data as { user_id: string; workout_name: string }[] | null);
  const mByU = byUser((meals.data as { user_id: string; calories: Num; protein: Num; deleted_at: string | null }[] | null)?.filter((r) => !r.deleted_at) ?? []);
  const tByU = byUser(tasks.data as { client_id: string; done: boolean; done_at: string | null; due_date: string | null }[] | null, "client_id");
  const wgtByU = byUser(weights.data as { user_id: string }[] | null);
  const activeSet = new Set((activity.data ?? []).map((r) => (r as { user_id: string }).user_id));
  const hasProgram = new Set((programs.data ?? []).map((r) => (r as { user_id: string }).user_id));
  const targetByU = new Map((targets.data ?? []).map((r) => [(r as { user_id: string }).user_id, r as { calories: Num; protein_g: Num }]));

  const result = clients.map((c) => {
    const name = (c.full_name?.trim()) || [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || c.email?.split("@")[0] || "Client";

    const ws = wByU.get(c.id) ?? [];
    const sessions = ws.length;
    const workoutNames = ws.map((w) => w.workout_name).filter(Boolean).slice(0, 3);
    const missedWorkout = hasProgram.has(c.id) && sessions === 0;

    const ms = mByU.get(c.id) ?? [];
    const calories = ms.reduce((s, m) => s + num(m.calories), 0);
    const protein = ms.reduce((s, m) => s + num(m.protein), 0);
    const tgt = targetByU.get(c.id);
    const calTarget = tgt && tgt.calories ? tgt.calories : null;
    let nutritionStatus: "none" | "under" | "on" | "over" | "logged" = "none";
    if (ms.length === 0) nutritionStatus = "none";
    else if (calTarget) {
      if (calories < calTarget * 0.9) nutritionStatus = "under";
      else if (calories > calTarget * 1.1) nutritionStatus = "over";
      else nutritionStatus = "on";
    } else nutritionStatus = "logged";

    const ts = tByU.get(c.id) ?? [];
    const tasksDoneYesterday = ts.filter((t) => t.done && t.done_at && t.done_at >= yStartISO && t.done_at < yEndISO).length;
    const tasksOpen = ts.filter((t) => !t.done).length;
    const tasksOverdue = ts.filter((t) => !t.done && t.due_date && t.due_date < today).length;

    // A rough "needs attention" score so the list sorts the at-risk clients up.
    let attention = 0;
    if (!activeSet.has(c.id)) attention += 2;
    if (missedWorkout) attention += 2;
    if (nutritionStatus === "none") attention += 2;
    if (tasksOverdue > 0) attention += tasksOverdue;

    return {
      id: c.id,
      name,
      active: activeSet.has(c.id),
      sessions,
      workoutNames,
      missedWorkout,
      nutrition: { status: nutritionStatus, calories, protein, calTarget, proteinTarget: tgt?.protein_g ?? null, meals: ms.length },
      tasksDoneYesterday,
      tasksOpen,
      tasksOverdue,
      weighedIn: (wgtByU.get(c.id) ?? []).length > 0,
      attention,
    };
  });

  // Most-needs-attention first, then alphabetical.
  result.sort((a, b) => (b.attention - a.attention) || a.name.localeCompare(b.name));

  const totals = {
    clients: result.length,
    trained: result.filter((r) => r.sessions > 0).length,
    loggedMeals: result.filter((r) => r.nutrition.meals > 0).length,
    active: result.filter((r) => r.active).length,
    tasksCompleted: result.reduce((s, r) => s + r.tasksDoneYesterday, 0),
  };

  return NextResponse.json({ date: yDate, totals, clients: result });
}
