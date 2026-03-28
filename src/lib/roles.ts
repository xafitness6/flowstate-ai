import type { Role } from "@/types";

export const ROLE_HIERARCHY: Record<Role, number> = {
  member: 1,
  client: 2,
  trainer: 3,
  master: 4,
};

export function hasAccess(userRole: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export function isMaster(role: Role): boolean {
  return role === "master";
}

/**
 * Returns true if the viewer's role allows them to see hover snapshot cards
 * on other users. clients and members never get hover cards on others.
 */
export function canHoverOthers(role: Role): boolean {
  return role === "master" || role === "trainer";
}

/**
 * Returns true if the viewer may navigate to a full profile page for someone
 * other than themselves.
 */
export function canOpenOtherProfile(role: Role): boolean {
  return role === "master" || role === "trainer";
}
