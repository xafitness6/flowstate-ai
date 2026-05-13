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
  const firstName = demoUser.name.split(" ")[0];
  const visibleCards = QUICK_CARDS.filter((c) => hasAccess(role, c.minRole));

  const ACTIVE_STATUSES = ["detecting","summarizing","deciding","formatting","educating"];

  const roleLabel: Record<Role, string> = {
    member:  "Member",
    client:  "Client",
    trainer: "Trainer",
    master:  "Operator",
  };
  const planLabel = demoUser.plan ? demoUser.plan[0].toUpperCase() + demoUser.plan.slice(1) : null;

  return (
    <div className="relative px-5 md:px-8 py-6 text-white max-w-5xl mx-auto">
      <GreetingBanner />

      {/* Ambient glow — backdrop behind hero */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[400px] overflow-hidden" aria-hidden>
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full bg-[#B48B40]/[0.05] blur-[120px]" />
      </div>

      {/* ── HERO ───────────────────────────────────────────────────────────── */}
      <Card className="relative mb-6 border-white/[0.08] bg-gradient-to-br from-[#141414] via-[#0F0F0F] to-[#0A0A0A]">
        <div className="px-6 md:px-8 py-7 md:py-8">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-end">
            <div className="md:col-span-3 min-w-0">
              <div className="flex items-center gap-2 mb-3">
                <p className="text-[10px] uppercase tracking-[0.28em] text-white/40">
                  {todayLabel()}
                </p>
                <span className="text-white/15">·</span>
                <span className="text-[10px] uppercase tracking-[0.2em] text-[#B48B40]/85 px-2 py-0.5 rounded-full border border-[#B48B40]/25 bg-[#B48B40]/[0.06]">
                  {roleLabel[role]}
                </span>
                {planLabel && (
                  <span className="text-[10px] uppercase tracking-[0.2em] text-white/45 px-2 py-0.5 rounded-full border border-white/8 bg-white/[0.02]">
                    {planLabel}
                  </span>
                )}
              </div>
              <h1 className="text-[2.5rem] md:text-[3rem] leading-[1.05] font-semibold tracking-tight">
                {timeOfDayGreeting()},
                <span className="block text-white/55 font-light">{firstName}.</span>
              </h1>
              <p className="mt-3 text-sm text-white/45 max-w-md leading-relaxed">
                {heroSubline(role)}
              </p>
            </div>

            <div className="md:col-span-2 grid grid-cols-3 gap-3">
              <HeroStat
                label="Streak"
                value={getStreakFromLogs()}
                unit="d"
                accent="text-[#B48B40]"
              />
              <HeroStat
                label="Sessions"
                value={getSessionsThisWeek()}
                unit="/wk"
              />
              <HeroStat
                label="Score"
                value={getTodayScore()}
                unit="/100"
                accent="text-emerald-300"
              />
            </div>
          </div>
        </div>

        {/* Primary CTA strip */}
        <Link
          href="/program"
          className="relative flex items-center justify-between gap-4 border-t border-white/[0.06] px-6 md:px-8 py-4 hover:bg-white/[0.02] transition-colors group"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#B48B40]/10 border border-[#B48B40]/25 flex items-center justify-center shrink-0">
              <Dumbbell className="w-4 h-4 text-[#B48B40]" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white/90">Today&apos;s session</p>
              <p className="text-[11px] text-white/40 truncate">Open your program to start training</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-white/30 group-hover:text-white/70 group-hover:translate-x-0.5 transition-all" strokeWidth={2} />
        </Link>
      </Card>

      <div className="relative space-y-6">
        {/* Today's snapshot — first thing a client/member sees */}
        {(role === "member" || role === "client") && (
          <TodaySnapshot userId={actualUserId} />
        )}

        {/* Deep calibration nudge */}
        {actualUserId && (
          <DeepCalPrompt userId={actualUserId} />
        )}

        {/* Two-column on desktop: AI Coach left, Role panel right */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* AI Coach */}
          <Card className="lg:col-span-3">
            <div className="px-5 pt-5 pb-4 border-b border-white/[0.05]">
              <div className="flex items-center justify-between mb-1">
                <SectionHeader className="mb-0">AI Coach</SectionHeader>
                <Link
                  href="/coach"
                  className="text-[10px] text-white/35 hover:text-white/70 flex items-center gap-1 transition-colors"
                >
                  Open chat <ArrowRight className="w-3 h-3" strokeWidth={2} />
                </Link>
              </div>
              <p className="text-[11px] text-white/40">Ask for a plan, an adjustment, or an explanation.</p>
            </div>

            <form onSubmit={handleAsk} className="px-5 py-4 border-b border-white/[0.05]">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="e.g. Should I push harder on legs today?"
                  className="flex-1 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-2.5 text-sm text-white/80 placeholder:text-white/25 outline-none focus:border-[#B48B40]/40 focus:bg-[#B48B40]/[0.04] transition-all"
                />
                <button
                  type="submit"
                  disabled={!question.trim() || ACTIVE_STATUSES.includes(pipeline.status)}
                  className="rounded-xl bg-[#B48B40] text-black px-3.5 py-2.5 hover:bg-[#c99840] disabled:bg-white/[0.04] disabled:text-white/25 disabled:cursor-default transition-all"
                  aria-label="Ask coach"
                >
                  <Send className="w-4 h-4" strokeWidth={2} />
                </button>
              </div>
            </form>

            <div className="px-5 py-4 space-y-3 min-h-[80px]">
              {ACTIVE_STATUSES.includes(pipeline.status) && (
                <div className="flex items-center gap-2.5">
                  <Loader2 className="w-3.5 h-3.5 text-[#B48B40]/60 animate-spin" />
                  <p className="text-xs text-white/45">
                    {PIPELINE_LABELS[pipeline.status] ?? "Processing…"}
                  </p>
                </div>
              )}

              {pipeline.status === "error" && (
                <p className="text-xs text-red-400/75">{pipeline.error}</p>
              )}

              {pipeline.activeMode === "education" && pipeline.educationResult && pipeline.status === "complete" && (
                <div className="space-y-3">
                  <p className="text-sm text-white/80 leading-relaxed">
                    {pipeline.educationResult.explanation}
                  </p>
                  {pipeline.educationResult.example && (
                    <p className="text-xs text-white/45 leading-relaxed italic border-l-2 border-white/10 pl-3">
                      {pipeline.educationResult.example}
                    </p>
                  )}
                  <div className="flex gap-2.5 pt-2 border-t border-white/[0.05]">
                    <div className="w-[2px] rounded-full bg-[#B48B40]/40 shrink-0 mt-0.5" />
                    <p className="text-sm text-white/65 leading-snug">
                      {pipeline.educationResult.takeaway}
                    </p>
                  </div>
                </div>
              )}

              {pipeline.activeMode !== "education" && (pipeline.result ?? pipeline.lastResult) &&
                !["summarizing","deciding","formatting"].includes(pipeline.status) && (() => {
                const r = pipeline.result ?? pipeline.lastResult!;
                return (
                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.18em] text-white/30 mb-1.5">Today&apos;s focus</p>
                      <p className="text-sm text-white/85 leading-snug">{r.response.todays_focus}</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-white/[0.05]">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.18em] text-white/30 mb-1">Training range</p>
                        <p className="text-sm font-semibold text-white/90">{r.response.training_plan.intensity}</p>
                        <p className="text-[11px] text-white/40 mt-0.5">{r.response.training_plan.duration}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.18em] text-white/30 mb-1">Game plan</p>
                        <p className="text-xs text-white/55 leading-snug">{r.response.training_plan.summary}</p>
                      </div>
                    </div>
                    <div className="flex gap-2.5 pt-3 border-t border-white/[0.05]">
                      <div className="w-[2px] rounded-full bg-[#B48B40]/40 shrink-0 mt-0.5" />
                      <p className="text-sm text-white/55 italic leading-snug">{r.response.coaching_insight}</p>
                    </div>
                  </div>
                );
              })()}

              {!ACTIVE_STATUSES.includes(pipeline.status)
                && pipeline.status !== "error"
                && !pipeline.result && !pipeline.lastResult && !pipeline.educationResult && (
                <p className="text-xs text-white/30">No conversation yet — ask anything to get started.</p>
              )}
            </div>
          </Card>

          {/* Role-specific overview */}
          <div className="lg:col-span-2 space-y-6">
            {role === "trainer" && <TrainerOverviewPanel userId={actualUserId} />}
            {role === "client"  && <ClientOverviewPanel  userId={actualUserId} />}
            {role === "master"  && <MasterOverviewPanel  />}
            {role === "member"  && <MemberOverviewPanel  />}
          </div>
        </div>

        {/* Quick access */}
        <section>
          <SectionHeader
            action={
              <span className="text-[11px] text-white/30">
                {visibleCards.length} shortcuts
              </span>
            }
          >
            Quick Access
          </SectionHeader>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
            {visibleCards.map(({ label, sub, href, icon: Icon, accent }) => (
              <Link
                key={href}
                href={href}
                className="group relative rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 hover:border-white/15 hover:bg-white/[0.04] transition-all overflow-hidden"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={cn(
                    "w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 transition-colors",
                    "border-white/[0.08] bg-white/[0.03] group-hover:border-white/15 group-hover:bg-white/[0.06]",
                  )}>
                    <Icon className={cn("w-4 h-4", accent)} strokeWidth={1.8} />
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-white/15 group-hover:text-white/55 group-hover:translate-x-0.5 transition-all" strokeWidth={2} />
                </div>
                <p className="text-sm font-semibold text-white/85 leading-none">{label}</p>
                <p className="text-[11px] text-white/35 mt-1.5">{sub}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
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

function HeroStat({ label, value, unit, accent }: {
  label: string; value: number | string; unit?: string; accent?: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3">
      <p className={cn("text-2xl font-semibold tracking-tight tabular-nums", accent ?? "text-white/90")}>
        {value}
        {unit && <span className="text-xs text-white/30 ml-0.5 font-normal">{unit}</span>}
      </p>
      <p className="text-[10px] uppercase tracking-[0.15em] text-white/35 mt-1">{label}</p>
    </div>
  );
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
