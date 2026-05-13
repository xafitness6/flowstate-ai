"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
  Archive,
  ArchiveRestore,
  Check,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserNameLink } from "@/components/profile/UserHoverCard";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { useUser } from "@/context/UserContext";
import {
  getTrainers,
  getTrainerMetrics,
  type PlatformUser,
  type TrainerMetrics,
} from "@/lib/data/store";
import {
  profileToAdminUser,
  isLead,
  type AdminUser,
  type AdminProfile,
} from "@/lib/admin/profileMapper";
import { resetAccountLocalData, sessionKeyToUserId } from "@/lib/resetAccount";
import { getSessionKey } from "@/lib/routing";

// ─── Types ────────────────────────────────────────────────────────────────────

type SortKey = "name" | "role" | "plan" | "status" | "lastActive";
type SortDir = "asc" | "desc";

// ─── Pricing ──────────────────────────────────────────────────────────────────

const TIER_PRICE: Record<string, number> = {
  coaching:    199,
  performance: 79,
  training:    29,
  foundation:  0,
};

const TIER_COLOR: Record<string, string> = {
  coaching:    "bg-purple-400/70",
  performance: "bg-[#B48B40]",
  training:    "bg-[#93C5FD]/70",
  foundation:  "bg-white/12",
};

// Revenue sparkline shape — kept as a growth trend; endpoint will be computed MRR.
const REVENUE_SHAPE = [0.74, 0.77, 0.81, 0.88, 0.90, 0.95, 1.0];

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
  coaching:    { label: "Hybrid Coaching", color: "text-purple-400"    },
  performance: { label: "AI Performance",  color: "text-[#B48B40]"     },
  training:    { label: "Training",        color: "text-white/55"       },
  foundation:  { label: "Foundation",      color: "text-white/28"       },
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

function StatCard({ label, value, delta, deltaLabel, icon: Icon, chart, accent = false, onClick, hint }: {
  label: string; value: string; delta?: number; deltaLabel?: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  chart?: React.ReactNode; accent?: boolean;
  onClick?: () => void;
  hint?: string;
}) {
  const up = delta !== undefined && delta > 0;
  const dn = delta !== undefined && delta < 0;
  const interactive = !!onClick;
  const Tag: "button" | "div" = interactive ? "button" : "div";
  return (
    <Tag
      type={interactive ? "button" : undefined}
      onClick={onClick}
      title={hint}
      className={cn(
        "text-left rounded-2xl border bg-[#111111] px-5 py-4 flex flex-col gap-3 overflow-hidden transition-all",
        accent ? "border-[#B48B40]/22" : "border-white/6",
        interactive && "hover:border-[#B48B40]/40 hover:bg-[#141414] active:scale-[0.995] cursor-pointer",
      )}
    >
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
    </Tag>
  );
}

function SortIcon({ field, sortKey, sortDir }: { field: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (field !== sortKey) return <span className="w-3 h-3 inline-block opacity-0" />;
  return sortDir === "asc"
    ? <ChevronUp   className="w-3 h-3 text-[#B48B40]" strokeWidth={2} />
    : <ChevronDown className="w-3 h-3 text-[#B48B40]" strokeWidth={2} />;
}

// ─── Inline plan picker ───────────────────────────────────────────────────────
// Click the plan label in a user row → small popover lets the admin upgrade
// or downgrade in place. Calls PATCH /api/admin/users/[id].

const PLAN_ORDER: Array<PlatformUser["plan"]> = ["foundation", "training", "performance", "coaching"];

function PlanPicker({
  userId, currentPlan, disabled, openId, setOpenId, onChanged,
}: {
  userId: string;
  currentPlan: PlatformUser["plan"];
  disabled?: boolean;
  openId: string | null;
  setOpenId: (id: string | null) => void;
  onChanged: () => void;
}) {
  const ref  = useRef<HTMLDivElement>(null);
  const open = openId === `plan:${userId}`;
  const [saving, setSaving] = useState(false);
  const pc = PLAN_CFG[currentPlan as keyof typeof PLAN_CFG] ?? PLAN_CFG.foundation;

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpenId(null);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, setOpenId]);

  async function setPlan(plan: PlatformUser["plan"]) {
    if (plan === currentPlan || saving) { setOpenId(null); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert((body as { error?: string }).error ?? `Failed to update plan (${res.status})`);
        return;
      }
      setOpenId(null);
      onChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to update plan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (disabled) return;
          setOpenId(open ? null : `plan:${userId}`);
        }}
        disabled={disabled || saving}
        className={cn(
          "text-xs font-semibold transition-colors inline-flex items-center gap-1",
          pc.color,
          !disabled && "hover:underline underline-offset-4 decoration-dotted decoration-white/30",
          disabled && "cursor-not-allowed opacity-60",
        )}
        title={disabled ? undefined : "Click to change plan"}
      >
        {pc.label}
        {!disabled && <ChevronDown className="w-3 h-3 text-white/30" strokeWidth={2} />}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 w-44 rounded-xl border border-white/10 bg-[#1A1A1A] shadow-2xl z-50 overflow-hidden py-1">
          {PLAN_ORDER.map((p) => {
            const cfg = PLAN_CFG[p as keyof typeof PLAN_CFG];
            const selected = p === currentPlan;
            return (
              <button
                key={p}
                onClick={(e) => { e.stopPropagation(); void setPlan(p); }}
                disabled={saving}
                className={cn(
                  "w-full text-left px-3 py-2 text-xs font-medium flex items-center justify-between transition-colors",
                  selected ? "bg-white/[0.04] text-white/85" : "text-white/55 hover:text-white/85 hover:bg-white/[0.03]",
                )}
              >
                <span className={cfg?.color}>{cfg?.label ?? p}</span>
                {selected && <Check className="w-3 h-3 text-[#B48B40]" strokeWidth={2.5} />}
              </button>
            );
          })}
        </div>
      )}
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

export default function AdminDashboard() {
  const adminReady = useAdminGuard();
  const { user }   = useUser();
  const router     = useRouter();

  const [users,          setUsers         ] = useState<AdminUser[]>([]);
  const [trainerMetrics, setTrainerMetrics] = useState<Array<{ trainer: PlatformUser; metrics: TrainerMetrics }>>([]);
  const [search,         setSearch        ] = useState("");
  const [roleFilter,   setRoleFilter  ] = useState<PlatformUser["role"] | "all">("all");
  const [statusFilter, setStatusFilter] = useState<PlatformUser["status"] | "all">("all");
  const [planFilter,   setPlanFilter  ] = useState<PlatformUser["plan"] | "all">("all");
  const [view,         setView        ] = useState<"all" | "leads" | "archived">("all");
  const [sortKey,      setSortKey     ] = useState<SortKey>("lastActive");
  const [sortDir,      setSortDir     ] = useState<SortDir>("asc");
  const [error,        setError       ] = useState<string | null>(null);
  const [openMenuId,   setOpenMenuId  ] = useState<string | null>(null);
  const [selectedIds,  setSelectedIds ] = useState<Set<string>>(new Set());
  const [bulkBusy,     setBulkBusy    ] = useState<null | "archive" | "unarchive" | "delete">(null);
  const [lastUpdated,  setLastUpdated ] = useState<Date | null>(null);
  const [refreshing,   setRefreshing  ] = useState(false);

  const fetchUsers = useCallback(async (opts: { silent?: boolean } = {}) => {
    if (!opts.silent) setRefreshing(true);
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { error?: string }).error ?? `Failed to load users (${res.status})`);
        return;
      }
      const body = await res.json() as { users: AdminProfile[] };
      setUsers(body.users.map(profileToAdminUser));
      setLastUpdated(new Date());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      if (!opts.silent) setRefreshing(false);
    }
  }, []);

  // Initial load + 10s polling while the tab is visible.
  useEffect(() => {
    if (!adminReady) return;
    void fetchUsers();

    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      if (document.visibilityState === "visible") void fetchUsers({ silent: true });
    };
    const interval = window.setInterval(tick, 10_000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void fetchUsers({ silent: true });
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [adminReady, fetchUsers]);

  // Trainer metrics still come from localStorage seed — flagged as TODO for
  // the next pass when we wire real trainer analytics.
  useEffect(() => {
    if (!adminReady) return;
    try {
      const trainers = getTrainers("master", user.id);
      setTrainerMetrics(
        trainers.flatMap((t) => {
          const m = getTrainerMetrics(t.id);
          return m ? [{ trainer: t, metrics: m }] : [];
        })
      );
    } catch { /* ignore */ }
  }, [adminReady, user.id]);

  // Metrics reflect the active platform — archived users excluded.
  const activeRoster = users.filter((u) => !u.archivedAt);
  const totalUsers   = activeRoster.length;
  const activeUsers  = activeRoster.filter((u) => u.status === "active").length;
  const atRiskUsers  = activeRoster.filter((u) => u.status === "at-risk").length;
  const churnedUsers = activeRoster.filter((u) => u.status === "churned").length;
  const trialUsers   = activeRoster.filter((u) => u.status === "trial").length;
  const pausedUsers  = activeRoster.filter((u) => u.status === "paused").length;
  const totalClients = activeRoster.filter((u) => u.role === "client").length;

  // Tier breakdown and revenue — derived from active roster
  const tierData = (["coaching", "performance", "training", "foundation"] as const).map((plan) => {
    const count = activeRoster.filter((u) => u.plan === plan).length;
    const mrr   = count * TIER_PRICE[plan];
    const label = PLAN_CFG[plan as keyof typeof PLAN_CFG]?.label ?? plan;
    return { plan, label, count, mrr, color: TIER_COLOR[plan] };
  });
  const totalMrr     = tierData.reduce((s, t) => s + t.mrr, 0);
  const tierTotal    = totalUsers;
  const paidUsers    = tierData.filter((t) => t.plan !== "foundation").reduce((s, t) => s + t.count, 0);
  const arppu        = paidUsers > 0 ? (totalMrr / paidUsers).toFixed(2) : "0.00";
  const retentionPct = totalUsers > 0 ? ((totalUsers - churnedUsers) / totalUsers * 100).toFixed(1) : "100.0";
  const churnPct     = totalUsers > 0 ? (churnedUsers / totalUsers * 100).toFixed(1) : "0.0";

  // Derive assignment summary from active roster
  const assignments = (() => {
    const trainers = activeRoster.filter((u) => u.role === "trainer");
    return trainers.map((t) => {
      const clientNames = activeRoster
        .filter((u) => u.role === "client" && u.trainerId === t.id)
        .map((c) => c.name);
      return { trainer: t.name, trainerId: t.id, count: clientNames.length, clients: clientNames };
    }).filter((a) => a.count > 0);
  })();

  async function runBulkAction(action: "archive" | "unarchive" | "delete", ids: string[]) {
    if (ids.length === 0) return;
    setBulkBusy(action);
    setError(null);
    try {
      const res = await fetch("/api/admin/users/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, userIds: ids }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { error?: string }).error ?? `${action} failed (${res.status})`);
        return;
      }
      setSelectedIds(new Set());
      await fetchUsers({ silent: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : `${action} failed`);
    } finally {
      setBulkBusy(null);
    }
  }

  async function handleArchiveUser(target: AdminUser) {
    const verb = target.archivedAt ? "unarchive" : "archive";
    if (!confirm(`${verb === "archive" ? "Archive" : "Unarchive"} ${target.name}?`)) return;
    await runBulkAction(verb, [target.id]);
  }

  async function handleDeleteUser(target: AdminUser) {
    if (!confirm(`Permanently delete ${target.name}? This cannot be undone.`)) return;
    await runBulkAction("delete", [target.id]);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Drives the "click a KPI card → user table jumps to the matching slice" UX.
  // Sets all filter state in one shot and smooth-scrolls to the table so the
  // admin can see exactly who the number represents.
  function focusUsersTable(opts: {
    view?: "all" | "leads" | "archived";
    role?: PlatformUser["role"] | "all";
    status?: PlatformUser["status"] | "all";
    plan?: PlatformUser["plan"] | "all";
  }) {
    if (opts.view   !== undefined) setView(opts.view);
    if (opts.role   !== undefined) setRoleFilter(opts.role);
    if (opts.status !== undefined) setStatusFilter(opts.status);
    if (opts.plan   !== undefined) setPlanFilter(opts.plan);
    setSelectedIds(new Set());
    if (typeof window !== "undefined") {
      document.getElementById("admin-users-table")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  const visibleUsers = users.filter((u) => {
    if (view === "leads")    return isLead(u);
    if (view === "archived") return !!u.archivedAt;
    // "all" view excludes archived users unless they explicitly switch to the Archived view
    return !u.archivedAt;
  });

  const filtered = visibleUsers
    .filter((u) => {
      const q = search.toLowerCase();
      return (
        (!q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) &&
        (roleFilter === "all"   || u.role   === roleFilter) &&
        (statusFilter === "all" || u.status === statusFilter) &&
        (planFilter === "all"   || u.plan   === planFilter)
      );
    })
    .sort((a, b) => {
      const va = a[sortKey] ?? "";
      const vb = b[sortKey] ?? "";
      return sortDir === "asc" ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });

  const leadCount     = users.filter(isLead).length;
  const archivedCount = users.filter((u) => !!u.archivedAt).length;
  const allSelected   = filtered.length > 0 && filtered.every((u) => selectedIds.has(u.id));
  const someSelected  = filtered.some((u) => selectedIds.has(u.id));

  const ROLE_FILTER_LABELS: Record<string, string> = {
    all: "All", master: "Admin", trainer: "Trainer", client: "Client", member: "Member",
  };

  if (!adminReady) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-5 text-white">
        <div className="text-center space-y-2">
          <div className="mx-auto h-6 w-6 rounded-full border border-[#B48B40]/25 border-t-[#B48B40] animate-spin" />
          <p className="text-sm text-white/55">Opening admin...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 md:px-8 py-6 text-white space-y-6">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-white/22 mb-1.5">Admin</p>
          <h1 className="text-2xl font-semibold tracking-tight">Platform Overview</h1>
          <p className="text-sm text-white/30 mt-1">Live platform data — auto-refreshes every 10s.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 mt-1">
          <button
            onClick={() => router.push("/admin/users")}
            className="flex items-center gap-1.5 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2 text-xs text-white/45 hover:text-white/70 hover:bg-white/[0.05] transition-colors"
          >
            <Users className="w-3.5 h-3.5" strokeWidth={1.5} />
            Manage users
          </button>
          <span className="text-[10px] text-white/22 hidden sm:block tabular-nums">
            {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : "Loading…"}
          </span>
          <button
            onClick={() => void fetchUsers()}
            disabled={refreshing}
            aria-label="Refresh users"
            className="w-8 h-8 rounded-xl border border-white/8 bg-white/[0.02] flex items-center justify-center hover:bg-white/[0.05] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("w-3.5 h-3.5 text-white/35", refreshing && "animate-spin")} strokeWidth={1.5} />
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
        <StatCard label="Total users"   value={`${totalUsers}`} deltaLabel="platform members"
          icon={Users} accent
          hint="Click to view every active platform user"
          onClick={() => focusUsersTable({ view: "all", role: "all", status: "all", plan: "all" })}
        />
        <StatCard label="Active users"  value={`${activeUsers}`}
          deltaLabel={totalUsers > 0 ? `${Math.round((activeUsers / totalUsers) * 100)}% of total` : "—"}
          icon={Activity}
          hint="Filter to actively-engaged users"
          onClick={() => focusUsersTable({ view: "all", role: "all", status: "active", plan: "all" })}
        />
        <StatCard label="Monthly revenue" value={`$${totalMrr.toLocaleString()}`} deltaLabel="MRR"
          icon={DollarSign} accent
          hint="See exactly which users contribute to MRR"
          onClick={() => focusUsersTable({ view: "all", role: "all", status: "active", plan: "all" })}
        />
        <StatCard label="Retention"     value={`${retentionPct}%`} deltaLabel="excl. churned"  icon={TrendingUp}
          hint="View who's still retained — drill in to see what's driving retention"
          onClick={() => focusUsersTable({ view: "all", role: "all", status: "active", plan: "all" })}
        />
        <StatCard label="Churn rate"    value={`${churnPct}%`}     deltaLabel="of total users" icon={TrendingDown}
          hint="Click to see exactly which users have churned"
          onClick={() => focusUsersTable({ view: "all", role: "all", status: "churned", plan: "all" })}
        />
        <StatCard label="Client assignments" value={`${totalClients}`}
          deltaLabel={`${assignments.length} active trainer${assignments.length !== 1 ? "s" : ""}`} icon={Users}
          hint="View every trainer-assigned client"
          onClick={() => focusUsersTable({ view: "all", role: "client", status: "all", plan: "all" })}
        />
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
            {tierData.map((t) => {
              const pct = tierTotal > 0 ? Math.round((t.count / tierTotal) * 100) : 0;
              const isFiltered = planFilter === t.plan;
              return (
                <button
                  key={t.plan}
                  type="button"
                  onClick={() => {
                    setPlanFilter((prev) => (prev === t.plan ? "all" : t.plan));
                    setView("all");
                    if (typeof window !== "undefined") {
                      const tableEl = document.getElementById("admin-users-table");
                      tableEl?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }
                  }}
                  className={cn(
                    "w-full text-left rounded-xl px-2 py-1 -mx-2 transition-colors",
                    isFiltered ? "bg-white/[0.04]" : "hover:bg-white/[0.02]",
                  )}
                  title={`Filter user table to ${t.label}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <span className={cn("w-2 h-2 rounded-full", t.color)} />
                      <span className={cn("text-sm", isFiltered ? "text-white/90" : "text-white/70")}>{t.label}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-white/30 tabular-nums">{t.count} user{t.count !== 1 ? "s" : ""}</span>
                      {t.mrr > 0 && (
                        <span className="text-xs text-white/28 tabular-nums w-20 text-right">${t.mrr.toLocaleString()}/mo</span>
                      )}
                      <span className="text-xs font-semibold text-white/55 tabular-nums w-9 text-right">{pct}%</span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", t.color)} style={{ width: `${pct}%` }} />
                  </div>
                </button>
              );
            })}
          </div>
          <div className="pt-2 border-t border-white/5 flex items-center gap-6">
            <div>
              <p className="text-[10px] uppercase tracking-[0.15em] text-white/20 mb-0.5">MRR</p>
              <p className="text-sm font-semibold text-[#B48B40]">${totalMrr.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.15em] text-white/20 mb-0.5">ARR (projected)</p>
              <p className="text-sm font-semibold text-white/60">${(totalMrr * 12).toLocaleString()}</p>
            </div>
            <div className="ml-auto">
              <p className="text-[10px] uppercase tracking-[0.15em] text-white/20 mb-0.5">ARPPU</p>
              <p className="text-sm font-semibold text-white/60">${arppu}</p>
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
              {([
                atRiskUsers > 0 && {
                  color: "bg-amber-400",
                  text: `${atRiskUsers} user${atRiskUsers !== 1 ? "s" : ""} at risk of churning`,
                  status: "at-risk" as const,
                },
                trialUsers > 0 && {
                  color: "bg-[#93C5FD]",
                  text: `${trialUsers} user${trialUsers !== 1 ? "s" : ""} in free trial`,
                  status: "trial" as const,
                },
                pausedUsers > 0 && {
                  color: "bg-white/20",
                  text: `${pausedUsers} account${pausedUsers !== 1 ? "s" : ""} paused — no recent activity`,
                  status: "paused" as const,
                },
                churnedUsers > 0 && {
                  color: "bg-[#F87171]",
                  text: `${churnedUsers} user${churnedUsers !== 1 ? "s" : ""} churned`,
                  status: "churned" as const,
                },
              ].filter(Boolean) as Array<{ color: string; text: string; status: PlatformUser["status"] }>).map((a, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setStatusFilter((prev) => (prev === a.status ? "all" : a.status));
                    setView("all");
                    if (typeof window !== "undefined") {
                      document.getElementById("admin-users-table")?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }
                  }}
                  className="w-full flex items-start gap-2.5 text-left rounded-lg px-2 py-1 -mx-2 hover:bg-white/[0.03] transition-colors"
                  title={`Filter user table to ${a.status}`}
                >
                  <span className={cn("w-1.5 h-1.5 rounded-full mt-1.5 shrink-0", a.color)} />
                  <p className="text-xs text-white/42 leading-relaxed">{a.text}</p>
                </button>
              ))}
              {atRiskUsers === 0 && trialUsers === 0 && pausedUsers === 0 && churnedUsers === 0 && (
                <p className="text-xs text-white/25">No active alerts.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Trainer performance ─────────────────────────────────────── */}
      {trainerMetrics.length > 0 && (
        <div className="rounded-2xl border border-white/6 bg-[#111111] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.05]">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/22">Trainer Performance</p>
            <p className="text-sm font-medium text-white/75 mt-0.5">{trainerMetrics.length} trainer{trainerMetrics.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {trainerMetrics.map(({ trainer, metrics }) => {
              const initials = trainer.name.split(" ").map((n) => n[0]).join("").toUpperCase();
              return (
                <div key={trainer.id} className="px-5 py-4">
                  {/* Trainer identity */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-full bg-[#1C1C1C] border border-white/8 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-semibold text-white/45">{initials}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white/80">{trainer.name}</p>
                      <p className="text-[10px] text-white/28 mt-0.5">
                        {metrics.totalClients} client{metrics.totalClients !== 1 ? "s" : ""} · joined {trainer.joinDate}
                      </p>
                    </div>
                  </div>

                  {/* Metric grid */}
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                    <div className="rounded-xl border border-white/6 bg-white/[0.02] px-3 py-3">
                      <p className={cn(
                        "text-lg font-semibold tabular-nums",
                        metrics.avgAdherence >= 80 ? "text-emerald-400"
                        : metrics.avgAdherence >= 65 ? "text-amber-400"
                        : "text-[#F87171]"
                      )}>
                        {metrics.avgAdherence}%
                      </p>
                      <p className="text-[10px] text-white/25 mt-0.5">Avg adherence</p>
                    </div>
                    <div className="rounded-xl border border-white/6 bg-white/[0.02] px-3 py-3">
                      <p className="text-lg font-semibold tabular-nums text-white/90">{metrics.avgCheckInCompletion}%</p>
                      <p className="text-[10px] text-white/25 mt-0.5">Check-ins</p>
                    </div>
                    <div className="rounded-xl border border-white/6 bg-white/[0.02] px-3 py-3">
                      <p className="text-lg font-semibold tabular-nums text-white/90">{metrics.retentionRate}%</p>
                      <p className="text-[10px] text-white/25 mt-0.5">Retention</p>
                    </div>
                    <div className="rounded-xl border border-white/6 bg-white/[0.02] px-3 py-3">
                      <p className="text-lg font-semibold tabular-nums text-white/90">
                        {metrics.activeClients}
                        <span className="text-xs text-white/25 font-normal ml-1">active</span>
                      </p>
                      <p className="text-[10px] text-white/25 mt-0.5">
                        {metrics.atRiskClients > 0
                          ? <span className="text-amber-400/80">{metrics.atRiskClients} at risk</span>
                          : "No at-risk"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/6 bg-white/[0.02] px-3 py-3">
                      <p className="text-lg font-semibold text-white/90">{metrics.avgResponseTime}</p>
                      <p className="text-[10px] text-white/25 mt-0.5">Response time</p>
                    </div>
                    <div className="rounded-xl border border-white/6 bg-white/[0.02] px-3 py-3">
                      <p className={cn(
                        "text-lg font-semibold tabular-nums",
                        metrics.feedbackScore >= 4.5 ? "text-[#B48B40]"
                        : metrics.feedbackScore >= 3.5 ? "text-white/70"
                        : "text-[#F87171]"
                      )}>
                        {metrics.feedbackScore.toFixed(1)}
                      </p>
                      <p className="text-[10px] text-white/25 mt-0.5">Feedback score</p>
                    </div>
                  </div>

                  {/* Compact trend — full bar chart removed at user request */}
                  {metrics.adherenceTrend.length > 0 && (
                    <div className="mt-3 flex items-center gap-2">
                      <p className="text-[9px] uppercase tracking-[0.14em] text-white/18 shrink-0">7w trend</p>
                      <div className="flex items-end gap-[2px] h-3 flex-1 max-w-[120px]">
                        {metrics.adherenceTrend.map((v, i) => {
                          const isLast = i === metrics.adherenceTrend.length - 1;
                          return (
                            <div
                              key={i}
                              className="flex-1 rounded-[1px]"
                              style={{
                                height: `${v}%`,
                                minHeight: 2,
                                background: isLast ? "#B48B40" : "#B48B4030",
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── User table ──────────────────────────────────────────────── */}
      <div id="admin-users-table" className="rounded-2xl border border-white/6 bg-[#111111] overflow-hidden scroll-mt-6">
        <div className="px-5 py-4 border-b border-white/[0.05] flex flex-col gap-3">
          {/* View toggle + summary */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2">
              {([
                { id: "all" as const,      label: "All",      count: activeRoster.length },
                { id: "leads" as const,    label: "Members",  count: leadCount },
                { id: "archived" as const, label: "Archived", count: archivedCount },
              ]).map((v) => (
                <button
                  key={v.id}
                  onClick={() => { setView(v.id); setSelectedIds(new Set()); }}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                    view === v.id
                      ? "bg-[#B48B40]/15 text-[#B48B40] border border-[#B48B40]/30"
                      : "border border-transparent text-white/40 hover:text-white/70 hover:bg-white/[0.04]",
                  )}
                >
                  {v.label}
                  <span className="ml-1.5 text-[10px] text-white/35 tabular-nums">{v.count}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-white/30 sm:ml-auto tabular-nums">
              {filtered.length} of {view === "leads" ? leadCount : view === "archived" ? archivedCount : activeRoster.length}
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
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
            <div className="flex items-center gap-1">
              {(["all", "coaching", "performance", "training", "foundation"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPlanFilter(p)}
                  className={cn(
                    "rounded-lg px-2.5 py-1.5 text-[10px] font-medium transition-all capitalize",
                    planFilter === p ? "bg-white/8 text-white/70" : "text-white/28 hover:text-white/50"
                  )}
                >
                  {p === "all" ? "All plans" : (PLAN_CFG[p as keyof typeof PLAN_CFG]?.label ?? p)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-white/[0.05] bg-[#B48B40]/[0.04]">
            <p className="text-xs text-white/70 font-medium">
              {selectedIds.size} selected
            </p>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-white/40 hover:text-white/70 transition-colors"
            >
              Clear
            </button>
            <div className="ml-auto flex items-center gap-2">
              {view === "archived" ? (
                <button
                  onClick={() => void runBulkAction("unarchive", Array.from(selectedIds))}
                  disabled={!!bulkBusy}
                  className="flex items-center gap-1.5 rounded-xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-400/90 px-3 py-1.5 text-xs font-medium hover:bg-emerald-400/15 transition-colors disabled:opacity-50"
                >
                  <ArchiveRestore className="w-3.5 h-3.5" strokeWidth={1.5} />
                  {bulkBusy === "unarchive" ? "Unarchiving…" : "Unarchive"}
                </button>
              ) : (
                <button
                  onClick={() => void runBulkAction("archive", Array.from(selectedIds))}
                  disabled={!!bulkBusy}
                  className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.04] text-white/70 px-3 py-1.5 text-xs font-medium hover:bg-white/[0.08] transition-colors disabled:opacity-50"
                >
                  <Archive className="w-3.5 h-3.5" strokeWidth={1.5} />
                  {bulkBusy === "archive" ? "Archiving…" : "Archive"}
                </button>
              )}
              <button
                onClick={() => {
                  if (!confirm(`Permanently delete ${selectedIds.size} user${selectedIds.size !== 1 ? "s" : ""}? This cannot be undone.`)) return;
                  void runBulkAction("delete", Array.from(selectedIds));
                }}
                disabled={!!bulkBusy}
                className="flex items-center gap-1.5 rounded-xl border border-red-400/30 bg-red-400/10 text-red-400/90 px-3 py-1.5 text-xs font-medium hover:bg-red-400/15 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                {bulkBusy === "delete" ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        )}

        <div className="hidden md:grid grid-cols-[auto_2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-4 px-5 py-2.5 border-b border-white/[0.04]">
          <label className="flex items-center justify-center w-4 cursor-pointer">
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => { if (el) el.indeterminate = !allSelected && someSelected; }}
              onChange={() => {
                if (allSelected) setSelectedIds(new Set());
                else setSelectedIds(new Set(filtered.map((u) => u.id)));
              }}
              className="accent-[#B48B40] cursor-pointer"
              aria-label="Select all visible users"
            />
          </label>
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
            const initials = u.name.split(" ").map((n) => n[0]).join("").toUpperCase();
            const trainer  = u.trainerId ? users.find((x) => x.id === u.trainerId) : undefined;
            const checked  = selectedIds.has(u.id);
            const isSelf   = u.id === user.id;
            const canDelete = !isSelf;

            return (
              <div key={u.id} className={cn(
                "grid grid-cols-1 md:grid-cols-[auto_2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-2 md:gap-4 items-center px-5 py-3.5 hover:bg-white/[0.015] transition-colors",
                checked && "bg-[#B48B40]/[0.04]",
                u.archivedAt && "opacity-70",
              )}>
                <label className="hidden md:flex items-center justify-center w-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSelect(u.id)}
                    disabled={isSelf}
                    className="accent-[#B48B40] cursor-pointer disabled:cursor-not-allowed"
                    aria-label={`Select ${u.name}`}
                  />
                </label>
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
                    {u.archivedAt && (
                      <p className="text-[10px] text-amber-400/60 mt-0.5">Archived</p>
                    )}
                  </div>
                </div>
                <p className={cn("text-xs font-medium", rc.color)}>{rc.label}</p>
                <div>
                  <PlanPicker
                    userId={u.id}
                    currentPlan={u.plan}
                    disabled={isSelf || !!bulkBusy}
                    openId={openMenuId}
                    setOpenId={setOpenMenuId}
                    onChanged={() => void fetchUsers({ silent: true })}
                  />
                </div>
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
                      label: u.archivedAt ? "Unarchive" : "Archive",
                      icon: u.archivedAt
                        ? <ArchiveRestore className="w-3.5 h-3.5" strokeWidth={1.5} />
                        : <Archive className="w-3.5 h-3.5" strokeWidth={1.5} />,
                      disabled: isSelf || !!bulkBusy,
                      onClick: () => void handleArchiveUser(u),
                    },
                    {
                      label: "Delete",
                      icon: <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />,
                      danger: true,
                      disabled: !canDelete || !!bulkBusy,
                      onClick: () => void handleDeleteUser(u),
                    },
                  ]}
                />
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-white/25">
                {view === "leads"
                  ? "No self-signups yet — new members will appear here."
                  : view === "archived"
                  ? "No archived users."
                  : "No users match the current filters."}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Dev Tools: Account Reset ─────────────────────────────────────── */}
      <AccountResetPanel />
    </div>
  );
}

// ─── Account Reset Panel ──────────────────────────────────────────────────────

function AccountResetPanel() {
  const router = useRouter();
  const { user } = useUser();
  const [confirm, setConfirm] = useState(false);
  const [done,    setDone]    = useState(false);

  async function handleReset() {
    const sessionKey = getSessionKey();
    if (!sessionKey) return;
    const userId = user.id || sessionKeyToUserId(sessionKey);
    resetAccountLocalData(userId);
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId) && process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const { resetOnboardingState } = await import("@/lib/db/onboarding");
      await resetOnboardingState(userId);
    }
    setDone(true);
    setTimeout(() => {
      router.replace("/onboarding?mode=personal");
    }, 1200);
  }

  return (
    <div className="mt-8 rounded-2xl border border-red-400/12 bg-red-400/[0.03] px-6 py-5">
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="text-sm font-semibold text-white/60 mb-1">Admin — Retake My Personal Onboarding</p>
          <p className="text-xs text-white/30 leading-relaxed max-w-lg">
            Clears your personal onboarding answers and local training/nutrition test data, then opens the same setup flow a client sees.
            Your admin access, Supabase login, and platform role are preserved.
          </p>
        </div>
        <div className="shrink-0">
          {done ? (
              <p className="text-xs text-emerald-400/70 font-medium">Ready. Opening onboarding…</p>
          ) : !confirm ? (
            <button
              onClick={() => setConfirm(true)}
              className="text-xs font-semibold text-red-400/60 border border-red-400/20 bg-red-400/[0.04] hover:bg-red-400/[0.08] rounded-xl px-4 py-2 transition-all"
            >
              Reset my account data
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setConfirm(false)}
                className="text-xs text-white/30 hover:text-white/55 transition-colors px-2 py-1"
              >
                Cancel
              </button>
              <button
	              onClick={() => void handleReset()}
	              className="text-xs font-semibold text-white bg-red-500/80 hover:bg-red-500 rounded-xl px-4 py-2 transition-all"
	            >
	              Confirm and start
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
