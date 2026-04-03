"use client";

import { createContext, useContext, useState, useEffect } from "react";
import type { MockUser, Plan, Role } from "@/types";
import { clearBiometric } from "@/lib/biometric";

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

function loadUser(): MockUser {
  // Safe fallback: never grant master privileges to an unauthenticated state.
  const SAFE_DEFAULT = DEMO_USERS.member;
  if (typeof window === "undefined") return SAFE_DEFAULT;
  try {
    // Prefer sessionStorage (current session) over localStorage (remember-me).
    // This order must match useAdminGuard and AppShell.
    const ss = sessionStorage.getItem(SS_KEY) as keyof typeof DEMO_USERS | null;
    const ls = localStorage.getItem(LS_KEY) as keyof typeof DEMO_USERS | null;
    const key = (ss && DEMO_USERS[ss]) ? ss : (ls && DEMO_USERS[ls]) ? ls : null;
    if (!key) return SAFE_DEFAULT;
    const base = DEMO_USERS[key];
    // Restore persisted plan override (set after Stripe checkout)
    const savedPlan = localStorage.getItem(PLAN_KEY(base.id)) as Plan | null;
    return savedPlan ? { ...base, plan: savedPlan } : base;
  } catch { /* ignore */ }
  return SAFE_DEFAULT;
}

type UserContextValue = {
  user:       MockUser;
  setRole:    (role: Role) => void;
  switchUser: (demoKey: keyof typeof DEMO_USERS) => void;
  logout:     () => void;
  viewMode:   ViewMode;
  setViewMode:(m: ViewMode) => void;
  updatePlan: (plan: Plan) => void;
};

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user,     setUser]          = useState<MockUser>(DEMO_USERS.member);
  const [viewMode, setViewModeState] = useState<ViewMode>("operator");

  useEffect(() => {
    setUser(loadUser());
    try {
      const saved = localStorage.getItem(VIEW_MODE_KEY) as ViewMode | null;
      if (saved === "personal" || saved === "operator") setViewModeState(saved);
    } catch { /* ignore */ }
  }, []);

  function setRole(role: Role) {
    const match = Object.values(DEMO_USERS).find((u) => u.role === role) ?? { ...user, role };
    setUser(match);
    try { localStorage.setItem(LS_KEY, role); } catch { /* ignore */ }
  }

  function switchUser(demoKey: keyof typeof DEMO_USERS) {
    const next = DEMO_USERS[demoKey];
    if (!next) return;
    const savedPlan = (() => {
      try { return localStorage.getItem(PLAN_KEY(next.id)) as Plan | null; } catch { return null; }
    })();
    setUser(savedPlan ? { ...next, plan: savedPlan } : next);
    try { localStorage.setItem(LS_KEY, demoKey); } catch { /* ignore */ }
  }

  function logout() {
    // Reset context state immediately so no component sees stale master state.
    setUser(DEMO_USERS.member);
    setViewModeState("operator");
    try {
      // Clear both keys from both storages — belt-and-suspenders.
      // Prevents stale master state if the role was ever written to the wrong store.
      localStorage.removeItem(LS_KEY);
      localStorage.removeItem(SS_KEY);
      sessionStorage.removeItem(SS_KEY);
      sessionStorage.removeItem(LS_KEY);
      localStorage.removeItem(VIEW_MODE_KEY);
      sessionStorage.removeItem(VIEW_MODE_KEY);
      // Clear biometric credentials so a prior admin session's biometric
      // cannot silently re-authenticate the next user as master.
      clearBiometric();
    } catch { /* ignore */ }
    window.location.href = "/login";
  }

  function setViewMode(m: ViewMode) {
    setViewModeState(m);
    try { localStorage.setItem(VIEW_MODE_KEY, m); } catch { /* ignore */ }
  }

  function updatePlan(plan: Plan) {
    // Persist plan — survives page reload. NEVER deletes user data.
    setUser((prev) => ({ ...prev, plan }));
    try { localStorage.setItem(PLAN_KEY(user.id), plan); } catch { /* ignore */ }
  }

  return (
    <UserContext.Provider value={{ user, setRole, switchUser, logout, viewMode, setViewMode, updatePlan }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
}
