export type BreathworkSettings = {
  rounds: number;           // 1–10
  breathsPerRound: number;  // 10–60
  recoveryDuration: number; // 5–30 seconds
};

export const DEFAULT_SETTINGS: BreathworkSettings = {
  rounds: 3,
  breathsPerRound: 30,
  recoveryDuration: 15,
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
