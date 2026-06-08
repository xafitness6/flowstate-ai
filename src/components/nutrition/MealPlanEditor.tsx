"use client";

// Manual editor for a generated meal plan. Edit each item's amount AND its
// macros; meal totals and the plan total are always RECOMPUTED from the items,
// so the numbers can never drift — it adds up to 100% by construction. Used by
// both the member's own plan and the trainer's client plan.

import { useState } from "react";
import { X, Check, Plus, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type PlanItem = { food: string; qty: string; calories: number; protein: number; carbs: number; fat: number };
export type PlanMeal = { name: string; time: string; note: string; items: PlanItem[]; calories: number; protein: number; carbs: number; fat: number };
export type PlanBody = { meals: PlanMeal[]; totals: { calories: number; protein: number; carbs: number; fat: number } };

const num = (v: string) => { const n = parseFloat(v); return Number.isFinite(n) && n >= 0 ? n : 0; };
const round = (n: number) => Math.round(n);

function sumItems(items: PlanItem[]) {
  return items.reduce(
    (a, it) => ({
      calories: a.calories + (it.calories || 0),
      protein:  a.protein  + (it.protein  || 0),
      carbs:    a.carbs    + (it.carbs    || 0),
      fat:      a.fat      + (it.fat      || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

/** Recompute every meal total from its items, and the plan total from the meals. */
export function reconcile(meals: PlanMeal[]): PlanBody {
  const fixed = meals.map((m) => {
    const s = sumItems(m.items);
    return { ...m, calories: round(s.calories), protein: round(s.protein), carbs: round(s.carbs), fat: round(s.fat) };
  });
  const totals = fixed.reduce(
    (a, m) => ({ calories: a.calories + m.calories, protein: a.protein + m.protein, carbs: a.carbs + m.carbs, fat: a.fat + m.fat }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
  return { meals: fixed, totals };
}

const MACRO_FIELDS: { key: keyof PlanItem; label: string; w: string }[] = [
  { key: "calories", label: "kcal", w: "text-white/80" },
  { key: "protein",  label: "P",    w: "text-[#B48B40]" },
  { key: "carbs",    label: "C",    w: "text-[#93C5FD]" },
  { key: "fat",      label: "F",    w: "text-emerald-400/90" },
];

export function MealPlanEditor({
  plan, title, saving, onSave, onClose,
}: {
  plan: PlanBody;
  title: string;
  saving?: boolean;
  onSave: (updated: PlanBody) => void;
  onClose: () => void;
}) {
  const [meals, setMeals] = useState<PlanMeal[]>(() => plan.meals.map((m) => ({ ...m, items: m.items.map((it) => ({ ...it })) })));

  const view = reconcile(meals); // live totals shown from the current items

  function patchItem(mi: number, ii: number, patch: Partial<PlanItem>) {
    setMeals((prev) => prev.map((m, i) => i !== mi ? m : { ...m, items: m.items.map((it, j) => j !== ii ? it : { ...it, ...patch }) }));
  }
  function addItem(mi: number) {
    setMeals((prev) => prev.map((m, i) => i !== mi ? m : { ...m, items: [...m.items, { food: "", qty: "", calories: 0, protein: 0, carbs: 0, fat: 0 }] }));
  }
  function removeItem(mi: number, ii: number) {
    setMeals((prev) => prev.map((m, i) => i !== mi ? m : { ...m, items: m.items.filter((_, j) => j !== ii) }));
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-[#0D0D0D] border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[92dvh]">
        {/* Header with live plan total */}
        <div className="px-5 pt-5 pb-3 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white/80">Edit {title}</h2>
              <p className="text-[11px] text-white/30 mt-0.5">Totals recalc from the foods — it always adds up.</p>
            </div>
            <button onClick={onClose} className="w-7 h-7 rounded-lg border border-white/8 bg-white/[0.03] flex items-center justify-center text-white/30 hover:text-white/65"><X className="w-3.5 h-3.5" strokeWidth={1.5} /></button>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {([["calories","kcal"],["protein","P"],["carbs","C"],["fat","F"]] as const).map(([k, s]) => (
              <span key={k} className="rounded-lg bg-[#B48B40]/[0.08] border border-[#B48B40]/20 px-2.5 py-1 text-[11px] text-white/80">
                <span className="font-semibold tabular-nums">{view.totals[k]}</span> {s}
              </span>
            ))}
          </div>
        </div>

        {/* Meals */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ scrollbarWidth: "none" }}>
          {meals.map((m, mi) => (
            <div key={mi} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-sm font-semibold text-white/85">{m.name} <span className="text-[11px] font-normal text-white/35">{m.time}</span></p>
                <p className="text-[11px] text-white/55 tabular-nums shrink-0">{view.meals[mi].calories} kcal · {view.meals[mi].protein}/{view.meals[mi].carbs}/{view.meals[mi].fat}</p>
              </div>
              <div className="space-y-2">
                {m.items.map((it, ii) => (
                  <div key={ii} className="rounded-lg border border-white/[0.06] bg-black/15 p-2">
                    <div className="flex items-center gap-2">
                      <input
                        value={it.qty}
                        onChange={(e) => patchItem(mi, ii, { qty: e.target.value })}
                        placeholder="2 eggs / 150g"
                        className="w-24 bg-white/[0.04] border border-white/10 rounded-md px-2 py-1.5 text-[12px] text-white/80 outline-none focus:border-[#B48B40]/40"
                      />
                      <input
                        value={it.food}
                        onChange={(e) => patchItem(mi, ii, { food: e.target.value })}
                        placeholder="food"
                        className="flex-1 min-w-0 bg-white/[0.04] border border-white/10 rounded-md px-2 py-1.5 text-[12px] text-white/80 outline-none focus:border-[#B48B40]/40"
                      />
                      <button onClick={() => removeItem(mi, ii)} className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-white/20 hover:text-[#EF4444]/70 hover:bg-[#EF4444]/8"><Trash2 className="w-3 h-3" strokeWidth={1.6} /></button>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5 mt-1.5">
                      {MACRO_FIELDS.map(({ key, label, w }) => (
                        <div key={key} className="flex items-center gap-1">
                          <input
                            type="number" min="0" inputMode="decimal"
                            value={(it[key] as number) || ""}
                            onChange={(e) => patchItem(mi, ii, { [key]: num(e.target.value) } as Partial<PlanItem>)}
                            className={cn("w-full bg-white/[0.04] border border-white/10 rounded-md px-1.5 py-1 text-[12px] tabular-nums text-right outline-none focus:border-[#B48B40]/40", w)}
                          />
                          <span className="text-[9px] text-white/25 w-3">{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <button onClick={() => addItem(mi)} className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/[0.08] py-1.5 text-[11px] text-white/30 hover:text-white/55 hover:border-white/15">
                  <Plus className="w-3 h-3" strokeWidth={1.6} /> Add food
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 pt-3 border-t border-white/[0.05] shrink-0 flex gap-2.5" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}>
          <button onClick={onClose} className="px-3 py-2.5 rounded-xl border border-white/10 text-xs font-medium text-white/45 hover:text-white/70">Cancel</button>
          <button
            onClick={() => onSave(reconcile(meals))}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-[#B48B40] text-black text-sm font-semibold hover:bg-[#c99840] disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" strokeWidth={2.5} />}
            Save plan
          </button>
        </div>
      </div>
    </div>
  );
}
