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

  return <div className="min-h-screen bg-[#0A0A0A]" />;
}
