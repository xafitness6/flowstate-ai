"use client";

import { useState } from "react";
import {
  TrendingDown, TrendingUp, Target, CheckCircle2, Plus, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { GoalMode } from "@/lib/nutrition/approach";
import { logWeight, type WeightTrend } from "@/lib/nutrition/weightLogs";
import { kgToDisplayUnit, displayUnitToKg, weightUnitLabel, type UnitSystem } from "@/lib/units";

/**
 * Weekly progress check + inline weight log.
 * Combines a 7-day calorie average with a 7-day bodyweight delta so the
 * "coach adjusts when you stall" loop has real signal — not just intent.
 *
 * Calories alone tell you compliance; weight tells you whether the deficit/
 * surplus is biting. Both together give the actionable verdict.
 */
export function WeeklyCheckInCard({
  userId, goalMode, avgCalories, targetCalories, daysLogged,
  weightTrend, unitSystem = "metric",
  onWeightLogged,
}: {
  userId:         string;
  goalMode:       GoalMode;
  avgCalories:    number;
  targetCalories: number;
  daysLogged:     number;
  weightTrend:    WeightTrend;
  unitSystem?:    UnitSystem;
  onWeightLogged: () => void;
}) {
  const [logOpen, setLogOpen]     = useState(false);
  const [weightInput, setWeightInput] = useState("");
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);

  async function submitWeight() {
    setError(null);
    const display = parseFloat(weightInput);
    if (!Number.isFinite(display) || display <= 0) {
      setError("Enter a valid weight."); return;
    }
    setSaving(true);
    const kg = unitSystem === "imperial" ? displayUnitToKg(display, "imperial") : display;
    const result = await logWeight(userId, kg);
    setSaving(false);
    if (!result) {
      setError("Couldn't save — try again."); return;
    }
    setWeightInput(""); setLogOpen(false);
    onWeightLogged();
  }

  // ── Diagnose progress against goal ──────────────────────────────────────────

  const pctDiff   = targetCalories > 0 ? ((avgCalories - targetCalories) / targetCalories) * 100 : 0;
  const onCal     = Math.abs(pctDiff) < 8;
  const overCal   = pctDiff >= 8;
  const underCal  = pctDiff <= -8;

  // What does the goal want the scale to do?
  const wantDown  = goalMode === "cut";
  const wantUp    = goalMode === "build";
  const wantFlat  = goalMode === "maintain";

  const goalArrow = wantDown ? <TrendingDown className="w-3.5 h-3.5" strokeWidth={2} />
                   : wantUp  ? <TrendingUp   className="w-3.5 h-3.5" strokeWidth={2} />
                   :           <Target        className="w-3.5 h-3.5" strokeWidth={2} />;

  // Reading a "stall" from the trend: cutter not losing, builder not gaining,
  // or maintainer drifting more than ±0.5kg/wk.
  const trendKg     = weightTrend.deltaKg ?? 0;
  const cuttingStall = wantDown && weightTrend.hasTrend && trendKg > -0.2;
  const buildingStall = wantUp   && weightTrend.hasTrend && trendKg <  0.1;
  const maintainDrift = wantFlat && weightTrend.hasTrend && Math.abs(trendKg) > 0.6;

  const status = (() => {
    if (daysLogged < 3 && !weightTrend.hasTrend) {
      return {
        tone:  "neutral" as const,
        title: "Log more to get a real read",
        body:  `Need at least 3 days of meals and 2 weigh-ins this week so the coach has signal to act on.`,
      };
    }
    if (weightTrend.hasTrend && cuttingStall) {
      return {
        tone:  "warn" as const,
        title: `Cut stalled — scale only moved ${formatDelta(trendKg)} this week`,
        body:  overCal
          ? `Averaging ${avgCalories.toLocaleString()} kcal — ${Math.round(pctDiff)}% over target. Tighten back to target first; the coach will pull calories another 100–200 if next week stays flat.`
          : `On target calories but the scale isn't moving. Coach will trim calories 100–200 next cycle or bump training intensity.`,
      };
    }
    if (weightTrend.hasTrend && buildingStall) {
      return {
        tone:  "warn" as const,
        title: `Build flat — scale ${trendKg === 0 ? "didn't move" : `only moved ${formatDelta(trendKg)}`} this week`,
        body:  underCal
          ? `Averaging ${avgCalories.toLocaleString()} kcal — ${Math.round(Math.abs(pctDiff))}% under target. Hit target consistently first; coach adds 150–200 if growth still doesn't follow.`
          : `On target but no growth — coach will add 100–200 calories next cycle and watch recovery.`,
      };
    }
    if (weightTrend.hasTrend && maintainDrift) {
      return {
        tone:  "warn" as const,
        title: `Drifting ${trendKg > 0 ? "up" : "down"} — ${formatDelta(trendKg)} this week`,
        body:  `Maintenance mode but the scale moved ${formatDelta(trendKg)}. Coach will adjust calories ${trendKg > 0 ? "down" : "up"} 100 to stabilise.`,
      };
    }
    if (weightTrend.hasTrend && wantDown && trendKg <= -0.2 && trendKg >= -1.0) {
      return {
        tone:  "good" as const,
        title: `On a clean cut — down ${formatDelta(Math.abs(trendKg))} this week`,
        body:  `Sustainable rate (0.5–2 lb/wk). Keep the deficit honest and the training in.`,
      };
    }
    if (weightTrend.hasTrend && wantDown && trendKg < -1.0) {
      return {
        tone:  "warn" as const,
        title: `Dropping fast — ${formatDelta(Math.abs(trendKg))} this week`,
        body:  `Aggressive — risk of muscle loss. Coach will loosen the deficit if energy or recovery dip.`,
      };
    }
    if (weightTrend.hasTrend && wantUp && trendKg >= 0.2 && trendKg <= 0.7) {
      return {
        tone:  "good" as const,
        title: `Building cleanly — up ${formatDelta(trendKg)} this week`,
        body:  `Right rate for lean mass (0.4–1.5 lb/wk). Keep protein anchored and carbs around training.`,
      };
    }
    if (onCal) {
      return {
        tone:  "good" as const,
        title: "Calories on target",
        body:  weightTrend.hasTrend
          ? `Avg ${avgCalories.toLocaleString()} kcal vs ${targetCalories.toLocaleString()}, weight ${formatDelta(trendKg)} this week. Doing the work.`
          : `Avg ${avgCalories.toLocaleString()} kcal vs ${targetCalories.toLocaleString()}. Add a weigh-in or two so the coach can see the body's response.`,
      };
    }
    if (overCal) {
      return {
        tone:  "warn" as const,
        title: `${Math.round(pctDiff)}% over target`,
        body:  wantDown
          ? `Averaging ${avgCalories.toLocaleString()} kcal vs ${targetCalories.toLocaleString()}. Pull back to target first — coach won't cut again until you're consistent.`
          : `Fine for building, but watch fat gain at the next check-in.`,
      };
    }
    return {
      tone:  "warn" as const,
      title: `${Math.round(Math.abs(pctDiff))}% under target`,
      body:  wantUp
        ? `Averaging ${avgCalories.toLocaleString()} kcal — too low to grow. Coach will nudge up next cycle.`
        : `Aggressive deficits stall metabolism — watch for energy and sleep complaints.`,
    };
  })();

  const toneClass =
    status.tone === "good" ? "border-emerald-400/22 bg-emerald-400/[0.04]" :
    status.tone === "warn" ? "border-amber-400/22 bg-amber-400/[0.04]"     :
    "border-white/[0.07] bg-white/[0.02]";

  const latestDisplay = weightTrend.latestKg != null
    ? formatDisplayWeight(weightTrend.latestKg, unitSystem)
    : null;
  const deltaDisplay  = weightTrend.deltaKg != null
    ? formatDelta(unitSystem === "imperial"
      ? kgToDisplayUnit(weightTrend.deltaKg, "imperial")
      : weightTrend.deltaKg)
    : null;

  // Headline weekly weight delta — the single most-asked question on this card.
  // Shows "+5 lbs", "-5 lbs", or "Maintained" with intent-aware coloring so
  // it reads at a glance: cutter losing = good, cutter gaining = warn, etc.
  const weeklyDelta = (() => {
    if (!weightTrend.hasTrend || weightTrend.deltaKg == null) return null;
    const display = unitSystem === "imperial"
      ? kgToDisplayUnit(weightTrend.deltaKg, "imperial")
      : weightTrend.deltaKg;
    const rounded = Math.round(display * 10) / 10;
    const unit    = weightUnitLabel(unitSystem);
    // ±0.2 lbs / 0.1 kg counts as maintained — scale noise shouldn't read as drift.
    const noiseFloor = unitSystem === "imperial" ? 0.2 : 0.1;
    if (Math.abs(rounded) < noiseFloor) {
      return { text: "Maintained", tone: wantFlat ? "good" : "neutral" as const };
    }
    const text = `${rounded > 0 ? "+" : ""}${rounded} ${unit}`;
    // Tone follows the goal direction:
    // cutter wants down, builder wants up, maintainer wants flat.
    let tone: "good" | "warn" | "neutral" = "neutral";
    if (wantDown) tone = rounded < 0 ? "good" : "warn";
    if (wantUp)   tone = rounded > 0 ? "good" : "warn";
    if (wantFlat) tone = Math.abs(rounded) <= (unitSystem === "imperial" ? 1 : 0.5) ? "good" : "warn";
    return { text, tone };
  })();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] text-white/45 font-medium">Weekly check-in</p>
        <div className="flex items-center gap-2 shrink-0">
          {weeklyDelta && (
            <span className={cn(
              "text-[11px] font-semibold tabular-nums px-2 py-0.5 rounded-full border",
              weeklyDelta.tone === "good"
                ? "border-emerald-400/30 bg-emerald-400/[0.08] text-emerald-300/90"
                : weeklyDelta.tone === "warn"
                ? "border-amber-400/30 bg-amber-400/[0.08] text-amber-300/90"
                : "border-white/15 bg-white/[0.04] text-white/65",
            )}
              title="Bodyweight change vs. seven days ago"
            >
              {weeklyDelta.text}
            </span>
          )}
          <span className="flex items-center gap-1.5 text-[10px] text-white/35">
            {goalArrow}
            <span>{goalMode.charAt(0).toUpperCase() + goalMode.slice(1)} mode</span>
          </span>
        </div>
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

      <div className="grid grid-cols-4 gap-2 pt-1">
        <Stat label="Days logged" value={`${daysLogged}/7`} />
        <Stat label="Avg kcal"    value={avgCalories.toLocaleString()} />
        <Stat
          label="Weight"
          value={latestDisplay ?? "—"}
          sub={deltaDisplay ? `${deltaDisplay} / 7d` : null}
        />
        <Stat label="Target" value={targetCalories.toLocaleString()} />
      </div>

      {/* Inline weight log */}
      <div className="pt-1">
        {!logOpen ? (
          <button
            onClick={() => setLogOpen(true)}
            className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[11px] font-semibold text-white/55 hover:text-[#B48B40] hover:border-[#B48B40]/30 transition-all"
          >
            <Plus className="w-3 h-3" strokeWidth={2} />
            Log today&apos;s weight
          </button>
        ) : (
          <div className="rounded-xl border border-[#B48B40]/22 bg-[#B48B40]/[0.04] px-3 py-2.5 space-y-2">
            <p className="text-[11px] font-medium text-[#B48B40]/65">Today&apos;s weigh-in</p>
            <div className="flex items-center gap-2">
              <input
                autoFocus
                type="number"
                step="0.1"
                inputMode="decimal"
                placeholder={unitSystem === "imperial" ? "168.4" : "76.4"}
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submitWeight(); }}
                className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm font-semibold tabular-nums text-white/85 outline-none focus:border-[#B48B40]/40"
              />
              <span className="text-xs text-white/40 shrink-0">{weightUnitLabel(unitSystem)}</span>
              <button
                onClick={submitWeight}
                disabled={saving || !weightInput.trim()}
                className={cn(
                  "rounded-lg bg-[#B48B40] text-black px-3 py-1.5 text-xs font-semibold transition-all flex items-center gap-1",
                  "hover:bg-[#c99840] disabled:opacity-50",
                )}
              >
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}
              </button>
              <button
                onClick={() => { setLogOpen(false); setWeightInput(""); setError(null); }}
                className="text-xs text-white/40 hover:text-white/65"
              >
                Cancel
              </button>
            </div>
            {error && <p className="text-[11px] text-red-300/80">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string | null }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-2 text-center">
      <p className="text-[10px] font-medium text-white/30">{label}</p>
      <p className="text-sm font-semibold tabular-nums text-white/80 mt-0.5 truncate">{value}</p>
      {sub && <p className="text-[9px] text-white/35 mt-0.5 truncate">{sub}</p>}
    </div>
  );
}

function formatDelta(n: number): string {
  if (n === 0) return "0";
  const rounded = Math.round(n * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded}`;
}

function formatDisplayWeight(kg: number, sys: UnitSystem): string {
  const v = sys === "imperial" ? kgToDisplayUnit(kg, "imperial") : kg;
  return `${Math.round(v * 10) / 10} ${weightUnitLabel(sys)}`;
}
