"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Zap, CheckCircle2, Calendar, Dumbbell, Clock, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { loadStarterPlan, type StarterPlan } from "@/lib/starterPlan";
import { DEMO_USERS } from "@/context/UserContext";
import { createClient } from "@/lib/supabase/client";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getActiveUserId(): string {
  try {
    const key = sessionStorage.getItem("flowstate-session-role") || localStorage.getItem("flowstate-active-role") || "";
    if (DEMO_USERS[key as keyof typeof DEMO_USERS]) return DEMO_USERS[key as keyof typeof DEMO_USERS].id;
    if (key) return key;
  } catch { /* ignore */ }
  return "anonymous";
}

const GOAL_LABELS: Record<string, string> = {
  muscle_gain: "Muscle gain",
  fat_loss:    "Fat loss",
  strength:    "Strength",
  endurance:   "Endurance",
  recomp:      "Body recomp",
  general:     "General fitness",
};

const EXPERIENCE_LABELS: Record<string, string> = {
  beginner:     "Beginner",
  intermediate: "Intermediate",
  advanced:     "Advanced",
};

// ─── Typing effect ─────────────────────────────────────────────────────────────

function useTypingText(text: string, speed = 18, startDelay = 300): string {
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    setDisplayed("");
    const timeout = setTimeout(() => {
      let i = 0;
      const interval = setInterval(() => {
        setDisplayed(text.slice(0, i + 1));
        i++;
        if (i >= text.length) clearInterval(interval);
      }, speed);
      return () => clearInterval(interval);
    }, startDelay);
    return () => clearTimeout(timeout);
  }, [text, speed, startDelay]);

  return displayed;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatPill({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3.5 py-2.5">
      <div className="text-[#B48B40]/70 shrink-0">{icon}</div>
      <div>
        <p className="text-[10px] text-white/30 uppercase tracking-[0.12em]">{label}</p>
        <p className="text-sm font-semibold text-white/80 leading-tight">{value}</p>
      </div>
    </div>
  );
}

function SessionRow({ day, name, duration }: { day: string; name: string; duration: string }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/[0.05] last:border-0">
      <span className="text-[11px] font-semibold text-white/30 w-7 shrink-0">{day}</span>
      <span className="flex-1 text-sm text-white/65">{name}</span>
      <span className="text-[11px] text-white/28 shrink-0">{duration}</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Phase = "loading" | "greeting" | "plan" | "upgrade";

export default function CoachIntroPage() {
  const router = useRouter();
  const [phase,      setPhase]      = useState<Phase>("loading");
  const [plan,       setPlan]       = useState<StarterPlan | null>(null);
  const [isSupabase, setIsSupabase] = useState(false);
  const [planVisible, setPlanVisible] = useState(false);

  // Load plan + check auth type
  useEffect(() => {
    const userId = getActiveUserId();
    const loaded  = loadStarterPlan(userId);
    setPlan(loaded);

    // Check if this is a Supabase user (affects upgrade CTA copy)
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const supabase = createClient();
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) setIsSupabase(true);
      });
    }

    // Start greeting after brief load
    const t = setTimeout(() => setPhase("greeting"), 600);
    return () => clearTimeout(t);
  }, []);

  // Advance to plan view after greeting settles
  useEffect(() => {
    if (phase === "greeting") {
      const t = setTimeout(() => {
        setPhase("plan");
        setTimeout(() => setPlanVisible(true), 80);
      }, 2200);
      return () => clearTimeout(t);
    }
  }, [phase]);

  const coachMessage = plan
    ? `I've reviewed your answers. Based on your goal to ${GOAL_LABELS[plan.goal]?.toLowerCase() ?? "improve"} and your ${EXPERIENCE_LABELS[plan.experience]?.toLowerCase() ?? ""} background, I've built your starter block.`
    : "I've put together your first training block based on what you shared.";

  const displayedMessage = useTypingText(
    coachMessage,
    16,
    phase === "greeting" ? 200 : 99999, // only type during greeting
  );

  function handleUpgrade() {
    router.push("/pricing");
  }

  function handleFreeAccess() {
    // Allow limited access — mark plan as "foundation" and route to dashboard
    try {
      const key = sessionStorage.getItem("flowstate-session-role") || localStorage.getItem("flowstate-active-role");
      if (key) {
        localStorage.setItem(`flowstate-plan-${key}`, "foundation");
      }
    } catch { /* ignore */ }
    router.replace("/dashboard");
  }

  // ── Loading ─────────────────────────────────────────────────────────────────

  if (phase === "loading") {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="flex items-center gap-3 text-white/30">
          <Zap className="w-4 h-4 text-[#B48B40] animate-pulse" strokeWidth={2.5} />
          <span className="text-sm">Preparing your plan…</span>
        </div>
      </div>
    );
  }

  // ── Greeting ────────────────────────────────────────────────────────────────

  if (phase === "greeting") {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center px-5 text-white">
        <div className="max-w-md w-full space-y-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#B48B40]/15 border border-[#B48B40]/25 flex items-center justify-center">
              <Zap className="w-4 h-4 text-[#B48B40]" strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-white/25">Flowstate AI</p>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#B48B40]/60">Your coach</p>
            <p className="text-lg text-white/80 leading-relaxed min-h-[3.5rem]">
              {displayedMessage}
              <span className="inline-block w-0.5 h-4 bg-[#B48B40]/60 ml-0.5 animate-pulse align-middle" />
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Plan + upgrade ──────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <div className="max-w-lg mx-auto px-5 py-10 space-y-8">

        {/* Coach header */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#B48B40]/12 border border-[#B48B40]/22 flex items-center justify-center shrink-0">
            <Zap className="w-4.5 h-4.5 text-[#B48B40]" strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white/80">Flowstate AI</p>
            <p className="text-[11px] text-white/30">Your coach</p>
          </div>
        </div>

        {/* Coach message */}
        <div
          className={cn(
            "rounded-2xl border border-white/[0.07] bg-white/[0.02] px-5 py-4 transition-all duration-500",
            planVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3",
          )}
        >
          <p className="text-sm text-white/65 leading-relaxed">{coachMessage}</p>
          {plan?.coachNote && (
            <p className="text-sm text-white/50 leading-relaxed mt-2">{plan.coachNote}</p>
          )}
        </div>

        {/* Starter plan card */}
        {plan && (
          <div
            className={cn(
              "rounded-2xl border border-white/[0.08] bg-[#111111] overflow-hidden transition-all duration-500 delay-100",
              planVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3",
            )}
          >
            {/* Card header */}
            <div className="px-5 pt-5 pb-4 border-b border-white/[0.05]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/25 mb-1">{plan.phase}</p>
                  <h2 className="text-lg font-semibold text-white/90">{plan.blockName}</h2>
                  <p className="text-xs text-white/35 mt-0.5">{plan.durationWeeks} weeks · {plan.split}</p>
                </div>
                <span className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-[#B48B40]/10 border border-[#B48B40]/20 text-[#B48B40]/80 shrink-0">
                  Starter
                </span>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 px-5 py-4">
              <StatPill
                icon={<Calendar className="w-3.5 h-3.5" strokeWidth={1.5} />}
                label="Days / wk"
                value={String(plan.daysPerWeek)}
              />
              <StatPill
                icon={<Clock className="w-3.5 h-3.5" strokeWidth={1.5} />}
                label="Session"
                value={`~${plan.sessionLength} min`}
              />
              <StatPill
                icon={<Dumbbell className="w-3.5 h-3.5" strokeWidth={1.5} />}
                label="Goal"
                value={GOAL_LABELS[plan.goal] ?? plan.goal}
              />
            </div>

            {/* Sessions */}
            <div className="px-5 pb-5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/22 mb-3">Your week</p>
              <div>
                {plan.sessions.map((s, i) => (
                  <SessionRow key={i} day={s.day} name={s.name} duration={s.duration} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* What's included with full access */}
        <div
          className={cn(
            "space-y-3 transition-all duration-500 delay-200",
            planVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3",
          )}
        >
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/25">With full access</p>
          <div className="space-y-2">
            {[
              { label: "Adaptive programming",     sub: "Your plan adjusts based on performance and recovery"   },
              { label: "AI coach, always on",      sub: "Chat with your coach, log sessions, get real feedback" },
              { label: "Nutrition tracking",        sub: "Voice-log meals, hit your targets, stay on track"      },
              { label: "Accountability system",     sub: "Streaks, check-ins, and weekly plan reviews"           },
            ].map(({ label, sub }) => (
              <div key={label} className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.015] px-4 py-3">
                <CheckCircle2 className="w-4 h-4 text-[#B48B40]/60 shrink-0 mt-0.5" strokeWidth={1.5} />
                <div>
                  <p className="text-sm font-medium text-white/72">{label}</p>
                  <p className="text-[11px] text-white/30 mt-0.5 leading-snug">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTAs */}
        <div
          className={cn(
            "space-y-3 transition-all duration-500 delay-300",
            planVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3",
          )}
        >
          <button
            onClick={handleUpgrade}
            className="w-full rounded-2xl py-4 bg-[#B48B40] text-black text-sm font-semibold tracking-wide flex items-center justify-center gap-2 hover:bg-[#c99840] active:scale-[0.98] transition-all"
          >
            Unlock full access
            <ArrowRight className="w-4 h-4" strokeWidth={2} />
          </button>

          <button
            onClick={handleFreeAccess}
            className="w-full rounded-2xl py-3.5 border border-white/8 text-sm text-white/40 hover:text-white/60 hover:border-white/15 flex items-center justify-center gap-1.5 transition-all"
          >
            Continue with limited access
            <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>

          <p className="text-center text-[11px] text-white/18 leading-relaxed px-4">
            Limited access includes basic tracking only.{" "}
            {isSupabase ? "Upgrade anytime from your profile." : "No credit card required to explore."}
          </p>
        </div>

      </div>
    </div>
  );
}
