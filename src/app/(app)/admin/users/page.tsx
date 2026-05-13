"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Users, RefreshCw, Search, ChevronLeft,
  CheckCircle2, Clock, AlertCircle, ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { PLAN_LABELS } from "@/lib/plans";
import type { Role, Plan, SubscriptionStatus } from "@/lib/supabase/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type AdminUser = {
  id:                   string;
  email:                string;
  full_name:            string | null;
  role:                 Role;
  plan:                 Plan;
  subscription_status:  SubscriptionStatus;
  onboarding_complete:  boolean;
  stripe_customer_id:   string | null;
  created_at:           string;
};

type SaveState = "idle" | "saving" | "saved" | "error";

// ─── Config ───────────────────────────────────────────────────────────────────

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "member",  label: "Member"  },
  { value: "client",  label: "Client"  },
  { value: "trainer", label: "Trainer" },
  { value: "master",  label: "Admin"   },
];

const PLAN_OPTIONS: { value: Plan; label: string }[] = [
  { value: "foundation",  label: "Foundation" },
  { value: "training",    label: "Core"        },
  { value: "performance", label: "Pro"         },
  { value: "coaching",    label: "Elite"       },
];

const STATUS_OPTIONS: { value: SubscriptionStatus; label: string }[] = [
  { value: "inactive",  label: "Inactive"  },
  { value: "active",    label: "Active"    },
  { value: "past_due",  label: "Past due"  },
];

const ROLE_COLOR: Record<Role, string> = {
  master:  "text-emerald-400/80",
  trainer: "text-[#B48B40]/80",
  client:  "text-[#93C5FD]/70",
  member:  "text-white/35",
};

const PLAN_COLOR: Record<Plan, string> = {
  coaching:    "text-purple-400",
  performance: "text-[#B48B40]",
  training:    "text-[#93C5FD]/70",
  foundation:  "text-white/30",
};

const STATUS_COLOR: Record<SubscriptionStatus, string> = {
  active:   "text-emerald-400",
  past_due: "text-amber-400",
  inactive: "text-white/30",
};

// ─── Inline select ────────────────────────────────────────────────────────────

function InlineSelect<T extends string>({
  value, options, onChange, colorMap, disabled,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  colorMap?: Record<string, string>;
  disabled?: boolean;
}) {
  const color = colorMap?.[value] ?? "text-white/60";
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as T)}
      className={cn(
        "bg-transparent border-none outline-none cursor-pointer text-xs font-medium appearance-none",
        "hover:text-white/90 transition-colors pr-1",
        color,
        disabled && "opacity-40 cursor-not-allowed",
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-[#1A1A1A] text-white">
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ─── Status icon ──────────────────────────────────────────────────────────────

function SaveIcon({ state }: { state: SaveState }) {
  if (state === "saving") return <RefreshCw className="w-3 h-3 text-white/30 animate-spin" strokeWidth={2} />;
  if (state === "saved")  return <CheckCircle2 className="w-3 h-3 text-emerald-400/60" strokeWidth={2} />;
  if (state === "error")  return <AlertCircle className="w-3 h-3 text-red-400/60" strokeWidth={2} />;
  return null;
}

// ─── User row ─────────────────────────────────────────────────────────────────

function UserRow({ user, onUpdate }: {
  user: AdminUser;
  onUpdate: (id: string, patch: Partial<AdminUser>) => Promise<void>;
}) {
  const [local,     setLocal    ] = useState(user);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const isMasterTarget = user.role === "master";

  async function patch(changes: Partial<AdminUser>) {
    const next = { ...local, ...changes };
    setLocal(next);
    setSaveState("saving");
    try {
      await onUpdate(user.id, changes);
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
    } catch {
      setLocal(local); // revert
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 3000);
    }
  }

  const joined = new Date(user.created_at).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });

  return (
    <tr className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors group">
      {/* Email + name */}
      <td className="px-4 py-3 min-w-0">
        <p className="text-xs text-white/80 font-medium truncate max-w-[200px]">{user.email}</p>
        {user.full_name && (
          <p className="text-[10px] text-white/30 mt-0.5 truncate max-w-[200px]">{user.full_name}</p>
        )}
      </td>

      {/* Role */}
      <td className="px-4 py-3 whitespace-nowrap">
        <InlineSelect
          value={local.role}
          options={ROLE_OPTIONS}
          colorMap={ROLE_COLOR}
          onChange={(v) => {
            if (v === "master" && !confirm(`Promote ${user.email} to Admin? This grants full platform access.`)) return;
            void patch({ role: v });
          }}
        />
      </td>

      {/* Plan */}
      <td className="px-4 py-3 whitespace-nowrap">
        <InlineSelect
          value={local.plan}
          options={PLAN_OPTIONS}
          colorMap={PLAN_COLOR}
          onChange={(v) => void patch({ plan: v })}
        />
      </td>

      {/* Subscription status */}
      <td className="px-4 py-3 whitespace-nowrap">
        <InlineSelect
          value={local.subscription_status}
          options={STATUS_OPTIONS}
          colorMap={STATUS_COLOR}
          onChange={(v) => void patch({ subscription_status: v })}
        />
      </td>

      {/* Onboarding */}
      <td className="px-4 py-3 whitespace-nowrap">
        <button
          onClick={() => void patch({ onboarding_complete: !local.onboarding_complete })}
          className={cn(
            "text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors",
            local.onboarding_complete
              ? "text-emerald-400 border-emerald-400/20 bg-emerald-400/8 hover:bg-emerald-400/15"
              : "text-white/28 border-white/8 bg-white/[0.03] hover:bg-white/[0.06]",
          )}
        >
          {local.onboarding_complete ? "Complete" : "Incomplete"}
        </button>
      </td>

      {/* Stripe */}
      <td className="px-4 py-3 whitespace-nowrap">
        <span className={cn(
          "text-[10px]",
          user.stripe_customer_id ? "text-white/40" : "text-white/20",
        )}>
          {user.stripe_customer_id ? "Stripe" : "—"}
        </span>
      </td>

      {/* Joined */}
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="text-[10px] text-white/20">{joined}</span>
      </td>

      {/* Save indicator */}
      <td className="px-3 py-3 w-6">
        <SaveIcon state={saveState} />
      </td>
    </tr>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const adminReady = useAdminGuard();
  const router     = useRouter();

  const [users,   setUsers  ] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError  ] = useState<string | null>(null);
  const [search,  setSearch ] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch("/api/admin/users");
      const data = await res.json() as { users?: AdminUser[]; error?: string };
      if (!res.ok || data.error) {
        setError(data.error ?? "Failed to load users");
      } else {
        setUsers(data.users ?? []);
      }
    } catch {
      setError("Network error loading users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!adminReady) return;
    void fetchUsers();
  }, [adminReady, fetchUsers]);

  async function handleUpdate(id: string, patch: Partial<AdminUser>) {
    const res = await fetch(`/api/admin/users/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(patch),
    });
    const data = await res.json() as { ok?: boolean; error?: string };
    if (!res.ok || data.error) throw new Error(data.error ?? "Update failed");
    // Sync local state
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, ...patch } : u));
  }

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchSearch = !q
      || u.email.toLowerCase().includes(q)
      || (u.full_name ?? "").toLowerCase().includes(q);
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const counts = {
    total:   users.length,
    master:  users.filter((u) => u.role === "master").length,
    trainer: users.filter((u) => u.role === "trainer").length,
    client:  users.filter((u) => u.role === "client").length,
    active:  users.filter((u) => u.subscription_status === "active").length,
  };

  if (!adminReady) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-5 text-white">
        <div className="text-center space-y-2">
          <div className="mx-auto h-6 w-6 rounded-full border border-[#B48B40]/25 border-t-[#B48B40] animate-spin" />
          <p className="text-sm text-white/55">Opening admin users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] px-4 py-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/admin")}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.05] transition-all"
            >
              <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
            </button>
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-[#B48B40] font-medium">Admin</p>
              <h1 className="text-xl font-semibold text-white tracking-tight">User Management</h1>
            </div>
          </div>
          <button
            onClick={() => void fetchUsers()}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} strokeWidth={1.5} />
            Refresh
          </button>
        </div>

        {/* Error state */}
        {error && (
          <div className="rounded-xl border border-red-400/20 bg-red-400/[0.04] px-4 py-3 flex items-start gap-3">
            <ShieldAlert className="w-4 h-4 text-red-400/70 shrink-0 mt-0.5" strokeWidth={1.5} />
            <div>
              <p className="text-xs text-red-400/80 font-medium">Failed to load users</p>
              <p className="text-xs text-red-400/50 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Stats strip */}
        {!error && !loading && (
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: "Total users", value: counts.total   },
              { label: "Admins",      value: counts.master  },
              { label: "Trainers",    value: counts.trainer },
              { label: "Clients",     value: counts.client  },
              { label: "Active subs", value: counts.active  },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl border border-white/[0.06] bg-[#111111] px-3 py-2.5 text-center">
                <p className="text-lg font-semibold text-white/80">{value}</p>
                <p className="text-[10px] text-white/25 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" strokeWidth={1.5} />
            <input
              type="text"
              placeholder="Search email or name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#111111] border border-white/[0.07] rounded-lg pl-8 pr-3 py-2 text-xs text-white/70 placeholder:text-white/20 outline-none focus:border-white/15 transition-colors"
            />
          </div>
          <div className="flex items-center gap-1">
            {(["all", "master", "trainer", "client", "member"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  roleFilter === r
                    ? "bg-white/[0.08] text-white/80 border border-white/10"
                    : "text-white/30 hover:text-white/55",
                )}
              >
                {r === "all" ? "All" : r === "master" ? "Admin" : r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-white/[0.07] bg-[#111111] overflow-hidden">
          {loading ? (
            <div className="py-16 text-center">
              <RefreshCw className="w-5 h-5 text-white/20 animate-spin mx-auto" strokeWidth={1.5} />
              <p className="text-xs text-white/25 mt-3">Loading users…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <Users className="w-5 h-5 text-white/15 mx-auto" strokeWidth={1.5} />
              <p className="text-xs text-white/25 mt-3">{users.length === 0 ? "No users found" : "No results match your filters"}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    {["Email", "Role", "Plan", "Status", "Onboarding", "Stripe", "Joined", ""].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wider text-white/20 font-medium whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => (
                    <UserRow key={u.id} user={u} onUpdate={handleUpdate} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer note */}
        <p className="text-center text-[11px] text-white/15 leading-relaxed">
          Changes persist immediately. Role and plan edits take effect on the user&apos;s next page load.
          {" "}Stripe webhooks will override plan/status once billing goes live.
        </p>

      </div>
    </div>
  );
}
