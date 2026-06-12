"use client";

import { Scale, Repeat, Clock, Activity } from "lucide-react";
import {
  MEAL_PATTERN_META, TRAINING_TIMING_META, GOAL_MODE_META,
  fastingWindowLabel,
  type ApproachState,
} from "@/lib/nutrition/approach";

/**
 * Read-only summary of the client's chosen nutrition approach. Mounted in the
 * trainer's client file so the coach can see the same picker state the client
 * is operating from — meal pattern, training timing, carb cycling, goal mode.
 */
export function ApproachSummary({
  approach,
  className,
}: {
  approach: ApproachState | null;
  className?: string;
}) {
  if (!approach) {
    return (
      <div className={`rounded-2xl border border-white/[0.07] bg-[#111111] px-5 py-4 ${className ?? ""}`}>
        <p className="text-[12px] text-white/45 font-medium">Approach</p>
        <p className="text-xs text-white/40 mt-2">
          Client hasn&apos;t saved a nutrition approach yet.
        </p>
      </div>
    );
  }

  const pattern = MEAL_PATTERN_META[approach.mealPattern];
  const goal    = GOAL_MODE_META[approach.goalMode];
  const timing  = TRAINING_TIMING_META[approach.trainingTiming];
  const window  = fastingWindowLabel(approach.mealPattern, approach.firstMealHour24);

  return (
    <div className={`rounded-2xl border border-white/[0.07] bg-[#111111] px-5 py-4 space-y-3 ${className ?? ""}`}>
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-white/45 font-medium">Approach</p>
        <div className="flex items-center gap-1.5 text-[10px] text-white/35">
          <Scale className="w-3 h-3" strokeWidth={1.5} />
          <span>Balanced + chosen modality</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Tile
          label="Goal mode"
          value={goal.label}
          sub={goal.sub}
          accent="gold"
        />
        <Tile
          label="Meal pattern"
          value={`${pattern.icon} ${pattern.label}`}
          sub={pattern.tagline}
        />
        <Tile
          label="Training timing"
          value={timing.label}
          sub={timing.sub}
          icon={<Activity className="w-3 h-3" strokeWidth={1.5} />}
        />
        <Tile
          label="Carb cycling"
          value={approach.carbCyclingOn ? "On" : "Off"}
          sub={approach.carbCyclingOn ? "High/low day rotation" : "Even daily macros"}
          icon={<Repeat className="w-3 h-3" strokeWidth={1.5} />}
          accent={approach.carbCyclingOn ? "gold" : undefined}
        />
      </div>

      {window && (
        <div className="rounded-xl border border-[#B48B40]/22 bg-[#B48B40]/[0.04] px-3.5 py-2 flex items-center gap-2">
          <Clock className="w-3 h-3 text-[#B48B40]/70 shrink-0" strokeWidth={1.5} />
          <p className="text-xs text-white/75 font-medium">{window}</p>
        </div>
      )}
    </div>
  );
}

function Tile({
  label, value, sub, icon, accent,
}: {
  label: string; value: string; sub?: string;
  icon?: React.ReactNode; accent?: "gold";
}) {
  const accentCls = accent === "gold"
    ? "border-[#B48B40]/30 bg-[#B48B40]/[0.06]"
    : "border-white/[0.06] bg-white/[0.02]";
  const valueCls = accent === "gold" ? "text-[#B48B40]" : "text-white/85";
  return (
    <div className={`rounded-xl border px-3 py-2 ${accentCls}`}>
      <div className="flex items-center gap-1.5">
        {icon}
        <p className="text-[10px] font-medium text-white/35">{label}</p>
      </div>
      <p className={`text-sm font-semibold mt-0.5 ${valueCls}`}>{value}</p>
      {sub && <p className="text-[10px] text-white/35 mt-0.5 leading-snug">{sub}</p>}
    </div>
  );
}
