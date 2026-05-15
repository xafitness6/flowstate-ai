// ─── Canonical onboarding route decision ─────────────────────────────────────
// SINGLE source of truth for "given onboarding flags, where does the user go?"
// Pure function, no imports — safe to use from server components, client
// components, route handlers, and the AppShell guard alike.
//
// The active product flow is intentionally short:
//   (no row)            → /onboarding/walkthrough   (brand-new, non-invite)
//   walkthrough not seen → /onboarding/walkthrough
//   onboarding not done  → /onboarding/calibration  (6-question calibration)
//   no program / profile → /onboarding/calibration
//   tutorial not done    → /onboarding/tutorial     (concierge tour)
//   else                 → null  (fully onboarded → /program or role home)
//
// body-focus / coach-planning / program-generation / profile-setup /
// quick-start are NOT in this chain anymore. Invite users additionally skip
// the walkthrough (handled by callers via the `viaInvite` flag).

export type OnboardingFlags = {
  walkthrough_seen?:    boolean | null;
  onboarding_complete?: boolean | null;
  program_generated?:   boolean | null;
  profile_complete?:    boolean | null;
  tutorial_complete?:   boolean | null;
};

export function decideOnboardingRoute(state: OnboardingFlags | null): string | null {
  if (!state)                                                  return "/onboarding/walkthrough";
  if (!state.walkthrough_seen && !state.onboarding_complete)   return "/onboarding/walkthrough";
  if (!state.onboarding_complete)                              return "/onboarding/calibration";
  if (!state.program_generated || !state.profile_complete)     return "/onboarding/calibration";
  if (!state.tutorial_complete)                                return "/onboarding/tutorial";
  return null;
}
