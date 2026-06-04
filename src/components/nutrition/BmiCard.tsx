"use client";

import { useState } from "react";
import { Scale, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type UnitSystem, weightUnitLabel, heightUnitLabel,
  kgToDisplayUnit, displayUnitToKg, formatHeightDisplay, parseHeightToCm,
} from "@/lib/units";

// ─── BMI bands ────────────────────────────────────────────────────────────────

function bmiCategory(bmi: number): { label: string; color: string; note: string } {
  if (bmi < 18.5)  return { label: "Underweight", color: "text-[#93C5FD]",   note: "Below the healthy range — fuelling up and building muscle is the move." };
  if (bmi < 25)    return { label: "Healthy",     color: "text-emerald-400", note: "Squarely in the healthy range. Keep training and eating with intent." };
  if (bmi < 30)    return { label: "Overweight",  color: "text-[#FBBF24]",   note: "Slightly above the healthy range — but BMI can't see muscle (see below)." };
  return { label: "Obese", color: "text-[#EF4444]/80", note: "Above the healthy range. A steady, sustainable deficit is the play." };
}

// Marker position (0-100%) across a 15–35 BMI scale for the little gauge.
function markerPct(bmi: number): number {
  return Math.max(0, Math.min(100, ((bmi - 15) / (35 - 15)) * 100));
}

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * Interactive BMI calculator + teaching moment. Prefills from the athlete's
 * stats when known; honors their unit preference; explains what BMI does and
 * doesn't capture (it ignores muscle mass).
 */
export function BmiCard({
  initialWeightKg,
  initialHeightCm,
  unitSystem,
}: {
  initialWeightKg: number | null;
  initialHeightCm: number | null;
  unitSystem: UnitSystem;
}) {
  const [weight, setWeight] = useState(
    initialWeightKg != null ? String(Math.round(kgToDisplayUnit(initialWeightKg, unitSystem) * 10) / 10) : "",
  );
  const [height, setHeight] = useState(
    initialHeightCm != null ? formatHeightDisplay(initialHeightCm, unitSystem) : "",
  );

  const weightKg = weight.trim() ? displayUnitToKg(parseFloat(weight) || 0, unitSystem) : 0;
  const heightCm = parseHeightToCm(height, unitSystem) ?? 0;
  const bmi = weightKg > 0 && heightCm > 0
    ? weightKg / Math.pow(heightCm / 100, 2)
    : null;
  const cat = bmi != null ? bmiCategory(bmi) : null;

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#111111] px-5 py-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.22em] text-white/28">Body Mass Index</p>
        <Scale className="w-3.5 h-3.5 text-white/25" strokeWidth={1.5} />
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] uppercase tracking-[0.12em] text-white/30 mb-1 block">
            Height ({heightUnitLabel(unitSystem)})
          </label>
          <input
            type="text" inputMode="decimal"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            placeholder={unitSystem === "imperial" ? `5'10"` : "178"}
            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/85 placeholder:text-white/20 outline-none focus:border-[#B48B40]/40 transition-colors"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-[0.12em] text-white/30 mb-1 block">
            Weight ({weightUnitLabel(unitSystem)})
          </label>
          <input
            type="number" inputMode="decimal" min="0"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder={unitSystem === "imperial" ? "180" : "82"}
            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/85 placeholder:text-white/20 outline-none focus:border-[#B48B40]/40 transition-colors"
          />
        </div>
      </div>

      {/* Result */}
      {bmi != null && cat ? (
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-[1.6rem] font-semibold tabular-nums leading-none text-white/90">{bmi.toFixed(1)}</span>
            <span className={cn("text-sm font-semibold", cat.color)}>{cat.label}</span>
          </div>

          {/* Gauge */}
          <div className="relative mt-3 h-1.5 rounded-full overflow-hidden bg-gradient-to-r from-[#93C5FD]/40 via-emerald-400/40 via-[55%] to-[#EF4444]/50">
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-white border border-black/30 shadow"
              style={{ left: `${markerPct(bmi)}%` }}
            />
          </div>
          <div className="flex justify-between text-[9px] text-white/25 mt-1 tabular-nums">
            <span>15</span><span>18.5</span><span>25</span><span>30</span><span>35</span>
          </div>

          <p className="text-xs text-white/45 leading-relaxed mt-3">{cat.note}</p>
        </div>
      ) : (
        <p className="text-xs text-white/30 py-2">Enter your height and weight to see your BMI.</p>
      )}

      {/* Teaching note */}
      <div className="flex items-start gap-1.5 pt-1 border-t border-white/[0.05]">
        <Info className="w-3 h-3 text-white/20 shrink-0 mt-0.5" strokeWidth={1.5} />
        <p className="text-[10px] text-white/30 leading-relaxed">
          BMI is a quick screen using only height and weight — it can&apos;t tell muscle from fat, so a
          lean, muscular athlete can read &ldquo;overweight.&rdquo; Use it as a rough guide, not a verdict;
          your body-fat % and how you look/perform matter more.
        </p>
      </div>
    </div>
  );
}
