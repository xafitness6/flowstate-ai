import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getSupabaseServiceRoleKey, missingServiceRoleMessage } from "@/lib/supabase/env";

/**
 * Authorize the caller to view/manage a specific client (`clientId`):
 *   - admins (role "master" or is_admin) → any client
 *   - trainers → only clients whose profiles.assigned_trainer_id === caller id
 *   - optionally, the client themselves → only when allowSelf is true
 *   - everyone else → 403
 *
 * Returns the service-role `admin` client so the route can read/write the
 * client's data after the relationship is verified — RLS stays strict.
 */
export async function requireClientAccess(
  clientId: string,
  options: { allowSelf?: boolean } = {},
) {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user?.id) {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!getSupabaseServiceRoleKey()) {
    return { ok: false as const, response: NextResponse.json({ error: missingServiceRoleMessage() }, { status: 503 }) };
  }
  if (!clientId) {
    return { ok: false as const, response: NextResponse.json({ error: "Missing client id" }, { status: 400 }) };
  }

  const admin = await createAdminClient();

  const { data: actor } = await admin
    .from("profiles")
    .select("id,role,is_admin,nickname,full_name,email")
    .eq("id", user.id)
    .maybeSingle();

  if (!actor) {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const isAdmin = actor.role === "master" || actor.is_admin === true;
  const isSelf = actor.id === clientId;

  if (!isAdmin && !(options.allowSelf && isSelf)) {
    if (actor.role !== "trainer") {
      return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    }
    // Trainer: the client must be assigned to them.
    const { data: target } = await admin
      .from("profiles")
      .select("id,assigned_trainer_id")
      .eq("id", clientId)
      .maybeSingle();
    if (!target || target.assigned_trainer_id !== actor.id) {
      return { ok: false as const, response: NextResponse.json({ error: "Forbidden: not your client." }, { status: 403 }) };
    }
  }

  const authorName =
    (typeof actor.nickname === "string" && actor.nickname.trim())
    || (typeof actor.full_name === "string" && actor.full_name.trim())
    || actor.email || "Coach";

  return { ok: true as const, admin, actorId: actor.id, authorName, isAdmin, isSelf };
}
