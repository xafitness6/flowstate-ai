"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { loadOnboardingState } from "@/lib/onboarding";

const LS_KEY = "flowstate-active-role";
const SS_KEY = "flowstate-session-role";

const ROLE_TO_USER_ID: Record<string, string> = {
  master: "usr_001", trainer: "u4", client: "u1", member: "u6",
};

// Root entry point — deterministic routing based on session + onboarding state.
export default function Root() {
  const router = useRouter();

  useEffect(() => {
    try {
      const sessionKey = sessionStorage.getItem(SS_KEY) || localStorage.getItem(LS_KEY);

      // No session → role selection (public entry point)
      if (!sessionKey) {
        router.replace("/welcome");
        return;
      }

      // Master (platform admin) → admin dashboard
      if (sessionKey === "master") {
        router.replace("/admin");
        return;
      }

      // Normal user → deterministic onboarding check
      const userId = ROLE_TO_USER_ID[sessionKey] ?? sessionKey;
      const s = loadOnboardingState(userId);

      if (!s.starterComplete)    { router.replace("/onboarding/quick-start");   return; }
      if (!s.onboardingComplete) { router.replace("/onboarding/calibration");   return; }
      if (!s.tutorialComplete)   { router.replace("/onboarding/tutorial");      return; }
      if (!s.profileComplete)    { router.replace("/onboarding/profile-setup"); return; }

      router.replace("/dashboard");
    } catch {
      router.replace("/welcome");
    }
  }, [router]);

  return <div className="min-h-screen bg-[#0A0A0A]" />;
}
