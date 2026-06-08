"use client";

import { useState } from "react";
import { X, RotateCcw, Check, Sparkles, Loader2, Percent, Scale } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NutritionTargets } from "@/lib/nutrition";
import type { TargetsOverride } from "@/lib/nutrition/targetsOverride";

// Macro energy density (kcal/g)
const KCAL = { protein: 4, carbs: 4, fat: 9 } as const;

function macroCalories(p: number, c: number, f: number): number {
  return Math.round(p * KCAL.protein + c * KCAL.carbs + f * KCAL.fat);
}
const round5 = (n: number) => Math.round(n / 5) * 5;

/**
 * Edit your own calorie / macro / water targets — three ways:
 *  • % split: set calories, then the protein/carb/fat percentages → grams auto-fill
 *  • Grams: type grams directly → percentages shown live
 *  • AI / Calculated: let AI build the split from your info, or use the stats-based one
 * The three macro percentages are always visible so the split stays honest.
 */
export function TargetsEditModal({
  computed,
  current,
  isCustom,
  onSave,
  onReset,
  onClose,
}: {
  computed: NutritionTargets;   // calculated-from-stats targets (the "prior" baseline)
  current:  NutritionTargets;   // currently-effective targets (computed + any override)
  isCustom: boolean;
  onSave:   (o: TargetsOverride) => void;
  onReset:  () => void;
  onClose:  () => void;
}) {
  const [editBy,   setEditBy]   = useState<"percent" | "grams">("percent");
  const [calories, setCalories] = useState(String(current.calories));
  const [protein,  setProtein]  = useState(String(current.proteinG));
  const [carbs,    setCarbs]    = useState(String(current.carbsG));
  const [fat,      setFat]      = useState(String(current.fatG));
  const [water,    setWater]    = useState(String(current.waterMl));

  // Percent inputs (only the source of truth in % mode)
  const n = (s: string) => { const v = parseFloat(s); return Number.isFinite(v) && v >= 0 ? v : 0; };
  const calNum = n(calories);
  const pctFromGrams = (g: number, kcalPerG: number) => (calNum > 0 ? Math.round((g * kcalPerG / calNum) * 100) : 0);

  const [pP, setPP] = useState(String(pctFromGrams(current.proteinG, KCAL.protein)));
  const [pC, setPC] = useState(String(pctFromGrams(current.carbsG,   KCAL.carbs)));
  const [pF, setPF] = useState(String(pctFromGrams(current.fatG,     KCAL.fat)));

  const [aiBusy,      setAiBusy]      = useState(false);
  const [aiRationale, setAiRationale] = useState<string | null>(null);
  const [aiError,     setAiError]     = useState<string | null>(null);

  // Effective grams depend on the edit mode:
  //  • grams mode → the typed gram values
  //  • percent mode → derived from the calorie target + the percentages
  const gramsFromPct = (pct: number, kcalPerG: number) => (calNum > 0 ? round5((pct / 100) * calNum / kcalPerG) : 0);
  const eff = editBy === "percent"
    ? { p: gramsFromPct(n(pP), KCAL.protein), c: gramsFromPct(n(pC), KCAL.carbs), f: gramsFromPct(n(pF), KCAL.fat) }
    : { p: n(protein), c: n(carbs), f: n(fat) };

  const fromMacros = macroCalories(eff.p, eff.c, eff.f);
  const mismatch   = Math.abs(fromMacros - calNum) > 50;
  const pctTotal   = n(pP) + n(pC) + n(pF);
  const pctOff     = editBy === "percent" && Math.abs(pctTotal - 100) > 1;

  // Push a full target set into both representations (used by AI + Calculated).
  function applyTargets(t: { calories: number; proteinG: number; carbsG: number; fatG: number; waterMl?: number }) {
    const cal = Math.round(t.calories) || calNum;
    setCalories(String(cal));
    setProtein(String(t.proteinG)); setCarbs(String(t.carbsG)); setFat(String(t.fatG));
    if (t.waterMl != null) setWater(String(t.waterMl));
    const pct = (g: number, k: number) => (cal > 0 ? String(Math.round((g * k / cal) * 100)) : "0");
    setPP(pct(t.proteinG, KCAL.protein)); setPC(pct(t.carbsG, KCAL.carbs)); setPF(pct(t.fatG, KCAL.fat));
  }

  function useCalculated() {
    setAiRationale(null); setAiError(null);
    applyTargets(computed);
  }

  async function suggestWithAI() {
    setAiBusy(true); setAiError(null); setAiRationale(null);
    try {
      const res = await fetch("/api/me/macro-suggest", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calories: calNum || computed.calories }),
      });
      if (!res.ok) throw new Error("AI unavailable");
      const d = await res.json() as { calories: number; proteinG: number; carbsG: number; fatG: number; rationale?: string };
      applyTargets({ calories: d.calories, proteinG: d.proteinG, carbsG: d.carbsG, fatG: d.fatG });
      setAiRationale(d.rationale || "Built from your goal, body stats and approach.");
    } catch {
      setAiError("Couldn't reach the AI — set it by hand or use the calculated split.");
    } finally {
      setAiBusy(false);
    }
  }

  function handleSave() {
    onSave({
      calories: calNum,
      proteinG: eff.p,
      carbsG:   eff.c,
      fatG:     eff.f,
      waterMl:  n(water),
    });
  }

  const macroRows = [
    { key: "protein", label: "Protein", color: "text-[#B48B40]",     pct: pP, setPct: setPP, g: protein, setG: setProtein, kcal: KCAL.protein, effG: eff.p },
    { key: "carbs",   label: "Carbs",   color: "text-[#93C5FD]",     pct: pC, setPct: setPC, g: carbs,   setG: setCarbs,   kcal: KCAL.carbs,   effG: eff.c },
    { key: "fat",     label: "Fat",     color: "text-emerald-400/90", pct: pF, setPct: setPF, g: fat,     setG: setFat,     kcal: KCAL.fat,     effG: eff.f },
  ];

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full sm:max-w-sm bg-[#0D0D0D] border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[92dvh]">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-white/[0.06] shrink-0 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white/80 tracking-tight">Calories &amp; macros</h2>
            <p className="text-[11px] text-white/30 mt-0.5">Set the split by %, by grams, or let AI build it.</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg border border-white/8 bg-white/[0.03] flex items-center justify-center text-white/30 hover:text-white/65 transition-colors">
            <X className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4" style={{ scrollbarWidth: "none" }}>
          {/* Source buttons: AI / Calculated */}
          <div className="flex gap-2">
            <button
              onClick={suggestWithAI}
              disabled={aiBusy}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#B48B40]/30 bg-[#B48B40]/[0.07] px-3 py-2.5 text-xs font-semibold text-[#B48B40] hover:bg-[#B48B40]/14 disabled:opacity-50 transition-all"
            >
              {aiBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.8} /> : <Sparkles className="w-3.5 h-3.5" strokeWidth={1.8} />}
              {aiBusy ? "Thinking…" : "AI suggest"}
            </button>
            <button
              onClick={useCalculated}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-xs font-semibold text-white/55 hover:text-white/80 hover:border-white/18 transition-all"
              title={`From your stats: ${computed.calories.toLocaleString()} kcal`}
            >
              <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.8} /> Use calculated
            </button>
          </div>
          {aiRationale && (
            <div className="flex items-start gap-2 rounded-xl border border-[#B48B40]/20 bg-[#B48B40]/[0.05] px-3 py-2">
              <Sparkles className="w-3.5 h-3.5 text-[#B48B40] shrink-0 mt-0.5" strokeWidth={1.8} />
              <p className="text-[11px] text-white/65 leading-relaxed">{aiRationale}</p>
            </div>
          )}
          {aiError && <p className="text-[11px] text-[#EF4444]/70">{aiError}</p>}

          {/* Calories */}
          <div className="flex items-center gap-3">
            <label className="text-xs text-white/45 w-20 shrink-0">Calories</label>
            <input
              type="number" inputMode="decimal" min="0"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              className="flex-1 bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#B48B40]/40 transition-colors tabular-nums text-right text-white/85"
            />
            <span className="text-[11px] text-white/30 w-8">kcal</span>
          </div>

          {/* Edit-by toggle */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.16em] text-white/25 mr-auto">Macro split — edit by</span>
            {([
              { v: "percent", label: "%", icon: Percent },
              { v: "grams",   label: "g", icon: Scale },
            ] as const).map(({ v, label, icon: Icon }) => (
              <button
                key={v}
                onClick={() => {
                  // Sync the other representation so the switch is seamless.
                  if (v === "grams") { setProtein(String(eff.p)); setCarbs(String(eff.c)); setFat(String(eff.f)); }
                  else { setPP(String(pctFromGrams(n(protein), KCAL.protein))); setPC(String(pctFromGrams(n(carbs), KCAL.carbs))); setPF(String(pctFromGrams(n(fat), KCAL.fat))); }
                  setEditBy(v);
                }}
                className={cn(
                  "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all",
                  editBy === v ? "border-[#B48B40]/40 bg-[#B48B40]/12 text-[#B48B40]" : "border-white/10 text-white/40 hover:text-white/70",
                )}
              >
                <Icon className="w-3 h-3" strokeWidth={2} /> {label}
              </button>
            ))}
          </div>

          {/* Macro rows — % and grams side by side */}
          <div className="space-y-2">
            {macroRows.map((r) => {
              const dispPct = editBy === "percent" ? r.pct : String(pctFromGrams(n(r.g), r.kcal));
              const dispG   = editBy === "grams" ? r.g : String(r.effG);
              return (
                <div key={r.key} className="flex items-center gap-2">
                  <label className={cn("text-xs w-16 shrink-0", r.color)}>{r.label}</label>
                  {/* % field */}
                  <div className="flex items-center gap-1 flex-1">
                    <input
                      type="number" inputMode="decimal" min="0" max="100"
                      value={dispPct}
                      readOnly={editBy !== "percent"}
                      onChange={(e) => r.setPct(e.target.value)}
                      className={cn(
                        "w-full bg-white/[0.04] border rounded-xl px-3 py-2.5 text-sm outline-none transition-colors tabular-nums text-right",
                        editBy === "percent" ? "border-white/10 focus:border-[#B48B40]/40 text-white/85" : "border-white/[0.05] text-white/40",
                      )}
                    />
                    <span className="text-[11px] text-white/30 w-4">%</span>
                  </div>
                  {/* grams field */}
                  <div className="flex items-center gap-1 flex-1">
                    <input
                      type="number" inputMode="decimal" min="0"
                      value={dispG}
                      readOnly={editBy !== "grams"}
                      onChange={(e) => r.setG(e.target.value)}
                      className={cn(
                        "w-full bg-white/[0.04] border rounded-xl px-3 py-2.5 text-sm outline-none transition-colors tabular-nums text-right",
                        editBy === "grams" ? "border-white/10 focus:border-[#B48B40]/40 text-white/85" : "border-white/[0.05] text-white/40",
                      )}
                    />
                    <span className="text-[11px] text-white/30 w-4">g</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Percentage total (when editing %) */}
          {editBy === "percent" && (
            <div className={cn(
              "rounded-xl border px-3 py-2 text-[11px] flex items-center justify-between",
              pctOff ? "border-amber-400/20 bg-amber-400/[0.05] text-amber-400/80" : "border-white/[0.06] bg-white/[0.02] text-white/40",
            )}>
              <span>Split totals <span className="font-semibold tabular-nums">{Math.round(pctTotal)}%</span></span>
              {pctOff && (
                <button
                  onClick={() => { // normalize to 100 keeping ratios
                    const t = pctTotal || 1;
                    setPP(String(Math.round(n(pP) / t * 100)));
                    setPC(String(Math.round(n(pC) / t * 100)));
                    setPF(String(Math.round(n(pF) / t * 100)));
                  }}
                  className="text-[#B48B40] hover:text-[#c99840] font-semibold underline-offset-2 hover:underline"
                >
                  Balance to 100%
                </button>
              )}
            </div>
          )}

          {/* Macro vs calorie sanity check */}
          <div className={cn(
            "rounded-xl border px-3 py-2.5 text-[11px] leading-relaxed",
            mismatch ? "border-amber-400/20 bg-amber-400/[0.05] text-amber-400/80" : "border-white/[0.06] bg-white/[0.02] text-white/40",
          )}>
            Macros total <span className="font-semibold tabular-nums">{fromMacros.toLocaleString()} kcal</span>
            {mismatch
              ? <> — off from your {calNum.toLocaleString()} kcal target.{editBy === "grams" && (
                  <> <button onClick={() => setCalories(String(fromMacros))} className="text-[#B48B40] hover:text-[#c99840] font-semibold underline-offset-2 hover:underline">Match calories</button></>
                )}</>
              : " — lines up with your calorie target."}
          </div>

          {/* Water */}
          <div className="flex items-center gap-3">
            <label className="text-xs text-white/45 w-20 shrink-0">Water</label>
            <input
              type="number" inputMode="decimal" min="0"
              value={water}
              onChange={(e) => setWater(e.target.value)}
              className="flex-1 bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#B48B40]/40 transition-colors tabular-nums text-right text-[#93C5FD]"
            />
            <span className="text-[11px] text-white/30 w-8">ml</span>
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
