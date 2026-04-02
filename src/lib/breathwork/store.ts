import type { BreathworkSession, BreathworkSettings, BreathworkAnalytics } from "./types";
import { DEFAULT_SETTINGS } from "./types";

const SESSIONS_KEY = "flowstate-breathwork-sessions";
const SETTINGS_KEY = "flowstate-breathwork-settings";

// ─── Settings ────────────────────────────────────────────────────────────────

export function loadSettings(): BreathworkSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: BreathworkSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch { /* ignore */ }
}

// ─── Session history ─────────────────────────────────────────────────────────

export function loadSessions(): BreathworkSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as BreathworkSession[];
  } catch {
    return [];
  }
}

export function saveSession(session: BreathworkSession): void {
  try {
    const sessions = loadSessions();
    sessions.push(session);
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  } catch { /* ignore */ }
}

// ─── Analytics ───────────────────────────────────────────────────────────────

function isoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function computeAnalytics(sessions: BreathworkSession[]): BreathworkAnalytics {
  if (sessions.length === 0) {
    return {
      totalSessions: 0,
      totalRounds: 0,
      totalBreaths: 0,
      totalHoldTime: 0,
      longestHold: 0,
      avgHoldTime: 0,
      sessionsThisWeek: 0,
      sessionsByWeek: [],
      holdTrend: [],
    };
  }

  const now = new Date();
  const currentWeek = isoWeek(now);
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  let totalRounds = 0;
  let totalBreaths = 0;
  let totalHoldTime = 0;
  let longestHold = 0;
  let sessionsThisWeek = 0;
  const weekCounts: Record<string, number> = {};
  const allHolds: number[] = [];

  for (const s of sessions) {
    totalRounds += s.roundsCompleted;
    totalBreaths += s.totalBreaths;
    for (const h of s.holdTimes) {
      totalHoldTime += h;
      if (h > longestHold) longestHold = h;
      allHolds.push(h);
    }
    const sessionDate = new Date(s.completedAt);
    if (sessionDate >= weekStart) sessionsThisWeek++;
    const week = isoWeek(sessionDate);
    weekCounts[week] = (weekCounts[week] ?? 0) + 1;
  }

  // Last 8 weeks
  const sessionsByWeek: { week: string; count: number }[] = [];
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    const w = isoWeek(d);
    sessionsByWeek.push({ week: w, count: weekCounts[w] ?? 0 });
  }

  // Hold trend: last 14 sessions, avg hold per session
  const recent = sessions.slice(-14);
  const holdTrend = recent.map((s) => ({
    date: s.date,
    avgHold:
      s.holdTimes.length > 0
        ? Math.round(s.holdTimes.reduce((a, b) => a + b, 0) / s.holdTimes.length)
        : 0,
  }));

  return {
    totalSessions: sessions.length,
    totalRounds,
    totalBreaths,
    totalHoldTime,
    longestHold,
    avgHoldTime: allHolds.length > 0 ? Math.round(totalHoldTime / allHolds.length) : 0,
    sessionsThisWeek,
    sessionsByWeek,
    holdTrend,
  };
}
