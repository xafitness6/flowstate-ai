// Per-user Learn progress — which articles the user has marked complete.
// Stored in localStorage (low-stakes reading progress; no server round-trip).

const KEY = (userId: string) => `flowstate-learn-progress-${userId}`;

export function loadLearnProgress(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(KEY(userId));
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

export function saveLearnProgress(userId: string, done: Set<string>): void {
  try {
    localStorage.setItem(KEY(userId), JSON.stringify([...done]));
  } catch { /* quota */ }
}
