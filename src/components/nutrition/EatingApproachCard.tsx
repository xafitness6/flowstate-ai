"use client";

import { Check, Scale } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MEAL_PATTERN_META, GOAL_MODE_META,
  type MealPattern, type GoalMode,
} from "@/lib/nutrition/approach";

/**
 * Top of the nutrition page's "philosophy" stack.
 *  • Headline: balanced eating is the always-on foundation.
 *  • Goal mode picker (cut / maintain / build) — drives downstream calorie math.
 *  • Meal-pattern picker — when to eat (snacks / 3 / 2 / IF / OMAD).
 *  • Carb-cycling toggle — optional modality, off by default.
 */
export function EatingApproachCard({
  goalMode, mealPattern, carbCyclingOn, firstMealHour24,
  onChange,
}: {
  goalMode:        GoalMode;
  mealPattern:     MealPattern;
  carbCyclingOn:   boolean;
  firstMealHour24: number;
  onChange: (patch: Partial<{
    goalMode:        GoalMode;
    mealPattern:     MealPattern;
    carbCyclingOn:   boolean;
    firstMealHour24: number;
  }>) => void;
}) {
  const PATTERNS: MealPattern[] = ["three_plus_snacks", "three", "two", "if", "omad"];
  const GOALS:    GoalMode[]    = ["cut", "maintain", "build"];

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#111111] px-5 py-4 space-y-5">
      {/* Header — balanced eating is the philosophy */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] uppercase tracking-[0.22em] text-white/28">Your philosophy</p>
          <div className="flex items-center gap-1.5 text-[10px] text-white/35">
            <Scale className="w-3 h-3" strokeWidth={1.5} />
            <span>Balanced eating</span>
          </div>
        </div>
        <p className="text-[12px] text-white/55 leading-relaxed">
          Whole foods, protein at every meal, carbs around training — built around your real calorie + macro
          numbers. Your coach watches weekly progress and adjusts when you stall, so the food side stays simple.
        </p>
      </div>

      {/* Goal mode */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.18em] text-white/25 mb-2">Goal mode</p>
        <div className="flex rounded-xl border border-white/[0.08] overflow-hidden">
          {GOALS.map((g) => {
            const active = goalMode === g;
            const m = GOAL_MODE_META[g];
            return (
              <button
                key={g}
                onClick={() => onChange({ goalMode: g })}
                className={cn(
                  "flex-1 py-2 text-center transition-colors",
                  active
                    ? "bg-[#B48B40]/[0.12] text-[#B48B40]"
                    : "text-white/40 hover:text-white/70 hover:bg-white/[0.03]",
                )}
              >
                <p className="text-xs font-semibold">{m.label}</p>
                <p className="text-[10px] text-white/30 mt-0.5">{m.sub}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Meal pattern */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.18em] text-white/25 mb-2">Meal pattern</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {PATTERNS.map((key) => {
            const meta   = MEAL_PATTERN_META[key];
            const active = mealPattern === key;
            return (
              <button
                key={key}
                onClick={() => onChange({ mealPattern: key })}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-left transition-all",
                  active
                    ? "border-[#B48B40]/45 bg-[#B48B40]/[0.08]"
                    : "border-white/[0.08] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]",
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">{meta.icon}</span>
                  <span className={cn(
                    "text-xs font-semibold",
                    active ? "text-[#B48B40]" : "text-white/70",
                  )}>
                    {meta.label}
                  </span>
                  {active && <Check className="w-3 h-3 text-[#B48B40] ml-auto" strokeWidth={2.5} />}
                </div>
                <p className="text-[10px] text-white/35 leading-snug">{meta.tagline}</p>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-white/40 leading-relaxed mt-2.5">
          {MEAL_PATTERN_META[mealPattern].body}
        </p>
      </div>

      {/* First meal time + carb cycling toggle */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-2.5">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/30 mb-1.5">First meal at</p>
          <select
            value={firstMealHour24}
            onChange={(e) => onChange({ firstMealHour24: parseInt(e.target.value, 10) })}
            className="w-full bg-transparent text-sm font-semibold text-white/85 outline-none cursor-pointer"
          >
            {Array.from({ length: 13 }, (_, i) => 6 + i).map((h) => {
              const h12 = ((h + 11) % 12) + 1;
              const ap  = h < 12 ? "AM" : "PM";
              return <option key={h} value={h} className="bg-[#111]">{h12}:00 {ap}</option>;
            })}
          </select>
        </div>

        <button
          onClick={() => onChange({ carbCyclingOn: !carbCyclingOn })}
          className={cn(
            "rounded-xl border px-3.5 py-2.5 text-left transition-all",
            carbCyclingOn
              ? "border-[#B48B40]/45 bg-[#B48B40]/[0.08]"
              : "border-white/[0.08] bg-white/[0.02] hover:border-white/15",
          )}
        >
          <div className="flex items-center justify-between mb-0.5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/30">Optional modality</p>
            <span className={cn(
              "text-[9px] font-semibold uppercase tracking-[0.1em] px-1.5 py-0.5 rounded-md",
              carbCyclingOn
                ? "bg-[#B48B40]/20 text-[#B48B40]"
                : "bg-white/[0.06] text-white/35",
            )}>
              {carbCyclingOn ? "On" : "Off"}
            </span>
          </div>
          <p className={cn(
            "text-sm font-semibold",
            carbCyclingOn ? "text-[#B48B40]" : "text-white/70",
          )}>🔁 Carb cycling</p>
          <p className="text-[10px] text-white/35 leading-snug mt-0.5">
            High/low carb days around your training
          </p>
        </button>
      </div>
    </div>
  );
}
