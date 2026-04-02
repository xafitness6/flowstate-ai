"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { Flame, ArrowLeft, MessageSquare, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  USER_SNAPSHOTS,
  adherenceColor,
  canViewProfile,
} from "@/lib/userProfiles";
import { useUser } from "@/context/UserContext";

// ─── Static user lookup (mirrors master page USERS) ──────────────────────────

const USER_DIRECTORY: Record<string, {
  id: string; name: string; email: string;
  role: "member" | "client" | "trainer" | "master";
  plan: "free" | "pro" | "elite"; status: string; trainer?: string;
}> = {
  u1:  { id: "u1",  name: "Kai Nakamura",  email: "kai@example.com",     role: "client",  plan: "pro",   status: "active",   trainer: "Alex Rivera"  },
  u2:  { id: "u2",  name: "Priya Sharma",  email: "priya@example.com",   role: "client",  plan: "elite", status: "active",   trainer: "Alex Rivera"  },
  u3:  { id: "u3",  name: "Marcus Webb",   email: "marcus@example.com",  role: "trainer", plan: "pro",   status: "active"                          },
  u4:  { id: "u4",  name: "Alex Rivera",    email: "alex@example.com",  role: "trainer", plan: "elite", status: "active"                          },
  u5:  { id: "u5",  name: "Anya Patel",    email: "anya@example.com",    role: "client",  plan: "pro",   status: "at-risk",  trainer: "Marcus Webb" },
  u6:  { id: "u6",  name: "Luca Ferretti", email: "luca@example.com",    role: "member",  plan: "free",  status: "active"                          },
  u7:  { id: "u7",  name: "Sofia Reyes",   email: "sofia@example.com",   role: "client",  plan: "elite", status: "active",   trainer: "Alex Rivera"  },
  u8:  { id: "u8",  name: "Dmitri Volkov", email: "dmitri@example.com",  role: "member",  plan: "free",  status: "trial"                           },
  u9:  { id: "u9",  name: "Hana Suzuki",   email: "hana@example.com",    role: "client",  plan: "pro",   status: "paused",   trainer: "Marcus Webb" },
  u10: { id: "u10", name: "Omar Hassan",   email: "omar@example.com",    role: "member",  plan: "pro",   status: "active"                          },
  u11: { id: "u11", name: "Claire Dubois", email: "claire@example.com",  role: "client",  plan: "pro",   status: "at-risk",  trainer: "Alex Rivera"  },
  u12: { id: "u12", name: "Ravi Menon",    email: "ravi@example.com",    role: "member",  plan: "free",  status: "churned"                         },
};

const ROLE_COLOR: Record<string, string> = {
  master:  "text-emerald-400/80",
  trainer: "text-[#B48B40]/80",
  client:  "text-[#93C5FD]/70",
  member:  "text-white/35",
};

const ROLE_LABEL: Record<string, string> = {
  master: "Admin", trainer: "Trainer", client: "Client", member: "Member",
};

const PLAN_COLOR: Record<string, string> = {
  elite: "text-[#B48B40]",
  pro:   "text-white/50",
  free:  "text-white/28",
};

const STATUS_LABEL: Record<string, { label: string; dot: string }> = {
  active:   { label: "Active",    dot: "bg-emerald-400" },
  "at-risk":{ label: "At risk",   dot: "bg-amber-400"   },
  paused:   { label: "Paused",    dot: "bg-white/25"    },
  trial:    { label: "Trial",     dot: "bg-[#93C5FD]"   },
  churned:  { label: "Churned",   dot: "bg-[#F87171]/60"},
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user: viewer } = useUser();

  const target = USER_DIRECTORY[id];
  const snap   = USER_SNAPSHOTS[id];

  // Access gate
  const allowed = canViewProfile(viewer.role, viewer.name, id, viewer.id);

  if (!target) {
    return (
      <div className="px-5 md:px-8 py-6 max-w-2xl mx-auto text-white">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/55 transition-colors mb-8">
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
          Back
        </button>
        <p className="text-sm text-white/30">User not found.</p>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="px-5 md:px-8 py-6 max-w-2xl mx-auto text-white">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/55 transition-colors mb-8">
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
          Back
        </button>
        <div className="rounded-2xl border border-white/6 bg-[#111111] px-6 py-10 flex flex-col items-center gap-3 text-center">
          <Lock className="w-5 h-5 text-white/18" strokeWidth={1.5} />
          <p className="text-sm font-medium text-white/50">Profile access restricted</p>
          <p className="text-xs text-white/22 max-w-xs">
            You can only view profiles of users assigned to you or your own profile.
          </p>
        </div>
      </div>
    );
  }

  const initials = target.name.split(" ").map((n) => n[0]).join("").toUpperCase();
  const statusCfg = STATUS_LABEL[target.status] ?? { label: target.status, dot: "bg-white/20" };

  return (
    <div className="px-5 md:px-8 py-6 max-w-2xl mx-auto text-white space-y-6">

      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/55 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
        Back
      </button>

      {/* Identity card */}
      <div className="rounded-2xl border border-white/8 bg-[#111111] px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[#1C1C1C] border border-white/10 flex items-center justify-center shrink-0">
              <span className="text-lg font-semibold text-white/45">{initials}</span>
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white/90 tracking-tight">{target.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className={cn("text-xs font-medium", ROLE_COLOR[target.role])}>
                  {ROLE_LABEL[target.role] ?? target.role}
                </span>
                <span className="text-white/15">·</span>
                <span className={cn("text-xs font-medium capitalize", PLAN_COLOR[target.plan])}>
                  {target.plan}
                </span>
                <span className="text-white/15">·</span>
                <div className="flex items-center gap-1">
                  <span className={cn("w-1.5 h-1.5 rounded-full", statusCfg.dot)} />
                  <span className="text-xs text-white/40">{statusCfg.label}</span>
                </div>
              </div>
              {target.email && (
                <p className="text-[11px] text-white/22 mt-1">{target.email}</p>
              )}
              {target.trainer && (
                <p className="text-[11px] text-white/28 mt-1">
                  Trainer: <span className="text-[#B48B40]/70">{target.trainer}</span>
                </p>
              )}
            </div>
          </div>

          {/* Action */}
          <button
            onClick={() => router.push("/coach")}
            className="shrink-0 flex items-center gap-1.5 rounded-xl border border-white/8 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/15 transition-all px-3 py-2 text-[11px] font-medium text-white/45 hover:text-white/70"
          >
            <MessageSquare className="w-3.5 h-3.5" strokeWidth={1.5} />
            Message
          </button>
        </div>
      </div>

      {snap ? (
        <>
          {/* Goal + adherence */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/6 bg-[#111111] px-4 py-4">
              <p className="text-[9px] uppercase tracking-[0.16em] text-white/22 mb-2">Adherence</p>
              <p className={cn("text-3xl font-semibold tabular-nums", adherenceColor(snap.adherence))}>
                {snap.adherence}%
              </p>
              <div className="mt-2 h-1 rounded-full bg-white/6 overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full",
                    snap.adherence >= 80 ? "bg-emerald-400" :
                    snap.adherence >= 60 ? "bg-[#B48B40]"   : "bg-[#F87171]/60"
                  )}
                  style={{ width: `${snap.adherence}%` }}
                />
              </div>
            </div>
            <div className="rounded-2xl border border-white/6 bg-[#111111] px-4 py-4">
              <p className="text-[9px] uppercase tracking-[0.16em] text-white/22 mb-2">Training streak</p>
              <div className="flex items-baseline gap-1.5">
                {snap.streak > 0 && (
                  <Flame className="w-4 h-4 text-[#B48B40] mb-0.5" strokeWidth={1.5} />
                )}
                <span className={cn(
                  "text-3xl font-semibold tabular-nums",
                  snap.streak > 0 ? "text-white/80" : "text-white/22"
                )}>
                  {snap.streak}
                </span>
                <span className="text-sm text-white/25">days</span>
              </div>
            </div>
          </div>

          {/* Goal */}
          <div className="rounded-2xl border border-white/6 bg-[#111111] px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="min-w-0">
                <p className="text-[9px] uppercase tracking-[0.16em] text-white/22 mb-1.5">Current goal</p>
                <p className="text-sm font-semibold text-white/80">{snap.currentGoal}</p>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className={cn(
                    "w-1.5 h-1.5 rounded-full shrink-0",
                    snap.adherence >= 75 ? "bg-emerald-400" :
                    snap.adherence >= 50 ? "bg-[#B48B40]"   : "bg-[#F87171]/60"
                  )} />
                  <span className="text-xs text-white/35">{snap.currentStatus}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Metrics */}
          <div className="rounded-2xl border border-white/6 bg-[#111111] px-5 py-4">
            <p className="text-[9px] uppercase tracking-[0.16em] text-white/22 mb-4">Key metrics</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {snap.metrics.map((m) => (
                <div key={m.label}>
                  <p className="text-[9px] uppercase tracking-[0.12em] text-white/20 mb-1">{m.label}</p>
                  <p className="text-lg font-semibold text-white/70 tabular-nums">{m.value}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[10px] text-white/15 text-center pb-2">
            Metrics are system-generated and updated automatically.
          </p>
        </>
      ) : (
        <div className="rounded-2xl border border-white/6 bg-[#111111] px-5 py-8 text-center">
          <p className="text-sm text-white/25">No snapshot data available for this user.</p>
        </div>
      )}

    </div>
  );
}
