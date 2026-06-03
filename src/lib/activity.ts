/**
 * Activity tracking — records last action to localStorage.
 * Profile page reads these to show "Last action · X ago".
 * Call recordActivity() from any page after a meaningful user action.
 */

export type ActivityType =
  | "Workout logged"
  | "Breathwork session"
  | "Check-in submitted"
  | "Program updated"
  | "Form review submitted"
  | "Client reviewed"
  | "Platform review";

export type ActivityEvent = {
  id: string;
  type: ActivityType;
  loggedAt: string;
};

const HISTORY_KEY = (userId: string) => `flowstate-activity-history-${userId}`;
const MAX_HISTORY = 120;

function loadActivityHistoryInternal(userId: string): ActivityEvent[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ActivityEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function loadActivityHistory(userId: string): ActivityEvent[] {
  return loadActivityHistoryInternal(userId).sort((a, b) => b.loggedAt.localeCompare(a.loggedAt));
}

export function recordActivity(userId: string, type: ActivityType): void {
  try {
    const now = new Date().toISOString();
    localStorage.setItem(`flowstate-last-action-${userId}`, now);
    localStorage.setItem(`flowstate-last-action-type-${userId}`, type);

    const event: ActivityEvent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      loggedAt: now,
    };
    const history = loadActivityHistoryInternal(userId);
    history.unshift(event);
    localStorage.setItem(HISTORY_KEY(userId), JSON.stringify(history.slice(0, MAX_HISTORY)));
  } catch { /* ignore */ }
}
