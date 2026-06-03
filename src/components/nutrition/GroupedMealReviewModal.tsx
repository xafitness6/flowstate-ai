"use client";

import { useState } from "react";
import { X, Check, Trash2, ChevronDown, ChevronUp, Pencil, AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { saveMeal } from "@/lib/nutrition/store";
import type {
  LoggedMeal,
  LoggedFoodItem,
  MealType,
  NutritionLogSource,
  MealTotals,
} from "@/lib/nutrition/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReviewItemInput {
  name:       string;
  quantity:   number | null;
  unit:       string | null;
  grams:      number | null;
  calories:   number | null;
  protein:    number | null;
  carbs:      number | null;
  fat:        number | null;
  confidence: number;
}

/** One detected meal from a voice/photo log, ready to be reviewed before saving. */
export interface ReviewMealInput {
  id:              string;
  mealType:        MealType;
  source:          NutritionLogSource;
  rawTranscript:   string | null;
  cleanTranscript: string | null;
  confidence:      number;
  hydrationMl:     number | null;
  items:           ReviewItemInput[];
}

interface EditableItem extends ReviewItemInput {
  id:        string;
  removed:   boolean;
  _expanded: boolean;
}

interface EditableMeal {
  id:              string;
  mealType:        MealType;
  source:          NutritionLogSource;
  rawTranscript:   string | null;
  cleanTranscript: string | null;
  confidence:      number;
  hydrationMl:     number | null;
  items:           EditableItem[];
}

interface Props {
  meals:    ReviewMealInput[];
  userId:   string;
  onSaved:  (saved: { meal: LoggedMeal; hydrationMl: number | null }[]) => void;
  onCancel: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner",
  snack: "Snack",         unknown: "Meal",
};
const MEAL_TYPE_OPTIONS: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
const MEAL_TYPE_ICON: Record<MealType, string> = {
  breakfast: "☀️", lunch: "🥗", dinner: "🌙", snack: "🍎", unknown: "🍽️",
};
// Display order so sections read top-to-bottom as the day flows
const MEAL_TYPE_ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack", "unknown"];
const UNIT_OPTIONS = ["g", "oz", "ml", "cup", "tbsp", "tsp", "item", "slice", "scoop"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatItemLabel(item: EditableItem): string {
  const qty  = item.quantity != null ? `${item.quantity}` : "";
  const unit = item.unit && item.unit !== "item" ? item.unit : "";
  return [qty, unit, item.name].filter(Boolean).join(" ");
}

function numField(v: number | null): string { return v != null ? String(v) : ""; }
function parseNum(s: string): number | null {
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function mealTotals(meal: EditableMeal): MealTotals {
  return meal.items
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

function sumTotals(meals: EditableMeal[]): MealTotals {
  return meals.reduce((acc, m) => {
    const t = mealTotals(m);
    return {
      calories: acc.calories + t.calories,
      protein:  acc.protein  + t.protein,
      carbs:    acc.carbs    + t.carbs,
      fat:      acc.fat      + t.fat,
    };
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GroupedMealReviewModal({ meals, userId, onSaved, onCancel }: Props) {
  const [editMeals, setEditMeals] = useState<EditableMeal[]>(
    meals.map((m) => ({
      id:              m.id,
      mealType:        m.mealType === "unknown" ? "snack" : m.mealType,
      source:          m.source,
      rawTranscript:   m.rawTranscript,
      cleanTranscript: m.cleanTranscript,
      confidence:      m.confidence,
      hydrationMl:     m.hydrationMl,
      items: m.items.map((item, i) => ({
        ...item,
        id:        `${m.id}_item_${i}`,
        removed:   false,
        _expanded: false,
      })),
    })),
  );
  const [typeOpenFor, setTypeOpenFor] = useState<string | null>(null);
  const [saving, setSaving]           = useState(false);
  const [saveError, setSaveError]     = useState<string | null>(null);

  // Order sections so the day reads breakfast → lunch → dinner → snack
  const ordered = [...editMeals].sort(
    (a, b) => MEAL_TYPE_ORDER.indexOf(a.mealType) - MEAL_TYPE_ORDER.indexOf(b.mealType),
  );

  const grand          = sumTotals(editMeals);
  const totalActive    = editMeals.reduce((n, m) => n + m.items.filter((i) => !i.removed).length, 0);
  const lowConfidence  = editMeals.some((m) => m.confidence < 0.6);

  function patchMeal(mealId: string, patch: Partial<EditableMeal>) {
    setEditMeals((prev) => prev.map((m) => m.id === mealId ? { ...m, ...patch } : m));
  }
  function patchItem(mealId: string, itemId: string, patch: Partial<EditableItem>) {
    setEditMeals((prev) =>
      prev.map((m) =>
        m.id !== mealId ? m : { ...m, items: m.items.map((i) => i.id === itemId ? { ...i, ...patch } : i) },
      ),
    );
  }

  async function handleConfirm() {
    if (saving || totalActive === 0) return;
    setSaving(true);
    setSaveError(null);

    const now   = new Date().toISOString();
    const saved: { meal: LoggedMeal; hydrationMl: number | null }[] = [];

    try {
      for (const m of editMeals) {
        const active = m.items.filter((i) => !i.removed);
        if (active.length === 0) continue;

        const loggedItems: LoggedFoodItem[] = active.map((i) => ({
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
          source:     m.source,
          deletedAt:  null,
        }));

        const meal = await saveMeal(userId, {
          userId,
          source:          m.source,
          mealType:        m.mealType,
          eatenAt:         now,
          rawTranscript:   m.rawTranscript,
          cleanTranscript: m.cleanTranscript,
          notes:           null,
          items:           loggedItems,
          totals:          mealTotals(m),
          needsReview:     false,
        });

        saved.push({ meal, hydrationMl: m.hydrationMl });
      }

      onSaved(saved);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Meals could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const mealCount  = editMeals.filter((m) => m.items.some((i) => !i.removed)).length;
  const confirmCta = saving
    ? "Confirming…"
    : mealCount > 1 ? `Confirm ${mealCount} meals` : "Confirm meal";

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />

      <div
        className="relative w-full sm:max-w-md bg-[#0D0D0D] border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: "88dvh" }}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white/80 tracking-tight">
                Review {mealCount > 1 ? "meals" : "meal"}
              </h2>
              <p className="text-[11px] text-white/30 mt-0.5">Edit, remove, or confirm before saving</p>
            </div>
            <button
              onClick={onCancel}
              className="w-7 h-7 rounded-lg border border-white/8 bg-white/[0.03] flex items-center justify-center text-white/30 hover:text-white/65 transition-colors"
            >
              <X className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
          </div>

          {lowConfidence && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/[0.05] px-3 py-2.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400/70 shrink-0 mt-0.5" strokeWidth={1.5} />
              <p className="text-xs text-amber-400/70 leading-relaxed">
                Some amounts may be missing or estimated — please review each item before confirming.
              </p>
            </div>
          )}
        </div>

        {/* Body — one section per meal, ordered through the day */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5" style={{ scrollbarWidth: "none" }}>
          {ordered.map((meal) => {
            const subtotal = mealTotals(meal);
            const active   = meal.items.filter((i) => !i.removed);
            return (
              <div key={meal.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.015] overflow-hidden">
                {/* Section heading — meal type + subtotal */}
                <div className="relative flex items-center gap-2 px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
                  <span className="text-base select-none">{MEAL_TYPE_ICON[meal.mealType]}</span>
                  <button
                    onClick={() => setTypeOpenFor((v) => v === meal.id ? null : meal.id)}
                    className="flex items-center gap-1 text-sm font-semibold text-white/75 hover:text-white/90 transition-colors"
                  >
                    {MEAL_TYPE_LABELS[meal.mealType]}
                    <ChevronDown className={cn("w-3.5 h-3.5 text-white/30 transition-transform", typeOpenFor === meal.id && "rotate-180")} strokeWidth={1.5} />
                  </button>
                  <span className="ml-auto text-xs tabular-nums text-white/35">
                    {Math.round(subtotal.calories)} kcal · {active.length} item{active.length !== 1 ? "s" : ""}
                  </span>

                  {typeOpenFor === meal.id && (
                    <div className="absolute top-full left-10 mt-1 w-40 rounded-xl border border-white/10 bg-[#111111] shadow-xl z-20 overflow-hidden">
                      {MEAL_TYPE_OPTIONS.map((t) => (
                        <button
                          key={t}
                          onClick={() => { patchMeal(meal.id, { mealType: t }); setTypeOpenFor(null); }}
                          className={cn(
                            "w-full text-left px-4 py-2.5 text-sm transition-colors",
                            t === meal.mealType
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

                {/* Items */}
                <div className="px-3 py-3 space-y-1.5">
                  {meal.items.map((item) =>
                    item.removed ? (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 rounded-xl border border-white/[0.04] bg-white/[0.01] px-3.5 py-2 opacity-40"
                      >
                        <span className="w-3 h-3 shrink-0" />
                        <p className="flex-1 text-sm text-white/35 line-through truncate">{formatItemLabel(item)}</p>
                        <button
                          onClick={() => patchItem(meal.id, item.id, { removed: false })}
                          className="shrink-0 text-[10px] text-white/30 hover:text-white/55 transition-colors"
                        >
                          Restore
                        </button>
                      </div>
                    ) : (
                      <div key={item.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                        <div className="flex items-center gap-2 px-3.5 py-2.5">
                          <Check className="w-3 h-3 text-emerald-400/50 shrink-0" strokeWidth={2.5} />
                          <button
                            onClick={() => patchItem(meal.id, item.id, { _expanded: !item._expanded })}
                            className="flex-1 flex items-center gap-2 text-left min-w-0"
                          >
                            <span className="text-sm text-white/70 truncate">{formatItemLabel(item)}</span>
                            {item.calories != null && (
                              <span className="text-[10px] text-white/25 tabular-nums shrink-0">{item.calories} kcal</span>
                            )}
                            {item._expanded
                              ? <ChevronUp   className="w-3 h-3 text-white/18 shrink-0" strokeWidth={1.5} />
                              : <ChevronDown className="w-3 h-3 text-white/18 shrink-0" strokeWidth={1.5} />}
                          </button>
                          <button
                            onClick={() => patchItem(meal.id, item.id, { _expanded: !item._expanded })}
                            className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-white/18 hover:text-white/55 hover:bg-white/[0.04] transition-all"
                            title="Edit item"
                          >
                            <Pencil className="w-3 h-3" strokeWidth={1.5} />
                          </button>
                          <button
                            onClick={() => patchItem(meal.id, item.id, { removed: true, _expanded: false })}
                            className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-white/18 hover:text-[#EF4444]/60 hover:bg-[#EF4444]/8 transition-all"
                            title="Remove item"
                          >
                            <Trash2 className="w-3 h-3" strokeWidth={1.5} />
                          </button>
                        </div>

                        {item._expanded && (
                          <div className="border-t border-white/[0.05] px-3.5 pb-3.5 pt-3 space-y-2.5">
                            <div>
                              <label className="text-[10px] uppercase tracking-[0.14em] text-white/20 mb-1 block">Name</label>
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) => patchItem(meal.id, item.id, { name: e.target.value })}
                                placeholder="e.g. chicken breast"
                                className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-white/75 placeholder:text-white/20 outline-none focus:border-[#B48B40]/30 transition-colors"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] uppercase tracking-[0.14em] text-white/20 mb-1 block">Quantity</label>
                                <input
                                  type="number" min="0" step="any"
                                  value={numField(item.quantity)}
                                  onChange={(e) => patchItem(meal.id, item.id, { quantity: parseNum(e.target.value) })}
                                  placeholder="e.g. 3"
                                  className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-white/75 placeholder:text-white/20 outline-none focus:border-[#B48B40]/30 transition-colors"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] uppercase tracking-[0.14em] text-white/20 mb-1 block">Unit</label>
                                <select
                                  value={item.unit ?? ""}
                                  onChange={(e) => patchItem(meal.id, item.id, { unit: e.target.value || null })}
                                  className="w-full bg-[#111111] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-white/75 outline-none focus:border-[#B48B40]/30 transition-colors"
                                >
                                  <option value="">—</option>
                                  {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
                                </select>
                              </div>
                            </div>
                            <div>
                              <label className="text-[10px] uppercase tracking-[0.14em] text-white/20 mb-1 block">Grams (weight)</label>
                              <input
                                type="number" min="0" step="any"
                                value={numField(item.grams)}
                                onChange={(e) => patchItem(meal.id, item.id, { grams: parseNum(e.target.value) })}
                                placeholder="e.g. 150"
                                className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-white/75 placeholder:text-white/20 outline-none focus:border-[#B48B40]/30 transition-colors"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {[
                                { key: "calories" as const, label: "Calories", placeholder: "e.g. 210" },
                                { key: "protein"  as const, label: "Protein",  placeholder: "e.g. 18"  },
                                { key: "carbs"    as const, label: "Carbs",    placeholder: "e.g. 30"  },
                                { key: "fat"      as const, label: "Fat",      placeholder: "e.g. 8"   },
                              ].map(({ key, label, placeholder }) => (
                                <div key={key}>
                                  <label className="text-[10px] uppercase tracking-[0.14em] text-white/20 mb-1 block">{label}</label>
                                  <input
                                    type="number" min="0" step="any"
                                    value={numField(item[key])}
                                    onChange={(e) => patchItem(meal.id, item.id, { [key]: parseNum(e.target.value) })}
                                    placeholder={placeholder}
                                    className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-white/75 placeholder:text-white/20 outline-none focus:border-[#B48B40]/30 transition-colors"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ),
                  )}
                  {active.length === 0 && (
                    <p className="text-xs text-white/28 text-center py-2">All items removed from this meal</p>
                  )}
                </div>
              </div>
            );
          })}

          {/* Grand totals */}
          <div className="rounded-2xl border border-white/[0.07] bg-[#111111] px-5 py-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/22 mb-3">Day totals</p>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "Calories", value: grand.calories, unit: "kcal", color: "text-white/75" },
                { label: "Protein",  value: grand.protein,  unit: "g",    color: "text-[#B48B40]/80" },
                { label: "Carbs",    value: grand.carbs,    unit: "g",    color: "text-[#93C5FD]/70" },
                { label: "Fat",      value: grand.fat,      unit: "g",    color: "text-emerald-400/60" },
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
        </div>

        {saveError && (
          <div className="mx-5 mb-3 rounded-xl border border-red-400/20 bg-red-400/[0.05] px-3 py-2 text-xs text-red-300/80">
            {saveError}
          </div>
        )}

        {/* Footer */}
        <div
          className="px-5 pt-4 border-t border-white/[0.05] shrink-0 flex gap-3"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
        >
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm font-medium text-white/40 hover:text-white/60 hover:border-white/18 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={totalActive === 0 || saving}
            className="flex-1 py-2.5 rounded-xl bg-[#B48B40]/15 border border-[#B48B40]/25 text-sm font-semibold text-[#B48B40] hover:bg-[#B48B40]/22 hover:border-[#B48B40]/35 disabled:opacity-30 disabled:cursor-not-allowed transition-all inline-flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.6} />}
            {confirmCta}
          </button>
        </div>
      </div>
    </div>
  );
}
