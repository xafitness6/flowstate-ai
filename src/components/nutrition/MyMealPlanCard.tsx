"use client";

// Self-directed meal plan for a member with NO coach. They generate their own
// plan from their own macros (+ an optional prompt / food photos), then view,
// tweak, or replace it. Renders nothing for coached clients — ClientMealPlanCard
// owns that case (the coach sets their plan).

import { useState, useEffect, useCallback, useRef } from "react";
import { Utensils, Sparkles, Wand2, Plus, Loader2, X, ImagePlus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { dishKey } from "@/lib/nutrition/dishKey";

type PlanItem = { food: string; qty: string; calories: number; protein: number; carbs: number; fat: number };
type PlanMeal = { name: string; time: string; note: string; items: PlanItem[]; calories: number; protein: number; carbs: number; fat: number };
type PlanBody = { meals: PlanMeal[]; totals: { calories: number; protein: number; carbs: number; fat: number } };
type MealPlan = { id: string; title: string; summary: string | null; plan: PlanBody };

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export function MyMealPlanCard({
  targets,
}: {
  targets?: { calories: number; proteinG: number; carbsG: number; fatG: number };
}) {
  const [hasCoach, setHasCoach] = useState<boolean | null>(null);
  const [plan, setPlan]   = useState<MealPlan | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [mealImages, setMealImages] = useState<Record<string, string>>({});
  const [imagesLoading, setImagesLoading] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [mode, setMode]   = useState<"create" | "tweak">("create");
  const [prompt, setPrompt] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const j = await fetch("/api/me/meal-plan", { cache: "no-store" }).then((r) => r.json());
      setHasCoach(!!j?.hasCoach);
      setPlan(j?.plan ?? null);
    } catch { /* resilient */ } finally { setLoaded(true); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  // Generate/serve a dish image per meal (one per call; poll until done) — same
  // shared cache the trainer plans use, so members get the same polished look.
  const loadImages = useCallback(async () => {
    setImagesLoading(true);
    try {
      for (let i = 0; i < 12; i++) {
        const r = await fetch("/api/me/meal-plan/images", { method: "POST" });
        const j = await r.json();
        if (j?.images) setMealImages((prev) => ({ ...prev, ...j.images }));
        if (!j?.remaining || j.remaining <= 0) break;
      }
    } catch { /* best-effort */ } finally { setImagesLoading(false); }
  }, []);
  useEffect(() => { if (plan?.id) void loadImages(); }, [plan?.id, loadImages]);

  function openComposer(m: "create" | "tweak") {
    setMode(m); setErr(null); setPrompt(""); setImages([]); setComposerOpen(true);
  }

  async function addFiles(files: FileList | null) {
    if (!files) return;
    const urls = await Promise.all(Array.from(files).slice(0, 6).map(fileToDataUrl));
    setImages((p) => [...p, ...urls].slice(0, 6));
  }

  async function generate() {
    if (generating) return;
    if (!prompt.trim() && images.length === 0) { setErr("Tell me what you want, or add a photo."); return; }
    setGenerating(true); setErr(null);
    try {
      const t = targets ? { calories: targets.calories, protein: targets.proteinG, carbs: targets.carbsG, fat: targets.fatG } : undefined;
      const res = await fetch("/api/me/meal-plan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), images, targets: t, basePlan: mode === "tweak" ? plan?.plan : undefined }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Couldn't build the plan.");
      setPlan(j.plan ?? null);
      setComposerOpen(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't build the plan.");
    } finally { setGenerating(false); }
  }

  if (!loaded || hasCoach === null || hasCoach === true) return null; // loading or coached → coach card owns it
  const totals = plan?.plan?.totals;

  return (
    <div className="rounded-2xl border border-[#B48B40]/20 bg-[#B48B40]/[0.04] overflow-hidden">
      {!plan ? (
        <div className="px-5 py-6 text-center">
          <Utensils className="w-7 h-7 text-[#B48B40]/50 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm text-white/75 mb-1">Build a meal plan from your macros</p>
          <p className="text-xs text-white/35 mb-4">AI designs a day of meals that hits your calorie &amp; macro targets — describe your tastes or add a photo of what you have.</p>
          <button onClick={() => openComposer("create")} className="inline-flex items-center gap-1.5 rounded-xl bg-[#B48B40] text-black px-4 py-2 text-xs font-semibold hover:bg-[#c99840] transition-all">
            <Sparkles className="w-3.5 h-3.5" strokeWidth={2} /> Create my meal plan
          </button>
        </div>
      ) : (
        <>
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
              </div>
            </div>
            {totals && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {([["calories", "kcal"], ["protein", "P"], ["carbs", "C"], ["fat", "F"]] as const).map(([k, suffix]) => (
                  <span key={k} className="rounded-lg bg-black/25 border border-white/[0.06] px-2.5 py-1 text-[11px] text-white/65">
                    <span className="font-semibold text-white/90 tabular-nums">{totals[k] ?? 0}</span> {suffix}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="p-3 space-y-2">
            {plan.plan.meals.map((m, i) => {
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
                      {m.items.map((it, j) => (
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
          {imagesLoading && <p className="text-[10px] text-white/25 px-4 pb-3">Generating dish images…</p>}
        </>
      )}

      {/* Composer modal */}
      {composerOpen && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !generating && setComposerOpen(false)} />
          <div className="relative w-full sm:max-w-md bg-[#0D0D0D] border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[92dvh]">
            <div className="px-5 pt-5 pb-4 border-b border-white/[0.06] flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white/80">{mode === "tweak" ? "Tweak my plan" : "Create my meal plan"}</h2>
                <p className="text-[11px] text-white/30 mt-0.5">
                  {targets ? `Built to hit ~${targets.calories} kcal · ${targets.proteinG}P / ${targets.carbsG}C / ${targets.fatG}F.` : "Built around your saved macros."}
                </p>
              </div>
              <button onClick={() => !generating && setComposerOpen(false)} className="w-7 h-7 rounded-lg border border-white/8 bg-white/[0.03] flex items-center justify-center text-white/30 hover:text-white/65"><X className="w-3.5 h-3.5" strokeWidth={1.5} /></button>
            </div>
            <div className="px-5 py-4 space-y-3 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                placeholder={mode === "tweak"
                  ? "What should change? e.g. 'swap the oats for eggs', 'make dinner higher protein', 'no dairy'."
                  : "Describe what you like: e.g. '4 meals, high protein, quick to cook, I love chicken and rice, no seafood'."}
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/85 placeholder:text-white/25 outline-none focus:border-[#B48B40]/50 resize-none leading-relaxed"
              />
              {images.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {images.map((src, i) => (
                    <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-white/10">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" className="w-full h-full object-cover" />
                      <button onClick={() => setImages((p) => p.filter((_, j) => j !== i))} className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center text-white/80"><Trash2 className="w-2.5 h-2.5" /></button>
                    </div>
                  ))}
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
              <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 text-[11px] text-white/40 hover:text-white/70 border border-white/10 rounded-lg px-2.5 py-1.5">
                <ImagePlus className="w-3.5 h-3.5" strokeWidth={1.8} /> Add food photos
              </button>
              {err && <p className="text-[11px] text-[#EF4444]/70">{err}</p>}
            </div>
            <div className="px-5 pt-3 border-t border-white/[0.05] flex gap-2.5" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}>
              <button onClick={() => !generating && setComposerOpen(false)} className="px-3 py-2.5 rounded-xl border border-white/10 text-xs font-medium text-white/45 hover:text-white/70">Cancel</button>
              <button onClick={generate} disabled={generating} className="flex-1 py-2.5 rounded-xl bg-[#B48B40] text-black text-sm font-semibold hover:bg-[#c99840] disabled:opacity-50 inline-flex items-center justify-center gap-2">
                {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" strokeWidth={2} />}
                {generating ? "Building…" : mode === "tweak" ? "Apply changes" : "Generate plan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
