"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Mic, Camera, Plus, Sparkles, Plane, Droplets, Flame,
  ChevronDown, ChevronUp, AlertCircle, TrendingUp, Check,
  X, Clock,
} from "lucide-react";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { VoiceReviewModal } from "@/components/voice/VoiceReviewModal";
import { parseMealFromTranscript } from "@/lib/voiceParser";
import { saveVoiceEntry } from "@/lib/voiceLogs";
import { cn } from "@/lib/utils";
import { AIFoodAnalysis } from "@/components/nutrition/AIFoodAnalysis";
import { useUser } from "@/context/UserContext";
import { loadIntake } from "@/lib/data/intake";
import { calculateNutritionTargets, type NutritionTargets } from "@/lib/nutrition";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type MealSlotKey = "breakfast" | "pre_workout" | "lunch" | "post_workout" | "dinner" | "snack";
type LogSource   = "voice" | "photo" | "manual";
type SuggType    = "warning" | "info" | "positive";

type LoggedEntry = {
  id:           string;
  slot:         MealSlotKey;
  displayItems: string[];
  calories:     number;
  loggedAt:     string; // ISO
  source:       LogSource;
};

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

type TemplateEntry = { items: string[]; calories: number; note?: string } | null;

const STANDARD_TEMPLATES: Record<MealSlotKey, TemplateEntry> = {
  breakfast:    { items: ["3 eggs scrambled", "100g oats with berries", "1 banana", "Black coffee"], calories: 520, note: "Eat within 30 min of waking." },
  pre_workout:  { items: ["Greek yogurt 200g", "30g whey protein", "1 apple"], calories: 320 },
  lunch:        { items: ["200g chicken breast", "150g white rice", "Mixed greens + olive oil", "1 tbsp peanut butter"], calories: 650, note: "Largest carb window. Don't skip." },
  post_workout: { items: ["40g whey protein", "1 rice cake", "Electrolyte drink"], calories: 280 },
  dinner:       { items: ["Salmon fillet 180g", "Sweet potato 150g", "Steamed broccoli", "Drizzle of olive oil"], calories: 560, note: "Keep lighter if training was early." },
  snack:        null,
};

const TRAVEL_TEMPLATES: Record<MealSlotKey, TemplateEntry> = {
  breakfast:    { items: ["Hotel eggs x3", "Fruit plate", "Black coffee"], calories: 480, note: "Most hotels have a buffet — protein first." },
  pre_workout:  { items: ["Protein bar 25g+", "Sparkling water"], calories: 220 },
  lunch:        { items: ["Grilled protein", "Side salad", "Avoid excess sauces"], calories: 600 },
  post_workout: null,
  dinner:       { items: ["Sushi or grilled fish", "Rice if available", "Miso soup"], calories: 580 },
  snack:        null,
};

const SLOT_ORDER: MealSlotKey[] = [
  "breakfast", "pre_workout", "lunch", "post_workout", "dinner", "snack",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parserTypeToSlot(mealType: string | undefined, loggedAt: string): MealSlotKey {
  if (mealType === "breakfast") return "breakfast";
  if (mealType === "lunch")     return "lunch";
  if (mealType === "dinner")    return "dinner";
  if (mealType === "snack")     return "snack";
  // Infer from time-of-day
  const h = new Date(loggedAt).getHours();
  if (h <  9) return "breakfast";
  if (h < 12) return "pre_workout";
  if (h < 15) return "lunch";
  if (h < 18) return "post_workout";
  if (h < 20) return "dinner";
  return "snack";
}

function formatItems(items: { food: string; quantity?: string; unit?: string }[]): string[] {
  return items.map((i) => {
    const qty = i.quantity ? `${i.quantity}${i.unit ? ` ${i.unit}` : ""} ` : "";
    return `${qty}${i.food}`.trim();
  }).filter(Boolean);
}

function buildSuggestions(
  targets: NutritionTargets,
  consumedCal: number,
  hydration: number,
  logsCount: number,
): Suggestion[] {
  const calPct   = consumedCal / targets.calories;
  const waterPct = hydration   / targets.waterMl;
  const out: Suggestion[] = [];

  if (logsCount === 0) {
    out.push({
      id: "start",
      type: "info",
      label: "Start logging your meals",
      body: "Use voice or photo to track today's intake and get personalized suggestions.",
    });
  }

  if (waterPct < 0.45 && logsCount > 0) {
    out.push({
      id: "water",
      type: "info",
      label: "Increase water intake",
      body: `${(hydration / 1000).toFixed(1)}L of ${(targets.waterMl / 1000).toFixed(1)}L target. Pace at 500ml/hr through the afternoon.`,
    });
  }

  if (logsCount > 0 && calPct < 0.55) {
    out.push({
      id: "cals-low",
      type: "warning",
      label: "Calories tracking low",
      body: `${consumedCal.toLocaleString()} of ${targets.calories.toLocaleString()} kcal consumed. Make sure lunch and post-workout meals are on track.`,
    });
  }

  if (logsCount > 0 && calPct >= 0.85 && calPct <= 1.0) {
    out.push({
      id: "on-track",
      type: "positive",
      label: "Calorie balance is clean",
      body: `${Math.round(calPct * 100)}% of daily target reached. Keep dinner on plan to finish strong.`,
    });
  }

  if (logsCount > 0 && calPct > 1.05) {
    out.push({
      id: "over",
      type: "warning",
      label: "Over daily calorie target",
      body: `${(consumedCal - targets.calories).toLocaleString()} kcal over goal. Consider a lighter dinner to stay in range.`,
    });
  }

  return out.slice(0, 3);
}

function today(): string {
  return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
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
            {consumed.toLocaleString()}
          </span>
          <span className="text-sm text-white/28">/ {target.toLocaleString()}</span>
        </div>
        <p className="text-xs text-white/30 mt-1">{remaining.toLocaleString()} kcal remaining</p>
      </div>
      <ProgressBar value={consumed} max={target} />
      <p className="text-[10px] text-white/20 tabular-nums">{pct}% of daily target</p>
    </div>
  );
}

function MacrosCard({ consumed, targets }: {
  consumed: { protein: number; carbs: number; fat: number };
  targets: NutritionTargets;
}) {
  const rows = [
    { label: "Protein", value: consumed.protein, target: targets.proteinG, color: "bg-[#B48B40]" },
    { label: "Carbs",   value: consumed.carbs,   target: targets.carbsG,   color: "bg-white/40" },
    { label: "Fats",    value: consumed.fat,     target: targets.fatG,     color: "bg-[#93C5FD]/60" },
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
                {r.value}g <span className="text-white/22">/ {r.target}g</span>
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
  const liters = (current / 1000).toFixed(1);
  const targetL = (target / 1000).toFixed(1);
  const done = current >= target;
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#111111] px-5 py-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.22em] text-white/28">Hydration</p>
        <Droplets className={cn("w-3.5 h-3.5", done ? "text-[#93C5FD]" : "text-white/20")} strokeWidth={1.5} />
      </div>
      <div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[1.6rem] font-semibold tabular-nums leading-none text-white/90">{liters}L</span>
          <span className="text-sm text-white/28">/ {targetL}L</span>
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
  icon: React.ElementType;
  label: string;
  description: string;
  onClick: () => void;
  primary?: boolean;
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
        primary
          ? "bg-[#B48B40]/10 border-[#B48B40]/22"
          : "bg-white/[0.05] border-white/[0.08]",
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

function MealSlotCard({
  slotKey,
  template,
  entries,
  expanded,
  onToggle,
  onVoiceLog,
}: {
  slotKey:   MealSlotKey;
  template:  TemplateEntry;
  entries:   LoggedEntry[];
  expanded:  boolean;
  onToggle:  () => void;
  onVoiceLog:() => void;
}) {
  const meta       = SLOT_META[slotKey];
  const hasLogged  = entries.length > 0;
  const loggedCal  = entries.reduce((s, e) => s + e.calories, 0);
  const displayCal = hasLogged ? loggedCal : (template?.calories ?? 0);
  const teaser     = hasLogged
    ? entries[0].displayItems.slice(0, 2).join(" · ") + (entries[0].displayItems.length > 2 ? " +more" : "")
    : template?.items.slice(0, 2).join(" · ") ?? "Nothing planned";

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#111111] overflow-hidden">
      {/* Header row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3.5 px-5 py-4 text-left hover:bg-white/[0.015] transition-colors"
      >
        <div className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center shrink-0 text-sm select-none">
          {meta.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-semibold text-white/85">{meta.label}</span>
            <span className="text-[11px] text-white/25 flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" strokeWidth={1.5} />
              {meta.time}
            </span>
            {hasLogged && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-emerald-400/8 text-emerald-400/70 border border-emerald-400/12">
                Logged
              </span>
            )}
          </div>
          {!expanded && (
            <p className="text-xs text-white/30 truncate">{teaser}</p>
          )}
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          {displayCal > 0 && (
            <span className="text-sm tabular-nums text-white/40">{displayCal} kcal</span>
          )}
          {expanded
            ? <ChevronUp className="w-4 h-4 text-white/18" strokeWidth={1.5} />
            : <ChevronDown className="w-4 h-4 text-white/18" strokeWidth={1.5} />}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-white/[0.05] px-5 pb-5 pt-4 space-y-4">

          {/* Logged entries */}
          {entries.map((entry) => (
            <div key={entry.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full shrink-0",
                  entry.source === "voice" ? "bg-[#B48B40]" : entry.source === "photo" ? "bg-[#93C5FD]" : "bg-white/30"
                )} />
                <span className="text-[10px] uppercase tracking-[0.14em] text-white/28">
                  {entry.source === "voice" ? "Voice logged" : entry.source === "photo" ? "Photo scanned" : "Manual"}&nbsp;·&nbsp;
                  {new Date(entry.loggedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  {entry.calories > 0 && ` · ${entry.calories} kcal`}
                </span>
              </div>
              {entry.displayItems.map((item, i) => (
                <div key={i} className="flex items-center gap-2.5 pl-3.5">
                  <Check className="w-3 h-3 text-emerald-400/50 shrink-0" strokeWidth={2.5} />
                  <span className="text-sm text-white/65">{item}</span>
                </div>
              ))}
            </div>
          ))}

          {/* Plan template */}
          {template && (
            <div className={cn("space-y-2", hasLogged && "opacity-35")}>
              {hasLogged && (
                <p className="text-[10px] uppercase tracking-[0.14em] text-white/22">Meal plan</p>
              )}
              {template.items.map((item, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <span className="w-1 h-1 rounded-full bg-white/20 shrink-0" />
                  <span className="text-sm text-white/50">{item}</span>
                </div>
              ))}
              {template.note && (
                <p className="text-xs text-[#B48B40]/55 leading-relaxed mt-2 pt-2 border-t border-white/[0.04]">
                  ◈ {template.note}
                </p>
              )}
            </div>
          )}

          {/* Log this meal CTA */}
          {!hasLogged && (
            <button
              onClick={(e) => { e.stopPropagation(); onVoiceLog(); }}
              className="flex items-center gap-1.5 text-xs text-white/25 hover:text-white/50 transition-colors"
            >
              <Mic className="w-3 h-3" strokeWidth={1.5} />
              Voice log this meal
            </button>
          )}
        </div>
      )}
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

  // Page state
  const [travelMode,    setTravelMode]    = useState(false);
  const [hydration,     setHydration]     = useState(0);
  const [analysisOpen,  setAnalysisOpen]  = useState(false);
  const [showVoice,     setShowVoice]     = useState(false);
  const [voiceSlot,     setVoiceSlot]     = useState<MealSlotKey | null>(null);
  const [expandedSlot,  setExpandedSlot]  = useState<MealSlotKey | null>(null);
  const [loggedEntries, setLoggedEntries] = useState<LoggedEntry[]>([]);
  const [dismissed,     setDismissed]     = useState<string[]>([]);
  const [noteOpen,      setNoteOpen]      = useState(false);
  const [note,          setNote]          = useState("");

  // Load targets from intake
  useEffect(() => {
    const intake = loadIntake(user.id);
    if (intake) {
      const calc = calculateNutritionTargets(intake);
      if (calc) { setTargets(calc); setHasIntake(true); return; }
    }
    setHasIntake(false);
  }, [user.id]);

  // Derived consumed totals
  const consumed = useMemo(() => {
    const cal     = loggedEntries.reduce((s, e) => s + e.calories, 0);
    // Macros: placeholder until a food-db lookup is integrated
    return { calories: cal, protein: 0, carbs: 0, fat: 0 };
  }, [loggedEntries]);

  // Suggestions (recalculate when data changes, filter dismissed)
  const suggestions = useMemo(() =>
    buildSuggestions(targets, consumed.calories, hydration, loggedEntries.length)
      .filter((s) => !dismissed.includes(s.id)),
    [targets, consumed.calories, hydration, loggedEntries.length, dismissed],
  );

  const templates = travelMode ? TRAVEL_TEMPLATES : STANDARD_TEMPLATES;

  // Entries grouped by slot
  const entriesBySlot = useMemo(() => {
    const map: Record<MealSlotKey, LoggedEntry[]> = {
      breakfast: [], pre_workout: [], lunch: [],
      post_workout: [], dinner: [], snack: [],
    };
    loggedEntries.forEach((e) => map[e.slot].push(e));
    return map;
  }, [loggedEntries]);

  // Meal plan calories total (for breakdown section)
  const planTotal = SLOT_ORDER.reduce(
    (s, k) => s + (templates[k]?.calories ?? 0), 0,
  );

  // ── Handlers ────────────────────────────────────────────────────────────────

  function openVoiceForSlot(slot: MealSlotKey | null = null) {
    setVoiceSlot(slot);
    setShowVoice(true);
  }

  function handleVoiceConfirm() {
    if (!voice.transcript.trim()) return;
    const parsed = parseMealFromTranscript(voice.transcript);
    const now    = new Date().toISOString();

    // Determine slot
    const detectedSlot = voiceSlot ?? parserTypeToSlot(parsed.mealType, now);

    // Build display items from parsed output
    const displayItems = formatItems(parsed.items);
    if (displayItems.length === 0) displayItems.push(parsed.name || "Meal logged");

    const entry: LoggedEntry = {
      id:           `log_${Date.now()}`,
      slot:         detectedSlot,
      displayItems,
      calories:     parsed.totalCals ?? 0,
      loggedAt:     now,
      source:       "voice",
    };

    saveVoiceEntry(user.id, {
      userId:     user.id,
      entryType:  "meal_log",
      transcript: voice.transcript,
      confidence: voice.confidence,
      parsedData: parsed,
    });

    setLoggedEntries((prev) => [...prev, entry]);
    setExpandedSlot(detectedSlot); // open the slot card so user sees what was logged
    setShowVoice(false);
    setVoiceSlot(null);
    voice.reset();
  }

  function addWater(ml: number) {
    setHydration((v) => Math.min(v + ml, targets.waterMl));
  }

  function toggleSlot(k: MealSlotKey) {
    setExpandedSlot((prev) => (prev === k ? null : k));
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="px-5 md:px-8 py-6 text-white">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-[2.6rem] font-semibold tracking-tight leading-none mb-2">Nutrition</h1>
            <p className="text-white/35 text-base">{today()}</p>
          </div>
          <button
            onClick={() => setTravelMode((v) => !v)}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-medium transition-all mb-1",
              travelMode
                ? "border-[#B48B40]/40 bg-[#B48B40]/8 text-[#B48B40]"
                : "border-white/10 text-white/35 hover:border-white/20 hover:text-white/60",
            )}
          >
            <Plane className="w-3.5 h-3.5" strokeWidth={1.5} />
            {travelMode ? "Travel mode on" : "Travel mode"}
          </button>
        </div>

        {/* ── No intake banner ───────────────────────────────────────────── */}
        {!hasIntake && (
          <div className="rounded-2xl border border-[#B48B40]/18 bg-[#B48B40]/[0.04] px-5 py-3.5 flex items-center gap-3">
            <AlertCircle className="w-4 h-4 text-[#B48B40]/60 shrink-0" strokeWidth={1.5} />
            <p className="text-sm text-white/50 flex-1">Showing estimated targets — complete your intake to personalise.</p>
            <Link href="/onboarding/calibration" className="text-xs font-semibold text-[#B48B40] hover:text-[#c99840] transition-colors shrink-0">
              Complete intake →
            </Link>
          </div>
        )}

        {/* ── Summary cards ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <CalorieCard consumed={consumed.calories} target={targets.calories} />
          <MacrosCard  consumed={consumed}           targets={targets} />
          <HydrationCard current={hydration}        target={targets.waterMl} onAdd={addWater} />
        </div>

        {/* ── Quick actions ──────────────────────────────────────────────── */}
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-white/25 mb-3 px-1">Quick actions</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
            <QuickActionTile
              icon={Sparkles}
              label="AI food analysis"
              description="Photo · voice · portion guidance"
              onClick={() => setAnalysisOpen(true)}
              primary
            />
            <QuickActionTile
              icon={Mic}
              label="Voice log meal"
              description="Say what you ate"
              onClick={() => openVoiceForSlot(null)}
            />
            <QuickActionTile
              icon={Camera}
              label="Photo scan"
              description="Snap your plate"
              onClick={() => setAnalysisOpen(true)}
            />
            <QuickActionTile
              icon={Plus}
              label="Add manually"
              description="Search or enter foods"
              onClick={() => openVoiceForSlot(null)}
            />
          </div>
        </div>

        {/* ── AI suggestions ─────────────────────────────────────────────── */}
        {suggestions.length > 0 && (
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

        {/* ── Daily meals ────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <p className="text-[10px] uppercase tracking-[0.22em] text-white/25">
              {travelMode ? "Travel meals" : "Daily meals"}
            </p>
            <span className="text-[10px] text-white/20 tabular-nums">
              {planTotal.toLocaleString()} kcal planned
            </span>
          </div>

          {travelMode && (
            <div className="rounded-xl border border-[#B48B40]/16 bg-[#B48B40]/[0.04] px-4 py-2.5 mb-3 flex items-start gap-2.5">
              <Plane className="w-3 h-3 text-[#B48B40]/60 shrink-0 mt-0.5" strokeWidth={1.5} />
              <p className="text-xs text-white/38 leading-relaxed">
                Travel meals are flexible and restaurant-friendly. Calories are approximate.
              </p>
            </div>
          )}

          <div className="space-y-2">
            {SLOT_ORDER.map((k) => (
              <MealSlotCard
                key={k}
                slotKey={k}
                template={templates[k]}
                entries={entriesBySlot[k]}
                expanded={expandedSlot === k}
                onToggle={() => toggleSlot(k)}
                onVoiceLog={() => openVoiceForSlot(k)}
              />
            ))}
          </div>
        </div>

        {/* ── Meal breakdown ─────────────────────────────────────────────── */}
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-white/25 mb-3 px-1">Meal breakdown</p>
          <div className="rounded-2xl border border-white/[0.07] bg-[#111111] px-5 py-4 space-y-3">
            {SLOT_ORDER.map((k) => {
              const tpl  = templates[k];
              const logs = entriesBySlot[k];
              const cal  = logs.length > 0
                ? logs.reduce((s, e) => s + e.calories, 0)
                : (tpl?.calories ?? 0);
              if (cal === 0) return null;
              const pct = (cal / targets.calories) * 100;
              const isLogged = logs.length > 0;
              return (
                <div key={k}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/40">{SLOT_META[k].label}</span>
                      {isLogged && <span className="text-[9px] text-emerald-400/60 font-semibold uppercase tracking-wide">✓</span>}
                    </div>
                    <span className="text-xs tabular-nums text-white/45">{cal} kcal</span>
                  </div>
                  <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", isLogged ? "bg-[#B48B40]/60" : "bg-white/18")}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            }).filter(Boolean)}
            <div className="pt-2.5 border-t border-white/[0.05] flex items-center justify-between">
              <span className="text-xs text-white/22">Total planned</span>
              <span className="text-xs font-semibold text-white/50 tabular-nums">
                {planTotal.toLocaleString()} kcal
              </span>
            </div>
          </div>
        </div>

        {/* ── Nutrition notes ────────────────────────────────────────────── */}
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

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      <AIFoodAnalysis open={analysisOpen} onClose={() => setAnalysisOpen(false)} />

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
    </div>
  );
}
