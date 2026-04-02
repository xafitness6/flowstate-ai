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
      const role = localStorage.getItem(LS_KEY) || sessionStorage.getItem(SS_KEY);
      if (role === "master") {
        setReady(true);
      } else {
        router.replace("/");
      }
    } catch {
      router.replace("/");
    }
  }, [router]);

  return ready;
}
