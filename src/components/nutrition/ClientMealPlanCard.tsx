"use client";

// Client-facing meal plan: a single card on the nutrition page. The coach owns
// the plan; the client views it and can request a change (which notifies the
// coach). Only renders for coached clients — self-directed members never see it.

import { useState, useEffect, useCallback } from "react";
import { Utensils, Loader2, X, MessageSquarePlus, Check, ChevronRight } from "lucide-react";
import { dishKey } from "@/lib/nutrition/dishKey";

type PlanItem = { food: string; qty: string; calories: number; protein: number; carbs: number; fat: number };
type PlanMeal = { name: string; time: string; note: string; items: PlanItem[]; calories: number; protein: number; carbs: number; fat: number };
type MealPlan = {
  id: string; title: string; summary: string | null; created_by_name: string | null;
  plan: { meals: PlanMeal[]; totals: { calories: number; protein: number; carbs: number; fat: number } };
};

export function ClientMealPlanCard({ onCoachStatus }: { onCoachStatus?: (hasCoach: boolean) => void }) {
  const [hasCoach, setHasCoach] = useState<boolean | null>(null);
  const [coachName, setCoachName] = useState<string | null>(null);
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [images, setImages] = useState<Record<string, string>>({});
  const [viewOpen, setViewOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const j = await fetch("/api/me/meal-plan", { cache: "no-store" }).then((r) => r.json());
      setHasCoach(!!j?.hasCoach);
      setCoachName(j?.coachName ?? null);
      setPlan(j?.plan ?? null);
      onCoachStatus?.(!!j?.hasCoach);
      if (j?.plan) {
        const imgs = await fetch("/api/me/meal-plan/images", { cache: "no-store" }).then((r) => r.json());
        if (imgs?.images) setImages(imgs.images);
      }
    } catch {
      setHasCoach(false);
      onCoachStatus?.(false);
    }
  }, [onCoachStatus]);

  useEffect(() => { void load(); }, [load]);

  async function sendRequest() {
    if (sending || !message.trim()) return;
    setSending(true); setErr(null);
    try {
      const res = await fetch("/api/me/nutrition-request", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim() }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Couldn't send.");
      setSent(true);
      setMessage("");
      setTimeout(() => { setRequestOpen(false); setSent(false); }, 1400);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't send.");
    } finally {
      setSending(false);
    }
  }

  if (hasCoach === null || hasCoach === false) return null; // loading or no coach → nothing

  const totals = plan?.plan?.totals;

  return (
    <>
      <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white/85 flex items-center gap-2">
              <Utensils className="w-4 h-4 text-[#B48B40]" strokeWidth={1.8} /> Meal plan
            </p>
            {plan ? (
              <p className="text-[12px] text-white/45 mt-0.5 truncate">
                {plan.title}{totals ? ` · ${totals.calories} kcal · ${totals.protein}g protein` : ""}
              </p>
            ) : (
              <p className="text-[12px] text-white/35 mt-0.5">
                {coachName ? `${coachName} hasn't set a plan yet.` : "No plan set yet."}
              </p>
            )}
          </div>
          {plan && (
            <button
              onClick={() => setViewOpen(true)}
              className="inline-flex items-center gap-1 rounded-xl border border-white/12 px-3 py-1.5 text-xs font-semibold text-white/80 hover:border-[#B48B40]/40 hover:text-[#B48B40] transition-all shrink-0"
            >
              View <ChevronRight className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          )}
        </div>
        <button
          onClick={() => { setRequestOpen(true); setErr(null); setSent(false); }}
          className="mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.02] py-2 text-xs text-white/55 hover:text-white/85 hover:border-white/15 transition-all"
        >
          <MessageSquarePlus className="w-3.5 h-3.5" strokeWidth={1.8} /> Request a change from your coach
        </button>
      </section>

      {/* View plan modal */}
      {viewOpen && plan && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setViewOpen(false)} />
          <div className="relative w-full sm:max-w-lg bg-[#0E0E0E] border border-white/10 rounded-t-2xl sm:rounded-2xl p-5 max-h-[88vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <p className="text-base font-semibold text-white/90">{plan.title}</p>
                {plan.summary && <p className="text-[12px] text-white/45 mt-0.5 leading-relaxed">{plan.summary}</p>}
              </div>
              <button onClick={() => setViewOpen(false)} className="text-white/40 hover:text-white/80 shrink-0"><X className="w-4 h-4" strokeWidth={2} /></button>
            </div>
            {totals && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {([["calories", "kcal"], ["protein", "g P"], ["carbs", "g C"], ["fat", "g F"]] as const).map(([k, suf]) => (
                  <span key={k} className="rounded-lg bg-black/25 border border-white/[0.06] px-2.5 py-1 text-[11px] text-white/65">
                    <span className="font-semibold text-white/90 tabular-nums">{totals[k] ?? 0}</span> {suf}
                  </span>
                ))}
              </div>
            )}
            <div className="space-y-2">
              {plan.plan.meals?.map((m, i) => {
                const img = images[dishKey(m)];
                return (
                  <div key={i} className="rounded-xl border border-white/[0.06] bg-black/15 p-2.5 flex gap-3">
                    <div className="shrink-0 w-14 h-14 rounded-lg overflow-hidden border border-white/[0.06] bg-white/[0.03] flex items-center justify-center">
                      {img
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={img} alt={m.name} className="w-full h-full object-cover" />
                        : <Utensils className="w-4 h-4 text-white/20" strokeWidth={1.6} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-white/85">{m.name} <span className="text-[11px] font-normal text-white/35">{m.time}</span></p>
                        <p className="text-[11px] text-white/55 shrink-0 tabular-nums">{m.calories} kcal</p>
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
          </div>
        </div>
      )}

      {/* Request a change modal */}
      {requestOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !sending && setRequestOpen(false)} />
          <div className="relative w-full sm:max-w-md bg-[#0E0E0E] border border-white/10 rounded-t-2xl sm:rounded-2xl p-5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-semibold text-white/90">Request a change</p>
              <button onClick={() => !sending && setRequestOpen(false)} className="text-white/40 hover:text-white/80"><X className="w-4 h-4" strokeWidth={2} /></button>
            </div>
            <p className="text-[11px] text-white/35 mb-3">
              {coachName ? `${coachName} will see this and update your plan or targets.` : "Your coach will see this and update your plan or targets."}
            </p>
            {sent ? (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-3 text-sm text-emerald-300">
                <Check className="w-4 h-4" strokeWidth={2.5} /> Sent to your coach.
              </div>
            ) : (
              <>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  autoFocus
                  placeholder="e.g. Can we lower carbs a bit? Or swap chicken for fish — I don't eat chicken."
                  className="w-full resize-y bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-white/85 placeholder:text-white/25 outline-none focus:border-[#B48B40]/50"
                />
                {err && <p className="mt-2 text-xs text-red-300/80">{err}</p>}
                <div className="flex items-center justify-end gap-2 mt-3">
                  <button onClick={() => setRequestOpen(false)} disabled={sending} className="text-xs text-white/45 hover:text-white/75 px-3 py-2 disabled:opacity-50">Cancel</button>
                  <button onClick={sendRequest} disabled={sending || !message.trim()} className="inline-flex items-center gap-1.5 rounded-xl bg-[#B48B40] text-black px-4 py-2 text-xs font-semibold hover:bg-[#c99840] disabled:opacity-50 transition-all">
                    {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageSquarePlus className="w-3.5 h-3.5" strokeWidth={2} />}
                    {sending ? "Sending…" : "Send to coach"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
