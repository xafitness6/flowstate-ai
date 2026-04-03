// ─── Onboarding state management ─────────────────────────────────────────────
// Tracks 2-phase onboarding. localStorage adapter — replace with DB calls in production.
//
// Phase 1 — Quick Start (required, low friction):
//   primaryGoal, experience, daysPerWeek, mainStruggle, equipment
//   → completes immediately, user enters app
//
// Phase 2 — Deep Calibration (progressive, required soon after):
//   body stats, nutrition, schedule, injuries, sleep, preferences
//   → prompted in-app after quick start

export type OnboardingState = {
  hasStarted:              boolean;
  hasCompletedQuickStart:  boolean;
  hasCompletedDeepCal:     boolean;
  quickStartData:          QuickStartData | null;
  startedAt:               string | null;
  quickStartCompletedAt:   string | null;
  deepCalCompletedAt:      string | null;
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
  hasCompletedQuickStart: false,
  hasCompletedDeepCal:    false,
  quickStartData:         null,
  startedAt:              null,
  quickStartCompletedAt:  null,
  deepCalCompletedAt:     null,
};

export function loadOnboardingState(userId: string): OnboardingState {
  // TODO: Replace with GET /api/onboarding/:userId
  try {
    const raw = localStorage.getItem(KEY(userId));
    if (!raw) return { ...DEFAULT_STATE };
    return { ...DEFAULT_STATE, ...JSON.parse(raw) } as OnboardingState;
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
    hasCompletedQuickStart: true,
    quickStartData:         data,
    quickStartCompletedAt:  new Date().toISOString(),
  });
  // Legacy key for backward compat with postLoginRoute check
  try { localStorage.setItem("flowstate-onboarded", "true"); } catch { /* ignore */ }
}

export function completeDeepCalibration(userId: string): void {
  saveOnboardingState(userId, {
    hasCompletedDeepCal:  true,
    deepCalCompletedAt:   new Date().toISOString(),
  });
}

export function getOnboardingRoute(userId: string): string | null {
  const state = loadOnboardingState(userId);
  if (!state.hasCompletedQuickStart) return "/onboarding";
  return null; // fully onboarded enough to enter app
}

// Data retention guard — NEVER call this on plan change. Only on explicit user delete.
export function clearOnboardingData(userId: string): void {
  try { localStorage.removeItem(KEY(userId)); } catch { /* ignore */ }
}
