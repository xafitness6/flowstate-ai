"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser }   from "@/context/UserContext";

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

  const isAdmin = !isLoading && (user.role === "master" || !!user.isAdmin);

  useEffect(() => {
    if (isLoading) return; // wait — don't redirect until role is resolved
    if (!isAdmin) {
      router.replace("/login");
    }
  }, [isLoading, isAdmin, router]);

  return isAdmin;
}
