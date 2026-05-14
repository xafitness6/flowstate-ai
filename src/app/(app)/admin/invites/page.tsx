"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ChevronLeft, Plus, Copy, Check, Link as LinkIcon,
  Users, User, Loader2, AlertCircle, X, Trash2, Ban, Mail, Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import type { Invite, Role } from "@/lib/supabase/types";

type Trainer = { id: string; full_name: string | null; email: string };

type CreatedInvite = { invite: Invite; url: string };

export default function AdminInvitesPage() {
  const adminReady = useAdminGuard();

  const [invites,  setInvites]  = useState<Invite[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [created,  setCreated]  = useState<CreatedInvite | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Form state
  const [role,        setRole]        = useState<"member" | "client">("member");
  const [email,       setEmail]       = useState("");
  const [firstName,   setFirstName]   = useState("");
  const [lastName,    setLastName]    = useState("");
  const [trainerId,   setTrainerId]   = useState("");
  const [message,     setMessage]     = useState("");
  const [submitting,  setSubmitting]  = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [invRes, userRes] = await Promise.all([
        fetch("/api/admin/invites",  { cache: "no-store" }),
        fetch("/api/admin/users",     { cache: "no-store" }),
      ]);
      const invJson  = await invRes.json()  as { invites?: Invite[]; error?: string };
      const userJson = await userRes.json() as { users?: Array<Trainer & { role: Role }>; error?: string };

      if (!invRes.ok  || invJson.error)  throw new Error(invJson.error  ?? "Failed to load invites");
      if (!userRes.ok || userJson.error) throw new Error(userJson.error ?? "Failed to load trainers");

      setInvites(invJson.invites ?? []);
      setTrainers((userJson.users ?? []).filter((u) => u.role === "trainer"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!adminReady) return;
    void fetchData();
  }, [adminReady, fetchData]);

  async function handleCreate() {
    setSubmitting(true);
    setError(null);
    try {
      const trainer = trainers.find((t) => t.id === trainerId);
      const res = await fetch("/api/admin/invites", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          role,
          email:       email || undefined,
          firstName,
          lastName,
          trainerId:   trainerId || undefined,
          trainerName: trainer ? (trainer.full_name ?? trainer.email) : undefined,
          message,
        }),
      });
      const data = await res.json() as { invite?: Invite; url?: string; error?: string };
      if (!res.ok || !data.invite || !data.url) throw new Error(data.error ?? "Create failed");

      setCreated({ invite: data.invite, url: data.url });
      setInvites((prev) => [data.invite!, ...prev]);
      // Clear form for next one
      setEmail(""); setFirstName(""); setLastName(""); setMessage("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm("Revoke this invite? The link will stop working immediately.")) return;
    try {
      const res = await fetch(`/api/admin/invites/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status: "revoked" }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "Revoke failed");
      setInvites((prev) => prev.map((i) => i.id === id ? { ...i, invite_status: "revoked" } : i));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Revoke failed");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this invite permanently?")) return;
    try {
      const res = await fetch(`/api/admin/invites/${id}`, { method: "DELETE" });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "Delete failed");
      setInvites((prev) => prev.filter((i) => i.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function copyLink(url: string, token: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken((t) => (t === token ? null : t)), 2000);
    } catch { /* ignore */ }
  }

  if (!adminReady) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-white">
        <div className="flex items-center gap-2 text-sm text-white/55">
          <Loader2 className="w-4 h-4 animate-spin" /> Opening invites…
        </div>
      </div>
    );
  }

  const pending = invites.filter((i) => i.invite_status === "pending").length;
  const accepted = invites.filter((i) => i.invite_status === "accepted").length;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white pb-24">
      <div className="px-5 md:px-8 pt-6 max-w-4xl mx-auto">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/80 transition-colors mb-4"
        >
          <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2} />
          Back to admin
        </Link>

        <div className="flex items-start justify-between mb-6 gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-white/35 mb-2">Invites</p>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Take new clients</h1>
            <p className="text-xs text-white/45 mt-2 max-w-md leading-relaxed">
              Generate signup links for members and clients. Pre-assign a trainer if needed. Each link expires in 7 days.
            </p>
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-[#B48B40] text-black px-3 py-2 text-xs font-semibold hover:bg-[#c99840] transition-all"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
            New invite
          </button>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <StatTile label="Total" value={invites.length} />
          <StatTile label="Pending" value={pending} accent="text-[#B48B40]" />
          <StatTile label="Accepted" value={accepted} accent="text-emerald-300" />
        </div>

        {error && (
          <Card className="mb-4 border-red-400/20">
            <div className="px-4 py-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400/80 shrink-0 mt-0.5" strokeWidth={2} />
              <p className="text-xs text-red-300/85">{error}</p>
            </div>
          </Card>
        )}

        {/* Created modal — surfaces the link to copy */}
        {created && (
          <Card className="mb-4 border-emerald-400/25 bg-emerald-400/[0.03]">
            <div className="px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" strokeWidth={2.5} />
                  <p className="text-sm font-semibold text-white/95">Invite created</p>
                </div>
                <button onClick={() => setCreated(null)} className="text-white/35 hover:text-white/75">
                  <X className="w-4 h-4" strokeWidth={2} />
                </button>
              </div>
              <p className="text-[11px] text-white/45 mb-3">
                Share this link. The new account is granted the <span className="text-[#B48B40]">{created.invite.invite_role}</span> role
                {created.invite.assigned_trainer_name && ` and assigned to ${created.invite.assigned_trainer_name}`}.
              </p>
              <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5">
                <LinkIcon className="w-3.5 h-3.5 text-white/35 shrink-0" strokeWidth={1.7} />
                <code className="text-xs text-white/80 flex-1 truncate font-mono">{created.url}</code>
                <button
                  onClick={() => copyLink(created.url, created.invite.invite_token)}
                  className={cn(
                    "shrink-0 rounded-lg px-2 py-1 text-[10px] font-semibold transition-all flex items-center gap-1",
                    copiedToken === created.invite.invite_token
                      ? "bg-emerald-500/15 text-emerald-300 border border-emerald-400/25"
                      : "bg-[#B48B40] text-black hover:bg-[#c99840]",
                  )}
                >
                  {copiedToken === created.invite.invite_token
                    ? <><Check className="w-3 h-3" strokeWidth={2.5} /> Copied</>
                    : <><Copy className="w-3 h-3" strokeWidth={2} /> Copy</>}
                </button>
              </div>
            </div>
          </Card>
        )}

        {/* New-invite form */}
        {showForm && (
          <Card className="mb-6">
            <div className="px-5 py-5 space-y-5">
              <SectionHeader>New invite</SectionHeader>

              <div>
                <label className="text-[10px] uppercase tracking-[0.18em] text-white/30 block mb-2">Role granted on signup</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setRole("member")}
                    className={cn(
                      "rounded-xl border px-3 py-2.5 text-left transition-all",
                      role === "member"
                        ? "border-[#B48B40]/40 bg-[#B48B40]/[0.06]"
                        : "border-white/8 bg-white/[0.02] hover:border-white/15",
                    )}
                  >
                    <p className={cn("text-sm font-medium", role === "member" ? "text-[#B48B40]" : "text-white/80")}>Member</p>
                    <p className="text-[10px] text-white/35 mt-0.5">Self-directed — uses app on their own</p>
                  </button>
                  <button
                    onClick={() => setRole("client")}
                    className={cn(
                      "rounded-xl border px-3 py-2.5 text-left transition-all",
                      role === "client"
                        ? "border-[#B48B40]/40 bg-[#B48B40]/[0.06]"
                        : "border-white/8 bg-white/[0.02] hover:border-white/15",
                    )}
                  >
                    <p className={cn("text-sm font-medium", role === "client" ? "text-[#B48B40]" : "text-white/80")}>Client</p>
                    <p className="text-[10px] text-white/35 mt-0.5">Trainer-assigned — coach manages their program</p>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-[0.18em] text-white/30 block mb-2">
                  Assign to trainer {role === "client" ? "(recommended)" : "(optional)"}
                </label>
                <select
                  value={trainerId}
                  onChange={(e) => setTrainerId(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/8 rounded-xl px-3 py-2 text-sm text-white/85 outline-none focus:border-[#B48B40]/40 transition-colors"
                >
                  <option value="" className="bg-[#1A1A1A]">— No trainer (self-directed) —</option>
                  {trainers.map((t) => (
                    <option key={t.id} value={t.id} className="bg-[#1A1A1A]">
                      {t.full_name?.trim() || t.email}
                    </option>
                  ))}
                </select>
                {trainers.length === 0 && (
                  <p className="text-[11px] text-white/35 mt-1.5">No trainers in the system yet — invite a trainer first.</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-[0.18em] text-white/30 block mb-2">First name (optional)</label>
                  <input
                    type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Jane"
                    className="w-full bg-white/[0.03] border border-white/8 rounded-xl px-3 py-2 text-sm text-white/85 placeholder:text-white/25 outline-none focus:border-[#B48B40]/40 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-[0.18em] text-white/30 block mb-2">Last name (optional)</label>
                  <input
                    type="text" value={lastName} onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                    className="w-full bg-white/[0.03] border border-white/8 rounded-xl px-3 py-2 text-sm text-white/85 placeholder:text-white/25 outline-none focus:border-[#B48B40]/40 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-[0.18em] text-white/30 block mb-2">Email (optional — open link if blank)</label>
                <input
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@example.com"
                  className="w-full bg-white/[0.03] border border-white/8 rounded-xl px-3 py-2 text-sm text-white/85 placeholder:text-white/25 outline-none focus:border-[#B48B40]/40 transition-colors"
                />
                <p className="text-[11px] text-white/35 mt-1.5">
                  Leave blank to generate a reusable open link you can share anywhere.
                </p>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-[0.18em] text-white/30 block mb-2">Personal note (optional)</label>
                <textarea
                  value={message} onChange={(e) => setMessage(e.target.value)}
                  rows={2}
                  placeholder="Looking forward to working with you. Click the link to set up your account."
                  className="w-full bg-white/[0.03] border border-white/8 rounded-xl px-3 py-2 text-sm text-white/85 placeholder:text-white/25 outline-none focus:border-[#B48B40]/40 transition-colors resize-none leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setShowForm(false)}
                  className="rounded-xl px-4 py-2 text-sm text-white/55 hover:text-white/85 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void handleCreate()}
                  disabled={submitting}
                  className="rounded-xl bg-[#B48B40] text-black px-4 py-2 text-sm font-semibold hover:bg-[#c99840] disabled:opacity-50 transition-all flex items-center gap-2"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {submitting ? "Creating…" : "Generate link"}
                </button>
              </div>
            </div>
          </Card>
        )}

        {/* Invites list */}
        <SectionHeader>All invites</SectionHeader>
        {loading && invites.length === 0 ? (
          <div className="py-12 flex items-center justify-center text-white/45">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading…
          </div>
        ) : invites.length === 0 ? (
          <Card>
            <div className="px-6 py-12 text-center text-white/35 text-sm">
              No invites yet. Click <span className="text-white/65">New invite</span> to create one.
            </div>
          </Card>
        ) : (
          <div className="space-y-2">
            {invites.map((inv) => {
              const url = `${typeof window !== "undefined" ? window.location.origin : ""}/invite/${inv.invite_token}`;
              const isActive = inv.invite_status === "pending";
              const isAccepted = inv.invite_status === "accepted";
              return (
                <Card key={inv.id}>
                  <div className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        <span className={cn(
                          "text-[10px] uppercase tracking-[0.18em] px-2 py-0.5 rounded-full border whitespace-nowrap",
                          inv.invite_role === "member"
                            ? "text-[#93C5FD] border-[#93C5FD]/25 bg-[#93C5FD]/[0.06]"
                            : "text-[#B48B40] border-[#B48B40]/30 bg-[#B48B40]/[0.06]",
                        )}>
                          {inv.invite_role}
                        </span>
                        <span className={cn(
                          "text-[10px] uppercase tracking-[0.15em] px-2 py-0.5 rounded-full border whitespace-nowrap",
                          isActive ? "text-emerald-300 border-emerald-400/25 bg-emerald-400/[0.06]"
                          : isAccepted ? "text-white/55 border-white/12 bg-white/[0.03]"
                          : "text-white/35 border-white/10 bg-white/[0.02]",
                        )}>
                          {inv.invite_status}
                        </span>
                        {inv.invite_email && (
                          <span className="flex items-center gap-1 text-[11px] text-white/60 truncate min-w-0">
                            <Mail className="w-3 h-3 text-white/30" strokeWidth={1.7} />
                            <span className="truncate">{inv.invite_email}</span>
                          </span>
                        )}
                        {!inv.invite_email && (
                          <span className="text-[11px] text-white/40">Open link</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-[11px] text-white/40 mb-3 flex-wrap">
                      {(inv.first_name || inv.last_name) && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" strokeWidth={1.7} />
                          {[inv.first_name, inv.last_name].filter(Boolean).join(" ")}
                        </span>
                      )}
                      {inv.assigned_trainer_name && (
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" strokeWidth={1.7} />
                          Trainer: {inv.assigned_trainer_name}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" strokeWidth={1.7} />
                        {new Date(inv.invited_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>

                    {isActive && (
                      <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 mb-2">
                        <LinkIcon className="w-3 h-3 text-white/35 shrink-0" strokeWidth={1.7} />
                        <code className="text-[11px] text-white/65 flex-1 truncate font-mono">{url}</code>
                        <button
                          onClick={() => copyLink(url, inv.invite_token)}
                          className={cn(
                            "shrink-0 rounded-lg px-2 py-1 text-[10px] font-medium transition-all flex items-center gap-1",
                            copiedToken === inv.invite_token
                              ? "text-emerald-300"
                              : "text-white/55 hover:text-white/85",
                          )}
                        >
                          {copiedToken === inv.invite_token
                            ? <><Check className="w-3 h-3" strokeWidth={2.5} /> Copied</>
                            : <><Copy className="w-3 h-3" strokeWidth={2} /> Copy</>}
                        </button>
                      </div>
                    )}

                    <div className="flex items-center gap-2 mt-1">
                      {isActive && (
                        <button
                          onClick={() => void handleRevoke(inv.id)}
                          className="text-[11px] text-white/40 hover:text-amber-300/80 transition-colors flex items-center gap-1"
                        >
                          <Ban className="w-3 h-3" strokeWidth={1.7} />
                          Revoke
                        </button>
                      )}
                      <button
                        onClick={() => void handleDelete(inv.id)}
                        className="text-[11px] text-white/40 hover:text-red-300/80 transition-colors flex items-center gap-1 ml-auto"
                      >
                        <Trash2 className="w-3 h-3" strokeWidth={1.7} />
                        Delete
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatTile({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <Card>
      <div className="px-4 py-3">
        <p className={cn("text-2xl font-semibold tabular-nums", accent ?? "text-white/90")}>{value}</p>
        <p className="text-[10px] uppercase tracking-[0.18em] text-white/35 mt-1">{label}</p>
      </div>
    </Card>
  );
}
