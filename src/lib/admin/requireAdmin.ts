import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getSupabaseServiceRoleKey, missingServiceRoleMessage } from "@/lib/supabase/env";

export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user?.id) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  if (!getSupabaseServiceRoleKey()) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: missingServiceRoleMessage() },
        { status: 503 },
      ),
    };
  }

  const admin = await createAdminClient();
  const { data: actor, error: actorError } = await admin
    .from("profiles")
    .select("id,email,role,is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (actorError || !actor || (actor.role !== "master" && !actor.is_admin)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Forbidden: this account is not configured as an admin." },
        { status: 403 },
      ),
    };
  }

  return { ok: true as const, user, admin };
}
