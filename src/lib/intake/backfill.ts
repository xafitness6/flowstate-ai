// Registry of onboarding questions that can be back-filled AFTER a user has
// already onboarded. When we add a new onboarding question, list it here and
// every existing user who never answered it gets nudged to complete it (a
// notification + the "finish your profile" prompt) — no full re-onboarding.
//
// Server-safe: no localStorage / browser APIs. Used by /api/me/intake,
// /api/me/missing-intake, the ping nudge, and IntakeQuestionPrompt.

export type BackfillOption = { value: string; label: string };

export type BackfillQuestion = {
  key:      string;            // raw_answers key
  question: string;
  type:     "single" | "multi";
  options:  BackfillOption[];
};

export const BACKFILL_QUESTIONS: BackfillQuestion[] = [
  {
    key: "dietStyle",
    question: "How do you like to eat?",
    type: "multi",
    options: [
      { value: "balanced", label: "Balanced" },
      { value: "high_protein", label: "High protein" },
      { value: "plant_based", label: "Plant-based" },
      { value: "vegetarian", label: "Vegetarian" },
      { value: "pescatarian", label: "Pescatarian" },
      { value: "lower_carb", label: "Lower carb" },
      { value: "keto", label: "Keto" },
      { value: "mediterranean", label: "Mediterranean" },
      { value: "intermittent_fasting", label: "Intermittent fasting" },
      { value: "flexible", label: "Flexible" },
    ],
  },
  {
    key: "mealsPerDay",
    question: "How many meals a day works for you?",
    type: "single",
    options: [
      { value: "2", label: "2 meals" },
      { value: "3", label: "3 meals" },
      { value: "4", label: "4 meals" },
      { value: "5+", label: "5+ meals" },
    ],
  },
  {
    key: "sleepHours",
    question: "How much sleep do you typically get?",
    type: "single",
    options: [
      { value: "5 or less", label: "5 or less" },
      { value: "6", label: "6 hours" },
      { value: "7", label: "7 hours" },
      { value: "8", label: "8 hours" },
      { value: "9+", label: "9+ hours" },
    ],
  },
  {
    key: "energyLevel",
    question: "How are your daily energy levels lately?",
    type: "single",
    options: [
      { value: "low", label: "Low" },
      { value: "steady", label: "Steady" },
      { value: "high", label: "High" },
      { value: "variable", label: "Up and down" },
    ],
  },
  {
    key: "commitments",
    question: "What will you commit to? Pick the habits you want to be held to.",
    type: "multi",
    options: [
      { value: "Train on my scheduled days", label: "Train on my scheduled days" },
      { value: "Hit my daily protein target", label: "Hit my protein target" },
      { value: "Log my workouts", label: "Log my workouts" },
      { value: "Log my meals", label: "Log my meals" },
      { value: "Sleep 7+ hours", label: "Sleep 7+ hours" },
      { value: "10k steps a day", label: "10k steps a day" },
      { value: "Drink enough water", label: "Stay hydrated" },
      { value: "Weekly check-in with my coach", label: "Weekly coach check-in" },
    ],
  },
  {
    key: "checkInCadence",
    question: "How do you want to be held accountable?",
    type: "single",
    options: [
      { value: "daily", label: "Daily nudge" },
      { value: "weekly", label: "Weekly check-in" },
      { value: "none", label: "Hands off" },
    ],
  },
];

/** A raw_answers value counts as "answered" when it's a non-empty string/array. */
export function isAnswered(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/**
 * The questions a user still hasn't answered. Returns [] (nothing to nudge)
 * when the user hasn't onboarded at all (no raw_answers) — we only back-fill
 * people who already have an intake, not unstarted accounts.
 */
export function missingQuestions(raw: Record<string, unknown> | null | undefined): BackfillQuestion[] {
  if (!raw || typeof raw !== "object" || Object.keys(raw).length === 0) return [];
  return BACKFILL_QUESTIONS.filter((q) => !isAnswered(raw[q.key]));
}
