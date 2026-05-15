import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServiceRoleKey, missingServiceRoleMessage } from "@/lib/supabase/env";
import { builderPayloadToProgramRow, type BuilderProgramPayload } from "@/lib/db/programs";

function isBuilderPayload(value: unknown): value is BuilderProgramPayload {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<BuilderProgramPayload>;
  return (
    typeof candidate.name === "string" &&
    typeof candidate.goal === "string" &&
    typeof candidate.weeks === "number" &&
    typeof candidate.daysPerWeek === "number" &&
    !!candidate.split &&
    typeof candidate.split === "object"
  );
}

export async function POST(request: Request) {
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

  const body = await request.json().catch(() => ({})) as {
    payload?: unknown;
    intake?: Record<string, unknown>;
  };

  if (!isBuilderPayload(body.payload)) {
    return NextResponse.json({ error: "Invalid starter program payload." }, { status: 400 });
  }

  const admin = createAdminClient();

  const archive = await (admin.from("programs") as any)
    .update({ status: "archived" })
    .eq("user_id", user.id)
    .eq("status", "active");
  if (archive.error) {
    return NextResponse.json({ error: archive.error.message }, { status: 500 });
  }

  const row = builderPayloadToProgramRow(body.payload, { status: "active" });
  const insert = await (admin.from("programs") as any)
    .insert({ ...row, user_id: user.id });
  if (insert.error) {
    return NextResponse.json({ error: insert.error.message }, { status: 500 });
  }

  const onboarding = await (admin.from("onboarding_state") as any)
    .upsert(
      {
        user_id: user.id,
        walkthrough_seen: true,
        onboarding_complete: true,
        body_focus_complete: true,
        planning_conversation_complete: true,
        program_generated: true,
        tutorial_complete: false,
        profile_complete: true,
        raw_answers: body.intake ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  if (onboarding.error) {
    return NextResponse.json({ error: onboarding.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
