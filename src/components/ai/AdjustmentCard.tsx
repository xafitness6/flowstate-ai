"use client";

import { useState } from "react";
import {
  ArrowUp,
  ArrowDown,
  Minus,
  ChevronDown,
  ChevronUp,
  Moon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

export type AdjustmentDirection = "up" | "down" | "neutral" | "rest";

export type AdjustmentCardProps = {
  /** The metric being adjusted — e.g. "Calories", "Training load" */
  title: string;
  /** Value before the change — e.g. "2,200 kcal" */
  before: string;
  /** Value after the change — e.g. "2,050 kcal" */
  after: string;
  /** Direction arrow shown between before → after */
  direction: AdjustmentDirection;
  /** One-line reason shown inline */
  reason: string;
  /** Expected outcome shown below the reason */
  outcome: string;
  /** Optional deeper explanation shown in the dropdown */
  detail?: string[];
  /** Called when the user commits the change */
  onCommit?: () => void;
  /** Called when the user reverts — only shown post-commit */
  onRevert?: () => void;
  /** Start in a committed state */
  defaultCommitted?: boolean;
  /** Visual variant — default shows full card, compact hides outcome/detail */
  variant?: "default" | "compact";
  className?: string;
};

// ─── Direction config ─────────────────────────────────────────────────────────

const DIR_CONFIG: Record<
  AdjustmentDirection,
  {
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    valueColor: string;
    iconColor: string;
    border: string;
    bg: string;
  }
> = {
  up: {
    icon: ArrowUp,
    valueColor: "text-emerald-400",
    iconColor: "text-emerald-400",
    border: "border-emerald-500/20",
    bg:     "bg-emerald-400/5",
  },
  down: {
    icon: ArrowDown,
    valueColor: "text-[#F87171]",
    iconColor:  "text-[#F87171]",
    border:     "border-[#F87171]/20",
    bg:         "bg-[#F87171]/5",
  },
  neutral: {
    icon: Minus,
    valueColor: "text-white/40",
    iconColor:  "text-white/25",
    border:     "border-white/8",
    bg:         "bg-white/[0.02]",
  },
  rest: {
    icon: Moon,
    valueColor: "text-[#93C5FD]",
    iconColor:  "text-[#93C5FD]",
    border:     "border-[#93C5FD]/20",
    bg:         "bg-[#93C5FD]/5",
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function AdjustmentCard({
  title,
  before,
  after,
  direction,
  reason,
  outcome,
  detail,
  onCommit,
  onRevert,
  defaultCommitted = false,
  variant = "default",
  className,
}: AdjustmentCardProps) {
  const [committed, setCommitted] = useState(defaultCommitted);
  const [detailOpen, setDetailOpen] = useState(false);

  const cfg = DIR_CONFIG[direction];
  const Icon = cfg.icon;
  const isNeutral = direction === "neutral";

  function handleCommit() {
    if (committed) return;
    setCommitted(true);
    onCommit?.();
  }

  function handleRevert() {
    setCommitted(false);
    onRevert?.();
  }

  return (
    <div
      className={cn(
        "rounded-2xl border bg-[#0e0d0b] overflow-hidden transition-all",
        committed ? "border-white/6 opacity-80" : "border-[#6f4a17]/55",
        className
      )}
    >
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start gap-3">

          {/* Direction icon pill */}
          <div className={cn(
            "w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 mt-0.5",
            cfg.border, cfg.bg
          )}>
            <Icon className={cn("w-3.5 h-3.5", cfg.iconColor)} strokeWidth={2} />
          </div>

          {/* Title + before/after */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-sm font-semibold text-white/85">{title}</span>
              {committed && (
                <span className="text-[10px] font-medium tracking-[0.08em] uppercase px-1.5 py-0.5 rounded-md border border-emerald-400/20 bg-emerald-400/8 text-emerald-400">
                  Applied
                </span>
              )}
            </div>

            {/* Before → after */}
            <div className="flex items-center gap-2">
              {isNeutral ? (
                <span className="text-sm text-white/30 tabular-nums">{after}</span>
              ) : (
                <>
                  <span className="text-sm text-white/30 line-through decoration-white/15 tabular-nums">
                    {before}
                  </span>
                  <span className="text-white/15 text-xs">→</span>
                  <span className={cn("text-sm font-semibold tabular-nums", cfg.valueColor)}>
                    {after}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Reason */}
        <p className="text-xs text-white/40 leading-relaxed mt-3 ml-10">
          {reason}
        </p>
      </div>

      {/* ── Outcome ────────────────────────────────────────────────── */}
      {variant === "default" && (
        <>
          <div className="h-px bg-white/5 mx-5" />
          <div className="px-5 py-3.5">
            <p className="text-[10px] uppercase tracking-[0.15em] text-white/20 mb-1">
              Expected outcome
            </p>
            <p className="text-xs text-white/50 leading-relaxed">{outcome}</p>
          </div>
        </>
      )}

      {/* ── Detail dropdown ─────────────────────────────────────────── */}
      {detail && detail.length > 0 && (
        <div className="border-t border-white/5">
          <button
            onClick={() => setDetailOpen((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-3 text-xs text-white/30 hover:text-white/55 transition-colors"
          >
            <span>Why this changed</span>
            {detailOpen
              ? <ChevronUp className="w-3.5 h-3.5" strokeWidth={1.5} />
              : <ChevronDown className="w-3.5 h-3.5" strokeWidth={1.5} />
            }
          </button>

          {detailOpen && (
            <div className="px-5 pb-3.5 space-y-2">
              {detail.map((line, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="text-[#B48B40]/40 text-xs mt-0.5 shrink-0">◈</span>
                  <p className="text-xs text-white/40 leading-relaxed">{line}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Actions ─────────────────────────────────────────────────── */}
      <div className="border-t border-white/5 px-5 py-3.5 flex items-center gap-3">
        <button
          onClick={handleRevert}
          className={cn(
            "text-xs transition-colors",
            committed
              ? "text-white/25 hover:text-white/50"
              : "text-white/18 pointer-events-none"
          )}
        >
          Revert
        </button>

        <button
          onClick={handleCommit}
          className={cn(
            "ml-auto rounded-lg px-4 py-1.5 text-xs font-semibold tracking-wide transition-all",
            committed
              ? "bg-white/5 text-white/30 cursor-default"
              : "bg-[#B48B40] text-black hover:bg-[#c99840]"
          )}
        >
          {committed ? "Committed" : "COMMIT"}
        </button>
      </div>
    </div>
  );
}
