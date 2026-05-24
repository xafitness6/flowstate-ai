"use client";

import { useState } from "react";
import { Sparkles, Loader2, Check, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { FIELDS, type FieldDef } from "@/lib/intake/prefillSchema";

const FIELD_BY_KEY = new Map(FIELDS.map((f) => [f.key, f]));

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
  const [notes, setNotes] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ReviewRow[] | null>(null);

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
          built.push({
            def,
            value: Array.isArray(val) ? val.join(", ") : String(val),
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
          <p className="text-[11px] text-white/45">Review what the AI pulled out. Edit anything, untick to skip. Amber = it wasn&apos;t sure.</p>
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
                    <span className="text-[10px] uppercase tracking-[0.12em] text-white/35">{r.def.label}</span>
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
