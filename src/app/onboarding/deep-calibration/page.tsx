"use client";

// Phase 2 deep onboarding. Runs AFTER the lead is in the app for a session
// or two — collects the 27 questions that turn a generic starter plan into
// a personalized program. Saved to onboarding_state.raw_answers.deep so the
// existing intake structure stays intact.
//
// Five chunks (A–E) on one page with step navigation. Answers are flushed
// to localStorage on every navigation and synced to Supabase on completion.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/context/UserContext";
import { saveOnboardingState, loadOnboardingState } from "@/lib/onboarding";
import { saveBuilderWorkoutForSelf, type BuilderProgramPayload } from "@/lib/db/programs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Map deep-cal training years → experience bucket the AI endpoint expects
function deriveExperience(trainingYears: string): "beginner" | "intermediate" | "advanced" {
  const n = parseInt(trainingYears) || 0;
  if (n < 1) return "beginner";
  if (n < 4) return "intermediate";
  return "advanced";
}

// Map deep-cal day strings ("Mon", "Wed"…) → day-of-week ints. Used only for AI hints.
function daysCount(days: string[]): number {
  return Math.max(1, Math.min(7, days.length));
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Units = "metric" | "imperial";

type DeepCalAnswers = {
  // Units (controls how height/weight are entered)
  units:            Units;

  // Chunk A — Body & history
  heightCm:         string;        // canonical storage; lbs/in/ft are derived for display
  weightKg:         string;
  goalWeightKg:     string;
  goalTimeframe:    string;        // "30 days" | "90 days" | "6 months" | "1 year"
  bodyFatPct:       number | null; // null = "skip / don't know"
  trainingYears:    string;
  longestStreak:    string;        // open text
  bestLift:         string;        // open text — strength PRs
  bestPhysique:     string;        // open text — best physique state
  injuries:         string[];
  injuryDetails:    string;
  medications:      string;        // optional — meds affecting training
  medicalConditions:string;        // optional — conditions to flag

  // Chunk B — Goal elaboration
  goalWhy:          string;
  successIn90Days:  string;
  triedNotWorked:   string;
  motivationStyle:  string;        // "external" | "internal" | "mixed"

  // Chunk C — Lifestyle
  preferredTime:    string;
  availableDays:    string[];
  travelFrequency:  string;
  bedTime:          string;
  wakeTime:         string;
  stressLevel:      number;
  caffeinePattern:  string;        // open or scale-like text
  alcoholPattern:   string;        // open or scale-like text

  // Chunk D — Nutrition specifics
  cookingAbility:   string;
  foodsHate:        string;
  foodsAnchor:      string;
  eatingStart:      string;
  eatingEnd:        string;
  cheatStyle:       string;
  supplements:      string;
  hydrationL:       string;

  // Chunk E — Coach calibration
  coachTone:        string;
  profanity:        string;
  pushLevel:        number;
};

const DEFAULTS: DeepCalAnswers = {
  units: "metric",
  heightCm: "", weightKg: "", goalWeightKg: "", goalTimeframe: "",
  bodyFatPct: null, trainingYears: "", longestStreak: "", bestLift: "", bestPhysique: "",
  injuries: [], injuryDetails: "", medications: "", medicalConditions: "",
  goalWhy: "", successIn90Days: "", triedNotWorked: "", motivationStyle: "mixed",
  preferredTime: "morning", availableDays: ["Mon", "Wed", "Fri"],
  travelFrequency: "rare", bedTime: "22:30", wakeTime: "06:30", stressLevel: 5,
  caffeinePattern: "", alcoholPattern: "",
  cookingAbility: "basic", foodsHate: "", foodsAnchor: "",
  eatingStart: "08:00", eatingEnd: "20:00", cheatStyle: "macros",
  supplements: "", hydrationL: "",
  coachTone: "direct", profanity: "off", pushLevel: 6,
};

// Unit conversion helpers — canonical storage stays metric.
function kgToLbs(kg: number) { return Math.round(kg * 2.20462 * 10) / 10; }
function lbsToKg(lbs: number) { return Math.round(lbs / 2.20462 * 10) / 10; }
function cmToFeetInches(cm: number) {
  const totalIn = cm / 2.54;
  const ft = Math.floor(totalIn / 12);
  const inches = Math.round(totalIn - ft * 12);
  return { ft, inches };
}
function feetInchesToCm(ft: number, inches: number) {
  return Math.round(((ft * 12) + inches) * 2.54);
}

const STEPS = ["body", "goal", "lifestyle", "nutrition", "coach"] as const;
type Step = typeof STEPS[number];

const STEP_LABELS: Record<Step, string> = {
  body:      "Let's start with you",
  goal:      "What you actually want",
  lifestyle: "How your week runs",
  nutrition: "How you eat",
  coach:     "How I should talk to you",
};

const STEP_INTROS: Record<Step, string> = {
  body:      "I need a real picture of where you're starting from. Be honest — vague answers mean vague programs.",
  goal:      "Tell me what you're actually chasing, not what sounds impressive. The why drives the how.",
  lifestyle: "Your program has to fit your real life, not the one you wish you had.",
  nutrition: "Nutrition's where most plans fall apart. Let's design around what you actually eat.",
  coach:     "Last bit — how do you want me to show up in the app?",
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const COMMON_INJURIES = ["Shoulder", "Lower back", "Knee", "Hip", "Elbow", "Wrist", "Neck", "Ankle"] as const;

const DRAFT_KEY = (userId: string) => `flowstate-deepcal-draft-${userId}`;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DeepCalibrationPage() {
  const router = useRouter();
  const { user } = useUser();
  const userId = user?.id ?? "";

  const [stepIdx, setStepIdx] = useState(0);
  const [answers, setAnswers] = useState<DeepCalAnswers>(DEFAULTS);
  const [saving,  setSaving]  = useState(false);
  const [finishStatus, setFinishStatus] = useState<string>("");

  // Restore in-progress draft
  useEffect(() => {
    if (!userId) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY(userId));
      if (raw) setAnswers({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch { /* ignore */ }
  }, [userId]);

  // Auto-save draft on every change
  useEffect(() => {
    if (!userId) return;
    try { localStorage.setItem(DRAFT_KEY(userId), JSON.stringify(answers)); } catch { /* ignore */ }
  }, [userId, answers]);

  const step = STEPS[stepIdx];
  const isLast = stepIdx === STEPS.length - 1;

  // Gating: can the user advance from the current chunk?
  const canAdvance = useMemo(() => {
    if (step !== "body") return true;
    // Macros + program intensity need at least height + weight to be useful
    const hasHeight = parseFloat(answers.heightCm) > 0;
    const hasWeight = parseFloat(answers.weightKg) > 0;
    return hasHeight && hasWeight;
  }, [step, answers.heightCm, answers.weightKg]);

  function update<K extends keyof DeepCalAnswers>(key: K, value: DeepCalAnswers[K]) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  function toggleInjury(area: string) {
    setAnswers((prev) => ({
      ...prev,
      injuries: prev.injuries.includes(area)
        ? prev.injuries.filter((i) => i !== area)
        : [...prev.injuries, area],
    }));
  }

  function toggleDay(day: string) {
    setAnswers((prev) => ({
      ...prev,
      availableDays: prev.availableDays.includes(day)
        ? prev.availableDays.filter((d) => d !== day)
        : [...prev.availableDays, day],
    }));
  }

  async function finish() {
    if (saving) return;
    setSaving(true);
    setFinishStatus("Saving your answers…");

    // Merge deep cal answers into onboarding state. The existing pattern saves
    // intake data under `intakeData`; we tuck the deep cal under a `deep` key
    // so the original intake stays accessible.
    const existing = loadOnboardingState(userId);
    saveOnboardingState(userId, {
      hasCompletedDeepCal: true,
      intakeData: { ...existing.intakeData, deep: answers } as typeof existing.intakeData,
    });

    try { localStorage.removeItem(DRAFT_KEY(userId)); } catch { /* ignore */ }

    // Regenerate the active program from the richer deep-cal data.
    // Only run for real (UUID) users — demo users have no Supabase row.
    if (UUID_RE.test(userId)) {
      setFinishStatus("Generating your personalized program…");
      try {
        const primaryGoal = (existing.intakeData?.primaryGoal ?? "hypertrophy") as string;
        const res = await fetch("/api/ai/program-generator", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            goal:           primaryGoal,
            weeks:          4,
            daysPerWeek:    daysCount(answers.availableDays),
            sessionMinutes: 60,
            experience:     deriveExperience(answers.trainingYears),
            equipment:      [],          // not asked in deep cal — defer to AI default
            bodyFocus:      [],
            injuries:       answers.injuries.map((s) => s.toLowerCase().replace(/\s+/g, "_")),
            style:          [answers.goalWhy, answers.triedNotWorked, answers.successIn90Days]
              .filter(Boolean).join(" | ") || null,
            athlete:        answers as unknown as Record<string, unknown>,
          }),
        });
        const data = await res.json() as { payload?: BuilderProgramPayload; error?: string };
        if (res.ok && data.payload) {
          await saveBuilderWorkoutForSelf(userId, data.payload, true);
        } else {
          console.warn("[deep-cal] AI program gen failed:", data.error);
          // fall through — user can regenerate later from /program/generate
        }
      } catch (e) {
        console.warn("[deep-cal] AI program gen errored:", e);
      }
    }

    setSaving(false);
    router.replace("/program");
  }

  const progress = useMemo(() => ((stepIdx + 1) / STEPS.length) * 100, [stepIdx]);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col">

      {/* Progress bar */}
      <div className="h-1 bg-white/5 shrink-0">
        <div className="h-full bg-[#B48B40] transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>

      <div className="max-w-xl mx-auto w-full px-5 py-8 flex-1">

        <div className="mb-8">
          <p className="text-[10px] uppercase tracking-[0.22em] text-[#B48B40]/70 mb-1.5">
            Deep calibration · {stepIdx + 1} of {STEPS.length}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight leading-tight">{STEP_LABELS[step]}</h1>
          <p className="text-sm text-white/45 mt-3 leading-relaxed">
            {STEP_INTROS[step]}
          </p>
        </div>

        {/* ── Chunk A — Body & history ──────────────────────────────────── */}
        {step === "body" && (
          <div className="space-y-8">
            <UnitToggle value={answers.units} onChange={(v) => update("units", v)} />

            <Question
              prompt="How tall are you, and what do you weigh right now?"
              coach="Honest numbers only — I'd rather start from where you actually are than where you'd like to be."
            >
              <Grid2>
                <HeightInput units={answers.units} valueCm={answers.heightCm} onChange={(cm) => update("heightCm", cm)} />
                <WeightInput units={answers.units} valueKg={answers.weightKg} onChange={(kg) => update("weightKg", kg)} label="Current weight" />
              </Grid2>
            </Question>

            <Question
              prompt="Where are you trying to land?"
              coach="Pick a weight that's realistic and a timeframe that doesn't require you to suffer for it."
            >
              <Grid2>
                <WeightInput units={answers.units} valueKg={answers.goalWeightKg} onChange={(kg) => update("goalWeightKg", kg)} label="Goal weight" />
                <Choice label="By when" value={answers.goalTimeframe} onChange={(v) => update("goalTimeframe", v)}
                  options={[{ v: "30d", l: "30 days" }, { v: "90d", l: "90 days" }, { v: "6mo", l: "6 months" }, { v: "1y", l: "1 year" }]} />
              </Grid2>
            </Question>

            <Question
              prompt="What's your body fat rough estimate?"
              coach="Eyeball it. If you genuinely don't know, skip — I'll figure it out from your other answers."
              optional
            >
              <BodyFatSlider value={answers.bodyFatPct} onChange={(v) => update("bodyFatPct", v)} />
            </Question>

            <Question
              prompt="How long have you been training, and what was your most consistent stretch?"
              coach="Years and reality. 'Started in college, six solid months in 2022' tells me everything."
            >
              <Grid2>
                <TextField label="Years training" placeholder="3" value={answers.trainingYears} onChange={(v) => update("trainingYears", v)} type="number" />
                <TextField label="Longest consistent stretch" placeholder="6 months, 4x/week" value={answers.longestStreak} onChange={(v) => update("longestStreak", v)} />
              </Grid2>
            </Question>

            <Question
              prompt="Best lift ever? Best you've ever looked or performed?"
              coach="Old PRs and old physiques. Tells me what your body's been capable of — we're not starting from scratch."
            >
              <TextField label="Best lift / proudest stat" placeholder="225lb bench, 405lb deadlift, 22-min 5k…" value={answers.bestLift} onChange={(v) => update("bestLift", v)} />
              <div className="mt-3">
                <TextField label="Best physique state" placeholder="Lean and around 175lb in 2023 — felt unstoppable." value={answers.bestPhysique} onChange={(v) => update("bestPhysique", v)} />
              </div>
            </Question>

            <Question
              prompt="Anything hurt? Anything I need to work around?"
              coach="Don't tough it out — if a pattern hurts, I'll swap it. The program's nothing if you can't show up to train."
            >
              <div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {COMMON_INJURIES.map((area) => {
                    const active = answers.injuries.includes(area);
                    return (
                      <button
                        key={area}
                        onClick={() => toggleInjury(area)}
                        className={cn(
                          "rounded-xl px-3 py-1.5 text-xs font-medium border transition-all",
                          active
                            ? "border-[#F87171]/40 bg-[#F87171]/10 text-[#F87171]"
                            : "border-white/8 text-white/45 hover:border-white/15 hover:text-white/70",
                        )}
                      >
                        {area}
                      </button>
                    );
                  })}
                </div>
                {answers.injuries.length > 0 && (
                  <TextArea label="Tell me what hurts and when" placeholder="Lower back pinches on heavy hinges — fine on squats." value={answers.injuryDetails} onChange={(v) => update("injuryDetails", v)} />
                )}
              </div>
            </Question>

            <Question
              prompt="Anything medical I should know?"
              coach="Meds that affect training, conditions to flag. Optional — but if it's there, I'd rather know."
              optional
            >
              <TextField label="Medications affecting training" placeholder="Beta-blocker, SSRI…" value={answers.medications} onChange={(v) => update("medications", v)} />
              <div className="mt-3">
                <TextField label="Medical conditions" placeholder="Mild asthma, T2 diabetes managed…" value={answers.medicalConditions} onChange={(v) => update("medicalConditions", v)} />
              </div>
            </Question>
          </div>
        )}

        {/* ── Chunk B — Goal elaboration ────────────────────────────────── */}
        {step === "goal" && (
          <div className="space-y-8">
            <Question
              prompt="Why this goal? Real answer."
              coach="The version you tell yourself when no one's watching. That's the version that survives bad weeks."
            >
              <TextArea label="In your words" placeholder="I want to feel strong for my kids and stop avoiding mirrors." value={answers.goalWhy} onChange={(v) => update("goalWhy", v)} />
            </Question>

            <Question
              prompt="If I check in with you 90 days from now, what would 'this worked' look like?"
              coach="Specific. Numbers, mirrors, jeans. 'I feel better' is a feeling — give me the proof."
            >
              <TextArea label="What success looks like" placeholder="Down 10 lbs, jeans fit, bench 185 for reps." value={answers.successIn90Days} onChange={(v) => update("successIn90Days", v)} />
            </Question>

            <Question
              prompt="What've you tried that didn't take?"
              coach="Failure patterns are gold. If you bonked on keto twice, I'm not running you on keto."
            >
              <TextArea label="What didn't work" placeholder="Cut carbs too hard and bonked. Big-box gym programs felt random." value={answers.triedNotWorked} onChange={(v) => update("triedNotWorked", v)} />
            </Question>

            <Question
              prompt="What actually keeps you going on a bad day?"
              coach="Some people live for the streak. Some hate streaks but love seeing the body change. Both are valid."
            >
              <Choice label="Motivation style" value={answers.motivationStyle} onChange={(v) => update("motivationStyle", v)}
                options={[
                  { v: "external", l: "Checklists & streaks" },
                  { v: "internal", l: "How I feel about myself" },
                  { v: "mixed",    l: "Mix of both" },
                ]} />
            </Question>
          </div>
        )}

        {/* ── Chunk C — Lifestyle ───────────────────────────────────────── */}
        {step === "lifestyle" && (
          <div className="space-y-8">
            <Question
              prompt="When can you actually train?"
              coach="Pick what's realistic, not aspirational. We can move it later if life shifts."
            >
              <Choice label="Preferred time" value={answers.preferredTime} onChange={(v) => update("preferredTime", v)}
                options={[
                  { v: "early",   l: "Early AM (5–7)" },
                  { v: "morning", l: "Morning (7–11)" },
                  { v: "lunch",   l: "Lunch (11–2)" },
                  { v: "evening", l: "Evening (4–7)" },
                  { v: "late",    l: "Late (7–10)" },
                ]} />
              <div className="mt-5">
                <Label>Days you can train</Label>
                <div className="flex gap-2 flex-wrap">
                  {DAYS.map((d) => {
                    const active = answers.availableDays.includes(d);
                    return (
                      <button
                        key={d}
                        onClick={() => toggleDay(d)}
                        className={cn(
                          "rounded-xl w-12 h-10 text-xs font-medium border transition-all",
                          active
                            ? "border-[#B48B40]/40 bg-[#B48B40]/12 text-[#B48B40]"
                            : "border-white/8 text-white/45 hover:border-white/15 hover:text-white/70",
                        )}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>
            </Question>

            <Question
              prompt="Travel much?"
              coach="If you're in airports a lot I'll build flexibility into the plan — hotel-room sessions, lighter weeks around trips."
            >
              <Choice label="Travel frequency" value={answers.travelFrequency} onChange={(v) => update("travelFrequency", v)}
                options={[
                  { v: "rare",    l: "Rarely" },
                  { v: "monthly", l: "Monthly" },
                  { v: "weekly",  l: "Weekly" },
                ]} />
            </Question>

            <Question
              prompt="When do you sleep?"
              coach="Bedtime and wake time, not 'I get about 7 hours.' Patterns matter more than averages."
            >
              <Grid2>
                <TextField label="Typical bedtime"  type="time" value={answers.bedTime}  onChange={(v) => update("bedTime", v)} />
                <TextField label="Typical wake time" type="time" value={answers.wakeTime} onChange={(v) => update("wakeTime", v)} />
              </Grid2>
            </Question>

            <Question
              prompt="Where's your stress sitting right now, 1 to 10?"
              coach="Baseline, not your worst day. If you're a 7 most weeks, the program needs more recovery built in."
            >
              <Slider label={`Stress baseline (${answers.stressLevel}/10)`} min={1} max={10} value={answers.stressLevel} onChange={(v) => update("stressLevel", v)} />
            </Question>

            <Question
              prompt="Caffeine and alcohol patterns?"
              coach="No judgment — I just need to know. Affects sleep, recovery, and how I schedule hard sessions."
              optional
            >
              <TextField label="Caffeine" placeholder="2 coffees by 11am, none after." value={answers.caffeinePattern} onChange={(v) => update("caffeinePattern", v)} />
              <div className="mt-3">
                <TextField label="Alcohol" placeholder="2–3 drinks on weekends." value={answers.alcoholPattern} onChange={(v) => update("alcoholPattern", v)} />
              </div>
            </Question>
          </div>
        )}

        {/* ── Chunk D — Nutrition specifics ─────────────────────────────── */}
        {step === "nutrition" && (
          <div className="space-y-8">
            <Question
              prompt="What's your relationship with cooking?"
              coach="If you don't cook, I won't write you a meal plan that requires it. Period."
            >
              <Choice label="Cooking ability" value={answers.cookingAbility} onChange={(v) => update("cookingAbility", v)}
                options={[
                  { v: "none",         l: "Don't cook" },
                  { v: "basic",        l: "Basic — can heat / prep" },
                  { v: "comfortable",  l: "Comfortable" },
                  { v: "love",         l: "Love it" },
                ]} />
            </Question>

            <Question
              prompt="What do you hate, and what do you eat every day?"
              coach="Your anchors are the foundation of the plan. What you hate is the boundary."
            >
              <TextArea label="Foods you hate / won't eat" placeholder="No fish, no mushrooms, lactose-intolerant." value={answers.foodsHate} onChange={(v) => update("foodsHate", v)} />
              <div className="mt-3">
                <TextArea label="Anchor meals — what you eat almost daily" placeholder="Eggs and oatmeal for breakfast, chicken + rice for lunch." value={answers.foodsAnchor} onChange={(v) => update("foodsAnchor", v)} />
              </div>
            </Question>

            <Question
              prompt="When do you start and stop eating each day?"
              coach="Your real eating window, not the IF protocol you read about. I'll fit meals into your day, not against it."
            >
              <Grid2>
                <TextField label="First meal" type="time" value={answers.eatingStart} onChange={(v) => update("eatingStart", v)} />
                <TextField label="Last meal"  type="time" value={answers.eatingEnd}   onChange={(v) => update("eatingEnd", v)} />
              </Grid2>
            </Question>

            <Question
              prompt="How do you handle treats?"
              coach="Plans that ban treats fail. We just need to know how yours fit in."
            >
              <Choice label="Treat / cheat style" value={answers.cheatStyle} onChange={(v) => update("cheatStyle", v)}
                options={[
                  { v: "none",   l: "Clean all week" },
                  { v: "weekly", l: "Free meal weekly" },
                  { v: "macros", l: "Fits in macros daily" },
                ]} />
            </Question>

            <Question
              prompt="What's your supplement stack and water baseline?"
              coach="Just so we don't double up — and if hydration's low, that's our easiest first win."
            >
              <TextArea label="Current supplements" placeholder="Whey, creatine 5g, multi, fish oil." value={answers.supplements} onChange={(v) => update("supplements", v)} />
              <div className="mt-3">
                <TextField label="Daily hydration (L)" placeholder="2.5" type="number" value={answers.hydrationL} onChange={(v) => update("hydrationL", v)} />
              </div>
            </Question>
          </div>
        )}

        {/* ── Chunk E — Coach calibration ──────────────────────────────── */}
        {step === "coach" && (
          <div className="space-y-8">
            <Question
              prompt="How do you want me to talk to you?"
              coach="Pick what'll actually land. Some people need a kick, others need a hand."
            >
              <Choice label="Coaching tone" value={answers.coachTone} onChange={(v) => update("coachTone", v)}
                options={[
                  { v: "direct",     l: "Direct — no fluff" },
                  { v: "supportive", l: "Supportive — encouraging" },
                  { v: "analytical", l: "Analytical — data-heavy" },
                ]} />
            </Question>

            <Question
              prompt="Strong language OK?"
              coach="Some people want the gym-coach voice. Others want it kept clean. Doesn't matter to me."
            >
              <Choice label="Profanity in coach messages" value={answers.profanity} onChange={(v) => update("profanity", v)}
                options={[
                  { v: "off",  l: "Keep it clean" },
                  { v: "mild", l: "Strong words OK" },
                ]} />
            </Question>

            <Question
              prompt="How hard should I push you, 1 to 10?"
              coach="1 = whisper suggestions. 10 = drill sergeant. Most people land around 6–7."
            >
              <Slider label={`Push level (${answers.pushLevel}/10)`} min={1} max={10} value={answers.pushLevel} onChange={(v) => update("pushLevel", v)} />
            </Question>
          </div>
        )}

        {/* Nav */}
        <div className="mt-10 flex items-center justify-between gap-3">
          <button
            onClick={() => stepIdx === 0 ? router.back() : setStepIdx((i) => i - 1)}
            className="flex items-center gap-1.5 text-sm text-white/45 hover:text-white/70 transition-colors px-2 py-2"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
            {stepIdx === 0 ? "Exit" : "Back"}
          </button>
          {isLast ? (
            <button
              onClick={() => void finish()}
              disabled={saving}
              className="flex items-center gap-2 rounded-2xl bg-[#B48B40] hover:bg-[#c99840] active:scale-[0.98] text-black px-5 py-3 text-sm font-semibold transition-all disabled:opacity-60"
            >
              {saving ? (finishStatus || "Saving…") : "Finish & build my program"}
              {!saving && <Check className="w-4 h-4" strokeWidth={2.5} />}
            </button>
          ) : (
            <button
              onClick={() => canAdvance && setStepIdx((i) => i + 1)}
              disabled={!canAdvance}
              title={!canAdvance ? "Height and current weight are required so macros + program intensity work." : undefined}
              className={cn(
                "flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition-all",
                canAdvance
                  ? "bg-[#B48B40] hover:bg-[#c99840] active:scale-[0.98] text-black"
                  : "bg-white/5 text-white/35 cursor-not-allowed",
              )}
            >
              Continue
              <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

// ─── Field primitives ─────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-[11px] uppercase tracking-[0.18em] text-white/40 mb-2">{children}</label>;
}

function TextField({
  label, value, onChange, placeholder, type = "text",
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white/[0.03] border border-white/8 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/22 outline-none focus:border-[#B48B40]/40 transition-colors"
      />
    </div>
  );
}

function TextArea({
  label, value, onChange, placeholder,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full bg-white/[0.03] border border-white/8 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/22 outline-none focus:border-[#B48B40]/40 transition-colors resize-y leading-relaxed"
      />
    </div>
  );
}

function Choice({
  label, value, onChange, options,
}: { label: string; value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = value === opt.v;
          return (
            <button
              key={opt.v}
              onClick={() => onChange(opt.v)}
              className={cn(
                "rounded-xl px-3 py-2 text-xs font-medium border transition-all",
                active
                  ? "border-[#B48B40]/40 bg-[#B48B40]/12 text-[#B48B40]"
                  : "border-white/8 text-white/45 hover:border-white/15 hover:text-white/70"
              )}
            >
              {opt.l}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Slider({
  label, min, max, value, onChange,
}: { label: string; min: number; max: number; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="w-full accent-[#B48B40]"
      />
    </div>
  );
}

function Grid2({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>;
}

// ─── Coach-interview primitives ──────────────────────────────────────────────

function Question({
  prompt, coach, optional, children,
}: {
  prompt:   string;
  coach?:   string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-start gap-2.5">
          <div className="w-[2px] self-stretch rounded-full bg-[#B48B40]/30 shrink-0 mt-1" />
          <div className="flex-1">
            <h2 className="text-base font-semibold text-white/90 leading-snug">
              {prompt}
              {optional && <span className="ml-2 text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium">Optional</span>}
            </h2>
            {coach && (
              <p className="text-[13px] text-white/45 leading-relaxed italic mt-1.5">{coach}</p>
            )}
          </div>
        </div>
      </div>
      <div className="pl-4">
        {children}
      </div>
    </div>
  );
}

function UnitToggle({ value, onChange }: { value: Units; onChange: (v: Units) => void }) {
  return (
    <div className="flex items-center gap-2 justify-end">
      <span className="text-[10px] uppercase tracking-[0.18em] text-white/30 mr-1">Units</span>
      {(["metric", "imperial"] as Units[]).map((u) => {
        const active = value === u;
        return (
          <button
            key={u}
            onClick={() => onChange(u)}
            className={cn(
              "rounded-lg px-3 py-1 text-[11px] font-medium border transition-all capitalize",
              active
                ? "border-[#B48B40]/40 bg-[#B48B40]/[0.08] text-[#B48B40]"
                : "border-white/8 bg-white/[0.02] text-white/45 hover:border-white/15 hover:text-white/70",
            )}
          >
            {u === "metric" ? "kg / cm" : "lb / ft·in"}
          </button>
        );
      })}
    </div>
  );
}

function HeightInput({
  units, valueCm, onChange,
}: {
  units:   Units;
  valueCm: string;
  onChange: (cm: string) => void;
}) {
  const cm = parseFloat(valueCm) || 0;
  const { ft, inches } = cmToFeetInches(cm);

  if (units === "metric") {
    return (
      <TextField
        label="Height (cm)"
        placeholder="178"
        value={valueCm}
        onChange={(v) => onChange(v)}
        type="number"
      />
    );
  }

  return (
    <div>
      <Label>Height (ft / in)</Label>
      <div className="grid grid-cols-2 gap-2">
        <div className="relative">
          <input
            type="number"
            min={3}
            max={8}
            value={cm > 0 ? ft : ""}
            placeholder="5"
            onChange={(e) => {
              const nextFt = parseInt(e.target.value) || 0;
              onChange(String(feetInchesToCm(nextFt, inches)));
            }}
            className="w-full bg-white/[0.03] border border-white/8 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/22 outline-none focus:border-[#B48B40]/40 transition-colors tabular-nums pr-9"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-white/30">ft</span>
        </div>
        <div className="relative">
          <input
            type="number"
            min={0}
            max={11}
            value={cm > 0 ? inches : ""}
            placeholder="10"
            onChange={(e) => {
              const nextIn = parseInt(e.target.value) || 0;
              onChange(String(feetInchesToCm(ft, nextIn)));
            }}
            className="w-full bg-white/[0.03] border border-white/8 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/22 outline-none focus:border-[#B48B40]/40 transition-colors tabular-nums pr-9"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-white/30">in</span>
        </div>
      </div>
    </div>
  );
}

function WeightInput({
  units, valueKg, onChange, label,
}: {
  units:   Units;
  valueKg: string;
  onChange: (kg: string) => void;
  label:   string;
}) {
  if (units === "metric") {
    return (
      <TextField
        label={`${label} (kg)`}
        placeholder="82"
        value={valueKg}
        onChange={onChange}
        type="number"
      />
    );
  }

  const kg = parseFloat(valueKg) || 0;
  const displayLbs = kg > 0 ? String(kgToLbs(kg)) : "";

  return (
    <div>
      <Label>{label} (lbs)</Label>
      <input
        type="number"
        value={displayLbs}
        placeholder="180"
        onChange={(e) => {
          const lbs = parseFloat(e.target.value) || 0;
          onChange(lbs > 0 ? String(lbsToKg(lbs)) : "");
        }}
        className="w-full bg-white/[0.03] border border-white/8 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/22 outline-none focus:border-[#B48B40]/40 transition-colors tabular-nums"
      />
    </div>
  );
}

function BodyFatSlider({
  value, onChange,
}: {
  value:   number | null;
  onChange: (v: number | null) => void;
}) {
  const display = value ?? 18;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold text-white/95 tabular-nums">
            {value === null ? "—" : value}
          </span>
          {value !== null && <span className="text-xs text-white/40">%</span>}
        </div>
        <button
          onClick={() => onChange(value === null ? 18 : null)}
          className="text-[11px] text-white/40 hover:text-white/75 transition-colors"
        >
          {value === null ? "Enter estimate" : "Skip — don't know"}
        </button>
      </div>

      {value !== null && (
        <>
          <input
            type="range"
            min={6}
            max={40}
            step={1}
            value={display}
            onChange={(e) => onChange(parseInt(e.target.value, 10))}
            className="w-full accent-[#B48B40]"
          />
          <div className="flex justify-between text-[10px] text-white/30 mt-1.5 tabular-nums">
            <span>6%</span>
            <span>15%</span>
            <span>25%</span>
            <span>35%+</span>
          </div>
          <p className="text-[11px] text-white/35 mt-2 leading-relaxed">
            Rough reference: <span className="text-white/55">6–10%</span> stage-lean ·{" "}
            <span className="text-white/55">11–15%</span> athletic ·{" "}
            <span className="text-white/55">16–22%</span> average ·{" "}
            <span className="text-white/55">23%+</span> softer
          </p>
        </>
      )}
    </div>
  );
}
