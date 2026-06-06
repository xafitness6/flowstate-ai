// GET /api/my-clients — the signed-in trainer/admin's real assigned clients.
// Returns profiles whose assigned_trainer_id === caller, plus each client's
// active program name. Service-role read after verifying the caller is a
// trainer or admin (RLS stays strict for everyone else).

import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getSupabaseServiceRoleKey, missingServiceRoleMessage } from "@/lib/supabase/env";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!getSupabaseServiceRoleKey()) {
    return NextResponse.json({ error: missingServiceRoleMessage() }, { status: 503 });
  }

  const admin = await createAdminClient();

  const { data: actor } = await admin
    .from("profiles")
    .select("id,role,is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!actor || !(actor.role === "trainer" || actor.role === "master" || actor.is_admin === true)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: rows, error } = await admin
    .from("profiles")
    .select("id,nickname,full_name,first_name,last_name,email,plan,subscription_status,created_at")
    .eq("assigned_trainer_id", user.id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const clients = rows ?? [];
  const ids = clients.map((c) => c.id);

  // Active program name per client (single query).
  const programByUser = new Map<string, string>();
  if (ids.length > 0) {
    const { data: progs } = await admin
      .from("programs")
      .select("user_id,block_name")
      .eq("status", "active")
      .in("user_id", ids);
    for (const p of (progs ?? []) as { user_id: string; block_name: string }[]) {
      if (!programByUser.has(p.user_id)) programByUser.set(p.user_id, p.block_name);
    }
  }

  const result = clients.map((c) => ({
    id:    c.id,
    name:  (c.nickname?.trim()) || (c.full_name?.trim())
        || [c.first_name, c.last_name].filter(Boolean).join(" ").trim()
        || c.email?.split("@")[0]
        || "Client",
    email: c.email ?? "",
    plan:  c.plan,
    subscription_status: c.subscription_status,
    program: programByUser.get(c.id) ?? null,
    created_at: c.created_at,
  }));

  return NextResponse.json({ clients: result });
}
