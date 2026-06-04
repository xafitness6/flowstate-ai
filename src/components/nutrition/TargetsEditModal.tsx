"use client";

import { useState } from "react";
import { X, RotateCcw, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NutritionTargets } from "@/lib/nutrition";
import type { TargetsOverride } from "@/lib/nutrition/targetsOverride";

// Macro calories: P/C = 4 kcal/g, F = 9 kcal/g
function macroCalories(p: number, c: number, f: number): number {
  return Math.round(p * 4 + c * 4 + f * 9);
}

/**
 * Edit your own calorie / macro / water targets when the calculated ones are off.
 * Shows how the macros add up vs. the calorie target so it stays honest.
 */
export function TargetsEditModal({
  computed,
  current,
  isCustom,
  onSave,
  onReset,
  onClose,
}: {
  computed: NutritionTargets;   // calculated targets (for "reset")
  current:  NutritionTargets;   // currently-effective targets (computed + any override)
  isCustom: boolean;
  onSave:   (o: TargetsOverride) => void;
  onReset:  () => void;
  onClose:  () => void;
}) {
  const [calories, setCalories] = useState(String(current.calories));
  const [protein,  setProtein]  = useState(String(current.proteinG));
  const [carbs,    setCarbs]    = useState(String(current.carbsG));
  const [fat,      setFat]      = useState(String(current.fatG));
  const [water,    setWater]    = useState(String(current.waterMl));

  const n = (s: string) => { const v = parseFloat(s); return Number.isFinite(v) && v >= 0 ? v : 0; };
  const fromMacros = macroCalories(n(protein), n(carbs), n(fat));
  const calNum     = n(calories);
  const mismatch   = Math.abs(fromMacros - calNum) > 50;

  function handleSave() {
    onSave({ calories: n(calories), proteinG: n(protein), carbsG: n(carbs), fatG: n(fat), waterMl: n(water) });
  }

  // Set calories to whatever the macros add up to
  function syncCaloriesToMacros() { setCalories(String(fromMacros)); }

  const rows: { label: string; unit: string; value: string; set: (s: string) => void; color: string }[] = [
    { label: "Calories", unit: "kcal", value: calories, set: setCalories, color: "text-white/85"      },
    { label: "Protein",  unit: "g",    value: protein,  set: setProtein,  color: "text-[#B48B40]"     },
    { label: "Carbs",    unit: "g",    value: carbs,    set: setCarbs,    color: "text-[#93C5FD]"     },
    { label: "Fat",      unit: "g",    value: fat,      set: setFat,      color: "text-emerald-400/90" },
    { label: "Water",    unit: "ml",   value: water,    set: setWater,    color: "text-[#93C5FD]"     },
  ];

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full sm:max-w-sm bg-[#0D0D0D] border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90dvh]">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-white/[0.06] shrink-0 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white/80 tracking-tight">Adjust your targets</h2>
            <p className="text-[11px] text-white/30 mt-0.5">Set your own numbers when the calculated ones are off.</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg border border-white/8 bg-white/[0.03] flex items-center justify-center text-white/30 hover:text-white/65 transition-colors">
            <X className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3" style={{ scrollbarWidth: "none" }}>
          {rows.map((r) => (
            <div key={r.label} className="flex items-center gap-3">
              <label className="text-xs text-white/45 w-20 shrink-0">{r.label}</label>
              <input
                type="number" inputMode="decimal" min="0"
                value={r.value}
                onChange={(e) => r.set(e.target.value)}
                className={cn(
                  "flex-1 bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#B48B40]/40 transition-colors tabular-nums text-right",
                  r.color,
                )}
              />
              <span className="text-[11px] text-white/30 w-8">{r.unit}</span>
            </div>
          ))}

          {/* Macro vs calorie sanity check */}
          <div className={cn(
            "rounded-xl border px-3 py-2.5 text-[11px] leading-relaxed",
            mismatch ? "border-amber-400/20 bg-amber-400/[0.05] text-amber-400/80" : "border-white/[0.06] bg-white/[0.02] text-white/40",
          )}>
            Your macros add up to <span className="font-semibold tabular-nums">{fromMacros.toLocaleString()} kcal</span>.
            {mismatch ? (
              <> That's off from your calorie target ({calNum.toLocaleString()}).{" "}
                <button onClick={syncCaloriesToMacros} className="text-[#B48B40] hover:text-[#c99840] font-semibold underline-offset-2 hover:underline">
                  Match calories to macros
                </button>
              </>
            ) : " That lines up with your calorie target."}
          </div>

          <p className="text-[10px] text-white/25 leading-relaxed px-0.5">
            Calculated from your stats: {computed.calories.toLocaleString()} kcal · {computed.proteinG}P / {computed.carbsG}C / {computed.fatG}F.
          </p>
        </div>

        {/* Footer */}
        <div className="px-5 pt-3 border-t border-white/[0.05] shrink-0 flex gap-2.5" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}>
          {isCustom && (
            <button
              onClick={onReset}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-white/10 text-xs font-medium text-white/40 hover:text-white/65 hover:border-white/18 transition-all"
              title="Reset to calculated targets"
            >
              <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.5} /> Reset
            </button>
          )}
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-xl bg-[#B48B40]/15 border border-[#B48B40]/25 text-sm font-semibold text-[#B48B40] hover:bg-[#B48B40]/22 hover:border-[#B48B40]/35 transition-all inline-flex items-center justify-center gap-2"
          >
            <Check className="w-3.5 h-3.5" strokeWidth={2.5} /> Save targets
          </button>
        </div>
      </div>
    </div>
  );
}
