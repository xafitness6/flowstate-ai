import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

const ADMIN_EMAIL = "xavellis4@gmail.com";

export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user?.id) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY is not configured." },
        { status: 503 },
      ),
    };
  }

  const admin = await createAdminClient();
  const email = user.email?.trim().toLowerCase() ?? "";

  const { data: actor, error: actorError } = await admin
    .from("profiles")
    .select("id,email,role,is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (email === ADMIN_EMAIL) {
    const needsRepair = !actor || actor.role !== "master" || actor.is_admin !== true;
    if (needsRepair) {
      const { error: repairError } = await admin
        .from("profiles")
        .upsert({
          id: user.id,
          email: ADMIN_EMAIL,
          role: "master",
          is_admin: true,
          plan: "coaching",
          default_dashboard: "overview",
          push_level: "standard",
          subscription_status: "active",
          updated_at: new Date().toISOString(),
        }, { onConflict: "id" });

      if (repairError) {
        console.warn("[admin] failed to repair admin profile", repairError.message);
      }
    }

    return { ok: true as const, user, admin };
  }

  if (actorError || !actor || (actor.role !== "master" && !actor.is_admin)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Forbidden: sign out and sign in with the admin Google/email account." },
        { status: 403 },
      ),
    };
  }

  return { ok: true as const, user, admin };
}
