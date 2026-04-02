import type { Role } from "@/types";

export const ROLE_HIERARCHY: Record<Role, number> = {
  member:  1,
  client:  2,
  trainer: 3,
  master:  4,  // internal — never expose this string in UI
};

export function hasAccess(userRole: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * UI-safe admin check. Use this everywhere in components.
 * Never check role === "master" directly in templates.
 */
export function isAdmin(role: Role): boolean {
  return role === "master";
}

/** @deprecated use isAdmin() */
export function isMaster(role: Role): boolean {
  return role === "master";
}

export function canHoverOthers(role: Role): boolean {
  return role === "master" || role === "trainer";
}

export function canOpenOtherProfile(role: Role): boolean {
  return role === "master" || role === "trainer";
}

// ─── CLIENT PERMISSIONS ────────────────────────────────────────────────────

export function canClientViewOwnData(role: Role): boolean {
  return role === "client";
}

export function canClientLogWorkouts(role: Role): boolean {
  return role === "client";
}

export function canClientUploadVideos(role: Role): boolean {
  return role === "client";
}

export function canClientDelete(role: Role): boolean {
  return false; // clients can never delete
}

// ─── TRAINER PERMISSIONS ───────────────────────────────────────────────────

export function canTrainerViewAssignedClients(role: Role): boolean {
  return role === "trainer" || role === "master";
}

export function canTrainerAddClients(role: Role): boolean {
  return role === "trainer" || role === "master";
}

export function canTrainerDeleteOwnClients(role: Role): boolean {
  return role === "trainer" || role === "master";
}

export function canTrainerDeleteTrainers(role: Role): boolean {
  return role === "master"; // only master can delete trainers
}

export function canTrainerReviewSubmissions(role: Role): boolean {
  return role === "trainer" || role === "master";
}

// ─── MASTER PERMISSIONS ────────────────────────────────────────────────────

export function canMasterManageEverything(role: Role): boolean {
  return role === "master";
}

export function canDeleteUser(userRole: Role, targetRole: Role): boolean {
  if (userRole !== "master") return false;
  return true;
}

export function canAddTrainer(role: Role): boolean {
  return role === "master";
}

export function canAddClient(role: Role): boolean {
  return role === "trainer" || role === "master";
}
