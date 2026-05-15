// Server Component — fetches active program, this-week logs, and recent logs
// in parallel on the server. Falls through to the client-only path (initial=null)
// for unauthenticated / demo users.

import { createClient } from "@/lib/supabase/server";
import { v2ToActiveProgram } from "@/lib/workout";
import { isLegacyDays, isProgramSplitV2, legacyToV2 } from "@/lib/program/types";
import type { Program as DBProgram } from "@/lib/supabase/types";
import ProgramClient, { type ProgramSSRData } from "./ProgramClient";

export const dynamic = "force-dynamic";

export default async function ProgramPage() {
  const supabase = await createClient();

  let initial: ProgramSSRData = null;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      return <ProgramClient initial={null} />;
    }

    const progRes = await supabase
      .from("programs")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const dbProgram = (progRes.data as DBProgram | null) ?? null;

    const program = dbProgram && isProgramSplitV2(dbProgram.weekly_split)
      ? v2ToActiveProgram(dbProgram, dbProgram.weekly_split)
      : dbProgram && isLegacyDays(dbProgram.weekly_split)
        ? v2ToActiveProgram(
            dbProgram,
            legacyToV2(dbProgram.weekly_split, dbProgram.goal, dbProgram.duration_weeks),
          )
        : null;

    initial = {
      program,
      weekLogs:   [],
      recentLogs: [],
    };
  } catch (e) {
    console.warn("[program SSR] fetch failed:", e);
    initial = null;
  }

  return <ProgramClient initial={initial} />;
}
