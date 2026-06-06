"use client";

// Trainer-side nutrition management for a single client, shown on the client
// file's Nutrition tab. Two tools:
//   1. Targets editor — set the client's calories/macros/water (DB-backed; the
//      edit lands on the client's own app).
//   2. AI meal-plan generator — a prompt and/or photos of what the client has
//      been eating → a structured plan whose daily totals become the client's
//      targets. Optionally anchor the plan to the current targets.

import { useState, useEffect, useCallback, useRef } from "react";
import { Apple, Loader2, Sparkles, Pencil, Check, X, Trash2, ImagePlus, Utensils } from "lucide-react";
import { cn } from "@/lib/utils";

type ComputedTargets = { calories: number; proteinG: number; carbsG: number; fatG: number; waterMl: number } | null;
type Override = { calories?: number; proteinG?: number; carbsG?: number; fatG?: number; waterMl?: number } | null;

type PlanItem = { food: string; qty: string; calories: number; protein: number; carbs: number; fat: number };
type PlanMeal = { name: string; time: string; note: string; items: PlanItem[]; calories: number; protein: number; carbs: number; fat: number };
type MealPlan = {
  id: string; title: string; summary: string | null; created_by_name: string | null; created_at: string;
  plan: { meals: PlanMeal[]; totals: { calories: number; protein: number; carbs: number; fat: number } };
};

const FIELDS = [
  { key: "calories", label: "Calories", unit: "kcal" },
  { key: "proteinG", label: "Protein", unit: "g" },
  { key: "carbsG", label: "Carbs", unit: "g" },
  { key: "fatG", label: "Fat", unit: "g" },
  { key: "waterMl", label: "Water", unit: "ml" },
] as const;

const overrideToCamel = {
  calories: "calories", proteinG: "proteinG", carbsG: "carbsG", fatG: "fatG", waterMl: "waterMl",
} as const;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ClientNutritionManager({
  clientId, computedTargets, clientName,
}: {
  clientId: string; computedTargets: ComputedTargets; clientName: string;
}) {
  const [override, setOverride] = useState<Override>(null);
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Effective values shown in the editor: override wins over the calculated value.
  const eff = (k: keyof NonNullable<ComputedTargets>) =>
    (override?.[k as keyof NonNullable<Override>] ?? computedTargets?.[k] ?? "") as number | "";

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [savingTargets, setSavingTargets] = useState(false);

  const [prompt, setPrompt] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [anchor, setAnchor] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const [tRes, pRes] = await Promise.all([
        fetch(`/api/clients/${clientId}/nutrition-targets`, { cache: "no-store" }).then((r) => r.json()),
        fetch(`/api/clients/${clientId}/meal-plan`, { cache: "no-store" }).then((r) => r.json()),
      ]);
      setOverride(tRes?.targets ?? null);
      setPlan(pRes?.plan ?? null);
    } catch { /* resilient */ } finally {
      setLoaded(true);
    }
  }, [clientId]);

  useEffect(() => { void refresh(); }, [refresh]);

  function startEdit() {
    const d: Record<string, string> = {};
    FIELDS.forEach((f) => { const v = eff(f.key); d[f.key] = v === "" ? "" : String(v); });
    setDraft(d);
    setEditing(true);
  }

  async function saveTargets() {
    if (savingTargets) return;
    setSavingTargets(true); setErr(null);
    try {
      const body: Record<string, number> = {};
      FIELDS.forEach((f) => {
        const n = Number(draft[f.key]);
        if (Number.isFinite(n) && n > 0) body[overrideToCamel[f.key]] = Math.round(n);
      });
      const res = await fetch(`/api/clients/${clientId}/nutrition-targets`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Couldn't save targets.");
      setOverride(j.targets ?? null);
      setEditing(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't save targets.");
    } finally {
      setSavingTargets(false);
    }
  }

  async function onPickImages(files: FileList | null) {
    if (!files) return;
    const urls = await Promise.all(Array.from(files).slice(0, 6).map(fileToDataUrl));
    setImages((prev) => [...prev, ...urls].slice(0, 6));
  }

  async function generate() {
    if (generating) return;
    if (!prompt.trim() && images.length === 0) { setErr("Add a prompt or at least one meal photo."); return; }
    setGenerating(true); setErr(null);
    try {
      const targets = anchor && computedTargets
        ? { calories: override?.calories ?? computedTargets.calories, protein: override?.proteinG ?? computedTargets.proteinG, carbs: override?.carbsG ?? computedTargets.carbsG, fat: override?.fatG ?? computedTargets.fatG }
        : undefined;
      const res = await fetch(`/api/clients/${clientId}/meal-plan`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), images, targets }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Couldn't generate the plan.");
      setPlan(j.plan ?? null);
      setPrompt(""); setImages([]);
      await refresh(); // pull the targets the plan just set
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't generate the plan.");
    } finally {
      setGenerating(false);
    }
  }

  async function deletePlan() {
    if (!plan) return;
    if (!confirm("Archive this meal plan?")) return;
    const prev = plan;
    setPlan(null);
    const res = await fetch(`/api/clients/${clientId}/meal-plan?planId=${encodeURIComponent(prev.id)}`, { method: "DELETE" });
    if (!res.ok) setPlan(prev);
  }

  const isCustom = override != null && Object.keys(override).length > 0;

  return (
    <div className="mt-5 space-y-4">
      {/* ── Targets editor ── */}
      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <p className="text-sm font-semibold text-white/85 flex items-center gap-2">
              <Apple className="w-4 h-4 text-[#B48B40]" strokeWidth={1.8} /> Daily targets
            </p>
            <p className="text-[11px] text-white/35 mt-0.5">
              {isCustom ? "Custom — synced to their app" : "Calculated from their intake"}
            </p>
          </div>
          {!editing && (
            <button onClick={startEdit} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:text-white/90 hover:border-white/20 transition-all">
              <Pencil className="w-3.5 h-3.5" strokeWidth={1.8} /> Edit
            </button>
          )}
        </div>

        {editing ? (
          <div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {FIELDS.map((f) => (
                <label key={f.key} className="block">
                  <span className="text-[10px] uppercase tracking-wider text-white/35">{f.label}</span>
                  <input
                    type="number" min="0" inputMode="numeric"
                    value={draft[f.key] ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                    className="mt-1 w-full bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white/85 outline-none focus:border-[#B48B40]/50"
                  />
                </label>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2 mt-3">
              <button onClick={() => setEditing(false)} className="inline-flex items-center gap-1 text-[11px] text-white/45 hover:text-white/70 border border-white/10 rounded-lg px-2.5 py-1">
                <X className="w-3 h-3" strokeWidth={2} /> Cancel
              </button>
              <button onClick={saveTargets} disabled={savingTargets} className="inline-flex items-center gap-1 text-[11px] font-semibold text-black bg-[#B48B40] hover:bg-[#c99840] disabled:opacity-50 rounded-lg px-2.5 py-1">
                {savingTargets ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" strokeWidth={2.5} />} Save
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {FIELDS.map((f) => (
              <div key={f.key} className="rounded-xl border border-white/[0.06] bg-black/15 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wider text-white/30">{f.label}</p>
                <p className="text-sm font-semibold text-white/90">
                  {eff(f.key) === "" ? "—" : eff(f.key)}<span className="text-white/35 font-normal text-[11px]"> {f.unit}</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── AI meal-plan generator ── */}
      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
        <p className="text-sm font-semibold text-white/85 flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-[#B48B40]" strokeWidth={1.8} /> Generate a meal plan
        </p>
        <p className="text-[11px] text-white/35 mb-3">
          Describe what you want, and/or add photos of what {clientName} has been eating. The plan&apos;s daily totals become their targets.
        </p>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder="e.g. High-protein cutting plan, 4 meals, dairy-free, ~1900 kcal. Build around the photos of her current meals."
          className="w-full resize-y bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-white/85 placeholder:text-white/25 outline-none focus:border-[#B48B40]/50"
        />

        {images.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {images.map((url, i) => (
              <div key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="w-16 h-16 object-cover rounded-lg border border-white/10" />
                <button onClick={() => setImages((p) => p.filter((_, j) => j !== i))}
                  className="absolute -top-1.5 -right-1.5 bg-black/80 rounded-full p-0.5 text-white/70 hover:text-red-300">
                  <X className="w-3 h-3" strokeWidth={2.5} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 mt-3 flex-wrap">
          <div className="flex items-center gap-3">
            <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:text-white/90 hover:border-white/20 transition-all">
              <ImagePlus className="w-3.5 h-3.5" strokeWidth={1.8} /> Add meal photos
            </button>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { void onPickImages(e.target.files); e.target.value = ""; }} />
            <label className="flex items-center gap-1.5 text-[11px] text-white/50 cursor-pointer select-none">
              <input type="checkbox" checked={anchor} onChange={(e) => setAnchor(e.target.checked)} className="accent-[#B48B40]" />
              Anchor to current targets
            </label>
          </div>
          <button onClick={generate} disabled={generating} className="inline-flex items-center gap-1.5 rounded-xl bg-[#B48B40] text-black px-3.5 py-2 text-xs font-semibold hover:bg-[#c99840] disabled:opacity-50 transition-all">
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" strokeWidth={2} />}
            {generating ? "Generating…" : "Generate"}
          </button>
        </div>

        {err && <p className="mt-2 text-xs text-red-300/80">{err}</p>}
      </section>

      {/* ── Active plan ── */}
      {loaded && plan && (
        <section className="rounded-2xl border border-[#B48B40]/20 bg-[#B48B40]/[0.04] p-4">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white/90 flex items-center gap-2">
                <Utensils className="w-4 h-4 text-[#B48B40]" strokeWidth={1.8} /> {plan.title}
              </p>
              {plan.summary && <p className="text-[11px] text-white/45 mt-0.5 leading-relaxed">{plan.summary}</p>}
            </div>
            <button onClick={deletePlan} className="text-white/25 hover:text-red-300/80 transition-colors shrink-0" aria-label="Archive plan">
              <Trash2 className="w-3.5 h-3.5" strokeWidth={1.7} />
            </button>
          </div>

          <div className="flex flex-wrap gap-2 mb-3 text-[11px]">
            {(["calories", "protein", "carbs", "fat"] as const).map((k) => (
              <span key={k} className="rounded-lg bg-black/20 border border-white/[0.06] px-2 py-1 text-white/70">
                <span className="font-semibold text-white/90">{plan.plan.totals?.[k] ?? 0}</span>
                {k === "calories" ? " kcal" : `g ${k}`}
              </span>
            ))}
          </div>

          <div className="space-y-2">
            {plan.plan.meals?.map((m, i) => (
              <div key={i} className="rounded-xl border border-white/[0.06] bg-black/15 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white/85">{m.name} <span className="text-[11px] font-normal text-white/35">{m.time}</span></p>
                  <p className="text-[11px] text-white/55">{m.calories} kcal · {m.protein}p / {m.carbs}c / {m.fat}f</p>
                </div>
                <ul className="mt-1.5 space-y-0.5">
                  {m.items?.map((it, j) => (
                    <li key={j} className="text-[12px] text-white/60 flex items-center justify-between gap-2">
                      <span className="truncate">{it.qty} {it.food}</span>
                      <span className="text-white/35 shrink-0">{it.calories} kcal</span>
                    </li>
                  ))}
                </ul>
                {m.note && <p className="text-[11px] text-[#B48B40]/70 mt-1">{m.note}</p>}
              </div>
            ))}
          </div>

          {plan.created_by_name && (
            <p className="text-[10px] text-white/25 mt-3">Created by {plan.created_by_name}</p>
          )}
        </section>
      )}
    </div>
  );
}
