"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Mic, Camera, Plus, Sparkles, Droplets, Flame,
  ChevronDown, ChevronUp, AlertCircle, TrendingUp,
  X, Clock, ChevronLeft, ChevronRight, Loader2, Trash2,
} from "lucide-react";
import { useVoiceInput }           from "@/hooks/useVoiceInput";
import { VoiceReviewModal }        from "@/components/voice/VoiceReviewModal";
import { MealReviewModal }         from "@/components/nutrition/MealReviewModal";
import { AIFoodAnalysis }          from "@/components/nutrition/AIFoodAnalysis";
import { cn }                      from "@/lib/utils";
import { useUser }                 from "@/context/UserContext";
import { loadIntake }              from "@/lib/data/intake";
import { calculateNutritionTargets, type NutritionTargets } from "@/lib/nutrition";
import {
  saveMeal,
  getMealsForDate,
  getMealsForRange,
  deleteMeal as storageDeleteMeal,
} from "@/lib/nutrition/store";
import type {
  LoggedMeal,
  MealType,
  NutritionParseResult,
  MealTotals,
} from "@/lib/nutrition/types";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type MealSlotKey = "breakfast" | "pre_workout" | "lunch" | "post_workout" | "dinner" | "snack";
type SuggType    = "warning" | "info" | "positive";

type Suggestion = {
  id:    string;
  type:  SuggType;
  label: string;
  body:  string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const FALLBACK: NutritionTargets = {
  calories: 2500, proteinG: 185, carbsG: 280, fatG: 70, waterMl: 3000,
};

const SLOT_META: Record<MealSlotKey, { label: string; time: string; icon: string }> = {
  breakfast:    { label: "Breakfast",    time: "7:00 – 9:00 am",   icon: "☀️" },
  pre_workout:  { label: "Pre-workout",  time: "10:30 – 11:30 am", icon: "⚡" },
  lunch:        { label: "Lunch",        time: "12:30 – 2:00 pm",  icon: "🥗" },
  post_workout: { label: "Post-workout", time: "4:30 – 5:30 pm",   icon: "🔄" },
  dinner:       { label: "Dinner",       time: "7:00 – 8:00 pm",   icon: "🌙" },
  snack:        { label: "Snack",        time: "As needed",         icon: "🍎" },
};

const SLOT_ORDER: MealSlotKey[] = [
  "breakfast", "pre_workout", "lunch", "post_workout", "dinner", "snack",
];

// Map MealType to slot
const MEAL_TYPE_TO_SLOT: Record<MealType, MealSlotKey> = {
  breakfast: "breakfast",
  lunch:     "lunch",
  dinner:    "dinner",
  snack:     "snack",
  unknown:   "snack",
};

// ─── Date helpers ─────────────────────────────────────────────────────────────

function toDateISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function todayISO(): string {
  return toDateISO(new Date());
}

function offsetDate(base: string, days: number): string {
  const d = new Date(base + "T12:00:00");
  d.setDate(d.getDate() + days);
  return toDateISO(d);
}

function formatDateLabel(iso: string): string {
  const today     = todayISO();
  const yesterday = offsetDate(today, -1);
  if (iso === today)     return "Today";
  if (iso === yesterday) return "Yesterday";
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}

function getLast7Start(): string {
  return offsetDate(todayISO(), -6);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mealToSlot(meal: LoggedMeal): MealSlotKey {
  const type = meal.mealType;
  if (type && type in MEAL_TYPE_TO_SLOT) return MEAL_TYPE_TO_SLOT[type];
  // fallback: infer from time
  const h = new Date(meal.eatenAt).getHours();
  if (h <  9) return "breakfast";
  if (h < 12) return "pre_workout";
  if (h < 15) return "lunch";
  if (h < 18) return "post_workout";
  if (h < 21) return "dinner";
  return "snack";
}

function sumTotals(meals: LoggedMeal[]): MealTotals {
  return meals.reduce(
    (acc, m) => ({
      calories: acc.calories + m.totals.calories,
      protein:  acc.protein  + m.totals.protein,
      carbs:    acc.carbs    + m.totals.carbs,
      fat:      acc.fat      + m.totals.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

function buildSuggestions(
  targets: NutritionTargets,
  totals:  MealTotals,
  hydration: number,
  mealCount: number,
): Suggestion[] {
  const calPct   = totals.calories / targets.calories;
  const waterPct = hydration / targets.waterMl;
  const out: Suggestion[] = [];

  if (mealCount === 0) {
    out.push({
      id: "start", type: "info",
      label: "Start logging your meals",
      body: "Use voice or photo to track today's intake and get personalised suggestions.",
    });
  }

  if (waterPct < 0.45 && mealCount > 0) {
    out.push({
      id: "water", type: "info",
      label: "Increase water intake",
      body: `${(hydration / 1000).toFixed(1)}L of ${(targets.waterMl / 1000).toFixed(1)}L target. Pace at 500ml/hr through the afternoon.`,
    });
  }

  if (mealCount > 0 && calPct < 0.55) {
    out.push({
      id: "cals-low", type: "warning",
      label: "Calories tracking low",
      body: `${Math.round(totals.calories).toLocaleString()} of ${targets.calories.toLocaleString()} kcal consumed.`,
    });
  }

  if (mealCount > 0 && calPct >= 0.85 && calPct <= 1.0) {
    out.push({
      id: "on-track", type: "positive",
      label: "Calorie balance is clean",
      body: `${Math.round(calPct * 100)}% of daily target reached. Keep dinner on plan to finish strong.`,
    });
  }

  if (mealCount > 0 && calPct > 1.05) {
    out.push({
      id: "over", type: "warning",
      label: "Over daily calorie target",
      body: `${Math.round(totals.calories - targets.calories).toLocaleString()} kcal over goal.`,
    });
  }

  return out.slice(0, 3);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProgressBar({ value, max, color = "bg-[#B48B40]", height = "h-1.5" }: {
  value: number; max: number; color?: string; height?: string;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className={cn("w-full rounded-full bg-white/[0.06] overflow-hidden", height)}>
      <div
        className={cn("h-full rounded-full transition-all duration-700", color)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function CalorieCard({ consumed, target }: { consumed: number; target: number }) {
  const remaining = Math.max(0, target - consumed);
  const pct = target > 0 ? Math.min(Math.round((consumed / target) * 100), 100) : 0;
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#111111] px-5 py-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.22em] text-white/28">Calories</p>
        <Flame className="w-3.5 h-3.5 text-[#B48B40]/40" strokeWidth={1.5} />
      </div>
      <div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[1.6rem] font-semibold tabular-nums leading-none text-white/90">
            {Math.round(consumed).toLocaleString()}
          </span>
          <span className="text-sm text-white/28">/ {target.toLocaleString()}</span>
        </div>
        <p className="text-xs text-white/30 mt-1">{Math.round(remaining).toLocaleString()} kcal remaining</p>
      </div>
      <ProgressBar value={consumed} max={target} />
      <p className="text-[10px] text-white/20 tabular-nums">{pct}% of daily target</p>
    </div>
  );
}

function MacrosCard({ totals, targets }: {
  totals: MealTotals;
  targets: NutritionTargets;
}) {
  const rows = [
    { label: "Protein", value: totals.protein, target: targets.proteinG, color: "bg-[#B48B40]" },
    { label: "Carbs",   value: totals.carbs,   target: targets.carbsG,   color: "bg-white/40" },
    { label: "Fats",    value: totals.fat,      target: targets.fatG,     color: "bg-[#93C5FD]/60" },
  ];
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#111111] px-5 py-4 flex flex-col gap-4">
      <p className="text-[10px] uppercase tracking-[0.22em] text-white/28">Macros</p>
      <div className="space-y-3.5">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-white/40">{r.label}</span>
              <span className="text-xs tabular-nums text-white/50">
                {Math.round(r.value)}g <span className="text-white/22">/ {r.target}g</span>
              </span>
            </div>
            <ProgressBar value={r.value} max={r.target} color={r.color} />
          </div>
        ))}
      </div>
    </div>
  );
}

function HydrationCard({ current, target, onAdd }: {
  current: number; target: number; onAdd: (ml: number) => void;
}) {
  const done = current >= target;
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#111111] px-5 py-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.22em] text-white/28">Hydration</p>
        <Droplets className={cn("w-3.5 h-3.5", done ? "text-[#93C5FD]" : "text-white/20")} strokeWidth={1.5} />
      </div>
      <div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[1.6rem] font-semibold tabular-nums leading-none text-white/90">
            {(current / 1000).toFixed(1)}L
          </span>
          <span className="text-sm text-white/28">/ {(target / 1000).toFixed(1)}L</span>
        </div>
        {done
          ? <p className="text-xs text-[#93C5FD]/60 mt-1">Daily target reached</p>
          : <p className="text-xs text-white/30 mt-1">{((target - current) / 1000).toFixed(1)}L remaining</p>
        }
      </div>
      <ProgressBar value={current} max={target} color="bg-[#93C5FD]/60" />
      <div className="flex gap-1.5">
        {[250, 500, 750].map((ml) => (
          <button
            key={ml}
            onClick={() => onAdd(ml)}
            disabled={done}
            className="flex-1 text-[11px] font-medium text-white/40 border border-white/[0.07] bg-white/[0.02] hover:text-white/70 hover:border-white/15 disabled:opacity-30 rounded-xl py-1.5 transition-all"
          >
            +{ml}
          </button>
        ))}
      </div>
    </div>
  );
}

function QuickActionTile({
  icon: Icon, label, description, onClick, primary,
}: {
  icon: React.ElementType; label: string; description: string;
  onClick: () => void; primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3.5 rounded-2xl border px-4 py-3.5 text-left w-full transition-all hover:scale-[1.01] active:scale-[0.98]",
        primary
          ? "border-[#B48B40]/22 bg-[#B48B40]/[0.04] hover:bg-[#B48B40]/[0.07] hover:border-[#B48B40]/32"
          : "border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/12",
      )}
    >
      <div className={cn(
        "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border",
        primary ? "bg-[#B48B40]/10 border-[#B48B40]/22" : "bg-white/[0.05] border-white/[0.08]",
      )}>
        <Icon className={cn("w-4 h-4", primary ? "text-[#B48B40]/80" : "text-white/40")} strokeWidth={1.5} />
      </div>
      <div className="min-w-0">
        <p className={cn("text-sm font-medium leading-snug", primary ? "text-white/80" : "text-white/60")}>
          {label}
        </p>
        <p className="text-[11px] text-white/28 leading-none mt-0.5">{description}</p>
      </div>
    </button>
  );
}

const SUGG_CONFIG: Record<SuggType, { Icon: typeof AlertCircle; text: string; bg: string; border: string }> = {
  warning:  { Icon: AlertCircle, text: "text-[#FBBF24]",  bg: "bg-[#FBBF24]/5",  border: "border-[#FBBF24]/15" },
  info:     { Icon: Droplets,    text: "text-[#93C5FD]",  bg: "bg-[#93C5FD]/5",  border: "border-[#93C5FD]/15" },
  positive: { Icon: TrendingUp,  text: "text-emerald-400", bg: "bg-emerald-400/5", border: "border-emerald-400/15" },
};

function SuggestionCard({ s, onDismiss }: { s: Suggestion; onDismiss: () => void }) {
  const { Icon, text, bg, border } = SUGG_CONFIG[s.type];
  return (
    <div className={cn("rounded-2xl border px-4 py-3.5 flex items-start gap-3", bg, border)}>
      <Icon className={cn("w-3.5 h-3.5 shrink-0 mt-0.5", text)} strokeWidth={1.5} />
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium mb-0.5", text)}>{s.label}</p>
        <p className="text-xs text-white/45 leading-relaxed">{s.body}</p>
      </div>
      <button onClick={onDismiss} className="shrink-0 text-white/20 hover:text-white/45 transition-colors mt-0.5">
        <X className="w-3.5 h-3.5" strokeWidth={1.5} />
      </button>
    </div>
  );
}

function MealCard({
  meal,
  onDelete,
  onVoiceLog,
}: {
  meal: LoggedMeal | null;  // null = empty slot
  slotKey: MealSlotKey;
  onDelete: (id: string) => void;
  onVoiceLog: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!meal) {
    return (
      <button
        onClick={onVoiceLog}
        className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-white/[0.06] text-white/20 hover:text-white/40 hover:border-white/12 transition-all text-xs"
      >
        <Mic className="w-3 h-3" strokeWidth={1.5} />
        Log
      </button>
    );
  }

  const mealLabel = meal.cleanTranscript ?? meal.items.slice(0, 2).map((i) => i.name).join(", ");
  const timeStr   = new Date(meal.eatenAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#111111] overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-white/[0.015] transition-colors"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white/75 truncate">{mealLabel}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={cn(
              "text-[9px] font-semibold uppercase tracking-[0.12em]",
              meal.source === "voice" ? "text-[#B48B40]/60" : meal.source === "photo" ? "text-[#93C5FD]/60" : "text-white/25",
            )}>
              {meal.source}
            </span>
            <span className="text-[10px] text-white/22 flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" strokeWidth={1.5} />
              {timeStr}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {meal.totals.calories > 0 && (
            <span className="text-sm tabular-nums text-white/40">{Math.round(meal.totals.calories)} kcal</span>
          )}
          {expanded
            ? <ChevronUp   className="w-4 h-4 text-white/18" strokeWidth={1.5} />
            : <ChevronDown className="w-4 h-4 text-white/18" strokeWidth={1.5} />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-white/[0.05] px-4 pb-4 pt-3.5 space-y-3">
          {/* Food items */}
          <div className="space-y-1.5">
            {meal.items.map((item) => {
              const label = [
                item.quantity != null ? `${item.quantity}` : "",
                item.unit && item.unit !== "item" ? item.unit : "",
                item.name,
              ].filter(Boolean).join(" ");
              return (
                <div key={item.id} className="flex items-center gap-2.5">
                  <span className="w-1 h-1 rounded-full bg-white/25 shrink-0" />
                  <span className="text-sm text-white/60">{label}</span>
                  {item.calories != null && (
                    <span className="ml-auto text-[10px] text-white/22 tabular-nums shrink-0">
                      {Math.round(item.calories)} kcal
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Macro row */}
          {(meal.totals.protein > 0 || meal.totals.carbs > 0 || meal.totals.fat > 0) && (
            <div className="flex items-center gap-3 pt-2 border-t border-white/[0.04]">
              {[
                { label: "P", value: meal.totals.protein, color: "text-[#B48B40]/70" },
                { label: "C", value: meal.totals.carbs,   color: "text-[#93C5FD]/60" },
                { label: "F", value: meal.totals.fat,     color: "text-emerald-400/55" },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-baseline gap-0.5">
                  <span className={cn("text-xs font-semibold tabular-nums", color)}>{Math.round(value)}g</span>
                  <span className="text-[10px] text-white/20">{label}</span>
                </div>
              ))}
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(meal.id); }}
                className="ml-auto flex items-center gap-1 text-[10px] text-white/18 hover:text-[#EF4444]/50 transition-colors"
              >
                <Trash2 className="w-3 h-3" strokeWidth={1.5} />
                Remove
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({
  dateLabel,
  onVoiceLog,
  onPhoto,
}: {
  dateLabel: string;
  onVoiceLog: () => void;
  onPhoto: () => void;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#0D0D0D] px-6 py-10 flex flex-col items-center text-center gap-5">
      <div className="w-12 h-12 rounded-2xl border border-white/[0.07] bg-white/[0.03] flex items-center justify-center">
        <span className="text-xl">🍽️</span>
      </div>
      <div>
        <p className="text-sm font-medium text-white/55">No meals logged for {dateLabel.toLowerCase()}</p>
        <p className="text-xs text-white/28 mt-1 leading-relaxed">
          Log your first meal to start tracking your intake
        </p>
      </div>
      <div className="flex items-center gap-2.5">
        <button
          onClick={onVoiceLog}
          className="flex items-center gap-2 rounded-xl border border-[#B48B40]/22 bg-[#B48B40]/[0.06] px-4 py-2 text-sm font-medium text-[#B48B40]/80 hover:bg-[#B48B40]/10 hover:border-[#B48B40]/32 transition-all"
        >
          <Mic className="w-3.5 h-3.5" strokeWidth={1.5} />
          Voice log
        </button>
        <button
          onClick={onPhoto}
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-white/45 hover:text-white/65 hover:border-white/18 transition-all"
        >
          <Camera className="w-3.5 h-3.5" strokeWidth={1.5} />
          Photo scan
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NutritionPage() {
  const { user } = useUser();
  const voice    = useVoiceInput();

  // Targets from intake
  const [targets,   setTargets]   = useState<NutritionTargets>(FALLBACK);
  const [hasIntake, setHasIntake] = useState(false);

  // Date navigation
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [viewWeek,     setViewWeek]     = useState(false);

  // Meal data (loaded from store)
  const [meals,     setMeals]     = useState<LoggedMeal[]>([]);
  const weekMeals                 = useMemo(() => {
    if (!viewWeek) return [];
    return getMealsForRange(user.id, getLast7Start(), todayISO());
  }, [user.id, viewWeek]);

  // UI state
  const [hydration,     setHydration]     = useState(0);
  const [analysisOpen,  setAnalysisOpen]  = useState(false);
  const [showVoice,     setShowVoice]     = useState(false);
  const [voiceSlot,     setVoiceSlot]     = useState<MealSlotKey | null>(null);
  const [dismissed,     setDismissed]     = useState<string[]>([]);
  const [noteOpen,      setNoteOpen]      = useState(false);
  const [note,          setNote]          = useState("");

  // Voice → parse → review flow
  const [parsing,         setParsing]         = useState(false);
  const [pendingParse,    setPendingParse]     = useState<NutritionParseResult | null>(null);
  const [pendingTranscript, setPendingTranscript] = useState<string>("");

  // Load targets
  useEffect(() => {
    const intake = loadIntake(user.id);
    if (intake) {
      const calc = calculateNutritionTargets(intake);
      if (calc) { setTargets(calc); setHasIntake(true); return; }
    }
    setHasIntake(false);
  }, [user.id]);

  // Load meals for selected date
  useEffect(() => {
    setMeals(getMealsForDate(user.id, selectedDate));
  }, [user.id, selectedDate]);

  // Totals derived from real meal data
  const totals = useMemo(() => sumTotals(viewWeek ? weekMeals : meals), [meals, weekMeals, viewWeek]);

  // Suggestions
  const suggestions = useMemo(() =>
    buildSuggestions(targets, totals, hydration, meals.length)
      .filter((s) => !dismissed.includes(s.id)),
    [targets, totals, hydration, meals.length, dismissed],
  );

  // Group meals by slot (for day view)
  const mealsBySlot = useMemo<Record<MealSlotKey, LoggedMeal[]>>(() => {
    const map: Record<MealSlotKey, LoggedMeal[]> = {
      breakfast: [], pre_workout: [], lunch: [],
      post_workout: [], dinner: [], snack: [],
    };
    meals.forEach((m) => {
      const slot = mealToSlot(m);
      map[slot].push(m);
    });
    return map;
  }, [meals]);

  const isToday = selectedDate === todayISO();

  // ── Handlers ──────────────────────────────────────────────────────────────

  function openVoiceForSlot(slot: MealSlotKey | null = null) {
    setVoiceSlot(slot);
    setShowVoice(true);
  }

  async function handleVoiceConfirm() {
    const transcript = voice.transcript.trim();
    if (!transcript) return;

    setShowVoice(false);
    setParsing(true);

    try {
      const res = await fetch("/api/ai/nutrition", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ mode: "parse", transcript }),
      });

      if (!res.ok) throw new Error("parse failed");
      const data: NutritionParseResult = await res.json();

      if (data.confidence >= 0.75) {
        // High confidence — save directly
        handleParseSave(data, transcript);
      } else {
        // Medium/low confidence — show review
        setPendingTranscript(transcript);
        setPendingParse(data);
      }
    } catch {
      // API unavailable — save with zero macros so we at least record the event
      const { parseMealFromTranscript } = await import("@/lib/voiceParser");
      const fallback = parseMealFromTranscript(transcript);
      const now  = new Date().toISOString();
      const meal = saveMeal(user.id, {
        userId:          user.id,
        source:          "voice",
        mealType:        (fallback.mealType as MealType) ?? "unknown",
        eatenAt:         now,
        rawTranscript:   transcript,
        cleanTranscript: fallback.name,
        notes:           null,
        items:           fallback.items.map((i, idx) => ({
          id:         `fi_${Date.now()}_${idx}`,
          name:       i.food,
          quantity:   i.quantity ? parseFloat(i.quantity) : null,
          unit:       i.unit ?? null,
          grams:      null,
          calories:   null,
          protein:    null,
          carbs:      null,
          fat:        null,
          confidence: fallback.confidence,
          source:     "voice" as const,
        })),
        totals:      { calories: 0, protein: 0, carbs: 0, fat: 0 },
        needsReview: true,
      });
      setMeals((prev) => [meal, ...prev]);
    } finally {
      setParsing(false);
      setVoiceSlot(null);
      voice.reset();
    }
  }

  function handleParseSave(data: NutritionParseResult, rawTranscript: string) {
    const now = new Date().toISOString();
    // voiceSlot is a MealSlotKey; map it to a MealType
    const SLOT_TO_MEAL_TYPE: Record<MealSlotKey, MealType> = {
      breakfast:    "breakfast",
      pre_workout:  "snack",
      lunch:        "lunch",
      post_workout: "snack",
      dinner:       "dinner",
      snack:        "snack",
    };
    const mealType: MealType = voiceSlot
      ? SLOT_TO_MEAL_TYPE[voiceSlot]
      : data.mealType === "unknown" ? "snack" : data.mealType;

    const meal: LoggedMeal = saveMeal(user.id, {
      userId:          user.id,
      source:          "voice",
      mealType,
      eatenAt:         now,
      rawTranscript,
      cleanTranscript: data.cleanTranscript,
      notes:           null,
      items:           data.items.map((item, i) => ({
        id:         `fi_${Date.now()}_${i}`,
        name:       item.name,
        quantity:   item.quantity,
        unit:       item.unit,
        grams:      item.grams,
        calories:   item.calories,
        protein:    item.protein,
        carbs:      item.carbs,
        fat:        item.fat,
        confidence: item.confidence,
        source:     "voice" as const,
      })),
      totals:      data.totals,
      needsReview: false,
    });

    if (meal.eatenAt.slice(0, 10) === selectedDate) {
      setMeals((prev) => [meal, ...prev]);
    }
  }

  function handleReviewSave(meal: LoggedMeal) {
    setPendingParse(null);
    setPendingTranscript("");
    if (meal.eatenAt.slice(0, 10) === selectedDate) {
      setMeals((prev) => [meal, ...prev]);
    }
  }

  function handleMealLogged(meal: LoggedMeal) {
    setAnalysisOpen(false);
    if (meal.eatenAt.slice(0, 10) === selectedDate) {
      setMeals((prev) => [meal, ...prev]);
    }
  }

  function handleDelete(mealId: string) {
    storageDeleteMeal(user.id, mealId);
    setMeals((prev) => prev.filter((m) => m.id !== mealId));
  }

  function addWater(ml: number) {
    setHydration((v) => Math.min(v + ml, targets.waterMl));
  }

  const dateLabel = viewWeek ? "Last 7 days" : formatDateLabel(selectedDate);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="px-5 md:px-8 py-6 text-white">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-[2.6rem] font-semibold tracking-tight leading-none mb-2">Nutrition</h1>
            <p className="text-white/35 text-base">{dateLabel}</p>
          </div>
        </div>

        {/* ── No intake banner ────────────────────────────────────────────── */}
        {!hasIntake && (
          <div className="rounded-2xl border border-[#B48B40]/18 bg-[#B48B40]/[0.04] px-5 py-3.5 flex items-center gap-3">
            <AlertCircle className="w-4 h-4 text-[#B48B40]/60 shrink-0" strokeWidth={1.5} />
            <p className="text-sm text-white/50 flex-1">Showing estimated targets — complete your intake to personalise.</p>
            <Link href="/onboarding/calibration" className="text-xs font-semibold text-[#B48B40] hover:text-[#c99840] transition-colors shrink-0">
              Complete intake →
            </Link>
          </div>
        )}

        {/* ── Date / range controls ───────────────────────────────────────── */}
        <div className="flex items-center gap-2.5">
          {/* Prev day */}
          {!viewWeek && (
            <button
              onClick={() => setSelectedDate((d) => offsetDate(d, -1))}
              className="w-8 h-8 rounded-xl border border-white/[0.08] bg-white/[0.02] flex items-center justify-center text-white/30 hover:text-white/60 hover:border-white/15 transition-all shrink-0"
            >
              <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
            </button>
          )}

          {/* Date label */}
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <p className="text-sm font-medium text-white/60 truncate">{dateLabel}</p>
            {!isToday && !viewWeek && (
              <button
                onClick={() => setSelectedDate(todayISO())}
                className="text-[11px] text-[#B48B40]/70 hover:text-[#B48B40] transition-colors shrink-0"
              >
                Back to today
              </button>
            )}
          </div>

          {/* Next day (only if not today) */}
          {!viewWeek && !isToday && (
            <button
              onClick={() => setSelectedDate((d) => offsetDate(d, 1))}
              className="w-8 h-8 rounded-xl border border-white/[0.08] bg-white/[0.02] flex items-center justify-center text-white/30 hover:text-white/60 hover:border-white/15 transition-all shrink-0"
            >
              <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
            </button>
          )}

          {/* Week toggle */}
          <button
            onClick={() => setViewWeek((v) => !v)}
            className={cn(
              "px-3 py-1.5 rounded-xl border text-[11px] font-medium transition-all shrink-0",
              viewWeek
                ? "border-[#B48B40]/30 bg-[#B48B40]/8 text-[#B48B40]"
                : "border-white/[0.08] text-white/30 hover:text-white/55 hover:border-white/15",
            )}
          >
            7 days
          </button>
        </div>

        {/* ── Summary cards ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <CalorieCard consumed={totals.calories} target={targets.calories} />
          <MacrosCard  totals={totals}            targets={targets} />
          <HydrationCard current={hydration}      target={targets.waterMl} onAdd={addWater} />
        </div>

        {/* ── Quick actions ────────────────────────────────────────────────── */}
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-white/25 mb-3 px-1">Quick actions</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
            <QuickActionTile
              icon={Mic}      label="Voice log meal"    description="Say what you ate"
              onClick={() => openVoiceForSlot(null)}   primary
            />
            <QuickActionTile
              icon={Camera}   label="Photo scan"        description="Snap your plate"
              onClick={() => setAnalysisOpen(true)}
            />
            <QuickActionTile
              icon={Sparkles} label="AI food analysis"  description="Analyze · portion guidance"
              onClick={() => setAnalysisOpen(true)}
            />
            <QuickActionTile
              icon={Plus}     label="Add manually"      description="Enter foods directly"
              onClick={() => openVoiceForSlot(null)}
            />
          </div>
        </div>

        {/* ── AI suggestions ──────────────────────────────────────────────── */}
        {!viewWeek && suggestions.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-white/25 mb-3 px-1">◈ AI suggestions</p>
            <div className="space-y-2">
              {suggestions.map((s) => (
                <SuggestionCard
                  key={s.id}
                  s={s}
                  onDismiss={() => setDismissed((d) => [...d, s.id])}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Parsing indicator ───────────────────────────────────────────── */}
        {parsing && (
          <div className="rounded-2xl border border-white/[0.07] bg-[#111111] px-5 py-4 flex items-center gap-3">
            <Loader2 className="w-4 h-4 text-[#B48B40]/60 animate-spin shrink-0" strokeWidth={1.5} />
            <p className="text-sm text-white/45">Analysing meal…</p>
          </div>
        )}

        {/* ── Meal timeline ────────────────────────────────────────────────── */}
        {!viewWeek && (
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-white/25 mb-3 px-1">
              Meal timeline
            </p>

            {meals.length === 0 && !parsing ? (
              <EmptyState
                dateLabel={dateLabel}
                onVoiceLog={() => openVoiceForSlot(null)}
                onPhoto={() => setAnalysisOpen(true)}
              />
            ) : (
              <div className="space-y-4">
                {SLOT_ORDER.map((slotKey) => {
                  const slotMeals = mealsBySlot[slotKey];
                  const meta      = SLOT_META[slotKey];
                  return (
                    <div key={slotKey}>
                      {/* Slot header */}
                      <div className="flex items-center gap-2.5 mb-2 px-1">
                        <span className="text-base select-none">{meta.icon}</span>
                        <span className="text-xs font-semibold text-white/50">{meta.label}</span>
                        <span className="text-[10px] text-white/20 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" strokeWidth={1.5} />
                          {meta.time}
                        </span>
                        {slotMeals.length > 0 && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-emerald-400/8 text-emerald-400/70 border border-emerald-400/12 ml-auto">
                            {slotMeals.length} logged
                          </span>
                        )}
                      </div>

                      {/* Meals for this slot */}
                      <div className="space-y-2 pl-0">
                        {slotMeals.map((meal) => (
                          <MealCard
                            key={meal.id}
                            meal={meal}
                            slotKey={slotKey}
                            onDelete={handleDelete}
                            onVoiceLog={() => openVoiceForSlot(slotKey)}
                          />
                        ))}
                        {/* Empty slot "log" button */}
                        {slotMeals.length === 0 && (
                          <MealCard
                            meal={null}
                            slotKey={slotKey}
                            onDelete={handleDelete}
                            onVoiceLog={() => openVoiceForSlot(slotKey)}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Week view ────────────────────────────────────────────────────── */}
        {viewWeek && (
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-white/25 mb-3 px-1">
              7-day log
            </p>
            {weekMeals.length === 0 ? (
              <div className="rounded-2xl border border-white/[0.06] bg-[#0D0D0D] px-6 py-8 text-center">
                <p className="text-sm text-white/40">No meals logged in the last 7 days</p>
              </div>
            ) : (
              <div className="space-y-2">
                {Array.from(new Set(weekMeals.map((m) => m.eatenAt.slice(0, 10))))
                  .sort((a, b) => b.localeCompare(a))
                  .map((date) => {
                    const dayMeals = weekMeals.filter((m) => m.eatenAt.slice(0, 10) === date);
                    const dayTotals = sumTotals(dayMeals);
                    return (
                      <div key={date} className="rounded-2xl border border-white/[0.07] bg-[#111111] overflow-hidden">
                        <div className="px-5 py-3.5 flex items-center justify-between border-b border-white/[0.05]">
                          <span className="text-sm font-medium text-white/65">{formatDateLabel(date)}</span>
                          <div className="flex items-center gap-3 text-xs text-white/35 tabular-nums">
                            <span>{Math.round(dayTotals.calories)} kcal</span>
                            <span>{dayMeals.length} meal{dayMeals.length !== 1 ? "s" : ""}</span>
                            <button
                              onClick={() => { setViewWeek(false); setSelectedDate(date); }}
                              className="text-[#B48B40]/60 hover:text-[#B48B40] transition-colors ml-1"
                            >
                              View →
                            </button>
                          </div>
                        </div>
                        <ProgressBar value={dayTotals.calories} max={targets.calories} height="h-1" />
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* ── Nutrition notes ──────────────────────────────────────────────── */}
        <div>
          <button
            onClick={() => setNoteOpen((v) => !v)}
            className="w-full flex items-center justify-between mb-3 px-1"
          >
            <p className="text-[10px] uppercase tracking-[0.22em] text-white/25">Nutrition notes</p>
            {noteOpen
              ? <ChevronUp className="w-3.5 h-3.5 text-white/18" strokeWidth={1.5} />
              : <ChevronDown className="w-3.5 h-3.5 text-white/18" strokeWidth={1.5} />}
          </button>
          {noteOpen && (
            <div className="rounded-2xl border border-white/[0.07] bg-[#111111] px-5 py-4">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Personal notes, food preferences, or anything your coach should know…"
                rows={3}
                className="w-full bg-transparent text-sm text-white/60 placeholder:text-white/20 resize-none outline-none leading-relaxed"
              />
              {note && (
                <div className="flex justify-end mt-2 pt-2 border-t border-white/[0.05]">
                  <button className="text-xs text-[#B48B40] hover:text-[#c99840] transition-colors">Save note</button>
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      <AIFoodAnalysis
        open={analysisOpen}
        onClose={() => setAnalysisOpen(false)}
        userId={user.id}
        targets={targets}
        onMealLogged={handleMealLogged}
      />

      {showVoice && (
        <VoiceReviewModal
          status={voice.status}
          transcript={voice.transcript}
          interim={voice.interim}
          confidence={voice.confidence}
          error={voice.error}
          isSupported={voice.isSupported}
          label={voiceSlot ? `Log ${SLOT_META[voiceSlot].label}` : "Voice meal log"}
          placeholder={
            voiceSlot
              ? `Describe your ${SLOT_META[voiceSlot].label.toLowerCase()}…`
              : "e.g. 'I had 3 eggs, 100g oats, and a black coffee for breakfast'"
          }
          onStart={voice.start}
          onStop={voice.stop}
          onReset={voice.reset}
          onTranscriptChange={voice.setTranscript}
          onConfirm={handleVoiceConfirm}
          onCancel={() => { setShowVoice(false); setVoiceSlot(null); voice.reset(); }}
        />
      )}

      {pendingParse && (
        <MealReviewModal
          parseResult={pendingParse}
          rawTranscript={pendingTranscript}
          source="voice"
          userId={user.id}
          initialSlot={voiceSlot}
          onSave={handleReviewSave}
          onCancel={() => { setPendingParse(null); setPendingTranscript(""); }}
        />
      )}
    </div>
  );
}
