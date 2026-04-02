"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  TrendingUp,
  AlertTriangle,
  Clock,
  ChevronRight,
  Star,
  ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type TrainerFilter = "all" | "high-performers" | "low-retention" | "slow-response" | "high-churn";

type TrainerRow = {
  id: string;
  name: string;
  email: string;
  status: "active" | "paused";
  joinDate: string;
  activeClients: number;
  totalClients: number;
  retentionRate: number;
  avgAdherence: number;
  atRiskClients: number;
  avgResponseTime: string;
  responseMinutes: number;
  feedbackScore: number;
  overdueReviews: number;
};

// ─── Mock data ────────────────────────────────────────────────────────────────

const TRAINERS: TrainerRow[] = [
  {
    id: "u4",
    name: "Alex Rivera",
    email: "alex@domain.com",
    status: "active",
    joinDate: "Oct 2024",
    activeClients: 4,
    totalClients: 6,
    retentionRate: 83,
    avgAdherence: 87,
    atRiskClients: 1,
    avgResponseTime: "< 1h",
    responseMinutes: 45,
    feedbackScore: 4.8,
    overdueReviews: 0,
  },
  {
    id: "u3",
    name: "Marcus Webb",
    email: "marcus@domain.com",
    status: "active",
    joinDate: "Nov 2024",
    activeClients: 2,
    totalClients: 4,
    retentionRate: 71,
    avgAdherence: 74,
    atRiskClients: 1,
    avgResponseTime: "3–5h",
    responseMinutes: 240,
    feedbackScore: 3.9,
    overdueReviews: 2,
  },
];

// ─── Filter config ─────────────────────────────────────────────────────────────

const FILTERS: { id: TrainerFilter; label: string }[] = [
  { id: "all",             label: "All trainers"    },
  { id: "high-performers", label: "High performers" },
  { id: "low-retention",   label: "Low retention"   },
  { id: "slow-response",   label: "Slow response"   },
  { id: "high-churn",      label: "High churn risk" },
];

function matchesFilter(t: TrainerRow, f: TrainerFilter): boolean {
  if (f === "all")             return true;
  if (f === "high-performers") return t.retentionRate >= 80 && t.avgAdherence >= 80;
  if (f === "low-retention")   return t.retentionRate < 75;
  if (f === "slow-response")   return t.responseMinutes > 120;
  if (f === "high-churn")      return t.atRiskClients > 0 || t.retentionRate < 70;
  return true;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = false,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  accent?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-2xl border bg-[#111111] px-5 py-4 flex flex-col gap-2.5",
      accent ? "border-[#B48B40]/22" : "border-white/6"
    )}>
      <div className="w-8 h-8 rounded-xl border border-white/6 bg-white/[0.03] flex items-center justify-center">
        <Icon className="w-4 h-4 text-white/38" strokeWidth={1.5} />
      </div>
      <div>
        <p className="text-2xl font-semibold tracking-tight text-white/90">{value}</p>
        <p className="text-xs text-white/30 mt-0.5">{label}</p>
        {sub && <p className="text-[10px] text-white/20 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function FeedbackStars({ score }: { score: number }) {
  const full = Math.floor(score);
  const frac = score - full;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(
            "w-3 h-3",
            i <= full
              ? "text-[#B48B40] fill-[#B48B40]"
              : i === full + 1 && frac >= 0.5
              ? "text-[#B48B40]/50 fill-[#B48B40]/50"
              : "text-white/12"
          )}
          strokeWidth={0}
        />
      ))}
      <span className="text-[10px] text-white/38 ml-1 tabular-nums">{score.toFixed(1)}</span>
    </div>
  );
}

function PctBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1 rounded-full bg-white/6 overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs tabular-nums text-white/55">{value}%</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TrainersPage() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<TrainerFilter>("all");

  const filtered = TRAINERS.filter((t) => matchesFilter(t, activeFilter));

  const avgRetention  = Math.round(TRAINERS.reduce((s, t) => s + t.retentionRate, 0) / TRAINERS.length);
  const avgAdherence  = Math.round(TRAINERS.reduce((s, t) => s + t.avgAdherence,  0) / TRAINERS.length);
  const totalAtRisk   = TRAINERS.reduce((s, t) => s + t.atRiskClients, 0);
  const activeCount   = TRAINERS.filter((t) => t.status === "active").length;

  return (
    <div className="px-5 md:px-8 py-6 text-white space-y-6">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.22em] text-white/22 mb-1.5">Admin · Trainers</p>
        <h1 className="text-2xl font-semibold tracking-tight">Trainer Performance</h1>
        <p className="text-sm text-white/30 mt-1">Business visibility and operational health across all trainers.</p>
      </div>

      {/* ── KPI row ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Active trainers"
          value={`${activeCount}`}
          sub={`${TRAINERS.length} total`}
          icon={Users}
          accent
        />
        <KpiCard
          label="Avg retention"
          value={`${avgRetention}%`}
          sub="across all trainers"
          icon={TrendingUp}
        />
        <KpiCard
          label="Avg adherence"
          value={`${avgAdherence}%`}
          sub="client average"
          icon={ArrowUpRight}
        />
        <KpiCard
          label="At-risk clients"
          value={`${totalAtRisk}`}
          sub="needs attention"
          icon={AlertTriangle}
        />
      </div>

      {/* ── Filters ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setActiveFilter(f.id)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-[11px] font-medium tracking-[0.04em] transition-all",
              activeFilter === f.id
                ? "bg-white/8 text-white/80 border border-white/12"
                : "text-white/30 hover:text-white/55 border border-transparent"
            )}
          >
            {f.label}
          </button>
        ))}
        {activeFilter !== "all" && (
          <span className="text-[10px] text-white/25 ml-1">
            {filtered.length} of {TRAINERS.length}
          </span>
        )}
      </div>

      {/* ── Trainer table ───────────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/6 bg-[#111111] overflow-hidden">

        {/* Column headers */}
        <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-4 px-5 py-3 border-b border-white/[0.05]">
          {["Trainer", "Active clients", "Retention", "Adherence", "At-risk", "Response time"].map((col) => (
            <p key={col} className="text-[10px] uppercase tracking-[0.14em] text-white/22">{col}</p>
          ))}
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/22 w-20">Feedback</p>
        </div>

        {/* Rows */}
        <div className="divide-y divide-white/[0.04]">
          {filtered.map((t) => {
            const initials = t.name.split(" ").map((n) => n[0]).join("").toUpperCase();
            const isSlowResponse = t.responseMinutes > 120;
            const hasAtRisk = t.atRiskClients > 0;
            const hasOverdue = t.overdueReviews > 0;

            return (
              <button
                key={t.id}
                onClick={() => router.push(`/trainers/${t.id}`)}
                className="w-full text-left grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-2 md:gap-4 items-center px-5 py-4 hover:bg-white/[0.018] transition-colors group"
              >
                {/* Name */}
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#1C1C1C] border border-white/8 flex items-center justify-center shrink-0">
                    <span className="text-[11px] font-semibold text-white/45">{initials}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white/85 group-hover:text-white/95 transition-colors">{t.name}</p>
                      {hasOverdue && (
                        <span className="text-[9px] font-semibold uppercase tracking-wider text-amber-400 border border-amber-400/25 bg-amber-400/8 rounded px-1.5 py-0.5">
                          {t.overdueReviews} overdue
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-white/28 truncate">{t.email}</p>
                  </div>
                </div>

                {/* Active clients */}
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-white/80 tabular-nums">{t.activeClients}</span>
                  <span className="text-[10px] text-white/28">{t.totalClients} total</span>
                </div>

                {/* Retention */}
                <PctBar
                  value={t.retentionRate}
                  color={t.retentionRate >= 80 ? "bg-emerald-400/70" : t.retentionRate >= 70 ? "bg-amber-400/70" : "bg-[#F87171]/70"}
                />

                {/* Adherence */}
                <PctBar
                  value={t.avgAdherence}
                  color={t.avgAdherence >= 80 ? "bg-[#93C5FD]/70" : t.avgAdherence >= 70 ? "bg-amber-400/70" : "bg-[#F87171]/70"}
                />

                {/* At-risk */}
                <span className={cn(
                  "text-xs font-semibold tabular-nums",
                  hasAtRisk ? "text-amber-400" : "text-white/28"
                )}>
                  {t.atRiskClients > 0 ? t.atRiskClients : "—"}
                </span>

                {/* Response time */}
                <div className="flex items-center gap-1.5">
                  <Clock className={cn("w-3 h-3 shrink-0", isSlowResponse ? "text-[#F87171]" : "text-white/25")} strokeWidth={1.5} />
                  <span className={cn("text-xs tabular-nums", isSlowResponse ? "text-[#F87171]" : "text-white/45")}>
                    {t.avgResponseTime}
                  </span>
                </div>

                {/* Feedback + chevron */}
                <div className="flex items-center justify-between gap-3 w-20">
                  <FeedbackStars score={t.feedbackScore} />
                  <ChevronRight className="w-3.5 h-3.5 text-white/15 group-hover:text-white/35 transition-colors shrink-0" strokeWidth={1.5} />
                </div>
              </button>
            );
          })}

          {filtered.length === 0 && (
            <div className="px-5 py-12 text-center">
              <p className="text-sm text-white/25">No trainers match this filter.</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
