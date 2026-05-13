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

// ─── Types ────────────────────────────────────────────────────────────────────

type DeepCalAnswers = {
  // Chunk A — Body & history
  heightCm:         string;
  weightKg:         string;
  goalWeightKg:     string;
  goalTimeframe:    string;   // "30 days" | "90 days" | "6 months" | "1 year"
  bodyFatPct:       string;
  trainingYears:    string;
  longestStreak:    string;   // open text
  bestLift:         string;   // open text
  injuries:         string[]; // multi-select
  injuryDetails:    string;

  // Chunk B — Goal elaboration
  goalWhy:          string;   // open text
  successIn90Days:  string;   // open text
  triedNotWorked:   string;   // open text
  motivationStyle:  string;   // "external" | "internal" | "mixed"

  // Chunk C — Lifestyle
  preferredTime:    string;   // "early" | "morning" | "lunch" | "evening" | "late"
  availableDays:    string[]; // mon..sun
  travelFrequency:  string;   // "rare" | "monthly" | "weekly"
  bedTime:          string;   // HH:MM
  wakeTime:         string;   // HH:MM
  stressLevel:      number;   // 1..10

  // Chunk D — Nutrition specifics
  cookingAbility:   string;   // "none" | "basic" | "comfortable" | "love"
  foodsHate:        string;
  foodsAnchor:      string;
  eatingStart:      string;   // HH:MM
  eatingEnd:        string;   // HH:MM
  cheatStyle:       string;   // "none" | "weekly" | "macros"
  supplements:      string;
  hydrationL:       string;

  // Chunk E — Coach
  coachTone:        string;   // "direct" | "supportive" | "analytical"
  profanity:        string;   // "off" | "mild"
  pushLevel:        number;   // 1..10
};

const DEFAULTS: DeepCalAnswers = {
  heightCm: "", weightKg: "", goalWeightKg: "", goalTimeframe: "",
  bodyFatPct: "", trainingYears: "", longestStreak: "", bestLift: "",
  injuries: [], injuryDetails: "",
  goalWhy: "", successIn90Days: "", triedNotWorked: "", motivationStyle: "mixed",
  preferredTime: "morning", availableDays: ["Mon", "Wed", "Fri"],
  travelFrequency: "rare", bedTime: "22:30", wakeTime: "06:30", stressLevel: 5,
  cookingAbility: "basic", foodsHate: "", foodsAnchor: "",
  eatingStart: "08:00", eatingEnd: "20:00", cheatStyle: "macros",
  supplements: "", hydrationL: "",
  coachTone: "direct", profanity: "off", pushLevel: 6,
};

const STEPS = ["body", "goal", "lifestyle", "nutrition", "coach"] as const;
type Step = typeof STEPS[number];

const STEP_LABELS: Record<Step, string> = {
  body:      "Body & history",
  goal:      "Goal in depth",
  lifestyle: "Lifestyle & schedule",
  nutrition: "Nutrition specifics",
  coach:     "Coach style",
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

    // Merge deep cal answers into onboarding state. The existing pattern saves
    // intake data under `intakeData`; we tuck the deep cal under a `deep` key
    // so the original intake stays accessible.
    const existing = loadOnboardingState(userId);
    saveOnboardingState(userId, {
      hasCompletedDeepCal: true,
      intakeData: { ...existing.intakeData, deep: answers } as typeof existing.intakeData,
    });

    try { localStorage.removeItem(DRAFT_KEY(userId)); } catch { /* ignore */ }

    setSaving(false);
    router.replace("/dashboard");
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
            Deep calibration · Step {stepIdx + 1} of {STEPS.length}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{STEP_LABELS[step]}</h1>
          <p className="text-sm text-white/35 mt-2">
            The more accurate you are, the more dialed your plan gets. Skip anything that doesn&apos;t apply.
          </p>
        </div>

        {/* ── Chunk A — Body & history ──────────────────────────────────── */}
        {step === "body" && (
          <div className="space-y-6">
            <Grid2>
              <TextField label="Height (cm)" placeholder="178" value={answers.heightCm}    onChange={(v) => update("heightCm", v)} type="number" />
              <TextField label="Current weight (kg)" placeholder="82" value={answers.weightKg} onChange={(v) => update("weightKg", v)} type="number" />
            </Grid2>
            <Grid2>
              <TextField label="Goal weight (kg)" placeholder="78" value={answers.goalWeightKg} onChange={(v) => update("goalWeightKg", v)} type="number" />
              <Choice label="Timeframe" value={answers.goalTimeframe} onChange={(v) => update("goalTimeframe", v)}
                options={[{ v: "30d", l: "30 days" }, { v: "90d", l: "90 days" }, { v: "6mo", l: "6 months" }, { v: "1y", l: "1 year" }]} />
            </Grid2>
            <Grid2>
              <TextField label="Body fat % (optional)" placeholder="18" value={answers.bodyFatPct} onChange={(v) => update("bodyFatPct", v)} type="number" />
              <TextField label="Years training" placeholder="3" value={answers.trainingYears} onChange={(v) => update("trainingYears", v)} type="number" />
            </Grid2>
            <TextField label="Longest consistent streak (months / what you did)" placeholder="6 months — 4x/week" value={answers.longestStreak} onChange={(v) => update("longestStreak", v)} />
            <TextField label="Best lift / proudest stat ever" placeholder="225lb bench, 405lb deadlift, ran 5k in 22min..." value={answers.bestLift} onChange={(v) => update("bestLift", v)} />
            <div>
              <Label>Any current injuries or pain points?</Label>
              <div className="flex flex-wrap gap-2">
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
                          : "border-white/8 text-white/45 hover:border-white/15 hover:text-white/70"
                      )}
                    >
                      {area}
                    </button>
                  );
                })}
              </div>
            </div>
            {answers.injuries.length > 0 && (
              <TextArea label="Tell me what hurts and when" placeholder="Lower back pinches on heavy hinges — fine on squats." value={answers.injuryDetails} onChange={(v) => update("injuryDetails", v)} />
            )}
          </div>
        )}

        {/* ── Chunk B — Goal elaboration ────────────────────────────────── */}
        {step === "goal" && (
          <div className="space-y-6">
            <TextArea label="Why this goal, in your own words?" placeholder="I want to feel strong for my kids and stop avoiding mirrors." value={answers.goalWhy} onChange={(v) => update("goalWhy", v)} />
            <TextArea label="What does success look like in 90 days?" placeholder="Down 10 lbs, jeans fit, bench 185 for reps." value={answers.successIn90Days} onChange={(v) => update("successIn90Days", v)} />
            <TextArea label="What have you tried that didn't work?" placeholder="Cut carbs too hard and bonked. Big-box gym programs felt random." value={answers.triedNotWorked} onChange={(v) => update("triedNotWorked", v)} />
            <Choice label="How do you stay motivated?" value={answers.motivationStyle} onChange={(v) => update("motivationStyle", v)}
              options={[
                { v: "external", l: "Checklists & streaks" },
                { v: "internal", l: "How I feel about myself" },
                { v: "mixed",    l: "Mix of both" },
              ]} />
          </div>
        )}

        {/* ── Chunk C — Lifestyle ───────────────────────────────────────── */}
        {step === "lifestyle" && (
          <div className="space-y-6">
            <Choice label="Preferred training time" value={answers.preferredTime} onChange={(v) => update("preferredTime", v)}
              options={[
                { v: "early",   l: "Early AM (5-7)" },
                { v: "morning", l: "Morning (7-11)" },
                { v: "lunch",   l: "Lunch (11-2)" },
                { v: "evening", l: "Evening (4-7)" },
                { v: "late",    l: "Late (7-10)" },
              ]} />
            <div>
              <Label>Available training days</Label>
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
                          : "border-white/8 text-white/45 hover:border-white/15 hover:text-white/70"
                      )}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>
            <Choice label="Travel frequency" value={answers.travelFrequency} onChange={(v) => update("travelFrequency", v)}
              options={[
                { v: "rare",    l: "Rarely" },
                { v: "monthly", l: "Monthly" },
                { v: "weekly",  l: "Weekly" },
              ]} />
            <Grid2>
              <TextField label="Typical bedtime" type="time" value={answers.bedTime} onChange={(v) => update("bedTime", v)} />
              <TextField label="Typical wake time" type="time" value={answers.wakeTime} onChange={(v) => update("wakeTime", v)} />
            </Grid2>
            <Slider label={`Baseline stress level (${answers.stressLevel}/10)`} min={1} max={10} value={answers.stressLevel} onChange={(v) => update("stressLevel", v)} />
          </div>
        )}

        {/* ── Chunk D — Nutrition specifics ─────────────────────────────── */}
        {step === "nutrition" && (
          <div className="space-y-6">
            <Choice label="Cooking ability" value={answers.cookingAbility} onChange={(v) => update("cookingAbility", v)}
              options={[
                { v: "none",         l: "Don't cook" },
                { v: "basic",        l: "Basic — can heat / prep" },
                { v: "comfortable",  l: "Comfortable" },
                { v: "love",         l: "Love it" },
              ]} />
            <TextArea label="Foods you hate or won't eat" placeholder="No fish, no mushrooms, lactose-intolerant." value={answers.foodsHate} onChange={(v) => update("foodsHate", v)} />
            <TextArea label="Anchor meals — foods you eat almost daily" placeholder="Eggs and oatmeal for breakfast, chicken + rice for lunch." value={answers.foodsAnchor} onChange={(v) => update("foodsAnchor", v)} />
            <Grid2>
              <TextField label="First meal" type="time" value={answers.eatingStart} onChange={(v) => update("eatingStart", v)} />
              <TextField label="Last meal"  type="time" value={answers.eatingEnd}   onChange={(v) => update("eatingEnd", v)} />
            </Grid2>
            <Choice label="Cheat / treat style" value={answers.cheatStyle} onChange={(v) => update("cheatStyle", v)}
              options={[
                { v: "none",   l: "Clean all week" },
                { v: "weekly", l: "Free meal weekly" },
                { v: "macros", l: "Fits in macros daily" },
              ]} />
            <TextArea label="Current supplements" placeholder="Whey, creatine 5g, multi, fish oil." value={answers.supplements} onChange={(v) => update("supplements", v)} />
            <TextField label="Daily hydration baseline (L)" placeholder="2.5" type="number" value={answers.hydrationL} onChange={(v) => update("hydrationL", v)} />
          </div>
        )}

        {/* ── Chunk E — Coach calibration ──────────────────────────────── */}
        {step === "coach" && (
          <div className="space-y-6">
            <Choice label="Coaching tone" value={answers.coachTone} onChange={(v) => update("coachTone", v)}
              options={[
                { v: "direct",     l: "Direct — no fluff" },
                { v: "supportive", l: "Supportive — encouraging" },
                { v: "analytical", l: "Analytical — data-heavy" },
              ]} />
            <Choice label="Profanity in coach messages" value={answers.profanity} onChange={(v) => update("profanity", v)}
              options={[
                { v: "off",  l: "Off" },
                { v: "mild", l: "Mild — strong words OK" },
              ]} />
            <Slider label={`How hard should the coach push you? (${answers.pushLevel}/10)`} min={1} max={10} value={answers.pushLevel} onChange={(v) => update("pushLevel", v)} />
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
              {saving ? "Saving…" : "Finish setup"}
              {!saving && <Check className="w-4 h-4" strokeWidth={2.5} />}
            </button>
          ) : (
            <button
              onClick={() => setStepIdx((i) => i + 1)}
              className="flex items-center gap-2 rounded-2xl bg-[#B48B40] hover:bg-[#c99840] active:scale-[0.98] text-black px-5 py-3 text-sm font-semibold transition-all"
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
