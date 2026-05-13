"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Dumbbell, Play, ChevronRight, Zap, Plus, Clock,
  CheckCircle2, BarChart2, Mic, Library,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/context/UserContext";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import {
  loadActiveProgramForUser, getLogsThisWeekForUser, getWorkoutLogsForUser, getNextWorkout,
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

// ─── Week strip ──────────────────────────────────────────────────────────────

function WeekStrip({
  workouts, weekLogs,
}: {
  workouts: Workout[];
  weekLogs: WorkoutLog[];
}) {
  const today         = new Date().getDay();
  const trainingDays  = new Set(workouts.map((w) => w.scheduledDay));
  const completedDays = new Set(weekLogs.map((l) => new Date(l.completedAt).getDay()));

  return (
    <div className="flex items-center justify-between">
      {Array.from({ length: 7 }, (_, i) => {
        const isToday    = i === today;
        const isTraining = trainingDays.has(i);
        const isDone     = completedDays.has(i) && isTraining;

        return (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <span className={cn(
              "text-[10px] uppercase tracking-[0.12em] font-medium",
              isToday ? "text-white/70" : "text-white/30",
            )}>
              {DAYS_SHORT[i]}
            </span>
            <div className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center transition-all",
              isDone                  ? "bg-[#B48B40]/20 border border-[#B48B40]/40"
              : isTraining && isToday ? "bg-[#B48B40] border border-[#B48B40]"
              : isTraining            ? "bg-white/[0.06] border border-white/12"
              :                         "bg-transparent border border-white/5",
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

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyProgram() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-8 text-center space-y-6">
      <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.07] flex items-center justify-center">
        <Dumbbell className="w-7 h-7 text-white/20" strokeWidth={1.5} />
      </div>
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-white/60">No active program</h2>
        <p className="text-sm text-white/30 leading-relaxed">
          Generate one with AI, build your own, or pick from your library.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2 w-full max-w-md">
        <Link
          href="/program/generate"
          className="rounded-xl bg-[#B48B40] text-black py-3 text-xs font-semibold flex flex-col items-center gap-1.5 hover:bg-[#c99840] transition-all"
        >
          <Zap className="w-4 h-4" strokeWidth={2.5} /> Generate
        </Link>
        <Link
          href="/program/builder"
          className="rounded-xl border border-white/10 text-white/60 py-3 text-xs font-medium flex flex-col items-center gap-1.5 hover:border-white/20 hover:text-white/80 transition-all"
        >
          <Plus className="w-4 h-4" strokeWidth={2} /> Build
        </Link>
        <Link
          href="/program/library"
          className="rounded-xl border border-white/10 text-white/60 py-3 text-xs font-medium flex flex-col items-center gap-1.5 hover:border-white/20 hover:text-white/80 transition-all"
        >
          <Library className="w-4 h-4" strokeWidth={2} /> Library
        </Link>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProgramPage() {
  const router  = useRouter();
  const { user, isLoading: userLoading } = useUser();

  const [program,    setProgram]    = useState<ActiveProgram | null>(null);
  const [weekLogs,   setWeekLogs]   = useState<WorkoutLog[]>([]);
  const [recentLogs, setRecentLogs] = useState<WorkoutLog[]>([]);
  const [nextWo,     setNextWo]     = useState<Workout | null>(null);

  useEffect(() => {
    if (userLoading) return;
    if (!user?.id) return;

    let active = true;

    (async () => {
      const [prog, wLogs, allLogs] = await Promise.all([
        loadActiveProgramForUser(user.id).catch(() => null),
        getLogsThisWeekForUser(user.id).catch(() => [] as WorkoutLog[]),
        getWorkoutLogsForUser(user.id).catch(() => [] as WorkoutLog[]),
      ]);

      if (!active) return;
      const sortedLogs = allLogs.sort((a, b) => b.completedAt - a.completedAt);
      setProgram(prog);
      setWeekLogs(wLogs);
      setRecentLogs(sortedLogs.slice(0, 5));
      setNextWo(prog ? getNextWorkout(prog, wLogs) : null);
    })();

    return () => { active = false; };
  }, [user?.id, userLoading]);

  if (!program) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white">
        <div className="px-5 md:px-8 pt-8 pb-4">
          <h1 className="text-2xl font-bold tracking-tight">Program</h1>
        </div>
        <EmptyProgram />
      </div>
    );
  }

  const weekProgress = Math.min(weekLogs.length / program.daysPerWeek, 1);
  const blockProgress = Math.min(program.currentWeek / program.durationWeeks, 1);
  const endDate    = addWeeks(program.startDate, program.durationWeeks);
  const goalLabel  = GOAL_LABEL[program.goal] ?? program.goal;
  const todayDow   = new Date().getDay();
  const isToday    = nextWo?.scheduledDay === todayDow;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white pb-24">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full bg-[#B48B40]/[0.035] blur-[100px]" />
      </div>

      <div className="relative px-5 md:px-8 pt-8 max-w-3xl mx-auto">
        {/* ── 1. Header strip: active program identity ── */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/30 mb-1.5">Active Program</p>
              <h1 className="text-2xl font-bold tracking-tight leading-tight truncate">{program.name}</h1>
              <p className="text-[11px] text-white/40 mt-1.5">
                {goalLabel} · {program.daysPerWeek} days/wk · {fmtDate(program.startDate)} → {fmtDate(endDate)}
              </p>
            </div>
            <Link
              href="/program/library"
              className="shrink-0 w-9 h-9 rounded-xl border border-white/[0.08] bg-white/[0.03] flex items-center justify-center hover:border-white/15 transition-all"
              aria-label="Open library"
            >
              <Library className="w-4 h-4 text-white/40" strokeWidth={2} />
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-[#B48B40]">Week {program.currentWeek}</span>
            <span className="text-xs text-white/30">of {program.durationWeeks}</span>
            <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#B48B40]/70 rounded-full transition-all"
                style={{ width: `${blockProgress * 100}%` }}
              />
            </div>
            <span className="text-[11px] text-white/30 tabular-nums">{Math.round(blockProgress * 100)}%</span>
          </div>
        </div>

        <div className="space-y-4">
          {/* ── Week brief: phase context + intent + progression ── */}
          {program.description && program.description.includes("—") && (
            <Card className="border-[#B48B40]/15 bg-gradient-to-br from-[#B48B40]/[0.04] to-transparent">
              <div className="px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-[#B48B40]/15 border border-[#B48B40]/25 flex items-center justify-center shrink-0">
                    <Zap className="w-3.5 h-3.5 text-[#B48B40]" strokeWidth={2.5} />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <p className="text-[10px] uppercase tracking-[0.25em] text-[#B48B40]/80">This week</p>
                    <p className="text-sm text-white/85 leading-relaxed">
                      {program.description.split("—").map((s, i, arr) => (
                        <span key={i}>
                          {i > 0 && <span className="text-white/25 mx-1.5">·</span>}
                          {s.trim()}
                          {i === arr.length - 1 ? "" : ""}
                        </span>
                      ))}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* ── 2. Hero: today / next session ── */}
          {nextWo && (
            <Card className="border-[#B48B40]/15">
              <div className="px-5 pt-5 pb-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-[#B48B40]/80">
                    {isToday ? "Today" : `Up next · ${nextWo.dayLabel}`}
                  </p>
                  <div className="flex items-center gap-1.5 text-[11px] text-white/40">
                    <Clock className="w-3 h-3" strokeWidth={1.5} />
                    ~{nextWo.estimatedDuration} min
                  </div>
                </div>

                <h2 className="text-lg font-bold text-white/95 leading-tight">{nextWo.focus}</h2>
                <p className="text-xs text-white/40 mt-1">
                  {nextWo.exercises.length} exercises · warm-up included
                </p>

                <div className="mt-3 space-y-1.5">
                  {nextWo.exercises.slice(0, 3).map((ex) => (
                    <div key={ex.exerciseId} className="flex items-center gap-2 text-xs">
                      <div className="w-1 h-1 rounded-full bg-white/25" />
                      <span className="text-white/65 truncate">{ex.name}</span>
                      <span className="text-white/25 ml-auto shrink-0">
                        {ex.sets.length} × {ex.sets[0]?.targetReps ?? "—"}
                      </span>
                    </div>
                  ))}
                  {nextWo.exercises.length > 3 && (
                    <p className="text-[11px] text-white/25 pl-3">
                      +{nextWo.exercises.length - 3} more
                    </p>
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
            </Card>
          )}

          {/* ── 3. This week ── */}
          <Card>
            <div className="px-5 py-4 space-y-4">
              <SectionHeader
                className="mb-0"
                action={
                  <span className="text-[11px] text-white/40 tabular-nums">
                    {weekLogs.length} of {program.daysPerWeek}
                  </span>
                }
              >
                This week
              </SectionHeader>

              <WeekStrip workouts={program.workouts} weekLogs={weekLogs} />

              <div className="h-1 bg-white/[0.05] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#B48B40]/60 rounded-full transition-all"
                  style={{ width: `${weekProgress * 100}%` }}
                />
              </div>

              {/* Weekly schedule list */}
              <div className="pt-2 border-t border-white/[0.05]">
                {program.workouts.map((w) => {
                  const done = new Set(weekLogs.map((l) => new Date(l.completedAt).getDay())).has(w.scheduledDay);
                  return (
                    <button
                      key={w.workoutId}
                      onClick={() => router.push(`/program/workout/${w.workoutId}`)}
                      className="w-full flex items-center gap-3 py-2.5 hover:bg-white/[0.02] -mx-2 px-2 rounded-xl transition-all group"
                    >
                      <div className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                        done ? "bg-[#B48B40]/15 border border-[#B48B40]/25" : "bg-white/[0.04] border border-white/[0.06]",
                      )}>
                        {done ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#B48B40]" strokeWidth={2} />
                        ) : (
                          <Dumbbell className="w-3 h-3 text-white/40" strokeWidth={2} />
                        )}
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <p className="text-sm font-medium text-white/80 group-hover:text-white/95 transition-colors truncate">{w.focus}</p>
                        <p className="text-[11px] text-white/35">{w.dayLabel} · {w.exercises.length} ex</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/40 transition-colors shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>

          {/* ── 4. Recent sessions ── */}
          {recentLogs.length > 0 && (
            <Card>
              <div className="px-5 py-4">
                <SectionHeader
                  action={
                    <Link
                      href="/program/analytics"
                      className="text-[11px] text-white/40 hover:text-white/70 flex items-center gap-1 transition-colors"
                    >
                      Analytics <BarChart2 className="w-3 h-3" strokeWidth={2} />
                    </Link>
                  }
                >
                  Recent sessions
                </SectionHeader>

                <div className="space-y-0">
                  {recentLogs.map((log) => (
                    <div key={log.logId} className="flex items-center gap-3 py-2.5 border-b border-white/[0.04] last:border-0">
                      <div className="w-7 h-7 rounded-lg bg-[#B48B40]/10 border border-[#B48B40]/20 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#B48B40]" strokeWidth={2} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white/80 truncate">{log.workoutName}</p>
                        <p className="text-[11px] text-white/30 mt-0.5">{log.setsCompleted} sets · {log.durationMins} min</p>
                      </div>
                      <span className="text-[11px] text-white/25 shrink-0">{elapsedLabel(log.completedAt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* ── Plan a session ── */}
          <Card>
            <div className="px-5 py-4">
              <SectionHeader>Plan a session</SectionHeader>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Link
                  href="/program/generate"
                  className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 hover:border-[#B48B40]/30 hover:bg-[#B48B40]/[0.04] transition-all group"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#B48B40]/10 border border-[#B48B40]/20 flex items-center justify-center shrink-0 group-hover:bg-[#B48B40]/20 transition-colors">
                    <Zap className="w-4 h-4 text-[#B48B40]" strokeWidth={2} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-white/85">Generate with AI</p>
                    <p className="text-[11px] text-white/40">From your intake answers</p>
                  </div>
                </Link>
                <Link
                  href="/program/builder"
                  className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 hover:border-white/15 hover:bg-white/[0.04] transition-all group"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0 group-hover:bg-white/[0.06] transition-colors">
                    <Plus className="w-4 h-4 text-white/55" strokeWidth={2} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-white/85">Build manually</p>
                    <p className="text-[11px] text-white/40">Drag-and-drop builder</p>
                  </div>
                </Link>
                <Link
                  href="/program/library"
                  className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 hover:border-white/15 hover:bg-white/[0.04] transition-all group"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0 group-hover:bg-white/[0.06] transition-colors">
                    <Library className="w-4 h-4 text-white/55" strokeWidth={2} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-white/85">My library</p>
                    <p className="text-[11px] text-white/40">Saved programs &amp; templates</p>
                  </div>
                </Link>
                <Link
                  href="/program/workout/freestyle"
                  className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 hover:border-white/15 hover:bg-white/[0.04] transition-all group"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0 group-hover:bg-white/[0.06] transition-colors">
                    <Mic className="w-4 h-4 text-white/55" strokeWidth={2} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-white/85">Freestyle</p>
                    <p className="text-[11px] text-white/40">Voice-logged session</p>
                  </div>
                </Link>
              </div>
            </div>
          </Card>
        </div>
      </div>

    </div>
  );
}
