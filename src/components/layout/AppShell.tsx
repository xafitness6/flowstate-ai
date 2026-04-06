"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";
import { getSessionKey, resolvePostLoginRoute } from "@/lib/routing";

/**
 * AppShell wraps every route inside (app)/layout.tsx.
 * Enforces auth and deterministic onboarding routing.
 * Renders a blank dark screen while checking to prevent flicker.
 *
 * Routing logic lives entirely in resolvePostLoginRoute() — never add
 * route decisions here directly.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const router  = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const sessionKey = getSessionKey();

      // No session → role selection
      if (!sessionKey) {
        router.replace("/welcome");
        return;
      }

      // Master never has personal onboarding — always allowed through
      if (sessionKey === "master") {
        setReady(true);
        return;
      }

      // All other roles: check onboarding chain via single resolver
      const next = resolvePostLoginRoute(sessionKey);
      if (next !== "/dashboard") {
        // Still has an incomplete onboarding step — redirect there
        router.replace(next);
        return;
      }

      // Fully onboarded
      setReady(true);
    } catch {
      router.replace("/welcome");
    }
  }, [router]);

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
