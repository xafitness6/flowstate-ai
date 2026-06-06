"use client";

import { ArrowUp, ArrowDown, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CarbCycleBreakdown, CycleDay } from "@/lib/nutrition/approach";

/**
 * Carb-cycling day-by-day breakdown. Mounted when the user picks
 * "Carb cycling" as their approach. Math comes from buildCarbCycleBreakdown().
 */
export function CarbCyclingCard({ data }: { data: CarbCycleBreakdown }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#111111] px-5 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.22em] text-white/28">Your carb cycle</p>
        <div className="flex items-center gap-1.5 text-[10px] text-white/35">
          <Repeat className="w-3 h-3" strokeWidth={1.5} />
          <span>{data.ratioLabel}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <DayCard day={data.high} perWeek={data.highPerWeek} />
        <DayCard day={data.low}  perWeek={data.lowPerWeek} />
      </div>

      <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-3.5 py-3">
        <p className="text-[10px] uppercase tracking-[0.18em] text-white/30 mb-1.5">Carb pyramid</p>
        <p className="text-[11px] text-white/45 leading-relaxed">
          On <span className="text-white/70 font-medium">high days</span>, place ~30–35% of carbs right after your workout,
          20–25% in the next meal, the rest sprinkled at 10–15% each. On <span className="text-white/70 font-medium">low days</span>,
          earn your carbs — keep them post-workout and lean on low-glycemic veg the rest of the day.
        </p>
      </div>

      {data.proteinBasis === "fallback" && (
        <p className="text-[10px] text-amber-400/60 leading-relaxed">
          Protein is a default — add your bodyweight in onboarding to lock 1g/lb.
        </p>
      )}
    </div>
  );
}

function DayCard({ day, perWeek }: { day: CycleDay; perWeek: number }) {
  const isHigh = day.type === "high";
  const Icon   = isHigh ? ArrowUp : ArrowDown;
  return (
    <div className={cn(
      "rounded-xl border px-3.5 py-3",
      isHigh
        ? "border-[#B48B40]/25 bg-[#B48B40]/[0.04]"
        : "border-white/[0.07] bg-white/[0.02]",
    )}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Icon
            className={cn("w-3.5 h-3.5", isHigh ? "text-[#B48B40]" : "text-white/45")}
            strokeWidth={2}
          />
          <span className={cn(
            "text-xs font-semibold",
            isHigh ? "text-[#B48B40]" : "text-white/70",
          )}>
            {isHigh ? "High-carb day" : "Low-carb day"}
          </span>
        </div>
        <span className="text-[10px] text-white/30">{perWeek}/wk</span>
      </div>

      <div className="flex items-baseline gap-1.5 mb-2">
        <span className="text-[1.4rem] font-semibold tabular-nums leading-none text-white/90">
          {day.calories.toLocaleString()}
        </span>
        <span className="text-[10px] text-white/35">kcal</span>
      </div>

      <div className="grid grid-cols-3 gap-1.5 text-center">
        <Pill label="Protein" value={`${day.proteinG}g`} accent />
        <Pill label="Carbs"   value={`${day.carbsG}g`} highlight={isHigh} />
        <Pill label="Fat"     value={`${day.fatG}g`} />
      </div>
    </div>
  );
}

function Pill({
  label, value, accent, highlight,
}: {
  label: string; value: string; accent?: boolean; highlight?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-lg border px-1.5 py-1.5",
      highlight
        ? "border-[#B48B40]/30 bg-[#B48B40]/[0.05]"
        : accent
          ? "border-emerald-400/15 bg-emerald-400/[0.03]"
          : "border-white/[0.06] bg-white/[0.02]",
    )}>
      <p className="text-[9px] uppercase tracking-[0.1em] text-white/35">{label}</p>
      <p className={cn(
        "text-xs font-semibold tabular-nums mt-0.5",
        highlight ? "text-[#B48B40]" : accent ? "text-emerald-300/80" : "text-white/75",
      )}>
        {value}
      </p>
    </div>
  );
}
