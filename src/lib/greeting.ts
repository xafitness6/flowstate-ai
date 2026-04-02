// ─── Greeting message system ──────────────────────────────────────────────────
// State is inferred from localStorage timestamps. No server needed.
// Messages rotate sequentially per category to avoid repeats.

export type GreetingState = "consistent" | "progress" | "inactive" | "default";

const LS_LAST_VISIT = "flowstate-last-visit-ts";
const LS_IDX        = "flowstate-greeting-idx";
const SS_SHOWN      = "flowstate-greeting-shown";

// ─── Message pools ────────────────────────────────────────────────────────────

const MESSAGES: Record<GreetingState, string[]> = {
  consistent: [
    "You're back. Good.",
    "Three sessions this week. That's the pace.",
    "Showing up again. This is how it compounds.",
    "Back in. Don't waste the momentum.",
    "The habit is forming. Keep it intact.",
  ],
  progress: [
    "The numbers are moving. Keep the standard.",
    "You're building something. Don't interrupt it.",
    "Metrics are tracking. Execute today's session.",
    "Ahead of pace this week. Match it.",
    "The work is showing. Don't change what's working.",
  ],
  inactive: [
    "Welcome back. The program doesn't wait, but it does remember.",
    "You've had a break. Now make it mean something.",
    "It's been a while. Pick up where the program left off.",
    "Back now. Let's not count the days away.",
    "The gap is over. Start clean.",
  ],
  default: [
    "Your program is ready. Begin when you are.",
    "Everything's set. Start the session.",
    "The plan is built. The rest is execution.",
    "Here's your work for today. Make it simple — just do it.",
    "Program loaded. No reason to wait.",
  ],
};

// 12% chance of a personality override — sharper, wittier, still premium
const PERSONALITY: string[] = [
  "You know what to do. You always have.",
  "The hardest part is already done. You showed up.",
  "No preamble needed. Let's go.",
  "Consistency isn't glamorous. That's exactly why it works.",
  "Most people are still planning. You're already here.",
];

// ─── State detection ──────────────────────────────────────────────────────────

function detectState(): GreetingState {
  try {
    const lastTs = localStorage.getItem(LS_LAST_VISIT);
    if (!lastTs) return "default";

    const diffHours = (Date.now() - Number(lastTs)) / 3_600_000;

    if (diffHours < 36)  return "consistent";
    if (diffHours < 120) return "progress";
    return "inactive";
  } catch {
    return "default";
  }
}

// ─── Index rotation (no consecutive repeats) ──────────────────────────────────

function nextMessage(state: GreetingState, pool: string[]): string {
  try {
    const stored  = JSON.parse(localStorage.getItem(LS_IDX) ?? "{}") as Record<string, number>;
    const last    = stored[state] ?? -1;
    const next    = (last + 1) % pool.length;
    stored[state] = next;
    localStorage.setItem(LS_IDX, JSON.stringify(stored));
    return pool[next];
  } catch {
    return pool[0];
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export type GreetingResult = {
  message:    string;
  state:      GreetingState;
  personality: boolean;
};

/**
 * Call once per session load. Returns the greeting to display.
 * Returns null if the greeting has already been shown this browser session.
 */
export function getLoginGreeting(): GreetingResult | null {
  try {
    // Only show once per browser session
    if (sessionStorage.getItem(SS_SHOWN)) return null;
    sessionStorage.setItem(SS_SHOWN, "1");

    const state       = detectState();
    const isPersonal  = Math.random() < 0.12;
    const pool        = isPersonal ? PERSONALITY : MESSAGES[state];
    const message     = nextMessage(isPersonal ? "personality" as GreetingState : state, pool);

    // Update the visit timestamp AFTER reading state
    localStorage.setItem(LS_LAST_VISIT, String(Date.now()));

    return { message, state, personality: isPersonal };
  } catch {
    return null;
  }
}
