"use client";

// "Quick question" prompt — backfills an intake field that was added after the
// user already onboarded, so they don't have to redo the whole flow. Appears on
// the profile page only when the answer is missing; saving merges into their
// onboarding answers (localStorage + Supabase raw_answers via /api/me/intake).

import { useState, useEffect } from "react";
import { Sparkles, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/context/UserContext";
import { loadIntake, loadIntakeAsync, saveIntake } from "@/lib/data/intake";

const ENERGY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "steady", label: "Steady" },
  { value: "high", label: "High" },
  { value: "variable", label: "Up and down" },
] as const;

export function IntakeQuestionPrompt() {
  const { user } = useUser();
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    // Only prompt people who've already onboarded (intake exists) but are
    // missing the newer field.
    loadIntakeAsync(user.id).then((intake) => {
      if (active && intake && !(intake as { energyLevel?: string }).energyLevel) setShow(true);
    }).catch(() => {});
    return () => { active = false; };
  }, [user?.id]);

  async function answer(value: typeof ENERGY_OPTIONS[number]["value"]) {
    if (saving || !user?.id) return;
    setSaving(true);
    try {
      await fetch("/api/me/intake", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ energyLevel: value }),
      }).catch(() => {});
      const intake = loadIntake(user.id);
      if (intake) saveIntake(user.id, { ...intake, energyLevel: value });
      setShow(false);
    } finally {
      setSaving(false);
    }
  }

  if (!show) return null;

  return (
    <div className="rounded-2xl border border-[#B48B40]/25 bg-[#B48B40]/[0.05] p-4 mb-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-white/90 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#B48B40]" strokeWidth={1.8} /> Quick question
        </p>
        <button onClick={() => setShow(false)} className="text-white/30 hover:text-white/70 shrink-0" aria-label="Dismiss">
          <X className="w-4 h-4" strokeWidth={2} />
        </button>
      </div>
      <p className="text-sm text-white/60 mt-1.5 mb-3">How are your daily energy levels lately?</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {ENERGY_OPTIONS.map((o) => (
          <button
            key={o.value}
            onClick={() => answer(o.value)}
            disabled={saving}
            className={cn(
              "rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm font-medium text-white/80",
              "hover:border-[#B48B40]/40 hover:text-[#B48B40] disabled:opacity-50 transition-all",
            )}
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
