"use client";

// Read-only view of YOUR own onboarding answers (the same intake a coach sees
// on a client's file). Lets a member/admin confirm what they entered. Collapsed
// by default. Reads onboarding_state.raw_answers via RLS (own row).

import { useState, useEffect } from "react";
import { ChevronDown, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/context/UserContext";
import { getOnboardingState } from "@/lib/db/onboarding";
import { IntakeReadout } from "@/components/intake/IntakeReadout";
import type { RawIntake } from "@/lib/intake/format";

export function YourOnboarding() {
  const { user } = useUser();
  const [intake, setIntake] = useState<RawIntake | null>(null);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const isRealUser = !!user?.id && /^[0-9a-f-]{36}$/i.test(user.id) && !!process.env.NEXT_PUBLIC_SUPABASE_URL;

  useEffect(() => {
    if (!isRealUser) { setLoaded(true); return; }
    let active = true;
    getOnboardingState(user.id)
      .then((s) => { if (active) setIntake((s?.raw_answers as RawIntake) ?? null); })
      .catch(() => {})
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [user?.id, isRealUser]);

  if (!loaded || !intake || Object.keys(intake).length === 0) return null;

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between px-5 py-4">
        <span className="text-sm font-semibold text-white/85 flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-[#B48B40]" strokeWidth={1.8} /> Your onboarding answers
        </span>
        <ChevronDown className={cn("w-4 h-4 text-white/35 transition-transform", open && "rotate-180")} strokeWidth={1.8} />
      </button>
      {open && <div className="px-5 pb-5"><IntakeReadout intake={intake} /></div>}
    </div>
  );
}
