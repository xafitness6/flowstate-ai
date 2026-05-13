"use client";

// Big, plain-English "what do I need to do today" card for clients/members.
// Designed for a non-tech-savvy user — three sections, large readable text,
// clear CTAs. Pulls from real Supabase data with localStorage fallbacks so
// it doesn't go blank for brand-new accounts.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dumbbell, Utensils, CheckSquare, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  loadActiveProgramForUser,
  type ActiveProgram,
  type Workout,
} from "@/lib/workout";
import { loadIntakeAsync, loadIntake, type IntakeData } from "@/lib/data/intake";
import { calculateNutritionTargets } from "@/lib/nutrition";
import { getMealsForDate, localDateISO } from "@/lib/nutrition/store";
import type { LoggedMeal } from "@/lib/nutrition/types";
import { loadStarterPlan } from "@/lib/starterPlan";

const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

type SnapshotState = {
  workoutLabel:    string;
  workoutDetail:   string | null;
  workoutId:       string | null;
  workoutIsRest:   boolean;
  caloriesActual:  number;
  caloriesTarget:  number;
  proteinActual:   number;
  proteinTarget:   number;
  mealsLogged:     number;
  habitsTotal:     number;
  habitsCompleted: number;
};

function pickTodayFromProgram(program: ActiveProgram | null): { workout: Workout | null; isRest: boolean } {
  if (!program || program.workouts.length === 0) return { workout: null, isRest: false };
  const todayIdx = new Date().getDay();
  const wo = program.workouts.find((w) => w.scheduledDay === todayIdx);
  if (wo) return { workout: wo, isRest: false };
  // Day is in the program but not scheduled → genuine rest day
  return { workout: null, isRest: true };
}

function pickTodayFromStarterPlan(userId: string): { label: string; detail: string | null } | null {
  const plan = loadStarterPlan(userId);
  if (!plan) return null;
  const abbr = DAY_ABBR[new Date().getDay()];
  const session = plan.sessions.find((s) => s.day === abbr);
  if (!session) return null;
  return { label: session.name, detail: session.duration };
}

function loadHabitsToday(): { total: number; completed: number } {
  if (typeof window === "undefined") return { total: 0, completed: 0 };
  try {
    const rawHabits = localStorage.getItem("accountability-habits-v2");
    const rawLogs   = localStorage.getItem("accountability-logs");
    if (!rawHabits) return { total: 0, completed: 0 };
    const habits = JSON.parse(rawHabits) as Array<{ id: string; visible?: boolean }>;
    const visibleIds = habits.filter((h) => h.visible !== false).map((h) => h.id);
    const total = visibleIds.length;
    if (total === 0 || !rawLogs) return { total, completed: 0 };
    const logs = JSON.parse(rawLogs) as Record<string, { completedHabits?: string[] }>;
    const todayKey = localDateISO();
    const todayLog = logs[todayKey];
    const completed = (todayLog?.completedHabits ?? []).filter((id) => visibleIds.includes(id)).length;
    return { total, completed };
  } catch {
    return { total: 0, completed: 0 };
  }
}

export function TodaySnapshot({ userId }: { userId: string }) {
  const router = useRouter();
  const [state, setState] = useState<SnapshotState | null>(null);

  useEffect(() => {
    let active = true;

    (async () => {
      // Workout
      let workoutLabel  = "Rest day";
      let workoutDetail: string | null = null;
      let workoutId:     string | null = null;
      let workoutIsRest  = false;

      try {
        const program = await loadActiveProgramForUser(userId);
        const today = pickTodayFromProgram(program);
        if (today.workout) {
          workoutLabel  = today.workout.name || today.workout.focus || "Today's workout";
          workoutDetail = today.workout.exercises.length > 0
            ? `${today.workout.exercises.length} exercises · ~${today.workout.estimatedDuration} min`
            : null;
          workoutId = today.workout.workoutId;
        } else if (today.isRest && program) {
          workoutLabel = "Rest day";
          workoutDetail = "Recover and prep for the next session.";
          workoutIsRest = true;
        } else {
          // No Supabase program — try the starter plan as a soft fallback
          const starter = pickTodayFromStarterPlan(userId);
          if (starter) {
            workoutLabel  = starter.label;
            workoutDetail = starter.detail;
          } else {
            workoutLabel  = "No workout planned";
            workoutDetail = "Generate a program to get started.";
          }
        }
      } catch { /* fall through */ }

      // Nutrition
      let caloriesActual = 0;
      let proteinActual  = 0;
      let mealsLogged    = 0;

      let intake: IntakeData | null = null;
      try { intake = await loadIntakeAsync(userId); } catch { /* ignore */ }
      if (!intake) intake = loadIntake(userId);

      const targets = intake
        ? calculateNutritionTargets(intake)
        : { calories: 2200, proteinG: 150, carbsG: 230, fatG: 70, waterMl: 3000 };

      try {
        const meals: LoggedMeal[] = await getMealsForDate(userId, localDateISO());
        mealsLogged = meals.length;
        meals.forEach((m) => {
          caloriesActual += m.totals?.calories ?? 0;
          proteinActual  += m.totals?.protein ?? 0;
        });
      } catch { /* ignore */ }

      // Habits
      const habits = loadHabitsToday();

      if (!active) return;
      setState({
        workoutLabel,
        workoutDetail,
        workoutId,
        workoutIsRest,
        caloriesActual: Math.round(caloriesActual),
        caloriesTarget: targets.calories,
        proteinActual:  Math.round(proteinActual),
        proteinTarget:  targets.proteinG,
        mealsLogged,
        habitsTotal:    habits.total,
        habitsCompleted: habits.completed,
      });
    })();

    return () => { active = false; };
  }, [userId]);

  if (!state) {
    return (
      <div className="rounded-3xl border border-white/[0.07] bg-[#0F0F0F] px-6 py-10 mb-8 flex items-center justify-center min-h-[200px]">
        <div className="w-5 h-5 rounded-full border-2 border-[#B48B40]/30 border-t-[#B48B40] animate-spin" />
      </div>
    );
  }

  const calPct = state.caloriesTarget > 0
    ? Math.min(100, Math.round((state.caloriesActual / state.caloriesTarget) * 100))
    : 0;

  return (
    <div className="rounded-3xl border border-white/[0.08] bg-gradient-to-br from-[#121212] to-[#0A0A0A] px-6 py-6 mb-8 space-y-6">

      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-[#B48B40]/70 mb-1">Today</p>
          <h2 className="text-2xl font-semibold tracking-tight text-white">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</h2>
        </div>
      </div>

      {/* Workout */}
      <button
        onClick={() => {
          if (state.workoutId) router.push(`/program/workout/${state.workoutId}`);
          else router.push("/program");
        }}
        className="w-full text-left rounded-2xl border border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/12 transition-all px-5 py-4 flex items-center justify-between gap-4 group"
      >
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-[#B48B40]/12 border border-[#B48B40]/25 flex items-center justify-center shrink-0">
            <Dumbbell className="w-5 h-5 text-[#B48B40]" strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/30 mb-0.5">Your workout</p>
            <p className="text-base font-semibold text-white/90 truncate">{state.workoutLabel}</p>
            {state.workoutDetail && (
              <p className="text-xs text-white/40 truncate">{state.workoutDetail}</p>
            )}
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2 text-xs font-medium text-[#B48B40]/80 group-hover:text-[#B48B40] transition-colors">
          {state.workoutIsRest ? "Open" : state.workoutId ? "Start" : "Plan it"}
          <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
        </div>
      </button>

      {/* Nutrition */}
      <button
        onClick={() => router.push("/nutrition")}
        className="w-full text-left rounded-2xl border border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/12 transition-all px-5 py-4 group"
      >
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-emerald-400/10 border border-emerald-400/22 flex items-center justify-center shrink-0">
              <Utensils className="w-5 h-5 text-emerald-400/80" strokeWidth={1.8} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/30 mb-0.5">Your meals</p>
              <p className="text-base font-semibold text-white/90">
                {state.caloriesActual.toLocaleString()} <span className="text-white/35 font-normal">of {state.caloriesTarget.toLocaleString()} cal</span>
              </p>
              <p className="text-xs text-white/40">
                {state.mealsLogged > 0
                  ? `${state.mealsLogged} meal${state.mealsLogged !== 1 ? "s" : ""} logged · ${state.proteinActual}g / ${state.proteinTarget}g protein`
                  : `Nothing logged yet — target ${state.proteinTarget}g protein`}
              </p>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-2 text-xs font-medium text-emerald-400/80 group-hover:text-emerald-400 transition-colors">
            Log a meal
            <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
          </div>
        </div>
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              calPct >= 100 ? "bg-emerald-400" : calPct >= 60 ? "bg-[#B48B40]" : "bg-emerald-400/60",
            )}
            style={{ width: `${calPct}%` }}
          />
        </div>
      </button>

      {/* Habits */}
      <button
        onClick={() => router.push("/accountability")}
        className="w-full text-left rounded-2xl border border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/12 transition-all px-5 py-4 flex items-center justify-between gap-4 group"
      >
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-[#93C5FD]/12 border border-[#93C5FD]/22 flex items-center justify-center shrink-0">
            <CheckSquare className="w-5 h-5 text-[#93C5FD]/80" strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/30 mb-0.5">Your habits</p>
            <p className="text-base font-semibold text-white/90">
              {state.habitsCompleted} of {state.habitsTotal}
              <span className="text-white/35 font-normal"> done today</span>
            </p>
            <p className="text-xs text-white/40">
              {state.habitsTotal === 0
                ? "Set up your habits in Accountability"
                : state.habitsCompleted === state.habitsTotal && state.habitsTotal > 0
                ? "Perfect day — every habit checked"
                : "Tap to check off what you've done"}
            </p>
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2 text-xs font-medium text-[#93C5FD]/80 group-hover:text-[#93C5FD] transition-colors">
          Open
          <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
        </div>
      </button>

    </div>
  );
}
