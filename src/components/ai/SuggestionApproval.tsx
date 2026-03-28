"use client";

import { useState } from "react";
import { X, Sparkles, ArrowRight, Clock, Check, Edit3, RotateCcw, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SuggestionCategory = "training" | "nutrition" | "recovery" | "schedule";

export type AISuggestion = {
  id:       string;
  category: SuggestionCategory;
  title:    string;
  what:     string;       // brief description of the change
  why:      string;       // reasoning / data behind it
  impact:   string;       // expected outcome
  current:  string;       // current value / state
  proposed: string;       // proposed value / state
};

export type ApprovalDuration = "1w" | "2w" | "1m" | "permanent";

export type ApprovalOutcome =
  | { action: "approve";  duration: ApprovalDuration }
  | { action: "reject"                               }
  | { action: "edit";     editedValue: string        }
  | { action: "override"; overrideValue: string      };

// ─── Config ───────────────────────────────────────────────────────────────────

const CATEGORY_CFG: Record<SuggestionCategory, { label: string; color: string; bg: string; border: string }> = {
  training:  { label: "Training",  color: "text-[#B48B40]",   bg: "bg-[#B48B40]/8",   border: "border-[#B48B40]/25"   },
  nutrition: { label: "Nutrition", color: "text-emerald-400", bg: "bg-emerald-400/8",  border: "border-emerald-400/25" },
  recovery:  { label: "Recovery",  color: "text-[#93C5FD]",   bg: "bg-[#93C5FD]/8",   border: "border-[#93C5FD]/25"   },
  schedule:  { label: "Schedule",  color: "text-white/55",    bg: "bg-white/[0.04]",   border: "border-white/12"       },
};

const DURATION_OPTIONS: { id: ApprovalDuration; label: string; sub: string }[] = [
  { id: "1w",        label: "1 Week",    sub: "Auto-reverts after 7 days"  },
  { id: "2w",        label: "2 Weeks",   sub: "Auto-reverts after 14 days" },
  { id: "1m",        label: "1 Month",   sub: "Auto-reverts after 30 days" },
  { id: "permanent", label: "Permanent", sub: "Stays until manually changed" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function SuggestionApproval({
  suggestion,
  onClose,
  onOutcome,
}: {
  suggestion: AISuggestion;
  onClose: () => void;
  onOutcome: (outcome: ApprovalOutcome) => void;
}) {
  const [duration,      setDuration     ] = useState<ApprovalDuration>("1w");
  const [mode,          setMode         ] = useState<"review" | "edit" | "override">("review");
  const [editValue,     setEditValue    ] = useState(suggestion.proposed);
  const [overrideValue, setOverrideValue] = useState(suggestion.current);

  const cfg = CATEGORY_CFG[suggestion.category];

  function handleApprove() {
    onOutcome({ action: "approve", duration });
    onClose();
  }
  function handleReject() {
    onOutcome({ action: "reject" });
    onClose();
  }
  function handleEdit() {
    onOutcome({ action: "edit", editedValue: editValue });
    onClose();
  }
  function handleOverride() {
    onOutcome({ action: "override", overrideValue });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center px-4 pb-6 md:pb-0">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#0F0F0F] shadow-2xl shadow-black/70 overflow-hidden">

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="px-6 pt-5 pb-4 border-b border-white/[0.06]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-6 h-6 rounded-lg bg-[#B48B40]/12 border border-[#B48B40]/25 flex items-center justify-center">
                  <Sparkles className="w-3 h-3 text-[#B48B40]/80" strokeWidth={1.5} />
                </div>
                <span className="text-[10px] uppercase tracking-[0.18em] text-white/30 font-medium">AI Suggestion</span>
                <span className={cn("text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border", cfg.color, cfg.bg, cfg.border)}>
                  {cfg.label}
                </span>
              </div>
              <p className="text-base font-semibold text-white/90">{suggestion.title}</p>
            </div>
            <button onClick={onClose} className="text-white/25 hover:text-white/55 transition-colors shrink-0 mt-0.5">
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* ── Body ────────────────────────────────────────────────── */}
        <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">

          {/* Change preview */}
          <div className="rounded-2xl border border-white/6 bg-white/[0.02] p-4">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/22 mb-3">Proposed change</p>
            <div className="flex items-center gap-3">
              <div className="flex-1 rounded-xl border border-white/8 bg-white/[0.02] px-3.5 py-2.5">
                <p className="text-[10px] uppercase tracking-[0.12em] text-white/22 mb-0.5">Current</p>
                <p className="text-sm text-white/65 font-medium">{suggestion.current}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-white/20 shrink-0" strokeWidth={1.5} />
              <div className="flex-1 rounded-xl border border-[#B48B40]/25 bg-[#B48B40]/6 px-3.5 py-2.5">
                <p className="text-[10px] uppercase tracking-[0.12em] text-[#B48B40]/50 mb-0.5">Proposed</p>
                <p className="text-sm text-[#B48B40] font-medium">{suggestion.proposed}</p>
              </div>
            </div>
          </div>

          {/* What + Why */}
          <div className="space-y-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/22 mb-1.5">What changes</p>
              <p className="text-sm text-white/60 leading-relaxed">{suggestion.what}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/22 mb-1.5">Why</p>
              <p className="text-sm text-white/60 leading-relaxed">{suggestion.why}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/22 mb-1.5">Expected impact</p>
              <p className="text-sm text-emerald-400/75 leading-relaxed">{suggestion.impact}</p>
            </div>
          </div>

          {/* Edit / Override panels */}
          {mode === "edit" && (
            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.04] p-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-amber-400/60 mb-2">Edit proposed value</p>
              <input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-full bg-transparent text-sm text-white/80 placeholder:text-white/25 outline-none border-b border-white/12 pb-1.5 focus:border-amber-400/40 transition-colors"
                placeholder="Enter your adjusted value..."
              />
              <p className="text-[10px] text-white/25 mt-2">Original AI suggestion: {suggestion.proposed}</p>
            </div>
          )}

          {mode === "override" && (
            <div className="rounded-2xl border border-[#F87171]/20 bg-[#F87171]/[0.04] p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <AlertTriangle className="w-3.5 h-3.5 text-[#F87171]/60" strokeWidth={1.5} />
                <p className="text-[10px] uppercase tracking-[0.16em] text-[#F87171]/60">Manual override</p>
              </div>
              <input
                value={overrideValue}
                onChange={(e) => setOverrideValue(e.target.value)}
                className="w-full bg-transparent text-sm text-white/80 placeholder:text-white/25 outline-none border-b border-white/12 pb-1.5 focus:border-[#F87171]/40 transition-colors"
                placeholder="Set your own value..."
              />
              <p className="text-[10px] text-white/25 mt-2">This replaces the AI suggestion entirely. AI will note the manual override.</p>
            </div>
          )}

          {/* Duration selector (shown for approve + edit modes) */}
          {mode !== "override" && (
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <Clock className="w-3.5 h-3.5 text-white/25" strokeWidth={1.5} />
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/22">How long should this stay active?</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {DURATION_OPTIONS.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setDuration(d.id)}
                    className={cn(
                      "rounded-xl border px-3.5 py-2.5 text-left transition-all",
                      duration === d.id
                        ? "border-[#B48B40]/35 bg-[#B48B40]/8"
                        : "border-white/6 bg-white/[0.01] hover:bg-white/[0.03]"
                    )}
                  >
                    <p className={cn("text-sm font-medium", duration === d.id ? "text-[#B48B40]" : "text-white/65")}>
                      {d.label}
                    </p>
                    <p className="text-[10px] text-white/28 mt-0.5">{d.sub}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Actions ─────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t border-white/[0.06] space-y-2">

          {/* Primary row */}
          <div className="flex items-center gap-2">
            {mode === "review" && (
              <>
                <button
                  onClick={handleApprove}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-sm font-semibold py-2.5 hover:bg-emerald-500/20 transition-all"
                >
                  <Check className="w-4 h-4" strokeWidth={2} />
                  Approve
                </button>
                <button
                  onClick={() => setMode("edit")}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-amber-400/25 bg-amber-400/6 text-amber-400 text-sm font-medium py-2.5 hover:bg-amber-400/12 transition-all"
                >
                  <Edit3 className="w-4 h-4" strokeWidth={1.5} />
                  Edit
                </button>
              </>
            )}
            {mode === "edit" && (
              <button
                onClick={handleEdit}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 text-sm font-semibold py-2.5 hover:bg-amber-500/20 transition-all"
              >
                <Check className="w-4 h-4" strokeWidth={2} />
                Apply edited value
              </button>
            )}
            {mode === "override" && (
              <button
                onClick={handleOverride}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#F87171]/10 border border-[#F87171]/25 text-[#F87171] text-sm font-semibold py-2.5 hover:bg-[#F87171]/15 transition-all"
              >
                <RotateCcw className="w-4 h-4" strokeWidth={1.5} />
                Apply override
              </button>
            )}
          </div>

          {/* Secondary row */}
          <div className="flex items-center gap-2">
            {mode !== "override" && (
              <button
                onClick={() => setMode(mode === "review" ? "override" : "review")}
                className="flex-1 text-xs text-white/30 hover:text-white/55 py-1.5 transition-colors"
              >
                {mode === "review" ? "Override manually" : "Cancel override"}
              </button>
            )}
            <button
              onClick={mode !== "review" ? () => setMode("review") : handleReject}
              className={cn(
                "flex-1 text-xs py-1.5 transition-colors",
                mode !== "review"
                  ? "text-white/30 hover:text-white/55"
                  : "text-[#F87171]/50 hover:text-[#F87171]/75"
              )}
            >
              {mode !== "review" ? "Back" : "Reject suggestion"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
