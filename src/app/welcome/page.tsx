"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Welcome page is retired — invite-only app, no marketing detour.
// Any legacy redirect or bookmark here forwards straight to /login.
export default function WelcomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/login");
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-5 text-white">
      <div className="text-center space-y-2">
        <div className="mx-auto h-6 w-6 rounded-full border border-[#B48B40]/25 border-t-[#B48B40] animate-spin" />
        <p className="text-sm text-white/55">Opening Flowstate...</p>
      </div>
    </div>
  );
}
