"use client";

import { TrendingDown, TrendingUp, Target, CheckCircle2 } from "lucide-react";
import type { GoalMode } from "@/lib/nutrition/approach";

/**
 * Weekly progress check. Shows where the user stands against their goal mode
 * over the last 7 days, with a clear "what changes if we stall" message.
 *
 * Current implementation reads the weekly calorie average + a placeholder
 * weight-trend signal. Real weight tracking lands when bodyweight logs are
 * wired up; for now we surface intent so the user understands the loop.
 */
export function WeeklyCheckInCard({
  goalMode, avgCalories, targetCalories, daysLogged,
}: {
  goalMode:       GoalMode;
  avgCalories:    number;
  targetCalories: number;
  daysLogged:     number;
}) {
  const diff      = avgCalories - targetCalories;
  const pctDiff   = targetCalories > 0 ? (diff / targetCalories) * 100 : 0;
  const isOnTrack = Math.abs(pctDiff) < 8;
  const goalArrow = goalMode === "cut" ? <TrendingDown className="w-3.5 h-3.5" strokeWidth={2} />
                   : goalMode === "build" ? <TrendingUp className="w-3.5 h-3.5" strokeWidth={2} />
                   : <Target className="w-3.5 h-3.5" strokeWidth={2} />;

  const status = (() => {
    if (daysLogged < 3) {
      return {
        tone: "neutral" as const,
        title: "Log more days to get a read",
        body:  `Log meals on ${3 - daysLogged} more day${3 - daysLogged === 1 ? "" : "s"} this week so the coach can pattern-match against your numbers.`,
      };
    }
    if (isOnTrack) {
      return {
        tone: "good" as const,
        title: "Within range",
        body:  `Your 7-day average is ${avgCalories.toLocaleString()} kcal vs ${targetCalories.toLocaleString()} target — close enough that progress should follow. Keep going.`,
      };
    }
    if (diff > 0) {
      return {
        tone: "warn" as const,
        title: `Trending ${Math.round(pctDiff)}% over target`,
        body: goalMode === "cut"
          ? `Averaging ${avgCalories.toLocaleString()} kcal vs ${targetCalories.toLocaleString()}. If the scale hasn't moved this week, the coach will tighten calories by 100–200 next cycle.`
          : `Averaging ${avgCalories.toLocaleString()} kcal vs ${targetCalories.toLocaleString()}. Fine for building, just watch fat gain at the next check-in.`,
      };
    }
    return {
      tone: "warn" as const,
      title: `Trending ${Math.round(Math.abs(pctDiff))}% under target`,
      body: goalMode === "build"
        ? `Averaging ${avgCalories.toLocaleString()} kcal vs ${targetCalories.toLocaleString()}. Too low to grow — coach will nudge calories up next cycle.`
        : `Averaging ${avgCalories.toLocaleString()} kcal vs ${targetCalories.toLocaleString()}. Aggressive deficits stall metabolism — coach watches for energy / sleep complaints.`,
    };
  })();

  const toneClass =
    status.tone === "good" ? "border-emerald-400/22 bg-emerald-400/[0.04]" :
    status.tone === "warn" ? "border-amber-400/22 bg-amber-400/[0.04]"     :
    "border-white/[0.07] bg-white/[0.02]";

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#111111] px-5 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.22em] text-white/28">Weekly check-in</p>
        <span className="flex items-center gap-1.5 text-[10px] text-white/35">
          {goalArrow}
          <span>{goalMode.charAt(0).toUpperCase() + goalMode.slice(1)} mode</span>
        </span>
      </div>

      <div className={`rounded-xl border ${toneClass} px-4 py-3 flex items-start gap-3`}>
        {status.tone === "good"
          ? <CheckCircle2 className="w-4 h-4 text-emerald-400/80 shrink-0 mt-0.5" strokeWidth={1.8} />
          : <Target        className="w-4 h-4 text-white/40 shrink-0 mt-0.5" strokeWidth={1.8} />}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-white/85 mb-0.5">{status.title}</p>
          <p className="text-[11px] text-white/55 leading-relaxed">{status.body}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 pt-1">
        <Stat label="Days logged"     value={`${daysLogged}/7`} />
        <Stat label="Avg kcal"        value={avgCalories.toLocaleString()} />
        <Stat label="Target"          value={targetCalories.toLocaleString()} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 text-center">
      <p className="text-[9px] uppercase tracking-[0.1em] text-white/30">{label}</p>
      <p className="text-sm font-semibold tabular-nums text-white/80 mt-0.5">{value}</p>
    </div>
  );
}
