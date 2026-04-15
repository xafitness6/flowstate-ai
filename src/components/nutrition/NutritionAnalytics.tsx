"use client";

import { useState, useEffect } from "react";
import { TrendingUp, ChevronDown, ChevronUp, Droplets, Flame, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { computeNutritionAnalytics, type DayData, type AnalyticsSummary } from "@/lib/nutrition/analytics";
import type { NutritionTargets } from "@/lib/nutrition";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  userId:  string;
  targets: NutritionTargets;
  today:   string;   // YYYY-MM-DD — anchor for range calculations
}

type Range = "7D" | "30D";

// ─── Date helpers ─────────────────────────────────────────────────────────────

function offsetDate(base: string, days: number): string {
  const d = new Date(base + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const RANGE_DAYS: Record<Range, number> = { "7D": 7, "30D": 30 };

// ─── SVG Sparkline (area chart with gradient) ─────────────────────────────────

function CalorieSpark({ days, target }: { days: DayData[]; target: number }) {
  if (days.length < 2) return <div className="h-14 flex items-center justify-center text-xs text-white/20">Not enough data</div>;

  const W = 300; const H = 56;
  const maxV = Math.max(...days.map((d) => d.calories), target) * 1.08 || 1;
  const targetY = H - (target / maxV) * H;

  // Build path segments — skip unlogged days
  type Pt = { x: number; y: number };
  const pts: (Pt | null)[] = days.map((d, i) => {
    const x = (i / (days.length - 1)) * W;
    return d.logged ? { x, y: H - (d.calories / maxV) * H } : null;
  });

  const segments: Pt[][] = [];
  let cur: Pt[] = [];
  pts.forEach((p) => {
    if (p) {
      cur.push(p);
    } else {
      if (cur.length > 1) segments.push(cur);
      cur = [];
    }
  });
  if (cur.length > 1) segments.push(cur);

  const lastPt = pts.filter(Boolean).slice(-1)[0] as Pt | undefined;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-14 overflow-visible">
      <defs>
        <linearGradient id="calAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#B48B40" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#B48B40" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Target dashed line */}
      <line x1="0" y1={targetY.toFixed(1)} x2={W} y2={targetY.toFixed(1)}
        stroke="rgba(255,255,255,0.12)" strokeDasharray="4 3" strokeWidth="1" />
      {/* Area fills */}
      {segments.map((seg, i) => {
        const poly = seg.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L ");
        const area = `M ${poly} L ${seg[seg.length - 1].x.toFixed(1)},${H} L ${seg[0].x.toFixed(1)},${H} Z`;
        return <path key={i} d={area} fill="url(#calAreaGrad)" />;
      })}
      {/* Lines */}
      {segments.map((seg, i) => (
        <polyline key={i}
          points={seg.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
          fill="none" stroke="#B48B40" strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round"
        />
      ))}
      {/* Latest dot */}
      {lastPt && <circle cx={lastPt.x.toFixed(1)} cy={lastPt.y.toFixed(1)} r="2.5" fill="#B48B40" />}
    </svg>
  );
}

function HydrationBars({ days, target }: { days: DayData[]; target: number }) {
  const display = days.slice(-14); // show last 14 days max
  const maxV = Math.max(...display.map((d) => d.hydrationMl), target) || 1;
  return (
    <div className="flex items-end gap-0.5 h-10">
      {display.map((d) => {
        const pct = Math.min((d.hydrationMl / maxV), 1);
        const hitTarget = d.hydrationMl >= target * 0.9;
        return (
          <div key={d.date} className="flex-1 flex flex-col justify-end h-full">
            <div
              style={{ height: `${Math.max(pct * 100, 3)}%` }}
              className={cn(
                "w-full rounded-sm transition-all",
                !d.logged   ? "bg-white/[0.04]"
                : hitTarget ? "bg-[#93C5FD]/50"
                :             "bg-[#93C5FD]/20",
              )}
            />
          </div>
        );
      })}
    </div>
  );
}

// ─── Macro adherence bar ──────────────────────────────────────────────────────

function AdherenceBar({
  label, value, target, color,
}: { label: string; value: number; target: number; color: string }) {
  const pct = target > 0 ? Math.min(value / target, 1.15) : 0;
  const display = target > 0 ? Math.round((value / target) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-white/45">{label}</span>
        <span className="text-[11px] tabular-nums text-white/40">
          {Math.round(value)}g
          <span className={cn("ml-1 font-semibold", display >= 85 ? "text-emerald-400/70" : "text-white/30")}>
            {display}%
          </span>
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-700", color)}
          style={{ width: `${Math.min(pct * 100, 100)}%` }}
        />
      </div>
    </div>
  );
}

// ─── Consistency ring ─────────────────────────────────────────────────────────

function ConsistencyRing({ logged, total }: { logged: number; total: number }) {
  const pct = total > 0 ? logged / total : 0;
  const r = 22; const C = 2 * Math.PI * r;
  const fill = C * pct;
  return (
    <svg viewBox="0 0 56 56" className="w-14 h-14 -rotate-90">
      <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
      <circle cx="28" cy="28" r={r} fill="none"
        stroke={pct >= 0.8 ? "#34D399" : pct >= 0.5 ? "#B48B40" : "#EF4444"}
        strokeWidth="4" strokeLinecap="round"
        strokeDasharray={`${fill.toFixed(1)} ${C.toFixed(1)}`}
      />
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const EMPTY_SUMMARY: AnalyticsSummary = {
  days: [], totalDays: 0, daysLogged: 0, streak: 0,
  avgCalories: 0, avgProtein: 0, avgCarbs: 0, avgFat: 0, avgHydration: 0,
  calGoalPct: 0, protGoalPct: 0, carbGoalPct: 0, fatGoalPct: 0, hydGoalPct: 0,
  insight: "",
};

export function NutritionAnalytics({ userId, targets, today }: Props) {
  const [open,    setOpen]    = useState(false);
  const [range,   setRange]   = useState<Range>("7D");
  const [summary, setSummary] = useState<AnalyticsSummary>(EMPTY_SUMMARY);

  useEffect(() => {
    const days  = RANGE_DAYS[range];
    const start = offsetDate(today, -(days - 1));
    computeNutritionAnalytics(userId, start, today, targets).then(setSummary);
  }, [userId, targets, today, range]);

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#111111] overflow-hidden">
      {/* Header toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4"
      >
        <div className="flex items-center gap-2.5">
          <TrendingUp className="w-4 h-4 text-[#B48B40]/60" strokeWidth={1.5} />
          <span className="text-sm font-semibold text-white/70 tracking-tight">Analytics & Trends</span>
          {summary.streak >= 3 && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-emerald-400/8 border border-emerald-400/12 text-emerald-400/70">
              🔥 {summary.streak}d
            </span>
          )}
        </div>
        {open
          ? <ChevronUp   className="w-4 h-4 text-white/20" strokeWidth={1.5} />
          : <ChevronDown className="w-4 h-4 text-white/20" strokeWidth={1.5} />}
      </button>

      {open && (
        <div className="border-t border-white/[0.05] px-5 pb-6 pt-4 space-y-6">
          {/* Range selector */}
          <div className="flex gap-1.5">
            {(["7D", "30D"] as Range[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-medium transition-all",
                  r === range
                    ? "bg-[#B48B40]/15 border border-[#B48B40]/30 text-[#B48B40]"
                    : "border border-white/[0.07] text-white/35 hover:text-white/60 hover:border-white/15",
                )}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Calorie trend */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Flame className="w-3.5 h-3.5 text-[#B48B40]/55" strokeWidth={1.5} />
                <span className="text-[11px] uppercase tracking-[0.16em] text-white/25 font-medium">Calorie trend</span>
              </div>
              <span className="text-xs tabular-nums text-white/35">
                avg {Math.round(summary.avgCalories).toLocaleString()}
                <span className="text-white/20"> / {targets.calories.toLocaleString()}</span>
              </span>
            </div>
            <CalorieSpark days={summary.days} target={targets.calories} />
          </div>

          {/* Macro adherence */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-3.5 h-3.5 text-white/30" strokeWidth={1.5} />
              <span className="text-[11px] uppercase tracking-[0.16em] text-white/25 font-medium">Avg macro adherence</span>
            </div>
            <div className="space-y-2.5">
              <AdherenceBar label="Protein" value={summary.avgProtein} target={targets.proteinG} color="bg-[#B48B40]/70" />
              <AdherenceBar label="Carbs"   value={summary.avgCarbs}   target={targets.carbsG}   color="bg-white/40" />
              <AdherenceBar label="Fat"     value={summary.avgFat}     target={targets.fatG}     color="bg-[#93C5FD]/60" />
            </div>
          </div>

          {/* Hydration trend */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Droplets className="w-3.5 h-3.5 text-[#93C5FD]/55" strokeWidth={1.5} />
                <span className="text-[11px] uppercase tracking-[0.16em] text-white/25 font-medium">Hydration</span>
              </div>
              <span className="text-xs tabular-nums text-white/35">
                avg {(summary.avgHydration / 1000).toFixed(1)}L
                <span className="text-white/20"> / {(targets.waterMl / 1000).toFixed(1)}L</span>
              </span>
            </div>
            <HydrationBars days={summary.days} target={targets.waterMl} />
          </div>

          {/* Consistency + streak */}
          <div className="flex items-center gap-5 rounded-2xl border border-white/[0.06] bg-white/[0.015] px-4 py-4">
            <ConsistencyRing logged={summary.daysLogged} total={summary.totalDays} />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/22 mb-1">Consistency</p>
              <p className="text-xl font-semibold tabular-nums text-white/80 leading-none">
                {summary.daysLogged}
                <span className="text-sm text-white/30 font-normal"> / {summary.totalDays} days</span>
              </p>
              {summary.streak > 0 && (
                <p className="text-[11px] text-emerald-400/65 mt-1">{summary.streak}-day current streak</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-xl font-semibold tabular-nums text-white/80">
                {Math.round(summary.daysLogged / summary.totalDays * 100)}%
              </p>
              <p className="text-[10px] text-white/25 mt-0.5">logged</p>
            </div>
          </div>

          {/* AI insight */}
          {summary.insight && (
            <div className="rounded-xl border border-[#B48B40]/12 bg-[#B48B40]/[0.04] px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-[#B48B40]/50 mb-1.5 font-medium">◈ Insight</p>
              <p className="text-sm text-white/55 leading-relaxed">{summary.insight}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
