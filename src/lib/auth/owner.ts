// ─── Owner identity ───────────────────────────────────────────────────────────
// Single source of truth for "who is the admin/owner." For this single-owner
// app, the owner is recognized by email as a hard safety net IN ADDITION to the
// DB role (profiles.role='master'/is_admin). Either signal is sufficient, so a
// failed/slow profile read can never silently demote the owner to a member.
//
// If the owner's email ever changes, update OWNER_EMAIL here (the one place).

export const OWNER_EMAIL = "xavellis4@gmail.com";

export function isOwnerEmail(email: string | null | undefined): boolean {
  return !!email && email.trim().toLowerCase() === OWNER_EMAIL;
}
