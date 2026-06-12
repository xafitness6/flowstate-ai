"use client";

import { useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LoggedMeal, LoggedFoodItem } from "@/lib/nutrition/types";

// ─── Metric config ──────────────────────────────────────────────────────────

type Metric = "protein" | "carbs" | "fat" | "calories";

const METRICS: { key: Metric; label: string; unit: string; bar: string; text: string }[] = [
  { key: "protein",  label: "Protein",  unit: "g",    bar: "bg-[#B48B40]",      text: "text-[#B48B40]"   },
  { key: "carbs",    label: "Carbs",    unit: "g",    bar: "bg-[#93C5FD]/70",   text: "text-[#93C5FD]"   },
  { key: "fat",      label: "Fat",      unit: "g",    bar: "bg-emerald-400/60", text: "text-emerald-400" },
  { key: "calories", label: "Calories", unit: "kcal", bar: "bg-white/45",       text: "text-white/70"    },
];

function itemLabel(i: LoggedFoodItem): string {
  const qty  = i.quantity != null ? `${i.quantity}` : "";
  const unit = i.unit && i.unit !== "item" ? i.unit : "";
  return [qty, unit, i.name].filter(Boolean).join(" ") || "Item";
}

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * Ranks the day's individual foods by a chosen macro (MyFitnessPal-style "top
 * sources" bar chart). Switch metric via the tab row.
 */
export function MacroSourcesCard({ meals }: { meals: LoggedMeal[] }) {
  const [metric, setMetric] = useState<Metric>("protein");
  const m = METRICS.find((x) => x.key === metric)!;

  // Flatten all active (non-deleted) items across the day's meals.
  const items = useMemo(
    () => meals.flatMap((meal) => meal.items.filter((i) => !i.deletedAt)),
    [meals],
  );

  const { ranked, total } = useMemo(() => {
    const withValue = items
      .map((i) => ({ label: itemLabel(i), value: Number(i[metric] ?? 0) }))
      .filter((x) => x.value > 0);
    const total = withValue.reduce((s, x) => s + x.value, 0);
    const ranked = [...withValue].sort((a, b) => b.value - a.value).slice(0, 8);
    return { ranked, total };
  }, [items, metric]);

  const max = ranked[0]?.value ?? 1;

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#111111] px-5 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-[12px] text-white/45 font-medium">Top sources today</p>
        <BarChart3 className="w-3.5 h-3.5 text-white/25" strokeWidth={1.5} />
      </div>

      {/* Metric tabs */}
      <div className="flex gap-1.5 mb-4">
        {METRICS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setMetric(opt.key)}
            className={cn(
              "flex-1 py-1.5 rounded-lg text-[11px] font-medium transition-all border",
              opt.key === metric
                ? "bg-white/[0.06] border-white/[0.12] text-white/80"
                : "border-transparent text-white/35 hover:text-white/60",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Ranked bars */}
      {ranked.length === 0 ? (
        <p className="text-xs text-white/30 text-center py-6">
          No {m.label.toLowerCase()} logged yet today.
        </p>
      ) : (
        <div className="space-y-2.5">
          {ranked.map((row, idx) => {
            const pct   = total > 0 ? Math.round((row.value / total) * 100) : 0;
            const width = Math.max(4, Math.round((row.value / max) * 100));
            return (
              <div key={`${row.label}_${idx}`}>
                <div className="flex items-center justify-between gap-3 mb-1">
                  <span className="text-xs text-white/60 truncate">{row.label}</span>
                  <span className="text-xs tabular-nums shrink-0">
                    <span className={cn("font-semibold", m.text)}>{Math.round(row.value)}{m.unit === "g" ? "g" : ""}</span>
                    {m.unit === "kcal" && <span className="text-white/40"> kcal</span>}
                    <span className="text-white/25"> · {pct}%</span>
                  </span>
                </div>
                <div className="w-full rounded-full bg-white/[0.05] overflow-hidden h-2">
                  <div
                    className={cn("h-full rounded-full transition-all duration-500", m.bar)}
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Day total for the active metric */}
      {ranked.length > 0 && (
        <p className="text-[10px] text-white/25 mt-3 pt-3 border-t border-white/[0.05] tabular-nums">
          Day total: <span className="text-white/45">{Math.round(total)}{m.unit === "g" ? "g" : " kcal"}</span> {m.label.toLowerCase()}
          {" "}across {items.length} item{items.length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
