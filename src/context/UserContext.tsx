"use client";

import { createContext, useContext, useState, useEffect } from "react";
import type { MockUser, Plan, Role } from "@/types";
import type { Profile } from "@/lib/supabase/types";
import { trace as authTrace, mark as authMark } from "@/lib/authTrace";
import { getAccountById, accountToMockUser } from "@/lib/accounts";
import { createClient } from "@/lib/supabase/client";
import { getMyProfile, profileToMockUser } from "@/lib/db/profiles";
import { signOutEverywhere } from "@/lib/auth/signOut";
import { applyEarlyAccess } from "@/lib/earlyAccess";
import { DEMO_AUTH_ENABLED } from "@/lib/auth/config";
import { isOwnerEmail } from "@/lib/auth/owner";

export const DEMO_USERS: Record<string, MockUser> = {
  master: {
    id:                 "usr_001",
    name:               "Xavier Ellis",
    role:               "master",
    status:             "active",
    pushLevel:          6,
    defaultDashboard:   "overview",
    plan:               "coaching",
    subscriptionStatus: "active", // demo always active
  },
  trainer: {
    id:                 "u4",
    name:               "Alex Rivera",
    role:               "trainer",
    status:             "active",
    pushLevel:          7,
    defaultDashboard:   "program",
    plan:               "performance",
    subscriptionStatus: "active",
  },
  client: {
    id:                 "u1",
    name:               "Kai Nakamura",
    role:               "client",
    status:             "active",
    pushLevel:          5,
    defaultDashboard:   "program",
    plan:               "training",
    subscriptionStatus: "active",
  },
  member: {
    id:                 "u6",
    name:               "Luca Ferretti",
    role:               "member",
    status:             "active",
    pushLevel:          4,
    defaultDashboard:   "accountability",
    plan:               "foundation",
    subscriptionStatus: "active",
  },
};

const LS_KEY        = "flowstate-active-role";
const SS_KEY        = "flowstate-session-role";
const VIEW_MODE_KEY = "flowstate-view-mode";
const PLAN_KEY      = (id: string) => `flowstate-plan-${id}`;

export type ViewMode = "operator" | "personal";

/**
 * Synchronous initializer — reads storage before the first render so
 * demo/localStorage users (including admin) never flash as "member".
 * Supabase users always start as DEMO_USERS.member here and resolve via
 * the async profile fetch; isLoading gates rendering until that completes.
 */
function getInitialUser(): MockUser {
  if (typeof window === "undefined") return applyEarlyAccess(DEMO_USERS.member);
  if (!DEMO_AUTH_ENABLED) return applyEarlyAccess(DEMO_USERS.member);
  try {
    const key = sessionStorage.getItem(SS_KEY) || localStorage.getItem(LS_KEY);
    if (key && DEMO_USERS[key]) return applyEarlyAccess(DEMO_USERS[key]);
  } catch { /* ignore */ }
  return applyEarlyAccess(DEMO_USERS.member);
}

/** Load a demo/local user from storage — used only when no Supabase session exists. */
function loadDemoUser(): MockUser | null {
  if (typeof window === "undefined") return null;
  if (!DEMO_AUTH_ENABLED) return null;
  try {
    const key = sessionStorage.getItem(SS_KEY) || localStorage.getItem(LS_KEY);
    if (!key) return null;

    // 1. Demo accounts: key is a role name ("master", "client", etc.)
    if (DEMO_USERS[key]) {
      const base = DEMO_USERS[key];
      const savedPlan = localStorage.getItem(PLAN_KEY(base.id)) as Plan | null;
      return applyEarlyAccess(savedPlan ? { ...base, plan: savedPlan } : base);
    }

    // 2. Dynamically created local accounts: key is an account ID ("usr_…")
    const account = getAccountById(key);
    if (account) {
      const base = accountToMockUser(account);
      const savedPlan = localStorage.getItem(PLAN_KEY(base.id)) as Plan | null;
      return applyEarlyAccess(savedPlan ? { ...base, plan: savedPlan } : base);
    }
  } catch { /* ignore */ }
  return null;
}

/**
 * Build a usable identity straight from the Supabase session when the
 * `profiles` row can't be read. NEVER fall back to a DEMO_USERS persona for a
 * real session — that's what made a logged-in user show as "Luca Ferretti".
 * Uses the real UUID + the name/role captured in auth metadata at signup.
 */
function sessionToMockUser(sessionUser: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}): MockUser {
  const meta = sessionUser.user_metadata ?? {};
  const metaName = typeof meta.full_name === "string" ? meta.full_name.trim() : "";
  const first = typeof meta.first_name === "string" ? meta.first_name.trim() : "";
  const last  = typeof meta.last_name === "string" ? meta.last_name.trim() : "";
  const metaRole = typeof meta.role === "string" ? meta.role : "";
  const role: Role = (["member", "client", "trainer", "master"] as const).includes(metaRole as Role)
    ? (metaRole as Role)
    : "member";
  return applyEarlyAccess({
    ...DEMO_USERS.member,                       // sane push-level / dashboard defaults only
    id:                 sessionUser.id,         // real UUID — critical for DB reads
    name:               metaName || `${first} ${last}`.trim() || sessionUser.email || "Your account",
    role,
    plan:               "foundation",
    subscriptionStatus: "inactive",
  });
}

function withAuthTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
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

type UserContextValue = {
  user:        MockUser;
  isLoading:   boolean;  // true until user identity is fully resolved (async)
  isSupabase:  boolean;  // true when session is from Supabase Auth
  setRole:     (role: Role) => void;
  switchUser:  (demoKey: keyof typeof DEMO_USERS) => void;
  logout:      () => void;
  viewMode:    ViewMode;
  setViewMode: (m: ViewMode) => void;
  updatePlan:  (plan: Plan) => void;
};

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user,        setUser]          = useState<MockUser>(getInitialUser);
  const [isLoading,   setIsLoading]     = useState(true);
  const [isSupabase,  setIsSupabase]    = useState(false);
  const [viewMode,    setViewModeState] = useState<ViewMode>("operator");

  useEffect(() => {
    let cancelled = false;

    // Restore view mode preference
    try {
      const saved = localStorage.getItem(VIEW_MODE_KEY) as ViewMode | null;
      if (saved === "personal" || saved === "operator") setViewModeState(saved);
    } catch { /* ignore */ }

    // Only initialize Supabase when env vars are configured
    const supabaseConfigured =
      !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
      !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseConfigured) {
      // No Supabase — load demo/local user from storage and stop
      const demo = loadDemoUser();
      if (demo) setUser(demo);
      setIsLoading(false);
      return;
    }

    const supabase = createClient();

    async function applySession(session: Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]) {
      if (cancelled) return;

      authMark("UserContext.applySession", session ? "has session" : "no session");

      if (!session) {
        const demo = loadDemoUser();
        if (demo) setUser(demo);
        setIsSupabase(false);
        setIsLoading(false);
        return;
      }

      // OWNER SAFETY NET — the owner is admin by email, full stop. Set master
      // identity immediately and NEVER fall through to a member persona, even
      // if the profiles row is slow/unreadable. (Belt-and-suspenders with the
      // DB role.) Repair the DB profile in the background.
      if (isOwnerEmail(session.user.email)) {
        authMark("UserContext.identity", "owner email → master (safety net)");
        const meta = session.user.user_metadata ?? {};
        const ownerName = typeof meta.full_name === "string" && meta.full_name.trim()
          ? meta.full_name.trim()
          : DEMO_USERS.master.name;
        setUser(applyEarlyAccess({ ...DEMO_USERS.master, id: session.user.id, name: ownerName }));
        setIsSupabase(true);
        setIsLoading(false);
        void fetch("/api/auth/sync-profile", { method: "POST" }).catch(() => {});
        return;
      }

      try {
        const profile = await withAuthTimeout(
          getMyProfile(),
          3_500,
          "UserContext.getMyProfile",
        ).catch((error) => {
          authMark("UserContext.getMyProfile", error instanceof Error ? error.message : String(error));
          return null;
        });
        if (cancelled) return;

        if (profile) {
          authMark("UserContext.identity", "profile row → real identity");
          setUser(applyEarlyAccess(profileToMockUser(profile)));
        } else {
          // No profiles row — the handle_new_user trigger may not have fired
          // or a prior sync failed. Recover it server-side (service role),
          // then refetch once. Only if that still fails do we fall back to a
          // session-derived identity (never the demo "member" persona).
          authMark("UserContext.identity", "NO profile row — attempting sync-profile recovery");
          let recovered: Profile | null = null;
          try {
            const res = await authTrace("UserContext.syncProfile", () =>
              fetch("/api/auth/sync-profile", { method: "POST" }),
            );
            if (!res.ok) {
              const body = await res.json().catch(() => ({} as { error?: string }));
              authMark("UserContext.syncProfile", `FAILED status=${res.status} err=${body?.error ?? "?"}`);
            }
            recovered = await withAuthTimeout(
              getMyProfile(),
              3_500,
              "UserContext.recoveredProfile",
            ).catch(() => null);
          } catch (e) {
            authMark("UserContext.syncProfile", `threw: ${e instanceof Error ? e.message : String(e)}`);
          }
          if (cancelled) return;
          authMark("UserContext.identity", recovered
            ? "recovered profile after sync"
            : "FELL BACK to session-derived identity (no profile)");
          setUser(recovered
            ? applyEarlyAccess(profileToMockUser(recovered))
            : sessionToMockUser(session.user));
        }
        setIsSupabase(true);
      } catch (error) {
        if (cancelled) return;
        console.error("[UserContext] session profile resolution failed:", error);
        authMark("UserContext.identity", `EXCEPTION in resolution: ${error instanceof Error ? error.message : String(error)}`);
        setUser(sessionToMockUser(session.user));
        setIsSupabase(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    // Initial session check — always resolves isLoading so the app never parks
    // forever on the black routing shell after OAuth.
    authTrace("UserContext.getSession", () =>
      withAuthTimeout(supabase.auth.getSession(), 5_000, "UserContext.getSession"),
    )
      .then(({ data: { session } }) => applySession(session))
      .catch((error) => {
        if (cancelled) return;
        console.error("[UserContext] getSession failed:", error);
        const demo = loadDemoUser();
        if (demo) setUser(demo);
        setIsSupabase(false);
        setIsLoading(false);
      });

    const loadingFallback = window.setTimeout(() => {
      if (cancelled) return;
      setIsLoading((wasLoading) => {
        if (!wasLoading) return wasLoading;
        console.error("[UserContext] auth resolution timed out; releasing app shell.");
        return false;
      });
    }, 5000);

    // Listen for auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        // Supabase holds an internal auth lock while this callback runs. Doing
        // awaited Supabase reads here can block setSession/updateUser calls,
        // which is especially painful on reset/invite password links.
        window.setTimeout(() => {
          void (async () => {
            try {
              if (session) {
                await applySession(session);
                return;
              }
              // Session ended (logout / expiry). If there's a genuine demo
              // session in storage, restore it; otherwise show a NEUTRAL
              // signed-out identity — never DEMO_USERS.member, or a logging-out
              // user briefly sees a real demo persona's name ("Luca Ferretti").
              if (cancelled) return;
              setIsSupabase(false);
              const demo = loadDemoUser();
              setUser(applyEarlyAccess(demo ?? { ...DEMO_USERS.member, id: "signed-out", name: "" }));
              setIsLoading(false);
            } catch (error) {
              if (cancelled) return;
              console.error("[UserContext] auth state change failed:", error);
              setIsLoading(false);
            }
          })();
        }, 0);
      },
    );

    return () => {
      cancelled = true;
      window.clearTimeout(loadingFallback);
      subscription.unsubscribe();
    };
  }, []);

  // Re-fetch the profile (plan / role) when the tab regains focus, so an admin
  // change like a plan upgrade takes effect without a full re-login. Supabase
  // non-owner accounts only; the owner is always master.
  useEffect(() => {
    if (!isSupabase) return;
    function onVisible() {
      if (document.visibilityState !== "visible") return;
      void (async () => {
        try {
          const supabase = createClient();
          const { data: { user: sUser } } = await supabase.auth.getUser();
          if (!sUser?.id || isOwnerEmail(sUser.email)) return;
          const profile = await getMyProfile().catch(() => null);
          if (profile) setUser(applyEarlyAccess(profileToMockUser(profile)));
        } catch { /* ignore */ }
      })();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [isSupabase]);

  function setRole(role: Role) {
    if (isSupabase) return; // don't allow role switching on real accounts
    const match = Object.values(DEMO_USERS).find((u) => u.role === role) ?? { ...user, role };
    setUser(applyEarlyAccess(match));
    try { localStorage.setItem(LS_KEY, role); } catch { /* ignore */ }
  }

  function switchUser(demoKey: keyof typeof DEMO_USERS) {
    if (isSupabase) return; // don't allow demo switching on real accounts
    const next = DEMO_USERS[demoKey];
    if (!next) return;
    const savedPlan = (() => {
      try { return localStorage.getItem(PLAN_KEY(next.id)) as Plan | null; } catch { return null; }
    })();
    setUser(applyEarlyAccess(savedPlan ? { ...next, plan: savedPlan } : next));
    try { localStorage.setItem(LS_KEY, demoKey); } catch { /* ignore */ }
  }

  async function logout() {
    // Delegate to the single-source-of-truth signOut helper. It clears the
    // Supabase session, every flowstate-* storage key, and biometric creds,
    // then hard-navigates to /login. Do NOT pre-set context state here —
    // pre-setting DEMO_USERS.member is what caused the "blank shell with
    // stale member sidebar" leak between the state mutation and the redirect.
    await signOutEverywhere();
  }

  function setViewMode(m: ViewMode) {
    setViewModeState(m);
    try { localStorage.setItem(VIEW_MODE_KEY, m); } catch { /* ignore */ }
  }

  function updatePlan(plan: Plan) {
    setUser((prev) => ({ ...prev, plan }));
    if (!isSupabase) {
      // Only persist to localStorage for demo accounts; Supabase accounts update via profile
      try { localStorage.setItem(PLAN_KEY(user.id), plan); } catch { /* ignore */ }
    }
  }

  return (
    <UserContext.Provider value={{ user, isLoading, isSupabase, setRole, switchUser, logout, viewMode, setViewMode, updatePlan }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
}
