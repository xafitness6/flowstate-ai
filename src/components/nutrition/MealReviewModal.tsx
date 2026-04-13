"use client";

import { useState } from "react";
import { X, Check, Trash2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { saveMeal } from "@/lib/nutrition/store";
import type {
  NutritionParseResult,
  LoggedMeal,
  LoggedFoodItem,
  MealType,
  NutritionLogSource,
  MealTotals,
} from "@/lib/nutrition/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EditableItem {
  id:       string;
  name:     string;
  quantity: number | null;
  unit:     string | null;
  grams:    number | null;
  calories: number | null;
  protein:  number | null;
  carbs:    number | null;
  fat:      number | null;
  confidence: number;
  removed:  boolean;
}

interface Props {
  parseResult:   NutritionParseResult;
  rawTranscript: string | null;
  source:        NutritionLogSource;
  userId:        string;
  initialSlot?:  string | null; // optional hint from which slot opened voice
  onSave:        (meal: LoggedMeal) => void;
  onCancel:      () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch:     "Lunch",
  dinner:    "Dinner",
  snack:     "Snack",
  unknown:   "Meal",
};

const MEAL_TYPE_OPTIONS: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

function formatItemLabel(item: EditableItem): string {
  const qty = item.quantity != null ? `${item.quantity}` : "";
  const unit = item.unit && item.unit !== "item" ? item.unit : "";
  return [qty, unit, item.name].filter(Boolean).join(" ");
}

function recalcTotals(items: EditableItem[]): MealTotals {
  return items
    .filter((i) => !i.removed)
    .reduce(
      (acc, i) => ({
        calories: acc.calories + (i.calories ?? 0),
        protein:  acc.protein  + (i.protein  ?? 0),
        carbs:    acc.carbs    + (i.carbs    ?? 0),
        fat:      acc.fat      + (i.fat      ?? 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MealReviewModal({
  parseResult,
  rawTranscript,
  source,
  userId,
  initialSlot,
  onSave,
  onCancel,
}: Props) {
  const [mealType, setMealType]     = useState<MealType>(parseResult.mealType === "unknown" ? "snack" : parseResult.mealType);
  const [typeOpen, setTypeOpen]     = useState(false);
  const [items, setItems]           = useState<EditableItem[]>(
    parseResult.items.map((item, i) => ({
      id:         `rev_${i}`,
      name:       item.name,
      quantity:   item.quantity,
      unit:       item.unit,
      grams:      item.grams,
      calories:   item.calories,
      protein:    item.protein,
      carbs:      item.carbs,
      fat:        item.fat,
      confidence: item.confidence,
      removed:    false,
    })),
  );

  const activeItems = items.filter((i) => !i.removed);
  const totals      = recalcTotals(items);

  function removeItem(id: string) {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, removed: true } : i));
  }

  function restoreItem(id: string) {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, removed: false } : i));
  }

  function handleSave() {
    const now = new Date().toISOString();
    const loggedItems: LoggedFoodItem[] = activeItems.map((i) => ({
      id:         i.id,
      name:       i.name,
      quantity:   i.quantity,
      unit:       i.unit,
      grams:      i.grams,
      calories:   i.calories,
      protein:    i.protein,
      carbs:      i.carbs,
      fat:        i.fat,
      confidence: i.confidence,
      source,
    }));

    const meal = saveMeal(userId, {
      userId,
      source,
      mealType,
      eatenAt:         now,
      rawTranscript,
      cleanTranscript: parseResult.cleanTranscript,
      notes:           null,
      items:           loggedItems,
      totals,
      needsReview:     false,
    });

    onSave(meal);
  }

  const removedItems = items.filter((i) => i.removed);

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />

      {/* Sheet */}
      <div
        className="relative w-full sm:max-w-md bg-[#0D0D0D] border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: "88dvh" }}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white/80 tracking-tight">Review meal</h2>
              <p className="text-[11px] text-white/30 mt-0.5">Confirm or edit before saving</p>
            </div>
            <button
              onClick={onCancel}
              className="w-7 h-7 rounded-lg border border-white/8 bg-white/[0.03] flex items-center justify-center text-white/30 hover:text-white/65 transition-colors"
            >
              <X className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5" style={{ scrollbarWidth: "none" }}>

          {/* Meal type selector */}
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/22 mb-2">Meal type</p>
            <div className="relative">
              <button
                onClick={() => setTypeOpen((v) => !v)}
                className="w-full flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white/70 hover:border-white/18 transition-colors"
              >
                {MEAL_TYPE_LABELS[mealType]}
                <ChevronDown className={cn("w-4 h-4 text-white/25 transition-transform", typeOpen && "rotate-180")} strokeWidth={1.5} />
              </button>
              {typeOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 rounded-xl border border-white/10 bg-[#111111] shadow-xl z-10 overflow-hidden">
                  {MEAL_TYPE_OPTIONS.map((t) => (
                    <button
                      key={t}
                      onClick={() => { setMealType(t); setTypeOpen(false); }}
                      className={cn(
                        "w-full text-left px-4 py-2.5 text-sm transition-colors",
                        t === mealType
                          ? "text-[#B48B40] bg-[#B48B40]/8"
                          : "text-white/55 hover:text-white/75 hover:bg-white/[0.03]",
                      )}
                    >
                      {MEAL_TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Food items */}
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/22 mb-2">
              Items ({activeItems.length})
            </p>
            <div className="space-y-1.5">
              {items.map((item) =>
                item.removed ? null : (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5"
                  >
                    <Check className="w-3 h-3 text-emerald-400/50 shrink-0" strokeWidth={2.5} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white/70 truncate">{formatItemLabel(item)}</p>
                      {item.calories != null && (
                        <p className="text-[10px] text-white/25 mt-0.5 tabular-nums">
                          {item.calories} kcal
                          {item.protein != null && ` · ${item.protein}g P`}
                          {item.carbs   != null && ` · ${item.carbs}g C`}
                          {item.fat     != null && ` · ${item.fat}g F`}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-white/20 hover:text-[#EF4444]/60 hover:bg-[#EF4444]/8 transition-all"
                    >
                      <Trash2 className="w-3 h-3" strokeWidth={1.5} />
                    </button>
                  </div>
                ),
              )}

              {activeItems.length === 0 && (
                <p className="text-xs text-white/28 text-center py-3">All items removed</p>
              )}
            </div>

            {/* Removed items — restore option */}
            {removedItems.length > 0 && (
              <div className="mt-3 space-y-1.5">
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/15 px-1">Removed</p>
                {removedItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-xl border border-white/[0.04] bg-white/[0.01] px-3.5 py-2.5 opacity-40"
                  >
                    <span className="w-3 h-3 shrink-0" />
                    <p className="flex-1 text-sm text-white/35 line-through truncate">{formatItemLabel(item)}</p>
                    <button
                      onClick={() => restoreItem(item.id)}
                      className="shrink-0 text-[10px] text-white/30 hover:text-white/55 transition-colors"
                    >
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Totals */}
          <div className="rounded-2xl border border-white/[0.07] bg-[#111111] px-5 py-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/22 mb-3">Totals</p>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "Calories", value: totals.calories, unit: "kcal", color: "text-white/75" },
                { label: "Protein",  value: totals.protein,  unit: "g",    color: "text-[#B48B40]/80" },
                { label: "Carbs",    value: totals.carbs,    unit: "g",    color: "text-[#93C5FD]/70" },
                { label: "Fat",      value: totals.fat,      unit: "g",    color: "text-emerald-400/60" },
              ].map(({ label, value, unit, color }) => (
                <div key={label} className="rounded-xl border border-white/5 bg-white/[0.02] px-2 py-2.5 text-center">
                  <p className="text-[9px] uppercase tracking-[0.1em] text-white/25 mb-1">{label}</p>
                  <p className={cn("text-sm font-semibold tabular-nums leading-none", color)}>
                    {Math.round(value)}
                    <span className="text-[10px] text-white/30 font-normal">{unit}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Raw transcript */}
          {rawTranscript && (
            <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-white/18 mb-1.5">What you said</p>
              <p className="text-xs text-white/35 leading-relaxed italic">&ldquo;{rawTranscript}&rdquo;</p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-5 pb-6 pt-4 border-t border-white/[0.05] shrink-0 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm font-medium text-white/40 hover:text-white/60 hover:border-white/18 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={activeItems.length === 0}
            className="flex-1 py-2.5 rounded-xl bg-[#B48B40]/15 border border-[#B48B40]/25 text-sm font-semibold text-[#B48B40] hover:bg-[#B48B40]/22 hover:border-[#B48B40]/35 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            Save meal
          </button>
        </div>
      </div>
    </div>
  );
}
