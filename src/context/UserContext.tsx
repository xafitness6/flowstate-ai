"use client";

import { createContext, useContext, useState, useEffect } from "react";
import type { MockUser, Plan, Role } from "@/types";
import { getAccountById, accountToMockUser } from "@/lib/accounts";
import { createClient } from "@/lib/supabase/client";
import { getMyProfile, profileToMockUser } from "@/lib/db/profiles";
import { signOutEverywhere } from "@/lib/auth/signOut";
import { applyEarlyAccess } from "@/lib/earlyAccess";

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
const EMAIL_KEY     = "flowstate-session-email";
const ID_COOKIE     = "flowstate-session-id";
const VIEW_MODE_KEY = "flowstate-view-mode";
const PLAN_KEY      = (id: string) => `flowstate-plan-${id}`;
const ADMIN_EMAIL   = "xavellis4@gmail.com";

export type ViewMode = "operator" | "personal";

/**
 * Synchronous initializer — reads storage before the first render so
 * demo/localStorage users (including admin) never flash as "member".
 * Supabase users always start as DEMO_USERS.member here and resolve via
 * the async profile fetch; isLoading gates rendering until that completes.
 */
function getInitialUser(): MockUser {
  if (typeof window === "undefined") return applyEarlyAccess(DEMO_USERS.member);
  try {
    const key = sessionStorage.getItem(SS_KEY) || localStorage.getItem(LS_KEY);
    const cookieId = readCookie(ID_COOKIE);
    const email = sessionStorage.getItem(EMAIL_KEY) || localStorage.getItem(EMAIL_KEY) || readCookie(EMAIL_KEY);
    if (email?.trim().toLowerCase() === ADMIN_EMAIL) {
      return applyEarlyAccess({ ...DEMO_USERS.master, id: key ?? cookieId ?? DEMO_USERS.master.id });
    }
    if (key && DEMO_USERS[key]) return applyEarlyAccess(DEMO_USERS[key]);
  } catch { /* ignore */ }
  return applyEarlyAccess(DEMO_USERS.member);
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  return document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length) ?? null;
}

function clearStaleAdminMarkers() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(EMAIL_KEY);
    sessionStorage.removeItem(EMAIL_KEY);
    document.cookie = `${EMAIL_KEY}=; Max-Age=0; path=/; SameSite=Lax`;
    document.cookie = `${ID_COOKIE}=; Max-Age=0; path=/; SameSite=Lax`;
  } catch { /* ignore */ }
}

/** Load a demo/local user from storage — used only when no Supabase session exists. */
function loadDemoUser(): MockUser | null {
  if (typeof window === "undefined") return null;
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

    const cachedAdmin = (() => {
      try {
        const key = sessionStorage.getItem(SS_KEY) || localStorage.getItem(LS_KEY);
        const cookieId = readCookie(ID_COOKIE);
        const email = sessionStorage.getItem(EMAIL_KEY) || localStorage.getItem(EMAIL_KEY) || readCookie(EMAIL_KEY);
        if (email?.trim().toLowerCase() === ADMIN_EMAIL) {
          return { key: key ?? cookieId ?? DEMO_USERS.master.id };
        }
      } catch { /* ignore */ }
      return null;
    })();

    const supabase = createClient();

    async function applySession(session: Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]) {
      if (cancelled) return;

      if (!session) {
        if (cachedAdmin) {
          setUser(applyEarlyAccess({ ...DEMO_USERS.master, id: cachedAdmin.key }));
          setIsSupabase(true);
          setIsLoading(false);
          return;
        }
        const demo = loadDemoUser();
        if (demo) setUser(demo);
        setIsSupabase(false);
        setIsLoading(false);
        return;
      }

      try {
        if (session.user.email?.trim().toLowerCase() !== ADMIN_EMAIL) {
          clearStaleAdminMarkers();
        }

        const profile = await getMyProfile();
        if (cancelled) return;

        if (profile) {
          setUser(applyEarlyAccess(profileToMockUser(profile)));
        } else if (session.user.email?.trim().toLowerCase() === ADMIN_EMAIL) {
          setUser(applyEarlyAccess({ ...DEMO_USERS.master, id: session.user.id }));
        } else {
          // Profile row not ready yet (new user, DB trigger pending).
          // Use the correct UUID so routing checks have the real user ID.
          setUser(prev => applyEarlyAccess({ ...prev, id: session.user.id }));
        }
        setIsSupabase(true);
      } catch (error) {
        if (cancelled) return;
        console.error("[UserContext] session profile resolution failed:", error);
        if (session.user.email?.trim().toLowerCase() === ADMIN_EMAIL) {
          setUser(applyEarlyAccess({ ...DEMO_USERS.master, id: session.user.id }));
          setIsSupabase(true);
        } else {
          setUser(prev => applyEarlyAccess({ ...prev, id: session.user.id }));
          setIsSupabase(true);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    // Initial session check — always resolves isLoading so the app never parks
    // forever on the black routing shell after OAuth.
    supabase.auth
      .getSession()
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
      async (event, session) => {
        try {
          if (session) {
            await applySession(session);
            return;
          }
          // Session ended — check for demo fallback
          if (cancelled) return;
          if (cachedAdmin) {
            setUser(applyEarlyAccess({ ...DEMO_USERS.master, id: cachedAdmin.key }));
            setIsSupabase(true);
            setIsLoading(false);
            return;
          }
          setIsSupabase(false);
          const demo = loadDemoUser();
          setUser(applyEarlyAccess(demo ?? DEMO_USERS.member));
          setIsLoading(false);
        } catch (error) {
          if (cancelled) return;
          console.error("[UserContext] auth state change failed:", error);
          setIsLoading(false);
        }
      }
    );

    return () => {
      cancelled = true;
      window.clearTimeout(loadingFallback);
      subscription.unsubscribe();
    };
  }, []);

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
