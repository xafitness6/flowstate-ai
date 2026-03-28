"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type FeedbackKey =
  | "too_hard"
  | "too_easy"
  | "no_time"
  | "equipment"
  | "looks_good";

type Step = "greeting" | "plan" | "feedback" | "adjusted" | "confirmed";

type PlanStat = { label: string; value: string };

type PlanVersion = {
  title: string;
  phase: string;
  note: string;
  stats: PlanStat[];
  sessions: { day: string; name: string; duration: string }[];
};

// ─── Plan data ────────────────────────────────────────────────────────────────

const BASE_PLAN: PlanVersion = {
  title: "Foundation Block",
  phase: "Phase 1 · Weeks 1–4",
  note: "Build the base before we push.",
  stats: [
    { label: "Days / week", value: "4" },
    { label: "Session length", value: "~50 min" },
    { label: "Focus", value: "Hypertrophy" },
    { label: "Intensity", value: "Moderate" },
  ],
  sessions: [
    { day: "Mon", name: "Upper · Push", duration: "50 min" },
    { day: "Wed", name: "Lower · Squat", duration: "50 min" },
    { day: "Fri", name: "Upper · Pull", duration: "50 min" },
    { day: "Sat", name: "Lower · Hinge", duration: "50 min" },
  ],
};

const ADJUSTED_PLANS: Record<FeedbackKey, PlanVersion> = {
  too_hard: {
    title: "Foundation Block — Adjusted",
    phase: "Phase 1 · Weeks 1–4",
    note: "Reduced volume and frequency. We build from here.",
    stats: [
      { label: "Days / week", value: "3" },
      { label: "Session length", value: "~40 min" },
      { label: "Focus", value: "Hypertrophy" },
      { label: "Intensity", value: "Lower" },
    ],
    sessions: [
      { day: "Mon", name: "Full Body A", duration: "40 min" },
      { day: "Wed", name: "Full Body B", duration: "40 min" },
      { day: "Fri", name: "Full Body C", duration: "40 min" },
    ],
  },
  too_easy: {
    title: "Foundation Block — Advanced",
    phase: "Phase 1 · Weeks 1–4",
    note: "Higher volume and intensity. You've earned it.",
    stats: [
      { label: "Days / week", value: "5" },
      { label: "Session length", value: "~60 min" },
      { label: "Focus", value: "Hypertrophy" },
      { label: "Intensity", value: "High" },
    ],
    sessions: [
      { day: "Mon", name: "Upper · Push", duration: "60 min" },
      { day: "Tue", name: "Lower · Squat", duration: "60 min" },
      { day: "Thu", name: "Upper · Pull", duration: "60 min" },
      { day: "Fri", name: "Lower · Hinge", duration: "60 min" },
      { day: "Sat", name: "Arms + Core", duration: "45 min" },
    ],
  },
  no_time: {
    title: "Foundation Block — Compact",
    phase: "Phase 1 · Weeks 1–4",
    note: "Shorter sessions. Nothing wasted.",
    stats: [
      { label: "Days / week", value: "4" },
      { label: "Session length", value: "~30 min" },
      { label: "Focus", value: "Hypertrophy" },
      { label: "Intensity", value: "Moderate" },
    ],
    sessions: [
      { day: "Mon", name: "Upper · Push", duration: "30 min" },
      { day: "Wed", name: "Lower · Squat", duration: "30 min" },
      { day: "Fri", name: "Upper · Pull", duration: "30 min" },
      { day: "Sat", name: "Lower · Hinge", duration: "30 min" },
    ],
  },
  equipment: {
    title: "Foundation Block — Home",
    phase: "Phase 1 · Weeks 1–4",
    note: "No gym needed. Full output, minimal setup.",
    stats: [
      { label: "Days / week", value: "4" },
      { label: "Session length", value: "~40 min" },
      { label: "Focus", value: "Hypertrophy" },
      { label: "Equipment", value: "Bodyweight" },
    ],
    sessions: [
      { day: "Mon", name: "Push · Bodyweight", duration: "40 min" },
      { day: "Wed", name: "Legs · Bodyweight", duration: "40 min" },
      { day: "Fri", name: "Pull · Bands", duration: "40 min" },
      { day: "Sat", name: "Core + Cardio", duration: "35 min" },
    ],
  },
  looks_good: BASE_PLAN,
};

const FEEDBACK_RESPONSES: Record<FeedbackKey, string> = {
  too_hard:   "Got it. I've pulled back the frequency and volume. You'll still make progress — we just build more gradually.",
  too_easy:   "Noted. I've increased the load and added a fifth day. This is the version that challenges you.",
  no_time:    "Understood. Sessions are now under 30 minutes. Same structure, tighter execution.",
  equipment:  "Done. I've swapped everything to bodyweight and band work. You can run this anywhere.",
  looks_good: "Good. The plan stays as built. Let's get started.",
};

const FEEDBACK_OPTIONS: { key: FeedbackKey; label: string }[] = [
  { key: "too_hard",   label: "Too hard" },
  { key: "too_easy",   label: "Too easy" },
  { key: "no_time",    label: "Not enough time" },
  { key: "equipment",  label: "Equipment issue" },
  { key: "looks_good", label: "Looks good" },
];

// ─── Typewriter ───────────────────────────────────────────────────────────────

function Typewriter({
  text,
  speed = 18,
  onDone,
}: {
  text: string;
  speed?: number;
  onDone?: () => void;
}) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  const idx = useRef(0);

  useEffect(() => {
    setDisplayed("");
    setDone(false);
    idx.current = 0;

    const interval = setInterval(() => {
      idx.current += 1;
      setDisplayed(text.slice(0, idx.current));
      if (idx.current >= text.length) {
        clearInterval(interval);
        setDone(true);
        onDone?.();
      }
    }, speed);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <span>
      {displayed}
      {!done && (
        <span className="inline-block w-0.5 h-4 bg-[#B48B40]/70 ml-0.5 animate-pulse align-middle" />
      )}
    </span>
  );
}

// ─── Plan preview ─────────────────────────────────────────────────────────────

function PlanPreview({
  plan,
  highlight = false,
}: {
  plan: PlanVersion;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border overflow-hidden transition-all duration-500",
        highlight
          ? "border-[#6f4a17]/50 bg-[#0e0d0b]"
          : "border-white/8 bg-[#111111]"
      )}
    >
      {/* Plan header */}
      <div className="px-5 pt-5 pb-4 border-b border-white/6">
        <div className="flex items-start justify-between gap-3 mb-1">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-white/30 mb-1">
              {plan.phase}
            </p>
            <h3 className="text-base font-semibold text-white/90">{plan.title}</h3>
          </div>
          {highlight && (
            <span className="text-[10px] font-medium tracking-[0.1em] uppercase px-2 py-1 rounded-lg border border-[#B48B40]/30 bg-[#B48B40]/10 text-[#B48B40] shrink-0">
              Updated
            </span>
          )}
        </div>
        <p className="text-sm text-[#B48B40]/80 italic mt-2">&ldquo;{plan.note}&rdquo;</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-white/6 border-b border-white/6">
        {plan.stats.map(({ label, value }) => (
          <div key={label} className="px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.1em] text-white/25 mb-1">{label}</p>
            <p className="text-sm font-semibold text-white/80 tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      {/* Session list */}
      <div className="divide-y divide-white/[0.05]">
        {plan.sessions.map(({ day, name, duration }) => (
          <div key={day} className="flex items-center gap-4 px-5 py-3">
            <span className="text-xs font-medium text-white/30 w-7 shrink-0">{day}</span>
            <span className="text-sm text-white/75 flex-1">{name}</span>
            <span className="text-xs text-white/30 tabular-nums">{duration}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CoachIntroPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("greeting");
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackKey | null>(null);
  const [planVisible, setPlanVisible] = useState(false);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [adjustedVisible, setAdjustedVisible] = useState(false);
  const [adjustedResponseDone, setAdjustedResponseDone] = useState(false);

  const activePlan =
    selectedFeedback ? ADJUSTED_PLANS[selectedFeedback] : BASE_PLAN;

  // Greeting → plan
  function onGreetingDone() {
    setTimeout(() => {
      setStep("plan");
      setTimeout(() => setPlanVisible(true), 200);
      setTimeout(() => setFeedbackVisible(true), 600);
    }, 400);
  }

  // Feedback selected
  function handleFeedback(key: FeedbackKey) {
    if (selectedFeedback) return; // locked after first selection
    setSelectedFeedback(key);
    setStep("adjusted");
    setAdjustedVisible(false);
    setTimeout(() => {
      setAdjustedVisible(true);
    }, 300);
  }

  // Confirm
  function handleConfirm() {
    setStep("confirmed");
    setTimeout(() => router.push("/"), 1200);
  }

  const greetingText =
    "Hey Xavier. I've looked at your goals, your schedule, and your experience level. Here's what I've built for you.";

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-start px-4 py-16">
      <div className="w-full max-w-xl space-y-6">

        {/* Coach identity */}
        <div className="flex items-center gap-3 mb-2">
          <div className="relative">
            <div className="w-9 h-9 rounded-full bg-[#1C1C1C] border border-[#B48B40]/30 flex items-center justify-center">
              <span className="text-[#B48B40] text-base leading-none">◈</span>
            </div>
            {/* Pulse ring */}
            {step === "greeting" && (
              <span className="absolute inset-0 rounded-full border border-[#B48B40]/20 animate-ping" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-white/80">Flowstate Coach</p>
            <p className="text-xs text-white/30">AI · Performance</p>
          </div>
        </div>

        {/* Greeting bubble */}
        <div className="rounded-2xl border border-white/8 bg-[#111111] px-5 py-4">
          <p className="text-base text-white/85 leading-relaxed">
            {step === "greeting" ? (
              <Typewriter text={greetingText} speed={16} onDone={onGreetingDone} />
            ) : (
              greetingText
            )}
          </p>
        </div>

        {/* Plan preview */}
        {(step === "plan" || step === "feedback" || step === "adjusted" || step === "confirmed") && (
          <div
            className={cn(
              "transition-all duration-500",
              planVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
            )}
          >
            <PlanPreview
              plan={step === "adjusted" || step === "confirmed" ? activePlan : BASE_PLAN}
              highlight={step === "adjusted" && selectedFeedback !== "looks_good"}
            />
          </div>
        )}

        {/* Feedback question */}
        {(step === "feedback" || step === "adjusted" || step === "confirmed") && (
          <div
            className={cn(
              "transition-all duration-500",
              feedbackVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
            )}
          >
            {/* Question */}
            {step === "feedback" && (
              <div className="rounded-2xl border border-white/8 bg-[#111111] px-5 py-4 mb-3">
                <p className="text-base text-white/85 leading-relaxed">
                  Does this feel realistic and doable?
                </p>
              </div>
            )}

            {/* Feedback pills */}
            {step === "feedback" && (
              <div className="flex flex-wrap gap-2">
                {FEEDBACK_OPTIONS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => handleFeedback(key)}
                    className={cn(
                      "rounded-xl border px-4 py-2 text-sm font-medium transition-all",
                      key === "looks_good"
                        ? "border-[#B48B40]/40 bg-[#B48B40]/8 text-[#B48B40] hover:bg-[#B48B40]/15"
                        : "border-white/10 text-white/55 hover:border-white/25 hover:text-white/80"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* AI response to feedback */}
        {(step === "adjusted" || step === "confirmed") && selectedFeedback && (
          <div
            className={cn(
              "transition-all duration-500",
              adjustedVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
            )}
          >
            {/* Echo selected feedback */}
            <div className="flex justify-end mb-3">
              <div className="rounded-2xl border border-[#B48B40]/15 bg-[#B48B40]/5 px-4 py-2.5 max-w-[80%]">
                <p className="text-sm text-white/65">
                  {FEEDBACK_OPTIONS.find((f) => f.key === selectedFeedback)?.label}
                </p>
              </div>
            </div>

            {/* AI response */}
            <div className="rounded-2xl border border-white/8 bg-[#111111] px-5 py-4 mb-4">
              <p className="text-base text-white/85 leading-relaxed">
                {adjustedVisible && step === "adjusted" ? (
                  <Typewriter
                    text={FEEDBACK_RESPONSES[selectedFeedback]}
                    speed={16}
                    onDone={() => setAdjustedResponseDone(true)}
                  />
                ) : (
                  FEEDBACK_RESPONSES[selectedFeedback]
                )}
              </p>
            </div>
          </div>
        )}

        {/* Confirm CTA — shown after feedback response is done */}
        {adjustedResponseDone && step === "adjusted" && (
          <div className="pt-2">
            <button
              onClick={handleConfirm}
              className="w-full rounded-2xl bg-[#B48B40] py-3.5 text-sm font-semibold text-black hover:bg-[#c99840] transition-colors flex items-center justify-center gap-2"
            >
              This works. Let&apos;s go.
              <ArrowRight className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
        )}

        {/* Confirmed state */}
        {step === "confirmed" && (
          <div className="flex items-center justify-center gap-2 py-4 text-emerald-400/80">
            <Check className="w-4 h-4" strokeWidth={2} />
            <span className="text-sm font-medium">Plan confirmed. Taking you to your dashboard.</span>
          </div>
        )}

        {/* Initial confirm (if no feedback given yet but plan is visible) */}
        {step === "feedback" && feedbackVisible && (
          <div className="pt-2">
            <p className="text-xs text-white/25 text-center">
              Select feedback above — or confirm the plan as-is.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
