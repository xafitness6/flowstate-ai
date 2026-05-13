"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  LayoutDashboard,
  Dumbbell,
  Apple,
  Flame,
  Zap,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { markWalkthroughSeen } from "@/lib/onboarding";
import { getSessionKey, ROLE_TO_USER_ID } from "@/lib/routing";

// ─── Walkthrough screens ──────────────────────────────────────────────────────

const SCREENS = [
  {
    type:    "hero" as const,
    eyebrow: "Welcome to Flowstate",
    title:   "Your AI-powered fitness coaching system.",
    body:    "Built around how you actually train, eat, and recover — not a generic plan someone else followed.",
    accent:  "text-[#B48B40]",
  },
  {
    type:    "features" as const,
    eyebrow: "What's inside",
    title:   "Everything you need. Nothing you don't.",
    body:    "Five core areas, each connected to your goals and your data.",
    accent:  "text-blue-400",
    features: [
      { icon: LayoutDashboard, label: "Dashboard",       color: "text-blue-400",    bg: "bg-blue-400/10 border-blue-400/20" },
      { icon: Dumbbell,        label: "Program",         color: "text-[#B48B40]",   bg: "bg-[#B48B40]/10 border-[#B48B40]/20" },
      { icon: Apple,           label: "Nutrition",       color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/20" },
      { icon: Flame,           label: "Accountability",  color: "text-orange-400",  bg: "bg-orange-400/10 border-orange-400/20" },
      { icon: Zap,             label: "AI Coach",        color: "text-purple-400",  bg: "bg-purple-400/10 border-purple-400/20" },
    ],
  },
  {
    type:    "adapt" as const,
    eyebrow: "It adapts to you",
    title:   "Your coach learns as you train.",
    body:    "Flowstate tracks your recovery, energy, consistency, and progress — and adjusts your training recommendations in real time. The longer you use it, the smarter it gets.",
    accent:  "text-purple-400",
  },
  {
    type:    "setup" as const,
    eyebrow: "Setup takes 3 minutes",
    title:   "Six focused questions. No wrong answers.",
    body:    "We'll build your starter training, nutrition, and recovery targets from your answers. You can always refine it later.",
    accent:  "text-emerald-400",
    bullets: [
      "What's your primary goal?",
      "What's your experience level?",
      "How many days per week can you train?",
      "How do you usually eat?",
      "What should the AI watch for?",
      "What equipment do you have access to?",
    ],
  },
  {
    type:    "cta" as const,
    eyebrow: "You're ready",
    title:   "Let's get you set up.",
    body:    "Your calibration takes 3 minutes and unlocks your personalised training plan, nutrition targets, and AI coaching.",
    accent:  "text-[#B48B40]",
  },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getActiveUserId(): string {
  try {
    const key = getSessionKey() ?? "";
    return ROLE_TO_USER_ID[key] ?? (key.startsWith("usr_") || key.length === 36 ? key : "anonymous");
  } catch { return "anonymous"; }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WalkthroughPage() {
  const router  = useRouter();
  const [index,   setIndex]   = useState(0);
  const [leaving, setLeaving] = useState(false);

  const screen  = SCREENS[index];
  const isLast  = index === SCREENS.length - 1;
  const isFirst = index === 0;

  // Admin and trainer users skip the walkthrough entirely
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const personalMode = params.get("mode") === "personal" || params.get("force") === "1";
      const key = getSessionKey();
      if (!personalMode && (key === "master" || key === "trainer")) {
        markWalkthroughSeen(getActiveUserId());
        router.replace(key === "master" ? "/admin" : "/trainers");
      }
    } catch { /* ignore */ }
  }, [router]);

  function finish() {
    const userId = getActiveUserId();
    markWalkthroughSeen(userId);
    const personalSuffix = (() => {
      try {
        const params = new URLSearchParams(window.location.search);
        return params.get("mode") === "personal" || params.get("force") === "1" ? "?mode=personal" : "";
      } catch { return ""; }
    })();
    router.replace(`/onboarding/calibration${personalSuffix}`);
  }

  function goNext() {
    if (isLast) { finish(); return; }
    setLeaving(true);
    setTimeout(() => { setIndex((i) => i + 1); setLeaving(false); }, 180);
  }

  function goPrev() {
    if (isFirst) return;
    setLeaving(true);
    setTimeout(() => { setIndex((i) => i - 1); setLeaving(false); }, 180);
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center px-5 py-12 text-white">

      {/* Progress dots */}
      <div className="flex items-center gap-1.5 mb-10">
        {SCREENS.map((_, i) => (
          <div
            key={i}
            className={cn(
              "rounded-full transition-all duration-300",
              i === index
                ? "w-5 h-1.5 bg-[#B48B40]"
                : i < index
                  ? "w-1.5 h-1.5 bg-white/30"
                  : "w-1.5 h-1.5 bg-white/[0.08]"
            )}
          />
        ))}
      </div>

      {/* Card */}
      <div
        className={cn(
          "w-full max-w-sm transition-all duration-180",
          leaving ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
        )}
      >
        <div className="rounded-2xl border border-white/[0.07] bg-[#111111] p-7 space-y-6">

          {/* Eyebrow */}
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/25">
            {screen.eyebrow}
          </p>

          {/* Hero screen */}
          {screen.type === "hero" && (
            <>
              <div className="w-14 h-14 rounded-2xl border border-[#B48B40]/20 bg-[#B48B40]/10 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-[#B48B40]" strokeWidth={1.5} />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold tracking-tight leading-tight">{screen.title}</h2>
                <p className="text-sm text-white/45 leading-relaxed">{screen.body}</p>
              </div>
            </>
          )}

          {/* Features screen */}
          {screen.type === "features" && (
            <>
              <div className="space-y-1">
                <h2 className="text-2xl font-semibold tracking-tight">{screen.title}</h2>
                <p className="text-sm text-white/45 leading-relaxed">{screen.body}</p>
              </div>
              <div className="grid grid-cols-5 gap-2 pt-1">
                {screen.features.map(({ icon: Icon, label, color, bg }) => (
                  <div key={label} className="flex flex-col items-center gap-1.5">
                    <div className={cn("w-10 h-10 rounded-xl border flex items-center justify-center", bg)}>
                      <Icon className={cn("w-4.5 h-4.5", color)} strokeWidth={1.5} />
                    </div>
                    <span className="text-[9px] text-white/30 text-center leading-tight">{label}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Adapts screen */}
          {screen.type === "adapt" && (
            <>
              <div className="w-14 h-14 rounded-2xl border border-purple-400/20 bg-purple-400/10 flex items-center justify-center">
                <Zap className="w-6 h-6 text-purple-400" strokeWidth={1.5} />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold tracking-tight leading-tight">{screen.title}</h2>
                <p className="text-sm text-white/45 leading-relaxed">{screen.body}</p>
              </div>
            </>
          )}

          {/* Setup preview screen */}
          {screen.type === "setup" && (
            <>
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold tracking-tight leading-tight">{screen.title}</h2>
                <p className="text-sm text-white/45 leading-relaxed">{screen.body}</p>
              </div>
              <ul className="space-y-2.5">
                {screen.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2.5">
                    <CheckCircle className="w-4 h-4 text-emerald-400/70 mt-0.5 shrink-0" strokeWidth={1.5} />
                    <span className="text-sm text-white/55">{bullet}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* CTA screen */}
          {screen.type === "cta" && (
            <>
              <div className="w-14 h-14 rounded-2xl border border-[#B48B40]/20 bg-[#B48B40]/10 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-[#B48B40]" strokeWidth={1.5} />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold tracking-tight leading-tight">{screen.title}</h2>
                <p className="text-sm text-white/45 leading-relaxed">{screen.body}</p>
              </div>
            </>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={goPrev}
              className={cn(
                "flex items-center gap-1.5 text-xs transition-all",
                isFirst || screen.type === "cta"
                  ? "invisible"
                  : "text-white/30 hover:text-white/55"
              )}
            >
              <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
              Back
            </button>

            <button
              onClick={goNext}
              className={cn(
                "flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-xs font-semibold transition-all",
                isLast
                  ? "bg-[#B48B40] text-black hover:bg-[#c99840]"
                  : "bg-white/[0.06] text-white/70 hover:bg-white/[0.10] hover:text-white"
              )}
            >
              {isLast ? "Start setup" : "Next"}
              <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>

      {/* Skip — hidden on final CTA screen */}
      {!isLast && (
        <button
          onClick={finish}
          className="mt-6 text-[11px] text-white/18 hover:text-white/35 transition-colors"
        >
          Skip intro
        </button>
      )}

    </div>
  );
}
