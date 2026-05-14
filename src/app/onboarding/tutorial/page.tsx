"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Dumbbell,
  Apple,
  Flame,
  Zap,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { completeTutorial } from "@/lib/onboarding";

// ─── Tutorial steps ───────────────────────────────────────────────────────────

const STEPS = [
  {
    icon:  LayoutDashboard,
    color: "text-blue-400",
    bg:    "bg-blue-400/10 border-blue-400/20",
    title: "Dashboard",
    sub:   "Your performance command center.",
    desc:  "See today's readiness, your weekly progress, training volume, and the top metrics that matter most — all in one place. Your AI coach surfaces insights here daily.",
  },
  {
    icon:  Dumbbell,
    color: "text-[#B48B40]",
    bg:    "bg-[#B48B40]/10 border-[#B48B40]/20",
    title: "Program",
    sub:   "Workouts built around you.",
    desc:  "Your training plan is generated from your goals and calibration data. Each session is structured and progressive. Log your sets and reps directly — no extra steps.",
  },
  {
    icon:  Apple,
    color: "text-emerald-400",
    bg:    "bg-emerald-400/10 border-emerald-400/20",
    title: "Nutrition",
    sub:   "Precision intake, dialled in.",
    desc:  "Log meals, track macros, and hit your daily targets. Your calorie and protein goals are set from your intake calibration and adjust as your program evolves.",
  },
  {
    icon:  Flame,
    color: "text-orange-400",
    bg:    "bg-orange-400/10 border-orange-400/20",
    title: "Accountability",
    sub:   "Habits tracked. Streaks earned.",
    desc:  "Your daily habits — workouts, steps, calories, and check-ins — feed a score that drives your streak. The heatmap shows your consistency over time at a glance.",
  },
  {
    icon:  Zap,
    color: "text-purple-400",
    bg:    "bg-purple-400/10 border-purple-400/20",
    title: "AI Coach",
    sub:   "Your intelligent performance partner.",
    desc:  "Ask your AI coach anything — training adjustments, nutrition questions, recovery guidance. It knows your data and gives answers specific to your situation.",
  },
  {
    icon:  Dumbbell,
    color: "text-[#B48B40]",
    bg:    "bg-[#B48B40]/15 border-[#B48B40]/30",
    title: "Let's start training.",
    sub:   "Your first session is ready.",
    desc:  "Next up: your plan. Tap any session to see the exercises, log your sets, and watch your AI coach adjust week by week. You can edit anything — this is your program.",
  },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LS_KEY = "flowstate-active-role";
const SS_KEY = "flowstate-session-role";
const ROLE_TO_USER_ID: Record<string, string> = {
  master: "usr_001", trainer: "u4", client: "u1", member: "u6",
};

function getActiveUserId(): string {
  try {
    const key = sessionStorage.getItem(SS_KEY) || localStorage.getItem(LS_KEY) || "";
    return ROLE_TO_USER_ID[key] ?? (key.startsWith("usr_") ? key : "anonymous");
  } catch { return "anonymous"; }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TutorialPage() {
  const router   = useRouter();
  const [index,  setIndex]   = useState(0);
  const [leaving, setLeaving] = useState(false);

  const step     = STEPS[index];
  const Icon     = step.icon;
  const isLast   = index === STEPS.length - 1;
  const isFirst  = index === 0;

  function goNext() {
    if (isLast) {
      completeTutorial(getActiveUserId());
      router.push("/program");
      return;
    }
    setLeaving(true);
    setTimeout(() => { setIndex((i) => i + 1); setLeaving(false); }, 180);
  }

  function goPrev() {
    if (isFirst) return;
    setLeaving(true);
    setTimeout(() => { setIndex((i) => i - 1); setLeaving(false); }, 180);
  }

  function handleSkip() {
    completeTutorial(getActiveUserId());
    router.push("/program");
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center px-5 py-12 text-white">

      {/* Progress dots */}
      <div className="flex items-center gap-1.5 mb-10">
        {STEPS.map((_, i) => (
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

          {/* Icon */}
          <div className={cn("w-14 h-14 rounded-2xl border flex items-center justify-center", step.bg)}>
            <Icon className={cn("w-6 h-6", step.color)} strokeWidth={1.5} />
          </div>

          {/* Text */}
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/25">
              {index + 1} of {STEPS.length}
            </p>
            <h2 className="text-2xl font-semibold tracking-tight">{step.title}</h2>
            <p className="text-sm text-[#B48B40]/80 font-medium">{step.sub}</p>
          </div>

          <p className="text-sm text-white/45 leading-relaxed">{step.desc}</p>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={goPrev}
              disabled={isFirst}
              className={cn(
                "flex items-center gap-1.5 text-xs transition-all",
                isFirst ? "invisible" : "text-white/30 hover:text-white/55"
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
              {isLast ? "Show me my plan" : "Next"}
              <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>

      {/* Skip */}
      <button
        onClick={handleSkip}
        className="mt-6 text-[11px] text-white/18 hover:text-white/35 transition-colors"
      >
        Skip tour
      </button>

    </div>
  );
}
