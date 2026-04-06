"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Dumbbell, Play, ChevronRight, Flame, Calendar,
  TrendingUp, Zap, Plus, Clock, CheckCircle2, BarChart2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/context/UserContext";
import {
  loadActiveProgram, getLogsThisWeek, getWorkoutLogs, getNextWorkout,
  type ActiveProgram, type Workout, type WorkoutLog,
} from "@/lib/workout";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAYS_SHORT  = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const GOAL_LABEL: Record<string, string> = {
  muscle_gain: "Hypertrophy",
  fat_loss:    "Fat Loss",
  strength:    "Strength",
  endurance:   "Endurance",
  recomp:      "Body Recomp",
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function addWeeks(iso: string, weeks: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().split("T")[0];
}

function elapsedLabel(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs  < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-base font-bold text-white/85">{value}</span>
      <span className="text-[10px] text-white/35 uppercase tracking-[0.15em]">{label}</span>
    </div>
  );
}

function WeekStrip({
  workouts, weekLogs,
}: {
  workouts:  Workout[];
  weekLogs:  WorkoutLog[];
}) {
  const today         = new Date().getDay();
  const trainingDays  = new Set(workouts.map((w) => w.scheduledDay));
  const completedDays = new Set(weekLogs.map((l) => new Date(l.completedAt).getDay()));

  return (
    <div className="flex items-center justify-between">
      {Array.from({ length: 7 }, (_, i) => {
        const isToday     = i === today;
        const isTraining  = trainingDays.has(i);
        const isDone      = completedDays.has(i) && isTraining;

        return (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <span className={cn(
              "text-[10px] uppercase tracking-[0.12em] font-medium",
              isToday ? "text-white/70" : "text-white/28"
            )}>
              {DAYS_SHORT[i]}
            </span>
            <div className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center transition-all",
              isDone     ? "bg-[#B48B40]/20 border border-[#B48B40]/40"
              : isTraining && isToday  ? "bg-[#B48B40] border border-[#B48B40]"
              : isTraining             ? "bg-white/[0.06] border border-white/12"
              :                          "bg-transparent border border-white/5"
            )}>
              {isDone ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-[#B48B40]" strokeWidth={2} />
              ) : isTraining && isToday ? (
                <Zap className="w-3 h-3 text-black" strokeWidth={2.5} />
              ) : isTraining ? (
                <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
              ) : (
                <div className="w-1 h-1 rounded-full bg-white/10" />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RecentLogCard({ log }: { log: WorkoutLog }) {
  const sets  = log.setsCompleted;
  const mins  = log.durationMins;
  return (
    <div className="flex items-center gap-3 py-3 border-b border-white/[0.04] last:border-0">
      <div className="w-8 h-8 rounded-xl bg-[#B48B40]/10 border border-[#B48B40]/20 flex items-center justify-center shrink-0">
        <CheckCircle2 className="w-3.5 h-3.5 text-[#B48B40]" strokeWidth={2} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white/75 truncate">{log.workoutName}</p>
        <p className="text-[11px] text-white/30 mt-0.5">{sets} sets · {mins} min</p>
      </div>
      <span className="text-[11px] text-white/22 shrink-0">{elapsedLabel(log.completedAt)}</span>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyProgram() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-8 text-center space-y-6">
      <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.07] flex items-center justify-center">
        <Dumbbell className="w-7 h-7 text-white/20" strokeWidth={1.5} />
      </div>
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-white/60">No program yet</h2>
        <p className="text-sm text-white/30 leading-relaxed">
          Generate a personalized program with AI or build one manually.
        </p>
      </div>
      <div className="flex gap-3 w-full max-w-xs">
        <Link
          href="/program/generate"
          className="flex-1 rounded-2xl bg-[#B48B40] text-black py-3 text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-[#c99840] transition-all"
        >
          <Zap className="w-4 h-4" strokeWidth={2.5} /> Generate
        </Link>
        <Link
          href="/program/builder"
          className="flex-1 rounded-2xl border border-white/10 text-white/50 py-3 text-sm font-medium flex items-center justify-center gap-1.5 hover:border-white/20 hover:text-white/70 transition-all"
        >
          <Plus className="w-4 h-4" strokeWidth={2} /> Build
        </Link>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProgramPage() {
  const router  = useRouter();
  const { user } = useUser();

  const [program,    setProgram]    = useState<ActiveProgram | null>(null);
  const [weekLogs,   setWeekLogs]   = useState<WorkoutLog[]>([]);
  const [recentLogs, setRecentLogs] = useState<WorkoutLog[]>([]);
  const [nextWo,     setNextWo]     = useState<Workout | null>(null);
  const [loaded,     setLoaded]     = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    const prog  = loadActiveProgram(user.id);
    const wLogs = getLogsThisWeek(user.id);
    const aLogs = getWorkoutLogs(user.id).sort((a, b) => b.completedAt - a.completedAt);

    setProgram(prog);
    setWeekLogs(wLogs);
    setRecentLogs(aLogs.slice(0, 5));
    if (prog) setNextWo(getNextWorkout(prog, wLogs));
    setLoaded(true);
  }, [user?.id]);

  if (!loaded) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border-2 border-[#B48B40]/30 border-t-[#B48B40] animate-spin" />
      </div>
    );
  }

  if (!program) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white">
        <div className="px-5 pt-8 pb-4">
          <h1 className="text-2xl font-bold tracking-tight">Program</h1>
        </div>
        <EmptyProgram />
      </div>
    );
  }

  const progress   = weekLogs.length / program.daysPerWeek;
  const endDate    = addWeeks(program.startDate, program.durationWeeks);
  const goalLabel  = GOAL_LABEL[program.goal] ?? program.goal;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white pb-24">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full bg-[#B48B40]/[0.035] blur-[100px]" />
      </div>

      {/* ── Header ── */}
      <div className="relative px-5 pt-8 pb-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/28 mb-1">Active Program</p>
            <h1 className="text-2xl font-bold tracking-tight leading-tight">{program.name}</h1>
            <p className="text-[11px] text-white/35 mt-1.5">
              {goalLabel} · {fmtDate(program.startDate)} → {fmtDate(endDate)}
            </p>
          </div>
          <Link
            href="/program/generate"
            className="w-9 h-9 rounded-xl border border-white/[0.08] bg-white/[0.03] flex items-center justify-center hover:border-white/15 transition-all"
          >
            <Zap className="w-4 h-4 text-white/40" strokeWidth={2} />
          </Link>
        </div>

        {/* Week + progress */}
        <div className="mt-4 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#B48B40]">Week {program.currentWeek}</span>
            <span className="text-xs text-white/25">of {program.durationWeeks}</span>
          </div>
          <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#B48B40]/70 rounded-full transition-all"
              style={{ width: `${Math.min((program.currentWeek / program.durationWeeks) * 100, 100)}%` }}
            />
          </div>
          <span className="text-[11px] text-white/28">
            {Math.round((program.currentWeek / program.durationWeeks) * 100)}%
          </span>
        </div>
      </div>

      <div className="relative px-5 space-y-4">

        {/* ── Next workout card ── */}
        {nextWo && (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] overflow-hidden">
            <div className="px-5 pt-5 pb-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] uppercase tracking-[0.25em] text-white/28">
                  {new Date().getDay() === nextWo.scheduledDay ? "Today" : `Up next · ${nextWo.dayLabel}`}
                </p>
                <div className="flex items-center gap-1.5 text-[11px] text-white/30">
                  <Clock className="w-3 h-3" strokeWidth={1.5} />
                  ~{nextWo.estimatedDuration} min
                </div>
              </div>

              <h2 className="text-lg font-bold text-white/90 leading-tight">{nextWo.focus}</h2>
              <p className="text-xs text-white/35 mt-1">
                {nextWo.exercises.length} exercises · {nextWo.warmup.general.length + nextWo.warmup.activation.length + nextWo.warmup.mobility.length} warm-up steps
              </p>

              {/* Exercise preview */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {nextWo.exercises.slice(0, 4).map((ex) => (
                  <span
                    key={ex.exerciseId}
                    className="text-[10px] text-white/40 bg-white/[0.04] border border-white/[0.06] px-2 py-0.5 rounded-lg"
                  >
                    {ex.name}
                  </span>
                ))}
                {nextWo.exercises.length > 4 && (
                  <span className="text-[10px] text-white/25 px-2 py-0.5">
                    +{nextWo.exercises.length - 4} more
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={() => router.push(`/program/workout/${nextWo.workoutId}`)}
              className="w-full bg-[#B48B40] text-black py-4 text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#c99840] active:scale-[0.99] transition-all"
            >
              <Play className="w-4 h-4" strokeWidth={2.5} fill="currentColor" />
              Start Workout
            </button>
          </div>
        )}

        {/* ── This week ── */}
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-5 py-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/28">This week</p>
            <div className="flex items-center gap-3">
              <StatPill label="done" value={weekLogs.length} />
              <div className="w-px h-6 bg-white/[0.06]" />
              <StatPill label="target" value={program.daysPerWeek} />
            </div>
          </div>

          <WeekStrip workouts={program.workouts} weekLogs={weekLogs} />

          {/* Week progress bar */}
          <div className="h-1 bg-white/[0.05] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#B48B40]/60 rounded-full transition-all"
              style={{ width: `${Math.min(progress * 100, 100)}%` }}
            />
          </div>
        </div>

        {/* ── Weekly schedule ── */}
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-5 py-4 space-y-1">
          <p className="text-[10px] uppercase tracking-[0.25em] text-white/28 mb-3">Weekly schedule</p>
          {program.workouts.map((w) => (
            <button
              key={w.workoutId}
              onClick={() => router.push(`/program/workout/${w.workoutId}`)}
              className="w-full flex items-center gap-3 py-2.5 hover:bg-white/[0.02] -mx-2 px-2 rounded-xl transition-all group"
            >
              <div className="w-8 h-8 rounded-xl bg-[#B48B40]/10 border border-[#B48B40]/20 flex items-center justify-center shrink-0">
                <Dumbbell className="w-3.5 h-3.5 text-[#B48B40]" strokeWidth={2} />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-white/75 group-hover:text-white/90 transition-colors">{w.focus}</p>
                <p className="text-[11px] text-white/30">{w.dayLabel} · {w.exercises.length} exercises</p>
              </div>
              <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/40 transition-colors" />
            </button>
          ))}
        </div>

        {/* ── Progress snapshot ── */}
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-5 py-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/28">Progress</p>
            <Link
              href="/program/analytics"
              className="text-[11px] text-white/35 hover:text-white/60 flex items-center gap-1 transition-colors"
            >
              View all <BarChart2 className="w-3 h-3" strokeWidth={2} />
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: "Sessions",    value: recentLogs.length,          icon: <Dumbbell className="w-4 h-4" strokeWidth={1.5} /> },
              { label: "This week",   value: `${weekLogs.length}/${program.daysPerWeek}`, icon: <Calendar className="w-4 h-4" strokeWidth={1.5} /> },
              { label: "Streak",      value: `${weekLogs.length > 0 ? 1 : 0}wk`, icon: <Flame className="w-4 h-4" strokeWidth={1.5} /> },
            ].map(({ label, value, icon }) => (
              <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-3 flex flex-col gap-1.5">
                <div className="text-white/30">{icon}</div>
                <p className="text-base font-bold text-white/80">{value}</p>
                <p className="text-[10px] text-white/28 uppercase tracking-[0.12em]">{label}</p>
              </div>
            ))}
          </div>

          {/* Volume chart placeholder */}
          <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] px-4 py-3 flex items-center gap-3">
            <TrendingUp className="w-4 h-4 text-white/20 shrink-0" strokeWidth={1.5} />
            <p className="text-xs text-white/30">
              Volume trends · analytics available after 3+ sessions
            </p>
          </div>
        </div>

        {/* ── Recent sessions ── */}
        {recentLogs.length > 0 && (
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-5 py-4">
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/28 mb-1">Recent sessions</p>
            {recentLogs.map((log) => (
              <RecentLogCard key={log.logId} log={log} />
            ))}
          </div>
        )}

        {/* ── Action links ── */}
        <div className="grid grid-cols-2 gap-3 pb-4">
          <Link
            href="/program/generate"
            className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3.5 flex items-center gap-2.5 hover:border-white/12 transition-all"
          >
            <Zap className="w-4 h-4 text-[#B48B40]" strokeWidth={2} />
            <span className="text-sm text-white/55 font-medium">Generate</span>
          </Link>
          <Link
            href="/program/builder"
            className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3.5 flex items-center gap-2.5 hover:border-white/12 transition-all"
          >
            <Plus className="w-4 h-4 text-white/35" strokeWidth={2} />
            <span className="text-sm text-white/55 font-medium">Build</span>
          </Link>
        </div>

      </div>
    </div>
  );
}
