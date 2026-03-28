/**
 * seedData.ts
 * Generates realistic mock data for local end-to-end testing.
 * All writes go to localStorage only.
 */

// ─── Habit IDs (must match accountability page) ───────────────────────────────

const ALL_HABITS = [
  { id: "training",   weight: 3 },
  { id: "steps",      weight: 2 },
  { id: "sleep",      weight: 3 },
  { id: "water",      weight: 1 },
  { id: "deep-work",  weight: 3 },
  { id: "reading",    weight: 2 },
  { id: "rev-calls",  weight: 3 },
  { id: "content",    weight: 2 },
  { id: "metrics",    weight: 1 },
  { id: "no-alcohol", weight: 2 },
  { id: "sunlight",   weight: 1 },
];

const IDENTITY_STATES = ["locked", "focused", "tired", "focused", "locked", "off", "tired"] as const;

const JOURNAL_TEXTS = [
  "Strong session today. Hit all my big three and kept nutrition clean. Sleep was the only thing off — was up late finishing a project. Need to lock that in tomorrow.",
  "Rough start to the day but pushed through. Deep work block got interrupted twice. Revenue calls done though. Energy low overall — the sleep debt is showing.",
  "Back on track after yesterday. Training felt solid, food was clean. Motivation isn't the problem — it's just the evenings where things slip. Working on that.",
  "Best week in a while. Everything clicked. Sleep was consistent, training progressed on the main lifts. This is what it's supposed to feel like.",
  "Travel day. Managed a bodyweight session in the hotel room. Nutrition was rough — airport food only. Didn't let it spiral though. One bad day, not a bad week.",
  "Felt off all day. Nothing specific, just low energy and unclear head. Still showed up for the key tasks. That's what the system is for.",
  "Big week ahead. Got the plan clear, priorities set. Just need to execute. One thing at a time.",
];

function pastDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

// ─── Daily scenario patterns ──────────────────────────────────────────────────

type Scenario = "elite" | "strong" | "solid" | "weak" | "zero";

const SCENARIOS: Scenario[] = [
  // 21 days oldest → newest
  "strong", "solid",  "elite",  "weak",   "solid",
  "strong", "zero",   "solid",  "strong", "elite",
  "weak",   "solid",  "strong", "zero",   "solid",
  "elite",  "strong", "solid",  "weak",   "strong",
  "solid",
];

const HABIT_SETS: Record<Scenario, string[]> = {
  elite:  ["training", "steps", "sleep", "water", "deep-work", "reading", "rev-calls", "content", "metrics", "no-alcohol", "sunlight"],
  strong: ["training", "steps", "sleep", "deep-work", "reading", "rev-calls", "content", "no-alcohol"],
  solid:  ["training", "sleep", "deep-work", "rev-calls", "no-alcohol"],
  weak:   ["sleep", "steps", "metrics"],
  zero:   [],
};

// ─── Public API ───────────────────────────────────────────────────────────────

export function seedDemoData() {
  if (typeof window === "undefined") return;

  // ── Accountability logs ────────────────────────────────────────────────────
  const logs: Record<string, object> = {};

  SCENARIOS.forEach((scenario, i) => {
    const daysAgo = SCENARIOS.length - 1 - i;
    const date    = pastDate(daysAgo);
    const identityIdx = i % IDENTITY_STATES.length;

    logs[date] = {
      completedHabits: HABIT_SETS[scenario],
      identityState:   scenario === "zero" ? "off" : IDENTITY_STATES[identityIdx],
      energyNote:      scenario === "elite" ? "Everything is firing." : scenario === "zero" ? "Not today." : "",
      journalEntry:    "",
      journalSaved:    false,
    };
  });

  localStorage.setItem("accountability-logs", JSON.stringify(logs));

  // ── Journal entries ────────────────────────────────────────────────────────
  const journal = JOURNAL_TEXTS.map((text, i) => ({
    date:          pastDate(i * 3),
    text,
    score:         [91, 44, 72, 88, 58, 38, 65][i] ?? 60,
    identityState: IDENTITY_STATES[i % IDENTITY_STATES.length],
    savedAt:       new Date(Date.now() - i * 3 * 86400000).toISOString(),
  }));

  localStorage.setItem("accountability-journal", JSON.stringify(journal));

  // ── Workout logs ───────────────────────────────────────────────────────────
  const workoutLogs = [
    { date: pastDate(1),  session: "Upper Body · Pull",  rpe: 7, note: "Solid session. Rows felt strong.",           loggedAt: new Date(Date.now() - 86400000).toISOString() },
    { date: pastDate(4),  session: "Lower Body · Squat", rpe: 8, note: "Heavy. Left knee a bit achy post-session.",  loggedAt: new Date(Date.now() - 4 * 86400000).toISOString() },
    { date: pastDate(7),  session: "Upper Body · Push",  rpe: 6, note: "Deload week. Kept it controlled.",           loggedAt: new Date(Date.now() - 7 * 86400000).toISOString() },
    { date: pastDate(10), session: "Full Body",          rpe: 9, note: "Pushed hard. Best session in weeks.",        loggedAt: new Date(Date.now() - 10 * 86400000).toISOString() },
  ];

  localStorage.setItem("workout-logs", JSON.stringify(workoutLogs));

  // ── Mark as onboarded ─────────────────────────────────────────────────────
  localStorage.setItem("flowstate-onboarded", "true");

  console.log("[Flowstate] Demo data seeded:", {
    logDays: Object.keys(logs).length,
    journalEntries: journal.length,
    workoutLogs: workoutLogs.length,
  });
}

export function resetAllData() {
  if (typeof window === "undefined") return;

  const keysToRemove = [
    "accountability-logs",
    "accountability-journal",
    "accountability-habits-v2",
    "accountability-weekly-draft",
    "workout-logs",
    "dashboard-card-order",
    "dashboard-locked",
    "dashboard-default",
    "flowstate-onboarded",
  ];

  keysToRemove.forEach((k) => localStorage.removeItem(k));

  console.log("[Flowstate] All demo data reset.");
}

export function simulateFirstRun() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("flowstate-onboarded");
  console.log("[Flowstate] First-run state simulated. Reload to trigger onboarding.");
}

export function seedMissedDays() {
  if (typeof window === "undefined") return;

  // Overwrite last 3 days with low/zero scores to trigger recovery panel
  const logs = JSON.parse(localStorage.getItem("accountability-logs") ?? "{}");

  [1, 2, 3].forEach((daysAgo) => {
    const date = pastDate(daysAgo);
    logs[date] = {
      completedHabits: daysAgo === 1 ? ["sleep"] : [],
      identityState:   "off",
      energyNote:      "",
      journalEntry:    "",
      journalSaved:    false,
    };
  });

  localStorage.setItem("accountability-logs", JSON.stringify(logs));
  console.log("[Flowstate] Missed days scenario seeded.");
}
