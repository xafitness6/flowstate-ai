"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  RefreshCw,
  Search,
  ChevronUp,
  ChevronDown,
  Minus,
  MoreHorizontal,
  Eye,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserNameLink } from "@/components/profile/UserHoverCard";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { useUser } from "@/context/UserContext";
import {
  initStore,
  getUsers,
  deleteUser,
  type PlatformUser,
  PermissionError,
} from "@/lib/data/store";

// ─── Types ────────────────────────────────────────────────────────────────────

type SortKey = "name" | "role" | "plan" | "status" | "lastActive";
type SortDir = "asc" | "desc";

// ─── Static platform-level stats (aggregate, not from seed users) ─────────────

const REVENUE_POINTS = [18400, 19200, 20100, 21800, 22400, 23650, 24840];
const USER_GROWTH    = [610, 648, 672, 695, 718, 741, 762, 791, 812, 831, 841, 847];

const TIERS: { plan: PlatformUser["plan"]; label: string; count: number; color: string; mrr: number }[] = [
  { plan: "elite",   label: "Elite",   count: 234, color: "bg-[#B48B40]",    mrr: 14040 },
  { plan: "pro",     label: "Pro",     count: 489, color: "bg-[#93C5FD]/70", mrr: 9780  },
  { plan: "starter", label: "Starter", count: 124, color: "bg-white/12",     mrr: 0     },
];

// ─── Config maps ──────────────────────────────────────────────────────────────

const STATUS_CFG = {
  active:    { label: "Active",  dot: "bg-emerald-400", badge: "text-emerald-400 border-emerald-400/20 bg-emerald-400/8"  },
  "at-risk": { label: "At risk", dot: "bg-amber-400",   badge: "text-amber-400 border-amber-400/20 bg-amber-400/8"        },
  churned:   { label: "Churned", dot: "bg-[#F87171]",   badge: "text-[#F87171] border-[#F87171]/20 bg-[#F87171]/8"        },
  trial:     { label: "Trial",   dot: "bg-[#93C5FD]",   badge: "text-[#93C5FD] border-[#93C5FD]/20 bg-[#93C5FD]/8"        },
  paused:    { label: "Paused",  dot: "bg-white/30",    badge: "text-white/40 border-white/12 bg-white/[0.04]"            },
} as const;

const ROLE_CFG = {
  master:  { label: "Admin",   color: "text-emerald-400/80" },
  trainer: { label: "Trainer", color: "text-[#B48B40]/80"   },
  client:  { label: "Client",  color: "text-[#93C5FD]/70"   },
  member:  { label: "Member",  color: "text-white/35"        },
} as const;

const PLAN_CFG = {
  elite:   { label: "Elite",   color: "text-[#B48B40]" },
  pro:     { label: "Pro",     color: "text-white/55"  },
  starter: { label: "Starter", color: "text-white/28"  },
} as const;

// ─── Sparkline / bar chart ────────────────────────────────────────────────────

function Sparkline({ points, color = "#B48B40", height = 40 }: { points: number[]; color?: string; height?: number }) {
  const w = 200, h = height;
  const min = Math.min(...points), max = Math.max(...points);
  const range = max - min || 1;
  const step  = w / (points.length - 1);
  const coords = points.map((p, i) => [i * step, h - ((p - min) / range) * (h - 6) - 3]);
  const pathD  = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const areaD  = `${pathD} L ${coords[coords.length - 1][0].toFixed(1)} ${h} L 0 ${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0"    />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#grad-${color.replace("#", "")})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={coords[coords.length-1][0]} cy={coords[coords.length-1][1]} r="2.5" fill={color} />
    </svg>
  );
}

function BarChart({ points, color = "#B48B40" }: { points: number[]; color?: string }) {
  const max = Math.max(...points);
  return (
    <div className="flex items-end gap-1 h-10 w-full">
      {points.map((p, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm transition-all"
          style={{ height: `${(p / max) * 100}%`, background: i === points.length - 1 ? color : `${color}40`, minHeight: "4px" }}
        />
      ))}
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, delta, deltaLabel, icon: Icon, chart, accent = false }: {
  label: string; value: string; delta?: number; deltaLabel?: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  chart?: React.ReactNode; accent?: boolean;
}) {
  const up = delta !== undefined && delta > 0;
  const dn = delta !== undefined && delta < 0;
  return (
    <div className={cn("rounded-2xl border bg-[#111111] px-5 py-4 flex flex-col gap-3 overflow-hidden", accent ? "border-[#B48B40]/22" : "border-white/6")}>
      <div className="flex items-start justify-between">
        <div className="w-8 h-8 rounded-xl border border-white/6 bg-white/[0.03] flex items-center justify-center">
          <Icon className="w-4 h-4 text-white/38" strokeWidth={1.5} />
        </div>
        {delta !== undefined && (
          <div className={cn("flex items-center gap-1 text-[10px] font-semibold rounded-md px-1.5 py-0.5 border",
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
        {deltaLabel && <p className="text-[10px] text-white/20 mt-0.5">{deltaLabel}</p>}
      </div>
      {chart && <div className="mt-auto -mx-1">{chart}</div>}
    </div>
  );
}

function SortIcon({ field, sortKey, sortDir }: { field: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (field !== sortKey) return <span className="w-3 h-3 inline-block opacity-0" />;
  return sortDir === "asc"
    ? <ChevronUp   className="w-3 h-3 text-[#B48B40]" strokeWidth={2} />
    : <ChevronDown className="w-3 h-3 text-[#B48B40]" strokeWidth={2} />;
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

export default function AdminDashboard() {
  const adminReady = useAdminGuard();
  const { user }   = useUser();
  const router     = useRouter();

  const [users,        setUsers       ] = useState<PlatformUser[]>([]);
  const [search,       setSearch      ] = useState("");
  const [roleFilter,   setRoleFilter  ] = useState<PlatformUser["role"] | "all">("all");
  const [statusFilter, setStatusFilter] = useState<PlatformUser["status"] | "all">("all");
  const [sortKey,      setSortKey     ] = useState<SortKey>("lastActive");
  const [sortDir,      setSortDir     ] = useState<SortDir>("asc");
  const [deleting,     setDeleting    ] = useState<string | null>(null);
  const [error,        setError       ] = useState<string | null>(null);
  const [openMenuId,   setOpenMenuId  ] = useState<string | null>(null);

  useEffect(() => {
    initStore();
    try {
      setUsers(getUsers(user.role));
    } catch (e) {
      if (e instanceof PermissionError) setError("Access denied.");
    }
  }, [user.role]);

  const totalUsers   = users.length;
  const activeUsers  = users.filter((u) => u.status === "active").length;
  const atRiskUsers  = users.filter((u) => u.status === "at-risk").length;
  const totalClients = users.filter((u) => u.role === "client").length;

  // Derive assignment summary from store data
  const assignments = (() => {
    const trainers = users.filter((u) => u.role === "trainer");
    return trainers.map((t) => {
      const clientNames = users
        .filter((u) => u.role === "client" && u.trainerId === t.id)
        .map((c) => c.name);
      return { trainer: t.name, trainerId: t.id, count: clientNames.length, clients: clientNames };
    }).filter((a) => a.count > 0);
  })();

  async function handleDeleteUser(target: PlatformUser) {
    if (!confirm(`Delete ${target.name}? This cannot be undone.`)) return;
    setDeleting(target.id);
    setError(null);
    try {
      const res = await fetch(`/api/users/${target.id}`, {
        method:  "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-actor-role": user.role,
          "x-actor-id":   user.id,
        },
        body: JSON.stringify({
          targetRole:      target.role,
          targetTrainerId: target.trainerId,
        }),
      });
      if (!res.ok) {
        const j = await res.json() as { error?: string };
        setError(j.error ?? "Delete failed");
        setDeleting(null);
        return;
      }
      deleteUser(target.id, user.role, user.id);
      setUsers((prev) => prev.filter((u) => u.id !== target.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(null);
    }
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  const filtered = users
    .filter((u) => {
      const q = search.toLowerCase();
      return (
        (!q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) &&
        (roleFilter === "all"   || u.role   === roleFilter) &&
        (statusFilter === "all" || u.status === statusFilter)
      );
    })
    .sort((a, b) => {
      const va = a[sortKey] ?? "";
      const vb = b[sortKey] ?? "";
      return sortDir === "asc" ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });

  const tierTotal = TIERS.reduce((s, t) => s + t.count, 0);

  const ROLE_FILTER_LABELS: Record<string, string> = {
    all: "All", master: "Admin", trainer: "Trainer", client: "Client", member: "Member",
  };

  if (!adminReady) return null;

  return (
    <div className="px-5 md:px-8 py-6 text-white space-y-6">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-white/22 mb-1.5">Admin</p>
          <h1 className="text-2xl font-semibold tracking-tight">Platform Overview</h1>
          <p className="text-sm text-white/30 mt-1">Real-time platform health and user performance.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 mt-1">
          <span className="text-[10px] text-white/22 hidden sm:block">Updated just now</span>
          <button className="w-8 h-8 rounded-xl border border-white/8 bg-white/[0.02] flex items-center justify-center hover:bg-white/[0.05] transition-colors">
            <RefreshCw className="w-3.5 h-3.5 text-white/35" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-400/70 bg-red-400/5 border border-red-400/15 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      {/* ── KPI row ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard label="Total users"   value="847"     delta={4}  deltaLabel="vs last month"
          icon={Users}       chart={<BarChart points={USER_GROWTH} color="#B48B40" />} accent />
        <StatCard label="Active users"  value={`${activeUsers}`} delta={2}
          deltaLabel={totalUsers > 0 ? `${Math.round((activeUsers / totalUsers) * 100)}% of total` : "—"}
          icon={Activity}    chart={<Sparkline points={[580,595,601,610,612,608,612]} color="#4ADE80" height={36} />} />
        <StatCard label="Monthly revenue" value="$24,840" delta={6} deltaLabel="MRR growth"
          icon={DollarSign}  chart={<Sparkline points={REVENUE_POINTS} color="#B48B40" height={36} />} accent />
        <StatCard label="Retention"     value="94.2%"   delta={1}  deltaLabel="30-day average"  icon={TrendingUp}   />
        <StatCard label="Churn rate"    value="2.1%"    delta={-1} deltaLabel="Month over month" icon={TrendingDown} />
        <StatCard label="Client assignments" value={`${totalClients}`}
          deltaLabel={`${assignments.length} active trainers`} icon={Users} />
      </div>

      {/* ── Middle row ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Subscription tiers */}
        <div className="md:col-span-2 rounded-2xl border border-white/6 bg-[#111111] px-6 py-5 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/22 mb-1">Subscriptions</p>
              <p className="text-base font-semibold text-white/88">by tier</p>
            </div>
            <p className="text-xs text-white/28">{tierTotal} total</p>
          </div>
          <div className="space-y-4">
            {TIERS.map((t) => {
              const pct = Math.round((t.count / tierTotal) * 100);
              return (
                <div key={t.plan}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <span className={cn("w-2 h-2 rounded-full", t.color)} />
                      <span className="text-sm text-white/70">{t.label}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-white/30 tabular-nums">{t.count} users</span>
                      {t.mrr > 0 && (
                        <span className="text-xs text-white/28 tabular-nums w-20 text-right">${t.mrr.toLocaleString()}/mo</span>
                      )}
                      <span className="text-xs font-semibold text-white/55 tabular-nums w-9 text-right">{pct}%</span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", t.color)} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="pt-2 border-t border-white/5 flex items-center gap-6">
            <div>
              <p className="text-[10px] uppercase tracking-[0.15em] text-white/20 mb-0.5">MRR</p>
              <p className="text-sm font-semibold text-[#B48B40]">$24,840</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.15em] text-white/20 mb-0.5">ARR (projected)</p>
              <p className="text-sm font-semibold text-white/60">$298,080</p>
            </div>
            <div className="ml-auto">
              <p className="text-[10px] uppercase tracking-[0.15em] text-white/20 mb-0.5">ARPPU</p>
              <p className="text-sm font-semibold text-white/60">$34.22</p>
            </div>
          </div>
        </div>

        {/* Client assignments + alerts */}
        <div className="space-y-3">
          <div className="rounded-2xl border border-white/6 bg-[#111111] px-5 py-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/22 mb-3.5">Client assignments</p>
            <div className="space-y-4">
              {assignments.length === 0 && (
                <p className="text-xs text-white/25">No active assignments.</p>
              )}
              {assignments.map((a) => (
                <div key={a.trainerId}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-white/75 font-medium">{a.trainer}</span>
                    <span className="text-xs text-[#B48B40] font-semibold">{a.count} clients</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {a.clients.map((c) => (
                      <span key={c} className="text-[10px] text-white/38 bg-white/[0.04] border border-white/7 rounded-lg px-2 py-0.5">
                        {c.split(" ")[0]}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-white/6 bg-[#111111] px-5 py-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/22 mb-3">Alerts</p>
            <div className="space-y-2.5">
              {[
                { color: "bg-amber-400", text: `${atRiskUsers} user${atRiskUsers !== 1 ? "s" : ""} at risk of churning` },
                { color: "bg-[#93C5FD]", text: "1 user in free trial (day 6 of 7)"                                       },
                { color: "bg-white/20",  text: "1 account paused — no activity in 8d"                                     },
              ].map((a, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className={cn("w-1.5 h-1.5 rounded-full mt-1.5 shrink-0", a.color)} />
                  <p className="text-xs text-white/42 leading-relaxed">{a.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── User table ──────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/6 bg-[#111111] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.05] flex flex-col sm:flex-row sm:items-center gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/22">Users</p>
            <p className="text-sm font-medium text-white/75 mt-0.5">{filtered.length} of {totalUsers}</p>
          </div>
          <div className="sm:ml-auto flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2">
              <Search className="w-3.5 h-3.5 text-white/25 shrink-0" strokeWidth={1.5} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="bg-transparent text-xs text-white/70 placeholder:text-white/22 outline-none w-28"
              />
            </div>
            <div className="flex items-center gap-1">
              {(["all", "master", "trainer", "client", "member"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRoleFilter(r)}
                  className={cn(
                    "rounded-lg px-2.5 py-1.5 text-[10px] font-medium tracking-[0.06em] uppercase transition-all",
                    roleFilter === r ? "bg-white/8 text-white/70" : "text-white/28 hover:text-white/50"
                  )}
                >
                  {ROLE_FILTER_LABELS[r]}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              {(["all", "active", "at-risk", "paused", "trial", "churned"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    "rounded-lg px-2.5 py-1.5 text-[10px] font-medium transition-all capitalize",
                    statusFilter === s ? "bg-white/8 text-white/70" : "text-white/28 hover:text-white/50"
                  )}
                >
                  {s === "all" ? "All" : s}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-4 px-5 py-2.5 border-b border-white/[0.04]">
          {([
            { key: "name",       label: "Name"        },
            { key: "role",       label: "Role"        },
            { key: "plan",       label: "Plan"        },
            { key: "status",     label: "Status"      },
            { key: "lastActive", label: "Last active" },
          ] as { key: SortKey; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => toggleSort(key)}
              className="flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-white/22 hover:text-white/45 transition-colors"
            >
              {label}
              <SortIcon field={key} sortKey={sortKey} sortDir={sortDir} />
            </button>
          ))}
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/22">Trainer</p>
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/22 w-8" />
        </div>

        <div className="divide-y divide-white/[0.04]">
          {filtered.map((u) => {
            const sc       = STATUS_CFG[u.status as keyof typeof STATUS_CFG] ?? STATUS_CFG.active;
            const rc       = ROLE_CFG[u.role as keyof typeof ROLE_CFG] ?? ROLE_CFG.member;
            const pc       = PLAN_CFG[u.plan as keyof typeof PLAN_CFG] ?? PLAN_CFG.starter;
            const initials = u.name.split(" ").map((n) => n[0]).join("").toUpperCase();
            const trainer  = u.trainerId ? users.find((x) => x.id === u.trainerId) : undefined;
            const isBeingDel = deleting === u.id;
            const canDelete  = u.role !== "master";

            return (
              <div key={u.id} className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-2 md:gap-4 items-center px-5 py-3.5 hover:bg-white/[0.015] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#1C1C1C] border border-white/8 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-semibold text-white/45">{initials}</span>
                  </div>
                  <div className="min-w-0">
                    <UserNameLink
                      user={{ id: u.id, name: u.name, email: u.email, role: u.role, plan: u.plan, status: u.status }}
                      className="text-sm text-white/80 font-medium"
                    />
                    <p className="text-[11px] text-white/28 truncate">{u.email}</p>
                  </div>
                </div>
                <p className={cn("text-xs font-medium", rc.color)}>{rc.label}</p>
                <p className={cn("text-xs font-semibold", pc.color)}>{pc.label}</p>
                <div className="flex items-center gap-1.5">
                  <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", sc.dot)} />
                  <span className={cn("text-[10px] font-medium tracking-[0.06em] uppercase px-1.5 py-0.5 rounded-md border", sc.badge)}>
                    {sc.label}
                  </span>
                </div>
                <p className="text-xs text-white/28 tabular-nums">{u.lastActive}</p>
                {trainer ? (
                  <UserNameLink
                    user={{ id: trainer.id, name: trainer.name, email: trainer.email, role: trainer.role, plan: trainer.plan, status: trainer.status }}
                    className="text-xs text-white/45"
                  />
                ) : (
                  <p className="text-xs text-white/28">—</p>
                )}
                <ActionMenu
                  id={u.id}
                  openId={openMenuId}
                  setOpenId={setOpenMenuId}
                  options={[
                    {
                      label: "View details",
                      icon: <Eye className="w-3.5 h-3.5" strokeWidth={1.5} />,
                      onClick: () => router.push(`/profile/${u.id}`),
                    },
                    {
                      label: isBeingDel ? "Deleting…" : "Delete",
                      icon: <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />,
                      danger: true,
                      disabled: !canDelete || isBeingDel,
                      onClick: () => handleDeleteUser(u),
                    },
                  ]}
                />
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-white/25">No users match the current filters.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
