"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useEntitlement }               from "@/hooks/useEntitlement";
import { LockedSection, FEATURES }      from "@/components/ui/PlanGate";
import { ArrowLeft, TrendingUp, Dumbbell, BarChart2, Calendar, Flame, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/context/UserContext";
import { Card } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatTile";
import { SectionHeader } from "@/components/ui/SectionHeader";
import {
  getWorkoutLogs, getLogsThisWeek, loadActiveProgram,
  type WorkoutLog,
} from "@/lib/workout";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dateLabel(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function volumeForLog(log: WorkoutLog): number {
  return log.exercises.reduce((sum, ex) => {
    return sum + ex.setLogs.reduce((s2, set) => {
      if (!set.completed) return s2;
      const reps = parseInt(set.completedReps) || 0;
      const load = parseFloat(set.completedLoad) || 0;
      return s2 + reps * load;
    }, 0);
  }, 0);
}

function bodyPartLoad(logs: WorkoutLog[]): Record<string, number> {
  const map: Record<string, number> = {};
  logs.forEach((log) => {
    // Approximate body part from workout name
    const focus = log.workoutName.toLowerCase();
    const key =
      focus.includes("push")  || focus.includes("chest") ? "Push / Chest" :
      focus.includes("pull")  || focus.includes("back")  ? "Pull / Back"  :
      focus.includes("leg")   || focus.includes("lower") ? "Legs"          :
      focus.includes("upper")                            ? "Upper"          :
      "Full Body";
    const vol = volumeForLog(log);
    map[key] = (map[key] ?? 0) + vol;
  });
  return map;
}

// ─── Mini bar chart ───────────────────────────────────────────────────────────

function MiniBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.max((value / max) * 100, 3) : 0;
  return (
    <div className="flex items-end gap-1 flex-col w-full">
      <div className="w-full h-12 bg-white/[0.03] rounded-lg overflow-hidden flex items-end">
        <div
          className="w-full bg-[#B48B40]/40 rounded-t-sm transition-all duration-500"
          style={{ height: `${pct}%` }}
        />
      </div>
      <span className="text-[9px] text-white/25 truncate w-full text-center">{label}</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const router   = useRouter();
  const { user } = useUser();
  const { can }  = useEntitlement();

  const [logs,     setLogs]     = useState<WorkoutLog[]>([]);
  const [weekLogs, setWeekLogs] = useState<WorkoutLog[]>([]);
  const [program,  setProgram]  = useState<Awaited<ReturnType<typeof loadActiveProgram>>>(null);
  const [loaded,   setLoaded]   = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    const allLogs = getWorkoutLogs(user.id).sort((a, b) => b.completedAt - a.completedAt);
    setLogs(allLogs);
    setWeekLogs(getLogsThisWeek(user.id));
    setProgram(loadActiveProgram(user.id));
    setLoaded(true);
  }, [user?.id]);

  if (!loaded) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border-2 border-[#B48B40]/30 border-t-[#B48B40] animate-spin" />
      </div>
    );
  }

  const totalSets    = logs.reduce((s, l) => s + l.setsCompleted, 0);
  const totalMins    = logs.reduce((s, l) => s + l.durationMins, 0);
  const totalVol     = logs.reduce((s, l) => s + volumeForLog(l), 0);
  const avgDuration  = logs.length ? Math.round(totalMins / logs.length) : 0;
  const bpLoad       = bodyPartLoad(logs);
  const maxBpLoad    = Math.max(...Object.values(bpLoad), 1);

  // Last 8 sessions for volume chart
  const chartLogs  = [...logs].reverse().slice(-8);
  const chartVols  = chartLogs.map(volumeForLog);
  const maxVol     = Math.max(...chartVols, 1);

  const hasData = logs.length > 0;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white pb-24">

      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#0A0A0A]/95 backdrop-blur-sm border-b border-white/[0.05] px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="w-8 h-8 rounded-xl border border-white/[0.08] flex items-center justify-center"
        >
          <ArrowLeft className="w-4 h-4 text-white/50" strokeWidth={2} />
        </button>
        <h1 className="text-sm font-bold text-white/80">Analytics</h1>
      </div>

      <div className="px-4 pt-5 space-y-4">

        {/* Stat grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Total sessions", value: logs.length,     icon: <Dumbbell className="w-4 h-4" /> },
            { label: "This week",      value: `${weekLogs.length}/${program?.daysPerWeek ?? "—"}`, icon: <Calendar className="w-4 h-4" /> },
            { label: "Total sets",     value: totalSets,        icon: <Flame className="w-4 h-4" /> },
            { label: "Avg duration",   value: `${avgDuration}m`, icon: <Clock className="w-4 h-4" /> },
          ].map(({ label, value, icon }) => (
            <Card key={label} className="px-4 py-4 space-y-2 bg-white/[0.02] border-white/[0.07]">
              <div className="text-white/25">{icon}</div>
              <StatTile value={value} label={label} valueClassName="text-xl text-white/85" />
            </Card>
          ))}
        </div>

        {/* Volume trend */}
        <Card className="px-5 py-4 bg-white/[0.02] border-white/[0.07]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#B48B40]" strokeWidth={1.5} />
              <p className="text-sm font-semibold text-white/70">Volume trend</p>
            </div>
            <p className="text-[11px] text-white/28">Last 8 sessions</p>
          </div>

          {hasData ? (
            <div className="flex items-end gap-1 h-20">
              {chartLogs.map((log, i) => (
                <MiniBar
                  key={log.logId}
                  value={chartVols[i]}
                  max={maxVol}
                  label={dateLabel(log.completedAt).split(" ")[0]}
                />
              ))}
              {chartLogs.length < 8 && Array.from({ length: 8 - chartLogs.length }, (_, i) => (
                <div key={`empty_${i}`} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full h-12 bg-white/[0.02] rounded-lg" />
                  <span className="text-[9px] text-white/10">—</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-20 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-center">
              <p className="text-xs text-white/25">Complete workouts to see trends</p>
            </div>
          )}

          {hasData && (
            <p className="text-[11px] text-white/28 mt-3">
              Total volume: {totalVol.toLocaleString()} kg lifted
            </p>
          )}
        </Card>

        {/* Body-part load distribution — Pro feature */}
        {!can(FEATURES.DEEP_ANALYTICS) ? (
          <LockedSection
            feature={FEATURES.DEEP_ANALYTICS}
            title="Load Distribution"
            description="See which muscle groups you're training most. Available on Pro."
          />
        ) : (
        <Card className="px-5 py-4 bg-white/[0.02] border-white/[0.07]">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="w-4 h-4 text-[#B48B40]" strokeWidth={1.5} />
            <p className="text-sm font-semibold text-white/70">Load distribution</p>
          </div>

          {Object.keys(bpLoad).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(bpLoad)
                .sort(([, a], [, b]) => b - a)
                .map(([label, vol]) => (
                  <div key={label} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/55">{label}</span>
                      <span className="text-xs text-white/30">{vol.toLocaleString()} kg</span>
                    </div>
                    <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#B48B40]/50 rounded-full transition-all duration-500"
                        style={{ width: `${(vol / maxBpLoad) * 100}%` }}
                      />
                    </div>
                  </div>
                ))
              }
            </div>
          ) : (
            <p className="text-xs text-white/28 py-4 text-center">Log workouts to see distribution</p>
          )}
        </Card>
        )} {/* end deep analytics gate */}

        {/* Adherence — Pro feature */}
        {program && can(FEATURES.DEEP_ANALYTICS) && (
          <Card className="px-5 py-4 bg-white/[0.02] border-white/[0.07]">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-4 h-4 text-[#B48B40]" strokeWidth={1.5} />
              <p className="text-sm font-semibold text-white/70">Adherence</p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/45">Week {program.currentWeek} of {program.durationWeeks}</span>
                <span className="text-xs font-semibold text-[#B48B40]">
                  {weekLogs.length}/{program.daysPerWeek} sessions
                </span>
              </div>
              <div className="h-2 bg-white/[0.05] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#B48B40]/60 rounded-full transition-all"
                  style={{ width: `${Math.min((weekLogs.length / program.daysPerWeek) * 100, 100)}%` }}
                />
              </div>
              <p className="text-[11px] text-white/28">
                {weekLogs.length >= program.daysPerWeek
                  ? "Week complete — great work."
                  : `${program.daysPerWeek - weekLogs.length} session${program.daysPerWeek - weekLogs.length !== 1 ? "s" : ""} remaining this week`
                }
              </p>
            </div>
          </Card>
        )}

        {/* Recent sessions */}
        {logs.length > 0 && (
          <Card className="px-5 py-4 bg-white/[0.02] border-white/[0.07]">
            <SectionHeader className="mb-3">Session history</SectionHeader>
            <div className="space-y-0">
              {logs.slice(0, 10).map((log, i) => (
                <div
                  key={log.logId}
                  className={cn(
                    "flex items-center gap-3 py-3",
                    i < logs.slice(0, 10).length - 1 && "border-b border-white/[0.04]"
                  )}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-[#B48B40]/50 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/70 font-medium truncate">{log.workoutName}</p>
                    <p className="text-[11px] text-white/30">
                      {log.setsCompleted} sets · {log.durationMins} min
                    </p>
                  </div>
                  <span className="text-[11px] text-white/22 shrink-0">{dateLabel(log.completedAt)}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {!hasData && (
          <Card className="px-5 py-10 text-center space-y-2 bg-white/[0.01] border-white/[0.05]">
            <BarChart2 className="w-8 h-8 text-white/15 mx-auto" strokeWidth={1} />
            <p className="text-sm text-white/30">Analytics build as you train.</p>
            <p className="text-xs text-white/20">Start your first workout to see data here.</p>
          </Card>
        )}

      </div>
    </div>
  );
}
