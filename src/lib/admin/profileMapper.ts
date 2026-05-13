// Map a Supabase Profile (+ optional onboarding flag) into the PlatformUser
// shape the existing admin dashboard UI expects. Keeps the rendering logic
// untouched while the data source flips from localStorage seed to Supabase.

import type { Profile, SubscriptionStatus } from "@/lib/supabase/types";
import type { PlatformUser, UserStatus } from "@/lib/data/store";

export type AdminUser = PlatformUser & {
  archivedAt: string | null;
  onboardingComplete: boolean;
  isAdmin: boolean;
};

export type AdminProfile = Profile & { onboarding_complete?: boolean };

function deriveStatus(p: AdminProfile): UserStatus {
  if (p.archived_at) return "paused";
  const sub: SubscriptionStatus = p.subscription_status;
  if (sub === "past_due") return "churned";
  if (sub === "inactive") return "paused";
  return "active";
}

function deriveName(p: AdminProfile): string {
  if (p.full_name?.trim()) return p.full_name;
  const fn = p.first_name?.trim();
  const ln = p.last_name?.trim();
  const combined = [fn, ln].filter(Boolean).join(" ");
  if (combined) return combined;
  return p.email?.split("@")[0] ?? "Unknown";
}

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60_000);
  if (min < 1)   return "just now";
  if (min < 60)  return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24)   return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 30)    return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12)   return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

function formatJoinDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

export function profileToAdminUser(p: AdminProfile): AdminUser {
  return {
    id:         p.id,
    name:       deriveName(p),
    email:      p.email,
    role:       p.role,
    plan:       p.plan,
    status:     deriveStatus(p),
    lastActive: formatRelative(p.updated_at),
    joinDate:   formatJoinDate(p.created_at),
    trainerId:  p.assigned_trainer_id ?? undefined,
    archivedAt: p.archived_at,
    onboardingComplete: !!p.onboarding_complete,
    isAdmin:    p.is_admin,
  };
}

/** A "lead" is a self-signed-up user with no trainer assigned and not archived. */
export function isLead(u: AdminUser): boolean {
  return u.role === "member" && !u.trainerId && !u.archivedAt && !u.isAdmin;
}
