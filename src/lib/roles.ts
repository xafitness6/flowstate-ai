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
