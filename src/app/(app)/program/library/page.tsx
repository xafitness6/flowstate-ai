// Server Component — fetches the user's program library on the server so the
// page renders with data already in place (no client spinner on first paint).
// For unauthenticated / demo users, passes initialPrograms=null and the
// client falls back to its localStorage-based path.

import { createClient } from "@/lib/supabase/server";
import type { Program } from "@/lib/supabase/types";
import LibraryClient from "./LibraryClient";

export const dynamic = "force-dynamic";

export default async function ProgramLibraryPage() {
  const supabase = await createClient();

  let initial: Program[] | null = null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) {
      const { data, error } = await supabase
        .from("programs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (!error) initial = (data ?? []) as Program[];
    }
  } catch (e) {
    console.warn("[program/library SSR] fetch failed:", e);
  }

  return <LibraryClient initialPrograms={initial} />;
}
