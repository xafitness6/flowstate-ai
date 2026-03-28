"use client";

import { useState } from "react";
import { ArrowUp, ArrowDown, Minus, Moon, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdjustmentDirection } from "./AdjustmentCard";

// ─── Types ───────────────────────────────────────────────────────────────────

export type AdjustmentRow = {
  id: string;
  label: string;
  before: string;
  after: string;
  direction: AdjustmentDirection;
  reason: string;
};

export type AdjustmentGroupProps = {
  /** Headline — e.g. "3 changes to your plan today." */
  headline: string;
  /** Sub-headline — e.g. "Based on recovery, load, and targets." */
  subline?: string;
  /** The individual adjustment rows */
  rows: AdjustmentRow[];
  /** Shown in the Expected outcome block */
  outcome: string;
  /** Deeper explanation lines for the dropdown */
  detail?: string[];
  onCommit?: () => void;
  onRevert?: () => void;
  defaultCommitted?: boolean;
  className?: string;
};

// ─── Row direction config ─────────────────────────────────────────────────────

const ROW_DIR: Record<
  AdjustmentDirection,
  {
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    iconClass: string;
    afterClass: string;
  }
> = {
  up:      { icon: ArrowUp,   iconClass: "text-emerald-400", afterClass: "text-emerald-400" },
  down:    { icon: ArrowDown, iconClass: "text-[#F87171]",   afterClass: "text-[#F87171]"   },
  neutral: { icon: Minus,     iconClass: "text-white/22",    afterClass: "text-white/30"    },
  rest:    { icon: Moon,      iconClass: "text-[#93C5FD]",   afterClass: "text-[#93C5FD]"   },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function AdjustmentGroup({
  headline,
  subline,
  rows,
  outcome,
  detail,
  onCommit,
  onRevert,
  defaultCommitted = false,
  className,
}: AdjustmentGroupProps) {
  const [committed, setCommitted] = useState(defaultCommitted);
  const [detailOpen, setDetailOpen] = useState(false);

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
        committed ? "border-white/6" : "border-[#6f4a17]/55",
        className
      )}
    >
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="px-6 pt-5 pb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-base font-semibold text-white/90">{headline}</p>
          {subline && (
            <p className="text-sm text-white/38 mt-0.5">{subline}</p>
          )}
        </div>
        <span className={cn(
          "text-base shrink-0 mt-0.5 transition-colors",
          committed ? "text-white/20" : "text-[#B48B40]"
        )}>
          ◈
        </span>
      </div>

      {/* ── Adjustment rows ─────────────────────────────────────────── */}
      <div className="h-px bg-white/5 mx-6" />
      <div className="px-6 divide-y divide-white/[0.045]">
        {rows.map((row) => {
          const cfg = ROW_DIR[row.direction];
          const Icon = cfg.icon;
          const isNeutral = row.direction === "neutral";

          return (
            <div key={row.id} className="flex items-center gap-4 py-3.5">
              {/* Arrow */}
              <div className="w-5 flex justify-center shrink-0">
                <Icon className={cn("w-3.5 h-3.5", cfg.iconClass)} strokeWidth={2} />
              </div>

              {/* Metric label */}
              <span className="text-sm text-white/48 w-28 shrink-0 truncate">
                {row.label}
              </span>

              {/* Before → after */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {isNeutral ? (
                  <span className="text-sm text-white/28 tabular-nums">{row.after}</span>
                ) : (
                  <>
                    <span className="text-sm text-white/28 line-through decoration-white/15 tabular-nums">
                      {row.before}
                    </span>
                    <span className="text-white/15 text-xs">→</span>
                    <span className={cn("text-sm font-semibold tabular-nums", cfg.afterClass)}>
                      {row.after}
                    </span>
                  </>
                )}
              </div>

              {/* Inline reason */}
              <p className="text-xs text-white/28 hidden sm:block text-right max-w-[180px] leading-relaxed shrink-0">
                {row.reason}
              </p>
            </div>
          );
        })}
      </div>

      {/* ── Outcome ────────────────────────────────────────────────── */}
      <div className="h-px bg-white/5 mx-6" />
      <div className="px-6 py-4">
        <p className="text-[10px] uppercase tracking-[0.15em] text-white/20 mb-1.5">
          Expected outcome
        </p>
        <p className="text-sm text-white/52 leading-relaxed">{outcome}</p>
      </div>

      {/* ── Detail dropdown ─────────────────────────────────────────── */}
      {detail && detail.length > 0 && (
        <div className="border-t border-white/5">
          <button
            onClick={() => setDetailOpen((v) => !v)}
            className="w-full flex items-center justify-between px-6 py-3.5 text-sm text-white/30 hover:text-white/58 transition-colors"
          >
            <span>Why this changed</span>
            {detailOpen
              ? <ChevronUp className="w-4 h-4" strokeWidth={1.5} />
              : <ChevronDown className="w-4 h-4" strokeWidth={1.5} />
            }
          </button>

          {detailOpen && (
            <div className="px-6 pb-5 space-y-2.5">
              {detail.map((line, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="text-[#B48B40]/45 text-xs mt-0.5 shrink-0">◈</span>
                  <p className="text-sm text-white/42 leading-relaxed">{line}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Actions ─────────────────────────────────────────────────── */}
      <div className="border-t border-white/5 px-6 pb-5 pt-3.5 flex items-center gap-3">
        <button
          onClick={handleRevert}
          className={cn(
            "text-sm transition-colors",
            committed
              ? "text-white/25 hover:text-white/52"
              : "text-white/18 pointer-events-none"
          )}
        >
          Revert
        </button>

        <button
          onClick={handleCommit}
          className={cn(
            "ml-auto rounded-xl px-5 py-2 text-sm font-semibold tracking-wide transition-all",
            committed
              ? "bg-white/5 text-white/32 cursor-default"
              : "bg-[#B48B40] text-black hover:bg-[#c99840]"
          )}
        >
          {committed ? "Committed" : "COMMIT"}
        </button>
      </div>

      {committed && (
        <p className="text-xs text-emerald-400/65 text-right px-6 pb-4 -mt-3">
          Plan updated.
        </p>
      )}
    </div>
  );
}
