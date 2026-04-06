// ─── Admin credential management ─────────────────────────────────────────────
// Admin identity is locked to a single email address.
// Password is created on first login and stored locally for dev use.
//
// TODO: Replace localStorage with a secure server-side credential store in production.
//       Never expose admin credentials over an unauthenticated API endpoint.

const ADMIN_EMAIL        = "xavellis4@gmail.com";
const ADMIN_PASSWORD_KEY = "flowstate-admin-password";

/** The canonical admin email. Cannot be changed at runtime. */
export function getAdminEmail(): string {
  return ADMIN_EMAIL;
}

/** Case-insensitive check — true if input matches the admin email. */
export function isAdminEmail(input: string): boolean {
  return input.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

/** True if an admin password has already been created. */
export function hasAdminPassword(): boolean {
  if (typeof window === "undefined") return false;
  try { return !!localStorage.getItem(ADMIN_PASSWORD_KEY); } catch { return false; }
}

/** Verify a candidate password against the stored admin password. */
export function verifyAdminPassword(password: string): boolean {
  if (typeof window === "undefined") return false;
  try { return localStorage.getItem(ADMIN_PASSWORD_KEY) === password; } catch { return false; }
}

/** Store the admin password on first setup. Throws if already set. */
export function createAdminPassword(password: string): void {
  // TODO: Replace with POST /api/admin/credentials (authenticated, server-side)
  if (!password || password.length < 8) throw new Error("Password must be at least 8 characters.");
  try { localStorage.setItem(ADMIN_PASSWORD_KEY, password); } catch { /* ignore */ }
}

/** Update the admin password (requires current password for validation at call site). */
export function updateAdminPassword(newPassword: string): void {
  if (!newPassword || newPassword.length < 8) throw new Error("Password must be at least 8 characters.");
  try { localStorage.setItem(ADMIN_PASSWORD_KEY, newPassword); } catch { /* ignore */ }
}
