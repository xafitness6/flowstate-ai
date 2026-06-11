"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Dumbbell, Utensils, CheckSquare,
  Bot, Trophy, CalendarDays, ArrowRight, Loader2, Send,
  Users, TrendingUp, AlertTriangle,
} from "lucide-react";
import { DEMO_USERS, useUser } from "@/context/UserContext";
import { getAccountById, accountToMockUser } from "@/lib/accounts";
import { hasAccess } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { GreetingBanner } from "@/components/dashboard/GreetingBanner";
import { TodaySnapshot }  from "@/components/dashboard/TodaySnapshot";
import { DeepCalPrompt } from "@/components/ui/DeepCalPrompt";
import { Card } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatTile";
import { SectionHeader } from "@/components/ui/SectionHeader";
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
import type { AdminProfile } from "@/lib/admin/profileMapper";
import { loadIntake, loadIntakeAsync, GOAL_LABELS } from "@/lib/data/intake";
import { calculateEnergy, type EnergyProfile } from "@/lib/nutrition";

// ─── Build real pipeline data from localStorage ───────────────────────────────

function buildRealData(roleKey: string, actualUserId: string): RawUserData {
  let habitsCompletedToday = 0;
  let totalHabits          = 0;
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

function hasCoachingInputs(userId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const rawLogs = localStorage.getItem("accountability-logs");
    if (rawLogs && Object.keys(JSON.parse(rawLogs) as Record<string, unknown>).length > 0) return true;

    const rawWorkoutLogs = localStorage.getItem(`flowstate-workout-logs-${userId}`);
    if (rawWorkoutLogs && (JSON.parse(rawWorkoutLogs) as unknown[]).length > 0) return true;

    const rawMeals = localStorage.getItem(`flowstate-meals-${userId}`);
    if (rawMeals && (JSON.parse(rawMeals) as unknown[]).length > 0) return true;

    return !!loadIntake(userId);
  } catch {
    return false;
  }
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
  { label: "Program",        sub: "Today's session",  href: "/program",        icon: Dumbbell,    minRole: "member"  as Role, accent: "text-[#B48B40]" },
  { label: "Accountability", sub: "Daily check-in",   href: "/accountability", icon: CheckSquare, minRole: "member"  as Role, accent: "text-emerald-300" },
  { label: "Nutrition",      sub: "Today's targets",  href: "/nutrition",      icon: Utensils,    minRole: "client"  as Role, accent: "text-[#93C5FD]" },
  { label: "Coach",          sub: "AI coach",         href: "/coach",          icon: Bot,         minRole: "client"  as Role, accent: "text-purple-300" },
  { label: "Calendar",       sub: "This week",        href: "/calendar",       icon: CalendarDays,minRole: "client"  as Role, accent: "text-[#B48B40]" },
  { label: "Leaderboard",    sub: "Your rank",        href: "/leaderboard",    icon: Trophy,      minRole: "member"  as Role, accent: "text-amber-300" },
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
    <Card className="px-5 py-4 space-y-4">
      <SectionHeader className="mb-0">Your Clients</SectionHeader>
      <div className="flex gap-6">
        <StatTile value={clients.length} label="Total" />
        <StatTile value={active} label="Active" valueClassName="text-emerald-400" />
        <StatTile value={`${avgComp}%`} label="Avg check-ins" valueClassName="text-[#B48B40]" />
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
    </Card>
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
    <Card className="px-5 py-4 space-y-4">
      <SectionHeader
        className="mb-0"
        action={goalLabel ? (
          <span className="text-[10px] text-[#B48B40]/70 border border-[#B48B40]/20 rounded-lg px-2 py-0.5 shrink-0">
            {goalLabel}
          </span>
        ) : undefined}
      >
        My Stats
      </SectionHeader>
      {training.program !== "Unassigned" && (
        <p className="text-sm font-medium text-white/70">{training.program}</p>
      )}
      <div className="flex gap-6">
        <StatTile value={`${training.adherence}%`} label="Adherence" valueClassName={adherenceColor} />
        <StatTile value={`${training.checkInCompletion}%`} label="Check-ins" />
        <StatTile value={training.executionScore} label="Execution" />
      </div>
      {trainerName && (
        <p className="text-xs text-white/28">
          <span className="text-white/18">Coach · </span>{trainerName}
        </p>
      )}
    </Card>
  );
}

function MasterOverviewPanel() {
  const [counts, setCounts] = useState({ total: 0, trainers: 0, clients: 0, atRisk: 0, active: 0 });

  useEffect(() => {
    let active = true;

    async function loadCounts() {
      try {
        if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
          const res = await fetch("/api/admin/users", { cache: "no-store" });
          if (res.ok) {
            const body = await res.json() as { users?: AdminProfile[] };
            const users = body.users ?? [];
            if (!active) return;
            setCounts({
              total:    users.length,
              trainers: users.filter((u) => u.role === "trainer").length,
              clients:  users.filter((u) => u.role === "client").length,
              atRisk:   users.filter((u) => u.subscription_status === "past_due").length,
              active:   users.filter((u) => u.subscription_status === "active").length,
            });
            return;
          }
        }

        initStore();
        const users = getUsers("master");
        if (!active) return;
        setCounts({
          total:    users.length,
          trainers: users.filter((u) => u.role === "trainer").length,
          clients:  users.filter((u) => u.role === "client").length,
          atRisk:   users.filter((u) => u.status === "at-risk").length,
          active:   users.filter((u) => u.status === "active").length,
        });
      } catch { /* ignore */ }
    }

    void loadCounts();
    return () => { active = false; };
  }, []);

  return (
    <Card className="px-5 py-4 space-y-4">
      <SectionHeader
        className="mb-0"
        action={
          <Link
            href="/admin"
            className="flex items-center gap-1 text-[10px] text-white/25 hover:text-white/55 transition-colors"
          >
            <TrendingUp className="w-3 h-3" strokeWidth={1.5} />
            Full overview
            <ArrowRight className="w-3 h-3" strokeWidth={1.5} />
          </Link>
        }
      >
        Platform
      </SectionHeader>
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Users",    value: counts.total,    color: "text-white/90"  },
          { label: "Trainers", value: counts.trainers,  color: "text-[#B48B40]" },
          { label: "Clients",  value: counts.clients,   color: "text-[#93C5FD]" },
          { label: "At risk",  value: counts.atRisk,    color: "text-amber-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-white/6 bg-white/[0.02] px-3 py-3 text-center">
            <StatTile value={value} label={label} valueClassName={cn("text-xl", color)} />
          </div>
        ))}
      </div>
    </Card>
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
    <Card className="px-5 py-4 space-y-4">
      <SectionHeader className="mb-0">Today</SectionHeader>
      <div className="flex gap-6 items-end">
        <div>
          <div className="flex items-baseline gap-1.5">
            <p className={cn("text-3xl font-semibold tabular-nums", color)}>{score}</p>
            <p className="text-sm text-white/25">/100</p>
          </div>
          <p className="text-xs text-white/30 mt-0.5">Accountability score</p>
        </div>
        {streak > 0 && (
          <StatTile value={streak} label="Day streak" valueClassName="text-[#B48B40]" />
        )}
      </div>
    </Card>
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
  const { user, isLoading, isSupabase } = useUser();

  const [ready,        setReady       ] = useState(false);
  const [role,         setRole        ] = useState<Role>("member");
  const [roleKey,      setRoleKey     ] = useState("");
  const [actualUserId, setActualUserId] = useState("");
  const [question,     setQuestion    ] = useState("");
  const [energy, setEnergy] = useState<EnergyProfile | null>(null);
  const pipeline = useAIPipeline();
  const hasRun   = useRef(false);

  // Energy profile (BMR / TDEE) for the dashboard card — clients & members only
  useEffect(() => {
    if (!actualUserId || (role !== "client" && role !== "member")) { setEnergy(null); return; }
    let active = true;
    loadIntakeAsync(actualUserId).then((intake) => {
      if (!active) return;
      setEnergy(intake ? calculateEnergy(intake) : null);
    });
    return () => { active = false; };
  }, [actualUserId, role]);

  // Auto-run performance pipeline once auth is confirmed
  useEffect(() => {
    if (!ready || !roleKey || !actualUserId || hasRun.current) return;
    if (!hasCoachingInputs(actualUserId)) return;
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
    // Wait for UserContext to resolve before acting
    if (isLoading) return;

    // Supabase users: use context directly — no localStorage lookup needed
    if (isSupabase) {
      setRole(user.role);
      setRoleKey(user.id);
      setActualUserId(user.id);
      setReady(true);
      return;
    }

    // Demo / local account path
    let savedRole: string | null = null;
    try {
      savedRole = localStorage.getItem("flowstate-active-role")
               || sessionStorage.getItem("flowstate-session-role");
    } catch { /* ignore */ }

    const resolvedUser = DEMO_USERS[savedRole ?? ""] ?? (() => {
      const account = savedRole ? getAccountById(savedRole) : null;
      return account ? accountToMockUser(account) : null;
    })();

    if (!resolvedUser) {
      router.replace("/login");
      return;
    }

    setRole(resolvedUser.role);
    setRoleKey(savedRole ?? "");
    setActualUserId(resolvedUser.id);

    if (tab === "overview") {
      setReady(true);
      return;
    }

    const resolvedTab = tab ?? resolvedUser.defaultDashboard ?? "overview";

    if (resolvedTab !== "overview" && TAB_ROUTES[resolvedTab]) {
      router.replace(TAB_ROUTES[resolvedTab]);
      return;
    }

    setReady(true);
  }, [tab, router, isLoading, isSupabase, user]);

  if (!ready) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-5 text-white">
        <div className="text-center space-y-2">
          <div className="mx-auto h-6 w-6 rounded-full border border-[#B48B40]/25 border-t-[#B48B40] animate-spin" />
          <p className="text-sm text-white/55">Opening dashboard...</p>
        </div>
      </div>
    );
  }

  const resolvedUser = isSupabase
    ? user
    : (DEMO_USERS[roleKey]
        ?? (() => { const a = getAccountById(roleKey); return a ? accountToMockUser(a) : null; })()
        ?? DEMO_USERS.member);
  const demoUser  = resolvedUser;
  // `demoUser.name` already prefers the user's nickname when set, see
  // src/lib/db/profiles.ts → getMyProfile().
  const firstName = demoUser.name.split(" ")[0];
  const visibleCards = QUICK_CARDS.filter((c) => hasAccess(role, c.minRole));
  const cachedCoachResult =
    pipeline.lastResult &&
    "userId" in pipeline.lastResult &&
    pipeline.lastResult.userId === actualUserId
      ? pipeline.lastResult
      : null;
  const activeCoachResult = pipeline.result ?? cachedCoachResult;

  const ACTIVE_STATUSES = ["detecting","summarizing","deciding","formatting","educating"];

  const roleLabel: Record<Role, string> = {
    member:  "Member",
    client:  "Client",
    trainer: "Trainer",
    master:  "Operator",
  };
  const planLabel = demoUser.plan ? demoUser.plan[0].toUpperCase() + demoUser.plan.slice(1) : null;

  return (
    <div className="relative min-h-screen text-white">
      {/* Ambient warmth — single radial vignette behind the entire surface,
          no card borders, just light. */}
      <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(120%_55%_at_50%_-5%,rgba(180,139,64,0.07),transparent_60%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#0A0908_0%,#0B0908_100%)] -z-10" />
      </div>

      {/* Login greeting toast still has its place — doesn't conflict with the new cover. */}
      <GreetingBanner />

      <div className="relative mx-auto max-w-[640px] px-6 md:px-8 pt-10 md:pt-14 pb-28 space-y-16 md:space-y-20">

        {/* Calibration nudge — quietly above the fold when present. */}
        {actualUserId && <DeepCalPrompt userId={actualUserId} />}

        {/* ── COVER ─────────────────────────────────────────────────────── */}
        <header className="space-y-7">
          {/* Date · role · plan as a single thin hairline row. No uppercase tracking. */}
          <div className="flex items-center gap-3 text-[12px] text-white/30 tabular-nums">
            <span>{todayLabel()}</span>
            <span aria-hidden className="h-px w-8 bg-white/15" />
            <span className="text-white/45">{roleLabel[role]}{planLabel ? ` · ${planLabel}` : ""}</span>
          </div>

          {/* Editorial greeting — light weight, big numerals-like name. */}
          <div className="space-y-1.5">
            <p className="text-[28px] md:text-[34px] font-extralight text-white/45 leading-none">
              {timeOfDayGreeting()},
            </p>
            <h1 className="text-[56px] md:text-[68px] font-medium tracking-[-0.025em] leading-[0.95]">
              {firstName}.
            </h1>
          </div>

          {/* One personal line, short. */}
          <p className="text-[15px] text-white/55 leading-relaxed max-w-md">
            {heroSubline(role)}
          </p>
        </header>

        {/* ── PULSE — three stats, no boxes, hairline-separated. */}
        <section className="grid grid-cols-3 gap-px bg-white/[0.06] rounded-2xl overflow-hidden">
          <PulseStat label="Streak"   value={getStreakFromLogs()}    suffix="d" />
          <PulseStat label="Sessions" value={getSessionsThisWeek()}  suffix=" / wk" />
          <PulseStat label="Today"    value={getTodayScore()}        suffix=" / 100" accent />
        </section>

        {/* ── TODAY'S SESSION — the ONE bordered block on the page. The CTA. */}
        <Link
          href="/program"
          className="group block relative rounded-[28px] border border-[#B48B40]/22 bg-gradient-to-b from-[#100D08] to-[#0A0908] px-7 md:px-9 py-8 md:py-10 transition-all hover:border-[#B48B40]/45 hover:shadow-[0_24px_48px_-24px_rgba(180,139,64,0.35)]"
        >
          {/* warm corner glow */}
          <div aria-hidden className="pointer-events-none absolute inset-0 rounded-[28px] bg-[radial-gradient(80%_50%_at_85%_15%,rgba(180,139,64,0.10),transparent_55%)]" />
          <div className="relative flex items-start justify-between gap-6">
            <div className="space-y-3 min-w-0">
              <p className="text-[11px] tracking-[0.08em] text-[#B48B40]/75 font-medium">Today's session</p>
              <p className="text-[28px] md:text-[32px] font-medium tracking-tight leading-[1.05]">
                Open your program
              </p>
              <p className="text-[13px] text-white/45 leading-relaxed max-w-[18rem]">
                Your training, set to your goal and what you've done this week.
              </p>
            </div>
            <div className="shrink-0 mt-1 w-11 h-11 rounded-full border border-[#B48B40]/35 flex items-center justify-center transition-all group-hover:bg-[#B48B40]/10 group-hover:border-[#B48B40]/65 group-hover:translate-x-0.5">
              <ArrowRight className="w-4 h-4 text-[#B48B40]" strokeWidth={2} />
            </div>
          </div>
        </Link>

        {/* Today snapshot — for member/client only. Borderless, just lives in the flow. */}
        {(role === "member" || role === "client") && (
          <TodaySnapshot userId={actualUserId} />
        )}

        {/* ── ENERGY — single inline line for member/client. No card, just data. */}
        {(role === "member" || role === "client") && energy && (
          <EnergyInline energy={energy} />
        )}

        {/* ── COACH — input lives on the page, reply flows below as editorial text. */}
        <section className="space-y-6">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[20px] font-medium text-white/85 tracking-tight">Ask your coach</h2>
            <Link
              href="/coach"
              className="text-[12px] text-white/35 hover:text-[#B48B40] transition-colors"
            >
              Open chat →
            </Link>
          </div>

          <form onSubmit={handleAsk}>
            <div className={cn(
              "flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-5 py-4",
              "transition-colors focus-within:border-[#B48B40]/40 focus-within:bg-[#B48B40]/[0.03]",
            )}>
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Should I push harder on legs today?"
                className="flex-1 bg-transparent text-[15px] text-white/85 placeholder:text-white/22 outline-none"
              />
              <button
                type="submit"
                disabled={!question.trim() || ACTIVE_STATUSES.includes(pipeline.status)}
                className="text-[12px] font-medium text-[#B48B40]/85 hover:text-[#B48B40] disabled:text-white/15 transition-colors"
                aria-label="Ask coach"
              >
                {ACTIVE_STATUSES.includes(pipeline.status) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" strokeWidth={1.8} />}
              </button>
            </div>
          </form>

          {/* Coach output — flowing editorial text, no nested cards. */}
          {ACTIVE_STATUSES.includes(pipeline.status) && (
            <p className="text-[13px] text-white/40 flex items-center gap-2 pt-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#B48B40]/65 animate-pulse" />
              {PIPELINE_LABELS[pipeline.status] ?? "Thinking…"}
            </p>
          )}

          {pipeline.status === "error" && (
            <p className="text-[13px] text-red-300/75">{pipeline.error}</p>
          )}

          {pipeline.activeMode === "education" && pipeline.educationResult && pipeline.status === "complete" && (
            <div className="space-y-4 pt-2">
              <p className="text-[15px] text-white/80 leading-relaxed">
                {pipeline.educationResult.explanation}
              </p>
              {pipeline.educationResult.example && (
                <p className="text-[13px] text-white/45 leading-relaxed italic border-l border-[#B48B40]/35 pl-4">
                  {pipeline.educationResult.example}
                </p>
              )}
              <p className="text-[14px] text-white/70 leading-snug pt-1">
                <span className="text-[#B48B40]/85">→ </span>{pipeline.educationResult.takeaway}
              </p>
            </div>
          )}

          {pipeline.activeMode !== "education" && activeCoachResult &&
            !["summarizing","deciding","formatting"].includes(pipeline.status) && (() => {
            const r = activeCoachResult;
            return (
              <div className="space-y-6 pt-2">
                <div>
                  <p className="text-[11px] text-white/30 mb-1.5">Today's focus</p>
                  <p className="text-[15px] text-white/85 leading-snug">{r.response.todays_focus}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-5 border-t border-white/[0.06]">
                  <div>
                    <p className="text-[11px] text-white/30 mb-1">Training range</p>
                    <p className="text-[16px] font-medium text-white/90">{r.response.training_plan.intensity}</p>
                    <p className="text-[12px] text-white/40 mt-0.5">{r.response.training_plan.duration}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-white/30 mb-1">Game plan</p>
                    <p className="text-[13px] text-white/60 leading-snug">{r.response.training_plan.summary}</p>
                  </div>
                </div>
                <p className="text-[14px] text-white/55 italic leading-snug pt-1">
                  <span className="text-[#B48B40]/85 not-italic">→ </span>{r.response.coaching_insight}
                </p>
              </div>
            );
          })()}

          {!ACTIVE_STATUSES.includes(pipeline.status)
            && pipeline.status !== "error"
            && !activeCoachResult && !pipeline.educationResult && (
            <p className="text-[13px] text-white/30 leading-relaxed pt-1">
              No recommendation yet. Ask a question or log training, nutrition, or habits to build one.
            </p>
          )}
        </section>

        {/* ── CONTINUE — editorial stacked rows, hairline-divided. Replaces the 2×3 tile grid. */}
        <section>
          <h2 className="text-[20px] font-medium text-white/85 tracking-tight mb-7">Continue</h2>
          <div className="divide-y divide-white/[0.06] border-t border-b border-white/[0.06]">
            {visibleCards.map(({ label, sub, href, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="group flex items-center justify-between gap-4 py-5 transition-colors"
              >
                <div className="flex items-center gap-5 min-w-0">
                  <Icon
                    className="w-[18px] h-[18px] text-white/35 group-hover:text-[#B48B40] transition-colors shrink-0"
                    strokeWidth={1.5}
                  />
                  <div className="min-w-0">
                    <p className="text-[15px] text-white/85 group-hover:text-white transition-colors">{label}</p>
                    <p className="text-[12px] text-white/35 mt-0.5">{sub}</p>
                  </div>
                </div>
                <ArrowRight
                  className="w-3.5 h-3.5 text-white/15 group-hover:text-[#B48B40] group-hover:translate-x-0.5 transition-all shrink-0"
                  strokeWidth={2}
                />
              </Link>
            ))}
          </div>
        </section>

        {/* ── ROLE OVERVIEW — data widgets keep their internal styling for now;
            they'll be re-skinned in a follow-up pass. */}
        {(role === "trainer" || role === "client" || role === "master" || role === "member") && (
          <section className="space-y-7">
            <h2 className="text-[20px] font-medium text-white/85 tracking-tight">
              {role === "master"  ? "Platform" :
               role === "trainer" ? "Your roster" :
               role === "client"  ? "Today" : "Stay sharp"}
            </h2>
            {role === "trainer" && <TrainerOverviewPanel userId={actualUserId} />}
            {role === "client"  && <ClientOverviewPanel  userId={actualUserId} />}
            {role === "master"  && <MasterOverviewPanel  />}
            {role === "member"  && <MemberOverviewPanel  />}
          </section>
        )}
      </div>
    </div>
  );
}

// ─── New editorial-premium dashboard components ─────────────────────────────

function PulseStat({ label, value, suffix, accent }: {
  label:   string;
  value:   number;
  suffix?: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-[#0A0908] px-5 py-6 text-center">
      <p className={cn(
        "text-[34px] md:text-[40px] font-medium tabular-nums leading-none tracking-tight",
        accent ? "text-[#B48B40]" : "text-white/90",
      )}>
        {value}<span className="text-white/30 text-[18px] md:text-[20px] font-extralight">{suffix}</span>
      </p>
      <p className="text-[11px] text-white/35 mt-2.5">{label}</p>
    </div>
  );
}

function EnergyInline({ energy }: { energy: EnergyProfile }) {
  // Pulls just BMR + target out of the EnergyProfile so the dashboard
  // surfaces a single confident metric — full breakdown lives on /nutrition.
  return (
    <section>
      <div className="flex items-baseline justify-between mb-5">
        <h2 className="text-[20px] font-medium text-white/85 tracking-tight">Energy</h2>
        <Link href="/nutrition" className="text-[12px] text-white/35 hover:text-[#B48B40] transition-colors">
          Full breakdown →
        </Link>
      </div>
      <div className="flex items-baseline gap-3">
        <p className="text-[44px] md:text-[52px] font-medium tabular-nums leading-none tracking-tight text-white/90">
          {energy.targetCalories.toLocaleString()}
        </p>
        <p className="text-[14px] text-white/40">kcal target</p>
      </div>
      <p className="text-[12px] text-white/35 mt-3">
        BMR <span className="text-white/55 tabular-nums">{energy.bmr.toLocaleString()}</span>
        <span className="mx-2.5 text-white/15">·</span>
        Maintenance <span className="text-white/55 tabular-nums">{energy.tdee.toLocaleString()}</span>
      </p>
      <div className="mt-4 h-px bg-white/[0.06] relative overflow-hidden">
        <div
          className="absolute inset-y-[-1px] left-0 bg-[#B48B40]/85"
          style={{ width: `${Math.min(100, Math.round((energy.targetCalories / Math.max(1, energy.tdee)) * 100))}%` }}
        />
      </div>
    </section>
  );
}

// ─── Hero helpers ─────────────────────────────────────────────────────────────

function timeOfDayGreeting(): string {
  const h = new Date().getHours();
  if (h < 5)  return "Late night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Good night";
}

function heroSubline(role: Role): string {
  if (role === "master")  return "Your platform pulse at a glance — users, revenue, and momentum.";
  if (role === "trainer") return "Your roster's state today. Where attention is needed, what's on track.";
  if (role === "client")  return "Everything your coach has set up for you, plus what's coming next.";
  return "What matters most today, distilled down — train, eat, recover, repeat.";
}

function getStreakFromLogs(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem("accountability-logs");
    if (!raw) return 0;
    const logs = JSON.parse(raw) as Record<string, { completedHabits?: string[] }>;
    let s = 0;
    for (let i = 0; i < 90; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      if ((logs[key]?.completedHabits?.length ?? 0) > 0) s++;
      else break;
    }
    return s;
  } catch { return 0; }
}

function getSessionsThisWeek(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem("accountability-logs");
    if (!raw) return 0;
    const logs = JSON.parse(raw) as Record<string, { completedHabits?: string[] }>;
    const dow = new Date().getDay();
    const daysFromMon = dow === 0 ? 6 : dow - 1;
    let count = 0;
    for (let i = 0; i <= daysFromMon; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      if (logs[key]?.completedHabits?.includes("training")) count++;
    }
    return count;
  } catch { return 0; }
}

function getTodayScore(): number {
  if (typeof window === "undefined") return 0;
  try {
    const rawHabits = localStorage.getItem("accountability-habits-v2");
    const rawLogs   = localStorage.getItem("accountability-logs");
    if (!rawHabits || !rawLogs) return 0;
    const habits = JSON.parse(rawHabits) as Array<{ id: string; visible?: boolean; weight?: 1 | 2 | 3 }>;
    const logs   = JSON.parse(rawLogs)   as Record<string, { completedHabits?: string[] }>;
    const today  = new Date().toISOString().slice(0, 10);
    const visible = habits.filter((h) => h.visible !== false);
    const max = visible.reduce((s, h) => s + (h.weight ?? 1), 0);
    if (max === 0) return 0;
    const done = logs[today]?.completedHabits ?? [];
    const earned = visible.filter((h) => done.includes(h.id)).reduce((s, h) => s + (h.weight ?? 1), 0);
    return Math.round((earned / max) * 100);
  } catch { return 0; }
}
