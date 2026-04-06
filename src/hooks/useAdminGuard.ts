"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const LS_KEY = "flowstate-active-role";
const SS_KEY = "flowstate-session-role";

/**
 * Protects admin-only pages.
 * Returns true once the role is confirmed as "master".
 * Redirects to "/" for any other role (or no session).
 */
export function useAdminGuard(): boolean {
  const router  = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      // Prefer sessionStorage (current session) over localStorage (remember-me).
      // Must match the priority order in loadUser() and AppShell.
      const role = sessionStorage.getItem(SS_KEY) || localStorage.getItem(LS_KEY);
      if (role === "master") {
        setReady(true);
      } else {
        router.replace("/welcome");
      }
    } catch {
      router.replace("/welcome");
    }
  }, [router]);

  return ready;
}
