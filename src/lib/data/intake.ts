// ─── Client intake / onboarding data ─────────────────────────────────────────
// Persisted to localStorage on calibration completion.
// Read by dashboard, AI pipeline, coach, and program logic.

export type IntakeData = {
  // Goals
  primaryGoal:     string;   // "muscle_gain" | "fat_loss" | "strength" | "endurance" | "general" | "recomp"
  secondaryGoal:   string;
  timeframe:       string;   // "4w" | "8w" | "12w" | "6m" | "long_term"

  // Experience & consistency
  experience:      string;   // "beginner" | "intermediate" | "advanced"
  trainingStyle:   string[];
  daysPerWeek:     number;

  // Schedule
  sessionLength:   string;   // "30" | "45" | "60" | "75" | "90+"
  preferredTime:   string;   // "Morning" | "Afternoon" | "Evening" | "Flexible"
  availableDays:   string[];

  // Mindset
  mainStruggle:    string;
  confidenceLevel: number;   // 1–5

  // Physical
  weight:          string;
  weightUnit:      "kg" | "lbs";
  height:          string;
  heightUnit:      "cm" | "ft";
  bodyFat:         string;
  waist:           string;

  // Recovery
  sleepHours:      string;   // "5 or less" | "6" | "7" | "8" | "9+"
  sleepQuality:    number;   // 1–5, 0 = not set
  stressLevel:     number;   // 1–5, 0 = not set
  recoveryNote:    string;

  // Nutrition
  dietStyle:       string[];
  mealsPerDay:     string;
  restrictions:    string[];
  hydration:       string;

  // Limitations
  injuries:        string;
  equipment:       string[];
  limitedDays:     string[];
  coachNote:       string;

  completedAt:     string;   // ISO timestamp
};

// ─── localStorage helpers ─────────────────────────────────────────────────────

const intakeKey = (userId: string) => `flowstate-intake-${userId}`;

export function saveIntake(userId: string, data: IntakeData): void {
  try { localStorage.setItem(intakeKey(userId), JSON.stringify(data)); } catch { /* ignore */ }
}

export function loadIntake(userId: string): IntakeData | null {
  try {
    const raw = localStorage.getItem(intakeKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as IntakeData;
  } catch { return null; }
}

export function hasCompletedIntake(userId: string): boolean {
  return loadIntake(userId) !== null;
}

// ─── Async loader with Supabase fallback ──────────────────────────────────────
//
// For real Supabase users: checks onboarding_state.raw_answers first, then
// falls back to localStorage (covers users who completed calibration before
// the Supabase migration).
// For demo users: localStorage only.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function loadIntakeAsync(userId: string): Promise<IntakeData | null> {
  // Try Supabase for real users first
  if (UUID_RE.test(userId) && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data } = await supabase
        .from("onboarding_state")
        .select("raw_answers")
        .eq("user_id", userId)
        .single();

      if (data?.raw_answers && typeof data.raw_answers === "object") {
        const answers = data.raw_answers as Record<string, unknown>;
        // Validate it has the required shape (weight field present is sufficient)
        if (typeof answers.weight === "string") {
          return answers as unknown as IntakeData;
        }
      }
    } catch { /* fall through to localStorage */ }
  }

  // localStorage fallback
  return loadIntake(userId);
}

// ─── Display labels ───────────────────────────────────────────────────────────

export const GOAL_LABELS: Record<string, string> = {
  muscle_gain: "Muscle gain",
  fat_loss:    "Fat loss",
  strength:    "Strength",
  endurance:   "Endurance",
  general:     "General fitness",
  recomp:      "Body recomp",
};

export const EXPERIENCE_LABELS: Record<string, string> = {
  beginner:     "Beginner (<1 year)",
  intermediate: "Intermediate (1–3 years)",
  advanced:     "Advanced (3+ years)",
};

export const STRUGGLE_LABELS: Record<string, string> = {
  Consistency: "Staying consistent",
  Nutrition:   "Eating right",
  Recovery:    "Not recovering well",
  Motivation:  "Staying motivated",
  Injuries:    "Working around injuries",
  Time:        "Not enough time",
  Knowledge:   "Not knowing what to do",
  Plateau:     "Hitting a plateau",
};
