"use client";

import { createContext, useContext, useState, useEffect } from "react";
import type { MockUser, Plan, Role } from "@/types";
import { clearBiometric } from "@/lib/biometric";
import { getAccountById, accountToMockUser } from "@/lib/accounts";
import { createClient } from "@/lib/supabase/client";
import { getMyProfile, profileToMockUser } from "@/lib/db/profiles";

export const DEMO_USERS: Record<string, MockUser> = {
  master: {
    id:               "usr_001",
    name:             "Xavier Ellis",
    role:             "master",
    status:           "active",
    pushLevel:        6,
    defaultDashboard: "overview",
    plan:             "coaching",
  },
  trainer: {
    id:               "u4",
    name:             "Alex Rivera",
    role:             "trainer",
    status:           "active",
    pushLevel:        7,
    defaultDashboard: "program",
    plan:             "performance",
  },
  client: {
    id:               "u1",
    name:             "Kai Nakamura",
    role:             "client",
    status:           "active",
    pushLevel:        5,
    defaultDashboard: "program",
    plan:             "training",
  },
  member: {
    id:               "u6",
    name:             "Luca Ferretti",
    role:             "member",
    status:           "active",
    pushLevel:        4,
    defaultDashboard: "accountability",
    plan:             "foundation",
  },
};

const LS_KEY        = "flowstate-active-role";
const SS_KEY        = "flowstate-session-role";
const VIEW_MODE_KEY = "flowstate-view-mode";
const PLAN_KEY      = (id: string) => `flowstate-plan-${id}`;

export type ViewMode = "operator" | "personal";

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
      return savedPlan ? { ...base, plan: savedPlan } : base;
    }

    // 2. Dynamically created local accounts: key is an account ID ("usr_…")
    const account = getAccountById(key);
    if (account) {
      const base = accountToMockUser(account);
      const savedPlan = localStorage.getItem(PLAN_KEY(base.id)) as Plan | null;
      return savedPlan ? { ...base, plan: savedPlan } : base;
    }
  } catch { /* ignore */ }
  return null;
}

type UserContextValue = {
  user:        MockUser;
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
  const [user,        setUser]          = useState<MockUser>(DEMO_USERS.member);
  const [isSupabase,  setIsSupabase]    = useState(false);
  const [viewMode,    setViewModeState] = useState<ViewMode>("operator");

  useEffect(() => {
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
      return;
    }

    const supabase = createClient();

    // Initial session check
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const profile = await getMyProfile();
        if (profile) {
          setUser(profileToMockUser(profile));
          setIsSupabase(true);
          return;
        }
      }
      // No Supabase session — fall back to demo/local accounts
      const demo = loadDemoUser();
      if (demo) setUser(demo);
    });

    // Listen for auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session) {
          const profile = await getMyProfile();
          if (profile) {
            setUser(profileToMockUser(profile));
            setIsSupabase(true);
            return;
          }
        }
        // Session ended — check for demo fallback
        setIsSupabase(false);
        const demo = loadDemoUser();
        setUser(demo ?? DEMO_USERS.member);
      }
    );

    return () => { subscription.unsubscribe(); };
  }, []);

  function setRole(role: Role) {
    if (isSupabase) return; // don't allow role switching on real accounts
    const match = Object.values(DEMO_USERS).find((u) => u.role === role) ?? { ...user, role };
    setUser(match);
    try { localStorage.setItem(LS_KEY, role); } catch { /* ignore */ }
  }

  function switchUser(demoKey: keyof typeof DEMO_USERS) {
    if (isSupabase) return; // don't allow demo switching on real accounts
    const next = DEMO_USERS[demoKey];
    if (!next) return;
    const savedPlan = (() => {
      try { return localStorage.getItem(PLAN_KEY(next.id)) as Plan | null; } catch { return null; }
    })();
    setUser(savedPlan ? { ...next, plan: savedPlan } : next);
    try { localStorage.setItem(LS_KEY, demoKey); } catch { /* ignore */ }
  }

  async function logout() {
    // Reset context state immediately so no component sees stale master state.
    setUser(DEMO_USERS.member);
    setIsSupabase(false);
    setViewModeState("operator");

    // Sign out from Supabase if we have a real session
    if (isSupabase && process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const supabase = createClient();
      await supabase.auth.signOut();
    }

    try {
      localStorage.removeItem(LS_KEY);
      localStorage.removeItem(SS_KEY);
      sessionStorage.removeItem(SS_KEY);
      sessionStorage.removeItem(LS_KEY);
      localStorage.removeItem(VIEW_MODE_KEY);
      sessionStorage.removeItem(VIEW_MODE_KEY);
      clearBiometric();
    } catch { /* ignore */ }

    window.location.href = "/login";
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
    <UserContext.Provider value={{ user, isSupabase, setRole, switchUser, logout, viewMode, setViewMode, updatePlan }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
}
