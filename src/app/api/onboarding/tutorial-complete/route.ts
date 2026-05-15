import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServiceRoleKey, missingServiceRoleMessage } from "@/lib/supabase/env";

export async function POST() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  if (!getSupabaseServiceRoleKey()) {
    return NextResponse.json({ error: missingServiceRoleMessage() }, { status: 503 });
  }

  const admin = createAdminClient();
  const { error: upsertError } = await (admin.from("onboarding_state") as any)
    .upsert(
      {
        user_id: user.id,
        walkthrough_seen: true,
        onboarding_complete: true,
        body_focus_complete: true,
        planning_conversation_complete: true,
        program_generated: true,
        tutorial_complete: true,
        profile_complete: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
