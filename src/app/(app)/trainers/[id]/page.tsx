"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Users,
  TrendingUp,
  TrendingDown,
  Clock,
  MessageSquare,
  Star,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
  DollarSign,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  Minus,
  Flag,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type ClientStatus = "active" | "at-risk" | "paused" | "churned";

type TrainerClient = {
  id: string;
  name: string;
  status: ClientStatus;
  adherence: number;
  lastActive: string;
  plan: "pro" | "elite";
  program: string;
  checkInCompletion: number;
  executionScore: number;
};

type TrainerDetail = {
  id: string;
  name: string;
  email: string;
  status: "active" | "paused";
  joinDate: string;
  // Client metrics
  totalClients: number;
  activeClients: number;
  pausedClients: number;
  churnedClients: number;
  retentionRate: number;
  avgAdherence: number;
  avgExecutionScore: number;
  avgCheckInCompletion: number;
  atRiskClients: number;
  // Program metrics
  programAssignments: number;
  activeProgramCount: number;
  overdueReviews: number;
  // Engagement
  avgResponseTime: string;
  responseMinutes: number;
  messageCount: number;
  feedbackScore: number;
  upgradeCount: number;
  revenueGenerated: number;
  // Chart data
  adherenceTrend: number[];
  retentionTrend: number[];
  // Clients
  clients: TrainerClient[];
};

// ─── Mock data ────────────────────────────────────────────────────────────────

const TRAINER_DATA: Record<string, TrainerDetail> = {
  u4: {
    id: "u4",
    name: "Alex Rivera",
    email: "alex@domain.com",
    status: "active",
    joinDate: "Oct 2024",
    totalClients: 6,
    activeClients: 4,
    pausedClients: 1,
    churnedClients: 1,
    retentionRate: 83,
    avgAdherence: 87,
    avgExecutionScore: 81,
    avgCheckInCompletion: 92,
    atRiskClients: 1,
    programAssignments: 5,
    activeProgramCount: 4,
    overdueReviews: 0,
    avgResponseTime: "< 1h",
    responseMinutes: 45,
    messageCount: 142,
    feedbackScore: 4.8,
    upgradeCount: 2,
    revenueGenerated: 4200,
    adherenceTrend: [78, 80, 82, 84, 85, 86, 87],
    retentionTrend: [75, 78, 80, 80, 82, 83, 83],
    clients: [
      { id: "u1",  name: "Kai Nakamura",  status: "active",   adherence: 91, lastActive: "2m ago",   plan: "elite", program: "Hypertrophy Block 3",  checkInCompletion: 95, executionScore: 88 },
      { id: "u2",  name: "Priya Sharma",  status: "active",   adherence: 88, lastActive: "14m ago",  plan: "elite", program: "Strength Foundation",  checkInCompletion: 92, executionScore: 84 },
      { id: "u7",  name: "Sofia Reyes",   status: "active",   adherence: 85, lastActive: "22h ago",  plan: "elite", program: "Athletic Performance", checkInCompletion: 90, executionScore: 80 },
      { id: "u11", name: "Claire Dubois", status: "at-risk",  adherence: 62, lastActive: "5d ago",   plan: "pro",   program: "Strength Foundation",  checkInCompletion: 68, executionScore: 58 },
      { id: "u13", name: "Tomas Vidal",   status: "paused",   adherence: 0,  lastActive: "12d ago",  plan: "pro",   program: "Unassigned",           checkInCompletion: 40, executionScore: 0  },
      { id: "u14", name: "Nadia Okonkwo", status: "churned",  adherence: 0,  lastActive: "45d ago",  plan: "pro",   program: "Unassigned",           checkInCompletion: 22, executionScore: 0  },
    ],
  },
  u3: {
    id: "u3",
    name: "Marcus Webb",
    email: "marcus@domain.com",
    status: "active",
    joinDate: "Nov 2024",
    totalClients: 4,
    activeClients: 2,
    pausedClients: 1,
    churnedClients: 1,
    retentionRate: 71,
    avgAdherence: 74,
    avgExecutionScore: 68,
    avgCheckInCompletion: 78,
    atRiskClients: 1,
    programAssignments: 3,
    activeProgramCount: 2,
    overdueReviews: 2,
    avgResponseTime: "3–5h",
    responseMinutes: 240,
    messageCount: 67,
    feedbackScore: 3.9,
    upgradeCount: 0,
    revenueGenerated: 1800,
    adherenceTrend: [80, 77, 75, 72, 74, 73, 74],
    retentionTrend: [82, 80, 78, 74, 72, 71, 71],
    clients: [
      { id: "u5",  name: "Anya Patel",   status: "at-risk", adherence: 61, lastActive: "4d ago",   plan: "pro",   program: "General Fitness Block", checkInCompletion: 70, executionScore: 60 },
      { id: "u9",  name: "Hana Suzuki",  status: "paused",  adherence: 0,  lastActive: "8d ago",   plan: "pro",   program: "Unassigned",            checkInCompletion: 55, executionScore: 0  },
      { id: "u15", name: "Brett Nguyen", status: "active",  adherence: 87, lastActive: "1d ago",   plan: "elite", program: "Strength Foundation",   checkInCompletion: 86, executionScore: 76 },
      { id: "u16", name: "Leila Amara",  status: "churned", adherence: 0,  lastActive: "38d ago",  plan: "pro",   program: "Unassigned",            checkInCompletion: 30, executionScore: 0  },
    ],
  },
};

// ─── Config maps ──────────────────────────────────────────────────────────────

const STATUS_CFG: Record<ClientStatus, { label: string; dot: string; badge: string }> = {
  active:    { label: "Active",   dot: "bg-emerald-400",   badge: "text-emerald-400 border-emerald-400/20 bg-emerald-400/8"  },
  "at-risk": { label: "At risk",  dot: "bg-amber-400",     badge: "text-amber-400 border-amber-400/20 bg-amber-400/8"        },
  paused:    { label: "Paused",   dot: "bg-white/30",      badge: "text-white/40 border-white/12 bg-white/[0.04]"            },
  churned:   { label: "Churned",  dot: "bg-[#F87171]",     badge: "text-[#F87171] border-[#F87171]/20 bg-[#F87171]/8"        },
};

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ points, color = "#B48B40", height = 40 }: { points: number[]; color?: string; height?: number }) {
  const w = 200;
  const h = height;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = w / (points.length - 1);
  const coords = points.map((p, i) => [i * step, h - ((p - min) / range) * (h - 6) - 3]);
  const pathD = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const areaD = `${pathD} L ${coords[coords.length - 1][0].toFixed(1)} ${h} L 0 ${h} Z`;
  const gradId = `grad-trainer-${color.replace("#", "")}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${gradId})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={coords[coords.length - 1][0]} cy={coords[coords.length - 1][1]} r="2.5" fill={color} />
    </svg>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  delta,
  icon: Icon,
  accent = false,
  chart,
}: {
  label: string;
  value: string;
  sub?: string;
  delta?: number;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  accent?: boolean;
  chart?: React.ReactNode;
}) {
  const up = delta !== undefined && delta > 0;
  const dn = delta !== undefined && delta < 0;

  return (
    <div className={cn(
      "rounded-2xl border bg-[#111111] px-5 py-4 flex flex-col gap-3 overflow-hidden",
      accent ? "border-[#B48B40]/22" : "border-white/6"
    )}>
      <div className="flex items-start justify-between">
        <div className="w-8 h-8 rounded-xl border border-white/6 bg-white/[0.03] flex items-center justify-center">
          <Icon className="w-4 h-4 text-white/38" strokeWidth={1.5} />
        </div>
        {delta !== undefined && (
          <div className={cn(
            "flex items-center gap-1 text-[10px] font-semibold rounded-md px-1.5 py-0.5 border",
            up ? "text-emerald-400 border-emerald-400/18 bg-emerald-400/6"
              : dn ? "text-[#F87171] border-[#F87171]/18 bg-[#F87171]/6"
              : "text-white/30 border-white/10 bg-white/[0.03]"
          )}>
            {up ? <ChevronUp className="w-2.5 h-2.5" strokeWidth={2.5} />
               : dn ? <ChevronDown className="w-2.5 h-2.5" strokeWidth={2.5} />
               : <Minus className="w-2.5 h-2.5" strokeWidth={2.5} />}
            {Math.abs(delta)}%
          </div>
        )}
      </div>
      <div>
        <p className="text-2xl font-semibold tracking-tight text-white/90">{value}</p>
        <p className="text-xs text-white/30 mt-0.5">{label}</p>
        {sub && <p className="text-[10px] text-white/20 mt-0.5">{sub}</p>}
      </div>
      {chart && <div className="mt-auto -mx-1">{chart}</div>}
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
            "w-3.5 h-3.5",
            i <= full
              ? "text-[#B48B40] fill-[#B48B40]"
              : i === full + 1 && frac >= 0.5
              ? "text-[#B48B40]/50 fill-[#B48B40]/50"
              : "text-white/12"
          )}
          strokeWidth={0}
        />
      ))}
      <span className="text-sm font-semibold text-white/70 ml-1.5 tabular-nums">{score.toFixed(1)}</span>
    </div>
  );
}

function PctBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex-1 h-1 rounded-full bg-white/6 overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs tabular-nums text-white/55 w-9 text-right">{value}%</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TrainerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const trainer = TRAINER_DATA[id];

  if (!trainer) {
    return (
      <div className="px-5 md:px-8 py-6 text-white">
        <button
          onClick={() => router.push("/trainers")}
          className="flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} /> Back to Trainers
        </button>
        <p className="text-sm text-white/30">Trainer not found.</p>
      </div>
    );
  }

  const retentionDelta = trainer.retentionTrend[trainer.retentionTrend.length - 1] - trainer.retentionTrend[0];
  const adherenceDelta = trainer.adherenceTrend[trainer.adherenceTrend.length - 1] - trainer.adherenceTrend[0];
  const isSlowResponse = trainer.responseMinutes > 120;
  const hasFlags = trainer.overdueReviews > 0 || trainer.atRiskClients > 0;

  const initials = trainer.name.split(" ").map((n) => n[0]).join("").toUpperCase();

  return (
    <div className="px-5 md:px-8 py-6 text-white space-y-6">

      {/* ── Back + Header ────────────────────────────────────────────── */}
      <div>
        <button
          onClick={() => router.push("/trainers")}
          className="flex items-center gap-2 text-sm text-white/35 hover:text-white/65 transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
          Trainers
        </button>

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#1C1C1C] border border-white/8 flex items-center justify-center shrink-0">
              <span className="text-sm font-semibold text-white/45">{initials}</span>
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-semibold tracking-tight">{trainer.name}</h1>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#B48B40] border border-[#B48B40]/25 bg-[#B48B40]/8 rounded px-1.5 py-0.5">
                  Trainer
                </span>
                {hasFlags && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400 border border-amber-400/25 bg-amber-400/8 rounded px-1.5 py-0.5 flex items-center gap-1">
                    <Flag className="w-2.5 h-2.5" strokeWidth={2} />
                    Needs review
                  </span>
                )}
              </div>
              <p className="text-sm text-white/35 mt-0.5">{trainer.email} · Joined {trainer.joinDate}</p>
            </div>
          </div>

          {/* Quick actions */}
          <div className="flex items-center gap-2 shrink-0 mt-1">
            <button className="flex items-center gap-1.5 rounded-xl border border-white/8 bg-white/[0.02] px-3.5 py-2 text-xs font-medium text-white/55 hover:bg-white/[0.05] hover:text-white/75 transition-all">
              <MessageSquare className="w-3.5 h-3.5" strokeWidth={1.5} />
              Message
            </button>
            <button className="flex items-center gap-1.5 rounded-xl border border-white/8 bg-white/[0.02] px-3.5 py-2 text-xs font-medium text-white/55 hover:bg-white/[0.05] hover:text-white/75 transition-all">
              <Users className="w-3.5 h-3.5" strokeWidth={1.5} />
              Client list
            </button>
            {hasFlags && (
              <button className="flex items-center gap-1.5 rounded-xl border border-amber-400/25 bg-amber-400/6 px-3.5 py-2 text-xs font-medium text-amber-400 hover:bg-amber-400/10 transition-all">
                <AlertTriangle className="w-3.5 h-3.5" strokeWidth={1.5} />
                View flagged
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── KPI grid ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        <KpiCard label="Total clients"   value={`${trainer.totalClients}`}           sub={`${trainer.activeClients} active`}      icon={Users}         accent />
        <KpiCard label="Active"          value={`${trainer.activeClients}`}           sub="currently engaged"                      icon={CheckCircle2}        />
        <KpiCard label="Paused"          value={`${trainer.pausedClients}`}           sub="on hold"                                icon={Minus}               />
        <KpiCard label="Churned"         value={`${trainer.churnedClients}`}          sub="lost clients"                           icon={TrendingDown}        />
        <KpiCard label="Retention"       value={`${trainer.retentionRate}%`}          delta={retentionDelta}                       icon={TrendingUp}
          chart={<Sparkline points={trainer.retentionTrend} color={retentionDelta >= 0 ? "#4ADE80" : "#F87171"} height={30} />}
        />
        <KpiCard label="Avg adherence"   value={`${trainer.avgAdherence}%`}           delta={adherenceDelta}                       icon={RefreshCw}
          chart={<Sparkline points={trainer.adherenceTrend} color={adherenceDelta >= 0 ? "#93C5FD" : "#F87171"} height={30} />}
        />
        <KpiCard label="Execution score" value={`${trainer.avgExecutionScore}`}       sub="client average"                         icon={TrendingUp}          />
        <KpiCard label="Check-in rate"   value={`${trainer.avgCheckInCompletion}%`}   sub="avg completion"                         icon={Calendar}            />
      </div>

      {/* ── Middle row ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Programs */}
        <div className="rounded-2xl border border-white/6 bg-[#111111] px-6 py-5 space-y-5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/22 mb-1">Programs</p>
            <p className="text-base font-semibold text-white/88">Assignments & coverage</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Total assigned",  value: trainer.programAssignments },
              { label: "Active programs", value: trainer.activeProgramCount },
              { label: "Overdue reviews", value: trainer.overdueReviews,  flag: trainer.overdueReviews > 0 },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-white/5 bg-white/[0.02] px-3.5 py-3">
                <p className={cn("text-xl font-semibold tabular-nums", s.flag ? "text-amber-400" : "text-white/85")}>
                  {s.value}
                </p>
                <p className="text-[10px] text-white/28 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-white/5 space-y-2.5">
            <p className="text-[10px] uppercase tracking-[0.15em] text-white/22 mb-3">Client breakdown</p>
            {[
              { label: "Active",  count: trainer.activeClients,  color: "bg-emerald-400/70",    pct: Math.round((trainer.activeClients  / trainer.totalClients) * 100) },
              { label: "Paused",  count: trainer.pausedClients,  color: "bg-white/20",          pct: Math.round((trainer.pausedClients  / trainer.totalClients) * 100) },
              { label: "Churned", count: trainer.churnedClients, color: "bg-[#F87171]/60",      pct: Math.round((trainer.churnedClients / trainer.totalClients) * 100) },
            ].map((row) => (
              <div key={row.label} className="flex items-center gap-3">
                <span className="text-xs text-white/40 w-14">{row.label}</span>
                <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
                  <div className={cn("h-full rounded-full", row.color)} style={{ width: `${row.pct}%` }} />
                </div>
                <span className="text-[10px] text-white/28 tabular-nums w-8 text-right">{row.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Engagement & revenue */}
        <div className="rounded-2xl border border-white/6 bg-[#111111] px-6 py-5 space-y-5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/22 mb-1">Engagement</p>
            <p className="text-base font-semibold text-white/88">Response & revenue</p>
          </div>

          <div className="space-y-4">
            {/* Response time */}
            <div className="flex items-start justify-between pb-4 border-b border-white/[0.05]">
              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-white/22 mb-1">Avg response time</p>
                <div className="flex items-center gap-2">
                  <Clock className={cn("w-4 h-4", isSlowResponse ? "text-[#F87171]" : "text-white/35")} strokeWidth={1.5} />
                  <span className={cn("text-lg font-semibold", isSlowResponse ? "text-[#F87171]" : "text-white/80")}>
                    {trainer.avgResponseTime}
                  </span>
                  {isSlowResponse && (
                    <span className="text-[10px] text-[#F87171] border border-[#F87171]/25 bg-[#F87171]/8 rounded px-1.5 py-0.5">
                      Needs improvement
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-[0.14em] text-white/22 mb-1">Messages sent</p>
                <div className="flex items-center gap-1.5 justify-end">
                  <MessageSquare className="w-3.5 h-3.5 text-white/30" strokeWidth={1.5} />
                  <span className="text-lg font-semibold text-white/80 tabular-nums">{trainer.messageCount}</span>
                </div>
              </div>
            </div>

            {/* Feedback */}
            <div className="flex items-start justify-between pb-4 border-b border-white/[0.05]">
              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-white/22 mb-1.5">Client feedback</p>
                <FeedbackStars score={trainer.feedbackScore} />
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-[0.14em] text-white/22 mb-1">Upgrades driven</p>
                <p className="text-lg font-semibold text-white/80 tabular-nums">{trainer.upgradeCount}</p>
              </div>
            </div>

            {/* Revenue */}
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] text-white/22 mb-1">Revenue generated</p>
              <p className="text-2xl font-semibold text-[#B48B40] tabular-nums">
                ${trainer.revenueGenerated.toLocaleString()}
              </p>
              <p className="text-[10px] text-white/20 mt-0.5">estimated client lifetime contribution</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Flags / alerts ────────────────────────────────────────────── */}
      {hasFlags && (
        <div className="rounded-2xl border border-amber-400/14 bg-amber-400/[0.03] px-5 py-4">
          <p className="text-[10px] uppercase tracking-[0.18em] text-amber-400/60 mb-3">Flags</p>
          <div className="space-y-2">
            {trainer.atRiskClients > 0 && (
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" strokeWidth={1.5} />
                <p className="text-sm text-white/60">
                  <span className="text-amber-400 font-semibold">{trainer.atRiskClients} client{trainer.atRiskClients > 1 ? "s" : ""}</span> flagged as at-risk — follow-up recommended
                </p>
              </div>
            )}
            {trainer.overdueReviews > 0 && (
              <div className="flex items-center gap-2.5">
                <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" strokeWidth={1.5} />
                <p className="text-sm text-white/60">
                  <span className="text-amber-400 font-semibold">{trainer.overdueReviews} check-in review{trainer.overdueReviews > 1 ? "s" : ""}</span> overdue — action needed
                </p>
              </div>
            )}
            {isSlowResponse && (
              <div className="flex items-center gap-2.5">
                <Clock className="w-3.5 h-3.5 text-[#F87171] shrink-0" strokeWidth={1.5} />
                <p className="text-sm text-white/60">
                  Response time averaging <span className="text-[#F87171] font-semibold">{trainer.avgResponseTime}</span> — below platform standard
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Client roster ────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/6 bg-[#111111] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.05]">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/22">Client roster</p>
          <p className="text-sm font-medium text-white/70 mt-0.5">{trainer.clients.length} assigned</p>
        </div>

        {/* Column headers */}
        <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-4 px-5 py-2.5 border-b border-white/[0.04]">
          {["Client", "Status", "Adherence", "Execution", "Check-ins", "Last active"].map((col) => (
            <p key={col} className="text-[10px] uppercase tracking-[0.14em] text-white/22">{col}</p>
          ))}
        </div>

        <div className="divide-y divide-white/[0.04]">
          {trainer.clients.map((c) => {
            const sc = STATUS_CFG[c.status];
            const initials = c.name.split(" ").map((n) => n[0]).join("").toUpperCase();
            const isInactive = c.status === "paused" || c.status === "churned";

            return (
              <div
                key={c.id}
                className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-2 md:gap-4 items-center px-5 py-3.5"
              >
                {/* Name */}
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-full border flex items-center justify-center shrink-0",
                    isInactive ? "bg-[#1A1A1A] border-white/5" : "bg-[#1C1C1C] border-white/8"
                  )}>
                    <span className={cn("text-[10px] font-semibold", isInactive ? "text-white/25" : "text-white/45")}>{initials}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className={cn("text-sm font-medium", isInactive ? "text-white/40" : "text-white/80")}>{c.name}</p>
                      <span className={cn("text-[9px] font-semibold uppercase tracking-wider", c.plan === "elite" ? "text-[#B48B40]" : "text-white/28")}>
                        {c.plan}
                      </span>
                    </div>
                    <p className="text-[10px] text-white/28 truncate">{c.program}</p>
                  </div>
                </div>

                {/* Status */}
                <div className="flex items-center gap-1.5">
                  <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", sc.dot)} />
                  <span className={cn("text-[10px] font-medium tracking-[0.06em] uppercase px-1.5 py-0.5 rounded-md border", sc.badge)}>
                    {sc.label}
                  </span>
                </div>

                {/* Adherence */}
                {isInactive ? (
                  <span className="text-xs text-white/18">—</span>
                ) : (
                  <PctBar
                    value={c.adherence}
                    color={c.adherence >= 80 ? "bg-emerald-400/70" : c.adherence >= 65 ? "bg-amber-400/70" : "bg-[#F87171]/70"}
                  />
                )}

                {/* Execution score */}
                <span className={cn(
                  "text-sm font-semibold tabular-nums",
                  isInactive ? "text-white/18"
                    : c.executionScore >= 80 ? "text-emerald-400"
                    : c.executionScore >= 65 ? "text-amber-400"
                    : "text-[#F87171]"
                )}>
                  {isInactive ? "—" : c.executionScore}
                </span>

                {/* Check-in rate */}
                <span className={cn(
                  "text-xs tabular-nums",
                  isInactive ? "text-white/18" : "text-white/55"
                )}>
                  {isInactive ? "—" : `${c.checkInCompletion}%`}
                </span>

                {/* Last active */}
                <span className="text-xs text-white/28 tabular-nums">{c.lastActive}</span>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
