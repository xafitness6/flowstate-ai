import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServiceRoleKey, missingServiceRoleMessage } from "@/lib/supabase/env";

const ADMIN_EMAIL = "xavellis4@gmail.com";
const ALLOWED_ROLES = new Set(["trainer", "client", "member"]);

function nameParts(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

export async function POST() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user?.email) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  if (!getSupabaseServiceRoleKey()) {
    return NextResponse.json(
      { error: missingServiceRoleMessage() },
      { status: 500 },
    );
  }

  const admin = createAdminClient();
  const email = user.email.trim().toLowerCase();
  const { data: existingProfile } = await (admin.from("profiles") as any)
    .select("role,is_admin,assigned_trainer_id,plan,default_dashboard,push_level,subscription_status")
    .eq("id", user.id)
    .maybeSingle();
  const metadata = user.user_metadata ?? {};
  const fullName =
    typeof metadata.full_name === "string" && metadata.full_name.trim()
      ? metadata.full_name.trim()
      : email;
  const split = nameParts(fullName);
  const firstName =
    typeof metadata.first_name === "string" && metadata.first_name.trim()
      ? metadata.first_name.trim()
      : split.firstName;
  const lastName =
    typeof metadata.last_name === "string" && metadata.last_name.trim()
      ? metadata.last_name.trim()
      : split.lastName;

  const isAdmin = email === ADMIN_EMAIL;
  const metadataRole = typeof metadata.role === "string" ? metadata.role : "";
  const existingRole = typeof existingProfile?.role === "string" ? existingProfile.role : "";
  const role = isAdmin
    ? "master"
    : ALLOWED_ROLES.has(existingRole)
      ? existingRole
      : ALLOWED_ROLES.has(metadataRole)
        ? metadataRole
        : "client";

  const { data, error: upsertError } = await (admin.from("profiles") as any)
    .upsert(
      {
        id: user.id,
        email,
        first_name: firstName || null,
        last_name: lastName || null,
        full_name: fullName || email,
        role,
        is_admin: isAdmin,
        assigned_trainer_id:
          existingProfile?.assigned_trainer_id ??
          (typeof metadata.assigned_trainer_id === "string" && metadata.assigned_trainer_id
            ? metadata.assigned_trainer_id
            : null),
        plan: isAdmin ? "coaching" : (existingProfile?.plan ?? "foundation"),
        default_dashboard: isAdmin ? "overview" : (existingProfile?.default_dashboard ?? "dashboard"),
        push_level: existingProfile?.push_level ?? 5,
        subscription_status: isAdmin ? "active" : (existingProfile?.subscription_status ?? "active"),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
    .select()
    .single();

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data });
}
