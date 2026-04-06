// ─── Admin credential management ─────────────────────────────────────────────
// Stores the master/admin login credentials in localStorage.
// Defaults to ADMIN / ADMIN on first use.
// Only readable/writable client-side. Server routes should use env vars in prod.
//
// TODO: Replace with a secure server-side credential store in production.
//       Never expose admin credentials over an unauthenticated API endpoint.

const ADMIN_CREDS_KEY = "flowstate-admin-credentials";

const DEFAULTS = { username: "ADMIN", password: "ADMIN" } as const;

export type AdminCredentials = { username: string; password: string };

export function getAdminCredentials(): AdminCredentials {
  if (typeof window === "undefined") return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(ADMIN_CREDS_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<AdminCredentials>;
    return {
      username: parsed.username || DEFAULTS.username,
      password: parsed.password || DEFAULTS.password,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function updateAdminCredentials(username: string, password: string): void {
  // TODO: Replace with POST /api/admin/credentials (authenticated, server-side)
  try {
    if (!username.trim() || !password) throw new Error("Invalid credentials");
    localStorage.setItem(ADMIN_CREDS_KEY, JSON.stringify({ username: username.trim(), password }));
  } catch { /* ignore */ }
}
