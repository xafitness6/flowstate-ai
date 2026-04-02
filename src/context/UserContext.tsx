"use client";

import { createContext, useContext, useState, useEffect } from "react";
import type { MockUser, Role } from "@/types";

// ─── Demo users ───────────────────────────────────────────────────────────────

export const DEMO_USERS: Record<string, MockUser> = {
  master: {
    id:               "usr_001",
    name:             "Xavier Ellis",
    role:             "master",
    status:           "active",
    pushLevel:        6,
    defaultDashboard: "overview",
    plan:             "elite",
  },
  trainer: {
    id:               "u4",
    name:             "Alex Rivera",
    role:             "trainer",
    status:           "active",
    pushLevel:        7,
    defaultDashboard: "program",
    plan:             "pro",
  },
  client: {
    id:               "u1",
    name:             "Kai Nakamura",
    role:             "client",
    status:           "active",
    pushLevel:        5,
    defaultDashboard: "program",
    plan:             "pro",
  },
  member: {
    id:               "u6",
    name:             "Luca Ferretti",
    role:             "member",
    status:           "active",
    pushLevel:        4,
    defaultDashboard: "accountability",
    plan:             "starter",
  },
};

const LS_KEY        = "flowstate-active-role";
const SS_KEY        = "flowstate-session-role";
const VIEW_MODE_KEY = "flowstate-view-mode";

export type ViewMode = "operator" | "personal";

function loadUser(): MockUser {
  if (typeof window === "undefined") return DEMO_USERS.master;
  try {
    const ss = sessionStorage.getItem(SS_KEY) as keyof typeof DEMO_USERS | null;
    if (ss && DEMO_USERS[ss]) return DEMO_USERS[ss];
    const ls = localStorage.getItem(LS_KEY) as keyof typeof DEMO_USERS | null;
    if (ls && DEMO_USERS[ls]) return DEMO_USERS[ls];
  } catch { /* ignore */ }
  return DEMO_USERS.master;
}

// ─── Context ──────────────────────────────────────────────────────────────────

type UserContextValue = {
  user:        MockUser;
  setRole:     (role: Role) => void;
  switchUser:  (demoKey: keyof typeof DEMO_USERS) => void;
  logout:      () => void;
  viewMode:    ViewMode;
  setViewMode: (m: ViewMode) => void;
};

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<MockUser>(DEMO_USERS.master);
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
    setUser(next);
    try { localStorage.setItem(LS_KEY, demoKey); } catch { /* ignore */ }
  }

  function logout() {
    try {
      localStorage.removeItem(LS_KEY);
      sessionStorage.removeItem(SS_KEY);
      localStorage.removeItem(VIEW_MODE_KEY);
    } catch { /* ignore */ }
    window.location.href = "/login";
  }

  function setViewMode(m: ViewMode) {
    setViewModeState(m);
    try { localStorage.setItem(VIEW_MODE_KEY, m); } catch { /* ignore */ }
  }

  return (
    <UserContext.Provider value={{ user, setRole, switchUser, logout, viewMode, setViewMode }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
}
