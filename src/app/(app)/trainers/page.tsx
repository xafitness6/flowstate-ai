"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  TrendingUp,
  AlertTriangle,
  Clock,
  ChevronRight,
  Star,
  ArrowUpRight,
  UserPlus,
  MoreHorizontal,
  Eye,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/context/UserContext";
import {
  initStore,
  getTrainers,
  getTrainerMetrics,
  deleteTrainer,
  type PlatformUser,
  type TrainerMetrics,
  PermissionError,
} from "@/lib/data/store";

// ─── Types ────────────────────────────────────────────────────────────────────

type TrainerFilter = "all" | "high-performers" | "low-retention" | "slow-response" | "high-churn";

type TrainerRow = PlatformUser & { metrics: TrainerMetrics };

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
  if (f === "high-performers") return t.metrics.retentionRate >= 80 && t.metrics.avgAdherence >= 80;
  if (f === "low-retention")   return t.metrics.retentionRate < 75;
  if (f === "slow-response")   return t.metrics.responseMinutes > 120;
  if (f === "high-churn")      return t.metrics.atRiskClients > 0 || t.metrics.retentionRate < 70;
  return true;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon: Icon, accent = false,
}: {
  label: string; value: string; sub?: string;
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

// ─── Action menu ──────────────────────────────────────────────────────────────

type MenuOption = { label: string; icon?: React.ReactNode; onClick: () => void; danger?: boolean; disabled?: boolean };

function ActionMenu({ id, openId, setOpenId, options }: {
  id: string;
  openId: string | null;
  setOpenId: (id: string | null) => void;
  options: MenuOption[];
}) {
  const ref  = useRef<HTMLDivElement>(null);
  const open = openId === id;

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpenId(null);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, setOpenId]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpenId(open ? null : id); }}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-white/22 hover:text-white/60 hover:bg-white/[0.05] transition-all"
        title="Actions"
      >
        <MoreHorizontal className="w-4 h-4" strokeWidth={1.5} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-40 rounded-xl border border-white/10 bg-[#1A1A1A] shadow-2xl z-50 overflow-hidden py-1">
          {options.map((opt, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); if (!opt.disabled) { opt.onClick(); setOpenId(null); } }}
              disabled={opt.disabled}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors text-left",
                opt.danger
                  ? "text-red-400/70 hover:text-red-400 hover:bg-red-400/6"
                  : "text-white/55 hover:text-white/80 hover:bg-white/[0.04]",
                opt.disabled && "opacity-30 cursor-not-allowed"
              )}
            >
              {opt.icon && <span className="shrink-0">{opt.icon}</span>}
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TrainersPage() {
  const router               = useRouter();
  const { user }             = useUser();
  const [rows,    setRows  ] = useState<TrainerRow[]>([]);
  const [filter,  setFilter] = useState<TrainerFilter>("all");
  const [deleting,   setDeleting  ] = useState<string | null>(null);
  const [error,      setError     ] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const isMaster = user.role === "master";

  // Load data from store on mount
  useEffect(() => {
    initStore();
    try {
      const trainers = getTrainers(user.role, user.id);
      const withMetrics: TrainerRow[] = trainers.flatMap((t) => {
        const m = getTrainerMetrics(t.id);
        return m ? [{ ...t, metrics: m }] : [];
      });
      setRows(withMetrics);
    } catch (e) {
      if (e instanceof PermissionError) router.replace("/");
    }
  }, [user.role, user.id, router]);

  const filtered = rows.filter((t) => matchesFilter(t, filter));

  const avgRetention = rows.length
    ? Math.round(rows.reduce((s, t) => s + t.metrics.retentionRate, 0) / rows.length)
    : 0;
  const avgAdherence = rows.length
    ? Math.round(rows.reduce((s, t) => s + t.metrics.avgAdherence,  0) / rows.length)
    : 0;
  const totalAtRisk = rows.reduce((s, t) => s + t.metrics.atRiskClients, 0);

  async function handleDelete(trainerId: string) {
    if (!confirm("Delete this trainer? Their clients will be unassigned.")) return;
    setDeleting(trainerId);
    setError(null);
    try {
      // Server-side check first
      const res = await fetch("/api/trainers", {
        method:  "DELETE",
        headers: {
          "Content-Type":  "application/json",
          "x-actor-role":  user.role,
          "x-actor-id":    user.id,
        },
        body: JSON.stringify({ trainerId }),
      });
      if (!res.ok) {
        const j = await res.json() as { error?: string };
        setError(j.error ?? "Delete failed");
        setDeleting(null);
        return;
      }
      // Client-side store mutation
      deleteTrainer(trainerId, user.role);
      setRows((prev) => prev.filter((t) => t.id !== trainerId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="px-5 md:px-8 py-6 text-white space-y-6">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-white/22 mb-1.5">
            {isMaster ? "Admin · Trainers" : "My Profile"}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isMaster ? "Trainer Performance" : "Your Trainer Dashboard"}
          </h1>
          <p className="text-sm text-white/30 mt-1">
            {isMaster
              ? "Business visibility and operational health across all trainers."
              : "Your client roster and performance metrics."}
          </p>
        </div>

        {/* Master: add trainer button */}
        {isMaster && (
          <button
            onClick={() => router.push("/admin")}
            className="flex items-center gap-1.5 rounded-xl border border-white/8 bg-white/[0.02] px-3.5 py-2 text-xs font-medium text-white/55 hover:bg-white/[0.05] hover:text-white/75 transition-all shrink-0 mt-1"
          >
            <UserPlus className="w-3.5 h-3.5" strokeWidth={1.5} />
            Add trainer
          </button>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-400/70 bg-red-400/5 border border-red-400/15 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      {/* ── KPI row (master only) ─────────────────────────────────── */}
      {isMaster && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Active trainers" value={`${rows.length}`} sub={`${rows.length} total`} icon={Users} accent />
          <KpiCard label="Avg retention"   value={`${avgRetention}%`} sub="across all trainers" icon={TrendingUp} />
          <KpiCard label="Avg adherence"   value={`${avgAdherence}%`} sub="client average" icon={ArrowUpRight} />
          <KpiCard label="At-risk clients" value={`${totalAtRisk}`} sub="needs attention" icon={AlertTriangle} />
        </div>
      )}

      {/* ── Filters (master only) ─────────────────────────────────── */}
      {isMaster && (
        <div className="flex items-center gap-1 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-[11px] font-medium tracking-[0.04em] transition-all",
                filter === f.id
                  ? "bg-white/8 text-white/80 border border-white/12"
                  : "text-white/30 hover:text-white/55 border border-transparent"
              )}
            >
              {f.label}
            </button>
          ))}
          {filter !== "all" && (
            <span className="text-[10px] text-white/25 ml-1">
              {filtered.length} of {rows.length}
            </span>
          )}
        </div>
      )}

      {/* ── Trainer table ───────────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/6 bg-[#111111] overflow-hidden">

        {/* Column headers */}
        <div className={cn(
          "hidden md:grid gap-4 px-5 py-3 border-b border-white/[0.05]",
          isMaster
            ? "grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto_auto]"
            : "grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]"
        )}>
          {["Trainer", "Active clients", "Retention", "Adherence", "At-risk", "Response time"].map((col) => (
            <p key={col} className="text-[10px] uppercase tracking-[0.14em] text-white/22">{col}</p>
          ))}
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/22 w-20">Feedback</p>
          {isMaster && <p className="text-[10px] uppercase tracking-[0.14em] text-white/22 w-8" />}
        </div>

        {/* Rows */}
        <div className="divide-y divide-white/[0.04]">
          {filtered.map((t) => {
            const initials     = t.name.split(" ").map((n) => n[0]).join("").toUpperCase();
            const isSlowResp   = t.metrics.responseMinutes > 120;
            const hasAtRisk    = t.metrics.atRiskClients > 0;
            const hasOverdue   = t.metrics.overdueReviews > 0;
            const isBeingDel   = deleting === t.id;

            return (
              <div
                key={t.id}
                className={cn(
                  "w-full text-left grid grid-cols-1 gap-2 md:gap-4 items-center px-5 py-4",
                  isMaster
                    ? "md:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto_auto]"
                    : "md:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]",
                  "hover:bg-white/[0.018] transition-colors group"
                )}
              >
                {/* Name — clickable */}
                <button
                  onClick={() => router.push(`/trainers/${t.id}`)}
                  className="flex items-center gap-3 text-left"
                >
                  <div className="w-9 h-9 rounded-full bg-[#1C1C1C] border border-white/8 flex items-center justify-center shrink-0">
                    <span className="text-[11px] font-semibold text-white/45">{initials}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white/85 group-hover:text-white/95 transition-colors">{t.name}</p>
                      {hasOverdue && (
                        <span className="text-[9px] font-semibold uppercase tracking-wider text-amber-400 border border-amber-400/25 bg-amber-400/8 rounded px-1.5 py-0.5">
                          {t.metrics.overdueReviews} overdue
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-white/28 truncate">{t.email}</p>
                  </div>
                </button>

                {/* Active clients */}
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-white/80 tabular-nums">{t.metrics.activeClients}</span>
                  <span className="text-[10px] text-white/28">{t.metrics.totalClients} total</span>
                </div>

                {/* Retention */}
                <PctBar
                  value={t.metrics.retentionRate}
                  color={t.metrics.retentionRate >= 80 ? "bg-emerald-400/70" : t.metrics.retentionRate >= 70 ? "bg-amber-400/70" : "bg-[#F87171]/70"}
                />

                {/* Adherence */}
                <PctBar
                  value={t.metrics.avgAdherence}
                  color={t.metrics.avgAdherence >= 80 ? "bg-[#93C5FD]/70" : t.metrics.avgAdherence >= 70 ? "bg-amber-400/70" : "bg-[#F87171]/70"}
                />

                {/* At-risk */}
                <span className={cn("text-xs font-semibold tabular-nums", hasAtRisk ? "text-amber-400" : "text-white/28")}>
                  {t.metrics.atRiskClients > 0 ? t.metrics.atRiskClients : "—"}
                </span>

                {/* Response time */}
                <div className="flex items-center gap-1.5">
                  <Clock className={cn("w-3 h-3 shrink-0", isSlowResp ? "text-[#F87171]" : "text-white/25")} strokeWidth={1.5} />
                  <span className={cn("text-xs tabular-nums", isSlowResp ? "text-[#F87171]" : "text-white/45")}>
                    {t.metrics.avgResponseTime}
                  </span>
                </div>

                {/* Feedback + chevron */}
                <div className="flex items-center justify-between gap-3 w-20">
                  <FeedbackStars score={t.metrics.feedbackScore} />
                  <button onClick={() => router.push(`/trainers/${t.id}`)}>
                    <ChevronRight className="w-3.5 h-3.5 text-white/15 group-hover:text-white/35 transition-colors" strokeWidth={1.5} />
                  </button>
                </div>

                {/* Master-only: actions menu */}
                {isMaster && (
                  <ActionMenu
                    id={t.id}
                    openId={openMenuId}
                    setOpenId={setOpenMenuId}
                    options={[
                      {
                        label: "View details",
                        icon: <Eye className="w-3.5 h-3.5" strokeWidth={1.5} />,
                        onClick: () => router.push(`/trainers/${t.id}`),
                      },
                      {
                        label: isBeingDel ? "Deleting…" : "Delete trainer",
                        icon: <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />,
                        danger: true,
                        disabled: isBeingDel,
                        onClick: () => handleDelete(t.id),
                      },
                    ]}
                  />
                )}
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="px-5 py-12 text-center">
              <p className="text-sm text-white/25">
                {rows.length === 0 ? "No trainers found." : "No trainers match this filter."}
              </p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
