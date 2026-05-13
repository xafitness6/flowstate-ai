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
      "rounded-2xl border border-[#B48B40]/25 bg-[#B48B40]/[0.06] px-4 py-3",
      "flex items-center gap-3"
    )}>
      <Zap className="w-4 h-4 text-[#B48B40] shrink-0" strokeWidth={1.5} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-white/75">
          Complete your profile for stronger coaching
        </p>
        <p className="text-[11px] text-white/35 mt-0.5">
          Deep calibration gives your AI coach the data it needs to dial in your program and nutrition.
        </p>
      </div>
      <Link
        href="/onboarding/deep-calibration"
        className="text-xs font-semibold text-[#B48B40] hover:text-[#c99840] transition-colors shrink-0"
      >
        Continue →
      </Link>
      <button
        onClick={dismiss}
        className="text-white/22 hover:text-white/50 transition-colors shrink-0 ml-1"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" strokeWidth={1.5} />
      </button>
    </div>
  );
}
