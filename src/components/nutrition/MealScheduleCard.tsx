"use client";

import { Clock, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  buildMealSchedule, buildCarbAllocation, fastingWindowLabel,
  TRAINING_TIMING_META,
  type MealPattern, type TrainingTiming,
} from "@/lib/nutrition/approach";

/**
 * Meal-time schedule + training-day carb pyramid.
 * The schedule reflects the chosen meal pattern + first-meal time.
 * The carb allocation comes from the ebook's training-relative pyramid.
 */
export function MealScheduleCard({
  mealPattern, trainingTiming, firstMealHour24, dailyCarbsG,
  onTimingChange,
}: {
  mealPattern:     MealPattern;
  trainingTiming:  TrainingTiming;
  firstMealHour24: number;
  dailyCarbsG:     number;
  onTimingChange:  (t: TrainingTiming) => void;
}) {
  const schedule    = buildMealSchedule(mealPattern, firstMealHour24);
  const allocation  = buildCarbAllocation(mealPattern, trainingTiming);
  const windowLabel = fastingWindowLabel(mealPattern, firstMealHour24);
  const TIMINGS: TrainingTiming[] = ["fasted_am", "after_1_meal", "after_2_meals", "after_3_meals"];

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#111111] px-5 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.22em] text-white/28">When to eat</p>
        <div className="flex items-center gap-1.5 text-[10px] text-white/35">
          <Clock className="w-3 h-3" strokeWidth={1.5} />
          <span>{schedule.length} {schedule.length === 1 ? "meal" : "meals"} / day</span>
        </div>
      </div>

      {/* Window banner (only for fasting patterns) */}
      {windowLabel && (
        <div className="rounded-xl border border-[#B48B40]/22 bg-[#B48B40]/[0.04] px-3.5 py-2.5">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[#B48B40]/70 mb-0.5">Eating window</p>
          <p className="text-xs font-medium text-white/75">{windowLabel}</p>
        </div>
      )}

      {/* Meal timeline */}
      <div className="space-y-1.5">
        {schedule.map((slot, i) => {
          const alloc = allocation[i];
          return (
            <div
              key={slot.key}
              className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5"
            >
              <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0">
                <span className="text-[10px] font-semibold tabular-nums text-white/55">{i + 1}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white/80">{slot.label}</p>
                <p className="text-[10px] text-white/35">{slot.time}{alloc?.note ? ` · ${alloc.note}` : ""}</p>
              </div>
              {dailyCarbsG > 0 && alloc && (
                <div className="text-right shrink-0">
                  <p className="text-[10px] tabular-nums text-white/40">{alloc.percent}%</p>
                  <p className="text-[11px] font-semibold tabular-nums text-[#B48B40]/80">
                    ~{Math.round((dailyCarbsG * alloc.percent) / 100)}g carbs
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Training timing picker */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Activity className="w-3 h-3 text-white/35" strokeWidth={1.5} />
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/25">When do you train?</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {TIMINGS.map((t) => {
            const active = trainingTiming === t;
            const m = TRAINING_TIMING_META[t];
            return (
              <button
                key={t}
                onClick={() => onTimingChange(t)}
                className={cn(
                  "rounded-lg border px-2 py-1.5 text-center transition-all",
                  active
                    ? "border-[#B48B40]/45 bg-[#B48B40]/[0.08] text-[#B48B40]"
                    : "border-white/[0.07] bg-white/[0.02] text-white/55 hover:border-white/15 hover:text-white/75",
                )}
              >
                <p className="text-[11px] font-semibold">{m.label}</p>
                <p className="text-[9px] text-white/30 mt-0.5 leading-tight">{m.sub}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
