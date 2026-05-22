"use client";

import type { Profile } from "@/lib/supabase/types";
import { mark as authMark } from "@/lib/authTrace";
import { getMyProfile } from "@/lib/db/profiles";
import { resolveOnboardingRoute } from "@/lib/db/onboarding";
import { LS_KEY, SS_KEY } from "@/lib/routing";

const PENDING_INVITE_TOKEN_KEY = "flowstate-pending-invite-token";

type AuthenticatedUser = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

export type PostAuthDestination =
  | {
      kind: "ok";
      destination: string;
      profile: Profile | null;
      inviteAccepted: boolean;
    }
  | {
      kind: "archived";
      destination: "/login?error=archived";
      profile: Profile;
      inviteAccepted: boolean;
    };

function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    Promise.resolve(promise).then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function getInviteToken(metadata?: Record<string, unknown> | null): string | null {
  const token = metadata?.invite_token;
  return typeof token === "string" && token.length >= 16 ? token : null;
}

function getPendingInviteToken(): string | null {
  try {
    const token =
      sessionStorage.getItem(PENDING_INVITE_TOKEN_KEY) ||
      localStorage.getItem(PENDING_INVITE_TOKEN_KEY);
    return token && token.length >= 16 ? token : null;
  } catch {
    return null;
  }
}

function clearPendingInviteToken() {
  try {
    sessionStorage.removeItem(PENDING_INVITE_TOKEN_KEY);
    localStorage.removeItem(PENDING_INVITE_TOKEN_KEY);
  } catch { /* ignore */ }
}

function markInviteAccepted() {
  try { localStorage.setItem("flowstate-via-invite", "true"); } catch { /* ignore */ }
}

export function persistUserSession(userId: string) {
  try {
    localStorage.setItem(LS_KEY, userId);
    sessionStorage.setItem(SS_KEY, userId);
    document.cookie = `flowstate-session-id=${encodeURIComponent(userId)}; Max-Age=${60 * 60 * 24 * 30}; path=/; SameSite=Lax`;
  } catch { /* ignore */ }
}

export function roleHomeDestination(role?: string | null): string {
  if (role === "trainer") return "/trainers";
  if (role === "master") return "/admin";
  return "/dashboard";
}

async function acceptInviteToken(inviteToken: string): Promise<boolean> {
  const res = await withTimeout(
    fetch(`/api/invites/${encodeURIComponent(inviteToken)}`, {
      method: "POST",
      cache: "no-store",
    }),
    5_000,
    "invite acceptance",
  );

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    const error = body.error ?? `Invite acceptance failed (${res.status})`;
    authMark("postAuth.acceptInvite", error);
    return false;
  }

  clearPendingInviteToken();
  markInviteAccepted();
  return true;
}

async function acceptCurrentInviteByEmail(): Promise<boolean> {
  try {
    const res = await withTimeout(
      fetch("/api/invites/accept-current", {
        method: "POST",
        cache: "no-store",
      }),
      5_000,
      "current invite acceptance",
    );
    const body = await res.json().catch(() => ({})) as { ok?: boolean };
    if (res.ok && body.ok) {
      clearPendingInviteToken();
      markInviteAccepted();
      return true;
    }
  } catch (error) {
    authMark("postAuth.acceptCurrentInvite", error instanceof Error ? error.message : String(error));
  }
  return false;
}

export async function acceptPendingInvite(metadata?: Record<string, unknown> | null): Promise<boolean> {
  const tokens = [
    getPendingInviteToken(),
    getInviteToken(metadata),
  ].filter((token, index, all): token is string =>
    Boolean(token) && all.indexOf(token) === index,
  );

  for (const token of tokens) {
    if (await acceptInviteToken(token)) return true;
  }

  return acceptCurrentInviteByEmail();
}

async function syncProfile(): Promise<Profile | null> {
  try {
    const res = await withTimeout(
      fetch("/api/auth/sync-profile", { method: "POST", cache: "no-store" }),
      3_500,
      "profile sync",
    );
    if (!res.ok) return null;
    const body = await res.json().catch(() => ({})) as { profile?: Profile };
    return body.profile ?? null;
  } catch (error) {
    authMark("postAuth.syncProfile", error instanceof Error ? error.message : String(error));
    return null;
  }
}

export async function resolvePostAuthDestination(user: AuthenticatedUser): Promise<PostAuthDestination> {
  persistUserSession(user.id);

  const inviteAccepted = await acceptPendingInvite(user.user_metadata);
  const synced = await syncProfile();
  const profile = await withTimeout(getMyProfile(), 3_500, "profile load").catch(() => null);
  const resolvedProfile = profile ?? synced;

  if (resolvedProfile?.archived_at) {
    return {
      kind: "archived",
      destination: "/login?error=archived",
      profile: resolvedProfile,
      inviteAccepted,
    };
  }

  if (resolvedProfile?.is_admin || resolvedProfile?.role === "master") {
    return {
      kind: "ok",
      destination: "/admin",
      profile: resolvedProfile,
      inviteAccepted,
    };
  }

  const blocker = await withTimeout(
    resolveOnboardingRoute(user.id),
    3_500,
    "onboarding route",
  ).catch(() => "/onboarding/walkthrough");

  const viaInvite = inviteAccepted || (() => {
    try { return localStorage.getItem("flowstate-via-invite") === "true"; }
    catch { return false; }
  })();

  const destination =
    viaInvite && blocker === "/onboarding/walkthrough"
      ? "/onboarding/calibration"
      : blocker ?? roleHomeDestination(resolvedProfile?.role);

  return {
    kind: "ok",
    destination,
    profile: resolvedProfile ?? null,
    inviteAccepted,
  };
}
