"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  Mic, Camera, Plus, Sparkles, Droplets, Flame,
  ChevronDown, ChevronUp, AlertCircle, TrendingUp,
  X, Clock, ChevronLeft, ChevronRight, Loader2, Trash2,
  Pencil, RotateCcw, CalendarDays, Search,
} from "lucide-react";
import { useVoiceInput }      from "@/hooks/useVoiceInput";
import { VoiceReviewModal }   from "@/components/voice/VoiceReviewModal";
import { MealReviewModal }    from "@/components/nutrition/MealReviewModal";
import { MealEditModal }      from "@/components/nutrition/MealEditModal";
import { AIFoodAnalysis }     from "@/components/nutrition/AIFoodAnalysis";
import { CalendarOverlay }    from "@/components/nutrition/CalendarOverlay";
import { NutritionAnalytics } from "@/components/nutrition/NutritionAnalytics";
import { FoodSearchModal }    from "@/components/nutrition/FoodSearchModal";
import { cn }                 from "@/lib/utils";
import { useUser }            from "@/context/UserContext";
import { loadIntake }         from "@/lib/data/intake";
import {
  calculateNutritionTargets,
  type NutritionTargets,
} from "@/lib/nutrition";
import {
  saveMeal,
  getMealsForDate,
  getMealsForRange,
  softDeleteMeal,
  restoreMeal,
  updateMeal,
  recalcMealTotals,
} from "@/lib/nutrition/store";
import {
  saveHydrationLog,
  getTotalHydrationForDate,
} from "@/lib/nutrition/hydration";
import { parseWaterFromTranscript } from "@/lib/nutrition/waterParser";
import type {
  LoggedMeal,
  LoggedFoodItem,
  MealType,
  NutritionParseResult,
  MealTotals,
} from "@/lib/nutrition/types";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type MealSlotKey = "breakfast" | "pre_workout" | "lunch" | "post_workout" | "dinner" | "snack";
type SuggType    = "warning" | "info" | "positive";

type Suggestion = { id: string; type: SuggType; label: string; body: string };

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
const MEAL_TYPE_TO_SLOT: Record<MealType, MealSlotKey> = {
  breakfast: "breakfast", lunch: "lunch", dinner: "dinner",
  snack: "snack",         unknown: "snack",
};
const SLOT_TO_MEAL_TYPE: Record<MealSlotKey, MealType> = {
  breakfast:    "breakfast",
  pre_workout:  "snack",
  lunch:        "lunch",
  post_workout: "snack",
  dinner:       "dinner",
  snack:        "snack",
};

// ─── Date helpers ─────────────────────────────────────────────────────────────

const toDateISO     = (d: Date) => d.toISOString().slice(0, 10);
const todayISO      = ()        => toDateISO(new Date());
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
const getLast7Start = () => offsetDate(todayISO(), -6);

// ─── Meal helpers ─────────────────────────────────────────────────────────────

function mealToSlot(meal: LoggedMeal): MealSlotKey {
  const type = meal.mealType;
  if (type && type in MEAL_TYPE_TO_SLOT) return MEAL_TYPE_TO_SLOT[type];
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

function mealDisplayName(meal: LoggedMeal): string {
  if (meal.cleanTranscript) return meal.cleanTranscript;
  const names = meal.items
    .filter((i) => !i.deletedAt)
    .slice(0, 2)
    .map((i) => i.name);
  return names.length ? names.join(", ") : "Logged meal";
}

// ─── Suggestions ──────────────────────────────────────────────────────────────

function buildSuggestions(
  targets: NutritionTargets,
  totals: MealTotals,
  hydration: number,
  mealCount: number,
): Suggestion[] {
  const calPct   = totals.calories / targets.calories;
  const waterPct = hydration / targets.waterMl;
  const out: Suggestion[] = [];

  if (mealCount === 0) {
    out.push({ id: "start", type: "info",
      label: "Start logging your meals",
      body: "Use voice or photo to track today's intake." });
  }
  if (waterPct < 0.45 && mealCount > 0) {
    out.push({ id: "water", type: "info",
      label: "Increase water intake",
      body: `${(hydration / 1000).toFixed(1)}L of ${(targets.waterMl / 1000).toFixed(1)}L target.` });
  }
  if (mealCount > 0 && calPct < 0.55) {
    out.push({ id: "cals-low", type: "warning",
      label: "Calories tracking low",
      body: `${Math.round(totals.calories).toLocaleString()} of ${targets.calories.toLocaleString()} kcal consumed.` });
  }
  if (mealCount > 0 && calPct >= 0.85 && calPct <= 1.0) {
    out.push({ id: "on-track", type: "positive",
      label: "Calorie balance is clean",
      body: `${Math.round(calPct * 100)}% of daily target reached.` });
  }
  if (mealCount > 0 && calPct > 1.05) {
    out.push({ id: "over", type: "warning",
      label: "Over daily calorie target",
      body: `${Math.round(totals.calories - targets.calories).toLocaleString()} kcal over goal.` });
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
      <div className={cn("h-full rounded-full transition-all duration-700", color)} style={{ width: `${pct}%` }} />
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

function MacrosCard({ totals, targets }: { totals: MealTotals; targets: NutritionTargets }) {
  const rows = [
    { label: "Protein", value: totals.protein, target: targets.proteinG, color: "bg-[#B48B40]"     },
    { label: "Carbs",   value: totals.carbs,   target: targets.carbsG,   color: "bg-white/40"       },
    { label: "Fats",    value: totals.fat,      target: targets.fatG,     color: "bg-[#93C5FD]/60"  },
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

function HydrationCard({
  current, target, onAdd,
}: { current: number; target: number; onAdd: (ml: number) => void }) {
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
          : <p className="text-xs text-white/30 mt-1">{((target - current) / 1000).toFixed(1)}L remaining</p>}
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
  warning:  { Icon: AlertCircle, text: "text-[#FBBF24]",   bg: "bg-[#FBBF24]/5",  border: "border-[#FBBF24]/15" },
  info:     { Icon: Droplets,    text: "text-[#93C5FD]",   bg: "bg-[#93C5FD]/5",  border: "border-[#93C5FD]/15" },
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

// ─── MealCard helpers ─────────────────────────────────────────────────────────

const CARD_UNIT_OPTIONS = ["g", "oz", "ml", "cup", "tbsp", "tsp", "item", "slice", "scoop"];

function isWaterItem(item: LoggedFoodItem) {
  return item.name.toLowerCase().includes("water") && (item.calories == null || item.calories === 0);
}
function estimateWaterMl(item: LoggedFoodItem) {
  return item.grams ?? 250;
}

// ─── MealCard ─────────────────────────────────────────────────────────────────

function MealCard({
  meal,
  slotKey,
  onEdit,
  onDelete,
  onVoiceLog,
  onItemChange,
  onItemAdd,
  onHydrationAdjust,
}: {
  meal:               LoggedMeal | null;
  slotKey:            MealSlotKey;
  onEdit:             (meal: LoggedMeal) => void;
  onDelete:           (meal: LoggedMeal) => void;
  onVoiceLog:         () => void;
  onItemChange:       (mealId: string, itemId: string, patch: Partial<LoggedFoodItem>) => void;
  onItemAdd:          (mealId: string, item: LoggedFoodItem) => void;
  onHydrationAdjust:  (deltaMl: number) => void;
}) {
  const [expanded,  setExpanded]  = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Draft holds raw string values for inputs so number typing ("1.5") doesn't fight React re-renders
  const [draft, setDraft] = useState<Record<string, string>>({});

  if (!meal) {
    return (
      <button
        onClick={onVoiceLog}
        className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-white/[0.06] text-white/20 hover:text-white/40 hover:border-white/12 transition-all text-xs"
      >
        <Mic className="w-3 h-3" strokeWidth={1.5} />
        Log {SLOT_META[slotKey].label.toLowerCase()}
      </button>
    );
  }

  const allItems    = meal.items;
  const activeItems = allItems.filter((i) => !i.deletedAt);
  const timeStr     = new Date(meal.eatenAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const displayName = mealDisplayName(meal);

  function startEdit(item: LoggedFoodItem) {
    setEditingId(item.id);
    setDraft({
      name:     item.name,
      quantity: item.quantity != null ? String(item.quantity) : "",
      unit:     item.unit ?? "",
      grams:    item.grams     != null ? String(item.grams)     : "",
      calories: item.calories  != null ? String(item.calories)  : "",
      protein:  item.protein   != null ? String(item.protein)   : "",
      carbs:    item.carbs     != null ? String(item.carbs)     : "",
      fat:      item.fat       != null ? String(item.fat)       : "",
    });
  }

  function closeEdit() {
    setEditingId(null);
    setDraft({});
  }

  function handleDraftChange(item: LoggedFoodItem, field: string, value: string) {
    setDraft((prev) => ({ ...prev, [field]: value }));

    let patch: Partial<LoggedFoodItem>;
    if (field === "name") {
      patch = { name: value };
    } else if (field === "unit") {
      patch = { unit: value || null };
    } else {
      const num = parseFloat(value);
      const parsed = isNaN(num) ? null : num;
      patch = { [field]: parsed } as Partial<LoggedFoodItem>;
      // Keep hydration in sync when grams change on a water item
      if (field === "grams" && isWaterItem(item) && parsed != null) {
        const delta = parsed - (item.grams ?? 250);
        if (delta !== 0) onHydrationAdjust(delta);
      }
    }
    onItemChange(meal!.id, item.id, patch);
  }

  function handleDeleteItem(item: LoggedFoodItem) {
    if (editingId === item.id) closeEdit();
    onItemChange(meal!.id, item.id, { deletedAt: new Date().toISOString() });
    if (isWaterItem(item)) onHydrationAdjust(-estimateWaterMl(item));
  }

  function handleRestoreItem(item: LoggedFoodItem) {
    onItemChange(meal!.id, item.id, { deletedAt: null });
    if (isWaterItem(item)) onHydrationAdjust(estimateWaterMl(item));
  }

  function handleAddItem() {
    const newItem: LoggedFoodItem = {
      id:         `fi_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      name:       "",
      quantity:   null,
      unit:       null,
      grams:      null,
      calories:   null,
      protein:    null,
      carbs:      null,
      fat:        null,
      confidence: 1,
      source:     meal!.source,
      deletedAt:  null,
    };
    onItemAdd(meal!.id, newItem);
    startEdit(newItem);
  }

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#111111] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-1.5 px-4 py-3">
        <button
          onClick={() => { setExpanded((v) => !v); if (editingId) closeEdit(); }}
          className="flex-1 flex items-center gap-2.5 text-left min-w-0"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white/75 truncate">{displayName}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={cn(
                "text-[9px] font-semibold uppercase tracking-[0.12em]",
                meal.source === "voice" ? "text-[#B48B40]/60"
                : meal.source === "photo" ? "text-[#93C5FD]/60"
                : "text-white/25",
              )}>
                {meal.source}
              </span>
              <span className="text-[10px] text-white/22 flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" strokeWidth={1.5} />
                {timeStr}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {meal.totals.calories > 0 && (
              <span className="text-sm tabular-nums text-white/40">
                {Math.round(meal.totals.calories)} kcal
              </span>
            )}
            {expanded
              ? <ChevronUp   className="w-3.5 h-3.5 text-white/18" strokeWidth={1.5} />
              : <ChevronDown className="w-3.5 h-3.5 text-white/18" strokeWidth={1.5} />}
          </div>
        </button>

        {/* Edit Meal — opens MealEditModal for type / time / notes */}
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(meal); }}
          className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] text-[11px] font-medium text-white/35 hover:text-white/65 hover:border-white/15 hover:bg-white/[0.04] transition-all"
          title="Edit meal type, time and notes"
        >
          <Pencil className="w-3 h-3" strokeWidth={1.5} />
          Edit
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(meal); }}
          className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-white/20 hover:text-[#EF4444]/60 hover:bg-[#EF4444]/8 transition-all"
          title="Remove meal"
        >
          <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-white/[0.05] px-4 pb-4 pt-3 space-y-1.5">
          {allItems.map((item) => {
            const label = [
              item.quantity != null ? `${item.quantity}` : "",
              item.unit && item.unit !== "item" ? item.unit : "",
              item.name,
            ].filter(Boolean).join(" ") || "New item";

            const isDeleted = !!item.deletedAt;
            const isEditing = editingId === item.id;

            // ── Soft-deleted row ──────────────────────────────────────────────
            if (isDeleted) {
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-white/[0.04] bg-white/[0.01]"
                >
                  <span className="flex-1 text-sm text-white/25 line-through truncate">{label}</span>
                  <button
                    onClick={() => handleRestoreItem(item)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-md border border-[#B48B40]/25 bg-[#B48B40]/8 text-[11px] font-semibold text-[#B48B40]/80 hover:text-[#B48B40] hover:bg-[#B48B40]/14 transition-all shrink-0"
                  >
                    <RotateCcw className="w-2.5 h-2.5" strokeWidth={2} />
                    Undo
                  </button>
                </div>
              );
            }

            // ── Active row ────────────────────────────────────────────────────
            return (
              <div key={item.id} className={cn(
                "rounded-xl border overflow-hidden transition-colors",
                isEditing
                  ? "border-[#B48B40]/20 bg-[#B48B40]/[0.03]"
                  : "border-white/[0.06] bg-white/[0.015]",
              )}>
                {/* Compact row */}
                <div className="flex items-center gap-1.5 px-3 py-2">
                  <span className="w-1 h-1 rounded-full bg-white/25 shrink-0 mt-px" />
                  <button
                    onClick={() => isEditing ? closeEdit() : startEdit(item)}
                    className="flex-1 flex items-center gap-2 text-left min-w-0"
                  >
                    <span className={cn(
                      "text-sm flex-1 truncate transition-colors",
                      isEditing ? "text-white/80" : "text-white/60",
                    )}>
                      {label}
                    </span>
                    {!isEditing && item.calories != null && (
                      <span className="text-[10px] text-white/30 tabular-nums shrink-0">
                        {Math.round(item.calories)} kcal
                      </span>
                    )}
                  </button>
                  {/* Edit button — always visible */}
                  <button
                    onClick={() => isEditing ? closeEdit() : startEdit(item)}
                    className={cn(
                      "shrink-0 flex items-center gap-1 px-1.5 py-1 rounded-md text-[11px] font-medium transition-all",
                      isEditing
                        ? "text-[#B48B40] bg-[#B48B40]/12 border border-[#B48B40]/25"
                        : "text-white/45 hover:text-white/75 hover:bg-white/[0.05] border border-transparent",
                    )}
                    title={isEditing ? "Done" : "Edit"}
                  >
                    <Pencil className="w-3 h-3" strokeWidth={1.5} />
                    <span>{isEditing ? "Done" : "Edit"}</span>
                  </button>
                  {/* Delete button — always visible */}
                  <button
                    onClick={() => handleDeleteItem(item)}
                    className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-white/35 hover:text-[#EF4444]/70 hover:bg-[#EF4444]/8 border border-transparent hover:border-[#EF4444]/15 transition-all"
                    title="Remove item"
                  >
                    <Trash2 className="w-3 h-3" strokeWidth={1.5} />
                  </button>
                </div>

                {/* ── Inline edit panel ──────────────────────────────────────── */}
                {isEditing && (
                  <div className="border-t border-[#B48B40]/10 px-3 pb-3 pt-2.5 space-y-2">
                    {/* Name */}
                    <div>
                      <label className="text-[10px] uppercase tracking-[0.12em] text-white/25 mb-1 block">Name</label>
                      <input
                        autoFocus
                        type="text"
                        value={draft.name ?? ""}
                        onChange={(e) => handleDraftChange(item, "name", e.target.value)}
                        placeholder="e.g. blueberries"
                        className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-2.5 py-1.5 text-sm text-white/80 placeholder:text-white/20 outline-none focus:border-[#B48B40]/35 transition-colors"
                      />
                    </div>

                    {/* Qty + Unit */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] uppercase tracking-[0.12em] text-white/25 mb-1 block">Qty</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={draft.quantity ?? ""}
                          onChange={(e) => handleDraftChange(item, "quantity", e.target.value)}
                          placeholder="e.g. 1.5"
                          className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-2.5 py-1.5 text-sm text-white/80 placeholder:text-white/20 outline-none focus:border-[#B48B40]/35 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase tracking-[0.12em] text-white/25 mb-1 block">Unit</label>
                        <select
                          value={draft.unit ?? ""}
                          onChange={(e) => handleDraftChange(item, "unit", e.target.value)}
                          className="w-full bg-[#0D0D0D] border border-white/[0.07] rounded-lg px-2.5 py-1.5 text-sm text-white/80 outline-none focus:border-[#B48B40]/35 transition-colors"
                        >
                          <option value="">—</option>
                          {CARD_UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* Grams */}
                    <div>
                      <label className="text-[10px] uppercase tracking-[0.12em] text-white/25 mb-1 block">Grams (weight)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={draft.grams ?? ""}
                        onChange={(e) => handleDraftChange(item, "grams", e.target.value)}
                        placeholder="e.g. 150"
                        className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-2.5 py-1.5 text-sm text-white/80 placeholder:text-white/20 outline-none focus:border-[#B48B40]/35 transition-colors"
                      />
                    </div>

                    {/* Macros 2×2 */}
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        { key: "calories", label: "Calories" },
                        { key: "protein",  label: "Protein"  },
                        { key: "carbs",    label: "Carbs"    },
                        { key: "fat",      label: "Fat"      },
                      ] as { key: keyof typeof draft; label: string }[]).map(({ key, label }) => (
                        <div key={key}>
                          <label className="text-[10px] uppercase tracking-[0.12em] text-white/25 mb-1 block">{label}</label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={draft[key] ?? ""}
                            onChange={(e) => handleDraftChange(item, key, e.target.value)}
                            placeholder="—"
                            className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-2.5 py-1.5 text-sm text-white/80 placeholder:text-white/20 outline-none focus:border-[#B48B40]/35 transition-colors"
                          />
                        </div>
                      ))}
                    </div>

                    {/* Done button */}
                    <button
                      onClick={closeEdit}
                      className="w-full py-1.5 rounded-lg bg-[#B48B40]/10 border border-[#B48B40]/20 text-xs font-semibold text-[#B48B40]/80 hover:bg-[#B48B40]/16 hover:text-[#B48B40] transition-all"
                    >
                      Done
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Add food item */}
          <button
            onClick={handleAddItem}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/[0.07] py-2 text-xs text-white/28 hover:text-white/50 hover:border-white/14 transition-all"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
            Add food item
          </button>

          {/* Totals row */}
          {activeItems.length > 0 && (meal.totals.calories > 0 || meal.totals.protein > 0) && (
            <div className="flex items-center gap-3 pt-2 border-t border-white/[0.04] mt-0.5">
              <span className="text-[10px] text-white/20 font-medium tabular-nums">
                {Math.round(meal.totals.calories)} kcal
              </span>
              {[
                { label: "P", value: meal.totals.protein,  color: "text-[#B48B40]/70"   },
                { label: "C", value: meal.totals.carbs,    color: "text-[#93C5FD]/60"   },
                { label: "F", value: meal.totals.fat,      color: "text-emerald-400/55" },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-baseline gap-0.5">
                  <span className={cn("text-xs font-semibold tabular-nums", color)}>{Math.round(value)}g</span>
                  <span className="text-[10px] text-white/20">{label}</span>
                </div>
              ))}
              {meal.notes && (
                <p className="ml-auto text-[10px] text-white/22 truncate max-w-[120px]">{meal.notes}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Undo toast ───────────────────────────────────────────────────────────────

function UndoToast({ meal, onUndo, onDismiss }: {
  meal: LoggedMeal; onUndo: () => void; onDismiss: () => void;
}) {
  const name = mealDisplayName(meal);
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-3 shadow-xl">
      <span className="text-sm text-white/55 truncate flex-1">
        <span className="text-white/30">Removed:</span> {name}
      </span>
      <button
        onClick={onUndo}
        className="flex items-center gap-1.5 text-xs font-semibold text-[#B48B40] hover:text-[#c99840] transition-colors shrink-0"
      >
        <RotateCcw className="w-3 h-3" strokeWidth={2} />
        Undo
      </button>
      <button onClick={onDismiss} className="text-white/20 hover:text-white/45 transition-colors shrink-0">
        <X className="w-3.5 h-3.5" strokeWidth={1.5} />
      </button>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({
  dateLabel, onVoiceLog, onPhoto,
}: { dateLabel: string; onVoiceLog: () => void; onPhoto: () => void }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#0D0D0D] px-6 py-10 flex flex-col items-center text-center gap-5">
      <div className="w-12 h-12 rounded-2xl border border-white/[0.07] bg-white/[0.03] flex items-center justify-center">
        <span className="text-xl">🍽️</span>
      </div>
      <div>
        <p className="text-sm font-medium text-white/55">No meals logged for {dateLabel.toLowerCase()}</p>
        <p className="text-xs text-white/28 mt-1 leading-relaxed">Log your first meal to start tracking</p>
      </div>
      <div className="flex items-center gap-2.5">
        <button
          onClick={onVoiceLog}
          className="flex items-center gap-2 rounded-xl border border-[#B48B40]/22 bg-[#B48B40]/[0.06] px-4 py-2 text-sm font-medium text-[#B48B40]/80 hover:bg-[#B48B40]/10 hover:border-[#B48B40]/32 transition-all"
        >
          <Mic className="w-3.5 h-3.5" strokeWidth={1.5} /> Voice log
        </button>
        <button
          onClick={onPhoto}
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-white/45 hover:text-white/65 hover:border-white/18 transition-all"
        >
          <Camera className="w-3.5 h-3.5" strokeWidth={1.5} /> Photo scan
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NutritionPage() {
  const { user } = useUser();
  const voice    = useVoiceInput();

  // Targets
  const [targets,   setTargets]   = useState<NutritionTargets>(FALLBACK);
  const [hasIntake, setHasIntake] = useState(false);

  // Date navigation
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [viewWeek,     setViewWeek]     = useState(false);

  // Meal data
  const [meals,     setMeals]     = useState<LoggedMeal[]>([]);
  const [weekMeals, setWeekMeals] = useState<LoggedMeal[]>([]);

  // Hydration (from store for the selected date)
  const [hydration, setHydration] = useState(0);

  // UI state
  const [analysisOpen,  setAnalysisOpen]  = useState(false);
  const [showVoice,     setShowVoice]     = useState(false);
  const [voiceSlot,     setVoiceSlot]     = useState<MealSlotKey | null>(null);
  const [dismissed,     setDismissed]     = useState<string[]>([]);
  const [noteOpen,      setNoteOpen]      = useState(false);
  const [note,          setNote]          = useState("");

  // Edit flow
  const [editingMeal, setEditingMeal] = useState<LoggedMeal | null>(null);

  // Overlay state
  const [calendarOpen,   setCalendarOpen]   = useState(false);
  const [foodSearchOpen, setFoodSearchOpen] = useState(false);

  // Voice → parse → review flow
  const [parsing,           setParsing]           = useState(false);
  const [pendingParse,      setPendingParse]       = useState<NutritionParseResult | null>(null);
  const [pendingTranscript, setPendingTranscript]  = useState<string>("");

  // Undo state
  const [undoMeal,     setUndoMeal]     = useState<LoggedMeal | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load targets ────────────────────────────────────────────────────────────

  useEffect(() => {
    const intake = loadIntake(user.id);
    if (intake) {
      const calc = calculateNutritionTargets(intake);
      if (calc) { setTargets(calc); setHasIntake(true); return; }
    }
    setHasIntake(false);
  }, [user.id]);

  // ── Load meals & hydration when date changes ────────────────────────────────

  useEffect(() => {
    setMeals(getMealsForDate(user.id, selectedDate));
    setHydration(getTotalHydrationForDate(user.id, selectedDate));
  }, [user.id, selectedDate]);

  // ── Load week meals ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (viewWeek) {
      setWeekMeals(getMealsForRange(user.id, getLast7Start(), todayISO()));
    }
  }, [user.id, viewWeek, meals]); // refresh when day meals change too

  // ── Derived totals ──────────────────────────────────────────────────────────

  const totals = useMemo(() => sumTotals(viewWeek ? weekMeals : meals), [meals, weekMeals, viewWeek]);

  const suggestions = useMemo(() =>
    buildSuggestions(targets, totals, hydration, meals.length)
      .filter((s) => !dismissed.includes(s.id)),
    [targets, totals, hydration, meals.length, dismissed],
  );

  const mealsBySlot = useMemo<Record<MealSlotKey, LoggedMeal[]>>(() => {
    const map: Record<MealSlotKey, LoggedMeal[]> = {
      breakfast: [], pre_workout: [], lunch: [],
      post_workout: [], dinner: [], snack: [],
    };
    meals.forEach((m) => { map[mealToSlot(m)].push(m); });
    return map;
  }, [meals]);

  const isToday = selectedDate === todayISO();

  // ── Hydration helpers ───────────────────────────────────────────────────────

  function addWaterMl(ml: number) {
    saveHydrationLog(user.id, { amountMl: ml, source: "manual" });
    setHydration((v) => v + ml);
  }

  function applyHydration(amountMl: number, linkedMealId?: string) {
    if (amountMl <= 0) return;
    saveHydrationLog(user.id, {
      amountMl,
      source: "voice",
      linkedMealId: linkedMealId ?? null,
    });
    if (selectedDate === todayISO()) {
      setHydration((v) => v + amountMl);
    }
  }

  // ── Voice handlers ──────────────────────────────────────────────────────────

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

      // Handle water separately
      if (data.hydrationMl && data.hydrationMl > 0) {
        applyHydration(data.hydrationMl);
      }

      if (data.confidence >= 0.75) {
        doSaveMeal(data, transcript);
      } else {
        setPendingTranscript(transcript);
        setPendingParse(data);
      }
    } catch {
      // API unavailable — regex fallback
      const { parseMealFromTranscript } = await import("@/lib/voiceParser");
      const fallback = parseMealFromTranscript(transcript);

      // Client-side water extraction
      const water = parseWaterFromTranscript(transcript);
      if (water.amountMl > 0) applyHydration(water.amountMl);

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
          deletedAt:  null,
        })),
        totals:      { calories: 0, protein: 0, carbs: 0, fat: 0 },
        needsReview: true,
      });

      addMealToState(meal);
    } finally {
      setParsing(false);
      setVoiceSlot(null);
      voice.reset();
    }
  }

  function doSaveMeal(data: NutritionParseResult, rawTranscript: string) {
    const now      = new Date().toISOString();
    const mealType: MealType = voiceSlot
      ? SLOT_TO_MEAL_TYPE[voiceSlot]
      : data.mealType === "unknown" ? "snack" : data.mealType;

    const meal = saveMeal(user.id, {
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
        deletedAt:  null,
      })),
      totals:      data.totals,
      needsReview: false,
    });

    addMealToState(meal);
  }

  function addMealToState(meal: LoggedMeal) {
    if (meal.eatenAt.slice(0, 10) === selectedDate) {
      setMeals((prev) => [meal, ...prev]);
    }
  }

  function handleReviewSave(meal: LoggedMeal) {
    setPendingParse(null);
    setPendingTranscript("");
    // Apply hydration if pending parse had water
    if (pendingParse?.hydrationMl) applyHydration(pendingParse.hydrationMl, meal.id);
    addMealToState(meal);
  }

  function handleMealLogged(meal: LoggedMeal) {
    setAnalysisOpen(false);
    addMealToState(meal);
  }

  // ── Item-level edit ─────────────────────────────────────────────────────────

  function handleItemChange(mealId: string, itemId: string, patch: Partial<LoggedFoodItem>) {
    setMeals((prev) =>
      prev.map((m) => {
        if (m.id !== mealId) return m;
        const newItems  = m.items.map((i) => i.id === itemId ? { ...i, ...patch } : i);
        const newTotals = recalcMealTotals(newItems.filter((i) => !i.deletedAt));
        const updated   = { ...m, items: newItems, totals: newTotals, updatedAt: new Date().toISOString() };
        updateMeal(user.id, mealId, { items: newItems, totals: newTotals });
        return updated;
      }),
    );
  }

  function handleHydrationAdjust(deltaMl: number) {
    setHydration((v) => Math.max(0, v + deltaMl));
  }

  function handleItemAdd(mealId: string, newItem: LoggedFoodItem) {
    setMeals((prev) =>
      prev.map((m) => {
        if (m.id !== mealId) return m;
        const newItems  = [...m.items, newItem];
        const newTotals = recalcMealTotals(newItems.filter((i) => !i.deletedAt));
        const updated   = { ...m, items: newItems, totals: newTotals, updatedAt: new Date().toISOString() };
        updateMeal(user.id, mealId, { items: newItems, totals: newTotals });
        return updated;
      }),
    );
  }

  // ── Edit handlers ───────────────────────────────────────────────────────────

  function handleEditSave(updated: LoggedMeal) {
    setEditingMeal(null);
    const updatedDate = updated.eatenAt.slice(0, 10);
    if (updatedDate === selectedDate) {
      // In-place update
      setMeals((prev) => prev.map((m) => m.id === updated.id ? updated : m));
    } else {
      // Moved to a different date — remove from current view
      setMeals((prev) => prev.filter((m) => m.id !== updated.id));
    }
  }

  // ── Soft delete + undo ──────────────────────────────────────────────────────

  function handleDelete(meal: LoggedMeal) {
    softDeleteMeal(user.id, meal.id);
    setMeals((prev) => prev.filter((m) => m.id !== meal.id));

    // Show undo toast
    setUndoMeal(meal);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => setUndoMeal(null), 6000);
  }

  function handleUndo() {
    if (!undoMeal) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    restoreMeal(user.id, undoMeal.id);
    // Re-insert in chronological position
    setMeals((prev) => {
      const next = [...prev, undoMeal];
      return next.sort((a, b) =>
        new Date(b.eatenAt).getTime() - new Date(a.eatenAt).getTime(),
      );
    });
    setUndoMeal(null);
  }

  function dismissUndo() {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoMeal(null);
  }

  const dateLabel = viewWeek ? "Last 7 days" : formatDateLabel(selectedDate);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="px-5 md:px-8 py-6 text-white">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div>
          <h1 className="text-[2.6rem] font-semibold tracking-tight leading-none mb-2">Nutrition</h1>
          <p className="text-white/35 text-base">{dateLabel}</p>
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

        {/* ── Date controls ────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2.5">
          {!viewWeek && (
            <button
              onClick={() => setSelectedDate((d) => offsetDate(d, -1))}
              className="w-8 h-8 rounded-xl border border-white/[0.08] bg-white/[0.02] flex items-center justify-center text-white/30 hover:text-white/60 hover:border-white/15 transition-all shrink-0"
            >
              <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
            </button>
          )}
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
          {!viewWeek && !isToday && (
            <button
              onClick={() => setSelectedDate((d) => offsetDate(d, 1))}
              className="w-8 h-8 rounded-xl border border-white/[0.08] bg-white/[0.02] flex items-center justify-center text-white/30 hover:text-white/60 hover:border-white/15 transition-all shrink-0"
            >
              <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
            </button>
          )}
          <button
            onClick={() => setCalendarOpen(true)}
            className="w-8 h-8 rounded-xl border border-white/[0.08] bg-white/[0.02] flex items-center justify-center text-white/30 hover:text-white/60 hover:border-white/15 transition-all shrink-0"
            title="Open calendar"
          >
            <CalendarDays className="w-4 h-4" strokeWidth={1.5} />
          </button>
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

        {/* ── Summary cards ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <CalorieCard consumed={totals.calories} target={targets.calories} />
          <MacrosCard  totals={totals}            targets={targets} />
          <HydrationCard current={hydration}      target={targets.waterMl} onAdd={addWaterMl} />
        </div>

        {/* ── Quick actions ─────────────────────────────────────────────────── */}
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-white/25 mb-3 px-1">Quick actions</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
            <QuickActionTile
              icon={Mic}      label="Voice log meal"   description="Say what you ate"
              onClick={() => openVoiceForSlot(null)}  primary
            />
            <QuickActionTile
              icon={Camera}   label="Photo scan"       description="Snap your plate"
              onClick={() => setAnalysisOpen(true)}
            />
            <QuickActionTile
              icon={Sparkles} label="AI food analysis" description="Analyze · portion guidance"
              onClick={() => setAnalysisOpen(true)}
            />
            <QuickActionTile
              icon={Search}   label="Food search"      description="Search & quick add"
              onClick={() => setFoodSearchOpen(true)}
            />
          </div>
        </div>

        {/* ── AI suggestions ────────────────────────────────────────────────── */}
        {!viewWeek && suggestions.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-white/25 mb-3 px-1">◈ AI suggestions</p>
            <div className="space-y-2">
              {suggestions.map((s) => (
                <SuggestionCard
                  key={s.id} s={s}
                  onDismiss={() => setDismissed((d) => [...d, s.id])}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Parsing indicator ─────────────────────────────────────────────── */}
        {parsing && (
          <div className="rounded-2xl border border-white/[0.07] bg-[#111111] px-5 py-4 flex items-center gap-3">
            <Loader2 className="w-4 h-4 text-[#B48B40]/60 animate-spin shrink-0" strokeWidth={1.5} />
            <p className="text-sm text-white/45">Analysing meal…</p>
          </div>
        )}

        {/* ── Undo toast ────────────────────────────────────────────────────── */}
        {undoMeal && (
          <UndoToast meal={undoMeal} onUndo={handleUndo} onDismiss={dismissUndo} />
        )}

        {/* ── Day: Meal timeline ────────────────────────────────────────────── */}
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
              <div className="space-y-5">
                {SLOT_ORDER.map((slotKey) => {
                  const slotMeals = mealsBySlot[slotKey];
                  const meta      = SLOT_META[slotKey];
                  return (
                    <div key={slotKey}>
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
                      <div className="space-y-2">
                        {slotMeals.map((meal) => (
                          <MealCard
                            key={meal.id}
                            meal={meal}
                            slotKey={slotKey}
                            onEdit={setEditingMeal}
                            onDelete={handleDelete}
                            onVoiceLog={() => openVoiceForSlot(slotKey)}
                            onItemChange={handleItemChange}
                            onItemAdd={handleItemAdd}
                            onHydrationAdjust={handleHydrationAdjust}
                          />
                        ))}
                        {slotMeals.length === 0 && (
                          <MealCard
                            meal={null}
                            slotKey={slotKey}
                            onEdit={() => {}}
                            onDelete={() => {}}
                            onVoiceLog={() => openVoiceForSlot(slotKey)}
                            onItemChange={handleItemChange}
                            onItemAdd={handleItemAdd}
                            onHydrationAdjust={handleHydrationAdjust}
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

        {/* ── Week view ─────────────────────────────────────────────────────── */}
        {viewWeek && (
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-white/25 mb-3 px-1">7-day log</p>
            {weekMeals.length === 0 ? (
              <div className="rounded-2xl border border-white/[0.06] bg-[#0D0D0D] px-6 py-8 text-center">
                <p className="text-sm text-white/40">No meals logged in the last 7 days</p>
              </div>
            ) : (
              <div className="space-y-2">
                {Array.from(new Set(weekMeals.map((m) => m.eatenAt.slice(0, 10))))
                  .sort((a, b) => b.localeCompare(a))
                  .map((date) => {
                    const dayMeals  = weekMeals.filter((m) => m.eatenAt.slice(0, 10) === date);
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

        {/* ── Analytics & trends ───────────────────────────────────────────── */}
        <NutritionAnalytics userId={user.id} targets={targets} today={todayISO()} />

        {/* ── Nutrition notes ───────────────────────────────────────────────── */}
        <div>
          <button
            onClick={() => setNoteOpen((v) => !v)}
            className="w-full flex items-center justify-between mb-3 px-1"
          >
            <p className="text-[10px] uppercase tracking-[0.22em] text-white/25">Nutrition notes</p>
            {noteOpen
              ? <ChevronUp   className="w-3.5 h-3.5 text-white/18" strokeWidth={1.5} />
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

      {/* ── Modals ────────────────────────────────────────────────────────────── */}

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

      {editingMeal && (
        <MealEditModal
          meal={editingMeal}
          userId={user.id}
          onSave={handleEditSave}
          onCancel={() => setEditingMeal(null)}
        />
      )}

      {calendarOpen && (
        <CalendarOverlay
          userId={user.id}
          selectedDate={selectedDate}
          onSelect={(date) => { setSelectedDate(date); setViewWeek(false); }}
          onClose={() => setCalendarOpen(false)}
        />
      )}

      {foodSearchOpen && (
        <FoodSearchModal
          userId={user.id}
          onMealLogged={addMealToState}
          onClose={() => setFoodSearchOpen(false)}
        />
      )}

    </div>
  );
}
