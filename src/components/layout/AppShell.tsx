"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";
import { loadOnboardingState } from "@/lib/onboarding";

const AUTH_KEY = "flowstate-active-role";
const SS_KEY   = "flowstate-session-role";

const ROLE_TO_USER_ID: Record<string, string> = {
  master: "usr_001", trainer: "u4", client: "u1", member: "u6",
};

/**
 * AppShell wraps every route inside (app)/layout.tsx.
 * Enforces auth and deterministic onboarding routing.
 * Renders a blank dark screen while checking to prevent flicker.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const router  = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      // Prefer sessionStorage (current session) over localStorage (remember-me)
      const sessionKey = sessionStorage.getItem(SS_KEY) || localStorage.getItem(AUTH_KEY);

      // 1. No session → role selection
      if (!sessionKey) {
        router.replace("/welcome");
        return;
      }

      // 2. Master (platform admin) — no personal onboarding, always allowed through
      if (sessionKey === "master") {
        setReady(true);
        return;
      }

      // 3. Resolve user ID: demo roles use fixed map, dynamic accounts use key as userId
      const userId = ROLE_TO_USER_ID[sessionKey] ?? sessionKey;

      // 4. Deterministic onboarding routing — no loops
      const s = loadOnboardingState(userId);
      if (!s.starterComplete)    { router.replace("/onboarding/quick-start");   return; }
      if (!s.onboardingComplete) { router.replace("/onboarding/calibration");   return; }
      if (!s.tutorialComplete)   { router.replace("/onboarding/tutorial");      return; }
      if (!s.profileComplete)    { router.replace("/onboarding/profile-setup"); return; }

      // 5. Fully onboarded — render the app shell
      setReady(true);
    } catch {
      router.replace("/welcome");
    }
  }, [router]);

  // Blank dark screen while the auth/onboarding check runs — prevents flash
  if (!ready) {
    return <div className="min-h-screen bg-[#0A0A0A]" />;
  }

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
