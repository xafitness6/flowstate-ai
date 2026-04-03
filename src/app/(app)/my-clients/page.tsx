"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Users, Trash2, ExternalLink, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/context/UserContext";
import {
  initStore,
  getMyClients,
  getClientTrainingData,
  deleteUser,
  type PlatformUser,
  type ClientTrainingData,
  PermissionError,
} from "@/lib/data/store";
import { canTrainerViewAssignedClients } from "@/lib/roles";

// ─── Types ────────────────────────────────────────────────────────────────────

type ClientRow = PlatformUser & ClientTrainingData;

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_CFG = {
  active:    { label: "Active",   dot: "bg-emerald-400",   badge: "text-emerald-400 border-emerald-400/20 bg-emerald-400/8"  },
  "at-risk": { label: "At risk",  dot: "bg-amber-400",     badge: "text-amber-400 border-amber-400/20 bg-amber-400/8"        },
  paused:    { label: "Paused",   dot: "bg-white/30",      badge: "text-white/40 border-white/12 bg-white/[0.04]"            },
  churned:   { label: "Churned",  dot: "bg-[#F87171]",     badge: "text-[#F87171] border-[#F87171]/20 bg-[#F87171]/8"       },
  trial:     { label: "Trial",    dot: "bg-blue-400",      badge: "text-blue-400 border-blue-400/20 bg-blue-400/8"          },
} as const;

type FilterKey = "all" | "active" | "at-risk" | "paused";

// ─── Sub-components ───────────────────────────────────────────────────────────

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

function StatCard({
  label, value, sub, icon: Icon, accent,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  accent?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-2xl border bg-[#111111] px-5 py-4 flex flex-col gap-1",
      accent ? "border-[#B48B40]/22" : "border-white/6"
    )}>
      <div className="flex items-center gap-2 mb-0.5">
        <Icon className={cn("w-3.5 h-3.5", accent ? "text-[#B48B40]/60" : "text-white/22")} strokeWidth={1.5} />
        <p className="text-[10px] uppercase tracking-[0.16em] text-white/28">{label}</p>
      </div>
      <p className={cn("text-2xl font-light tabular-nums", accent ? "text-[#B48B40]" : "text-white/80")}>{value}</p>
      {sub && <p className="text-[10px] text-white/28">{sub}</p>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MyClientsPage() {
  const router       = useRouter();
  const { user }     = useUser();

  const [clients,  setClients ] = useState<ClientRow[]>([]);
  const [filter,   setFilter  ] = useState<FilterKey>("all");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error,    setError   ] = useState<string | null>(null);

  useEffect(() => {
    initStore();
    try {
      if (!canTrainerViewAssignedClients(user.role)) {
        router.replace("/");
        return;
      }
      const raw = getMyClients(user.role, user.id);
      const rows: ClientRow[] = raw.map((c) => ({ ...c, ...getClientTrainingData(c.id) }));
      setClients(rows);
    } catch (e) {
      if (e instanceof PermissionError) router.replace("/");
    }
  }, [user.role, user.id, router]);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const activeClients  = clients.filter((c) => c.status === "active");
  const atRiskClients  = clients.filter((c) => c.status === "at-risk");
  const avgCompliance  = activeClients.length > 0
    ? Math.round(activeClients.reduce((s, c) => s + c.adherence, 0) / activeClients.length)
    : 0;

  // ── Filter ─────────────────────────────────────────────────────────────────
  const visible = filter === "all"
    ? clients
    : clients.filter((c) => c.status === filter);

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function handleDelete(clientId: string) {
    if (!confirm("Remove this client? This cannot be undone.")) return;
    setDeleting(clientId);
    setError(null);
    try {
      const target = clients.find((c) => c.id === clientId);
      const res = await fetch(`/api/users/${clientId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-actor-role":  user.role,
          "x-actor-id":    user.id,
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(null);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="px-5 md:px-8 py-6 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-white/22 mb-1">My Clients</p>
        <h1 className="text-xl font-light text-white/90">
          {clients.length > 0 ? `${clients.length} assigned client${clients.length !== 1 ? "s" : ""}` : "No clients assigned"}
        </h1>
      </div>

      {/* Stats */}
      {clients.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total"       value={clients.length}        sub="assigned"       icon={Users}          accent />
          <StatCard label="Active"      value={activeClients.length}  sub="on track"       icon={CheckCircle2}               />
          <StatCard label="Avg compliance" value={`${avgCompliance}%`}  sub="active clients" icon={TrendingUp}                />
          <StatCard label="At risk"     value={atRiskClients.length}  sub="need attention" icon={AlertTriangle}              />
        </div>
      )}

      {/* Filter tabs */}
      {clients.length > 0 && (
        <div className="flex items-center gap-1">
          {(["all", "active", "at-risk", "paused"] as FilterKey[]).map((f) => {
            const count = f === "all" ? clients.length : clients.filter((c) => c.status === f).length;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize",
                  filter === f
                    ? "bg-[#B48B40]/12 text-[#B48B40] border border-[#B48B40]/20"
                    : "text-white/35 hover:text-white/60 hover:bg-white/[0.04] border border-transparent"
                )}
              >
                {f === "at-risk" ? "At risk" : f.charAt(0).toUpperCase() + f.slice(1)}
                <span className="ml-1.5 text-[10px] opacity-60">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400/70 px-1">{error}</p>
      )}

      {/* Client table */}
      <div className="rounded-2xl border border-white/6 bg-[#111111] overflow-hidden">

        {clients.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Users className="w-8 h-8 text-white/10 mx-auto mb-3" strokeWidth={1} />
            <p className="text-sm text-white/28">No clients assigned to you yet.</p>
            <p className="text-xs text-white/18 mt-1">Clients assigned with your ID will appear here.</p>
          </div>
        ) : (
          <>
            {/* Column headers */}
            <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-5 py-2.5 border-b border-white/[0.04]">
              {["Client", "Status", "Compliance", "Check-ins", "Last active", ""].map((col) => (
                <p key={col} className="text-[10px] uppercase tracking-[0.14em] text-white/22">{col}</p>
              ))}
            </div>

            <div className="divide-y divide-white/[0.04]">
              {visible.map((c) => {
                const sc = STATUS_CFG[c.status as keyof typeof STATUS_CFG] ?? STATUS_CFG.active;
                const initials   = c.name.split(" ").map((n) => n[0]).join("").toUpperCase();
                const isInactive = c.status === "paused" || c.status === "churned";
                const isDeleting = deleting === c.id;

                return (
                  <div
                    key={c.id}
                    className="grid grid-cols-1 gap-2 md:gap-4 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] items-center px-5 py-3.5"
                  >
                    {/* Client identity */}
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-full border flex items-center justify-center shrink-0",
                        isInactive ? "bg-[#1A1A1A] border-white/5" : "bg-[#1C1C1C] border-white/8"
                      )}>
                        <span className={cn("text-[10px] font-semibold", isInactive ? "text-white/25" : "text-white/45")}>
                          {initials}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className={cn("text-sm font-medium", isInactive ? "text-white/40" : "text-white/80")}>{c.name}</p>
                          <span className={cn(
                            "text-[9px] font-semibold uppercase tracking-wider",
                            c.plan === "elite" ? "text-[#B48B40]" : "text-white/28"
                          )}>
                            {c.plan}
                          </span>
                        </div>
                        <p className="text-[10px] text-white/28 truncate">{c.program}</p>
                      </div>
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-1.5">
                      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", sc.dot)} />
                      <span className={cn(
                        "text-[10px] font-medium tracking-[0.06em] uppercase px-1.5 py-0.5 rounded-md border",
                        sc.badge
                      )}>
                        {sc.label}
                      </span>
                    </div>

                    {/* Compliance */}
                    {isInactive ? (
                      <span className="text-xs text-white/18">—</span>
                    ) : (
                      <PctBar
                        value={c.adherence}
                        color={c.adherence >= 80 ? "bg-emerald-400/70" : c.adherence >= 65 ? "bg-amber-400/70" : "bg-[#F87171]/70"}
                      />
                    )}

                    {/* Check-ins */}
                    <span className={cn("text-xs tabular-nums", isInactive ? "text-white/18" : "text-white/55")}>
                      {isInactive ? "—" : `${c.checkInCompletion}%`}
                    </span>

                    {/* Last active */}
                    <span className="text-xs text-white/28 tabular-nums">{c.lastActive}</span>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => router.push(`/admin`)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-transparent hover:border-white/10 hover:bg-white/[0.04] text-white/18 hover:text-white/50 transition-all"
                        title="View in platform"
                      >
                        <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.5} />
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        disabled={isDeleting}
                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-transparent hover:border-red-400/20 hover:bg-red-400/8 text-white/18 hover:text-red-400/70 transition-all disabled:opacity-30"
                        title="Remove client"
                      >
                        <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>
                );
              })}

              {visible.length === 0 && (
                <div className="px-5 py-8 text-center">
                  <p className="text-sm text-white/25">No clients match this filter.</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
