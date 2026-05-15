"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowLeft, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { saveIntake, type IntakeData } from "@/lib/data/intake";
import { completeOnboarding } from "@/lib/onboarding";
import { generateStarterPlan, saveStarterPlan } from "@/lib/starterPlan";
import { DEMO_USERS } from "@/context/UserContext";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = "goal" | "experience" | "schedule" | "nutrition" | "recovery" | "equipment";

const STEPS: Step[] = ["goal", "experience", "schedule", "nutrition", "recovery", "equipment"];

type OnboardingAnswers = {
  primaryGoal:   string;
  experience:    string;
  daysPerWeek:   number;
  sessionLength: string;
  dietStyle:     string[];
  mealsPerDay:   string;
  sleepHours:    string;
  mainStruggle:  string[];
  equipment:     string[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const GOAL_OPTIONS: { value: string; label: string; sub: string }[] = [
  { value: "muscle_gain", label: "Build muscle",     sub: "Size and strength"         },
  { value: "fat_loss",    label: "Lose fat",          sub: "Lean out, stay strong"    },
  { value: "strength",    label: "Get stronger",      sub: "Lift more, build power"   },
  { value: "endurance",   label: "Build endurance",   sub: "Cardio capacity"          },
  { value: "recomp",      label: "Body recomp",       sub: "Lose fat, gain muscle"    },
  { value: "general",     label: "General fitness",   sub: "Health and consistency"   },
];

const EXPERIENCE_OPTIONS: { value: string; label: string; sub: string }[] = [
  { value: "beginner",     label: "Just starting out",  sub: "Less than 1 year"         },
  { value: "intermediate", label: "Some experience",    sub: "1–3 years, know the basics" },
  { value: "advanced",     label: "Experienced",        sub: "3+ years of consistent training" },
];

const DAYS_OPTIONS = [2, 3, 4, 5, 6];

const SESSION_OPTIONS: { value: string; label: string }[] = [
  { value: "30",  label: "30 min" },
  { value: "45",  label: "45 min" },
  { value: "60",  label: "60 min" },
  { value: "75",  label: "75 min" },
  { value: "90+", label: "90+ min" },
];

const DIET_OPTIONS: { value: string; label: string }[] = [
  { value: "balanced",            label: "Balanced" },
  { value: "high_protein",        label: "High protein" },
  { value: "plant_based",         label: "Plant-based" },
  { value: "vegetarian",          label: "Vegetarian" },
  { value: "pescatarian",         label: "Pescatarian" },
  { value: "lower_carb",          label: "Lower carb" },
  { value: "keto",                label: "Keto" },
  { value: "mediterranean",       label: "Mediterranean" },
  { value: "intermittent_fasting", label: "Intermittent fasting" },
  { value: "flexible",            label: "Flexible" },
];

const MEAL_OPTIONS: { value: string; label: string }[] = [
  { value: "2", label: "2 meals" },
  { value: "3", label: "3 meals" },
  { value: "4", label: "4 meals" },
  { value: "5+", label: "5+ meals" },
];

const SLEEP_OPTIONS: { value: string; label: string }[] = [
  { value: "5 or less", label: "5 or less" },
  { value: "6",         label: "6 hours" },
  { value: "7",         label: "7 hours" },
  { value: "8",         label: "8 hours" },
  { value: "9+",        label: "9+" },
];

const STRUGGLE_OPTIONS: { value: string; label: string }[] = [
  { value: "Consistency", label: "Consistency" },
  { value: "Nutrition",   label: "Nutrition" },
  { value: "Recovery",    label: "Recovery" },
  { value: "Time",        label: "Time" },
  { value: "Injuries",    label: "Injuries" },
  { value: "Plateau",     label: "Plateau" },
];

const EQUIPMENT_OPTIONS: { value: string; label: string }[] = [
  { value: "Full gym",          label: "Full gym"         },
  { value: "Home gym",          label: "Home gym"         },
  { value: "Dumbbells only",    label: "Dumbbells only"   },
  { value: "Barbells",          label: "Barbells"         },
  { value: "Resistance bands",  label: "Resistance bands" },
  { value: "Bodyweight only",   label: "Bodyweight only"  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getActiveUserId(): string {
  try {
    const key = sessionStorage.getItem("flowstate-session-role") || localStorage.getItem("flowstate-active-role") || "";
    if (DEMO_USERS[key as keyof typeof DEMO_USERS]) return DEMO_USERS[key as keyof typeof DEMO_USERS].id;
    if (key) return key; // real UUID or usr_ id
  } catch { /* ignore */ }
  return "anonymous";
}

function toggle(arr: string[], item: string): string[] {
  return arr.includes(item) ? arr.filter((v) => v !== item) : [...arr, item];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function OptionCard({
  label, sub, active, onClick,
}: { label: string; sub?: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full rounded-2xl border px-4 py-3.5 text-left transition-all",
        active
          ? "border-[#B48B40]/50 bg-[#B48B40]/8"
          : "border-white/8 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.035]",
      )}
    >
      <p className={cn("text-sm font-semibold", active ? "text-[#B48B40]" : "text-white/80")}>
        {label}
      </p>
      {sub && <p className="text-[11px] text-white/30 mt-0.5">{sub}</p>}
    </button>
  );
}

function ChipButton({
  label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-xl border px-4 py-2.5 text-sm font-medium transition-all",
        active
          ? "border-[#B48B40]/40 bg-[#B48B40]/10 text-[#B48B40]"
          : "border-white/8 bg-white/[0.02] text-white/45 hover:text-white/70 hover:border-white/15",
      )}
    >
      {label}
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const DEFAULT: OnboardingAnswers = {
  primaryGoal:   "",
  experience:    "",
  daysPerWeek:   3,
  sessionLength: "60",
  dietStyle:     ["balanced"],
  mealsPerDay:   "3",
  sleepHours:    "7",
  mainStruggle:  [],
  equipment:     [],
};

export default function CalibrationPage() {
  const router = useRouter();
  const [step,     setStep]     = useState<Step>("goal");
  const [answers,  setAnswers]  = useState<OnboardingAnswers>(DEFAULT);
  const [fading,   setFading]   = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const stepIndex   = STEPS.indexOf(step);
  const progressPct = ((stepIndex + 1) / STEPS.length) * 100;

  // Auto-advance on single-select steps when an option is chosen
  useEffect(() => {
    if (step === "goal" && answers.primaryGoal) {
      setTimeout(() => advance(), 200);
    }
    if (step === "experience" && answers.experience) {
      setTimeout(() => advance(), 200);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers.primaryGoal, answers.experience]);

  function navigate(target: Step) {
    setFading(true);
    setTimeout(() => { setStep(target); setFading(false); }, 160);
  }

  function advance() {
    const next = STEPS[stepIndex + 1];
    if (next) navigate(next);
    else finishOnboarding();
  }

  function goBack() {
    const prev = STEPS[stepIndex - 1];
    if (prev) navigate(prev);
  }

  function finishOnboarding() {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    try {
    const userId = getActiveUserId();

    // Minimal intake object for storage — empty fields are fine
    const intake: IntakeData = {
      primaryGoal:     answers.primaryGoal,
      secondaryGoal:   "",
      timeframe:       "",
      experience:      answers.experience,
      trainingStyle:   [],
      daysPerWeek:     answers.daysPerWeek,
      sessionLength:   answers.sessionLength,
      preferredTime:   "",
      availableDays:   [],
      mainStruggle:    answers.mainStruggle.join(" · "),
      confidenceLevel: 0,
      weight:          "",
      weightUnit:      "kg",
      height:          "",
      heightUnit:      "cm",
      bodyFat:         "",
      waist:           "",
      sleepHours:      answers.sleepHours,
      sleepQuality:    0,
      stressLevel:     0,
      recoveryNote:    "",
      dietStyle:       answers.dietStyle,
      mealsPerDay:     answers.mealsPerDay,
      restrictions:    [],
      hydration:       "",
      injuries:        "",
      equipment:       answers.equipment,
      limitedDays:     [],
      coachNote:       "",
      completedAt:     new Date().toISOString(),
    };

    saveIntake(userId, intake);

    // Mark ALL onboarding steps as complete so AppShell clears every gate
    completeOnboarding(userId, {
      primaryGoal:   answers.primaryGoal,
	      experience:    answers.experience,
	      daysPerWeek:   answers.daysPerWeek,
	      equipment:     answers.equipment,
	      mainStruggle:  answers.mainStruggle.join(" · "),
      sessionLength: answers.sessionLength,
      weight:        "",
      weightUnit:    "lbs",
      injuries:      "",
    });

    // Generate and persist starter plan (localStorage for quick UI access)
    const plan = generateStarterPlan(intake);
    saveStarterPlan(userId, plan);

    // Invite-link signups are required to go through deep calibration before
    // the tutorial — they were personally invited, so the bar for data quality
    // is higher. Self-signups skip straight to the tutorial; they can opt into
    // deep cal later from the dashboard / program page.
    let viaInvite = false;
    try { viaInvite = localStorage.getItem("flowstate-via-invite") === "true"; } catch { /* ignore */ }
    const nextRoute = viaInvite ? "/onboarding/deep-calibration" : "/onboarding/tutorial";

    const fallback = window.setTimeout(() => {
      window.location.assign(nextRoute);
    }, 900);
    router.replace(nextRoute);

    // Fire DB writes in the background — never block the user on network.
    // The plan + intake are already in localStorage, so /dashboard renders
    // immediately. If a write fails, the user can still navigate.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (UUID_RE.test(userId) && process.env.NEXT_PUBLIC_SUPABASE_URL) {
      void (async () => {
        try {
          const { markOnboardingComplete } = await import("@/lib/db/onboarding");
          const { syncGeneratedProgram }   = await import("@/lib/db/programs");
          const { starterPlanToProgram }   = await import("@/lib/starterPlan");
          await markOnboardingComplete(userId, intake as unknown as Record<string, unknown>);
          await syncGeneratedProgram(userId, starterPlanToProgram(plan));
        } catch (err) {
          console.error("[calibration] background sync failed:", err);
        } finally {
          window.clearTimeout(fallback);
        }
      })();
    }

    } catch (err) {
      console.error("[calibration] finish failed:", err);
      setSaveError("Something interrupted setup. Your answers are still here — try Build my plan again.");
      setSaving(false);
    }
  }

  const canAdvance = (): boolean => {
    if (step === "goal")       return !!answers.primaryGoal;
    if (step === "experience") return !!answers.experience;
    if (step === "schedule")   return answers.daysPerWeek > 0 && !!answers.sessionLength;
    if (step === "nutrition")  return answers.dietStyle.length > 0 && !!answers.mealsPerDay;
    if (step === "recovery")   return !!answers.sleepHours && answers.mainStruggle.length > 0;
    if (step === "equipment")  return true; // optional
    return true;
  };

  return (
    <div className="min-h-screen text-white flex flex-col">

      {/* Progress bar */}
      <div className="h-0.5 bg-white/5 shrink-0">
        <div
          className="h-full bg-[#B48B40] transition-all duration-400"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Header */}
      <div className="px-5 pt-5 pb-2 shrink-0 max-w-lg mx-auto w-full flex items-center justify-between">
        <button
          onClick={goBack}
          className={cn(
            "flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors",
            stepIndex === 0 && "invisible",
          )}
        >
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} />
          Back
        </button>
        <div className="flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-[#B48B40]" strokeWidth={2.5} />
          <span className="text-[10px] uppercase tracking-[0.3em] text-white/22">
            {stepIndex + 1} of {STEPS.length}
          </span>
        </div>
      </div>

      {/* Content */}
      <div
        className={cn(
          "flex-1 px-5 pb-10 pt-8 max-w-lg mx-auto w-full transition-all duration-160",
          fading ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0",
        )}
      >

        {/* ── Goal ──────────────────────────────────────────────────── */}
        {step === "goal" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">What's your main goal?</h1>
              <p className="text-sm text-white/38 mt-1.5">
                This shapes your plan structure, intensity, and how the AI coaches you.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {GOAL_OPTIONS.map((opt) => (
                <OptionCard
                  key={opt.value}
                  label={opt.label}
                  sub={opt.sub}
                  active={answers.primaryGoal === opt.value}
                  onClick={() => setAnswers((a) => ({ ...a, primaryGoal: opt.value }))}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Experience ────────────────────────────────────────────── */}
        {step === "experience" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Training experience?</h1>
              <p className="text-sm text-white/38 mt-1.5">
                Determines program complexity, volume, and progression speed.
              </p>
            </div>
            <div className="space-y-2">
              {EXPERIENCE_OPTIONS.map((opt) => (
                <OptionCard
                  key={opt.value}
                  label={opt.label}
                  sub={opt.sub}
                  active={answers.experience === opt.value}
                  onClick={() => setAnswers((a) => ({ ...a, experience: opt.value }))}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Schedule ──────────────────────────────────────────────── */}
        {step === "schedule" && (
          <div className="space-y-7">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">How much time do you have?</h1>
              <p className="text-sm text-white/38 mt-1.5">
                We'll build around what's realistic, not an ideal scenario.
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-white/28 mb-3">Days per week</p>
              <div className="flex gap-2">
                {DAYS_OPTIONS.map((d) => (
                  <button
                    key={d}
                    onClick={() => setAnswers((a) => ({ ...a, daysPerWeek: d }))}
                    className={cn(
                      "flex-1 py-3 rounded-xl border text-sm font-semibold transition-all",
                      answers.daysPerWeek === d
                        ? "border-[#B48B40]/40 bg-[#B48B40]/10 text-[#B48B40]"
                        : "border-white/8 bg-white/[0.02] text-white/40 hover:text-white/65 hover:border-white/15",
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-white/28 mb-3">Session length</p>
              <div className="flex flex-wrap gap-2">
                {SESSION_OPTIONS.map((opt) => (
                  <ChipButton
                    key={opt.value}
                    label={opt.label}
                    active={answers.sessionLength === opt.value}
                    onClick={() => setAnswers((a) => ({ ...a, sessionLength: opt.value }))}
                  />
                ))}
              </div>
            </div>

            <button
              onClick={advance}
              disabled={!canAdvance()}
              className={cn(
                "w-full rounded-2xl py-4 text-sm font-semibold tracking-wide flex items-center justify-center gap-2 transition-all mt-2",
                canAdvance()
                  ? "bg-[#B48B40] text-black hover:bg-[#c99840] active:scale-[0.98]"
                  : "bg-white/5 text-white/25 cursor-default",
              )}
            >
              Continue
              <ArrowRight className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
	        )}

	        {/* ── Nutrition ─────────────────────────────────────────────── */}
	        {step === "nutrition" && (
	          <div className="space-y-7">
	            <div>
	              <h1 className="text-2xl font-semibold tracking-tight">How do you usually eat?</h1>
	              <p className="text-sm text-white/38 mt-1.5">
	                This sets realistic calorie, protein, and meal targets for the nutrition tracker.
	              </p>
	            </div>

	            <div>
	              <p className="text-xs uppercase tracking-[0.18em] text-white/28 mb-3">Eating style</p>
	              <div className="flex flex-wrap gap-2">
	                {DIET_OPTIONS.map((opt) => (
	                  <ChipButton
	                    key={opt.value}
	                    label={opt.label}
	                    active={answers.dietStyle.includes(opt.value)}
	                    onClick={() => setAnswers((a) => ({
	                      ...a,
	                      dietStyle: toggle(a.dietStyle, opt.value),
	                    }))}
	                  />
	                ))}
	              </div>
	            </div>

	            <div>
	              <p className="text-xs uppercase tracking-[0.18em] text-white/28 mb-3">Meals per day</p>
	              <div className="flex flex-wrap gap-2">
	                {MEAL_OPTIONS.map((opt) => (
	                  <ChipButton
	                    key={opt.value}
	                    label={opt.label}
	                    active={answers.mealsPerDay === opt.value}
	                    onClick={() => setAnswers((a) => ({ ...a, mealsPerDay: opt.value }))}
	                  />
	                ))}
	              </div>
	            </div>

	            <button
	              onClick={advance}
	              disabled={!canAdvance()}
	              className={cn(
	                "w-full rounded-2xl py-4 text-sm font-semibold tracking-wide flex items-center justify-center gap-2 transition-all mt-2",
	                canAdvance()
	                  ? "bg-[#B48B40] text-black hover:bg-[#c99840] active:scale-[0.98]"
	                  : "bg-white/5 text-white/25 cursor-default",
	              )}
	            >
	              Continue
	              <ArrowRight className="w-4 h-4" strokeWidth={2} />
	            </button>
	          </div>
	        )}

	        {/* ── Recovery ──────────────────────────────────────────────── */}
	        {step === "recovery" && (
	          <div className="space-y-7">
	            <div>
	              <h1 className="text-2xl font-semibold tracking-tight">What should the AI watch for?</h1>
	              <p className="text-sm text-white/38 mt-1.5">
	                Recovery and friction points shape training volume, coaching tone, and accountability nudges.
	              </p>
	            </div>

	            <div>
	              <p className="text-xs uppercase tracking-[0.18em] text-white/28 mb-3">Typical sleep</p>
	              <div className="flex flex-wrap gap-2">
	                {SLEEP_OPTIONS.map((opt) => (
	                  <ChipButton
	                    key={opt.value}
	                    label={opt.label}
	                    active={answers.sleepHours === opt.value}
	                    onClick={() => setAnswers((a) => ({ ...a, sleepHours: opt.value }))}
	                  />
	                ))}
	              </div>
	            </div>

	            <div>
	              <div className="flex items-baseline justify-between mb-3">
	                <p className="text-xs uppercase tracking-[0.18em] text-white/28">Main friction points</p>
	                <p className="text-[10px] text-white/30">Pick up to 3</p>
	              </div>
	              <div className="grid grid-cols-2 gap-2">
	                {STRUGGLE_OPTIONS.map((opt) => {
	                  const active = answers.mainStruggle.includes(opt.value);
	                  const atCap  = answers.mainStruggle.length >= 3 && !active;
	                  return (
	                    <OptionCard
	                      key={opt.value}
	                      label={opt.label}
	                      active={active}
	                      onClick={() => {
	                        if (atCap) return;
	                        setAnswers((a) => ({ ...a, mainStruggle: toggle(a.mainStruggle, opt.value) }));
	                      }}
	                    />
	                  );
	                })}
	              </div>
	            </div>

	            <button
	              onClick={advance}
	              disabled={!canAdvance()}
	              className={cn(
	                "w-full rounded-2xl py-4 text-sm font-semibold tracking-wide flex items-center justify-center gap-2 transition-all mt-2",
	                canAdvance()
	                  ? "bg-[#B48B40] text-black hover:bg-[#c99840] active:scale-[0.98]"
	                  : "bg-white/5 text-white/25 cursor-default",
	              )}
	            >
	              Continue
	              <ArrowRight className="w-4 h-4" strokeWidth={2} />
	            </button>
	          </div>
	        )}

	        {/* ── Equipment ─────────────────────────────────────────────── */}
	        {step === "equipment" && (
	          <div className="space-y-7">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">What equipment do you have?</h1>
              <p className="text-sm text-white/38 mt-1.5">
                Your plan will only use what's available to you.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {EQUIPMENT_OPTIONS.map((opt) => (
                <ChipButton
                  key={opt.value}
                  label={opt.label}
                  active={answers.equipment.includes(opt.value)}
                  onClick={() => setAnswers((a) => ({
                    ...a,
                    equipment: toggle(a.equipment, opt.value),
                  }))}
                />
              ))}
            </div>

	            <button
	              onClick={finishOnboarding}
	              disabled={saving}
	              className={cn(
	                "w-full rounded-2xl py-4 text-sm font-semibold tracking-wide flex items-center justify-center gap-2 transition-all",
	                saving
	                  ? "bg-white/5 text-white/25 cursor-default"
	                  : "bg-[#B48B40] text-black hover:bg-[#c99840] active:scale-[0.98]",
	              )}
	            >
	              {saving ? "Building..." : "Build my plan"}
	              <ArrowRight className="w-4 h-4" strokeWidth={2} />
	            </button>
              {saveError && (
                <p className="text-xs text-red-400/70 leading-relaxed">{saveError}</p>
              )}

	            <button
	              onClick={finishOnboarding}
	              disabled={saving}
	              className="w-full text-center text-xs text-white/22 hover:text-white/40 transition-colors py-1"
	            >
              Skip — I'll set this up later
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
