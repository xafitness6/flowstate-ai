"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSessionKey, resolvePostLoginRoute } from "@/lib/routing";

// /onboarding smart router — sends the user to their next incomplete step.
// All routing logic lives in resolvePostLoginRoute().
export default function OnboardingRouter() {
  const router = useRouter();

  useEffect(() => {
    try {
      const key = getSessionKey();
      if (!key) { router.replace("/welcome"); return; }
      const next = resolvePostLoginRoute(key);
      router.replace(next);
    } catch {
      router.replace("/welcome");
    }
  }, [router]);

  return <div className="min-h-screen bg-[#0A0A0A]" />;
}
