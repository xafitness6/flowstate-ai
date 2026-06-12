"use client";

// Coach-facing AI read of the client's onboarding: how to coach them, focus,
// injury cautions, and whether a human should review before auto-programming.
// Cached server-side; (re)generate on demand.

import { useState, useEffect, useCallback } from "react";
import { Sparkles, Loader2, AlertTriangle, ShieldAlert, Target, HeartPulse, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

type Breakdown = {
  summary?: string;
  coachingApproach?: string[];
  focusAreas?: string[];
  injuryCautions?: string[];
  redFlags?: string[];
  needsReview?: boolean;
  generatedAt?: string;
};

function List({ icon: Icon, label, items, tone = "default" }: { icon: typeof Target; label: string; items?: string[]; tone?: "default" | "warn" | "danger" }) {
  if (!items || items.length === 0) return null;
  const color = tone === "danger" ? "text-red-300" : tone === "warn" ? "text-amber-300" : "text-[#B48B40]";
  return (
    <div>
      <p className={cn("text-[11px] mb-1.5 flex items-center gap-1.5", color)}>
        <Icon className="w-3.5 h-3.5" strokeWidth={1.8} /> {label}
      </p>
      <ul className="space-y-1">
        {items.map((t, i) => <li key={i} className="text-[13px] text-white/65 leading-relaxed flex gap-2"><span className="text-white/25 shrink-0">·</span>{t}</li>)}
      </ul>
    </div>
  );
}

export function ClientAIBreakdown({ clientId }: { clientId: string }) {
  const [bd, setBd] = useState<Breakdown | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const j = await fetch(`/api/clients/${clientId}/ai-breakdown`, { cache: "no-store" }).then((r) => r.json());
      setBd(j?.breakdown ?? null);
    } catch { /* resilient */ } finally { setLoaded(true); }
  }, [clientId]);

  useEffect(() => { setLoaded(false); setBd(null); void load(); }, [load]);

  async function generate() {
    if (busy) return;
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/ai-breakdown`, { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Couldn't generate.");
      setBd(j.breakdown ?? null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't generate.");
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return null;

  return (
    <div className="no-print mb-4 rounded-2xl border border-[#B48B40]/20 bg-[#B48B40]/[0.04] p-4">
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-sm font-semibold text-white/90 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#B48B40]" strokeWidth={1.8} /> AI client breakdown
        </p>
        <div className="flex items-center gap-2 shrink-0">
          {bd?.needsReview && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-300 border border-amber-400/25 bg-amber-400/[0.08] rounded-md px-1.5 py-0.5">
              <AlertTriangle className="w-3 h-3" strokeWidth={2} /> Needs your review
            </span>
          )}
          <button onClick={generate} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-white/12 px-2.5 py-1.5 text-[11px] text-white/65 hover:text-white/95 hover:border-white/25 disabled:opacity-50 transition-all">
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" strokeWidth={1.8} />}
            {bd ? "Refresh" : "Generate"}
          </button>
        </div>
      </div>

      {!bd ? (
        <p className="text-xs text-white/40">{busy ? "Reading their onboarding…" : "Generate an AI read of this client from their onboarding — how to coach them, focus, and injury cautions."}</p>
      ) : (
        <div className="space-y-3.5">
          {bd.summary && <p className="text-sm text-white/75 leading-relaxed">{bd.summary}</p>}
          <List icon={Sparkles}    label="How to coach them" items={bd.coachingApproach} />
          <List icon={Target}      label="Focus" items={bd.focusAreas} />
          <List icon={HeartPulse}  label="Injury cautions" items={bd.injuryCautions} tone="warn" />
          <List icon={ShieldAlert} label="Flags for you" items={bd.redFlags} tone="danger" />
          {bd.generatedAt && <p className="text-[10px] text-white/25">Generated {new Date(bd.generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · AI estimate, use your judgment</p>}
        </div>
      )}
      {err && <p className="mt-2 text-xs text-red-300/80">{err}</p>}
    </div>
  );
}
