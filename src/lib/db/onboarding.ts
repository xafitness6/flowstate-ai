// ─── Onboarding state — Supabase-backed ──────────────────────────────────────

import { createClient } from "@/lib/supabase/client";
import type { OnboardingState } from "@/lib/supabase/types";

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
  const { data, error } = await supabase
    .from("onboarding_state")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
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

/** Resolve the correct onboarding route for a user. Returns null if onboarding complete. */
export async function resolveOnboardingRoute(userId: string): Promise<string | null> {
  const state = await getOnboardingState(userId);
  // No row yet — brand-new user, start at walkthrough
  if (!state)                              return "/onboarding/walkthrough";
  if (!state.walkthrough_seen && !state.onboarding_complete) return "/onboarding/walkthrough";
  if (!state.onboarding_complete)          return "/onboarding/calibration";

  // New onboarding finishes the old long-form steps in one six-question pass.
  // Some production rows can still carry stale false values for those legacy
  // flags, which caused users to bounce through old pages after calibration.
  if (state.profile_complete && state.program_generated && state.tutorial_complete) return null;
  if (state.profile_complete && state.program_generated && !state.tutorial_complete) return "/onboarding/tutorial";

  if (!state.body_focus_complete)          return "/onboarding/body-focus";
  if (!state.planning_conversation_complete) return "/onboarding/coach-planning";
  if (!state.program_generated)            return "/onboarding/program-generation";
  if (!state.tutorial_complete)            return "/onboarding/tutorial";
  if (!state.profile_complete)             return "/onboarding/profile-setup";
  return null; // fully onboarded
}
