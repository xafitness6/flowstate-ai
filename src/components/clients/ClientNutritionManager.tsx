"use client";

// Trainer-side nutrition management for one client, on the client file's
// Nutrition tab. Streamlined: the active plan is what's shown and followed; the
// create/tweak controls live in a modal, not open on the page. Set it once,
// tweak when needed. Daily targets sit in a compact strip and stay in sync with
// the plan (and reach the client's own app).

import { useState, useEffect, useCallback, useRef } from "react";
import { Apple, Loader2, Sparkles, Pencil, Check, X, Trash2, ImagePlus, Utensils, Wand2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { dishKey } from "@/lib/nutrition/dishKey";

type ComputedTargets = { calories: number; proteinG: number; carbsG: number; fatG: number; waterMl: number } | null;
type Override = { calories?: number; proteinG?: number; carbsG?: number; fatG?: number; waterMl?: number } | null;

type PlanItem = { food: string; qty: string; calories: number; protein: number; carbs: number; fat: number };
type PlanMeal = { name: string; time: string; note: string; items: PlanItem[]; calories: number; protein: number; carbs: number; fat: number };
type PlanBody = { meals: PlanMeal[]; totals: { calories: number; protein: number; carbs: number; fat: number } };
type MealPlan = {
  id: string; title: string; summary: string | null; created_by_name: string | null; created_at: string;
  plan: PlanBody; allow_client_food_edits?: boolean;
};

const FIELDS = [
  { key: "calories", label: "Calories", unit: "kcal" },
  { key: "proteinG", label: "Protein", unit: "g" },
  { key: "carbsG", label: "Carbs", unit: "g" },
  { key: "fatG", label: "Fat", unit: "g" },
  { key: "waterMl", label: "Water", unit: "ml" },
] as const;

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
  const [mealImages, setMealImages] = useState<Record<string, string>>({});
  const [imagesLoading, setImagesLoading] = useState(false);

  const eff = (k: keyof NonNullable<ComputedTargets>) =>
    (override?.[k as keyof NonNullable<Override>] ?? computedTargets?.[k] ?? "") as number | "";

  // Targets editing (inline, compact)
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [savingTargets, setSavingTargets] = useState(false);

  // Composer modal
  const [composerOpen, setComposerOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "tweak">("create");
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

  const loadImages = useCallback(async () => {
    setImagesLoading(true);
    try {
      for (let i = 0; i < 12; i++) {
        const r = await fetch(`/api/clients/${clientId}/meal-plan/images`, { method: "POST" });
        const j = await r.json();
        if (j?.images) setMealImages((prev) => ({ ...prev, ...j.images }));
        if (!j?.remaining || j.remaining <= 0) break;
      }
    } catch { /* best-effort */ } finally {
      setImagesLoading(false);
    }
  }, [clientId]);

  useEffect(() => { if (plan?.id) void loadImages(); }, [plan?.id, loadImages]);

  function startEdit() {
    const d: Record<string, string> = {};
    FIELDS.forEach((f) => { const v = eff(f.key); d[f.key] = v === "" ? "" : String(v); });
    setDraft(d);
    setEditing(true);
  }

  async function saveTargets() {
    if (savingTargets) return;
    setSavingTargets(true);
    try {
      const body: Record<string, number> = {};
      FIELDS.forEach((f) => {
        const n = Number(draft[f.key]);
        if (Number.isFinite(n) && n > 0) body[f.key] = Math.round(n);
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

  function openComposer(m: "create" | "tweak") {
    setMode(m);
    setPrompt("");
    setImages([]);
    setAnchor(true);
    setErr(null);
    setComposerOpen(true);
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
        body: JSON.stringify({ prompt: prompt.trim(), images, targets, basePlan: mode === "tweak" ? plan?.plan : undefined }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Couldn't generate the plan.");
      setPlan(j.plan ?? null);
      setMealImages({});
      setComposerOpen(false);
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't generate the plan.");
    } finally {
      setGenerating(false);
    }
  }

  async function toggleClientEdits(next: boolean) {
    if (!plan) return;
    setPlan({ ...plan, allow_client_food_edits: next }); // optimistic
    const res = await fetch(`/api/clients/${clientId}/meal-plan`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allow_client_food_edits: next }),
    });
    if (!res.ok) setPlan((p) => (p ? { ...p, allow_client_food_edits: !next } : p)); // revert
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
  const totals = plan?.plan?.totals;

  return (
    <div className="mt-5 space-y-3">
      {/* ── Targets strip ── */}
      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
        <div className="flex items-center justify-between gap-3 mb-2.5">
          <p className="text-[11px] uppercase tracking-[0.14em] text-white/40 flex items-center gap-1.5">
            <Apple className="w-3.5 h-3.5 text-[#B48B40]" strokeWidth={1.8} /> Daily targets
            <span className="text-white/25 normal-case tracking-normal">· {isCustom ? "custom, synced to their app" : "from intake"}</span>
          </p>
          {!editing
            ? <button onClick={startEdit} className="text-white/35 hover:text-white/80 transition-colors" aria-label="Edit targets"><Pencil className="w-3.5 h-3.5" strokeWidth={1.8} /></button>
            : (
              <div className="flex items-center gap-1.5">
                <button onClick={() => setEditing(false)} className="inline-flex items-center gap-1 text-[11px] text-white/45 hover:text-white/70 rounded-lg px-2 py-1"><X className="w-3 h-3" strokeWidth={2} /></button>
                <button onClick={saveTargets} disabled={savingTargets} className="inline-flex items-center gap-1 text-[11px] font-semibold text-black bg-[#B48B40] hover:bg-[#c99840] disabled:opacity-50 rounded-lg px-2.5 py-1">
                  {savingTargets ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" strokeWidth={2.5} />} Save
                </button>
              </div>
            )}
        </div>
        <div className="grid grid-cols-5 gap-2">
          {FIELDS.map((f) => (
            <div key={f.key}>
              {editing ? (
                <input
                  type="number" min="0" inputMode="numeric"
                  value={draft[f.key] ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white/85 outline-none focus:border-[#B48B40]/50"
                />
              ) : (
                <p className="text-sm font-semibold text-white/90 tabular-nums">{eff(f.key) === "" ? "—" : eff(f.key)}</p>
              )}
              <p className="text-[10px] uppercase tracking-wider text-white/30 mt-0.5">{f.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Plan ── */}
      {!loaded ? (
        <div className="flex items-center justify-center py-8 text-white/30 text-xs"><Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading plan…</div>
      ) : !plan ? (
        <section className="rounded-2xl border border-dashed border-white/[0.1] bg-white/[0.02] px-5 py-8 text-center">
          <Utensils className="w-7 h-7 text-white/15 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm text-white/65 mb-1">No meal plan yet</p>
          <p className="text-xs text-white/30 mb-4">Generate a plan from a prompt and/or photos of what {clientName} eats.</p>
          <button onClick={() => openComposer("create")} className="inline-flex items-center gap-1.5 rounded-xl bg-[#B48B40] text-black px-4 py-2 text-xs font-semibold hover:bg-[#c99840] transition-all">
            <Sparkles className="w-3.5 h-3.5" strokeWidth={2} /> Create meal plan
          </button>
        </section>
      ) : (
        <section className="rounded-2xl border border-[#B48B40]/20 bg-[#B48B40]/[0.04] overflow-hidden">
          {/* Plan header */}
          <div className="px-4 pt-4 pb-3 border-b border-white/[0.06]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-white/90 flex items-center gap-2">
                  <Utensils className="w-4 h-4 text-[#B48B40]" strokeWidth={1.8} /> {plan.title}
                </p>
                {plan.summary && <p className="text-[12px] text-white/45 mt-1 leading-relaxed">{plan.summary}</p>}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => openComposer("tweak")} className="inline-flex items-center gap-1 rounded-lg border border-white/12 px-2.5 py-1.5 text-[11px] text-white/65 hover:text-white/95 hover:border-white/25 transition-all">
                  <Wand2 className="w-3.5 h-3.5" strokeWidth={1.8} /> Tweak
                </button>
                <button onClick={() => openComposer("create")} className="inline-flex items-center justify-center rounded-lg border border-white/12 w-7 h-7 text-white/55 hover:text-white/90 hover:border-white/25 transition-all" title="New plan">
                  <Plus className="w-3.5 h-3.5" strokeWidth={2} />
                </button>
                <button onClick={deletePlan} className="inline-flex items-center justify-center rounded-lg w-7 h-7 text-white/30 hover:text-red-300/80 transition-colors" aria-label="Archive plan">
                  <Trash2 className="w-3.5 h-3.5" strokeWidth={1.7} />
                </button>
              </div>
            </div>
            {totals && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {([["calories", "kcal"], ["protein", "P"], ["carbs", "C"], ["fat", "F"]] as const).map(([k, suffix]) => (
                  <span key={k} className="rounded-lg bg-black/25 border border-white/[0.06] px-2.5 py-1 text-[11px] text-white/65">
                    <span className="font-semibold text-white/90 tabular-nums">{totals[k] ?? 0}</span> {k === "calories" ? suffix : `${suffix}`}
                  </span>
                ))}
              </div>
            )}

            {/* Coach permission: let the client swap foods (never the calories/macros). */}
            <label className="mt-3 flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!!plan.allow_client_food_edits}
                onChange={(e) => toggleClientEdits(e.target.checked)}
                className="accent-[#B48B40] w-3.5 h-3.5"
              />
              <span className="text-[11px] text-white/55">
                Let {clientName} swap foods in this plan <span className="text-white/30">· calories &amp; macros stay locked</span>
              </span>
            </label>
          </div>

          {/* Meals */}
          <div className="p-3 space-y-2">
            {plan.plan.meals?.map((m, i) => {
              const imgUrl = mealImages[dishKey(m)];
              return (
                <div key={i} className="rounded-xl border border-white/[0.06] bg-black/15 p-2.5 flex gap-3">
                  <div className="shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-white/[0.06] bg-white/[0.03] flex items-center justify-center">
                    {imgUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imgUrl} alt={m.name} className="w-full h-full object-cover" />
                    ) : imagesLoading ? (
                      <Loader2 className="w-4 h-4 text-white/25 animate-spin" />
                    ) : (
                      <Utensils className="w-4 h-4 text-white/20" strokeWidth={1.6} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-white/85">{m.name} <span className="text-[11px] font-normal text-white/35">{m.time}</span></p>
                      <p className="text-[11px] text-white/55 shrink-0 tabular-nums">{m.calories} kcal · {m.protein}/{m.carbs}/{m.fat}</p>
                    </div>
                    <ul className="mt-1 space-y-0.5">
                      {m.items?.map((it, j) => (
                        <li key={j} className="text-[12px] text-white/60 flex items-center justify-between gap-2">
                          <span className="truncate">{it.qty} {it.food}</span>
                          <span className="text-white/30 shrink-0 tabular-nums">{it.calories}</span>
                        </li>
                      ))}
                    </ul>
                    {m.note && <p className="text-[11px] text-[#B48B40]/70 mt-1">{m.note}</p>}
                  </div>
                </div>
              );
            })}
          </div>

          {plan.created_by_name && (
            <p className="text-[10px] text-white/25 px-4 pb-3">Created by {plan.created_by_name}{imagesLoading ? " · generating images…" : ""}</p>
          )}
        </section>
      )}

      {/* ── Composer modal ── */}
      {composerOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !generating && setComposerOpen(false)} />
          <div className="relative w-full sm:max-w-lg bg-[#111111] border border-white/10 rounded-t-2xl sm:rounded-2xl p-5 max-h-[88vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-semibold text-white/90 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#B48B40]" strokeWidth={1.8} />
                {mode === "tweak" ? "Tweak the plan" : "Create a meal plan"}
              </p>
              <button onClick={() => !generating && setComposerOpen(false)} className="text-white/40 hover:text-white/80"><X className="w-4 h-4" strokeWidth={2} /></button>
            </div>
            <p className="text-[11px] text-white/35 mb-3">
              {mode === "tweak"
                ? `Describe the changes — the current plan is adjusted, not rebuilt. e.g. "swap breakfast for something dairy-free", "add 200 kcal".`
                : `Describe what you want and/or add photos of what ${clientName} eats. The plan's daily totals become their targets.`}
            </p>

            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              autoFocus
              placeholder={mode === "tweak" ? "What should change?" : "e.g. High-protein cutting plan, 4 meals, dairy-free, ~1900 kcal."}
              className="w-full resize-y bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-white/85 placeholder:text-white/25 outline-none focus:border-[#B48B40]/50"
            />

            {images.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {images.map((url, i) => (
                  <div key={i} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="w-14 h-14 object-cover rounded-lg border border-white/10" />
                    <button onClick={() => setImages((p) => p.filter((_, j) => j !== i))} className="absolute -top-1.5 -right-1.5 bg-black/80 rounded-full p-0.5 text-white/70 hover:text-red-300">
                      <X className="w-3 h-3" strokeWidth={2.5} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:text-white/90 hover:border-white/20 transition-all">
                <ImagePlus className="w-3.5 h-3.5" strokeWidth={1.8} /> Meal photos
              </button>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { void onPickImages(e.target.files); e.target.value = ""; }} />
              <label className="flex items-center gap-1.5 text-[11px] text-white/50 cursor-pointer select-none">
                <input type="checkbox" checked={anchor} onChange={(e) => setAnchor(e.target.checked)} className="accent-[#B48B40]" />
                Keep current calorie/macro targets
              </label>
            </div>

            {err && <p className="mt-3 text-xs text-red-300/80">{err}</p>}

            <div className="flex items-center justify-end gap-2 mt-4">
              <button onClick={() => setComposerOpen(false)} disabled={generating} className="text-xs text-white/45 hover:text-white/75 px-3 py-2 disabled:opacity-50">Cancel</button>
              <button onClick={generate} disabled={generating} className="inline-flex items-center gap-1.5 rounded-xl bg-[#B48B40] text-black px-4 py-2 text-xs font-semibold hover:bg-[#c99840] disabled:opacity-50 transition-all">
                {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" strokeWidth={2} />}
                {generating ? "Generating…" : mode === "tweak" ? "Apply changes" : "Generate plan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
