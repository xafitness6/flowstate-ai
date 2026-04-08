"use client";

import { useState, useEffect } from "react";
import {
  RefreshCw,
  Plane,
  Droplets,
  Plus,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  TrendingUp,
  Sparkles,
  Mic,
  Check,
} from "lucide-react";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { VoiceReviewModal } from "@/components/voice/VoiceReviewModal";
import { parseMealFromTranscript, type ParsedMeal } from "@/lib/voiceParser";
import { saveVoiceEntry } from "@/lib/voiceLogs";
import { cn } from "@/lib/utils";
import { AIFoodAnalysis } from "@/components/nutrition/AIFoodAnalysis";
import { SuggestionApproval } from "@/components/ai/SuggestionApproval";
import type { AISuggestion as ApprovalSuggestion } from "@/components/ai/SuggestionApproval";
import { useUser } from "@/context/UserContext";
import { hasAccess } from "@/lib/roles";
import { loadIntake } from "@/lib/data/intake";
import { calculateNutritionTargets, type NutritionTargets } from "@/lib/nutrition";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type Macro = { label: string; grams: number; target: number; color: string };

type Meal = {
  id: string;
  name: string;
  time: string;
  calories: number;
  items: string[];
  note?: string;
};

type AISuggestion = {
  id: string;
  type: "warning" | "info" | "positive";
  label: string;
  body: string;
};

// ─── Data ─────────────────────────────────────────────────────────────────────

const MACRO_COLORS = ["bg-[#B48B40]", "bg-white/40", "bg-[#93C5FD]/60"];

const STANDARD_MEALS: Meal[] = [
  {
    id: "m1",
    name: "Breakfast",
    time: "7:30 am",
    calories: 520,
    items: ["3 eggs scrambled", "100g oats with berries", "1 banana", "Black coffee"],
    note: "Eat within 30 minutes of waking.",
  },
  {
    id: "m2",
    name: "Pre-workout",
    time: "11:30 am",
    calories: 320,
    items: ["Greek yogurt 200g", "30g whey protein", "1 apple"],
  },
  {
    id: "m3",
    name: "Lunch",
    time: "2:00 pm",
    calories: 650,
    items: ["200g chicken breast", "150g white rice", "Mixed greens + olive oil", "1 tbsp peanut butter"],
    note: "Largest carb window. Don't skip this.",
  },
  {
    id: "m4",
    name: "Post-workout",
    time: "5:30 pm",
    calories: 280,
    items: ["40g whey protein", "1 rice cake", "Electrolyte drink"],
  },
  {
    id: "m5",
    name: "Dinner",
    time: "7:30 pm",
    calories: 560,
    items: ["Salmon fillet 180g", "Sweet potato 150g", "Steamed broccoli", "Drizzle of olive oil"],
    note: "Keep dinner lighter if training was early.",
  },
];

const TRAVEL_MEALS: Meal[] = [
  {
    id: "t1",
    name: "Breakfast",
    time: "Flexible",
    calories: 480,
    items: ["Hotel eggs x3", "Fruit plate", "Black coffee or green tea"],
    note: "Most hotels have a buffet — prioritize protein first.",
  },
  {
    id: "t2",
    name: "Mid-morning",
    time: "Flexible",
    calories: 220,
    items: ["Protein bar (25g+ protein)", "Sparkling water"],
  },
  {
    id: "t3",
    name: "Lunch",
    time: "Flexible",
    calories: 600,
    items: ["Grilled protein (chicken/steak)", "Side salad or vegetables", "Avoid excess sauces"],
    note: "Any restaurant works — order protein + greens.",
  },
  {
    id: "t4",
    name: "Dinner",
    time: "Flexible",
    calories: 580,
    items: ["Sushi or grilled fish", "Rice if available", "Miso soup"],
  },
];

const AI_SUGGESTIONS: AISuggestion[] = [
  {
    id: "s1",
    type: "warning",
    label: "Protein is tracking low",
    body: "You're at 142g of a 185g target. Add a protein shake or 150g of chicken to close the gap before dinner.",
  },
  {
    id: "s2",
    type: "info",
    label: "Increase water intake",
    body: "Training day hydration should be 3L minimum. You're currently at 1.4L — pace yourself to 500ml per hour.",
  },
  {
    id: "s3",
    type: "positive",
    label: "Calorie balance is clean",
    body: "You're 80kcal under target heading into dinner. No adjustments needed — eat your planned meal normally.",
  },
];

const SUGGESTION_STYLE: Record<AISuggestion["type"], { icon: typeof AlertCircle; color: string; bg: string; border: string }> = {
  warning:  { icon: AlertCircle, color: "text-[#FBBF24]", bg: "bg-[#FBBF24]/6",  border: "border-[#FBBF24]/20" },
  info:     { icon: Droplets,    color: "text-[#93C5FD]", bg: "bg-[#93C5FD]/6",  border: "border-[#93C5FD]/20" },
  positive: { icon: TrendingUp,  color: "text-emerald-400", bg: "bg-emerald-400/6", border: "border-emerald-400/20" },
};

// Fallback targets when no intake data is available
const FALLBACK_TARGETS: NutritionTargets = {
  calories: 2500, proteinG: 185, carbsG: 280, fatG: 70, waterMl: 3000,
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function MacroBar({ macro }: { macro: Macro }) {
  const pct = Math.min((macro.grams / macro.target) * 100, 100);
  const remaining = macro.target - macro.grams;
  return (
    <div className="space-y-1.5">
      <div className="flex items-end justify-between">
        <span className="text-xs text-white/40">{macro.label}</span>
        <div className="text-right">
          <span className="text-sm font-semibold text-white/80 tabular-nums">{macro.grams}g</span>
          <span className="text-xs text-white/25 tabular-nums"> / {macro.target}g</span>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-white/6 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", macro.color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[10px] text-white/25 tabular-nums">{remaining}g remaining</p>
    </div>
  );
}

function MealCard({ meal }: { meal: Meal }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-white/7 bg-[#111111] overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-white/[0.015] transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-semibold text-white/88">{meal.name}</span>
            <span className="text-xs text-white/25">{meal.time}</span>
          </div>
          {!open && (
            <p className="text-xs text-white/30 mt-0.5 truncate">
              {meal.items.slice(0, 2).join(" · ")}
              {meal.items.length > 2 && ` +${meal.items.length - 2} more`}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm font-medium tabular-nums text-white/55">
            {meal.calories} kcal
          </span>
          {open
            ? <ChevronUp className="w-4 h-4 text-white/25" strokeWidth={1.5} />
            : <ChevronDown className="w-4 h-4 text-white/25" strokeWidth={1.5} />
          }
        </div>
      </button>

      {open && (
        <div className="border-t border-white/6 px-5 pb-4 pt-3 space-y-1.5">
          {meal.items.map((item, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <span className="w-1 h-1 rounded-full bg-white/20 shrink-0" />
              <span className="text-sm text-white/60">{item}</span>
            </div>
          ))}
          {meal.note && (
            <div className="mt-3 pt-3 border-t border-white/5">
              <p className="text-xs text-[#B48B40]/70 leading-relaxed">◈ {meal.note}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NutritionPage() {
  const { user } = useUser();
  const canEdit = hasAccess(user.role, "trainer");
  const voice   = useVoiceInput();

  const [targets, setTargets]                 = useState<NutritionTargets>(FALLBACK_TARGETS);
  const [hasIntake, setHasIntake]             = useState(false);
  const [travelMode, setTravelMode]           = useState(false);
  const [hydration, setHydration]             = useState(0); // ml — starts at 0
  const [note, setNote]                       = useState("");
  const [noteOpen, setNoteOpen]               = useState(false);
  const [regenerating, setRegenerating]       = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(true);
  const [analysisOpen, setAnalysisOpen]       = useState(false);
  const [approvalSuggestion, setApprovalSuggestion] = useState<ApprovalSuggestion | null>(null);
  const [showVoiceMeal, setShowVoiceMeal]     = useState(false);
  const [loggedMeals, setLoggedMeals]         = useState<ParsedMeal[]>([]);

  // Load nutrition targets from onboarding intake
  useEffect(() => {
    const intake = loadIntake(user.id);
    if (intake) {
      const calc = calculateNutritionTargets(intake);
      if (calc) {
        setTargets(calc);
        setHasIntake(true);
        return;
      }
    }
    setHasIntake(false);
  }, [user.id]);

  // Derive consumed calories from voice-logged meals (parser provides totalCals when detectable)
  const calorieConsumed = loggedMeals.reduce((sum, m) => sum + (m.totalCals ?? 0), 0);
  const proteinConsumed = 0; // requires food DB lookup — tracked qualitatively via voice logs

  const macros: Macro[] = [
    { label: "Protein", grams: proteinConsumed, target: targets.proteinG, color: MACRO_COLORS[0] },
    { label: "Carbs",   grams: 0,               target: targets.carbsG,   color: MACRO_COLORS[1] },
    { label: "Fats",    grams: 0,               target: targets.fatG,     color: MACRO_COLORS[2] },
  ];

  function handleVoiceMealConfirm() {
    if (!voice.transcript.trim()) return;
    const parsed = parseMealFromTranscript(voice.transcript);
    saveVoiceEntry(user.id, {
      userId:     user.id,
      entryType:  "meal_log",
      transcript: voice.transcript,
      confidence: voice.confidence,
      parsedData: parsed,
    });
    setLoggedMeals((prev) => [parsed, ...prev]);
    setShowVoiceMeal(false);
    voice.reset();
  }

  const hydrationPct = Math.min((hydration / targets.waterMl) * 100, 100);
  const caloriePct = Math.min((calorieConsumed / targets.calories) * 100, 100);
  const meals = travelMode ? TRAVEL_MEALS : STANDARD_MEALS;

  function handleRegenerate() {
    setRegenerating(true);
    setTimeout(() => setRegenerating(false), 1200);
  }

  function addWater(ml: number) {
    setHydration((v) => Math.min(v + ml, targets.waterMl));
  }

  return (
    <div className="px-5 md:px-8 py-6 text-white">
      <div className="max-w-5xl mx-auto">

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-5xl font-semibold tracking-tight mb-2">Nutrition</h1>
            <p className="text-white/40 text-lg">Friday · Training day</p>
          </div>

          {/* Travel mode toggle */}
          <button
            onClick={() => setTravelMode((v) => !v)}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all mt-1",
              travelMode
                ? "border-[#B48B40]/40 bg-[#B48B40]/8 text-[#B48B40]"
                : "border-white/10 text-white/40 hover:border-white/20 hover:text-white/65"
            )}
          >
            <Plane className="w-4 h-4" strokeWidth={1.5} />
            {travelMode ? "Travel mode on" : "Travel mode"}
          </button>
        </div>

        {/* No intake banner */}
        {!hasIntake && (
          <div className="mb-4 rounded-2xl border border-[#B48B40]/20 bg-[#B48B40]/[0.04] px-5 py-4 flex items-center gap-4">
            <AlertCircle className="w-4 h-4 text-[#B48B40]/70 shrink-0" strokeWidth={1.5} />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white/60">Showing estimated targets — complete your intake to personalise.</p>
            </div>
            <Link
              href="/onboarding/calibration"
              className="shrink-0 text-xs font-semibold text-[#B48B40] hover:text-[#c99840] transition-colors"
            >
              Complete intake →
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-4">

          {/* ── Left column ────────────────────────────────────────────── */}
          <div className="space-y-4">

            {/* AI Analysis entry point */}
            <button
              onClick={() => setAnalysisOpen(true)}
              className="w-full flex items-center gap-4 rounded-2xl border border-[#B48B40]/18 bg-[#B48B40]/[0.04] hover:bg-[#B48B40]/[0.07] hover:border-[#B48B40]/28 px-5 py-4 transition-all text-left group"
            >
              <div className="w-8 h-8 rounded-xl bg-[#B48B40]/10 border border-[#B48B40]/20 flex items-center justify-center shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-[#B48B40]/70" strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white/70 group-hover:text-white/85 transition-colors">
                  AI food analysis
                </p>
                <p className="text-xs text-white/28 mt-0.5">
                  Photo · Voice · Portion guidance
                </p>
              </div>
              <ChevronDown className="w-4 h-4 text-white/20 -rotate-90 shrink-0" strokeWidth={1.5} />
            </button>

            {/* Voice log meal */}
            <button
              onClick={() => setShowVoiceMeal(true)}
              className="w-full flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.035] hover:border-white/12 px-5 py-4 transition-all text-left group"
            >
              <div className="w-8 h-8 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center shrink-0">
                <Mic className="w-3.5 h-3.5 text-white/40" strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white/60 group-hover:text-white/80 transition-colors">
                  Voice log meal
                </p>
                <p className="text-xs text-white/28 mt-0.5">
                  Say what you ate — parsed automatically
                </p>
              </div>
              <ChevronDown className="w-4 h-4 text-white/20 -rotate-90 shrink-0" strokeWidth={1.5} />
            </button>

            {/* Logged voice meals (today) */}
            {loggedMeals.length > 0 && (
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-5 py-4 space-y-3">
                <p className="text-[10px] uppercase tracking-[0.22em] text-white/28">Voice logged today</p>
                {loggedMeals.map((meal, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Check className="w-3 h-3 text-emerald-400 shrink-0" strokeWidth={2.5} />
                      <p className="text-sm text-white/70 font-medium">{meal.name}</p>
                      {meal.mealType && (
                        <span className="text-[10px] text-white/30 capitalize">{meal.mealType}</span>
                      )}
                    </div>
                    {meal.items.slice(0, 4).map((item, j) => (
                      <div key={j} className="flex items-center gap-2 pl-5">
                        <span className="w-1 h-1 rounded-full bg-white/20 shrink-0" />
                        <span className="text-xs text-white/50">
                          {item.quantity ? `${item.quantity}${item.unit ?? ""} ` : ""}{item.food}
                        </span>
                      </div>
                    ))}
                    {meal.items.length > 4 && (
                      <p className="text-[10px] text-white/25 pl-5">+{meal.items.length - 4} more</p>
                    )}
                    <p className="text-[10px] text-white/20 pl-5 italic">"{meal.rawTranscript.slice(0, 80)}{meal.rawTranscript.length > 80 ? "…" : ""}"</p>
                  </div>
                ))}
              </div>
            )}

            {/* AI Suggestions */}
            <section>
              <button
                onClick={() => setSuggestionsOpen((v) => !v)}
                className="flex items-center gap-2 mb-3 px-1 w-full text-left"
              >
                <span className="text-[10px] uppercase tracking-[0.22em] text-white/30">
                  ◈ AI Suggestions
                </span>
                <span className="ml-auto text-white/20">
                  {suggestionsOpen
                    ? <ChevronUp className="w-3.5 h-3.5" strokeWidth={1.5} />
                    : <ChevronDown className="w-3.5 h-3.5" strokeWidth={1.5} />
                  }
                </span>
              </button>

              {suggestionsOpen && (
                <div className="space-y-2">
                  {AI_SUGGESTIONS.map((s) => {
                    const { icon: Icon, color, bg, border } = SUGGESTION_STYLE[s.type];
                    const approvalData: ApprovalSuggestion | null = s.id === "s1" ? {
                      id: s.id, category: "nutrition", title: s.label,
                      what:     "Raise daily protein intake from 142g to 185g target.",
                      why:      "Client is tracking 43g below target heading into dinner. Without a corrective meal, the daily protein goal will be missed, reducing muscle protein synthesis stimulus.",
                      impact:   "Closing the gap supports recovery and hypertrophy targets for today's training session.",
                      current:  "142g / 185g target",
                      proposed: "Add 150g chicken or a 40g whey shake before dinner",
                    } : s.id === "s2" ? {
                      id: s.id, category: "nutrition", title: s.label,
                      what:     "Increase water intake pace to 500ml/hour for the remainder of the day.",
                      why:      "Currently at 1.4L of a 3L training-day target. At current pace, client will fall significantly short of hydration goals.",
                      impact:   "Proper hydration on training days improves performance, recovery, and nutrient transport.",
                      current:  "1.4L consumed",
                      proposed: "500ml per hour until 3L target",
                    } : null;

                    return (
                      <div
                        key={s.id}
                        className={cn("rounded-2xl border px-5 py-4", bg, border)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2.5 mb-1.5">
                              <Icon className={cn("w-3.5 h-3.5 shrink-0", color)} strokeWidth={1.5} />
                              <p className={cn("text-sm font-medium", color)}>{s.label}</p>
                            </div>
                            <p className="text-sm text-white/50 leading-relaxed ml-6">{s.body}</p>
                          </div>
                          {canEdit && approvalData && (
                            <button
                              onClick={() => setApprovalSuggestion(approvalData)}
                              className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-white/35 border border-white/10 bg-white/[0.03] rounded-lg px-2.5 py-1.5 hover:text-white/60 hover:bg-white/[0.06] transition-all mt-0.5"
                            >
                              Review
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Meals */}
            <section>
              <div className="flex items-center justify-between mb-3 px-1">
                <p className="text-[10px] uppercase tracking-[0.22em] text-white/30">
                  {travelMode ? "Travel meals" : "Daily meals"}
                </p>
                <div className="flex items-center gap-3">
                  {canEdit && (
                    <Link
                      href="/nutrition/plans"
                      className="text-[10px] font-medium text-[#B48B40]/60 hover:text-[#B48B40]/90 transition-colors uppercase tracking-[0.12em]"
                    >
                      Edit plan →
                    </Link>
                  )}
                <button
                  onClick={handleRegenerate}
                  className={cn(
                    "flex items-center gap-1.5 text-xs text-white/35 hover:text-white/65 transition-all",
                    regenerating && "opacity-50 pointer-events-none"
                  )}
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", regenerating && "animate-spin")} strokeWidth={1.5} />
                  Regenerate
                </button>
                </div>
              </div>

              {travelMode && (
                <div className="rounded-xl border border-[#B48B40]/20 bg-[#B48B40]/5 px-4 py-3 mb-3 flex items-start gap-3">
                  <Plane className="w-3.5 h-3.5 text-[#B48B40]/70 shrink-0 mt-0.5" strokeWidth={1.5} />
                  <p className="text-xs text-white/45 leading-relaxed">
                    Travel meals are flexible and restaurant-friendly. Calories are approximate.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                {meals.map((meal) => (
                  <MealCard key={meal.id} meal={meal} />
                ))}
              </div>
            </section>

            {/* Coach notes */}
            <section>
              <button
                onClick={() => setNoteOpen((v) => !v)}
                className="w-full flex items-center justify-between mb-3 px-1"
              >
                <p className="text-[10px] uppercase tracking-[0.22em] text-white/30">
                  Nutrition notes
                </p>
                {noteOpen
                  ? <ChevronUp className="w-3.5 h-3.5 text-white/20" strokeWidth={1.5} />
                  : <ChevronDown className="w-3.5 h-3.5 text-white/20" strokeWidth={1.5} />
                }
              </button>

              {noteOpen && (
                <div className="rounded-2xl border border-white/7 bg-[#111111] px-5 py-4">
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Add personal notes, food preferences, or anything your coach should know..."
                    rows={3}
                    className="w-full bg-transparent text-sm text-white/65 placeholder:text-white/20 resize-none outline-none leading-relaxed"
                  />
                  {note && (
                    <div className="flex justify-end mt-2 pt-2 border-t border-white/5">
                      <button className="text-xs text-[#B48B40] hover:text-[#c99840] transition-colors">
                        Save note
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>

          {/* ── Right column ───────────────────────────────────────────── */}
          <div className="space-y-4">

            {/* Calorie summary */}
            <section>
              <p className="text-[10px] uppercase tracking-[0.22em] text-white/30 mb-3 px-1">
                Calories
              </p>
              <div className="rounded-2xl border border-white/7 bg-[#111111] px-5 py-4">
                <div className="flex items-end justify-between mb-4">
                  <div>
                    <p className="text-3xl font-semibold tabular-nums text-white/90">
                      {calorieConsumed.toLocaleString()}
                    </p>
                    <p className="text-xs text-white/30 mt-1">
                      of {targets.calories.toLocaleString()} kcal
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-white/50 tabular-nums">
                      {Math.max(0, targets.calories - calorieConsumed).toLocaleString()}
                    </p>
                    <p className="text-xs text-white/25">remaining</p>
                  </div>
                </div>

                {/* Calorie bar */}
                <div className="h-2 rounded-full bg-white/6 overflow-hidden mb-1">
                  <div
                    className="h-full rounded-full bg-[#B48B40] transition-all"
                    style={{ width: `${caloriePct}%` }}
                  />
                </div>
                <p className="text-[10px] text-white/25 tabular-nums">
                  {Math.round(caloriePct)}% of daily target
                </p>
              </div>
            </section>

            {/* Macros */}
            <section>
              <p className="text-[10px] uppercase tracking-[0.22em] text-white/30 mb-3 px-1">
                Macros
              </p>
              <div className="rounded-2xl border border-white/7 bg-[#111111] px-5 py-4 space-y-4">
                {macros.map((m) => <MacroBar key={m.label} macro={m} />)}
              </div>
            </section>

            {/* Hydration */}
            <section>
              <p className="text-[10px] uppercase tracking-[0.22em] text-white/30 mb-3 px-1">
                Hydration
              </p>
              <div className="rounded-2xl border border-white/7 bg-[#111111] px-5 py-4">
                <div className="flex items-end justify-between mb-3">
                  <div>
                    <p className="text-2xl font-semibold tabular-nums text-white/88">
                      {(hydration / 1000).toFixed(1)}L
                    </p>
                    <p className="text-xs text-white/25 mt-0.5">of {(targets.waterMl / 1000).toFixed(1)}L target</p>
                  </div>
                  <Droplets
                    className={cn(
                      "w-5 h-5 mb-1",
                      hydrationPct >= 80 ? "text-[#93C5FD]" : "text-white/20"
                    )}
                    strokeWidth={1.5}
                  />
                </div>

                {/* Hydration bar */}
                <div className="h-1.5 rounded-full bg-white/6 overflow-hidden mb-4">
                  <div
                    className="h-full rounded-full bg-[#93C5FD]/60 transition-all"
                    style={{ width: `${hydrationPct}%` }}
                  />
                </div>

                {/* Quick add buttons */}
                <div className="flex gap-2">
                  {[250, 500, 750].map((ml) => (
                    <button
                      key={ml}
                      onClick={() => addWater(ml)}
                      className="flex-1 flex items-center justify-center gap-1 rounded-xl border border-white/8 bg-white/[0.02] py-2 text-xs text-white/45 hover:text-white/70 hover:border-white/15 transition-all"
                    >
                      <Plus className="w-3 h-3" strokeWidth={2} />
                      {ml}ml
                    </button>
                  ))}
                </div>

                {hydration >= targets.waterMl && (
                  <p className="text-xs text-[#93C5FD]/70 text-center mt-3">
                    Daily target reached.
                  </p>
                )}
              </div>
            </section>

            {/* Calorie breakdown by meal */}
            <section>
              <p className="text-[10px] uppercase tracking-[0.22em] text-white/30 mb-3 px-1">
                Meal breakdown
              </p>
              <div className="rounded-2xl border border-white/7 bg-[#111111] px-5 py-4 space-y-3">
                {meals.map((meal) => {
                  const pct = (meal.calories / targets.calories) * 100;
                  return (
                    <div key={meal.id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-white/40">{meal.name}</span>
                        <span className="text-xs font-medium text-white/55 tabular-nums">
                          {meal.calories} kcal
                        </span>
                      </div>
                      <div className="h-1 rounded-full bg-white/6 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-white/25"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}

                <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                  <span className="text-xs text-white/25">Total planned</span>
                  <span className="text-xs font-semibold text-white/60 tabular-nums">
                    {meals.reduce((s, m) => s + m.calories, 0).toLocaleString()} kcal
                  </span>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      <AIFoodAnalysis open={analysisOpen} onClose={() => setAnalysisOpen(false)} />

      {showVoiceMeal && (
        <VoiceReviewModal
          status={voice.status}
          transcript={voice.transcript}
          interim={voice.interim}
          confidence={voice.confidence}
          error={voice.error}
          isSupported={voice.isSupported}
          label="Voice meal log"
          placeholder="e.g. 'I had 3 eggs, 100g oats, and a black coffee for breakfast'"
          onStart={voice.start}
          onStop={voice.stop}
          onReset={voice.reset}
          onTranscriptChange={voice.setTranscript}
          onConfirm={handleVoiceMealConfirm}
          onCancel={() => { setShowVoiceMeal(false); voice.reset(); }}
        />
      )}

      {approvalSuggestion && (
        <SuggestionApproval
          suggestion={approvalSuggestion}
          onClose={() => setApprovalSuggestion(null)}
          onOutcome={() => setApprovalSuggestion(null)}
        />
      )}
    </div>
  );
}

