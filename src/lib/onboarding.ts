// ─── Onboarding state management ─────────────────────────────────────────────
// Tracks 4-phase onboarding. localStorage adapter — replace with DB calls in production.
//
// Phase 1 — Starter Questions (5 quick questions, required):
//   primaryGoal, experience, daysPerWeek, mainStruggle, equipment
//
// Phase 2 — Full Onboarding Questionnaire (deep calibration, required):
//   body stats, nutrition, schedule, injuries, sleep, preferences
//
// Phase 3 — Tutorial (feature walkthrough, required once):
//   Introduces dashboard, program, nutrition, accountability, AI coach, profile
//
// Phase 4 — Profile Setup (avatar + bio, skippable):
//   Profile picture and short bio

export type OnboardingState = {
  hasStarted:           boolean;
  // Phase completion flags (canonical)
  starterComplete:      boolean;
  onboardingComplete:   boolean;
  tutorialComplete:     boolean;
  profileComplete:      boolean;
  // Legacy aliases kept for backward compat
  hasCompletedQuickStart: boolean;
  hasCompletedDeepCal:    boolean;
  // Data
  quickStartData:       QuickStartData | null;
  // Timestamps
  startedAt:            string | null;
  starterCompletedAt:   string | null;
  onboardingCompletedAt: string | null;
  tutorialCompletedAt:  string | null;
  profileCompletedAt:   string | null;
};

export type QuickStartData = {
  primaryGoal:  string;   // "muscle_gain" | "fat_loss" | "strength" | "endurance" | "general" | "recomp"
  experience:   string;   // "beginner" | "intermediate" | "advanced"
  daysPerWeek:  number;   // 2–7
  mainStruggle: string;
  equipment:    string[]; // ["barbell", "dumbbell", "cables", "machines", "bodyweight", "bands"]
};

const KEY = (userId: string) => `flowstate-onboarding-${userId}`;

const DEFAULT_STATE: OnboardingState = {
  hasStarted:             false,
  starterComplete:        false,
  onboardingComplete:     false,
  tutorialComplete:       false,
  profileComplete:        false,
  hasCompletedQuickStart: false,
  hasCompletedDeepCal:    false,
  quickStartData:         null,
  startedAt:              null,
  starterCompletedAt:     null,
  onboardingCompletedAt:  null,
  tutorialCompletedAt:    null,
  profileCompletedAt:     null,
};

export function loadOnboardingState(userId: string): OnboardingState {
  // TODO: Replace with GET /api/onboarding/:userId
  try {
    const raw = localStorage.getItem(KEY(userId));
    if (!raw) return { ...DEFAULT_STATE };
    const stored = JSON.parse(raw);
    // Normalize legacy flags → canonical names on read
    if (stored.hasCompletedQuickStart) stored.starterComplete = true;
    if (stored.hasCompletedDeepCal)    stored.onboardingComplete = true;
    return { ...DEFAULT_STATE, ...stored } as OnboardingState;
  } catch { return { ...DEFAULT_STATE }; }
}

export function saveOnboardingState(userId: string, state: Partial<OnboardingState>): void {
  // TODO: Replace with PATCH /api/onboarding/:userId
  try {
    const current = loadOnboardingState(userId);
    localStorage.setItem(KEY(userId), JSON.stringify({ ...current, ...state }));
  } catch { /* ignore */ }
}

export function markOnboardingStarted(userId: string): void {
  saveOnboardingState(userId, { hasStarted: true, startedAt: new Date().toISOString() });
}

export function completeQuickStart(userId: string, data: QuickStartData): void {
  saveOnboardingState(userId, {
    hasStarted:             true,
    starterComplete:        true,
    hasCompletedQuickStart: true,
    quickStartData:         data,
    starterCompletedAt:     new Date().toISOString(),
  });
  // Legacy key for backward compat
  try { localStorage.setItem("flowstate-onboarded", "true"); } catch { /* ignore */ }
}

export function completeOnboarding(userId: string): void {
  // TODO: Replace with PATCH /api/onboarding/:userId
  saveOnboardingState(userId, {
    onboardingComplete:    true,
    hasCompletedDeepCal:   true,
    onboardingCompletedAt: new Date().toISOString(),
  });
}

/** @deprecated Use completeOnboarding() */
export function completeDeepCalibration(userId: string): void {
  completeOnboarding(userId);
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
 * Returns the next incomplete onboarding route for a user, or null if fully onboarded.
 * Used by login routing and AppShell guards.
 */
export function getOnboardingRoute(userId: string): string | null {
  const s = loadOnboardingState(userId);
  if (!s.starterComplete)    return "/onboarding/quick-start";
  if (!s.onboardingComplete) return "/onboarding/calibration";
  if (!s.tutorialComplete)   return "/onboarding/tutorial";
  if (!s.profileComplete)    return "/onboarding/profile-setup";
  return null;
}

// Data retention guard — NEVER call this on plan change. Only on explicit user delete.
export function clearOnboardingData(userId: string): void {
  try { localStorage.removeItem(KEY(userId)); } catch { /* ignore */ }
}
