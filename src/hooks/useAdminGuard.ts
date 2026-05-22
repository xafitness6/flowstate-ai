"use client";

import { useEffect } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser }   from "@/context/UserContext";

function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    Promise.resolve(promise).then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

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
  const [serverChecked, setServerChecked] = useState(false);
  const [serverAdmin, setServerAdmin] = useState(false);

  const isAdmin = !isLoading && (user.role === "master" || !!user.isAdmin || serverAdmin);

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
        const { data: { user: sessionUser } } = await withTimeout(
          supabase.auth.getUser(),
          4_000,
          "admin user check",
        );
        if (!sessionUser) {
          router.replace("/login");
          return;
        }

        const { data: profile } = await withTimeout(
          supabase
            .from("profiles")
            .select("role,is_admin")
            .eq("id", sessionUser.id)
            .maybeSingle(),
          4_000,
          "admin profile check",
        );

        if (profile?.role === "master" || profile?.is_admin) {
          setServerAdmin(true);
          return;
        }
      } catch { /* fall through to login */ }

      setServerChecked(true);
    }

    void verifySessionAdmin();
  }, [isLoading, isAdmin, router]);

  useEffect(() => {
    if (!isLoading && serverChecked && !isAdmin) router.replace("/login");
  }, [isLoading, serverChecked, isAdmin, router]);

  return isAdmin;
}
