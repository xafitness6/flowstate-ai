"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Users, Trash2, ExternalLink, TrendingUp, AlertTriangle, CheckCircle2, UserPlus, X, Copy, Check, Mail } from "lucide-react";
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
import {
  createInvite,
  getInvitesByTrainer,
  revokeInvite,
  getInviteUrl,
  type Invite,
} from "@/lib/invites";
import { getOpenLeads, type StoredAccount } from "@/lib/accounts";
import { loadOnboardingState } from "@/lib/onboarding";

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

  const [clients,         setClients        ] = useState<ClientRow[]>([]);
  const [invites,         setInvites        ] = useState<Invite[]>([]);
  const [leads,           setLeads          ] = useState<StoredAccount[]>([]);
  const [filter,          setFilter         ] = useState<FilterKey>("all");
  const [deleting,        setDeleting       ] = useState<string | null>(null);
  const [error,           setError          ] = useState<string | null>(null);
  const [showInvite,      setShowInvite     ] = useState(false);
  const [copiedToken,     setCopiedToken    ] = useState<string | null>(null);
  const [copiedOpenLink,  setCopiedOpenLink ] = useState(false);

  // Invite form
  const [invFirst,    setInvFirst  ] = useState("");
  const [invLast,     setInvLast   ] = useState("");
  const [invEmail,    setInvEmail  ] = useState("");
  const [invMessage,  setInvMessage] = useState("");
  const [invError,    setInvError  ] = useState<string | null>(null);
  const [invCreated,  setInvCreated] = useState<Invite | null>(null);

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
      setInvites(getInvitesByTrainer(user.id));
      setLeads(getOpenLeads(user.id));
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

  // ── Invite ─────────────────────────────────────────────────────────────────
  function handleSendInvite(e: React.FormEvent) {
    e.preventDefault();
    setInvError(null);
    if (!invFirst.trim()) { setInvError("First name required."); return; }
    if (!invLast.trim())  { setInvError("Last name required.");  return; }
    if (!invEmail.trim() || !invEmail.includes("@")) { setInvError("Valid email required."); return; }

    const inv = createInvite({
      firstName:           invFirst.trim(),
      lastName:            invLast.trim(),
      inviteEmail:         invEmail.trim(),
      message:             invMessage.trim(),
      invitedByUserId:     user.id,
      invitedByName:       user.name,
      assignedTrainerId:   user.id,
      assignedTrainerName: user.name,
    });
    setInvites((prev) => [inv, ...prev]);
    setInvCreated(inv);
    setInvFirst(""); setInvLast(""); setInvEmail(""); setInvMessage("");
  }

  async function handleCopyLink(token: string) {
    const url = getInviteUrl(token);
    try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  }

  async function handleCopyOpenLink() {
    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/join?trainer=${user.id}`;
    try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
    setCopiedOpenLink(true);
    setTimeout(() => setCopiedOpenLink(false), 2000);
  }

  function getLeadStatus(lead: StoredAccount): { label: string; badge: string } {
    const s = loadOnboardingState(lead.id);
    if (s.programGenerated) return { label: "Active",        badge: "text-emerald-400 border-emerald-400/20 bg-emerald-400/8" };
    if (s.onboardingComplete) return { label: "In onboarding", badge: "text-amber-400 border-amber-400/20 bg-amber-400/8" };
    return { label: "New lead", badge: "text-blue-400 border-blue-400/20 bg-blue-400/8" };
  }

  function relativeTime(ts: number): string {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function handleRevokeInvite(inviteId: string) {
    revokeInvite(inviteId);
    setInvites((prev) => prev.map((i) => i.inviteId === inviteId ? { ...i, inviteStatus: "revoked" } : i));
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="px-5 md:px-8 py-6 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/22 mb-1">My Clients</p>
          <h1 className="text-xl font-light text-white/90">
            {clients.length > 0 ? `${clients.length} assigned client${clients.length !== 1 ? "s" : ""}` : "No clients assigned"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyOpenLink}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all",
              copiedOpenLink
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-400"
                : "border-white/10 bg-white/[0.04] text-white/40 hover:text-white/70 hover:border-white/18"
            )}
          >
            {copiedOpenLink
              ? <><Check className="w-3.5 h-3.5" strokeWidth={2} /> Copied</>
              : <><Copy className="w-3.5 h-3.5" strokeWidth={1.5} /> Open invite link</>}
          </button>
          <button
            onClick={() => { setShowInvite(true); setInvCreated(null); setInvError(null); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#B48B40]/12 border border-[#B48B40]/25 text-[#B48B40] text-xs font-semibold hover:bg-[#B48B40]/20 transition-all"
          >
            <UserPlus className="w-3.5 h-3.5" strokeWidth={2} />
            Invite Client
          </button>
        </div>
      </div>

      {/* ── Invite modal ────────────────────────────────────────────────────── */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#111111] border border-white/8 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <p className="text-sm font-semibold text-white/80">Invite Client</p>
              <button onClick={() => setShowInvite(false)} className="text-white/30 hover:text-white/60 transition-colors">
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>

            <div className="px-5 py-5">
              {invCreated ? (
                <div className="space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center shrink-0">
                      <Check className="w-4 h-4 text-emerald-400" strokeWidth={2} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white/80">Invite created</p>
                      <p className="text-xs text-white/35">{invCreated.firstName} {invCreated.lastName} · {invCreated.inviteEmail}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/30">Invite link</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2.5 min-w-0">
                        <p className="text-xs text-white/40 truncate">{getInviteUrl(invCreated.inviteToken)}</p>
                      </div>
                      <button
                        onClick={() => handleCopyLink(invCreated.inviteToken)}
                        className={cn(
                          "shrink-0 w-9 h-9 rounded-xl border flex items-center justify-center transition-all",
                          copiedToken === invCreated.inviteToken
                            ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-400"
                            : "border-white/10 bg-white/[0.04] text-white/40 hover:text-white/70"
                        )}
                      >
                        {copiedToken === invCreated.inviteToken
                          ? <Check className="w-3.5 h-3.5" strokeWidth={2} />
                          : <Copy className="w-3.5 h-3.5" strokeWidth={1.5} />}
                      </button>
                    </div>
                    <p className="text-[10px] text-white/22">Expires in 7 days · Share this link with your client</p>
                  </div>

                  <button
                    onClick={() => { setInvCreated(null); }}
                    className="w-full text-center text-xs text-white/30 hover:text-white/50 transition-colors py-1"
                  >
                    Send another invite
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSendInvite} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] uppercase tracking-[0.18em] text-white/30">First name</label>
                      <input
                        type="text"
                        value={invFirst}
                        onChange={(e) => { setInvFirst(e.target.value); setInvError(null); }}
                        className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-white/20 transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] uppercase tracking-[0.18em] text-white/30">Last name</label>
                      <input
                        type="text"
                        value={invLast}
                        onChange={(e) => { setInvLast(e.target.value); setInvError(null); }}
                        className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-white/20 transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] uppercase tracking-[0.18em] text-white/30">Email</label>
                    <input
                      type="email"
                      value={invEmail}
                      onChange={(e) => { setInvEmail(e.target.value); setInvError(null); }}
                      className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-white/20 transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] uppercase tracking-[0.18em] text-white/30">Message <span className="normal-case text-white/20">(optional)</span></label>
                    <textarea
                      value={invMessage}
                      onChange={(e) => setInvMessage(e.target.value)}
                      rows={2}
                      placeholder="Add a personal message…"
                      className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/18 outline-none focus:border-white/20 transition-all resize-none"
                    />
                  </div>

                  {invError && <p className="text-xs text-red-400/70">{invError}</p>}

                  <button
                    type="submit"
                    disabled={!invFirst || !invLast || !invEmail}
                    className={cn(
                      "w-full rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-all",
                      invFirst && invLast && invEmail
                        ? "bg-[#B48B40] text-black hover:bg-[#c99840]"
                        : "bg-white/5 text-white/25 cursor-default"
                    )}
                  >
                    <Mail className="w-4 h-4" strokeWidth={2} />
                    Create invite link
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Pending invites ──────────────────────────────────────────────────── */}
      {invites.filter((i) => i.inviteStatus === "pending" || i.inviteStatus === "sent").length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/22">Pending invites</p>
          <div className="rounded-2xl border border-white/6 bg-[#111111] divide-y divide-white/[0.04]">
            {invites
              .filter((i) => i.inviteStatus === "pending" || i.inviteStatus === "sent")
              .map((inv) => (
                <div key={inv.inviteId} className="flex items-center justify-between px-5 py-3.5">
                  <div>
                    <p className="text-sm text-white/70">{inv.firstName} {inv.lastName}</p>
                    <p className="text-xs text-white/30">{inv.inviteEmail}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopyLink(inv.inviteToken)}
                      className={cn(
                        "text-xs px-2.5 py-1.5 rounded-lg border transition-all flex items-center gap-1.5",
                        copiedToken === inv.inviteToken
                          ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-400"
                          : "border-white/10 text-white/35 hover:text-white/60"
                      )}
                    >
                      {copiedToken === inv.inviteToken
                        ? <><Check className="w-3 h-3" strokeWidth={2} /> Copied</>
                        : <><Copy className="w-3 h-3" strokeWidth={1.5} /> Copy link</>}
                    </button>
                    <button
                      onClick={() => handleRevokeInvite(inv.inviteId)}
                      className="text-white/18 hover:text-red-400/60 transition-colors"
                      title="Revoke invite"
                    >
                      <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ── Open invite leads ────────────────────────────────────────────────── */}
      {leads.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/22">Open invite leads</p>
            <span className="text-[10px] text-white/22">{leads.length} lead{leads.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="rounded-2xl border border-white/6 bg-[#111111] divide-y divide-white/[0.04]">
            {leads.map((lead) => {
              const { label, badge } = getLeadStatus(lead);
              const initials = (lead.name || `${lead.firstName ?? ""} ${lead.lastName ?? ""}`.trim() || "?")
                .split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
              return (
                <div key={lead.id} className="flex items-center justify-between px-5 py-3.5 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-[#1C1C1C] border border-white/8 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-semibold text-white/40">{initials}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-white/75 font-medium truncate">{lead.name || `${lead.firstName ?? ""} ${lead.lastName ?? ""}`.trim()}</p>
                      <p className="text-xs text-white/30 truncate">{lead.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={cn("text-[10px] font-medium tracking-[0.06em] uppercase px-1.5 py-0.5 rounded-md border", badge)}>
                      {label}
                    </span>
                    <span className="text-[11px] text-white/22">{relativeTime(lead.createdAt)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
                            (c.plan === "performance" || c.plan === "coaching") ? "text-[#B48B40]" : "text-white/28"
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
