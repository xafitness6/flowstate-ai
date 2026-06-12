"use client";

import { useState, useEffect } from "react";
import { Sparkles, Loader2, Check, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { FIELDS, type FieldDef } from "@/lib/intake/prefillSchema";
import { useUser } from "@/context/UserContext";
import {
  readStoredUnitSystem, weightUnitLabel, heightUnitLabel,
  kgToDisplayUnit, displayUnitToKg, formatHeightDisplay, parseHeightToCm,
  type UnitSystem,
} from "@/lib/units";

const FIELD_BY_KEY = new Map(FIELDS.map((f) => [f.key, f]));

// Fields stored canonically (cm/kg) but shown in the trainer's preferred units.
const WEIGHT_KEYS = new Set(["weightKg", "goalWeightKg"]);
const HEIGHT_KEYS = new Set(["heightCm"]);
const isUnitAware = (key: string) => WEIGHT_KEYS.has(key) || HEIGHT_KEYS.has(key);

/** Canonical (cm/kg) → display string in the chosen system. */
function canonicalToDisplay(key: string, canonical: string, sys: UnitSystem): string {
  const n = parseFloat(canonical);
  if (!Number.isFinite(n)) return canonical;
  if (HEIGHT_KEYS.has(key)) return formatHeightDisplay(n, sys);
  return String(Math.round(kgToDisplayUnit(n, sys) * 10) / 10);
}

/** Display string → canonical (cm/kg) number for saving. */
function displayToCanonical(key: string, display: string, sys: UnitSystem): number | null {
  if (HEIGHT_KEYS.has(key)) return parseHeightToCm(display, sys);
  const n = parseFloat(display);
  if (!Number.isFinite(n)) return null;
  return Math.round(displayUnitToKg(n, sys) * 10) / 10;
}

/** Dynamic label so "(cm)/(kg)" follows the chosen unit system. */
function rowLabel(def: FieldDef, sys: UnitSystem): string {
  if (HEIGHT_KEYS.has(def.key)) return def.label.replace(/\(cm\)/i, `(${heightUnitLabel(sys)})`);
  if (WEIGHT_KEYS.has(def.key)) return def.label.replace(/\(kg\)/i, `(${weightUnitLabel(sys)})`);
  return def.label;
}

type ExtractResponse = {
  extracted: { basic: Record<string, unknown>; deep: Record<string, unknown> };
  uncertain: string[];
};

// A flat editable row the trainer reviews before saving.
type ReviewRow = {
  def: FieldDef;
  value: string;       // edited as text (arrays comma-joined)
  include: boolean;
  uncertain: boolean;
};

export function PrefillPanel({ clientId, onSaved }: { clientId: string; onSaved: () => void }) {
  const { user } = useUser();
  const [notes, setNotes] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ReviewRow[] | null>(null);
  const [system, setSystem] = useState<UnitSystem>("metric");

  // Honor the trainer's units preference (kg vs lbs / cm vs ft·in)
  useEffect(() => {
    const s = readStoredUnitSystem(user.id);
    if (s) setSystem(s);
  }, [user.id]);

  // Toggle units — re-convert any unit-aware rows already on screen.
  function changeSystem(next: UnitSystem) {
    setRows((rs) => rs?.map((r) => {
      if (!isUnitAware(r.def.key)) return r;
      const canon = displayToCanonical(r.def.key, r.value, system);
      return { ...r, value: canon != null ? canonicalToDisplay(r.def.key, String(canon), next) : r.value };
    }) ?? rs);
    setSystem(next);
  }

  async function extract() {
    if (!notes.trim() || extracting) return;
    setExtracting(true); setError(null); setRows(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/prefill-intake`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      const json = await res.json() as ExtractResponse & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Extraction failed.");

      const uncertain = new Set(json.uncertain ?? []);
      const built: ReviewRow[] = [];
      for (const [loc, map] of [["basic", json.extracted.basic], ["deep", json.extracted.deep]] as const) {
        for (const [key, val] of Object.entries(map)) {
          const def = FIELD_BY_KEY.get(key);
          if (!def || def.loc !== loc) continue;
          const rawValue = Array.isArray(val) ? val.join(", ") : String(val);
          built.push({
            def,
            // Show height/weight in the trainer's preferred units (stored as cm/kg).
            value: isUnitAware(key) ? canonicalToDisplay(key, rawValue, system) : rawValue,
            include: !uncertain.has(key),
            uncertain: uncertain.has(key),
          });
        }
      }
      if (built.length === 0) { setError("Nothing could be extracted — try adding more detail."); return; }
      setRows(built);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Extraction failed.");
    } finally {
      setExtracting(false);
    }
  }

  async function save() {
    if (!rows || saving) return;
    setSaving(true); setError(null);
    try {
      const basic: Record<string, unknown> = {};
      const deep: Record<string, unknown> = {};
      for (const r of rows) {
        if (!r.include || !r.value.trim()) continue;
        const target = r.def.loc === "deep" ? deep : basic;
        // Unit-aware fields convert display (lbs/ft·in) back to canonical cm/kg.
        if (isUnitAware(r.def.key)) {
          const canon = displayToCanonical(r.def.key, r.value, system);
          if (canon != null) target[r.def.key] = canon;
          continue;
        }
        target[r.def.key] = reconstruct(r.def, r.value);
      }
      const res = await fetch(`/api/clients/${clientId}/intake`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ basic, deep }),
      });
      const json = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Save failed.");
      setRows(null); setNotes("");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[#B48B40]/20 bg-[#B48B40]/[0.04] p-4">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-4 h-4 text-[#B48B40]" strokeWidth={1.8} />
        <h3 className="text-sm font-semibold text-white/85">Pre-fill onboarding from your notes</h3>
      </div>
      <p className="text-[11px] text-white/40 mb-3 leading-relaxed">
        Paste what you already know about this client. The AI maps it to their onboarding answers — you review and
        confirm before anything saves. They won&apos;t have to re-answer what you provide.
      </p>

      {!rows && (
        <>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="e.g. Jane, 34. Wants to lose ~15 lb in 3 months. Bad lower back — no heavy deadlifts. Trains 4x/week at a full gym. Vegetarian, 3 meals, sleeps ~6 hrs, stressed. Intermediate, ~3 yrs lifting."
            className="w-full bg-white/[0.03] border border-white/8 rounded-xl px-3 py-2.5 text-sm text-white/90 placeholder:text-white/25 outline-none focus:border-[#B48B40]/40 transition-colors resize-y leading-relaxed"
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={extract}
              disabled={!notes.trim() || extracting}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#B48B40] text-black px-3.5 py-2 text-xs font-semibold hover:bg-[#c99840] disabled:opacity-50 transition-all"
            >
              {extracting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" strokeWidth={2} />}
              {extracting ? "Reading…" : "Extract with AI"}
            </button>
          </div>
        </>
      )}

      {rows && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-white/45">Review what the AI pulled out. Edit anything, untick to skip. Amber = it wasn&apos;t sure.</p>
            <div className="flex rounded-lg border border-white/10 overflow-hidden shrink-0">
              {(["metric", "imperial"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => changeSystem(s)}
                  className={cn(
                    "px-2.5 py-1 text-[11px] font-semibold transition-colors",
                    system === s ? "bg-[#B48B40]/15 text-[#B48B40]" : "text-white/35 hover:text-white/60",
                  )}
                >
                  {s === "metric" ? "kg / cm" : "lbs / ft"}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
            {rows.map((r, i) => (
              <div key={r.def.key} className={cn(
                "flex items-center gap-2 rounded-xl border px-3 py-2",
                r.uncertain ? "border-amber-400/25 bg-amber-400/[0.04]" : "border-white/[0.06] bg-white/[0.02]",
              )}>
                <input
                  type="checkbox"
                  checked={r.include}
                  onChange={(e) => setRows((rs) => rs!.map((x, j) => j === i ? { ...x, include: e.target.checked } : x))}
                  className="accent-[#B48B40] shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-white/35">{rowLabel(r.def, system)}</span>
                    {r.uncertain && <AlertTriangle className="w-3 h-3 text-amber-400/70" strokeWidth={2} />}
                  </div>
                  <input
                    value={r.value}
                    onChange={(e) => setRows((rs) => rs!.map((x, j) => j === i ? { ...x, value: e.target.value } : x))}
                    className="w-full bg-transparent text-sm text-white/90 outline-none mt-0.5"
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between pt-1">
            <button onClick={() => { setRows(null); }} className="text-xs text-white/40 hover:text-white/70">Start over</button>
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#B48B40] text-black px-3.5 py-2 text-xs font-semibold hover:bg-[#c99840] disabled:opacity-50 transition-all"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" strokeWidth={2.5} />}
              Save to client&apos;s profile
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-400/70 mt-2">{error}</p>}
    </div>
  );
}

function reconstruct(def: FieldDef, value: string): unknown {
  switch (def.kind) {
    case "number": { const n = parseFloat(value); return Number.isFinite(n) ? n : value; }
    case "multi":  return value.split(",").map((s) => s.trim()).filter(Boolean);
    default:       return value.trim();
  }
}
