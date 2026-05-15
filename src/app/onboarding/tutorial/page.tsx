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
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readStoredUserId(): string {
  try {
    const key = sessionStorage.getItem(SS_KEY) || localStorage.getItem(LS_KEY) || "";
    return ROLE_TO_USER_ID[key] ?? (key.startsWith("usr_") || UUID_RE.test(key) ? key : "anonymous");
  } catch { return "anonymous"; }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    }),
  ]);
}

async function getActiveUserId(): Promise<string> {
  const stored = readStoredUserId();
  if (UUID_RE.test(stored) || !process.env.NEXT_PUBLIC_SUPABASE_URL) return stored;

  try {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { data: { user } } = await withTimeout(supabase.auth.getUser(), 2500, "Supabase user lookup");
    if (user?.id) {
      try {
        localStorage.setItem(LS_KEY, user.id);
        sessionStorage.setItem(SS_KEY, user.id);
      } catch { /* ignore */ }
      return user.id;
    }
  } catch (error) {
    console.warn("[tutorial] user lookup skipped:", error);
  }

  return stored;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TutorialPage() {
  const router   = useRouter();
  const [index,  setIndex]   = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const step     = STEPS[index];
  const Icon     = step.icon;
  const isLast   = index === STEPS.length - 1;
  const isFirst  = index === 0;

  async function finishTutorial() {
    if (finishing) return;
    setFinishing(true);

    // 1. Local completion + a sessionStorage breadcrumb. The AppShell guard
    //    reads this flag so it never bounces a user who just finished.
    try {
      const storedUserId = readStoredUserId();
      completeTutorial(storedUserId);
      try { sessionStorage.setItem("flowstate-tutorial-finished", "true"); } catch { /* ignore */ }
    } catch (error) {
      console.warn("[tutorial] local completion skipped:", error);
    }

    // 2. Persist tutorial_complete SERVER-SIDE *before* navigating. The API
    //    uses the service-role client so it bypasses RLS and is a single fast
    //    upsert. Doing this before the redirect means /program's guard sees
    //    tutorial_complete=true on its first read — no race, no bounce.
    //    A timeout guarantees a slow network can never trap the user here.
    try {
      const userId = await getActiveUserId();
      completeTutorial(userId);
      if (UUID_RE.test(userId) && process.env.NEXT_PUBLIC_SUPABASE_URL) {
        const response = await withTimeout(
          fetch("/api/onboarding/tutorial-complete", { method: "POST", cache: "no-store" }),
          4000,
          "tutorial complete API",
        ).catch(() => null);

        if (!response || !response.ok) {
          // Endpoint missing / service role unset — fall back to a browser
          // upsert. If RLS blocks it, the sessionStorage flag + guard reorder
          // still get the user through.
          const { upsertOnboardingState } = await import("@/lib/db/onboarding");
          await withTimeout(
            upsertOnboardingState(userId, { tutorial_complete: true }),
            4000,
            "tutorial sync",
          ).catch(() => {});
        }
      }
    } catch (error) {
      console.warn("[tutorial] server completion skipped:", error);
    }

    // 3. Navigate. router.replace for the SPA path; a hard fallback in case
    //    the client transition is interrupted.
    router.replace("/program");
    window.setTimeout(() => {
      if (window.location.pathname !== "/program") window.location.assign("/program");
    }, 700);
  }

  function goNext() {
    if (isLast) {
      void finishTutorial();
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
    void finishTutorial();
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
              disabled={finishing}
              className={cn(
                "flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-xs font-semibold transition-all",
                finishing
                  ? "bg-white/[0.06] text-white/35 cursor-default"
                  : isLast
                  ? "bg-[#B48B40] text-black hover:bg-[#c99840]"
                  : "bg-white/[0.06] text-white/70 hover:bg-white/[0.10] hover:text-white"
              )}
            >
              {finishing ? "Opening..." : isLast ? "Show me my plan" : "Next"}
              <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>

      {/* Skip */}
      <button
        onClick={handleSkip}
        disabled={finishing}
        className="mt-6 text-[11px] text-white/18 hover:text-white/35 transition-colors disabled:cursor-default disabled:text-white/12"
      >
        {finishing ? "Opening..." : "Skip tour"}
      </button>

    </div>
  );
}
