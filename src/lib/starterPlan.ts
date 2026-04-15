// ─── Starter plan ─────────────────────────────────────────────────────────────
// Generates a lightweight structured plan object from onboarding intake answers.
//
// This is intentionally a PLACEHOLDER — the shape is designed so the real
// AI plan generator (OpenAI → program builder) can produce the same type and
// slot in without touching any UI that consumes it.
//
// Consumed by: /coach/intro (summary display), future /dashboard plan card.
// Replace generateStarterPlan() with a real AI call when ready.

import type { IntakeData } from "./data/intake";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TrainingDay = {
  day:      string;   // "Mon", "Wed", etc.
  name:     string;   // "Upper · Push"
  duration: string;   // "~50 min"
  focus:    string;   // "Hypertrophy" | "Strength" | etc.
};

export type StarterPlan = {
  // Metadata
  generatedAt:   string;          // ISO timestamp
  source:        "starter";       // always "starter" until AI replaces it
  // Block info
  blockName:     string;          // "Foundation Block"
  phase:         string;          // "Phase 1 · Weeks 1–4"
  durationWeeks: number;
  // Profile summary (echoed back to user on coach/intro)
  goal:          string;          // "muscle_gain"
  goalLabel:     string;          // "Muscle gain"
  experience:    string;          // "beginner"
  daysPerWeek:   number;
  sessionLength: string;          // "60"
  equipment:     string[];
  // Schedule
  split:         string;          // "Full Body" | "Upper/Lower" | "PPL"
  sessions:      TrainingDay[];
  // Coach note — short string shown on intro page
  coachNote:     string;
};

// ─── Storage ──────────────────────────────────────────────────────────────────

const PLAN_KEY = (userId: string) => `flowstate-starter-plan-${userId}`;

export function saveStarterPlan(userId: string, plan: StarterPlan): void {
  try { localStorage.setItem(PLAN_KEY(userId), JSON.stringify(plan)); } catch { /* ignore */ }
}

export function loadStarterPlan(userId: string): StarterPlan | null {
  try {
    const raw = localStorage.getItem(PLAN_KEY(userId));
    return raw ? (JSON.parse(raw) as StarterPlan) : null;
  } catch { return null; }
}

export function clearStarterPlan(userId: string): void {
  try { localStorage.removeItem(PLAN_KEY(userId)); } catch { /* ignore */ }
}

// ─── Labels ───────────────────────────────────────────────────────────────────

const GOAL_LABELS: Record<string, string> = {
  muscle_gain: "Muscle gain",
  fat_loss:    "Fat loss",
  strength:    "Strength",
  endurance:   "Endurance",
  recomp:      "Body recomp",
  general:     "General fitness",
};

// ─── Schedule builders ────────────────────────────────────────────────────────

function buildSessions(
  days: number,
  goal: string,
  sessionLength: string,
): TrainingDay[] {
  const dur = sessionLength ? `~${sessionLength} min` : "~50 min";

  if (days <= 2) {
    return [
      { day: "Tue", name: "Full Body A", duration: dur, focus: "Compound strength" },
      { day: "Fri", name: "Full Body B", duration: dur, focus: "Compound strength" },
    ].slice(0, days);
  }

  if (days === 3) {
    return [
      { day: "Mon", name: "Full Body A", duration: dur, focus: "Push strength" },
      { day: "Wed", name: "Full Body B", duration: dur, focus: "Pull strength" },
      { day: "Fri", name: "Full Body C", duration: dur, focus: "Legs + core" },
    ];
  }

  if (days === 4) {
    if (goal === "strength") {
      return [
        { day: "Mon", name: "Upper · Strength",  duration: dur, focus: "Press + row"       },
        { day: "Tue", name: "Lower · Strength",  duration: dur, focus: "Squat + hinge"     },
        { day: "Thu", name: "Upper · Hypertrophy", duration: dur, focus: "Volume work"     },
        { day: "Sat", name: "Lower · Hypertrophy", duration: dur, focus: "Volume work"     },
      ];
    }
    return [
      { day: "Mon", name: "Upper · Push",  duration: dur, focus: "Chest, shoulders, triceps" },
      { day: "Wed", name: "Lower · Squat", duration: dur, focus: "Quads, glutes, calves"      },
      { day: "Fri", name: "Upper · Pull",  duration: dur, focus: "Back, biceps, rear delts"   },
      { day: "Sat", name: "Lower · Hinge", duration: dur, focus: "Hamstrings, glutes, core"   },
    ];
  }

  if (days === 5) {
    return [
      { day: "Mon", name: "Push A",  duration: dur, focus: "Chest + shoulders"    },
      { day: "Tue", name: "Pull A",  duration: dur, focus: "Back + biceps"         },
      { day: "Wed", name: "Legs A",  duration: dur, focus: "Quads + glutes"        },
      { day: "Thu", name: "Push B",  duration: dur, focus: "Shoulders + triceps"   },
      { day: "Fri", name: "Pull B",  duration: dur, focus: "Back + rear delts"     },
    ];
  }

  // 6+ days
  return [
    { day: "Mon", name: "Push",  duration: dur, focus: "Chest, shoulders, triceps" },
    { day: "Tue", name: "Pull",  duration: dur, focus: "Back, biceps"               },
    { day: "Wed", name: "Legs",  duration: dur, focus: "Quads, hamstrings, glutes"  },
    { day: "Thu", name: "Push",  duration: dur, focus: "Volume focus"               },
    { day: "Fri", name: "Pull",  duration: dur, focus: "Volume focus"               },
    { day: "Sat", name: "Legs",  duration: dur, focus: "Posterior chain"            },
  ].slice(0, days);
}

function splitLabel(days: number): string {
  if (days <= 3) return "Full Body";
  if (days === 4) return "Upper / Lower";
  if (days === 5) return "Push / Pull / Legs";
  return "PPL (6-day)";
}

function coachNoteFor(goal: string, experience: string, days: number): string {
  const experienceClause =
    experience === "beginner"
      ? "Since you're building the foundation"
      : experience === "intermediate"
      ? "At your level"
      : "Given your training history";

  const goalClause: Record<string, string> = {
    muscle_gain: "we'll prioritise progressive overload and volume to maximise muscle growth",
    fat_loss:    "we'll balance training density with sustainable recovery to hold muscle while you lean out",
    strength:    "we'll build around the main compound lifts with structured intensity progression",
    endurance:   "we'll layer conditioning into your sessions alongside strength work",
    recomp:      "we'll use a moderate deficit with high-protein emphasis to change your composition",
    general:     "we'll build a well-rounded base that improves everything at once",
  };

  const daysClause =
    days <= 3 ? "Your 3-day structure keeps recovery high and suits a full-body approach."
    : days === 4 ? "Four sessions per week is the sweet spot — enough stimulus, enough recovery."
    : "A 5+ day split gives us room to specialise without overloading any one pattern.";

  return `${experienceClause}, ${goalClause[goal] ?? "we'll build a solid baseline first"}. ${daysClause}`;
}

// ─── Generator ───────────────────────────────────────────────────────────────
// Accepts partial intake — every field may be missing (user skipped).
// Falls back to sensible defaults throughout.

export function generateStarterPlan(intake: Partial<IntakeData>): StarterPlan {
  const goal     = intake.primaryGoal ?? "general";
  const exp      = intake.experience  ?? "beginner";
  const days     = intake.daysPerWeek && intake.daysPerWeek > 0 ? intake.daysPerWeek : 3;
  const sessLen  = intake.sessionLength ?? "50";
  const equip    = intake.equipment ?? [];

  const durationWeeks = 4;
  const sessions      = buildSessions(days, goal, sessLen);

  return {
    generatedAt:   new Date().toISOString(),
    source:        "starter",
    blockName:     "Foundation Block",
    phase:         "Phase 1 · Weeks 1–4",
    durationWeeks,
    goal,
    goalLabel:     GOAL_LABELS[goal] ?? "General fitness",
    experience:    exp,
    daysPerWeek:   days,
    sessionLength: sessLen,
    equipment:     equip,
    split:         splitLabel(days),
    sessions,
    coachNote:     coachNoteFor(goal, exp, days),
  };
}
