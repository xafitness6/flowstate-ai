"use client";

// Self-serve "redo my onboarding" — wipes the signed-in user's own onboarding
// (server, scoped to their id) AND clears the local cache (the thing that can
// re-leak stale answers), then drops them into a fresh calibration. Account-safe.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Loader2 } from "lucide-react";

export function RedoOnboarding() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function redo() {
    if (busy) return;
    if (!confirm("Start your onboarding over? This clears your current answers, plan and targets and walks you through setup fresh. (Only affects your account.)")) return;
    setBusy(true);
    try {
      // 1. Clear local cache first — stale intake here can otherwise write back.
      try { Object.keys(localStorage).filter((k) => k.startsWith("flowstate")).forEach((k) => localStorage.removeItem(k)); } catch { /* ignore */ }
      // 2. Reset server-side (own account only).
      await fetch("/api/me/onboarding/reset", { method: "POST" }).catch(() => {});
      // 3. Into a fresh calibration.
      router.replace("/onboarding/calibration");
    } finally { setBusy(false); }
  }

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-5 py-4 flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-semibold text-white/85">Redo onboarding</p>
        <p className="text-[12px] text-white/40 mt-0.5">Start fresh and re-enter your stats and goals. Only touches your account.</p>
      </div>
      <button
        onClick={redo}
        disabled={busy}
        className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-[#B48B40]/35 bg-[#B48B40]/[0.08] px-3.5 py-2 text-xs font-semibold text-[#B48B40] hover:bg-[#B48B40]/[0.15] disabled:opacity-50 transition-all"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} /> : <RotateCcw className="w-3.5 h-3.5" strokeWidth={2} />}
        {busy ? "Resetting…" : "Redo onboarding"}
      </button>
    </div>
  );
}
