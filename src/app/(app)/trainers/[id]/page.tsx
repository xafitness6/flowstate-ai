"use client";

import { use, useState, useEffect } from "react";
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
  DollarSign,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  Minus,
  Flag,
  Calendar,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/context/UserContext";
import {
  initStore,
  getTrainers,
  getTrainerMetrics,
  getClients,
  getClientTrainingData,
  deleteUser,
  type PlatformUser,
  type TrainerMetrics,
  type ClientTrainingData,
  PermissionError,
} from "@/lib/data/store";

// ─── Types ────────────────────────────────────────────────────────────────────

type ClientRow = PlatformUser & ClientTrainingData;

type TrainerData = PlatformUser & { metrics: TrainerMetrics };

// ─── Config maps ──────────────────────────────────────────────────────────────

const STATUS_CFG = {
  active:    { label: "Active",   dot: "bg-emerald-400",   badge: "text-emerald-400 border-emerald-400/20 bg-emerald-400/8"  },
  "at-risk": { label: "At risk",  dot: "bg-amber-400",     badge: "text-amber-400 border-amber-400/20 bg-amber-400/8"        },
  paused:    { label: "Paused",   dot: "bg-white/30",      badge: "text-white/40 border-white/12 bg-white/[0.04]"            },
  churned:   { label: "Churned",  dot: "bg-[#F87171]",     badge: "text-[#F87171] border-[#F87171]/20 bg-[#F87171]/8"        },
  trial:     { label: "Trial",    dot: "bg-blue-400",      badge: "text-blue-400 border-blue-400/20 bg-blue-400/8"           },
} as const;

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
  label, value, sub, delta, icon: Icon, accent = false, chart,
}: {
  label: string; value: string; sub?: string; delta?: number;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  accent?: boolean; chart?: React.ReactNode;
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
  const router  = useRouter();
  const { user } = useUser();

  const [trainer,  setTrainer ] = useState<TrainerData | null | undefined>(undefined); // undefined = loading
  const [clients,  setClients ] = useState<ClientRow[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error,    setError   ] = useState<string | null>(null);

  const isMaster  = user.role === "master";
  const isTrainer = user.role === "trainer";

  useEffect(() => {
    initStore();
    try {
      // Ownership guard: trainers can only view their own detail page
      if (isTrainer && id !== user.id) {
        router.replace("/trainers");
        return;
      }

      const trainers = getTrainers(user.role, user.id);
      const found    = trainers.find((t) => t.id === id);
      if (!found) { setTrainer(null); return; }

      const metrics  = getTrainerMetrics(id);
      if (!metrics)  { setTrainer(null); return; }

      setTrainer({ ...found, metrics });

      // Load clients visible to this actor (master → all clients of this trainer, trainer → their own)
      const allClients = getClients(user.role, user.id).filter((c) => c.trainerId === id);
      const rows: ClientRow[] = allClients.map((c) => ({
        ...c,
        ...getClientTrainingData(c.id),
      }));
      setClients(rows);
    } catch (e) {
      if (e instanceof PermissionError) router.replace("/");
    }
  }, [id, user.role, user.id, isTrainer, router]);

  async function handleDeleteClient(clientId: string) {
    if (!confirm("Remove this client? This action cannot be undone.")) return;
    setDeleting(clientId);
    setError(null);
    try {
      const target = clients.find((c) => c.id === clientId);
      const res = await fetch(`/api/users/${clientId}`, {
        method:  "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-actor-role": user.role,
          "x-actor-id":   user.id,
        },
        body: JSON.stringify({
          targetRole:      target?.role ?? "client",
          targetTrainerId: target?.trainerId,
        }),
      });
      if (!res.ok) {
        const j = await res.json() as { error?: string };
        setError(j.error ?? "Delete failed");
        setDeleting(null);
        return;
      }
      deleteUser(clientId, user.role, user.id);
      setClients((prev) => prev.filter((c) => c.id !== clientId));
      // Refresh trainer metrics after client deletion
      const metrics = getTrainerMetrics(id);
      if (metrics && trainer) setTrainer({ ...trainer, metrics });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(null);
    }
  }

  // Loading state
  if (trainer === undefined) return null;

  // Not found
  if (trainer === null) {
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

  const { metrics } = trainer;
  const retentionDelta  = metrics.retentionTrend[metrics.retentionTrend.length - 1] - metrics.retentionTrend[0];
  const adherenceDelta  = metrics.adherenceTrend[metrics.adherenceTrend.length - 1] - metrics.adherenceTrend[0];
  const isSlowResponse  = metrics.responseMinutes > 120;
  const hasFlags        = metrics.overdueReviews > 0 || metrics.atRiskClients > 0;
  const initials        = trainer.name.split(" ").map((n) => n[0]).join("").toUpperCase();

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

          <div className="flex items-center gap-2 shrink-0 mt-1">
            <button className="flex items-center gap-1.5 rounded-xl border border-white/8 bg-white/[0.02] px-3.5 py-2 text-xs font-medium text-white/55 hover:bg-white/[0.05] hover:text-white/75 transition-all">
              <MessageSquare className="w-3.5 h-3.5" strokeWidth={1.5} />
              Message
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

      {error && (
        <p className="text-xs text-red-400/70 bg-red-400/5 border border-red-400/15 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      {/* ── KPI grid ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        <KpiCard label="Total clients"   value={`${metrics.totalClients}`}           sub={`${metrics.activeClients} active`}      icon={Users}        accent />
        <KpiCard label="Active"          value={`${metrics.activeClients}`}           sub="currently engaged"                      icon={CheckCircle2}        />
        <KpiCard label="Paused"          value={`${metrics.pausedClients}`}           sub="on hold"                                icon={Minus}               />
        <KpiCard label="Churned"         value={`${metrics.churnedClients}`}          sub="lost clients"                           icon={TrendingDown}        />
        <KpiCard label="Retention"       value={`${metrics.retentionRate}%`}          delta={retentionDelta}                       icon={TrendingUp}
          chart={<Sparkline points={metrics.retentionTrend} color={retentionDelta >= 0 ? "#4ADE80" : "#F87171"} height={30} />}
        />
        <KpiCard label="Avg adherence"   value={`${metrics.avgAdherence}%`}           delta={adherenceDelta}                       icon={RefreshCw}
          chart={<Sparkline points={metrics.adherenceTrend} color={adherenceDelta >= 0 ? "#93C5FD" : "#F87171"} height={30} />}
        />
        <KpiCard label="Execution score" value={`${metrics.avgExecutionScore}`}       sub="client average"                         icon={TrendingUp}          />
        <KpiCard label="Check-in rate"   value={`${metrics.avgCheckInCompletion}%`}   sub="avg completion"                         icon={Calendar}            />
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
              { label: "Total assigned",  value: metrics.programAssignments },
              { label: "Active programs", value: metrics.activeProgramCount },
              { label: "Overdue reviews", value: metrics.overdueReviews, flag: metrics.overdueReviews > 0 },
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
              { label: "Active",  count: metrics.activeClients,  color: "bg-emerald-400/70",    pct: metrics.totalClients > 0 ? Math.round((metrics.activeClients  / metrics.totalClients) * 100) : 0 },
              { label: "Paused",  count: metrics.pausedClients,  color: "bg-white/20",          pct: metrics.totalClients > 0 ? Math.round((metrics.pausedClients  / metrics.totalClients) * 100) : 0 },
              { label: "Churned", count: metrics.churnedClients, color: "bg-[#F87171]/60",      pct: metrics.totalClients > 0 ? Math.round((metrics.churnedClients / metrics.totalClients) * 100) : 0 },
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
                    {metrics.avgResponseTime}
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
                  <span className="text-lg font-semibold text-white/80 tabular-nums">{metrics.messageCount}</span>
                </div>
              </div>
            </div>

            {/* Feedback */}
            <div className="flex items-start justify-between pb-4 border-b border-white/[0.05]">
              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-white/22 mb-1.5">Client feedback</p>
                <FeedbackStars score={metrics.feedbackScore} />
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-[0.14em] text-white/22 mb-1">Upgrades driven</p>
                <p className="text-lg font-semibold text-white/80 tabular-nums">{metrics.upgradeCount}</p>
              </div>
            </div>

            {/* Revenue */}
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] text-white/22 mb-1">Revenue generated</p>
              <p className="text-2xl font-semibold text-[#B48B40] tabular-nums">
                ${metrics.revenueGenerated.toLocaleString()}
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
            {metrics.atRiskClients > 0 && (
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" strokeWidth={1.5} />
                <p className="text-sm text-white/60">
                  <span className="text-amber-400 font-semibold">{metrics.atRiskClients} client{metrics.atRiskClients > 1 ? "s" : ""}</span> flagged as at-risk — follow-up recommended
                </p>
              </div>
            )}
            {metrics.overdueReviews > 0 && (
              <div className="flex items-center gap-2.5">
                <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" strokeWidth={1.5} />
                <p className="text-sm text-white/60">
                  <span className="text-amber-400 font-semibold">{metrics.overdueReviews} check-in review{metrics.overdueReviews > 1 ? "s" : ""}</span> overdue — action needed
                </p>
              </div>
            )}
            {isSlowResponse && (
              <div className="flex items-center gap-2.5">
                <Clock className="w-3.5 h-3.5 text-[#F87171] shrink-0" strokeWidth={1.5} />
                <p className="text-sm text-white/60">
                  Response time averaging <span className="text-[#F87171] font-semibold">{metrics.avgResponseTime}</span> — below platform standard
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
          <p className="text-sm font-medium text-white/70 mt-0.5">{clients.length} assigned</p>
        </div>

        {/* Column headers */}
        <div className={cn(
          "hidden md:grid gap-4 px-5 py-2.5 border-b border-white/[0.04]",
          (isMaster || isTrainer)
            ? "grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto]"
            : "grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr]"
        )}>
          {["Client", "Status", "Adherence", "Execution", "Check-ins", "Last active"].map((col) => (
            <p key={col} className="text-[10px] uppercase tracking-[0.14em] text-white/22">{col}</p>
          ))}
          {(isMaster || isTrainer) && <p className="text-[10px] uppercase tracking-[0.14em] text-white/22 w-8" />}
        </div>

        <div className="divide-y divide-white/[0.04]">
          {clients.map((c) => {
            const sc = STATUS_CFG[c.status as keyof typeof STATUS_CFG] ?? STATUS_CFG.active;
            const clientInitials = c.name.split(" ").map((n) => n[0]).join("").toUpperCase();
            const isInactive     = c.status === "paused" || c.status === "churned";
            const isBeingDel     = deleting === c.id;

            return (
              <div
                key={c.id}
                className={cn(
                  "grid grid-cols-1 gap-2 md:gap-4 items-center px-5 py-3.5",
                  (isMaster || isTrainer)
                    ? "md:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto]"
                    : "md:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr]"
                )}
              >
                {/* Name */}
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-full border flex items-center justify-center shrink-0",
                    isInactive ? "bg-[#1A1A1A] border-white/5" : "bg-[#1C1C1C] border-white/8"
                  )}>
                    <span className={cn("text-[10px] font-semibold", isInactive ? "text-white/25" : "text-white/45")}>{clientInitials}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className={cn("text-sm font-medium", isInactive ? "text-white/40" : "text-white/80")}>{c.name}</p>
                      <span className={cn("text-[9px] font-semibold uppercase tracking-wider", (c.plan === "performance" || c.plan === "coaching") ? "text-[#B48B40]" : "text-white/28")}>
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
                <span className={cn("text-xs tabular-nums", isInactive ? "text-white/18" : "text-white/55")}>
                  {isInactive ? "—" : `${c.checkInCompletion}%`}
                </span>

                {/* Last active */}
                <span className="text-xs text-white/28 tabular-nums">{c.lastActive}</span>

                {/* Delete — master or trainer (their own clients) */}
                {(isMaster || isTrainer) && (
                  <button
                    onClick={() => handleDeleteClient(c.id)}
                    disabled={isBeingDel}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-transparent hover:border-red-400/20 hover:bg-red-400/8 text-white/18 hover:text-red-400/70 transition-all disabled:opacity-30"
                    title="Remove client"
                  >
                    <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </button>
                )}
              </div>
            );
          })}

          {clients.length === 0 && (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-white/25">No clients assigned.</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
