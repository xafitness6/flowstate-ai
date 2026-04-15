"use client";

import { useState, useEffect, useRef } from "react";
import { X, Search, Clock, Star, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { foodSearchService, scaleMacros, type FoodEntry } from "@/lib/nutrition/foodSearch";
import { getRecentFoods, recordFoodUse } from "@/lib/nutrition/recentFoods";
import { saveMeal } from "@/lib/nutrition/store";
import type { LoggedMeal, MealType } from "@/lib/nutrition/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  userId:       string;
  onMealLogged: (meal: LoggedMeal) => void;
  onClose:      () => void;
}

const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch",     label: "Lunch"     },
  { value: "dinner",    label: "Dinner"    },
  { value: "snack",     label: "Snack"     },
];

// ─── FoodRow ──────────────────────────────────────────────────────────────────

function FoodRow({
  food, isSelected, onSelect,
}: { food: FoodEntry; isSelected: boolean; onSelect: (f: FoodEntry) => void }) {
  return (
    <button
      onClick={() => onSelect(food)}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all mb-1",
        isSelected
          ? "bg-[#B48B40]/12 border border-[#B48B40]/25"
          : "border border-transparent hover:bg-white/[0.04] hover:border-white/[0.07]",
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-white/75 truncate">{food.name}</span>
          {food.brand && <span className="text-[10px] text-white/30 shrink-0">{food.brand}</span>}
          {food.verified && <span className="text-[9px] text-emerald-400/50 shrink-0">✓</span>}
        </div>
        <span className="text-[11px] text-white/30">{food.serving}</span>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm tabular-nums text-white/55">{food.calories} kcal</p>
        <p className="text-[10px] text-white/28 tabular-nums">
          {food.protein}P · {food.carbs}C · {food.fat}F
        </p>
      </div>
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FoodSearchModal({ userId, onMealLogged, onClose }: Props) {
  const [query,    setQuery]    = useState("");
  const [results,  setResults]  = useState<FoodEntry[]>([]);
  const [recents,  setRecents]  = useState<FoodEntry[]>([]);
  const [commons,  setCommons]  = useState<FoodEntry[]>([]);
  const [loading,  setLoading]  = useState(false);

  // Selected food + serving config
  const [selected, setSelected] = useState<FoodEntry | null>(null);
  const [qty,      setQty]      = useState("1");
  const [mealType, setMealType] = useState<MealType>("snack");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef    = useRef<HTMLInputElement>(null);

  // Load recents + commons on mount
  useEffect(() => {
    setRecents(getRecentFoods(userId, 6));
    setCommons(foodSearchService.getCommonFoods());
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [userId]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); setLoading(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const r = await foodSearchService.search(query);
      setResults(r);
      setLoading(false);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  function handleSelect(food: FoodEntry) {
    setSelected(food);
    setQty("1");
  }

  async function handleAdd() {
    if (!selected) return;
    const qtyNum = parseFloat(qty) || 1;
    const macros = scaleMacros(selected, qtyNum);
    const now    = new Date().toISOString();

    const meal = await saveMeal(userId, {
      userId,
      source:          "manual",
      mealType,
      eatenAt:         now,
      rawTranscript:   null,
      cleanTranscript: selected.name,
      notes:           null,
      items: [{
        id:         `fi_${Date.now()}_0`,
        name:       selected.name,
        quantity:   qtyNum,
        unit:       selected.serving,
        grams:      Math.round(selected.servingGrams * qtyNum),
        calories:   macros.calories,
        protein:    macros.protein,
        carbs:      macros.carbs,
        fat:        macros.fat,
        confidence: 1,
        source:     "manual",
        deletedAt:  null,
      }],
      totals:      macros,
      needsReview: false,
    });

    recordFoodUse(userId, selected);
    onMealLogged(meal);
    onClose();
  }

  const showSearch = query.trim().length > 0;
  const qtyNum     = parseFloat(qty) || 1;
  const preview    = selected ? scaleMacros(selected, qtyNum) : null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-[#0D0D0D] border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88dvh]">

        {/* Search header */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-white/[0.07] shrink-0">
          <div className="flex-1 flex items-center gap-2 bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-2">
            <Search className="w-4 h-4 text-white/30 shrink-0" strokeWidth={1.5} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search foods, brands…"
              className="flex-1 bg-transparent text-sm text-white/80 placeholder:text-white/25 outline-none"
            />
            {loading && (
              <span className="w-3 h-3 border border-white/30 border-t-transparent rounded-full animate-spin shrink-0" />
            )}
            {query && !loading && (
              <button
                onClick={() => setQuery("")}
                className="text-white/30 hover:text-white/60 transition-colors shrink-0"
              >
                <X className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl border border-white/[0.08] flex items-center justify-center text-white/30 hover:text-white/60 transition-all shrink-0"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">

          {/* Selected food — serving picker */}
          {selected && (
            <div className="px-4 py-3 border-b border-white/[0.07] bg-[#B48B40]/[0.03] shrink-0">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <p className="text-sm font-semibold text-white/80">{selected.name}</p>
                  {selected.brand && <p className="text-[11px] text-white/35">{selected.brand}</p>}
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="text-white/25 hover:text-white/55 transition-colors shrink-0 mt-0.5"
                >
                  <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                </button>
              </div>

              {/* Qty */}
              <div className="flex items-center gap-2 mb-3">
                <label className="text-[10px] uppercase tracking-[0.12em] text-white/30 shrink-0 w-16">
                  Servings
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="w-20 bg-white/[0.04] border border-white/[0.09] rounded-lg px-2.5 py-1.5 text-sm text-white/80 outline-none focus:border-[#B48B40]/40 text-center tabular-nums"
                />
                <span className="text-xs text-white/30">× {selected.serving}</span>
              </div>

              {/* Macro preview */}
              {preview && (
                <div className="flex items-center gap-4 py-2 px-3 rounded-xl bg-white/[0.03] border border-white/[0.06] mb-3">
                  <div className="text-center">
                    <p className="text-sm font-semibold tabular-nums text-white/80">{preview.calories}</p>
                    <p className="text-[9px] text-white/28 uppercase tracking-wide">kcal</p>
                  </div>
                  {([
                    { label: "P", value: preview.protein,  color: "text-[#B48B40]/80"  },
                    { label: "C", value: preview.carbs,    color: "text-white/55"       },
                    { label: "F", value: preview.fat,      color: "text-[#93C5FD]/70"  },
                  ] as { label: string; value: number; color: string }[]).map(({ label, value, color }) => (
                    <div key={label} className="text-center">
                      <p className={cn("text-sm font-semibold tabular-nums", color)}>{value}g</p>
                      <p className="text-[9px] text-white/28 uppercase tracking-wide">{label}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Meal type + Add */}
              <div className="flex items-center gap-2">
                <select
                  value={mealType}
                  onChange={(e) => setMealType(e.target.value as MealType)}
                  className="flex-1 bg-[#0D0D0D] border border-white/[0.09] rounded-xl px-3 py-2 text-sm text-white/70 outline-none focus:border-[#B48B40]/35"
                >
                  {MEAL_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <button
                  onClick={handleAdd}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#B48B40]/15 border border-[#B48B40]/30 text-sm font-semibold text-[#B48B40] hover:bg-[#B48B40]/22 transition-all"
                >
                  <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                  Add
                </button>
              </div>
            </div>
          )}

          {/* Search results */}
          {showSearch && (
            <div className="px-4 py-3">
              {results.length === 0 && !loading && (
                <p className="text-sm text-white/30 text-center py-6">
                  No results for &ldquo;{query}&rdquo;
                </p>
              )}
              {results.map((food) => (
                <FoodRow
                  key={food.id}
                  food={food}
                  isSelected={selected?.id === food.id}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          )}

          {/* Recent foods */}
          {!showSearch && recents.length > 0 && (
            <div className="px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-3 h-3 text-white/25" strokeWidth={1.5} />
                <span className="text-[10px] uppercase tracking-[0.14em] text-white/22 font-medium">
                  Recent
                </span>
              </div>
              {recents.map((food) => (
                <FoodRow
                  key={food.id}
                  food={food}
                  isSelected={selected?.id === food.id}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          )}

          {/* Common foods */}
          {!showSearch && commons.length > 0 && (
            <div className="px-4 pb-5">
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-3 h-3 text-white/25" strokeWidth={1.5} />
                <span className="text-[10px] uppercase tracking-[0.14em] text-white/22 font-medium">
                  Common foods
                </span>
              </div>
              {commons.map((food) => (
                <FoodRow
                  key={food.id}
                  food={food}
                  isSelected={selected?.id === food.id}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
