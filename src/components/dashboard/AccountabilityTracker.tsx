"use client";

import { useState, useEffect } from "react";
import { Check, Flame, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import Link from "next/link";

// ─── Types (mirror accountability page) ──────────────────────────────────────

type HabitCategory = "body" | "mind" | "business" | "lifestyle";

type Habit = {
  id: string;
  label: string;
  category: HabitCategory;
  visible: boolean;
  weight: 1 | 2 | 3;
  hint?: string;
};

type DailyLog = {
  completedHabits: string[];
  identityState: string | null;
  energyNote: string;
  journalEntry: string;
  journalSaved: boolean;
  caloriesLogged?: number;
};

type Logs = Record<string, DailyLog>;

// ─── Defaults (must match accountability page) ────────────────────────────────

const DEFAULT_HABITS: Habit[] = [
  { id: "training",   label: "Training",        category: "body",      visible: true,  weight: 3, hint: "session" },
  { id: "steps",      label: "10k steps",       category: "body",      visible: true,  weight: 2, hint: "walk" },
  { id: "sleep",      label: "8h sleep",        category: "body",      visible: true,  weight: 3, hint: "priority" },
  { id: "water",      label: "Water",           category: "body",      visible: true,  weight: 1, hint: "3L" },
  { id: "deep-work",  label: "Deep work",       category: "mind",      visible: true,  weight: 3, hint: "4h block" },
  { id: "reading",    label: "Reading",         category: "mind",      visible: true,  weight: 2, hint: "30 min" },
  { id: "meditation", label: "Meditation",      category: "mind",      visible: false, weight: 1, hint: "10 min" },
  { id: "journaling", label: "Journaling",      category: "mind",      visible: false, weight: 1, hint: "reflect" },
  { id: "rev-calls",  label: "Revenue calls",   category: "business",  visible: true,  weight: 3, hint: "3+ calls" },
  { id: "content",    label: "Content",         category: "business",  visible: true,  weight: 2, hint: "publish" },
  { id: "metrics",    label: "Review metrics",  category: "business",  visible: true,  weight: 1, hint: "daily" },
  { id: "no-alcohol", label: "No alcohol",      category: "lifestyle", visible: true,  weight: 2, hint: "clean" },
  { id: "sunlight",   label: "Morning sun",     category: "lifestyle", visible: true,  weight: 1, hint: "10 min" },
  { id: "cold",       label: "Cold exposure",   category: "lifestyle", visible: false, weight: 1, hint: "plunge" },
];

const BLANK_LOG: DailyLog = {
  completedHabits: [],
  identityState: null,
  energyNote: "",
  journalEntry: "",
  journalSaved: false,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function pastKey(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function computeScore(habits: Habit[], completedIds: string[]): number {
  const visible = habits.filter((h) => h.visible);
  const max = visible.reduce((s, h) => s + h.weight, 0);
  if (!max) return 0;
  const earned = visible.filter((h) => completedIds.includes(h.id)).reduce((s, h) => s + h.weight, 0);
  return Math.round((earned / max) * 100);
}
type DailyActivity = {
  date: string;
  workouts: number;
  steps: number;
  calories: number;
  checkins: number;
  score: number; // 0-100
};

type ActivityData = Record<string, DailyActivity>;

function computeDailyActivity(log: DailyLog, date: string): DailyActivity {
  const workouts = log.completedHabits.includes("training") ? 1 : 0;
  const steps = log.completedHabits.includes("steps") ? 1 : 0;
  const checkins = log.completedHabits.includes("journaling") || !!log.identityState ? 1 : 0;
  const calories = log.caloriesLogged ?? 0;

  const rawScore =
    workouts * 35 +
    steps * 20 +
    checkins * 20 +
    Math.min(1, calories / 500) * 25;

  return {
    date,
    workouts,
    steps,
    calories,
    checkins,
    score: Math.min(100, Math.round(rawScore)),
  };
}

function scoreToLevel(score: number): string {
  if (score === 0) return "bg-white/10 border-white/10";
  if (score <= 20) return "bg-[#134e4a]";
  if (score <= 40) return "bg-[#0f766e]";
  if (score <= 60) return "bg-[#0d9488]";
  if (score <= 80) return "bg-[#14b8a6]";
  return "bg-[#2dd4bf]";
}
function topStreak(logs: Logs): number {
  let count = 0;
  for (let i = 0; i < 90; i++) {
    const c = logs[pastKey(i)]?.completedHabits ?? [];
    if (c.includes("training")) count++;
    else break;
  }
  return count;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AccountabilityTracker({ compact = false }: { compact?: boolean }) {
  const [habits, setHabits] = useLocalStorage<Habit[]>("accountability-habits-v2", DEFAULT_HABITS);
  const [logs, setLogs]     = useLocalStorage<Logs  >("accountability-logs",       {});
  const [activityData, setActivityData] = useLocalStorage<ActivityData>("accountability-activity", {});

  const today = todayKey();
  const todayLog: DailyLog = logs[today] ?? BLANK_LOG;
  const score = computeScore(habits, todayLog.completedHabits);
  const streak = topStreak(logs);

  useEffect(() => {
    const updated: ActivityData = { ...activityData };
    Object.entries(logs).forEach(([date, log]) => {
      const item = computeDailyActivity(log, date);
      updated[date] = item;
    });
    setActivityData(updated);
  }, [logs]);

  // Pick top 4 visible habits to surface in the digest
  const preview = habits.filter((h) => h.visible).slice(0, compact ? 3 : 4);
  const completed = todayLog.completedHabits;

  function toggleHabit(id: string) {
    setLogs((prev) => {
      const current = prev[today] ?? BLANK_LOG;
      const next = current.completedHabits.includes(id)
        ? current.completedHabits.filter((x) => x !== id)
        : [...current.completedHabits, id];
      return { ...prev, [today]: { ...current, completedHabits: next } };
    });
  }

  const keyHabits   = habits.filter((h) => h.visible && h.weight === 3);
  const keyDone     = keyHabits.length > 0 && keyHabits.every((h) => completed.includes(h.id));
  const keyRemain   = keyHabits.filter((h) => !completed.includes(h.id)).length;

  const scoreColor =
    score >= 75 ? "text-[#B48B40]" :
    score >= 50 ? "text-white/60" :
    "text-white/30";

  const HEATMAP_DAYS = 365;
  const dayKeys = Array.from({ length: HEATMAP_DAYS }, (_, i) => pastKey(HEATMAP_DAYS - 1 - i));
  const columns: string[][] = [];
  dayKeys.forEach((date, i) => {
    const col = Math.floor(i / 7);
    if (!columns[col]) columns[col] = [];
    columns[col].push(date);
  });

  const getDayActivity = (date: string): DailyActivity =>
    activityData[date] ?? { date, workouts: 0, steps: 0, calories: 0, checkins: 0, score: 0 };

  return (
    <div className="rounded-2xl border border-white/6 bg-[#111111] overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-white/[0.05]">
        <div>
          <p className="text-sm font-semibold text-white/80">Accountability</p>
          <p className="text-[10px] text-white/22 mt-0.5">
            {streak > 0 ? `Training streak: ${streak}d` : "Start your streak today"}
          </p>
        </div>
        <div className="text-right">
          <div className="flex items-baseline gap-0.5">
            <span className={cn("text-xl font-semibold tabular-nums", scoreColor)}>{score}</span>
            <span className="text-xs text-white/20">/100</span>
          </div>
        </div>
      </div>

      {/* Score bar */}
      <div className="h-0.5 bg-white/5">
        <div
          className={cn(
            "h-full transition-all duration-500",
            score >= 75 ? "bg-[#B48B40]" : score >= 50 ? "bg-white/25" : "bg-white/10"
          )}
          style={{ width: `${score}%` }}
        />
      </div>

      {/* Habit preview */}
      <div className="px-4 py-3 space-y-1.5">
        {preview.map((h) => {
          const done = completed.includes(h.id);
          return (
            <button
              key={h.id}
              onClick={() => toggleHabit(h.id)}
              className="w-full flex items-center gap-2.5 group py-0.5"
            >
              <span className={cn(
                "w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-all duration-150",
                done
                  ? "border-transparent bg-[#B48B40] text-black"
                  : "border-white/12 group-hover:border-white/25"
              )}>
                {done && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
              </span>
              <span className={cn(
                "text-sm transition-colors",
                done ? "text-white/25 line-through" : "text-white/60 group-hover:text-white/80"
              )}>
                {h.label}
              </span>
              {h.hint && (
                <span className="text-[10px] text-white/18 ml-auto">{h.hint}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Key task status bar */}
      {keyHabits.length > 0 && (
        <Link href="/accountability" className="block mx-4 mb-3">
          <div className={cn(
            "rounded-xl px-3 py-2 text-center text-[11px] font-medium transition-all",
            keyDone
              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
              : "bg-[#EF4444]/10 text-[#F87171]/80 border border-[#EF4444]/15"
          )}>
            {keyDone ? "Day locked in" : `${keyRemain} key task${keyRemain !== 1 ? "s" : ""} remaining`}
          </div>
        </Link>
      )}

      {/* Accountability heatmap */}
      <div className="px-4 pb-4">
        <p className="text-xs font-semibold text-white/60 uppercase tracking-[0.15em] mb-2">Consistency heatmap</p>
        <div className="grid grid-cols-[repeat(53,minmax(0,1fr))] gap-[2px] h-[180px] overflow-x-auto">
          {columns.map((week, wi) => (
            <div key={wi} className="grid grid-rows-7 gap-[2px]">
              {week.map((date) => {
                const activity = getDayActivity(date);
                const level = scoreToLevel(activity.score);
                const title = `${date} • score ${activity.score}\nWorkouts: ${activity.workouts} · Steps: ${activity.steps} · Calories: ${activity.calories} · Check-ins: ${activity.checkins}`;
                return (
                  <button
                    key={date}
                    title={title}
                    className={cn("w-4 h-4 rounded-sm border border-white/10", level)}
                  />
                );
              })}
            </div>
          ))}
        </div>
        <div className="mt-2 text-[10px] text-white/40">
          <span className="inline-block px-1">Less</span>
          <span className="inline-block h-2 w-2 bg-[#134e4a] mx-1" />
          <span className="inline-block h-2 w-2 bg-[#0f766e] mx-1" />
          <span className="inline-block h-2 w-2 bg-[#0d9488] mx-1" />
          <span className="inline-block h-2 w-2 bg-[#14b8a6] mx-1" />
          <span className="inline-block h-2 w-2 bg-[#2dd4bf] mx-1" />
          <span className="inline-block px-1">More</span>
        </div>
      </div>

      {/* Footer link */}
      <div className="px-4 pb-4">
        <Link
          href="/accountability"
          className="flex items-center gap-1.5 text-[11px] text-white/25 hover:text-white/50 transition-colors"
        >
          <Flame className="w-3 h-3" strokeWidth={1.5} />
          <span>Full tracker</span>
          <ArrowRight className="w-3 h-3 ml-auto" strokeWidth={1.5} />
        </Link>
      </div>
    </div>
  );
}
