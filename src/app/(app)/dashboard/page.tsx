"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Dumbbell, Utensils, CheckSquare,
  Bot, Trophy, CalendarDays, ArrowRight, Loader2, Send,
  Users, TrendingUp, AlertTriangle,
} from "lucide-react";
import { DEMO_USERS } from "@/context/UserContext";
import { hasAccess } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { GreetingBanner } from "@/components/dashboard/GreetingBanner";
import { useAIPipeline } from "@/hooks/useAIPipeline";
import type { RawUserData } from "@/lib/ai/types";
import type { Role } from "@/types";
import {
  initStore,
  getMyClients,
  getClientTrainingData,
  getUsers,
  loadUsers,
  type PlatformUser,
  type ClientTrainingData,
} from "@/lib/data/store";
import { loadIntake, GOAL_LABELS } from "@/lib/data/intake";

// ─── Build real pipeline data from localStorage ───────────────────────────────

function buildRealData(roleKey: string, actualUserId: string): RawUserData {
  let habitsCompletedToday = 0;
  let totalHabits          = 5;
  let adherenceStreak      = 0;
  let sessionsThisWeek     = 0;
  let sleepHours           = 7.2;
  let sleepQuality         = 3;
  let stressLevel          = 3;

  try {
    const rawLogs = localStorage.getItem("accountability-logs");
    if (rawLogs) {
      const logs = JSON.parse(rawLogs) as Record<string, { completedHabits: string[] }>;
      const today = new Date().toISOString().slice(0, 10);
      habitsCompletedToday = logs[today]?.completedHabits?.length ?? 0;

      // Training streak
      for (let i = 0; i < 90; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        if (logs[key]?.completedHabits?.includes("training")) adherenceStreak++;
        else break;
      }

      // Sessions this week (Mon–today)
      const dow = new Date().getDay();
      const daysFromMon = dow === 0 ? 6 : dow - 1;
      for (let i = 0; i <= daysFromMon; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        if (logs[key]?.completedHabits?.includes("training")) sessionsThisWeek++;
      }
    }
  } catch { /* ignore */ }

  try {
    const rawHabits = localStorage.getItem("accountability-habits-v2");
    if (rawHabits) {
      const habits = JSON.parse(rawHabits) as Array<{ visible: boolean }>;
      const count = habits.filter((h) => h.visible).length;
      if (count > 0) totalHabits = count;
    }
  } catch { /* ignore */ }

  try {
    const intake = loadIntake(actualUserId);
    if (intake) {
      const parsed = parseFloat(intake.sleepHours);
      if (!isNaN(parsed) && parsed > 0) sleepHours = parsed;
      if (intake.sleepQuality > 0) sleepQuality = intake.sleepQuality;
      if (intake.stressLevel  > 0) stressLevel  = intake.stressLevel;
    }
  } catch { /* ignore */ }

  return {
    userId:               roleKey,
    date:                 new Date().toISOString().slice(0, 10),
    sleepHours,
    sleepQuality,
    soreness:             3,
    stressLevel,
    energyLevel:          3,
    hrv:                  52,
    sessionsThisWeek,
    avgRpe:               7,
    consecutiveDays:      adherenceStreak,
    habitsCompletedToday,
    totalHabits,
    adherenceStreak,
  };
}

// ─── Pipeline status labels ───────────────────────────────────────────────────

const PIPELINE_LABELS: Record<string, string> = {
  detecting:   "Reading your question…",
  summarizing: "Reading your state…",
  deciding:    "Calculating adjustments…",
  formatting:  "Building your plan…",
  educating:   "Thinking…",
};

// ─── Tab → route map ──────────────────────────────────────────────────────────

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
  { label: "Program",        sub: "Today's session",  href: "/program",        icon: Dumbbell,    minRole: "member"  as Role },
  { label: "Accountability", sub: "Daily check-in",   href: "/accountability", icon: CheckSquare, minRole: "member"  as Role },
  { label: "Nutrition",      sub: "Today's targets",  href: "/nutrition",      icon: Utensils,    minRole: "client"  as Role },
  { label: "Coach",          sub: "AI coach",         href: "/coach",          icon: Bot,         minRole: "client"  as Role },
  { label: "Calendar",       sub: "This week",        href: "/calendar",       icon: CalendarDays,minRole: "client"  as Role },
  { label: "Leaderboard",    sub: "Your rank",        href: "/leaderboard",    icon: Trophy,      minRole: "member"  as Role },
];

// ─── Role-specific overview panels ───────────────────────────────────────────

function TrainerOverviewPanel({ userId }: { userId: string }) {
  const [clients, setClients] = useState<PlatformUser[]>([]);

  useEffect(() => {
    try {
      initStore();
      setClients(getMyClients("trainer", userId));
    } catch { /* ignore */ }
  }, [userId]);

  const active   = clients.filter((c) => c.status === "active").length;
  const atRisk   = clients.filter((c) => c.status === "at-risk");
  const avgComp  = clients.length > 0
    ? Math.round(clients.reduce((s, c) => s + getClientTrainingData(c.id).checkInCompletion, 0) / clients.length)
    : 0;

  return (
    <div className="rounded-2xl border border-white/6 bg-[#111111] px-5 py-4 space-y-4">
      <p className="text-[10px] uppercase tracking-[0.22em] text-white/22">Your Clients</p>
      <div className="flex gap-6">
        <div>
          <p className="text-2xl font-semibold text-white/90">{clients.length}</p>
          <p className="text-xs text-white/30 mt-0.5">Total</p>
        </div>
        <div>
          <p className="text-2xl font-semibold text-emerald-400">{active}</p>
          <p className="text-xs text-white/30 mt-0.5">Active</p>
        </div>
        <div>
          <p className="text-2xl font-semibold text-[#B48B40]">{avgComp}%</p>
          <p className="text-xs text-white/30 mt-0.5">Avg check-ins</p>
        </div>
      </div>
      {atRisk.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-400/15 bg-amber-400/5 px-3 py-2.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400/70 shrink-0 mt-0.5" strokeWidth={1.5} />
          <p className="text-xs text-amber-400/80">
            At risk: {atRisk.map((c) => c.name.split(" ")[0]).join(", ")}
          </p>
        </div>
      )}
      <Link
        href="/my-clients"
        className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors"
      >
        <Users className="w-3 h-3" strokeWidth={1.5} />
        View all clients
        <ArrowRight className="w-3 h-3" strokeWidth={1.5} />
      </Link>
    </div>
  );
}

function ClientOverviewPanel({ userId }: { userId: string }) {
  const [training,     setTraining    ] = useState<ClientTrainingData | null>(null);
  const [trainerName,  setTrainerName ] = useState<string | null>(null);
  const [goalLabel,    setGoalLabel   ] = useState<string | null>(null);

  useEffect(() => {
    try {
      initStore();
      setTraining(getClientTrainingData(userId));
      const users = loadUsers();
      const me    = users.find((u) => u.id === userId);
      if (me?.trainerId) {
        const trainer = users.find((u) => u.id === me.trainerId);
        if (trainer) setTrainerName(trainer.name);
      }
    } catch { /* ignore */ }

    try {
      const intake = loadIntake(userId);
      if (intake?.primaryGoal) {
        setGoalLabel(GOAL_LABELS[intake.primaryGoal] ?? null);
      }
    } catch { /* ignore */ }
  }, [userId]);

  if (!training) return null;

  const adherenceColor =
    training.adherence >= 80 ? "text-emerald-400"
    : training.adherence >= 60 ? "text-amber-400"
    : "text-[#F87171]";

  return (
    <div className="rounded-2xl border border-white/6 bg-[#111111] px-5 py-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.22em] text-white/22">My Stats</p>
        {goalLabel && (
          <span className="text-[10px] text-[#B48B40]/70 border border-[#B48B40]/20 rounded-lg px-2 py-0.5 shrink-0">
            {goalLabel}
          </span>
        )}
      </div>
      {training.program !== "Unassigned" && (
        <p className="text-sm font-medium text-white/70">{training.program}</p>
      )}
      <div className="flex gap-6">
        <div>
          <p className={cn("text-2xl font-semibold", adherenceColor)}>{training.adherence}%</p>
          <p className="text-xs text-white/30 mt-0.5">Adherence</p>
        </div>
        <div>
          <p className="text-2xl font-semibold text-white/90">{training.checkInCompletion}%</p>
          <p className="text-xs text-white/30 mt-0.5">Check-ins</p>
        </div>
        <div>
          <p className="text-2xl font-semibold text-white/90">{training.executionScore}</p>
          <p className="text-xs text-white/30 mt-0.5">Execution</p>
        </div>
      </div>
      {trainerName && (
        <p className="text-xs text-white/28">
          <span className="text-white/18">Coach · </span>{trainerName}
        </p>
      )}
    </div>
  );
}

function MasterOverviewPanel() {
  const [counts, setCounts] = useState({ total: 0, trainers: 0, clients: 0, atRisk: 0, active: 0 });

  useEffect(() => {
    try {
      initStore();
      const users = getUsers("master");
      setCounts({
        total:    users.length,
        trainers: users.filter((u) => u.role === "trainer").length,
        clients:  users.filter((u) => u.role === "client").length,
        atRisk:   users.filter((u) => u.status === "at-risk").length,
        active:   users.filter((u) => u.status === "active").length,
      });
    } catch { /* ignore */ }
  }, []);

  return (
    <div className="rounded-2xl border border-white/6 bg-[#111111] px-5 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.22em] text-white/22">Platform</p>
        <Link
          href="/admin"
          className="flex items-center gap-1 text-[10px] text-white/25 hover:text-white/55 transition-colors"
        >
          <TrendingUp className="w-3 h-3" strokeWidth={1.5} />
          Full overview
          <ArrowRight className="w-3 h-3" strokeWidth={1.5} />
        </Link>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Users",    value: counts.total,    color: "text-white/90"   },
          { label: "Trainers", value: counts.trainers,  color: "text-[#B48B40]"  },
          { label: "Clients",  value: counts.clients,   color: "text-[#93C5FD]"  },
          { label: "At risk",  value: counts.atRisk,    color: "text-amber-400"  },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-white/6 bg-white/[0.02] px-3 py-3 text-center">
            <p className={cn("text-xl font-semibold tabular-nums", color)}>{value}</p>
            <p className="text-[10px] text-white/25 mt-1">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MemberOverviewPanel() {
  const [score, setScore] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    try {
      const rawLogs   = localStorage.getItem("accountability-logs");
      const rawHabits = localStorage.getItem("accountability-habits-v2");
      if (!rawLogs || !rawHabits) return;

      const logs   = JSON.parse(rawLogs)   as Record<string, { completedHabits: string[] }>;
      const habits = JSON.parse(rawHabits) as Array<{ id: string; visible: boolean; weight: 1 | 2 | 3 }>;
      const today  = new Date().toISOString().slice(0, 10);

      const completed = logs[today]?.completedHabits ?? [];
      const visible   = habits.filter((h) => h.visible);
      const max       = visible.reduce((s, h) => s + h.weight, 0);
      const earned    = visible.filter((h) => completed.includes(h.id)).reduce((s, h) => s + h.weight, 0);
      setScore(max > 0 ? Math.round((earned / max) * 100) : 0);

      // Consistency streak
      let s = 0;
      for (let i = 0; i < 90; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key  = d.toISOString().slice(0, 10);
        const log  = logs[key];
        if (log && log.completedHabits.length > 0) s++;
        else break;
      }
      setStreak(s);
    } catch { /* ignore */ }
  }, []);

  if (score === null) return null;

  const color =
    score >= 75 ? "text-emerald-400"
    : score >= 50 ? "text-[#B48B40]"
    : "text-white/45";

  return (
    <div className="rounded-2xl border border-white/6 bg-[#111111] px-5 py-4 space-y-4">
      <p className="text-[10px] uppercase tracking-[0.22em] text-white/22">Today</p>
      <div className="flex gap-6 items-end">
        <div>
          <div className="flex items-baseline gap-1.5">
            <p className={cn("text-3xl font-semibold tabular-nums", color)}>{score}</p>
            <p className="text-sm text-white/25">/100</p>
          </div>
          <p className="text-xs text-white/30 mt-0.5">Accountability score</p>
        </div>
        {streak > 0 && (
          <div>
            <p className="text-2xl font-semibold text-[#B48B40] tabular-nums">{streak}</p>
            <p className="text-xs text-white/30 mt-0.5">Day streak</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayLabel(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month:   "long",
    day:     "numeric",
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

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

  const [ready,        setReady       ] = useState(false);
  const [role,         setRole        ] = useState<Role>("member");
  const [roleKey,      setRoleKey     ] = useState("");
  const [actualUserId, setActualUserId] = useState("");
  const [question,     setQuestion    ] = useState("");
  const pipeline = useAIPipeline();
  const hasRun   = useRef(false);

  // Auto-run performance pipeline once auth is confirmed
  useEffect(() => {
    if (!ready || !roleKey || !actualUserId || hasRun.current) return;
    hasRun.current = true;
    pipeline.run(buildRealData(roleKey, actualUserId));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, roleKey, actualUserId]);

  function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q) return;
    pipeline.ask(q, buildRealData(roleKey, actualUserId));
    setQuestion("");
  }

  useEffect(() => {
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
    setRoleKey(savedRole);
    setActualUserId(demoUser.id);

    if (tab === "overview") {
      setReady(true);
      return;
    }

    const resolvedTab = tab ?? demoUser.defaultDashboard ?? "overview";

    if (resolvedTab !== "overview" && TAB_ROUTES[resolvedTab]) {
      router.replace(TAB_ROUTES[resolvedTab]);
      return;
    }

    setReady(true);
  }, [tab, router]);

  if (!ready) return null;

  const demoUser = DEMO_USERS[roleKey] ?? DEMO_USERS.master;
  const firstName  = demoUser.name.split(" ")[0];
  const visibleCards = QUICK_CARDS.filter((c) => hasAccess(role, c.minRole));

  const ACTIVE_STATUSES = ["detecting","summarizing","deciding","formatting","educating"];

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
              disabled={!question.trim() || ACTIVE_STATUSES.includes(pipeline.status)}
              className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5 text-white/30 hover:text-white/60 hover:border-white/15 disabled:opacity-30 disabled:cursor-default transition-all"
            >
              <Send className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        </form>

        {ACTIVE_STATUSES.includes(pipeline.status) && (
          <div className="rounded-2xl border border-white/8 bg-[#111111] px-5 py-5">
            <div className="flex items-center gap-2.5">
              <Loader2 className="w-3.5 h-3.5 text-[#B48B40]/50 animate-spin" />
              <p className="text-xs text-white/30">
                {PIPELINE_LABELS[pipeline.status] ?? "Processing…"}
              </p>
            </div>
          </div>
        )}

        {pipeline.status === "error" && (
          <div className="rounded-2xl border border-red-900/30 bg-[#111111] px-5 py-4">
            <p className="text-xs text-red-400/60">{pipeline.error}</p>
          </div>
        )}

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

      {/* Role-specific overview */}
      <section className="mb-8">
        {role === "trainer" && <TrainerOverviewPanel userId={actualUserId} />}
        {role === "client"  && <ClientOverviewPanel  userId={actualUserId} />}
        {role === "master"  && <MasterOverviewPanel  />}
        {role === "member"  && <MemberOverviewPanel  />}
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
