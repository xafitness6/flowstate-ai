// ─── Onboarding state management ─────────────────────────────────────────────
// Single unified onboarding model. localStorage adapter — swap with DB in prod.
//
// Phase 1 — Intake + Calibration (single form, no separate quick-start)
//   All questions in one form: goals, experience, schedule, body stats,
//   nutrition, sleep, limitations, equipment
//
// Phase 2 — Body Focus Selection (visual front/back diagram)
//
// Phase 3 — AI Coach Chat (real conversation → structured plan output)
//
// Phase 4 — Program Generation (auto-build from coach output)
//
// Phase 5 — Tutorial (feature walkthrough)
//
// Phase 6 — Profile Setup (avatar + bio)

export type BodyFocusArea =
  | "chest" | "shoulders" | "biceps" | "triceps" | "forearms"
  | "abs" | "quads" | "hamstrings" | "calves" | "glutes"
  | "lats" | "traps" | "upper_back" | "lower_back";

export type PlanningData = {
  planDuration:       string;   // "4_weeks" | "8_weeks" | "12_weeks" | "16_weeks"
  planFocus:          string;   // "muscle_gain" | "fat_loss" | "strength" | "endurance" | "recomp"
  intensity:          string;   // "low" | "moderate" | "high" | "max"
  split:              string;   // "full_body" | "upper_lower" | "push_pull_legs" | "bro_split"
  coachingStyle:      string;   // "direct" | "supportive" | "analytical"
  weeklyTrainingDays: number;
  sessionLength:      string;
  bodyFocusAreas:     BodyFocusArea[];
  primaryFocus:       BodyFocusArea | null;
  constraints:        string;
  programId?:         string;
};

export type OnboardingState = {
  hasStarted:                   boolean;
  // Pre-onboarding platform intro (shown once to new users before calibration)
  walkthrough_seen:             boolean;
  // Phase completion flags
  onboardingComplete:           boolean;   // calibration intake done
  bodyFocusComplete:            boolean;   // body diagram done
  planningConversationComplete: boolean;   // AI chat done
  programGenerated:             boolean;   // program created
  tutorialComplete:             boolean;
  profileComplete:              boolean;
  // Legacy compat (never remove — existing stored state uses these)
  starterComplete:              boolean;
  hasCompletedQuickStart:       boolean;
  hasCompletedDeepCal:          boolean;
  // Data
  intakeData:                   IntakeSnapshot | null;
  bodyFocusAreas:               BodyFocusArea[];
  primaryFocus:                 BodyFocusArea | null;
  planningData:                 PlanningData | null;
  generatedProgramId:           string | null;
  // Timestamps
  startedAt:                    string | null;
  onboardingCompletedAt:        string | null;
  bodyFocusCompletedAt:         string | null;
  planningCompletedAt:          string | null;
  programGeneratedAt:           string | null;
  tutorialCompletedAt:          string | null;
  profileCompletedAt:           string | null;
};

/** Snapshot of intake answers — stored inline for AI context without requiring a separate lookup */
export type IntakeSnapshot = {
  primaryGoal:   string;
  experience:    string;
  daysPerWeek:   number;
  equipment:     string[];
  mainStruggle:  string;
  sessionLength: string;
  weight:        string;
  weightUnit:    "kg" | "lbs";
  injuries:      string;
};

/** @deprecated use IntakeSnapshot via onboarding state */
export type QuickStartData = {
  primaryGoal:  string;
  experience:   string;
  daysPerWeek:  number;
  mainStruggle: string;
  equipment:    string[];
};

const KEY = (userId: string) => `flowstate-onboarding-${userId}`;

// UUID v4 pattern — used to detect real Supabase user IDs vs demo IDs ("u1", "usr_001", etc.)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DEFAULT_STATE: OnboardingState = {
  hasStarted:                   false,
  walkthrough_seen:             false,
  onboardingComplete:           false,
  bodyFocusComplete:            false,
  planningConversationComplete: false,
  programGenerated:             false,
  tutorialComplete:             false,
  profileComplete:              false,
  starterComplete:              false,
  hasCompletedQuickStart:       false,
  hasCompletedDeepCal:          false,
  intakeData:                   null,
  bodyFocusAreas:               [],
  primaryFocus:                 null,
  planningData:                 null,
  generatedProgramId:           null,
  startedAt:                    null,
  onboardingCompletedAt:        null,
  bodyFocusCompletedAt:         null,
  planningCompletedAt:          null,
  programGeneratedAt:           null,
  tutorialCompletedAt:          null,
  profileCompletedAt:           null,
};

export function loadOnboardingState(userId: string): OnboardingState {
  try {
    const raw = localStorage.getItem(KEY(userId));
    if (!raw) return { ...DEFAULT_STATE };
    const stored = JSON.parse(raw);
    // Normalize legacy flags → canonical names
    if (stored.hasCompletedQuickStart || stored.starterComplete) {
      stored.starterComplete = true;
    }
    if (stored.hasCompletedDeepCal) {
      stored.onboardingComplete = true;
    }
    // Legacy: if starterComplete but not onboardingComplete, treat calibration as next
    // (don't mark onboardingComplete just because quick-start was done — that was a separate step)
    return { ...DEFAULT_STATE, ...stored } as OnboardingState;
  } catch { return { ...DEFAULT_STATE }; }
}

export function saveOnboardingState(userId: string, state: Partial<OnboardingState>): void {
  try {
    const current = loadOnboardingState(userId);
    localStorage.setItem(KEY(userId), JSON.stringify({ ...current, ...state }));
  } catch { /* ignore */ }

  // Write-through: sync to Supabase for real accounts (UUID IDs only)
  if (UUID_RE.test(userId) && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    import("@/lib/db/onboarding").then(({ upsertOnboardingState }) => {
      upsertOnboardingState(userId, {
        walkthrough_seen:               state.walkthrough_seen,
        onboarding_complete:            state.onboardingComplete,
        body_focus_complete:            state.bodyFocusComplete,
        planning_conversation_complete: state.planningConversationComplete,
        program_generated:              state.programGenerated,
        tutorial_complete:              state.tutorialComplete,
        profile_complete:               state.profileComplete,
        raw_answers:                    state.intakeData as Record<string, unknown> ?? undefined,
      }).catch(() => { /* non-blocking */ });
    }).catch(() => { /* non-blocking */ });
  }
}

export function markOnboardingStarted(userId: string): void {
  saveOnboardingState(userId, { hasStarted: true, startedAt: new Date().toISOString() });
}

/** Complete calibration intake and unlock the concierge tutorial. */
export function completeOnboarding(userId: string, intake?: IntakeSnapshot): void {
  const now = new Date().toISOString();
  saveOnboardingState(userId, {
    walkthrough_seen:             true,
    onboardingComplete:           true,
    bodyFocusComplete:            true,
    planningConversationComplete: true,
    programGenerated:             true,
    starterComplete:              true,
    hasCompletedQuickStart:       true,
    hasCompletedDeepCal:          false,
    profileComplete:              true,
    intakeData:                   intake ?? null,
    onboardingCompletedAt:        now,
    bodyFocusCompletedAt:         now,
    planningCompletedAt:          now,
    programGeneratedAt:           now,
    profileCompletedAt:           now,
  });
  try { localStorage.setItem("flowstate-onboarded", "true"); } catch { /* ignore */ }
}

/** Reset onboarding flags so the user is routed back through the calibration
 *  flow on next navigation. Used by the admin "Replay onboarding" button so
 *  we can QA the flow end-to-end without making a new account. */
export function resetOnboardingForReplay(userId: string): void {
  saveOnboardingState(userId, {
    walkthrough_seen:             false,
    onboardingComplete:           false,
    bodyFocusComplete:            false,
    planningConversationComplete: false,
    programGenerated:             false,
    tutorialComplete:             false,
    profileComplete:              false,
    starterComplete:              false,
    hasCompletedQuickStart:       false,
    hasCompletedDeepCal:          false,
    onboardingCompletedAt:        null,
    bodyFocusCompletedAt:         null,
    planningCompletedAt:          null,
    programGeneratedAt:           null,
    tutorialCompletedAt:          null,
    profileCompletedAt:           null,
  });
  try { localStorage.removeItem("flowstate-onboarded"); } catch { /* ignore */ }
}

/** Mark the platform walkthrough as seen — called on skip or completion. */
export function markWalkthroughSeen(userId: string): void {
  saveOnboardingState(userId, { walkthrough_seen: true });
}

/** @deprecated Use completeOnboarding() */
export function completeQuickStart(userId: string, data: QuickStartData): void {
  saveOnboardingState(userId, {
    starterComplete:        true,
    hasCompletedQuickStart: true,
    intakeData: {
      primaryGoal:   data.primaryGoal,
      experience:    data.experience,
      daysPerWeek:   data.daysPerWeek,
      equipment:     data.equipment,
      mainStruggle:  data.mainStruggle,
      sessionLength: "60",
      weight:        "",
      weightUnit:    "lbs",
      injuries:      "",
    },
    startedAt: new Date().toISOString(),
  });
}

/** @deprecated Use completeOnboarding() */
export function completeDeepCalibration(userId: string): void {
  completeOnboarding(userId);
}

export function completeBodyFocus(
  userId: string,
  areas: BodyFocusArea[],
  primaryFocus: BodyFocusArea | null,
): void {
  saveOnboardingState(userId, {
    bodyFocusComplete:    true,
    bodyFocusAreas:       areas,
    primaryFocus,
    bodyFocusCompletedAt: new Date().toISOString(),
  });
}

export function completePlanningConversation(userId: string, data: PlanningData): void {
  saveOnboardingState(userId, {
    planningConversationComplete: true,
    planningData:                 data,
    planningCompletedAt:          new Date().toISOString(),
  });
}

export function completeProgramGeneration(userId: string, programId: string): void {
  saveOnboardingState(userId, {
    programGenerated:    true,
    generatedProgramId:  programId,
    programGeneratedAt:  new Date().toISOString(),
  });
}

export function completeTutorial(userId: string): void {
  saveOnboardingState(userId, {
    tutorialComplete:    true,
    tutorialCompletedAt: new Date().toISOString(),
  });
}

export function completeProfileSetup(userId: string): void {
  saveOnboardingState(userId, {
    profileComplete:    true,
    profileCompletedAt: new Date().toISOString(),
  });
}

/**
 * Returns the next incomplete onboarding route, or null if fully onboarded.
 * Delegates to resolvePostLoginRoute for single source of truth.
 */
export function getOnboardingRoute(userId: string): string | null {
  const s = loadOnboardingState(userId);
  if (!s.walkthrough_seen && !s.onboardingComplete) return "/onboarding/walkthrough";
  if (!s.onboardingComplete)           return "/onboarding/calibration";
  if (!s.programGenerated || !s.profileComplete) return "/onboarding/calibration";
  if (!s.tutorialComplete)             return "/onboarding/tutorial";
  return null;
}

export function clearOnboardingData(userId: string): void {
  try { localStorage.removeItem(KEY(userId)); } catch { /* ignore */ }
}
