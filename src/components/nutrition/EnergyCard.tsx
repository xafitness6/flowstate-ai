"use client";

import { Flame, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { BMR_METHOD_LABEL, type EnergyProfile } from "@/lib/nutrition";
import {
  GOAL_MODE_META, goalCalorieAdjustment, goalAdjustedCalories,
  type GoalMode,
} from "@/lib/nutrition/approach";

/**
 * Energy breakdown — BMR → maintenance (TDEE) → goal-adjusted target.
 * The Cut / Maintain / Build pill changes which target line you see.
 */
export function EnergyCard({
  energy, goalMode, goalLabel, className,
}: {
  energy:     EnergyProfile;
  goalMode?:  GoalMode;        // when omitted, falls back to the intake-derived target
  goalLabel?: string;
  className?: string;
}) {
  const { bmr, tdee, targetCalories, activityMultiplier, goalAdjustment, method, leanMassKg } = energy;

  // When the page passes a goalMode override, recompute from TDEE; else use the
  // value the EnergyProfile was created with.
  const target  = goalMode ? goalAdjustedCalories(tdee, goalMode) : targetCalories;
  const adjKcal = goalMode ? goalCalorieAdjustment(goalMode) : goalAdjustment;
  const tgtLabel = goalMode ? GOAL_MODE_META[goalMode].label : "Target";
  const tgtSub   = goalMode ? GOAL_MODE_META[goalMode].sub   : (goalLabel || "Goal-adjusted");

  // Bars scaled to the largest of the three so the comparison reads at a glance.
  const max  = Math.max(bmr, tdee, target, 1);
  const rows = [
    { label: "BMR",         sub: "At rest",                value: bmr,    color: "bg-white/30"      },
    { label: "Maintenance", sub: "BMR × activity",         value: tdee,   color: "bg-[#93C5FD]/55"  },
    { label: tgtLabel,      sub: tgtSub,                   value: target, color: "bg-[#B48B40]" },
  ];

  const adjLabel = adjKcal === 0 ? "maintenance" : `${adjKcal > 0 ? "+" : ""}${adjKcal} kcal`;

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-white/45 font-medium">Energy</p>
        <Flame className="w-3.5 h-3.5 text-[#B48B40]/40" strokeWidth={1.5} />
      </div>

      {/* Headline target */}
      <div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[1.6rem] font-semibold tabular-nums leading-none text-white/90">
            {target.toLocaleString()}
          </span>
          <span className="text-sm text-white/28">kcal/day · {tgtLabel.toLowerCase()}</span>
        </div>
        <p className="text-xs text-white/30 mt-1">
          {leanMassKg != null ? `${leanMassKg} kg lean mass · ` : ""}
          BMR {bmr.toLocaleString()} × {activityMultiplier} → {tdee.toLocaleString()} maintenance
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

      {/* Footnote */}
      <div className="flex items-start gap-1.5 pt-0.5">
        <Info className="w-3 h-3 text-white/20 shrink-0 mt-0.5" strokeWidth={1.5} />
        <p className="text-[10px] text-white/28 leading-relaxed">
          Target = maintenance {adjKcal === 0 ? "" : adjLabel}.{" "}
          {BMR_METHOD_LABEL[method]}.
        </p>
      </div>
    </div>
  );
}
