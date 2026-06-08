"use client";

// "Finish your profile" prompt — walks the user through every onboarding
// question they never answered (newly-added fields), so they don't redo the
// whole flow. Driven by the shared backfill registry + /api/me/missing-intake;
// each answer merges into their onboarding answers (localStorage + Supabase
// raw_answers via /api/me/intake). A matching nudge notification points here.

import { useState, useEffect } from "react";
import { Sparkles, Loader2, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/context/UserContext";
import { loadIntake, saveIntake } from "@/lib/data/intake";
import type { BackfillQuestion } from "@/lib/intake/backfill";

export function IntakeQuestionPrompt() {
  const { user } = useUser();
  const [questions, setQuestions] = useState<BackfillQuestion[]>([]);
  const [idx, setIdx]       = useState(0);
  const [multi, setMulti]   = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    fetch("/api/me/missing-intake", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => { if (active && Array.isArray(j?.questions)) setQuestions(j.questions); })
      .catch(() => {});
    return () => { active = false; };
  }, [user?.id]);

  const current = questions[idx];

  async function persist(key: string, value: unknown) {
    if (saving || !user?.id) return;
    setSaving(true);
    try {
      await fetch("/api/me/intake", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      }).catch(() => {});
      const intake = loadIntake(user.id);
      if (intake) saveIntake(user.id, { ...intake, [key]: value } as typeof intake);
      setMulti([]);
      setIdx((i) => i + 1);
    } finally {
      setSaving(false);
    }
  }

  if (dismissed || !current) return null;

  const remaining = questions.length - idx;

  return (
    <div className="rounded-2xl border border-[#B48B40]/25 bg-[#B48B40]/[0.05] p-4 mb-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-white/90 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#B48B40]" strokeWidth={1.8} /> Finish your profile
          <span className="text-[11px] font-normal text-white/35">· {remaining} left</span>
        </p>
        <button onClick={() => setDismissed(true)} className="text-white/30 hover:text-white/70 shrink-0" aria-label="Dismiss">
          <X className="w-4 h-4" strokeWidth={2} />
        </button>
      </div>
      <p className="text-sm text-white/60 mt-1.5 mb-3">{current.question}</p>

      {current.type === "single" ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {current.options.map((o) => (
            <button
              key={o.value}
              onClick={() => persist(current.key, o.value)}
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
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            {current.options.map((o) => {
              const on = multi.includes(o.value);
              return (
                <button
                  key={o.value}
                  onClick={() => setMulti((p) => on ? p.filter((v) => v !== o.value) : [...p, o.value])}
                  disabled={saving}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-sm font-medium transition-all text-left disabled:opacity-50",
                    on ? "border-[#B48B40]/50 bg-[#B48B40]/12 text-[#B48B40]" : "border-white/10 bg-white/[0.03] text-white/75 hover:border-white/20",
                  )}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => persist(current.key, multi)}
            disabled={saving || multi.length === 0}
            className="mt-3 w-full py-2.5 rounded-xl bg-[#B48B40] text-black text-sm font-semibold hover:bg-[#c99840] disabled:opacity-40 inline-flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" strokeWidth={2.5} />}
            Save{multi.length ? ` (${multi.length})` : ""}
          </button>
        </>
      )}
    </div>
  );
}
