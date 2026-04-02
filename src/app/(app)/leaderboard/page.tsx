"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trophy, Flame, TrendingUp, CheckSquare, Zap, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/context/UserContext";
import { canViewProfile } from "@/lib/userProfiles";
import { UserNameLink } from "@/components/profile/UserHoverCard";
import type { SnapshotUser } from "@/lib/userProfiles";

// ─── Types ────────────────────────────────────────────────────────────────────

type Plan    = "free" | "pro" | "elite";
type Role    = "member" | "client" | "trainer" | "master";
type SortKey = "overall" | "adherence" | "execution" | "streak" | "accountability" | "progress";
type TierFilter = "all" | "elite" | "pro" | "free";

type LeaderEntry = {
  id: string;
  name: string;
  plan: Plan;
  role: Role;
  adherence:      number;
  execution:      number;
  streak:         number;
  accountability: number;
  progress:       number;
};

// ─── Mock data ────────────────────────────────────────────────────────────────

const ENTRIES: LeaderEntry[] = [
  { id: "u1",  name: "Kai Nakamura",   plan: "elite", role: "client",  adherence: 94, execution: 88, streak: 22, accountability: 91, progress: 86 },
  { id: "u2",  name: "Priya Sharma",   plan: "elite", role: "client",  adherence: 91, execution: 84, streak: 18, accountability: 88, progress: 82 },
  { id: "u7",  name: "Sofia Reyes",    plan: "elite", role: "client",  adherence: 88, execution: 80, streak: 14, accountability: 85, progress: 79 },
  { id: "u4",  name: "Alex Rivera",     plan: "elite", role: "trainer", adherence: 85, execution: 79, streak: 31, accountability: 82, progress: 74 },
  { id: "u6",  name: "Luca Ferretti",  plan: "pro",   role: "member",  adherence: 82, execution: 76, streak: 9,  accountability: 78, progress: 70 },
  { id: "u10", name: "Omar Hassan",    plan: "pro",   role: "member",  adherence: 79, execution: 72, streak: 7,  accountability: 74, progress: 67 },
  { id: "u3",  name: "Marcus Webb",    plan: "pro",   role: "trainer", adherence: 75, execution: 68, streak: 5,  accountability: 70, progress: 63 },
  { id: "u5",  name: "Anya Patel",     plan: "pro",   role: "client",  adherence: 63, execution: 58, streak: 2,  accountability: 61, progress: 52 },
  { id: "u8",  name: "Dmitri Volkov",  plan: "free",  role: "member",  adherence: 58, execution: 52, streak: 3,  accountability: 55, progress: 44 },
  { id: "u12", name: "Ravi Menon",     plan: "free",  role: "member",  adherence: 41, execution: 38, streak: 0,  accountability: 35, progress: 28 },
];

function overall(e: LeaderEntry): number {
  return Math.round(
    e.adherence     * 0.25 +
    e.execution     * 0.20 +
    Math.min(e.streak * 1.5, 100) * 0.15 +
    e.accountability * 0.20 +
    e.progress      * 0.20
  );
}

function toSnapshotUser(e: LeaderEntry): SnapshotUser {
  return { id: e.id, name: e.name, role: e.role, plan: e.plan };
}

// ─── Config ───────────────────────────────────────────────────────────────────

const PLAN_CFG: Record<Plan, { label: string; color: string }> = {
  elite: { label: "Elite", color: "text-[#C9932A]"    },
  pro:   { label: "Pro",   color: "text-[#93C5FD]/70" },
  free:  { label: "Free",  color: "text-white/28"     },
};

const SORT_OPTIONS: { key: SortKey; label: string; icon: typeof Trophy; unit?: string }[] = [
  { key: "overall",        label: "Overall",        icon: Trophy      },
  { key: "adherence",      label: "Adherence",      icon: TrendingUp, unit: "%" },
  { key: "execution",      label: "Execution",      icon: Zap                   },
  { key: "streak",         label: "Streak",         icon: Flame,      unit: "d" },
  { key: "accountability", label: "Accountability",  icon: CheckSquare           },
  { key: "progress",       label: "Progress",       icon: Target,     unit: "%" },
];

const TIER_FILTERS: { id: TierFilter; label: string }[] = [
  { id: "all",   label: "All"   },
  { id: "elite", label: "Elite" },
  { id: "pro",   label: "Pro"   },
  { id: "free",  label: "Free"  },
];

// ─── Rank styling ─────────────────────────────────────────────────────────────
// Premium gold / silver / bronze — distinct but not garish

const RANK_CFG = {
  1: {
    // card
    border:      "border-[#C9932A]/35",
    glow:        "rgba(201,147,42,0.13)",
    // rank badge — gradient pill
    badgeFrom:   "#E8BC52",
    badgeTo:     "#B8821A",
    badgeText:   "#1A0D00",
    // avatar ring
    avatarRing:  "border-[#C9932A]/55",
    avatarBg:    "bg-[#1E1608]",
    // score
    scoreColor:  "text-[#E8BC52]",
    // podium offset (higher = lower on screen → creates height stagger)
    topOffset:   "mt-0",
  },
  2: {
    border:      "border-[#B2B5BE]/22",
    glow:        "rgba(178,181,190,0.08)",
    badgeFrom:   "#D4D5DC",
    badgeTo:     "#8E9098",
    badgeText:   "#131318",
    avatarRing:  "border-[#B2B5BE]/40",
    avatarBg:    "bg-[#141416]",
    scoreColor:  "text-[#C8C9D4]",
    topOffset:   "mt-6",
  },
  3: {
    border:      "border-[#9A6A3A]/22",
    glow:        "rgba(154,106,58,0.10)",
    badgeFrom:   "#C4875A",
    badgeTo:     "#7A4C25",
    badgeText:   "#FFFFFF",
    avatarRing:  "border-[#9A6A3A]/40",
    avatarBg:    "bg-[#170F08]",
    scoreColor:  "text-[#C08055]",
    topOffset:   "mt-10",
  },
} as const;

// ─── Sub-components ───────────────────────────────────────────────────────────

function MiniBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="flex items-center gap-2">
      <div className="w-12 h-1 rounded-full bg-white/6 overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-white/50 w-7 text-right">{value}</span>
    </div>
  );
}

function TopThreeCard({
  entry,
  rank,
  sortKey,
  isMe,
  canNavigate,
  onNavigate,
}: {
  entry: LeaderEntry;
  rank: 1 | 2 | 3;
  sortKey: SortKey;
  isMe: boolean;
  canNavigate: boolean;
  onNavigate: () => void;
}) {
  const cfg = RANK_CFG[rank];
  const pc  = PLAN_CFG[entry.plan];
  const score = sortKey === "overall" ? overall(entry) : entry[sortKey];
  const opt = SORT_OPTIONS.find((o) => o.key === sortKey)!;
  const initials = entry.name.split(" ").map((n) => n[0]).join("");

  return (
    <div
      onClick={canNavigate ? onNavigate : undefined}
      className={cn(
        "rounded-2xl border flex flex-col items-center gap-3 px-5 py-5 relative overflow-hidden transition-all duration-200",
        cfg.border,
        cfg.topOffset,
        canNavigate && "cursor-pointer hover:brightness-[1.08] hover:-translate-y-0.5",
        isMe && "ring-1 ring-[#B48B40]/30"
      )}
      style={{
        background: `radial-gradient(ellipse at 50% -15%, ${cfg.glow} 0%, transparent 68%), #111111`,
      }}
    >
      {/* "You" badge */}
      {isMe && (
        <span className="absolute top-3 right-3 text-[9px] font-semibold uppercase tracking-wider text-[#B48B40] border border-[#B48B40]/25 bg-[#B48B40]/8 rounded px-1.5 py-0.5">
          You
        </span>
      )}

      {/* Rank badge — gradient-filled circle */}
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-lg"
        style={{
          background: `linear-gradient(135deg, ${cfg.badgeFrom}, ${cfg.badgeTo})`,
          boxShadow: `0 2px 12px ${cfg.glow.replace("0.13", "0.35").replace("0.08", "0.25").replace("0.10", "0.28")}`,
        }}
      >
        <span
          className="text-sm font-bold tabular-nums leading-none"
          style={{ color: cfg.badgeText }}
        >
          {rank}
        </span>
      </div>

      {/* Avatar */}
      <div className={cn(
        "w-12 h-12 rounded-full border-2 flex items-center justify-center",
        cfg.avatarRing,
        cfg.avatarBg
      )}>
        <span className="text-sm font-semibold text-white/50">{initials}</span>
      </div>

      {/* Name + plan */}
      <div className="text-center">
        <p className={cn(
          "text-sm font-semibold text-white/88 leading-snug",
          canNavigate && "hover:text-white transition-colors"
        )}>
          {entry.name.split(" ")[0]}
        </p>
        <p className={cn("text-[10px] font-medium mt-0.5", pc.color)}>{pc.label}</p>
      </div>

      {/* Score */}
      <div className="text-center">
        <p className={cn("text-2xl font-semibold tabular-nums leading-none", cfg.scoreColor)}>
          {score}{opt.unit ?? ""}
        </p>
        <p className="text-[10px] text-white/28 mt-1">{opt.label}</p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LeaderboardPage() {
  const { user } = useUser();
  const router = useRouter();
  const [sortKey,    setSortKey]    = useState<SortKey>("overall");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");

  const filtered = ENTRIES
    .filter((e) => tierFilter === "all" || e.plan === tierFilter)
    .sort((a, b) => {
      const va = sortKey === "overall" ? overall(a) : a[sortKey];
      const vb = sortKey === "overall" ? overall(b) : b[sortKey];
      return vb - va;
    });

  const myId    = user.id;
  const myRank  = filtered.findIndex((e) => e.id === myId) + 1;
  const myEntry = filtered.find((e) => e.id === myId);

  // Podium: render as [2nd, 1st, 3rd] for visual height stagger
  const podium = filtered.slice(0, 3);
  const podiumOrdered: { entry: LeaderEntry; rank: 1 | 2 | 3 }[] =
    podium.length === 3
      ? [
          { entry: podium[1], rank: 2 },
          { entry: podium[0], rank: 1 },
          { entry: podium[2], rank: 3 },
        ]
      : podium.map((e, i) => ({ entry: e, rank: (i + 1) as 1 | 2 | 3 }));

  const rest = filtered.slice(3);
  const opt  = SORT_OPTIONS.find((o) => o.key === sortKey)!;

  function canOpen(targetId: string) {
    return canViewProfile(user.role, user.name, targetId, user.id);
  }

  function handleOpen(targetId: string) {
    if (canOpen(targetId)) router.push(`/profile/${targetId}`);
  }

  return (
    <div className="px-5 md:px-8 py-6 text-white space-y-6">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-white/22 mb-1.5">Leaderboard</p>
          <h1 className="text-2xl font-semibold tracking-tight">Performance Rankings</h1>
          <p className="text-sm text-white/30 mt-1">Updated daily. Rankings based on real activity data.</p>
        </div>
        {myEntry && (
          <div className="shrink-0 text-right">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/22 mb-0.5">Your rank</p>
            <p className="text-2xl font-semibold text-[#B48B40] tabular-nums">#{myRank}</p>
            <p className="text-[10px] text-white/28">of {filtered.length}</p>
          </div>
        )}
      </div>

      {/* ── Sort + Tier filters ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-1 flex-wrap">
          {SORT_OPTIONS.map((o) => {
            const Icon = o.icon;
            return (
              <button
                key={o.key}
                onClick={() => setSortKey(o.key)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all",
                  sortKey === o.key
                    ? "bg-white/8 text-white/80 border border-white/12"
                    : "text-white/30 hover:text-white/55 border border-transparent"
                )}
              >
                <Icon className="w-3 h-3" strokeWidth={1.8} />
                {o.label}
              </button>
            );
          })}
        </div>
        <div className="sm:ml-auto flex items-center gap-1">
          {TIER_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setTierFilter(f.id)}
              className={cn(
                "rounded-lg px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-[0.08em] transition-all",
                tierFilter === f.id
                  ? "bg-white/8 text-white/70 border border-white/12"
                  : "text-white/25 hover:text-white/50 border border-transparent"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Top 3 podium ───────────────────────────────────────────── */}
      {podiumOrdered.length > 0 && (
        <div className={cn(
          "grid gap-3 items-end",
          podiumOrdered.length === 3 ? "grid-cols-3" : podiumOrdered.length === 2 ? "grid-cols-2" : "grid-cols-1"
        )}>
          {podiumOrdered.map(({ entry, rank }) => (
            <TopThreeCard
              key={entry.id}
              entry={entry}
              rank={rank}
              sortKey={sortKey}
              isMe={entry.id === myId}
              canNavigate={canOpen(entry.id)}
              onNavigate={() => handleOpen(entry.id)}
            />
          ))}
        </div>
      )}

      {/* ── Rankings table ─────────────────────────────────────────── */}
      {rest.length > 0 && (
        <div className="rounded-2xl border border-white/6 bg-[#111111] overflow-hidden">

          {/* Column headers */}
          <div className="hidden md:grid grid-cols-[auto_2fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-4 px-5 py-3 border-b border-white/[0.05]">
            <p className="text-[10px] uppercase tracking-[0.14em] text-white/22 w-6">#</p>
            <p className="text-[10px] uppercase tracking-[0.14em] text-white/22">Name</p>
            {SORT_OPTIONS.filter((o) => o.key !== "overall").map((o) => (
              <button
                key={o.key}
                onClick={() => setSortKey(o.key)}
                className={cn(
                  "text-[10px] uppercase tracking-[0.14em] text-left transition-colors",
                  sortKey === o.key ? "text-[#B48B40]" : "text-white/22 hover:text-white/45"
                )}
              >
                {o.label}
              </button>
            ))}
            <button
              onClick={() => setSortKey("overall")}
              className={cn(
                "text-[10px] uppercase tracking-[0.14em] text-left transition-colors",
                sortKey === "overall" ? "text-[#B48B40]" : "text-white/22 hover:text-white/45"
              )}
            >
              Score
            </button>
          </div>

          <div className="divide-y divide-white/[0.04]">
            {rest.map((e, i) => {
              const rank    = i + 4;
              const isMe    = e.id === myId;
              const pc      = PLAN_CFG[e.plan];
              const initials = e.name.split(" ").map((n) => n[0]).join("");
              const score   = overall(e);
              const clickable = canOpen(e.id);

              return (
                <div
                  key={e.id}
                  onClick={clickable ? () => handleOpen(e.id) : undefined}
                  className={cn(
                    "grid grid-cols-1 md:grid-cols-[auto_2fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-2 md:gap-4 items-center px-5 py-3.5 transition-all",
                    isMe
                      ? "bg-[#B48B40]/[0.04] border-l-2 border-l-[#B48B40]/40"
                      : clickable
                        ? "hover:bg-white/[0.025] cursor-pointer"
                        : "hover:bg-white/[0.012]"
                  )}
                >
                  {/* Rank */}
                  <p className={cn("text-sm font-semibold tabular-nums w-6", isMe ? "text-[#B48B40]" : "text-white/30")}>
                    {rank}
                  </p>

                  {/* Name + avatar */}
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#1C1C1C] border border-white/8 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-semibold text-white/40">{initials}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <UserNameLink
                          user={toSnapshotUser(e)}
                          className={cn("text-sm font-medium", isMe ? "text-white/90" : "text-white/75")}
                        />
                        {isMe && (
                          <span className="text-[9px] font-semibold uppercase tracking-wider text-[#B48B40] border border-[#B48B40]/25 bg-[#B48B40]/8 rounded px-1 py-0.5">
                            You
                          </span>
                        )}
                      </div>
                      <p className={cn("text-[10px]", pc.color)}>{pc.label}</p>
                    </div>
                  </div>

                  {/* Adherence */}
                  <MiniBar value={e.adherence} color={
                    sortKey === "adherence" ? "bg-[#B48B40]" :
                    e.adherence >= 80 ? "bg-emerald-400/60" : e.adherence >= 65 ? "bg-amber-400/60" : "bg-[#F87171]/60"
                  } />

                  {/* Execution */}
                  <MiniBar value={e.execution} color={
                    sortKey === "execution" ? "bg-[#B48B40]" : "bg-[#93C5FD]/50"
                  } />

                  {/* Streak */}
                  <div className="flex items-center gap-1.5">
                    <Flame className={cn("w-3 h-3 shrink-0", e.streak >= 14 ? "text-orange-400" : "text-white/20")} strokeWidth={1.5} />
                    <span className={cn("text-xs tabular-nums", sortKey === "streak" ? "text-[#B48B40] font-semibold" : "text-white/50")}>
                      {e.streak}d
                    </span>
                  </div>

                  {/* Accountability */}
                  <MiniBar value={e.accountability} color={
                    sortKey === "accountability" ? "bg-[#B48B40]" : "bg-white/30"
                  } />

                  {/* Progress */}
                  <MiniBar value={e.progress} color={
                    sortKey === "progress" ? "bg-[#B48B40]" : "bg-emerald-400/50"
                  } />

                  {/* Overall score */}
                  <span className={cn(
                    "text-sm font-semibold tabular-nums",
                    sortKey === "overall" ? "text-[#B48B40]" : "text-white/55"
                  )}>
                    {score}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="rounded-2xl border border-white/6 bg-[#111111] px-5 py-12 text-center">
          <p className="text-sm text-white/25">No entries for this tier.</p>
        </div>
      )}

      <p className="text-[10px] text-white/18 text-center pb-2">
        Rankings update every 24 hours · Minimum 7-day activity window required
      </p>
    </div>
  );
}
