export type BreathSpeed = "fast" | "medium" | "slow";

// Milliseconds per individual inhale or exhale at each speed
export const SPEED_INTERVAL_MS: Record<BreathSpeed, number> = {
  fast:   2000,  // 2s in · 2s out = 4s per breath cycle
  medium: 4000,  // 4s in · 4s out = 8s per breath cycle
  slow:   6000,  // 6s in · 6s out = 12s per breath cycle
};

export type BreathworkSettings = {
  rounds: number;           // 1–10
  breathsPerRound: number;  // 10–60
  recoveryDuration: number; // 5–30 seconds
  speed: BreathSpeed;       // inhale/exhale pace
};

export const DEFAULT_SETTINGS: BreathworkSettings = {
  rounds: 3,
  breathsPerRound: 30,
  recoveryDuration: 15,
  speed: "medium",
};

export type BreathworkSession = {
  id: string;
  date: string;           // ISO date string
  completedAt: string;    // ISO timestamp
  settings: BreathworkSettings;
  roundsCompleted: number;
  totalBreaths: number;
  holdTimes: number[];    // seconds per round
  totalDuration: number;  // seconds
};

export type BreathworkAnalytics = {
  totalSessions: number;
  totalRounds: number;
  totalBreaths: number;
  totalHoldTime: number;    // seconds
  longestHold: number;      // seconds
  avgHoldTime: number;      // seconds
  sessionsThisWeek: number;
  sessionsByWeek: { week: string; count: number }[];   // last 8 weeks
  holdTrend: { date: string; avgHold: number }[];       // last 14 sessions
};
