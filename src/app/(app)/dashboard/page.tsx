"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Dumbbell, Utensils, CheckSquare,
  Bot, Trophy, CalendarDays, ArrowRight, Loader2, Send,
} from "lucide-react";
import { DEMO_USERS } from "@/context/UserContext";
import { hasAccess } from "@/lib/roles";
import { GreetingBanner } from "@/components/dashboard/GreetingBanner";
import { useAIPipeline } from "@/hooks/useAIPipeline";
import type { RawUserData } from "@/lib/ai/types";
import type { Role } from "@/types";

// ─── Mock biometric data ───────────────────────────────────────────────────────

function buildMockData(userId: string): RawUserData {
  return {
    userId,
    date:                 new Date().toISOString().slice(0, 10),
    sleepHours:           7.2,
    sleepQuality:         3,
    soreness:             3,
    stressLevel:          3,
    energyLevel:          3,
    hrv:                  52,
    sessionsThisWeek:     3,
    avgRpe:               7,
    consecutiveDays:      3,
    habitsCompletedToday: 4,
    totalHabits:          5,
    adherenceStreak:      5,
  };
}

const PIPELINE_LABELS: Record<string, string> = {
  detecting:   "Reading your question…",
  summarizing: "Reading your state…",
  deciding:    "Calculating adjustments…",
  formatting:  "Building your plan…",
  educating:   "Thinking…",
};

// ─── Tab → route map ──────────────────────────────────────────────────────────
// Non-overview tabs redirect to their dedicated pages.

const TAB_ROUTES: Record<string, string> = {
  program:        "/program",
  nutrition:      "/nutrition",
  accountability: "/accountability",
  coach:          "/coach",
  calendar:       "/calendar",
  leaderboard:    "/leaderboard",
};

// ─── Quick-access cards (role-gated) ─────────────────────────────────────────

const QUICK_CARDS = [
  {
    label:    "Program",
    sub:      "Today's session",
    href:     "/program",
    icon:     Dumbbell,
    minRole:  "member" as Role,
  },
  {
    label:    "Accountability",
    sub:      "Daily check-in",
    href:     "/accountability",
    icon:     CheckSquare,
    minRole:  "member" as Role,
  },
  {
    label:    "Nutrition",
    sub:      "Today's targets",
    href:     "/nutrition",
    icon:     Utensils,
    minRole:  "client" as Role,
  },
  {
    label:    "Coach",
    sub:      "AI coach",
    href:     "/coach",
    icon:     Bot,
    minRole:  "client" as Role,
  },
  {
    label:    "Calendar",
    sub:      "This week",
    href:     "/calendar",
    icon:     CalendarDays,
    minRole:  "client" as Role,
  },
  {
    label:    "Leaderboard",
    sub:      "Your rank",
    href:     "/leaderboard",
    icon:     Trophy,
    minRole:  "member" as Role,
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

function todayLabel(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month:   "long",
    day:     "numeric",
  });
}

export default function DashboardPage() {
  return (
    <Suspense>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const tab          = searchParams.get("tab");

  const [ready,    setReady   ] = useState(false);
  const [role,     setRole    ] = useState<Role>("member");
  const [userId,   setUserId  ] = useState("");
  const [question, setQuestion] = useState("");
  const pipeline   = useAIPipeline();
  const hasRun     = useRef(false);

  // Auto-run performance pipeline once auth is confirmed
  useEffect(() => {
    if (!ready || !userId || hasRun.current) return;
    hasRun.current = true;
    pipeline.run(buildMockData(userId));
  }, [ready, userId, pipeline.run]);

  function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q) return;
    pipeline.ask(q, buildMockData(userId));
    setQuestion("");
  }

  useEffect(() => {
    // Auth check — read directly from storage to avoid context hydration lag
    let savedRole: string | null = null;
    try {
      savedRole = localStorage.getItem("flowstate-active-role")
               || sessionStorage.getItem("flowstate-session-role");
    } catch { /* ignore */ }

    if (!savedRole || !DEMO_USERS[savedRole]) {
      router.replace("/login");
      return;
    }

    const demoUser = DEMO_USERS[savedRole];
    setRole(demoUser.role);
    setUserId(savedRole);

    // ?tab=overview is explicit — always show the hub, skip default logic
    if (tab === "overview") {
      setReady(true);
      return;
    }

    // Resolve which tab to use
    const resolvedTab = tab ?? demoUser.defaultDashboard ?? "overview";

    if (resolvedTab !== "overview" && TAB_ROUTES[resolvedTab]) {
      router.replace(TAB_ROUTES[resolvedTab]);
      return; // don't setReady — navigating away
    }

    setReady(true);
  }, [tab, router]);

  if (!ready) return null;

  const storedRole = localStorage.getItem("flowstate-active-role") || sessionStorage.getItem("flowstate-session-role") || "";
  const firstName  = (DEMO_USERS[storedRole] ?? DEMO_USERS.master).name.split(" ")[0];
  const visibleCards = QUICK_CARDS.filter((c) => hasAccess(role, c.minRole));

  return (
    <div className="px-5 md:px-8 py-6 text-white max-w-2xl mx-auto">
      <GreetingBanner />

      {/* Header */}
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.22em] text-white/25 mb-1.5">
          {todayLabel()}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">{firstName}</h1>
      </div>

      {/* AI Coach */}
      <section className="mb-8">
        <p className="text-[10px] uppercase tracking-[0.22em] text-white/22 mb-3">AI Coach</p>

        {/* Ask input */}
        <form onSubmit={handleAsk} className="mb-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask the coach…"
              className="flex-1 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-2.5 text-sm text-white/80 placeholder:text-white/20 outline-none focus:border-white/15 focus:bg-white/[0.05] transition-all"
            />
            <button
              type="submit"
              disabled={!question.trim() || ["detecting","summarizing","deciding","formatting","educating"].includes(pipeline.status)}
              className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5 text-white/30 hover:text-white/60 hover:border-white/15 disabled:opacity-30 disabled:cursor-default transition-all"
            >
              <Send className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        </form>

        {/* Loading */}
        {["detecting","summarizing","deciding","formatting","educating"].includes(pipeline.status) && (
          <div className="rounded-2xl border border-white/8 bg-[#111111] px-5 py-5">
            <div className="flex items-center gap-2.5">
              <Loader2 className="w-3.5 h-3.5 text-[#B48B40]/50 animate-spin" />
              <p className="text-xs text-white/30">
                {PIPELINE_LABELS[pipeline.status] ?? "Processing…"}
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {pipeline.status === "error" && (
          <div className="rounded-2xl border border-red-900/30 bg-[#111111] px-5 py-4">
            <p className="text-xs text-red-400/60">{pipeline.error}</p>
          </div>
        )}

        {/* Education result — no mode label, just content */}
        {pipeline.activeMode === "education" && pipeline.educationResult && pipeline.status === "complete" && (
          <div className="rounded-2xl border border-white/8 bg-[#111111] divide-y divide-white/[0.04]">
            <div className="px-5 py-4">
              <p className="text-sm text-white/75 leading-relaxed">
                {pipeline.educationResult.explanation}
              </p>
            </div>
            {pipeline.educationResult.example && (
              <div className="px-5 py-3">
                <p className="text-xs text-white/40 leading-relaxed italic">
                  {pipeline.educationResult.example}
                </p>
              </div>
            )}
            <div className="px-5 py-4">
              <div className="flex gap-2.5">
                <div className="w-[2px] rounded-full bg-[#B48B40]/30 shrink-0 mt-0.5" />
                <p className="text-sm text-white/55 leading-snug">
                  {pipeline.educationResult.takeaway}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Performance mode result */}
        {pipeline.activeMode !== "education" && (pipeline.result ?? pipeline.lastResult) &&
          !["summarizing","deciding","formatting"].includes(pipeline.status) && (() => {
          const r = pipeline.result ?? pipeline.lastResult!;
          return (
            <div className="rounded-2xl border border-white/8 bg-[#111111] divide-y divide-white/[0.04]">
              <div className="px-5 py-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/25 mb-1.5">
                  Today&apos;s Focus
                </p>
                <p className="text-sm text-white/80 leading-snug">
                  {r.response.todays_focus}
                </p>
              </div>
              <div className="px-5 py-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/25 mb-1.5">
                  Training Range
                </p>
                <p className="text-sm font-semibold text-white/85">
                  {r.response.training_plan.intensity}
                </p>
                <p className="text-xs text-white/32 mt-0.5">
                  {r.response.training_plan.summary} · {r.response.training_plan.duration}
                </p>
              </div>
              <div className="px-5 py-4">
                <div className="flex gap-2.5">
                  <div className="w-[2px] rounded-full bg-[#B48B40]/30 shrink-0 mt-0.5" />
                  <p className="text-sm text-white/50 italic leading-snug">
                    {r.response.coaching_insight}
                  </p>
                </div>
              </div>
            </div>
          );
        })()}
      </section>

      {/* Today's session */}
      <section className="mb-8">
        <p className="text-[10px] uppercase tracking-[0.22em] text-white/22 mb-3">Today</p>
        <Link
          href="/program"
          className="block rounded-2xl border border-white/8 bg-[#111111] px-5 py-4 hover:border-white/15 transition-all group"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-white/28 mb-1">Week 3 of 8 · Phase 1</p>
              <h2 className="text-base font-semibold text-white/90">Upper Body · Pull</h2>
              <p className="text-sm text-white/35 mt-0.5">~45 min · 4 exercises</p>
            </div>
            <ArrowRight
              className="w-4 h-4 text-white/18 group-hover:text-white/45 transition-colors shrink-0"
              strokeWidth={1.5}
            />
          </div>
        </Link>
      </section>

      {/* Quick access */}
      <section>
        <p className="text-[10px] uppercase tracking-[0.22em] text-white/22 mb-3">Quick Access</p>
        <div className="grid grid-cols-2 gap-2">
          {visibleCards.map(({ label, sub, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="rounded-2xl border border-white/6 bg-white/[0.02] px-4 py-3.5 hover:border-white/12 hover:bg-white/[0.04] transition-all group"
            >
              <div className="flex items-center justify-between mb-2">
                <Icon className="w-4 h-4 text-white/30 group-hover:text-white/50 transition-colors" strokeWidth={1.5} />
                <ArrowRight className="w-3 h-3 text-white/12 group-hover:text-white/30 transition-colors" strokeWidth={1.5} />
              </div>
              <p className="text-sm font-semibold text-white/75 leading-none">{label}</p>
              <p className="text-[11px] text-white/28 mt-1">{sub}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
