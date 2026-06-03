"use client";

import { Flame, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { BMR_METHOD_LABEL, type EnergyProfile } from "@/lib/nutrition";

/**
 * Energy breakdown card — BMR → maintenance (TDEE) → target calories.
 * Shared by the client's nutrition tab and the trainer's client file.
 */
export function EnergyCard({
  energy,
  goalLabel,
  className,
}: {
  energy:     EnergyProfile;
  goalLabel?: string;
  className?: string;
}) {
  const { bmr, tdee, targetCalories, activityMultiplier, goalAdjustment, method, leanMassKg } = energy;

  // Bars scaled to the largest of the three so the comparison reads at a glance.
  const max = Math.max(bmr, tdee, targetCalories, 1);
  const rows = [
    { label: "BMR",         sub: "At rest",      value: bmr,            color: "bg-white/30"      },
    { label: "Maintenance", sub: "BMR × activity", value: tdee,         color: "bg-[#93C5FD]/55"  },
    { label: "Target",      sub: goalLabel || "Goal-adjusted", value: targetCalories, color: "bg-[#B48B40]" },
  ];

  const adj = goalAdjustment === 0
    ? "maintenance"
    : `${goalAdjustment > 0 ? "+" : ""}${goalAdjustment} kcal`;

  return (
    <div className={cn("rounded-2xl border border-white/[0.07] bg-[#111111] px-5 py-4 flex flex-col gap-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.22em] text-white/28">Energy</p>
        <Flame className="w-3.5 h-3.5 text-[#B48B40]/40" strokeWidth={1.5} />
      </div>

      {/* Headline BMR */}
      <div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[1.6rem] font-semibold tabular-nums leading-none text-white/90">
            {bmr.toLocaleString()}
          </span>
          <span className="text-sm text-white/28">kcal/day BMR</span>
        </div>
        <p className="text-xs text-white/30 mt-1">
          {leanMassKg != null ? `${leanMassKg} kg lean mass · ` : ""}
          ×{activityMultiplier} activity → {tdee.toLocaleString()} maintenance
        </p>
      </div>

      {/* Bars */}
      <div className="space-y-2.5">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-white/45">
                {r.label} <span className="text-white/22">· {r.sub}</span>
              </span>
              <span className="text-xs tabular-nums text-white/55">{r.value.toLocaleString()}</span>
            </div>
            <div className="w-full rounded-full bg-white/[0.06] overflow-hidden h-1.5">
              <div
                className={cn("h-full rounded-full transition-all duration-700", r.color)}
                style={{ width: `${Math.round((r.value / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Footnote: goal adjustment + method */}
      <div className="flex items-start gap-1.5 pt-0.5">
        <Info className="w-3 h-3 text-white/20 shrink-0 mt-0.5" strokeWidth={1.5} />
        <p className="text-[10px] text-white/28 leading-relaxed">
          Target = maintenance {goalAdjustment === 0 ? "(" : ""}{adj}{goalAdjustment === 0 ? ")" : ""}.{" "}
          {BMR_METHOD_LABEL[method]}.
        </p>
      </div>
    </div>
  );
}
