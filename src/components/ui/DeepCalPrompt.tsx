"use client";

// ─── Get Smarter Coaching (Deep Calibration) prompt ───────────────────────────
// The top-of-screen hero shown until Deep Calibration is done. It explains WHY
// it matters and HOW the AI coach will use the answers, then sends them in.
// Dismissible per session (sessionStorage) — re-appears next login. Never
// touches user data; purely a navigation nudge.

import { useState, useEffect } from "react";
import Link from "next/link";
import { X, Zap, Dumbbell, Apple, HeartPulse, TrendingUp, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { loadOnboardingState } from "@/lib/onboarding";

const DISMISS_KEY = "flowstate-deep-cal-prompt-dismissed";

const WHY: { icon: typeof Dumbbell; text: string }[] = [
  { icon: Dumbbell,   text: "Builds your training around your real history, equipment, and any injuries — not a generic template." },
  { icon: Apple,      text: "Sets calories and macros to your actual numbers and goal, then adjusts them as your weight trends." },
  { icon: HeartPulse, text: "Reads your recovery, sleep, and daily energy to push hard on good days and pull back before you burn out." },
  { icon: TrendingUp, text: "Learns what's worked (and what hasn't) for you, so every week's plan gets sharper than the last." },
];

export function DeepCalPrompt({ userId }: { userId: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "true") return;
      const state = loadOnboardingState(userId);
      // Show only when quick start is done but deep calibration is not
      if (state.hasCompletedQuickStart && !state.hasCompletedDeepCal) setVisible(true);
    } catch { /* ignore */ }
  }, [userId]);

  function dismiss() {
    setVisible(false);
    try { sessionStorage.setItem(DISMISS_KEY, "true"); } catch { /* ignore */ }
  }

  if (!visible) return null;

  return (
    <div className={cn(
      "relative rounded-2xl border border-[#B48B40]/40 overflow-hidden",
      "bg-gradient-to-br from-[#B48B40]/[0.14] via-[#B48B40]/[0.06] to-[#B48B40]/[0.03]",
    )}>
      <button
        onClick={dismiss}
        className="absolute top-3 right-3 text-white/30 hover:text-white/70 transition-colors z-10"
        aria-label="Dismiss for now"
      >
        <X className="w-4 h-4" strokeWidth={1.8} />
      </button>

      <div className="px-5 py-5 sm:px-6 sm:py-6">
        {/* Heading */}
        <div className="flex items-center gap-3 mb-3 pr-7">
          <div className="w-10 h-10 rounded-xl bg-[#B48B40]/20 border border-[#B48B40]/35 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5 text-[#B48B40]" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#B48B40]/70 mb-0.5">Recommended next step</p>
            <h2 className="text-lg sm:text-xl font-semibold text-white/95 leading-tight">Get smarter coaching</h2>
          </div>
        </div>

        {/* Here's why */}
        <p className="text-sm text-white/65 leading-relaxed mb-3">
          <span className="text-white/90 font-medium">Here&apos;s why:</span> right now your coach is working off the basics. Spend
          ~15 minutes on deep calibration and it can actually coach you — here&apos;s how it uses what you tell it:
        </p>

        <ul className="space-y-2 mb-5">
          {WHY.map(({ icon: Icon, text }, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <Icon className="w-4 h-4 text-[#B48B40] mt-0.5 shrink-0" strokeWidth={1.8} />
              <span className="text-[13px] text-white/60 leading-relaxed">{text}</span>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-4 flex-wrap">
          <Link
            href="/onboarding/deep-calibration"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#B48B40] text-black px-5 py-2.5 text-sm font-semibold hover:bg-[#c99840] transition-colors"
          >
            Continue onboarding <ArrowRight className="w-4 h-4" strokeWidth={2} />
          </Link>
          <span className="text-[11px] text-white/35">About 15 minutes · do it once</span>
        </div>
      </div>
    </div>
  );
}
