// ─── Onboarding state — Supabase-backed ──────────────────────────────────────

import { createClient } from "@/lib/supabase/client";
import type { OnboardingState } from "@/lib/supabase/types";
import { decideOnboardingRoute } from "@/lib/onboardingRoute";
import { trace, mark } from "@/lib/authTrace";

export type OnboardingUpdate = Partial<
  Omit<OnboardingState, "id" | "user_id" | "created_at" | "updated_at">
>;

/** Upsert onboarding state for the current user. Creates row if first time. */
export async function upsertOnboardingState(
  userId: string,
  update: OnboardingUpdate,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("onboarding_state")
    .upsert(
      { user_id: userId, ...update, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  if (error) console.error("[onboarding] upsert:", error.message);
}

/** Get onboarding state for a user. Returns null if not started. */
export async function getOnboardingState(userId: string): Promise<OnboardingState | null> {
  const supabase = createClient();
  const { data, error } = await trace(
    "getOnboardingState",
    () => supabase.from("onboarding_state").select("*").eq("user_id", userId).maybeSingle(),
    { detail: `uid=${userId.slice(0, 8)}`, isError: (r) => r.error?.message ?? null },
  );
  if (error) { console.error("[onboarding] get:", error.message); return null; }
  return data as OnboardingState | null;
}

/** Mark onboarding complete for a user. */
export async function markOnboardingComplete(
  userId: string,
  rawAnswers?: Record<string, unknown>,
): Promise<void> {
  return upsertOnboardingState(userId, {
    walkthrough_seen: true,
    onboarding_complete: true,
    body_focus_complete: true,
    planning_conversation_complete: true,
    program_generated: true,
    tutorial_complete: false,
    profile_complete: true,
    raw_answers: rawAnswers,
  });
}

/** Reset onboarding so the current user can deliberately run the setup again. */
export async function resetOnboardingState(userId: string): Promise<void> {
  return upsertOnboardingState(userId, {
    walkthrough_seen: false,
    onboarding_complete: false,
    body_focus_complete: false,
    planning_conversation_complete: false,
    program_generated: false,
    tutorial_complete: false,
    profile_complete: false,
    onboarding_step: null,
    raw_answers: null,
    coach_summary: null,
    current_plan_duration: null,
  });
}

/** Resolve the correct onboarding route for a user. Returns null if onboarding complete.
 *  Decision logic lives in the shared pure `decideOnboardingRoute` so the
 *  server root (`src/app/page.tsx`) and this client helper never drift.
 *
 *  Cross-device safety: onboarding completion is stored server-side in
 *  `onboarding_state`, so a returning user on a fresh device (empty
 *  localStorage) should NOT be re-onboarded. The one way that breaks is if the
 *  state READ fails — `getOnboardingState` returns null on error, and a null
 *  state decides "brand-new → walkthrough". To avoid replaying onboarding for
 *  an established account on a transient read error, we retry once and then
 *  FAIL OPEN (return null = "don't block"). A genuinely-new user has a clean
 *  empty read (data null, no error) and is still routed into onboarding. */
export async function resolveOnboardingRoute(userId: string): Promise<string | null> {
  const supabase = createClient();
  let lastError: string | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await supabase
      .from("onboarding_state")
      .select("walkthrough_seen,onboarding_complete,program_generated,profile_complete,tutorial_complete")
      .eq("user_id", userId)
      .maybeSingle();
    if (!error) {
      const route = decideOnboardingRoute(data as OnboardingState | null);
      mark("resolveOnboardingRoute", `→ ${route ?? "null (done)"}`);
      return route;
    }
    lastError = error.message;
  }
  // Read genuinely failed twice — don't punish a possibly-returning user by
  // forcing them back through onboarding. The next successful load routes them.
  mark("resolveOnboardingRoute", `read error → null (fail-open): ${lastError}`);
  return null;
}
