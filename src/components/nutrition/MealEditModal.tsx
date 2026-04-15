"use client";

import { useState } from "react";
import {
  X, ChevronDown, Plus, Trash2, ChevronUp, Check, Pencil,
} from "lucide-react";
import { cn }         from "@/lib/utils";
import { updateMeal, recalcMealTotals } from "@/lib/nutrition/store";
import type {
  LoggedMeal,
  LoggedFoodItem,
  MealType,
  MealTotals,
} from "@/lib/nutrition/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EditItem extends LoggedFoodItem {
  _expanded: boolean;
}

interface Props {
  meal:     LoggedMeal;
  userId:   string;
  onSave:   (updated: LoggedMeal) => void;
  onCancel: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MEAL_TYPE_OPTIONS: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast", lunch: "Lunch",
  dinner:    "Dinner",    snack: "Snack", unknown: "Meal",
};
const UNIT_OPTIONS = ["g", "oz", "ml", "cup", "tbsp", "tsp", "item", "slice", "scoop"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function newItem(source: LoggedFoodItem["source"]): EditItem {
  return {
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
    source,
    deletedAt:  null,
    _expanded:  true,
  };
}

function displayTotals(items: EditItem[]): MealTotals {
  return recalcMealTotals(items.filter((i) => !i.deletedAt));
}

function numField(v: number | null): string {
  return v != null ? String(v) : "";
}

function parseNum(s: string): number | null {
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

/** Convert local datetime-input value "YYYY-MM-DDTHH:mm" → full ISO */
function localToISO(local: string): string {
  if (!local) return new Date().toISOString();
  return new Date(local).toISOString();
}

/** ISO → "YYYY-MM-DDTHH:mm" for datetime-local input */
function isoToLocal(iso: string): string {
  return iso.slice(0, 16);
}

// ─── Item row ─────────────────────────────────────────────────────────────────

function ItemRow({
  item,
  onChange,
  onRemove,
  onRestore,
  onToggle,
}: {
  item:      EditItem;
  onChange:  (id: string, patch: Partial<EditItem>) => void;
  onRemove:  (id: string) => void;
  onRestore: (id: string) => void;
  onToggle:  (id: string) => void;
}) {
  const deleted = !!item.deletedAt;
  const label   = [item.quantity, item.unit && item.unit !== "item" ? item.unit : "", item.name]
    .filter(Boolean).join(" ") || "New item";

  if (deleted) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-white/[0.04] bg-white/[0.01] px-3.5 py-2.5 opacity-35">
        <span className="flex-1 text-sm text-white/30 line-through truncate">{label}</span>
        <button
          onClick={() => onRestore(item.id)}
          className="text-[10px] text-white/30 hover:text-white/60 transition-colors shrink-0"
        >
          Restore
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      {/* Compact header */}
      <div className="flex items-center gap-3 px-3.5 py-2.5">
        <button
          onClick={() => onToggle(item.id)}
          className="flex-1 flex items-center gap-2 text-left min-w-0"
        >
          <Pencil className="w-3 h-3 text-white/25 shrink-0" strokeWidth={1.5} />
          <span className="text-sm text-white/70 truncate">{label}</span>
          {item.calories != null && (
            <span className="text-[10px] text-white/25 tabular-nums shrink-0">{item.calories} kcal</span>
          )}
          {item._expanded
            ? <ChevronUp   className="w-3.5 h-3.5 text-white/18 shrink-0" strokeWidth={1.5} />
            : <ChevronDown className="w-3.5 h-3.5 text-white/18 shrink-0" strokeWidth={1.5} />}
        </button>
        <button
          onClick={() => onRemove(item.id)}
          className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-white/18 hover:text-[#EF4444]/60 hover:bg-[#EF4444]/8 transition-all"
        >
          <Trash2 className="w-3 h-3" strokeWidth={1.5} />
        </button>
      </div>

      {/* Expanded edit fields */}
      {item._expanded && (
        <div className="border-t border-white/[0.05] px-3.5 pb-3.5 pt-3 space-y-2.5">
          {/* Name */}
          <div>
            <label className="text-[10px] uppercase tracking-[0.14em] text-white/20 mb-1 block">Name</label>
            <input
              type="text"
              value={item.name}
              onChange={(e) => onChange(item.id, { name: e.target.value })}
              placeholder="e.g. chicken breast"
              className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-white/75 placeholder:text-white/20 outline-none focus:border-[#B48B40]/30 transition-colors"
            />
          </div>

          {/* Qty + Unit on same row */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] uppercase tracking-[0.14em] text-white/20 mb-1 block">Quantity</label>
              <input
                type="number"
                min="0"
                step="any"
                value={numField(item.quantity)}
                onChange={(e) => onChange(item.id, { quantity: parseNum(e.target.value) })}
                placeholder="e.g. 3"
                className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-white/75 placeholder:text-white/20 outline-none focus:border-[#B48B40]/30 transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.14em] text-white/20 mb-1 block">Unit</label>
              <select
                value={item.unit ?? ""}
                onChange={(e) => onChange(item.id, { unit: e.target.value || null })}
                className="w-full bg-[#111111] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-white/75 outline-none focus:border-[#B48B40]/30 transition-colors"
              >
                <option value="">—</option>
                {UNIT_OPTIONS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Grams */}
          <div>
            <label className="text-[10px] uppercase tracking-[0.14em] text-white/20 mb-1 block">Grams (weight)</label>
            <input
              type="number"
              min="0"
              step="any"
              value={numField(item.grams)}
              onChange={(e) => onChange(item.id, { grams: parseNum(e.target.value) })}
              placeholder="e.g. 150"
              className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-white/75 placeholder:text-white/20 outline-none focus:border-[#B48B40]/30 transition-colors"
            />
          </div>

          {/* Macros: 2x2 grid */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { key: "calories", label: "Calories",  placeholder: "e.g. 210", suffix: "kcal" },
              { key: "protein",  label: "Protein",   placeholder: "e.g. 18",  suffix: "g"    },
              { key: "carbs",    label: "Carbs",     placeholder: "e.g. 1",   suffix: "g"    },
              { key: "fat",      label: "Fat",       placeholder: "e.g. 15",  suffix: "g"    },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="text-[10px] uppercase tracking-[0.14em] text-white/20 mb-1 block">
                  {label}
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={numField(item[key as keyof EditItem] as number | null)}
                  onChange={(e) =>
                    onChange(item.id, { [key]: parseNum(e.target.value) } as Partial<EditItem>)
                  }
                  placeholder={placeholder}
                  className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-white/75 placeholder:text-white/20 outline-none focus:border-[#B48B40]/30 transition-colors"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Totals bar ───────────────────────────────────────────────────────────────

function TotalsBar({ totals }: { totals: MealTotals }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {[
        { label: "Cal",  value: totals.calories, color: "text-white/70"       },
        { label: "P",    value: totals.protein,  color: "text-[#B48B40]/80"  },
        { label: "C",    value: totals.carbs,    color: "text-[#93C5FD]/70"  },
        { label: "F",    value: totals.fat,      color: "text-emerald-400/60" },
      ].map(({ label, value, color }) => (
        <div key={label} className="rounded-xl border border-white/5 bg-white/[0.02] px-2.5 py-2.5 text-center">
          <p className="text-[9px] uppercase tracking-[0.1em] text-white/22 mb-1">{label}</p>
          <p className={cn("text-sm font-semibold tabular-nums leading-none", color)}>
            {Math.round(value)}
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MealEditModal({ meal, userId, onSave, onCancel }: Props) {
  const [mealType,  setMealType]  = useState<MealType>(meal.mealType);
  const [eatenAt,   setEatenAt]   = useState(isoToLocal(meal.eatenAt));
  const [notes,     setNotes]     = useState(meal.notes ?? "");
  const [typeOpen,  setTypeOpen]  = useState(false);
  const [saving,    setSaving]    = useState(false);

  const [items, setItems] = useState<EditItem[]>(
    meal.items.map((item) => ({ ...item, _expanded: true })),
  );

  const totals = displayTotals(items);

  function updateItem(id: string, patch: Partial<EditItem>) {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    );
  }

  function removeItem(id: string) {
    setItems((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, deletedAt: new Date().toISOString() } : i,
      ),
    );
  }

  function restoreItem(id: string) {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, deletedAt: null } : i)),
    );
  }

  function toggleItem(id: string) {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, _expanded: !i._expanded } : i)),
    );
  }

  function addItem() {
    setItems((prev) => [...prev, newItem(meal.source)]);
  }

  async function handleSave() {
    setSaving(true);
    // Strip _expanded before saving
    const cleanItems = items.map(({ _expanded: _, ...rest }) => rest);
    const updated = await updateMeal(userId, meal.id, {
      mealType,
      eatenAt:   localToISO(eatenAt),
      notes:     notes.trim() || null,
      items:     cleanItems,
      totals:    recalcMealTotals(cleanItems.filter((i) => !i.deletedAt)),
    });
    setSaving(false);
    if (updated) onSave(updated);
  }

  const activeItemCount = items.filter((i) => !i.deletedAt).length;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />

      <div
        className="relative w-full sm:max-w-md bg-[#0D0D0D] border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: "92dvh" }}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-white/[0.06] shrink-0 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white/80 tracking-tight">Edit meal</h2>
            <p className="text-[11px] text-white/30 mt-0.5">Changes save immediately after confirming</p>
          </div>
          <button
            onClick={onCancel}
            className="w-7 h-7 rounded-lg border border-white/8 bg-white/[0.03] flex items-center justify-center text-white/30 hover:text-white/65 transition-colors"
          >
            <X className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5" style={{ scrollbarWidth: "none" }}>

          {/* Meal type */}
          <div className="relative">
            <label className="text-[10px] uppercase tracking-[0.2em] text-white/22 mb-2 block">Meal type</label>
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

          {/* Eaten at */}
          <div>
            <label className="text-[10px] uppercase tracking-[0.2em] text-white/22 mb-2 block">
              Date &amp; time eaten
            </label>
            <input
              type="datetime-local"
              value={eatenAt}
              onChange={(e) => setEatenAt(e.target.value)}
              className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-2.5 text-sm text-white/70 outline-none focus:border-[#B48B40]/30 transition-colors [color-scheme:dark]"
            />
          </div>

          {/* Food items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] uppercase tracking-[0.2em] text-white/22">
                Items ({activeItemCount})
              </label>
            </div>
            <div className="space-y-2">
              {items.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  onChange={updateItem}
                  onRemove={removeItem}
                  onRestore={restoreItem}
                  onToggle={toggleItem}
                />
              ))}
              <button
                onClick={addItem}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/[0.08] py-2.5 text-xs text-white/28 hover:text-white/50 hover:border-white/15 transition-all"
              >
                <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
                Add food item
              </button>
            </div>
          </div>

          {/* Totals */}
          <div>
            <label className="text-[10px] uppercase tracking-[0.2em] text-white/22 mb-2 block">Totals</label>
            <TotalsBar totals={totals} />
          </div>

          {/* Notes */}
          <div>
            <label className="text-[10px] uppercase tracking-[0.2em] text-white/22 mb-2 block">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes about this meal…"
              rows={2}
              className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-3 text-sm text-white/65 placeholder:text-white/20 resize-none outline-none focus:border-[#B48B40]/30 transition-colors leading-relaxed"
            />
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 pb-6 pt-4 border-t border-white/[0.05] shrink-0 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm font-medium text-white/40 hover:text-white/60 hover:border-white/18 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || activeItemCount === 0}
            className="flex-1 py-2.5 rounded-xl bg-[#B48B40]/15 border border-[#B48B40]/25 text-sm font-semibold text-[#B48B40] hover:bg-[#B48B40]/22 hover:border-[#B48B40]/35 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {saving ? (
              <span className="text-xs text-white/40">Saving…</span>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                Save changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
