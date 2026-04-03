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

export function recordActivity(userId: string, type: ActivityType): void {
  try {
    const now = new Date().toISOString();
    localStorage.setItem(`flowstate-last-action-${userId}`, now);
    localStorage.setItem(`flowstate-last-action-type-${userId}`, type);
  } catch { /* ignore */ }
}
