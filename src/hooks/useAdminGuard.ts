"use client";

import { useEffect } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser }   from "@/context/UserContext";

const ADMIN_EMAIL = "xavellis4@gmail.com";

/**
 * Protects admin-only pages.
 *
 * Waits for UserContext to resolve the real user identity (isLoading),
 * then verifies role === "master" or isAdmin directly from context.
 * This eliminates the old localStorage-only check, which could be stale
 * or out-of-sync with the actual Supabase profile.
 *
 * Returns true once the role is confirmed as master/admin.
 * Redirects to /login for any other role (or while loading, holds).
 */
export function useAdminGuard(): boolean {
  const router = useRouter();
  const { user, isLoading } = useUser();
  const [sessionAdmin, setSessionAdmin] = useState(false);

  const isAdmin = !isLoading && (user.role === "master" || !!user.isAdmin || sessionAdmin);

  useEffect(() => {
    if (isLoading) return; // wait — don't redirect until role is resolved

    if (isAdmin) return;

    async function verifySessionAdmin() {
      try {
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
          router.replace("/login");
          return;
        }

        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { data: { user: sessionUser } } = await supabase.auth.getUser();
        if (sessionUser?.email?.trim().toLowerCase() === ADMIN_EMAIL) {
          setSessionAdmin(true);
          return;
        }
      } catch { /* fall through to login */ }

      router.replace("/login");
    }

    void verifySessionAdmin();
  }, [isLoading, isAdmin, router]);

  return isAdmin;
}
