"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// File: src/app/page.tsx
// Controls: the live root URL "/"
// This is the only file that determines where the app entry point lands.
// No dev UI, no seed controls, no showcase content renders here.

const LS_KEY        = "flowstate-active-role";
const SS_KEY        = "flowstate-session-role";
const ONBOARDED_KEY = "flowstate-onboarded";

export default function Root() {
  const router = useRouter();

  useEffect(() => {
    try {
      const role = localStorage.getItem(LS_KEY) || sessionStorage.getItem(SS_KEY);

      // 1. No session → login
      if (!role) {
        router.replace("/login");
        return;
      }

      // 2. Admin or trainer → admin dashboard
      if (role === "master" || role === "trainer") {
        router.replace("/admin");
        return;
      }

      // 3. Normal user → onboarding check
      const onboarded = localStorage.getItem(ONBOARDED_KEY) === "true";
      router.replace(onboarded ? "/dashboard" : "/onboarding");
    } catch {
      // Storage unavailable (private browsing, etc.) → login
      router.replace("/login");
    }
  }, [router]);

  return null;
}
