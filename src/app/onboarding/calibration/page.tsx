"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowLeft, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { saveIntake, type IntakeData } from "@/lib/data/intake";
import { completeOnboarding } from "@/lib/onboarding";
import { generateStarterPlan, saveStarterPlan, starterPlanToBuilderPayload, starterPlanToProgram } from "@/lib/starterPlan";
import { saveActiveProgram } from "@/lib/workout";
import { DEMO_USERS } from "@/context/UserContext";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = "goal" | "experience" | "body" | "schedule" | "nutrition" | "recovery" | "equipment";

const STEPS: Step[] = ["goal", "experience", "body", "schedule", "nutrition", "recovery", "equipment"];

type OnboardingAnswers = {
  primaryGoal:   string;
  experience:    string;
  daysPerWeek:   number;
  sessionLength: string;
  dietStyle:     string[];
  mealsPerDay:   string;
  sleepHours:    string;
  energyLevel:   "" | "low" | "steady" | "high" | "variable";
  mainStruggle:  string[];
  // Injury deep-dive — only collected when "Injuries" is a main friction point.
  injuryAreas:   string[];
  injuryNote:    string;
  injuryCleared: "" | "yes" | "no";
  equipment:     string[];
  // Body stats — drive BMR / calorie & macro targets
  weight:        string;
  weightUnit:    "kg" | "lbs";
  height:        string;
  heightUnit:    "cm" | "ft";
  bodyFat:       string;             // optional — enables body-composition BMR
  age:           string;             // optional
  sex:           "" | "male" | "female"; // optional
  activityLevel: "" | "sedentary" | "light" | "moderate" | "very_active" | "athlete";
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

const ACTIVITY_OPTIONS: { value: OnboardingAnswers["activityLevel"]; label: string; sub: string }[] = [
  { value: "sedentary",   label: "Sedentary",        sub: "Desk job, mostly sitting"            },
  { value: "light",       label: "Lightly active",   sub: "On your feet some, light movement"   },
  { value: "moderate",    label: "Moderately active",sub: "Active job or regular daily movement" },
  { value: "very_active", label: "Very active",      sub: "Physical job or always on the move"  },
  { value: "athlete",     label: "Athlete",          sub: "Physical job + hard daily training"  },
];

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

const ENERGY_OPTIONS: { value: OnboardingAnswers["energyLevel"]; label: string; sub: string }[] = [
  { value: "low",      label: "Low",          sub: "Often drained / sluggish" },
  { value: "steady",   label: "Steady",       sub: "Consistent through the day" },
  { value: "high",     label: "High",         sub: "Energetic most of the time" },
  { value: "variable", label: "Up and down",  sub: "Swings / afternoon crashes" },
];

const INJURY_AREAS = ["Knee", "Shoulder", "Lower back", "Ankle / Achilles", "Hip", "Wrist / Elbow", "Neck", "Other"];

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

const LS_KEY = "flowstate-active-role";
const SS_KEY = "flowstate-session-role";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_EQUIPMENT = "Bodyweight only";

function readStoredUserId(): string {
  try {
    const key = sessionStorage.getItem(SS_KEY) || localStorage.getItem(LS_KEY) || "";
    if (DEMO_USERS[key as keyof typeof DEMO_USERS]) return DEMO_USERS[key as keyof typeof DEMO_USERS].id;
    if (key.startsWith("usr_") || UUID_RE.test(key)) return key;
  } catch { /* ignore */ }
  return "anonymous";
}

function rememberUserId(userId: string) {
  try {
    localStorage.setItem(LS_KEY, userId);
    sessionStorage.setItem(SS_KEY, userId);
  } catch { /* ignore */ }
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
    const { data: { user } } = await withTimeout(
      supabase.auth.getUser(),
      4_000,
      "Supabase user lookup",
    );
    if (user?.id) {
      rememberUserId(user.id);
      return user.id;
    }
  } catch (error) {
    console.warn("[calibration] user lookup skipped:", error);
  }

  return stored;
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
  energyLevel:   "",
  injuryAreas:   [],
  injuryNote:    "",
  injuryCleared: "",
  mainStruggle:  [],
  equipment:     [],
  weight:        "",
  weightUnit:    "kg",
  height:        "",
  heightUnit:    "cm",
  bodyFat:       "",
  age:           "",
  sex:           "",
  activityLevel: "",
};

export default function CalibrationPage() {
  const router = useRouter();
  const [step,     setStep]     = useState<Step>("goal");
  const [answers,  setAnswers]  = useState<OnboardingAnswers>(DEFAULT);
  const [fading,   setFading]   = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [prefilled, setPrefilled] = useState(false);

  const stepIndex   = STEPS.indexOf(step);
  const progressPct = ((stepIndex + 1) / STEPS.length) * 100;

  // Hydrate from anything a coach pre-filled (onboarding_state.raw_answers) so
  // the client confirms/edits instead of answering from scratch. Pre-filled
  // values do NOT auto-advance — the client still sees each step.
  useEffect(() => {
    let active = true;
    (async () => {
      const userId = await getActiveUserId();
      if (!UUID_RE.test(userId) || !process.env.NEXT_PUBLIC_SUPABASE_URL) return;
      try {
        const { getOnboardingState } = await import("@/lib/db/onboarding");
        const state = await getOnboardingState(userId);
        const raw = state?.raw_answers as Record<string, unknown> | null | undefined;
        if (!active || !raw) return;
        const asArr = (v: unknown): string[] | undefined =>
          Array.isArray(v) ? v.map(String)
          : typeof v === "string" && v.trim() ? v.split(/·|,/).map((s) => s.trim()).filter(Boolean)
          : undefined;
        setAnswers((a) => ({
          ...a,
          primaryGoal:   typeof raw.primaryGoal === "string" ? raw.primaryGoal : a.primaryGoal,
          experience:    typeof raw.experience === "string" ? raw.experience : a.experience,
          daysPerWeek:   typeof raw.daysPerWeek === "number" ? raw.daysPerWeek : a.daysPerWeek,
          sessionLength: typeof raw.sessionLength === "string" ? raw.sessionLength : a.sessionLength,
          mealsPerDay:   typeof raw.mealsPerDay === "string" ? raw.mealsPerDay : a.mealsPerDay,
          sleepHours:    typeof raw.sleepHours === "string" ? raw.sleepHours : a.sleepHours,
          energyLevel:   typeof raw.energyLevel === "string" ? (raw.energyLevel as OnboardingAnswers["energyLevel"]) : a.energyLevel,
          injuryAreas:   asArr(raw.injuryAreas) ?? a.injuryAreas,
          injuryNote:    typeof raw.injuryNote === "string" ? raw.injuryNote : a.injuryNote,
          injuryCleared: raw.injuryCleared === "yes" || raw.injuryCleared === "no" ? raw.injuryCleared : a.injuryCleared,
          dietStyle:     asArr(raw.dietStyle) ?? a.dietStyle,
          mainStruggle:  asArr(raw.mainStruggle) ?? a.mainStruggle,
          equipment:     asArr(raw.equipment) ?? a.equipment,
          weight:        typeof raw.weight === "string" ? raw.weight : a.weight,
          weightUnit:    raw.weightUnit === "lbs" || raw.weightUnit === "kg" ? raw.weightUnit : a.weightUnit,
          height:        typeof raw.height === "string" ? raw.height : a.height,
          heightUnit:    raw.heightUnit === "ft" || raw.heightUnit === "cm" ? raw.heightUnit : a.heightUnit,
          bodyFat:       typeof raw.bodyFat === "string" ? raw.bodyFat : a.bodyFat,
          age:           typeof raw.age === "string" ? raw.age : a.age,
          sex:           raw.sex === "male" || raw.sex === "female" ? raw.sex : a.sex,
          activityLevel: typeof raw.activityLevel === "string" ? raw.activityLevel as OnboardingAnswers["activityLevel"] : a.activityLevel,
        }));
        if (typeof raw.primaryGoal === "string" || typeof raw.experience === "string") setPrefilled(true);
      } catch { /* no pre-fill — start blank */ }
    })();
    return () => { active = false; };
  }, []);

  // Auto-advance is triggered directly from the option onClick (see pickAndAdvance)
  // so a single tap always moves on — even re-tapping the already-highlighted
  // option. (A value-change effect would ignore re-selecting the same answer.)
  function pickAndAdvance(patch: Partial<OnboardingAnswers>) {
    setAnswers((a) => ({ ...a, ...patch }));
    setTimeout(() => advance(), 200);
  }

  // Start every step at the top of the page, not where the last one scrolled.
  useEffect(() => {
    try { window.scrollTo({ top: 0, behavior: "auto" }); } catch { /* ignore */ }
  }, [step]);

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

  async function finishOnboarding() {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    try {
    const userId = await getActiveUserId();
    const equipment = answers.equipment.length > 0 ? answers.equipment : [DEFAULT_EQUIPMENT];

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
      weight:          answers.weight,
      weightUnit:      answers.weightUnit,
      height:          answers.height,
      heightUnit:      answers.heightUnit,
      bodyFat:         answers.bodyFat,
      waist:           "",
      age:             answers.age || undefined,
      sex:             answers.sex || undefined,
      activityLevel:   answers.activityLevel || undefined,
      sleepHours:      answers.sleepHours,
      energyLevel:     answers.energyLevel || undefined,
      injuryAreas:     answers.injuryAreas,
      injuryNote:      answers.injuryNote,
      injuryCleared:   answers.injuryCleared || undefined,
      sleepQuality:    0,
      stressLevel:     0,
      recoveryNote:    "",
      dietStyle:       answers.dietStyle,
      mealsPerDay:     answers.mealsPerDay,
      restrictions:    [],
      hydration:       "",
      injuries:        "",
      equipment,
      limitedDays:     [],
      coachNote:       "",
      completedAt:     new Date().toISOString(),
    };

    saveIntake(userId, intake);

    const starterPlan = generateStarterPlan(intake);
    saveStarterPlan(userId, starterPlan);
    saveActiveProgram(userId, starterPlanToProgram(starterPlan));

    if (UUID_RE.test(userId) && process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const payload = starterPlanToBuilderPayload(starterPlan);
      const apiResult = await withTimeout(
        fetch("/api/onboarding/starter-complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            payload,
            intake: intake as unknown as Record<string, unknown>,
          }),
        }),
        8_000,
        "starter setup sync",
      ).catch((error) => {
        console.warn("[calibration] server starter sync skipped:", error);
        return null;
      });

      if (!apiResult?.ok) {
        console.warn("[calibration] server starter save did not complete; continuing with local setup");
        const { markOnboardingComplete } = await import("@/lib/db/onboarding");
        void withTimeout(
          markOnboardingComplete(userId, intake as unknown as Record<string, unknown>),
          4_000,
          "onboarding fallback sync",
        ).catch((error) => {
          console.warn("[calibration] onboarding fallback sync skipped:", error);
        });
      }
    }

    completeOnboarding(userId, {
      primaryGoal:   answers.primaryGoal,
      experience:    answers.experience,
      daysPerWeek:   answers.daysPerWeek,
      equipment,
      mainStruggle:  answers.mainStruggle.join(" · "),
      sessionLength: answers.sessionLength,
      weight:        "",
      weightUnit:    "lbs",
      injuries:      "",
    });

    try { sessionStorage.setItem("flowstate-program-reveal", "starter"); } catch { /* ignore */ }
    try { sessionStorage.setItem("flowstate-calibration-finished", "true"); } catch { /* ignore */ }
    router.replace("/onboarding/tutorial");

    } catch (err) {
      console.error("[calibration] finish failed:", err);
      setSaveError("Something interrupted setup. Your answers are still here — try Build my plan again.");
      setSaving(false);
    }
  }

  const canAdvance = (): boolean => {
    if (step === "goal")       return !!answers.primaryGoal;
    if (step === "experience") return !!answers.experience;
    if (step === "body")       return parseFloat(answers.weight) > 0 && parseFloat(answers.height) > 0 && !!answers.activityLevel;
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
                  onClick={() => pickAndAdvance({ primaryGoal: opt.value })}
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
                  onClick={() => pickAndAdvance({ experience: opt.value })}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Body stats ────────────────────────────────────────────── */}
        {step === "body" && (
          <div className="space-y-7">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Your body stats</h1>
              <p className="text-sm text-white/38 mt-1.5">
                These set your BMR, calorie, and macro targets. Body fat, age, and sex are optional but make it more accurate.
              </p>
            </div>

            {/* Weight + Height */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-white/28 mb-2">Weight</p>
                <div className="flex gap-1.5">
                  <input
                    type="number" inputMode="decimal" min="0"
                    value={answers.weight}
                    onChange={(e) => setAnswers((a) => ({ ...a, weight: e.target.value }))}
                    placeholder="e.g. 80"
                    className="flex-1 w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-3 text-sm text-white/85 placeholder:text-white/20 outline-none focus:border-[#B48B40]/40 transition-colors"
                  />
                  <div className="flex rounded-xl border border-white/10 overflow-hidden shrink-0">
                    {(["kg", "lbs"] as const).map((u) => (
                      <button key={u}
                        onClick={() => setAnswers((a) => ({ ...a, weightUnit: u }))}
                        className={cn("px-2.5 text-xs font-semibold transition-colors",
                          answers.weightUnit === u ? "bg-[#B48B40]/15 text-[#B48B40]" : "text-white/35 hover:text-white/60")}
                      >{u}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-white/28 mb-2">Height</p>
                <div className="flex gap-1.5">
                  <input
                    type="number" inputMode="decimal" min="0"
                    value={answers.height}
                    onChange={(e) => setAnswers((a) => ({ ...a, height: e.target.value }))}
                    placeholder={answers.heightUnit === "cm" ? "e.g. 180" : "e.g. 5.11"}
                    className="flex-1 w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-3 text-sm text-white/85 placeholder:text-white/20 outline-none focus:border-[#B48B40]/40 transition-colors"
                  />
                  <div className="flex rounded-xl border border-white/10 overflow-hidden shrink-0">
                    {(["cm", "ft"] as const).map((u) => (
                      <button key={u}
                        onClick={() => setAnswers((a) => ({ ...a, heightUnit: u }))}
                        className={cn("px-2.5 text-xs font-semibold transition-colors",
                          answers.heightUnit === u ? "bg-[#B48B40]/15 text-[#B48B40]" : "text-white/35 hover:text-white/60")}
                      >{u}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Body fat + Age */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-white/28 mb-2">
                  Body fat % <span className="text-white/20 normal-case tracking-normal">· optional</span>
                </p>
                <input
                  type="number" inputMode="decimal" min="0" max="70"
                  value={answers.bodyFat}
                  onChange={(e) => setAnswers((a) => ({ ...a, bodyFat: e.target.value }))}
                  placeholder="e.g. 18"
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-3 text-sm text-white/85 placeholder:text-white/20 outline-none focus:border-[#B48B40]/40 transition-colors"
                />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-white/28 mb-2">
                  Age <span className="text-white/20 normal-case tracking-normal">· optional</span>
                </p>
                <input
                  type="number" inputMode="numeric" min="0" max="120"
                  value={answers.age}
                  onChange={(e) => setAnswers((a) => ({ ...a, age: e.target.value }))}
                  placeholder="e.g. 30"
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-3 text-sm text-white/85 placeholder:text-white/20 outline-none focus:border-[#B48B40]/40 transition-colors"
                />
              </div>
            </div>

            {/* Sex */}
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-white/28 mb-2">
                Sex <span className="text-white/20 normal-case tracking-normal">· optional, improves BMR accuracy</span>
              </p>
              <div className="flex gap-2">
                {([["male", "Male"], ["female", "Female"]] as const).map(([val, lbl]) => (
                  <ChipButton
                    key={val}
                    label={lbl}
                    active={answers.sex === val}
                    onClick={() => setAnswers((a) => ({ ...a, sex: a.sex === val ? "" : val }))}
                  />
                ))}
              </div>
            </div>

            {/* Daily activity level — drives calorie accuracy */}
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-white/28 mb-2">
                Daily activity level <span className="text-white/40 normal-case tracking-normal">· outside training</span>
              </p>
              <div className="space-y-2">
                {ACTIVITY_OPTIONS.map((opt) => (
                  <OptionCard
                    key={opt.value}
                    label={opt.label}
                    sub={opt.sub}
                    active={answers.activityLevel === opt.value}
                    onClick={() => setAnswers((a) => ({ ...a, activityLevel: opt.value }))}
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
	              <p className="text-xs uppercase tracking-[0.18em] text-white/28 mb-3">Daily energy levels</p>
	              <div className="grid grid-cols-2 gap-2">
	                {ENERGY_OPTIONS.map((opt) => (
	                  <OptionCard
	                    key={opt.value}
	                    label={opt.label}
	                    sub={opt.sub}
	                    active={answers.energyLevel === opt.value}
	                    onClick={() => setAnswers((a) => ({ ...a, energyLevel: a.energyLevel === opt.value ? "" : opt.value }))}
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

	            {answers.mainStruggle.includes("Injuries") && (
	              <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.04] p-4 space-y-4">
	                <div>
	                  <p className="text-sm font-semibold text-amber-300/90">Tell us about the injury</p>
	                  <p className="text-[11px] text-white/40 mt-0.5">So your coach trains around it safely — never through it.</p>
	                </div>
	                <div>
	                  <p className="text-xs uppercase tracking-[0.18em] text-white/28 mb-2">Area(s) affected</p>
	                  <div className="flex flex-wrap gap-2">
	                    {INJURY_AREAS.map((area) => (
	                      <ChipButton key={area} label={area} active={answers.injuryAreas.includes(area)} onClick={() => setAnswers((p) => ({ ...p, injuryAreas: toggle(p.injuryAreas, area) }))} />
	                    ))}
	                  </div>
	                </div>
	                <textarea
	                  value={answers.injuryNote}
	                  onChange={(e) => setAnswers((p) => ({ ...p, injuryNote: e.target.value }))}
	                  rows={3}
	                  placeholder="What happened, what movements aggravate it, and anything that feels off — e.g. 'torn Achilles, can't bear weight, walking hurts' or 'sharp knee pain on squats'."
	                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/85 placeholder:text-white/25 outline-none focus:border-[#B48B40]/50 resize-none"
	                />
	                <div>
	                  <p className="text-xs uppercase tracking-[0.18em] text-white/28 mb-2">Cleared to train by a doctor / physio?</p>
	                  <div className="flex gap-2">
	                    {([{ v: "yes", l: "Yes, cleared" }, { v: "no", l: "Not sure / No" }] as const).map((o) => (
	                      <ChipButton key={o.v} label={o.l} active={answers.injuryCleared === o.v} onClick={() => setAnswers((p) => ({ ...p, injuryCleared: p.injuryCleared === o.v ? "" : o.v }))} />
	                    ))}
	                  </div>
	                </div>
	              </div>
	            )}

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
