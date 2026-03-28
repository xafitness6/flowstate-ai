"use client";

import { createContext, useContext, useState, useEffect } from "react";
import type { MockUser, Role } from "@/types";

// ─── Demo users ───────────────────────────────────────────────────────────────

export const DEMO_USERS: Record<string, MockUser> = {
  master: {
    id:        "usr_001",
    name:      "Xavier Ellis",
    role:      "master",
    status:    "active",
    pushLevel: 6,
  },
  trainer: {
    id:        "u4",
    name:      "Jordan Lee",
    role:      "trainer",
    status:    "active",
    pushLevel: 7,
  },
  client: {
    id:        "u1",
    name:      "Kai Nakamura",
    role:      "client",
    status:    "active",
    pushLevel: 5,
  },
  member: {
    id:        "u6",
    name:      "Luca Ferretti",
    role:      "member",
    status:    "active",
    pushLevel: 4,
  },
};

const LS_KEY = "flowstate-active-role";

function loadUser(): MockUser {
  if (typeof window === "undefined") return DEMO_USERS.master;
  try {
    const saved = localStorage.getItem(LS_KEY) as keyof typeof DEMO_USERS | null;
    if (saved && DEMO_USERS[saved]) return DEMO_USERS[saved];
  } catch { /* ignore */ }
  return DEMO_USERS.master;
}

// ─── Context ──────────────────────────────────────────────────────────────────

type UserContextValue = {
  user:       MockUser;
  setRole:    (role: Role) => void;
  switchUser: (demoKey: keyof typeof DEMO_USERS) => void;
};

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  // Start with master for SSR, hydrate from localStorage after mount
  const [user, setUser] = useState<MockUser>(DEMO_USERS.master);

  useEffect(() => {
    setUser(loadUser());
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

  return (
    <UserContext.Provider value={{ user, setRole, switchUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
}
