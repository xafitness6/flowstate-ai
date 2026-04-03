"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/context/UserContext";
import { completeQuickStart, markOnboardingStarted } from "@/lib/onboarding";
import { PLAN_HIERARCHY } from "@/lib/plans";
import type { QuickStartData } from "@/lib/onboarding";
import type { Plan } from "@/types";

// ─── Step data ────────────────────────────────────────────────────────────────

const GOALS = [
  { key: "muscle_gain", label: "Muscle gain",    sub: "Build size and mass" },
  { key: "fat_loss",    label: "Fat loss",        sub: "Lean out, cut body fat" },
  { key: "strength",    label: "Strength",        sub: "Get stronger on the big lifts" },
  { key: "endurance",   label: "Endurance",       sub: "Cardio, aerobic capacity" },
  { key: "general",     label: "General fitness", sub: "Feel better, move better" },
  { key: "recomp",      label: "Body recomp",     sub: "Lose fat, gain muscle simultaneously" },
];

const EXPERIENCE = [
  { key: "beginner",     label: "Beginner",     sub: "< 1 year consistent training" },
  { key: "intermediate", label: "Intermediate", sub: "1–3 years" },
  { key: "advanced",     label: "Advanced",     sub: "3+ years" },
];

const DAYS = [2, 3, 4, 5, 6, 7];

const STRUGGLES = [
  "Consistency", "Nutrition", "Recovery", "Motivation",
  "Injuries",    "Time",      "Knowledge", "Plateau",
];

const EQUIPMENT_OPTIONS = [
  { key: "barbell",    label: "Barbell"          },
  { key: "dumbbell",   label: "Dumbbells"        },
  { key: "cables",     label: "Cables"           },
  { key: "machines",   label: "Machines"         },
  { key: "bodyweight", label: "Bodyweight only"  },
  { key: "bands",      label: "Resistance bands" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function QuickStartPage() {
  const router = useRouter();
  const { user } = useUser();

  const [step,       setStep]       = useState(0);
  const [goal,       setGoal]       = useState<string>("");
  const [experience, setExperience] = useState<string>("");
  const [days,       setDays]       = useState<number>(4);
  const [struggle,   setStruggle]   = useState<string>("");
  const [equipment,  setEquipment]  = useState<string[]>([]);
  const [completing, setCompleting] = useState(false);

  const TOTAL_STEPS = 5;
  const plan = user.plan as Plan;

  function toggleEquipment(key: string) {
    setEquipment((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  function canAdvance() {
    if (step === 0) return !!goal;
    if (step === 1) return !!experience;
    if (step === 2) return days >= 2;
    if (step === 3) return !!struggle;
    if (step === 4) return equipment.length > 0;
    return false;
  }

  async function handleNext() {
    if (step === 0) markOnboardingStarted(user.id);
    if (step < TOTAL_STEPS - 1) {
      setStep((s) => s + 1);
      return;
    }
    setCompleting(true);
    const data: QuickStartData = {
      primaryGoal:  goal,
      experience,
      daysPerWeek:  days,
      mainStruggle: struggle,
      equipment,
    };
    completeQuickStart(user.id, data);
    router.push("/dashboard");
  }

  function handleBack() {
    if (step > 0) setStep((s) => s - 1);
  }

  const upgradePrompt = step === TOTAL_STEPS - 1 && PLAN_HIERARCHY[plan] < 3;

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center px-4 py-12">
      {/* Progress */}
      <div className="w-full max-w-md mb-8">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/30">Quick Start</p>
          <p className="text-[10px] text-white/25">{step + 1} / {TOTAL_STEPS}</p>
        </div>
        <div className="h-0.5 bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#B48B40] rounded-full transition-all duration-500"
            style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
          />
        </div>
      </div>

      {/* Card */}
      <div className="w-full max-w-md rounded-2xl border border-white/[0.07] bg-[#111111] p-6">

        {/* Step 0: Primary goal */}
        {step === 0 && (
          <div>
            <p className="text-xs text-white/40 mb-1">Step 1</p>
            <h2 className="text-lg font-semibold text-white mb-1">What is your primary goal?</h2>
            <p className="text-xs text-white/35 mb-5">Pick the one that matters most right now.</p>
            <div className="grid grid-cols-2 gap-2">
              {GOALS.map((g) => (
                <button
                  key={g.key}
                  onClick={() => setGoal(g.key)}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-all",
                    goal === g.key
                      ? "border-[#B48B40]/50 bg-[#B48B40]/8"
                      : "border-white/[0.07] bg-white/[0.02] hover:border-white/12"
                  )}
                >
                  <p className={cn("text-xs font-medium", goal === g.key ? "text-white" : "text-white/65")}>
                    {g.label}
                  </p>
                  <p className="text-[10px] text-white/30 mt-0.5">{g.sub}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 1: Experience */}
        {step === 1 && (
          <div>
            <p className="text-xs text-white/40 mb-1">Step 2</p>
            <h2 className="text-lg font-semibold text-white mb-1">Training experience?</h2>
            <p className="text-xs text-white/35 mb-5">Honest assessment — this shapes your program structure.</p>
            <div className="space-y-2">
              {EXPERIENCE.map((e) => (
                <button
                  key={e.key}
                  onClick={() => setExperience(e.key)}
                  className={cn(
                    "w-full rounded-xl border p-3.5 text-left transition-all",
                    experience === e.key
                      ? "border-[#B48B40]/50 bg-[#B48B40]/8"
                      : "border-white/[0.07] bg-white/[0.02] hover:border-white/12"
                  )}
                >
                  <p className={cn("text-sm font-medium", experience === e.key ? "text-white" : "text-white/70")}>
                    {e.label}
                  </p>
                  <p className="text-[11px] text-white/30 mt-0.5">{e.sub}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Days per week */}
        {step === 2 && (
          <div>
            <p className="text-xs text-white/40 mb-1">Step 3</p>
            <h2 className="text-lg font-semibold text-white mb-1">Days per week?</h2>
            <p className="text-xs text-white/35 mb-5">How many days can you realistically train?</p>
            <div className="flex gap-2 flex-wrap">
              {DAYS.map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={cn(
                    "w-12 h-12 rounded-xl border text-sm font-semibold transition-all",
                    days === d
                      ? "border-[#B48B40]/50 bg-[#B48B40]/10 text-white"
                      : "border-white/[0.07] text-white/50 hover:border-white/12"
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Main struggle */}
        {step === 3 && (
          <div>
            <p className="text-xs text-white/40 mb-1">Step 4</p>
            <h2 className="text-lg font-semibold text-white mb-1">Biggest struggle?</h2>
            <p className="text-xs text-white/35 mb-5">What is the hardest part of staying on track?</p>
            <div className="flex flex-wrap gap-2">
              {STRUGGLES.map((s) => (
                <button
                  key={s}
                  onClick={() => setStruggle(s)}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all",
                    struggle === s
                      ? "border-[#B48B40]/50 bg-[#B48B40]/10 text-white"
                      : "border-white/[0.08] text-white/45 hover:border-white/15"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Equipment */}
        {step === 4 && (
          <div>
            <p className="text-xs text-white/40 mb-1">Step 5</p>
            <h2 className="text-lg font-semibold text-white mb-1">Available equipment?</h2>
            <p className="text-xs text-white/35 mb-5">Select all that apply.</p>
            <div className="flex flex-wrap gap-2">
              {EQUIPMENT_OPTIONS.map((eq) => {
                const selected = equipment.includes(eq.key);
                return (
                  <button
                    key={eq.key}
                    onClick={() => toggleEquipment(eq.key)}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all flex items-center gap-1.5",
                      selected
                        ? "border-[#B48B40]/50 bg-[#B48B40]/10 text-white"
                        : "border-white/[0.08] text-white/45 hover:border-white/15"
                    )}
                  >
                    {selected && <Check className="w-3 h-3 text-[#B48B40]" strokeWidth={2.5} />}
                    {eq.label}
                  </button>
                );
              })}
            </div>

            {/* Upgrade prompt */}
            {upgradePrompt && (
              <div className="mt-5 rounded-xl border border-[#B48B40]/20 bg-[#B48B40]/5 p-3.5">
                <p className="text-xs text-[#B48B40] font-medium mb-0.5">
                  {PLAN_HIERARCHY[plan] <= 1
                    ? "Unlock AI coaching"
                    : "Deep calibration unlocks weekly AI adjustments"}
                </p>
                <p className="text-[10px] text-white/35 leading-relaxed">
                  {PLAN_HIERARCHY[plan] <= 1
                    ? "Upgrade to Training or higher to get personalized adjustments from your AI coach."
                    : "Your Training plan includes weekly AI adjustments — complete deep calibration to dial it in."}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={handleBack}
            disabled={step === 0}
            className={cn(
              "flex items-center gap-1.5 text-xs text-white/40 transition-all",
              step === 0 ? "invisible" : "hover:text-white/65"
            )}
          >
            <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
            Back
          </button>

          <button
            onClick={handleNext}
            disabled={!canAdvance() || completing}
            className={cn(
              "flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-xs font-semibold transition-all",
              canAdvance() && !completing
                ? "bg-[#B48B40] text-black hover:bg-[#c99840]"
                : "bg-white/[0.05] text-white/25 cursor-not-allowed"
            )}
          >
            {completing ? "Starting..." : step === TOTAL_STEPS - 1 ? "Enter app" : "Continue"}
            {!completing && <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />}
          </button>
        </div>
      </div>

      <p className="text-[10px] text-white/18 mt-5">Takes about 2 minutes</p>
    </div>
  );
}
