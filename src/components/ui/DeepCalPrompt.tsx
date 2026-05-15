"use client";

// ─── Deep Calibration Prompt ──────────────────────────────────────────────────
// Shown in the dashboard after Quick Start when Deep Calibration is incomplete.
// Dismissible per session — uses sessionStorage so it re-appears on next login.
// NEVER removes user data — purely a navigation nudge.

import { useState, useEffect } from "react";
import Link from "next/link";
import { X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { loadOnboardingState } from "@/lib/onboarding";

const DISMISS_KEY = "flowstate-deep-cal-prompt-dismissed";

export function DeepCalPrompt({ userId }: { userId: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const dismissed = sessionStorage.getItem(DISMISS_KEY) === "true";
      if (dismissed) return;
      const state = loadOnboardingState(userId);
      // Show only when quick start is done but deep calibration is not
      if (state.hasCompletedQuickStart && !state.hasCompletedDeepCal) {
        setVisible(true);
      }
    } catch { /* ignore */ }
  }, [userId]);

  function dismiss() {
    setVisible(false);
    try { sessionStorage.setItem(DISMISS_KEY, "true"); } catch { /* ignore */ }
  }

  if (!visible) return null;

  return (
    <div className={cn(
      "rounded-2xl border border-[#B48B40]/35 bg-gradient-to-br from-[#B48B40]/[0.10] to-[#B48B40]/[0.04]",
      "px-4 py-3.5 sm:px-5 sm:py-4 relative",
      "flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4",
    )}>
      <button
        onClick={dismiss}
        className="absolute top-2.5 right-2.5 text-white/22 hover:text-white/55 transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" strokeWidth={1.5} />
      </button>
      <div className="flex items-center gap-3 flex-1 min-w-0 pr-6 sm:pr-0">
        <div className="w-9 h-9 rounded-xl bg-[#B48B40]/15 border border-[#B48B40]/30 flex items-center justify-center shrink-0">
          <Zap className="w-4 h-4 text-[#B48B40]" strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-white/90 leading-tight">
            Get smarter coaching
          </p>
          <p className="text-[11px] text-white/45 mt-1 leading-relaxed">
            Spend ~15 minutes on deep calibration. Your AI coach gets your training history, real recovery data, and lifestyle context — and dials every workout and macro to you specifically.
          </p>
        </div>
      </div>
      <Link
        href="/onboarding/deep-calibration"
        className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#B48B40] text-black px-4 py-2 text-xs font-semibold hover:bg-[#c99840] transition-colors"
      >
        Start <span aria-hidden>→</span>
      </Link>
    </div>
  );
}
