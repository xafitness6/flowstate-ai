"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";

const AUTH_KEY      = "flowstate-active-role";
const SS_KEY        = "flowstate-session-role";
const ONBOARDED_KEY = "flowstate-onboarded";

// Maps demo role keys to their user IDs (mirrors ROLE_TO_USER_ID in login page)
const ROLE_TO_USER_ID: Record<string, string> = {
  master: "usr_001", trainer: "u4", client: "u1", member: "u6",
};

// AppShell is only mounted inside (app)/layout.tsx.
// Enforces auth and onboarding on every app route.
export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    try {
      // Prefer sessionStorage (current session) over localStorage (remember-me).
      // Must match the priority order in loadUser() and useAdminGuard.
      const role = sessionStorage.getItem(SS_KEY) || localStorage.getItem(AUTH_KEY);
      if (!role) {
        router.replace("/login");
        return;
      }
      // Master is a platform admin — no personal onboarding required
      if (role === "master") return;

      // Check new per-user onboarding state first
      const userId = ROLE_TO_USER_ID[role] ?? role;
      const newStateRaw = localStorage.getItem(`flowstate-onboarding-${userId}`);
      if (newStateRaw) {
        try {
          const state = JSON.parse(newStateRaw) as { hasCompletedQuickStart?: boolean };
          if (!state.hasCompletedQuickStart) router.replace("/onboarding");
        } catch { /* ignore */ }
        return;
      }
      // Legacy fallback for existing users
      const isOnboarded = localStorage.getItem(ONBOARDED_KEY) === "true";
      if (!isOnboarded) {
        router.replace("/onboarding");
      }
    } catch { /* ignore */ }
  }, [router]);

  return (
    <div className="flex min-h-screen bg-[#0A0A0A]">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <TopBar />
        <main className="flex-1 pb-24 md:pb-6 min-w-0">
          {children}
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
