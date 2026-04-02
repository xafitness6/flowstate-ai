"use client";

import { useState } from "react";
import { Zap, Loader2, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAIPipeline } from "@/hooks/useAIPipeline";
import { useUser } from "@/context/UserContext";
import type { RawUserData } from "@/lib/ai/types";

// ── Demo data builder ─────────────────────────────────────────────────────────
// In production this would read from real logged data.

function buildDemoData(userId: string): RawUserData {
  return {
    userId,
    date:                 new Date().toISOString().slice(0, 10),
    sleepHours:           7.2,
    sleepQuality:         3,
    soreness:             3,
    stressLevel:          3,
    energyLevel:          3,
    hrv:                  52,
    sessionsThisWeek:     3,
    avgRpe:               7,
    consecutiveDays:      3,
    habitsCompletedToday: 4,
    totalHabits:          5,
    adherenceStreak:      5,
  };
}

const STATUS_LABELS: Record<string, string> = {
  summarizing: "Reading your state…",
  deciding:    "Calculating adjustments…",
  formatting:  "Building your plan…",
};

const RECOVERY_COLORS: Record<string, string> = {
  optimal:  "text-emerald-400",
  moderate: "text-[#B48B40]",
  low:      "text-orange-400",
  critical: "text-red-400",
};

// ── Component ─────────────────────────────────────────────────────────────────

export function CoachPanel() {
  const { user }  = useUser();
  const pipeline  = useAIPipeline();
  const [notesOpen, setNotesOpen] = useState(false);

  const isLoading = ["summarizing", "deciding", "formatting"].includes(pipeline.status);
  const result    = pipeline.result ?? pipeline.lastResult;

  function handleRun() {
    pipeline.run(buildDemoData(user.id));
  }

  return (
    <div className="rounded-2xl border border-white/8 bg-[#111111] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between border-b border-white/6">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-[#B48B40]" strokeWidth={2} />
          <span className="text-sm font-semibold text-white/80">AI Coach</span>
        </div>
        <button
          onClick={handleRun}
          disabled={isLoading}
          className={cn(
            "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all",
            isLoading
              ? "bg-white/5 text-white/25 cursor-default"
              : "bg-[#B48B40]/10 border border-[#B48B40]/25 text-[#B48B40]/80 hover:bg-[#B48B40]/15 hover:text-[#B48B40]"
          )}
        >
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />
          )}
          {isLoading ? STATUS_LABELS[pipeline.status] ?? "Processing…" : "Run analysis"}
        </button>
      </div>

      {/* Error */}
      {pipeline.status === "error" && (
        <div className="px-5 py-4">
          <p className="text-xs text-red-400/70">{pipeline.error}</p>
        </div>
      )}

      {/* No result yet */}
      {!result && pipeline.status !== "error" && !isLoading && (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-white/25">Run an analysis to see today&apos;s plan.</p>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="px-5 py-8 flex flex-col items-center gap-2">
          <Loader2 className="w-5 h-5 text-[#B48B40]/50 animate-spin" />
          <p className="text-xs text-white/30">{STATUS_LABELS[pipeline.status]}</p>
        </div>
      )}

      {/* Result */}
      {result && !isLoading && (
        <div className="divide-y divide-white/[0.04]">

          {/* State bar */}
          <div className="px-5 py-3 flex items-center gap-4 flex-wrap">
            <Metric
              label="Recovery"
              value={result.state.recovery_status}
              className={RECOVERY_COLORS[result.state.recovery_status]}
            />
            <Metric label="Energy"      value={result.state.energy_status} />
            <Metric label="Adherence"   value={result.state.adherence_level} />
            <Metric label="Readiness"   value={`${result.state.readiness_score}/100`} />
          </div>

          {/* Today's focus */}
          <div className="px-5 py-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/25 mb-1.5">
              Today&apos;s focus
            </p>
            <p className="text-sm text-white/80 leading-snug">
              {result.response.todays_focus}
            </p>
          </div>

          {/* Training plan */}
          <div className="px-5 py-4 space-y-3">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/25">
              Training plan
            </p>
            <div className="grid grid-cols-2 gap-2">
              <PlanCell label="Session"   value={result.response.training_plan.summary} />
              <PlanCell label="Intensity" value={result.response.training_plan.intensity} />
              <PlanCell label="Duration"  value={result.response.training_plan.duration} />
              <PlanCell label="Key cue"   value={result.response.training_plan.key_instruction} />
            </div>
          </div>

          {/* Coaching insight */}
          <div className="px-5 py-4">
            <div className="flex gap-2.5">
              <div className="w-[2px] rounded-full bg-[#B48B40]/30 shrink-0 mt-0.5" />
              <p className="text-sm text-white/55 leading-snug italic">
                {result.response.coaching_insight}
              </p>
            </div>
          </div>

          {/* Adjustment notes — collapsible */}
          <div>
            <button
              onClick={() => setNotesOpen((v) => !v)}
              className="w-full flex items-center justify-between px-5 py-3 text-xs text-white/30 hover:text-white/50 transition-colors"
            >
              <span className="uppercase tracking-[0.15em]">Adjustment notes</span>
              {notesOpen
                ? <ChevronUp  className="w-3.5 h-3.5" strokeWidth={1.5} />
                : <ChevronDown className="w-3.5 h-3.5" strokeWidth={1.5} />}
            </button>
            {notesOpen && (
              <div className="px-5 pb-4 space-y-1.5">
                {result.response.adjustment_notes.map((note, i) => (
                  <p key={i} className="text-xs text-white/40 flex gap-2">
                    <span className="text-[#B48B40]/40 shrink-0">—</span>
                    {note}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Timestamp */}
          <div className="px-5 py-2.5">
            <p className="text-[10px] text-white/15">
              Generated {new Date(result.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Metric({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-[0.15em] text-white/20 mb-0.5">{label}</p>
      <p className={cn("text-xs font-semibold capitalize text-white/60", className)}>{value}</p>
    </div>
  );
}

function PlanCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/6 bg-white/[0.02] px-3 py-2.5">
      <p className="text-[9px] uppercase tracking-[0.12em] text-white/20 mb-1">{label}</p>
      <p className="text-xs text-white/70 leading-snug">{value}</p>
    </div>
  );
}
