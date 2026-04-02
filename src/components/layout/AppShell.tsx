"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";

const AUTH_KEY      = "flowstate-active-role";
const SS_KEY        = "flowstate-session-role";
const ONBOARDED_KEY = "flowstate-onboarded";

// AppShell is only mounted inside (app)/layout.tsx.
// Enforces auth and onboarding on every app route.
export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    try {
      const role = localStorage.getItem(AUTH_KEY) || sessionStorage.getItem(SS_KEY);
      if (!role) {
        router.replace("/login");
        return;
      }
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
