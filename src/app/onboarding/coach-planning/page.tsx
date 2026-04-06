"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Zap, ArrowRight, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  loadOnboardingState,
  completePlanningConversation,
  type PlanningData,
  type QuickStartData,
} from "@/lib/onboarding";

// ─── Constants ────────────────────────────────────────────────────────────────

const LS_KEY = "flowstate-active-role";
const SS_KEY = "flowstate-session-role";
const ROLE_TO_USER_ID: Record<string, string> = {
  master: "usr_001", trainer: "u4", client: "u1", member: "u6",
};

type WizardStep =
  | "greeting"
  | "duration"
  | "focus"
  | "intensity"
  | "split"
  | "review"
  | "generating"
  | "complete";

type Duration  = "4_weeks" | "8_weeks" | "12_weeks" | "16_weeks";
type Focus     = "muscle_gain" | "fat_loss" | "strength" | "endurance" | "recomp";
type Intensity = "low" | "moderate" | "high" | "max";
type Split     = "full_body" | "upper_lower" | "push_pull_legs" | "bro_split";

// ─── Option lists ─────────────────────────────────────────────────────────────

const DURATIONS: { value: Duration; label: string; sub: string }[] = [
  { value: "4_weeks",  label: "4 Weeks",  sub: "Quick reset or intro block"   },
  { value: "8_weeks",  label: "8 Weeks",  sub: "Standard building cycle"       },
  { value: "12_weeks", label: "12 Weeks", sub: "Full transformation block"     },
  { value: "16_weeks", label: "16 Weeks", sub: "Competition or peak prep"      },
];

const FOCUSES: { value: Focus; label: string; sub: string }[] = [
  { value: "muscle_gain", label: "Build muscle",   sub: "Hypertrophy & size"          },
  { value: "fat_loss",    label: "Lose fat",        sub: "Cut while keeping strength"  },
  { value: "strength",    label: "Get stronger",    sub: "Max strength progression"    },
  { value: "endurance",   label: "Endurance",       sub: "Conditioning & stamina"      },
  { value: "recomp",      label: "Body recomp",     sub: "Build muscle, lose fat"      },
];

const INTENSITIES: { value: Intensity; label: string; sub: string }[] = [
  { value: "low",      label: "Easy",      sub: "60–70% effort, recovery focus"  },
  { value: "moderate", label: "Moderate",  sub: "70–80% effort, steady progress" },
  { value: "high",     label: "Hard",      sub: "80–90% effort, serious gains"   },
  { value: "max",      label: "Maximum",   sub: "90–100% effort, elite output"   },
];

const SPLITS: { value: Split; label: string; sub: string }[] = [
  { value: "full_body",        label: "Full Body",         sub: "Train everything each session"      },
  { value: "upper_lower",      label: "Upper / Lower",     sub: "Alternate upper and lower days"     },
  { value: "push_pull_legs",   label: "Push / Pull / Legs", sub: "Classic PPL structure"            },
  { value: "bro_split",        label: "Body Part Split",   sub: "One muscle group per day"           },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function focusLabel(v: Focus): string {
  return FOCUSES.find((f) => f.value === v)?.label ?? v;
}
function intensityLabel(v: Intensity): string {
  return INTENSITIES.find((i) => i.value === v)?.label ?? v;
}
function splitLabel(v: Split): string {
  return SPLITS.find((s) => s.value === v)?.label ?? v;
}
function durationLabel(v: Duration): string {
  return DURATIONS.find((d) => d.value === v)?.label ?? v;
}

function coachingStyleFromIntensity(i: Intensity): string {
  if (i === "max" || i === "high") return "direct";
  if (i === "low") return "supportive";
  return "analytical";
}

function buildGreeting(name: string, data: QuickStartData | null): string {
  const goalMap: Record<string, string> = {
    muscle_gain: "build muscle",
    fat_loss:    "lose fat",
    strength:    "get stronger",
    endurance:   "improve endurance",
    recomp:      "recomp your body",
    general:     "improve your fitness",
  };
  const goal = data?.primaryGoal ? (goalMap[data.primaryGoal] ?? "reach your goals") : "reach your goals";
  const days  = data?.daysPerWeek ?? 4;
  return `Hey ${name}. Based on your intake, I can see you want to ${goal} training ${days} days a week. Let me put together a plan that actually fits your life. I just need a few quick answers.`;
}

// ─── Option card ──────────────────────────────────────────────────────────────

function OptionCard<T extends string>({
  value,
  label,
  sub,
  selected,
  onSelect,
}: {
  value: T;
  label: string;
  sub: string;
  selected: boolean;
  onSelect: (v: T) => void;
}) {
  return (
    <button
      onClick={() => onSelect(value)}
      className={cn(
        "w-full rounded-2xl border px-5 py-4 text-left transition-all duration-150 group",
        selected
          ? "border-[#B48B40]/40 bg-[#B48B40]/8"
          : "border-white/[0.07] bg-white/[0.02] hover:border-white/14 hover:bg-white/[0.035]"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className={cn(
            "text-sm font-semibold transition-colors",
            selected ? "text-white" : "text-white/75 group-hover:text-white/90"
          )}>
            {label}
          </p>
          <p className="text-xs text-white/35 mt-0.5">{sub}</p>
        </div>
        <div className={cn(
          "w-5 h-5 rounded-full border shrink-0 flex items-center justify-center transition-all",
          selected ? "border-[#B48B40]/60 bg-[#B48B40]/20" : "border-white/15"
        )}>
          {selected && <Check className="w-3 h-3 text-[#B48B40]" strokeWidth={2.5} />}
        </div>
      </div>
    </button>
  );
}

// ─── Coach message bubble ─────────────────────────────────────────────────────

function CoachMessage({ text, visible }: { text: string; visible: boolean }) {
  return (
    <div className={cn(
      "transition-all duration-500",
      visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
    )}>
      <div className="flex items-start gap-3">
        <div className="w-7 h-7 rounded-full bg-[#B48B40]/15 border border-[#B48B40]/25 flex items-center justify-center shrink-0 mt-0.5">
          <Zap className="w-3.5 h-3.5 text-[#B48B40]" strokeWidth={2.5} />
        </div>
        <div className="rounded-2xl rounded-tl-sm bg-white/[0.04] border border-white/[0.06] px-4 py-3 text-sm text-white/80 leading-relaxed">
          {text}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CoachPlanningPage() {
  const router  = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState("there");
  const [quickStart, setQuickStart] = useState<QuickStartData | null>(null);

  const [wizardStep, setWizardStep] = useState<WizardStep>("greeting");
  const [messageVisible, setMessageVisible] = useState(false);

  const [duration,      setDuration]      = useState<Duration | null>(null);
  const [focus,         setFocus]         = useState<Focus | null>(null);
  const [focusFromIntake, setFocusFromIntake] = useState(false); // true if pre-filled from quick-start
  const [intensity,     setIntensity]     = useState<Intensity | null>(null);
  const [split,         setSplit]         = useState<Split | null>(null);

  const contentRef = useRef<HTMLDivElement>(null);

  // ── Load user context ───────────────────────────────────────────────────────

  useEffect(() => {
    try {
      const key = sessionStorage.getItem(SS_KEY) || localStorage.getItem(LS_KEY);
      if (!key) { router.replace("/welcome"); return; }
      const uid = ROLE_TO_USER_ID[key] ?? key;
      setUserId(uid);

      const s = loadOnboardingState(uid);
      setQuickStart(s.quickStartData);

      // Auto-populate focus from quick-start so we don't ask the same question twice
      const GOAL_TO_FOCUS: Record<string, Focus> = {
        muscle_gain: "muscle_gain",
        fat_loss:    "fat_loss",
        strength:    "strength",
        endurance:   "endurance",
        recomp:      "recomp",
      };
      if (s.quickStartData?.primaryGoal) {
        const mapped = GOAL_TO_FOCUS[s.quickStartData.primaryGoal];
        if (mapped) { setFocus(mapped); setFocusFromIntake(true); }
      }

      // Best-effort name from UserContext / localStorage
      try {
        const accounts = JSON.parse(localStorage.getItem("flowstate-accounts") ?? "[]") as { id: string; name?: string }[];
        const match = accounts.find((a) => a.id === uid);
        if (match?.name) setUserName(match.name.split(" ")[0]);
      } catch { /* ignore */ }
    } catch {
      router.replace("/welcome");
    }
  }, [router]);

  // ── Animate message in on step change ──────────────────────────────────────

  useEffect(() => {
    setMessageVisible(false);
    const t = setTimeout(() => setMessageVisible(true), 120);
    return () => clearTimeout(t);
  }, [wizardStep]);

  // ── Scroll to top on step change ───────────────────────────────────────────

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [wizardStep]);

  // ── Generating delay then complete ─────────────────────────────────────────

  useEffect(() => {
    if (wizardStep !== "generating") return;
    const t = setTimeout(() => setWizardStep("complete"), 2800);
    return () => clearTimeout(t);
  }, [wizardStep]);

  // ── Finalize on complete ────────────────────────────────────────────────────

  useEffect(() => {
    if (wizardStep !== "complete" || !userId || !duration || !focus || !intensity || !split) return;
    const planningData: PlanningData = {
      planDuration:  duration,
      planFocus:     focus,
      intensity:     intensity,
      split:         split,
      coachingStyle: coachingStyleFromIntensity(intensity),
    };
    completePlanningConversation(userId, planningData);
  }, [wizardStep, userId, duration, focus, intensity, split]);

  // ── Message text per step ───────────────────────────────────────────────────

  const MESSAGE: Record<WizardStep, string> = {
    greeting:   buildGreeting(userName, quickStart),
    duration:   "How long do you want to commit to this plan? Pick a block length that feels real — not too ambitious, not too short.",
    focus:      "What's the main thing we're optimizing for? Everything else will support this.",
    intensity:  "How hard do you want to push? Be honest — the right answer is the one you'll actually follow.",
    split:      "How do you want to structure your training week?",
    review:     `Here's your plan: ${durationLabel(duration ?? "8_weeks")}, focused on ${focusLabel(focus ?? "muscle_gain")}, ${intensityLabel(intensity ?? "moderate")} intensity, ${splitLabel(split ?? "full_body")} split. Ready to lock it in?`,
    generating: "Building your personalized program…",
    complete:   "Your plan is ready. Let's get you set up.",
  };

  // ── Advance handlers ────────────────────────────────────────────────────────

  // Skip focus step if it was pre-filled from quick-start intake
  const stepOrder: WizardStep[] = focusFromIntake
    ? ["greeting", "duration", "intensity", "split", "review", "generating", "complete"]
    : ["greeting", "duration", "focus", "intensity", "split", "review", "generating", "complete"];

  function advance() {
    const idx = stepOrder.indexOf(wizardStep);
    if (idx < stepOrder.length - 1) setWizardStep(stepOrder[idx + 1]);
  }

  function canAdvance(): boolean {
    if (wizardStep === "greeting")  return true;
    if (wizardStep === "duration")  return !!duration;
    if (wizardStep === "focus")     return !!focus;
    if (wizardStep === "intensity") return !!intensity;
    if (wizardStep === "split")     return !!split;
    if (wizardStep === "review")    return true;
    return false;
  }

  // ── Progress indicator ──────────────────────────────────────────────────────

  const STEPS = stepOrder.filter((s) => s !== "generating" && s !== "complete") as WizardStep[];
  const progressIdx = Math.min(STEPS.indexOf(wizardStep), STEPS.length - 1);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center px-5 py-12 text-white">

      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-48 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-[#B48B40]/[0.04] blur-[120px]" />
      </div>

      <div ref={contentRef} className="relative w-full max-w-sm space-y-8">

        {/* Brand */}
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-[#B48B40]" strokeWidth={2.5} />
          <span className="text-[10px] uppercase tracking-[0.35em] text-white/30">Flowstate AI</span>
        </div>

        {/* Progress dots */}
        {wizardStep !== "generating" && wizardStep !== "complete" && (
          <div className="flex items-center gap-1.5">
            {STEPS.map((s, i) => (
              <div
                key={s}
                className={cn(
                  "h-1 rounded-full transition-all duration-300",
                  i < progressIdx
                    ? "bg-[#B48B40]/60 w-6"
                    : i === progressIdx
                    ? "bg-[#B48B40] w-8"
                    : "bg-white/10 w-4"
                )}
              />
            ))}
          </div>
        )}

        {/* ── Coach message ─────────────────────────────────────────────────── */}
        <CoachMessage text={MESSAGE[wizardStep]} visible={messageVisible} />

        {/* ── Option selection ──────────────────────────────────────────────── */}

        {wizardStep === "duration" && (
          <div className="space-y-2.5">
            {DURATIONS.map((opt) => (
              <OptionCard
                key={opt.value}
                value={opt.value}
                label={opt.label}
                sub={opt.sub}
                selected={duration === opt.value}
                onSelect={setDuration}
              />
            ))}
          </div>
        )}

        {wizardStep === "focus" && (
          <div className="space-y-2.5">
            {FOCUSES.map((opt) => (
              <OptionCard
                key={opt.value}
                value={opt.value}
                label={opt.label}
                sub={opt.sub}
                selected={focus === opt.value}
                onSelect={setFocus}
              />
            ))}
          </div>
        )}

        {wizardStep === "intensity" && (
          <div className="space-y-2.5">
            {INTENSITIES.map((opt) => (
              <OptionCard
                key={opt.value}
                value={opt.value}
                label={opt.label}
                sub={opt.sub}
                selected={intensity === opt.value}
                onSelect={setIntensity}
              />
            ))}
          </div>
        )}

        {wizardStep === "split" && (
          <div className="space-y-2.5">
            {SPLITS.map((opt) => (
              <OptionCard
                key={opt.value}
                value={opt.value}
                label={opt.label}
                sub={opt.sub}
                selected={split === opt.value}
                onSelect={setSplit}
              />
            ))}
          </div>
        )}

        {/* ── Review summary ────────────────────────────────────────────────── */}
        {wizardStep === "review" && duration && focus && intensity && split && (
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] divide-y divide-white/[0.05]">
            {[
              { label: "Duration",  value: durationLabel(duration)  },
              { label: "Focus",     value: focusLabel(focus)         },
              { label: "Intensity", value: intensityLabel(intensity) },
              { label: "Split",     value: splitLabel(split)         },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between px-5 py-3.5">
                <span className="text-xs text-white/35 uppercase tracking-[0.12em]">{label}</span>
                <span className="text-sm font-semibold text-white/80">{value}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Generating ────────────────────────────────────────────────────── */}
        {wizardStep === "generating" && (
          <div className="flex flex-col items-center gap-6 py-8">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border border-[#B48B40]/20 animate-ping" />
              <div className="relative w-16 h-16 rounded-full border border-[#B48B40]/30 bg-[#B48B40]/8 flex items-center justify-center">
                <Loader2 className="w-7 h-7 text-[#B48B40] animate-spin" strokeWidth={1.5} />
              </div>
            </div>
            <div className="space-y-1 text-center">
              <p className="text-sm font-semibold text-white/70">Building your program</p>
              <p className="text-xs text-white/30">Customizing for your goals and schedule…</p>
            </div>
          </div>
        )}

        {/* ── Complete ──────────────────────────────────────────────────────── */}
        {wizardStep === "complete" && (
          <div className="space-y-6">
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="w-14 h-14 rounded-full bg-[#B48B40]/15 border border-[#B48B40]/30 flex items-center justify-center">
                <Check className="w-7 h-7 text-[#B48B40]" strokeWidth={2} />
              </div>
              <div className="space-y-1 text-center">
                <p className="text-base font-semibold text-white/80">Plan created</p>
                <p className="text-xs text-white/35 leading-relaxed">
                  {durationLabel(duration ?? "8_weeks")} · {focusLabel(focus ?? "muscle_gain")} · {splitLabel(split ?? "full_body")}
                </p>
              </div>
            </div>

            <button
              onClick={() => router.push("/onboarding/tutorial")}
              className="w-full rounded-2xl bg-[#B48B40] text-black py-4 text-sm font-semibold tracking-wide flex items-center justify-center gap-2 hover:bg-[#c99840] active:scale-[0.98] transition-all duration-200"
            >
              Continue <ArrowRight className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
        )}

        {/* ── CTA button ────────────────────────────────────────────────────── */}
        {wizardStep !== "generating" && wizardStep !== "complete" && (
          <button
            onClick={advance}
            disabled={!canAdvance()}
            className={cn(
              "w-full rounded-2xl py-4 text-sm font-semibold tracking-wide flex items-center justify-center gap-2 transition-all duration-200",
              canAdvance()
                ? "bg-[#B48B40] text-black hover:bg-[#c99840] active:scale-[0.98]"
                : "bg-white/5 text-white/25 cursor-default"
            )}
          >
            {wizardStep === "review" ? (
              <>Lock it in <ArrowRight className="w-4 h-4" strokeWidth={2} /></>
            ) : wizardStep === "greeting" ? (
              <>Let&apos;s go <ArrowRight className="w-4 h-4" strokeWidth={2} /></>
            ) : (
              <>Continue <ArrowRight className="w-4 h-4" strokeWidth={2} /></>
            )}
          </button>
        )}

      </div>
    </div>
  );
}
