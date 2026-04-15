"use client";

import { useState, useRef } from "react";
import { useEntitlement }               from "@/hooks/useEntitlement";
import { LockedPageState, FEATURES }    from "@/components/ui/PlanGate";
import {
  ChevronLeft, ChevronRight, Dumbbell, Utensils, CheckCircle2,
  X, TrendingUp, TrendingDown, Minus, Check, AlertTriangle,
  ArrowRight, MessageSquare, Pencil, Plus, Droplets, Moon,
  Zap, Footprints, Flame,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type EventType = "workout" | "nutrition" | "rest";
type CalEvent  = { type: EventType; label: string };
type EventMap  = Record<string, CalEvent[]>;

type IdentityState = "locked" | "focused" | "tired" | "off" | null;
type Trend         = "improving" | "stable" | "declining";

type CategoryScore = { score: number; note?: string };

type DaySynopsis = {
  date:  string;
  score: number;
  won:   boolean | null; // null = in progress
  trend: Trend;

  categories: {
    body:      CategoryScore;
    mind:      CategoryScore;
    nutrition: CategoryScore;
    business:  CategoryScore;
    lifestyle: CategoryScore;
  };

  performance: {
    steps:     { actual: number; target: number };
    workout:   { completed: boolean; name: string; rpe?: number } | null;
    calories:  { actual: number; target: number };
    protein:   { actual: number; target: number };
    hydration: { actual: number; target: number };
    sleep:     { hours: number; target: number } | null;
  };

  accountability: {
    completed:    string[];
    missed:       string[];
    recoveryNote?: string;
  };

  identity: {
    state: IdentityState;
    note?: string;
  };

  journal: string | null;

  insight: {
    right: string;
    wrong: string;
    fix:   string;
  };

  timeline: Array<{
    time:  string;
    label: string;
    type:  "workout" | "nutrition" | "habit" | "note";
  }>;
};

// ─── Date helpers ─────────────────────────────────────────────────────────────

const today    = new Date();
const todayStr = today.toISOString().slice(0, 10);

function dateStr(offset: number): string {
  const d = new Date(today);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

// ─── Calendar events ──────────────────────────────────────────────────────────

const EVENTS: EventMap = {
  [dateStr(-6)]: [{ type: "workout", label: "Upper · Pull"  }, { type: "nutrition", label: "2,050 kcal" }],
  [dateStr(-5)]: [{ type: "nutrition", label: "2,100 kcal"  }],
  [dateStr(-4)]: [{ type: "workout", label: "Lower · Squat" }],
  [dateStr(-3)]: [{ type: "rest",    label: "Rest day"      }],
  [dateStr(-2)]: [{ type: "workout", label: "Upper · Push"  }, { type: "nutrition", label: "2,200 kcal" }],
  [dateStr(-1)]: [{ type: "workout", label: "Lower · Hinge" }],
  [todayStr]:    [{ type: "workout", label: "Upper · Pull"  }, { type: "nutrition", label: "2,050 kcal" }],
  [dateStr(1)]:  [{ type: "rest",    label: "Rest day"      }],
  [dateStr(2)]:  [{ type: "workout", label: "Full Body"     }],
  [dateStr(3)]:  [{ type: "workout", label: "Lower · Squat" }],
  [dateStr(5)]:  [{ type: "workout", label: "Upper · Push"  }],
  [dateStr(6)]:  [{ type: "rest",    label: "Deload"        }],
};

const EVENT_STYLE: Record<EventType, { dot: string; text: string; bg: string }> = {
  workout:   { dot: "bg-[#B48B40]",   text: "text-[#B48B40]",   bg: "bg-[#B48B40]/10"  },
  nutrition: { dot: "bg-emerald-400", text: "text-emerald-400", bg: "bg-emerald-400/8" },
  rest:      { dot: "bg-white/25",    text: "text-white/35",    bg: "bg-white/5"        },
};

const EVENT_ICON: Record<EventType, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  workout:   Dumbbell,
  nutrition: Utensils,
  rest:      CheckCircle2,
};

// ─── Day synopsis data ────────────────────────────────────────────────────────

const DAY_SYNOPSES: Record<string, DaySynopsis> = {
  [dateStr(-6)]: {
    date: dateStr(-6), score: 82, won: true, trend: "stable",
    categories: {
      body:      { score: 90 },
      mind:      { score: 75, note: "Deep work block ran short by 30 min" },
      nutrition: { score: 85 },
      business:  { score: 70, note: "Content published but calls missed" },
      lifestyle: { score: 80 },
    },
    performance: {
      steps:     { actual: 9800,  target: 10000 },
      workout:   { completed: true,  name: "Upper · Pull",  rpe: 7 },
      calories:  { actual: 2050,  target: 2330  },
      protein:   { actual: 158,   target: 185   },
      hydration: { actual: 2800,  target: 3000  },
      sleep:     { hours: 7.5,    target: 8     },
    },
    accountability: {
      completed: ["Training", "8h sleep", "Deep work", "Content", "No alcohol"],
      missed:    ["10k steps", "Revenue calls"],
    },
    identity: { state: "focused", note: "Strong session. Back felt good." },
    journal: "Solid upper pull day. Nutrition was clean but dropped short on protein slightly. Deep work ran to 3.5h — not quite the target. Sleep was on point.",
    insight: {
      right: "Workout quality was high and execution was consistent across the day.",
      wrong: "Steps target missed — didn't account for a desk-heavy afternoon.",
      fix:   "Add a 15-minute walk after lunch to hit movement baseline on training days.",
    },
    timeline: [
      { time: "7:00",  label: "Wake + breakfast",        type: "nutrition" },
      { time: "11:30", label: "Pre-workout meal",        type: "nutrition" },
      { time: "12:00", label: "Upper · Pull (55 min)",   type: "workout"   },
      { time: "14:00", label: "Deep work block (3.5h)",  type: "habit"     },
      { time: "17:30", label: "Content published",       type: "habit"     },
      { time: "19:30", label: "Dinner",                  type: "nutrition" },
      { time: "22:30", label: "Sleep",                   type: "habit"     },
    ],
  },

  [dateStr(-5)]: {
    date: dateStr(-5), score: 55, won: false, trend: "declining",
    categories: {
      body:      { score: 45, note: "Rest day — low movement" },
      mind:      { score: 40, note: "Deep work skipped entirely" },
      nutrition: { score: 80 },
      business:  { score: 55, note: "Reactive work, no high-value output" },
      lifestyle: { score: 60 },
    },
    performance: {
      steps:     { actual: 4200,  target: 10000 },
      workout:   null,
      calories:  { actual: 2100,  target: 2330  },
      protein:   { actual: 142,   target: 185   },
      hydration: { actual: 1800,  target: 3000  },
      sleep:     { hours: 6.5,    target: 8     },
    },
    accountability: {
      completed:    ["No alcohol", "Morning sun"],
      missed:       ["Deep work", "Revenue calls", "Protein target", "10k steps", "8h sleep"],
      recoveryNote: "Rest day became a sedentary, low-output day. Active rest needs a defined structure.",
    },
    identity: { state: "tired", note: "Off day. Distracted and low energy throughout." },
    journal: "Rest day but didn't use it well. Sat too much, didn't get deep work done. Hydration was really bad. Need to be more intentional with rest days.",
    insight: {
      right: "Nutrition stayed relatively clean despite low energy — no junk food.",
      wrong: "Active rest became fully sedentary. Deep work and calls were completely skipped.",
      fix:   "Schedule a non-negotiable 2h deep work block as the first task even on rest days.",
    },
    timeline: [
      { time: "8:30",  label: "Wake (late)",              type: "note"      },
      { time: "9:30",  label: "Breakfast",                type: "nutrition" },
      { time: "13:00", label: "Lunch",                    type: "nutrition" },
      { time: "15:00", label: "Light walk (20 min)",      type: "habit"     },
      { time: "18:00", label: "Dinner",                   type: "nutrition" },
      { time: "22:30", label: "Sleep (late)",             type: "note"      },
    ],
  },

  [dateStr(-4)]: {
    date: dateStr(-4), score: 76, won: true, trend: "stable",
    categories: {
      body:      { score: 88 },
      mind:      { score: 70 },
      nutrition: { score: 65, note: "Calories 350 under — too low for training day" },
      business:  { score: 72 },
      lifestyle: { score: 75 },
    },
    performance: {
      steps:     { actual: 11200, target: 10000 },
      workout:   { completed: true,  name: "Lower · Squat", rpe: 8 },
      calories:  { actual: 1980,  target: 2330  },
      protein:   { actual: 162,   target: 185   },
      hydration: { actual: 2600,  target: 3000  },
      sleep:     { hours: 7.0,    target: 8     },
    },
    accountability: {
      completed: ["Training", "10k steps", "Deep work", "Revenue calls", "Morning sun"],
      missed:    ["8h sleep", "Calories on target"],
    },
    identity: { state: "focused", note: "Legs were heavy but pushed through." },
    journal: null,
    insight: {
      right: "Strong squat session and hit the steps target well above baseline.",
      wrong: "Calories ran 350 under target — significant gap on a heavy training day.",
      fix:   "Add a post-workout shake on leg days to close the calorie gap without overeating at dinner.",
    },
    timeline: [
      { time: "6:30",  label: "Wake + breakfast",         type: "nutrition" },
      { time: "9:00",  label: "Deep work (4h)",           type: "habit"     },
      { time: "13:00", label: "Pre-workout + lunch",      type: "nutrition" },
      { time: "15:30", label: "Lower · Squat (55 min)",   type: "workout"   },
      { time: "17:00", label: "Revenue calls",            type: "habit"     },
      { time: "19:00", label: "Dinner",                   type: "nutrition" },
      { time: "22:30", label: "Sleep",                    type: "habit"     },
    ],
  },

  [dateStr(-3)]: {
    date: dateStr(-3), score: 72, won: true, trend: "stable",
    categories: {
      body:      { score: 60, note: "Rest day — deliberate low movement" },
      mind:      { score: 80 },
      nutrition: { score: 75 },
      business:  { score: 80 },
      lifestyle: { score: 70, note: "Steps missed — no deliberate walk" },
    },
    performance: {
      steps:     { actual: 7500,  target: 10000 },
      workout:   null,
      calories:  { actual: 2050,  target: 2330  },
      protein:   { actual: 168,   target: 185   },
      hydration: { actual: 2400,  target: 3000  },
      sleep:     { hours: 8.5,    target: 8     },
    },
    accountability: {
      completed: ["8h sleep", "Deep work", "Reading", "Revenue calls", "Content", "No alcohol"],
      missed:    ["10k steps"],
    },
    identity: { state: "locked", note: "Clear head day. High output." },
    journal: "Good rest day. Deep work was the best session of the week — 4h fully uninterrupted. Revenue calls were productive. Feeling ahead of the week.",
    insight: {
      right: "Best deep work output of the week. Revenue calls were high quality.",
      wrong: "Movement target missed — rest days need a deliberate walk built in.",
      fix:   "Add a 20-minute post-lunch walk as a non-negotiable on all rest days.",
    },
    timeline: [
      { time: "7:00",  label: "Wake + breakfast",         type: "nutrition" },
      { time: "9:00",  label: "Deep work (4h)",           type: "habit"     },
      { time: "13:00", label: "Lunch",                    type: "nutrition" },
      { time: "14:00", label: "Revenue calls",            type: "habit"     },
      { time: "16:00", label: "Content",                  type: "habit"     },
      { time: "19:00", label: "Dinner",                   type: "nutrition" },
      { time: "21:00", label: "Reading (30 min)",         type: "habit"     },
      { time: "23:00", label: "Sleep",                    type: "habit"     },
    ],
  },

  [dateStr(-2)]: {
    date: dateStr(-2), score: 88, won: true, trend: "improving",
    categories: {
      body:      { score: 95 },
      mind:      { score: 85 },
      nutrition: { score: 88 },
      business:  { score: 82 },
      lifestyle: { score: 88 },
    },
    performance: {
      steps:     { actual: 13400, target: 10000 },
      workout:   { completed: true,  name: "Upper · Push", rpe: 7 },
      calories:  { actual: 2200,  target: 2330  },
      protein:   { actual: 178,   target: 185   },
      hydration: { actual: 3100,  target: 3000  },
      sleep:     { hours: 7.5,    target: 8     },
    },
    accountability: {
      completed: ["Training", "10k steps", "Deep work", "Revenue calls", "Content", "No alcohol", "Morning sun", "Water"],
      missed:    [],
    },
    identity: { state: "locked", note: "Everything clicked today." },
    journal: "Best day of the week by a distance. Training was smooth, nutrition was clean, deep work was locked in. This is the standard.",
    insight: {
      right: "Full execution across all categories — clean sweep, rare and worth noting.",
      wrong: "Calories slightly under target but within acceptable range.",
      fix:   "Add 100kcal to pre-workout on push days to hit the daily target more consistently.",
    },
    timeline: [
      { time: "6:45",  label: "Wake + breakfast",         type: "nutrition" },
      { time: "9:00",  label: "Deep work (4h)",           type: "habit"     },
      { time: "13:00", label: "Pre-workout meal",         type: "nutrition" },
      { time: "13:30", label: "Upper · Push (50 min)",    type: "workout"   },
      { time: "15:00", label: "Lunch",                    type: "nutrition" },
      { time: "16:00", label: "Revenue calls",            type: "habit"     },
      { time: "17:30", label: "Content published",        type: "habit"     },
      { time: "19:30", label: "Dinner",                   type: "nutrition" },
      { time: "22:30", label: "Sleep",                    type: "habit"     },
    ],
  },

  [dateStr(-1)]: {
    date: dateStr(-1), score: 65, won: false, trend: "declining",
    categories: {
      body:      { score: 80 },
      mind:      { score: 48, note: "Deep work skipped — fatigue from week" },
      nutrition: { score: 60, note: "Protein 50g under target" },
      business:  { score: 45, note: "No revenue calls, minimal output" },
      lifestyle: { score: 72 },
    },
    performance: {
      steps:     { actual: 8700,  target: 10000 },
      workout:   { completed: true,  name: "Lower · Hinge", rpe: 8 },
      calories:  { actual: 1850,  target: 2330  },
      protein:   { actual: 135,   target: 185   },
      hydration: { actual: 2000,  target: 3000  },
      sleep:     { hours: 6.8,    target: 8     },
    },
    accountability: {
      completed:    ["Training", "No alcohol", "Morning sun"],
      missed:       ["Deep work", "Revenue calls", "Protein target", "10k steps", "Calories on target", "8h sleep"],
      recoveryNote: "Week fatigue accumulated. Business and nutrition both fell apart in the afternoon.",
    },
    identity: { state: "tired", note: "Heavy legs from the week. Pushed through training but struggled with everything else." },
    journal: "Week caught up with me. Training happened but everything else slipped. Didn't hit deep work or calls. Need to reset tomorrow.",
    insight: {
      right: "Training was completed despite low energy — good discipline on the hard days.",
      wrong: "Business and nutrition both underperformed. Protein was 50g short — significant.",
      fix:   "Front-load protein early in the day. Revenue calls must happen before 2pm regardless of energy.",
    },
    timeline: [
      { time: "7:30",  label: "Wake (late)",              type: "note"      },
      { time: "9:00",  label: "Breakfast",                type: "nutrition" },
      { time: "11:30", label: "Lower · Hinge (55 min)",   type: "workout"   },
      { time: "13:30", label: "Lunch",                    type: "nutrition" },
      { time: "15:00", label: "Light desk work",          type: "note"      },
      { time: "19:00", label: "Dinner",                   type: "nutrition" },
      { time: "22:00", label: "Sleep",                    type: "habit"     },
    ],
  },

  [todayStr]: {
    date: todayStr, score: 54, won: null, trend: "stable",
    categories: {
      body:      { score: 70 },
      mind:      { score: 55, note: "Deep work in progress" },
      nutrition: { score: 50, note: "Protein gap still open — 90g remaining" },
      business:  { score: 48 },
      lifestyle: { score: 60 },
    },
    performance: {
      steps:     { actual: 6200,  target: 10000 },
      workout:   { completed: true,  name: "Upper · Pull", rpe: 7 },
      calories:  { actual: 1240,  target: 2330  },
      protein:   { actual: 95,    target: 185   },
      hydration: { actual: 1400,  target: 3000  },
      sleep:     { hours: 7.5,    target: 8     },
    },
    accountability: {
      completed: ["Training", "Morning sun"],
      missed:    [],
    },
    identity: { state: "focused", note: "In progress — day not closed." },
    journal: null,
    insight: {
      right: "Training completed early in the day — good execution.",
      wrong: "Nutrition is significantly behind — protein gap is 90g with dinner still ahead.",
      fix:   "Add a protein shake now. Ensure dinner hits at least 50g protein to close the gap.",
    },
    timeline: [
      { time: "7:00",  label: "Wake + breakfast",         type: "nutrition" },
      { time: "10:00", label: "Morning sun",              type: "habit"     },
      { time: "12:00", label: "Upper · Pull",             type: "workout"   },
      { time: "13:30", label: "Lunch (in progress)",      type: "nutrition" },
    ],
  },
};

// ─── Calendar helpers ─────────────────────────────────────────────────────────

function buildMonth(year: number, month: number) {
  const first  = new Date(year, month, 1).getDay();
  const days   = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(first).fill(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS   = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// ─── Score helpers ────────────────────────────────────────────────────────────

function scoreGrade(n: number) {
  if (n >= 90) return { label: "Elite",    color: "text-[#B48B40]"     };
  if (n >= 75) return { label: "Strong",   color: "text-emerald-400"   };
  if (n >= 60) return { label: "Solid",    color: "text-[#93C5FD]/80"  };
  if (n >= 40) return { label: "Moving",   color: "text-orange-400/80" };
  return               { label: "Get going", color: "text-white/35"    };
}

const CATEGORY_META = {
  body:      { label: "Body",      bar: "bg-[#B48B40]",   text: "text-[#B48B40]"   },
  mind:      { label: "Mind",      bar: "bg-[#93C5FD]",   text: "text-[#93C5FD]"   },
  nutrition: { label: "Nutrition", bar: "bg-teal-400",    text: "text-teal-400"    },
  business:  { label: "Business",  bar: "bg-emerald-400", text: "text-emerald-400" },
  lifestyle: { label: "Lifestyle", bar: "bg-violet-400",  text: "text-violet-400"  },
} as const;

const TIMELINE_ICON = {
  workout:   Dumbbell,
  nutrition: Utensils,
  habit:     CheckCircle2,
  note:      Zap,
} as const;

const IDENTITY_META: Record<NonNullable<IdentityState>, { label: string; color: string; border: string }> = {
  locked:  { label: "Locked in",       color: "text-[#B48B40]",    border: "border-[#B48B40]/30"  },
  focused: { label: "Focused",         color: "text-[#93C5FD]/80", border: "border-[#93C5FD]/20"  },
  tired:   { label: "Tired but moving",color: "text-orange-400/80",border: "border-orange-400/25" },
  off:     { label: "Off today",       color: "text-red-400/60",   border: "border-red-400/20"    },
};

// ─── Day synopsis modal ───────────────────────────────────────────────────────

function DaySynopsisModal({ dateKey, onClose }: { dateKey: string; onClose: () => void }) {
  const synopsis = DAY_SYNOPSES[dateKey] ?? null;
  const isFuture = dateKey > todayStr;
  const isToday  = dateKey === todayStr;

  const dateLabel = new Date(dateKey + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div
        className="relative w-full sm:max-w-2xl bg-[#0D0D0D] border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: "92dvh" }}
      >
        {/* ── Header ───────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between shrink-0">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/25 mb-0.5">Day Synopsis</p>
            <h2 className="text-sm font-semibold text-white/85 tracking-tight">{dateLabel}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg border border-white/8 bg-white/[0.03] flex items-center justify-center text-white/30 hover:text-white/65 transition-colors"
          >
            <X className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        </div>

        {/* ── Scrollable body ───────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6" style={{ scrollbarWidth: "none" }}>

          {/* No data state */}
          {isFuture && (
            <div className="py-8 text-center space-y-2">
              <p className="text-sm text-white/35">No data yet for this day.</p>
              <p className="text-xs text-white/20">Planned events will appear here once logged.</p>
            </div>
          )}

          {!synopsis && !isFuture && (
            <div className="py-8 text-center space-y-2">
              <p className="text-sm text-white/35">No synopsis available.</p>
              <p className="text-xs text-white/20">Log habits to build a daily record.</p>
            </div>
          )}

          {synopsis && (
            <>
              {/* ── Score + status ─────────────────────────────────── */}
              <div className="flex items-center gap-5">
                {/* Score ring */}
                <div className="relative shrink-0">
                  <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r="32" fill="none" stroke="white" strokeOpacity="0.05" strokeWidth="6" />
                    <circle cx="40" cy="40" r="32" fill="none"
                      stroke={synopsis.score >= 75 ? "#B48B40" : synopsis.score >= 60 ? "#93C5FD" : "#F87171"}
                      strokeOpacity="0.8" strokeWidth="6"
                      strokeDasharray={`${(synopsis.score / 100) * 201} 201`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-bold tabular-nums text-white/90 leading-none">{synopsis.score}</span>
                    <span className="text-[9px] text-white/25 mt-0.5">/100</span>
                  </div>
                </div>

                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Grade */}
                    <span className={cn("text-sm font-semibold", scoreGrade(synopsis.score).color)}>
                      {scoreGrade(synopsis.score).label}
                    </span>

                    {/* Win/loss */}
                    {synopsis.won === null ? (
                      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] px-2 py-0.5 rounded-md border border-[#B48B40]/25 bg-[#B48B40]/8 text-[#B48B40]/70">
                        In progress
                      </span>
                    ) : synopsis.won ? (
                      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] px-2 py-0.5 rounded-md border border-emerald-400/25 bg-emerald-400/8 text-emerald-400">
                        Win
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] px-2 py-0.5 rounded-md border border-red-400/20 bg-red-400/6 text-red-400/70">
                        Miss
                      </span>
                    )}

                    {/* Trend */}
                    <div className={cn(
                      "flex items-center gap-1 text-[10px] font-medium",
                      synopsis.trend === "improving" ? "text-emerald-400"
                        : synopsis.trend === "declining" ? "text-orange-400/80"
                        : "text-white/30"
                    )}>
                      {synopsis.trend === "improving" ? <TrendingUp  className="w-3 h-3" strokeWidth={2} />
                       : synopsis.trend === "declining" ? <TrendingDown className="w-3 h-3" strokeWidth={2} />
                       : <Minus className="w-3 h-3" strokeWidth={2} />}
                      <span className="capitalize">{synopsis.trend}</span>
                    </div>
                  </div>

                  {isToday && (
                    <p className="text-xs text-white/30 italic">Day in progress — data updates as you log.</p>
                  )}
                </div>
              </div>

              {/* ── Category breakdown ─────────────────────────────── */}
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/22 mb-3">Category breakdown</p>
                <div className="space-y-2.5">
                  {(Object.entries(synopsis.categories) as [keyof typeof CATEGORY_META, CategoryScore][])
                    .sort((a, b) => b[1].score - a[1].score)
                    .map(([cat, data]) => {
                      const meta = CATEGORY_META[cat];
                      return (
                        <div key={cat}>
                          <div className="flex items-center gap-3 mb-1">
                            <span className={cn("text-[10px] font-semibold uppercase tracking-[0.14em] w-16 shrink-0", meta.text)}>
                              {meta.label}
                            </span>
                            <div className="flex-1 h-1.5 rounded-full bg-white/6 overflow-hidden">
                              <div
                                className={cn("h-full rounded-full transition-all", meta.bar)}
                                style={{ width: `${data.score}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-semibold tabular-nums text-white/55 w-8 text-right shrink-0">
                              {data.score}
                            </span>
                          </div>
                          {data.note && (
                            <p className="text-[10px] text-white/25 ml-[76px] leading-snug">{data.note}</p>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* ── Performance grid ───────────────────────────────── */}
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/22 mb-3">Performance</p>
                <div className="grid grid-cols-2 gap-2">

                  {/* Steps */}
                  <div className="rounded-xl border border-white/6 bg-white/[0.02] px-4 py-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Footprints className="w-3 h-3 text-white/25" strokeWidth={1.5} />
                      <p className="text-[10px] uppercase tracking-[0.1em] text-white/22">Steps</p>
                    </div>
                    <p className={cn("text-lg font-semibold tabular-nums leading-none",
                      synopsis.performance.steps.actual >= synopsis.performance.steps.target
                        ? "text-emerald-400" : "text-white/70"
                    )}>
                      {synopsis.performance.steps.actual.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-white/22 mt-0.5">
                      of {synopsis.performance.steps.target.toLocaleString()}
                    </p>
                  </div>

                  {/* Workout */}
                  <div className="rounded-xl border border-white/6 bg-white/[0.02] px-4 py-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Dumbbell className="w-3 h-3 text-white/25" strokeWidth={1.5} />
                      <p className="text-[10px] uppercase tracking-[0.1em] text-white/22">Workout</p>
                    </div>
                    {synopsis.performance.workout ? (
                      <>
                        <p className="text-sm font-semibold text-white/75 leading-tight">
                          {synopsis.performance.workout.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Check className="w-3 h-3 text-emerald-400" strokeWidth={2} />
                          {synopsis.performance.workout.rpe && (
                            <span className="text-[10px] text-white/30">
                              RPE {synopsis.performance.workout.rpe}
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-white/30 leading-tight">Rest day</p>
                    )}
                  </div>

                  {/* Calories */}
                  <div className="rounded-xl border border-white/6 bg-white/[0.02] px-4 py-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Zap className="w-3 h-3 text-white/25" strokeWidth={1.5} />
                      <p className="text-[10px] uppercase tracking-[0.1em] text-white/22">Calories</p>
                    </div>
                    <p className={cn("text-lg font-semibold tabular-nums leading-none",
                      Math.abs(synopsis.performance.calories.actual - synopsis.performance.calories.target) < 200
                        ? "text-emerald-400" : "text-white/70"
                    )}>
                      {synopsis.performance.calories.actual.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-white/22 mt-0.5">
                      of {synopsis.performance.calories.target.toLocaleString()} kcal
                    </p>
                  </div>

                  {/* Protein */}
                  <div className="rounded-xl border border-white/6 bg-white/[0.02] px-4 py-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Flame className="w-3 h-3 text-white/25" strokeWidth={1.5} />
                      <p className="text-[10px] uppercase tracking-[0.1em] text-white/22">Protein</p>
                    </div>
                    <p className={cn("text-lg font-semibold tabular-nums leading-none",
                      synopsis.performance.protein.actual >= synopsis.performance.protein.target * 0.9
                        ? "text-[#B48B40]" : "text-white/70"
                    )}>
                      {synopsis.performance.protein.actual}g
                    </p>
                    <p className="text-[10px] text-white/22 mt-0.5">
                      of {synopsis.performance.protein.target}g target
                    </p>
                  </div>

                  {/* Hydration */}
                  <div className="rounded-xl border border-white/6 bg-white/[0.02] px-4 py-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Droplets className="w-3 h-3 text-white/25" strokeWidth={1.5} />
                      <p className="text-[10px] uppercase tracking-[0.1em] text-white/22">Hydration</p>
                    </div>
                    <p className={cn("text-lg font-semibold tabular-nums leading-none",
                      synopsis.performance.hydration.actual >= synopsis.performance.hydration.target * 0.9
                        ? "text-[#93C5FD]/80" : "text-white/70"
                    )}>
                      {(synopsis.performance.hydration.actual / 1000).toFixed(1)}L
                    </p>
                    <p className="text-[10px] text-white/22 mt-0.5">
                      of {(synopsis.performance.hydration.target / 1000).toFixed(1)}L target
                    </p>
                  </div>

                  {/* Sleep */}
                  <div className="rounded-xl border border-white/6 bg-white/[0.02] px-4 py-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Moon className="w-3 h-3 text-white/25" strokeWidth={1.5} />
                      <p className="text-[10px] uppercase tracking-[0.1em] text-white/22">Sleep</p>
                    </div>
                    {synopsis.performance.sleep ? (
                      <>
                        <p className={cn("text-lg font-semibold tabular-nums leading-none",
                          synopsis.performance.sleep.hours >= synopsis.performance.sleep.target * 0.9
                            ? "text-violet-400" : "text-white/70"
                        )}>
                          {synopsis.performance.sleep.hours}h
                        </p>
                        <p className="text-[10px] text-white/22 mt-0.5">
                          of {synopsis.performance.sleep.target}h target
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-white/25">—</p>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Accountability ─────────────────────────────────── */}
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/22 mb-3">Accountability</p>
                <div className="rounded-2xl border border-white/6 bg-white/[0.015] overflow-hidden">
                  <div className="grid grid-cols-2 divide-x divide-white/[0.05]">
                    {/* Completed */}
                    <div className="px-4 py-4">
                      <div className="flex items-center gap-1.5 mb-2.5">
                        <Check className="w-3 h-3 text-emerald-400" strokeWidth={2} />
                        <p className="text-[10px] uppercase tracking-[0.12em] text-emerald-400/60">
                          Done · {synopsis.accountability.completed.length}
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        {synopsis.accountability.completed.length === 0 ? (
                          <p className="text-xs text-white/22 italic">None logged</p>
                        ) : (
                          synopsis.accountability.completed.map((task) => (
                            <div key={task} className="flex items-center gap-2">
                              <span className="w-1 h-1 rounded-full bg-emerald-400/50 shrink-0" />
                              <span className="text-xs text-white/55">{task}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Missed */}
                    <div className="px-4 py-4">
                      <div className="flex items-center gap-1.5 mb-2.5">
                        <AlertTriangle className="w-3 h-3 text-red-400/60" strokeWidth={1.5} />
                        <p className="text-[10px] uppercase tracking-[0.12em] text-red-400/60">
                          Missed · {synopsis.accountability.missed.length}
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        {synopsis.accountability.missed.length === 0 ? (
                          <p className="text-xs text-white/22 italic">Clean sweep</p>
                        ) : (
                          synopsis.accountability.missed.map((task) => (
                            <div key={task} className="flex items-center gap-2">
                              <span className="w-1 h-1 rounded-full bg-red-400/35 shrink-0" />
                              <span className="text-xs text-white/40">{task}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {synopsis.accountability.recoveryNote && (
                    <div className="px-4 py-3 border-t border-white/[0.05] flex items-start gap-2">
                      <ArrowRight className="w-3.5 h-3.5 text-orange-400/60 mt-0.5 shrink-0" strokeWidth={1.5} />
                      <p className="text-xs text-white/40 leading-relaxed">{synopsis.accountability.recoveryNote}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Identity + journal ─────────────────────────────── */}
              {(synopsis.identity.state || synopsis.journal) && (
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/22 mb-3">Identity + Journal</p>
                  <div className="space-y-2">
                    {synopsis.identity.state && (
                      <div className={cn(
                        "rounded-xl border px-4 py-3",
                        IDENTITY_META[synopsis.identity.state].border,
                        "bg-white/[0.015]"
                      )}>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={cn("text-xs font-semibold", IDENTITY_META[synopsis.identity.state].color)}>
                            {IDENTITY_META[synopsis.identity.state].label}
                          </span>
                        </div>
                        {synopsis.identity.note && (
                          <p className="text-xs text-white/40 leading-relaxed">{synopsis.identity.note}</p>
                        )}
                      </div>
                    )}

                    {synopsis.journal && (
                      <div className="rounded-xl border border-white/6 bg-white/[0.015] px-4 py-3">
                        <p className="text-[10px] uppercase tracking-[0.1em] text-white/20 mb-1.5">Journal</p>
                        <p className="text-sm text-white/50 leading-relaxed">{synopsis.journal}</p>
                        <p className="text-[10px] text-white/18 mt-2">Visible to AI coach</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── AI insight ─────────────────────────────────────── */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[#B48B40] text-xs leading-none">◈</span>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/22">AI Insight</p>
                </div>
                <div className="rounded-2xl border border-white/6 bg-white/[0.015] overflow-hidden divide-y divide-white/[0.05]">
                  {[
                    { icon: Check,         color: "text-emerald-400/70", label: "What went right", text: synopsis.insight.right },
                    { icon: AlertTriangle, color: "text-red-400/60",     label: "What went wrong",  text: synopsis.insight.wrong },
                    { icon: ArrowRight,    color: "text-[#B48B40]/70",   label: "Fix next",         text: synopsis.insight.fix   },
                  ].map(({ icon: Icon, color, label, text }) => (
                    <div key={label} className="flex items-start gap-3 px-4 py-3.5">
                      <Icon className={cn("w-3.5 h-3.5 mt-0.5 shrink-0", color)} strokeWidth={1.5} />
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-[0.1em] text-white/22 mb-1">{label}</p>
                        <p className="text-sm text-white/60 leading-relaxed">{text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Timeline ───────────────────────────────────────── */}
              {synopsis.timeline.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/22 mb-3">Timeline</p>
                  <div className="relative pl-6">
                    {/* Vertical line */}
                    <div className="absolute left-2.5 top-1 bottom-1 w-px bg-white/[0.06]" />

                    <div className="space-y-3">
                      {synopsis.timeline.map((item, i) => {
                        const Icon = TIMELINE_ICON[item.type];
                        return (
                          <div key={i} className="flex items-center gap-3 relative">
                            {/* Dot */}
                            <div className="absolute -left-6 w-4 h-4 rounded-full bg-[#0D0D0D] border border-white/10 flex items-center justify-center">
                              <Icon className="w-2 h-2 text-white/30" strokeWidth={2} />
                            </div>
                            <span className="text-[10px] text-white/25 tabular-nums w-10 shrink-0">{item.time}</span>
                            <span className="text-xs text-white/50">{item.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Quick actions footer ──────────────────────────────────── */}
        <div className="px-6 py-4 border-t border-white/[0.06] shrink-0">
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 rounded-xl border border-white/8 bg-white/[0.02] px-3.5 py-2 text-xs text-white/38 hover:text-white/65 hover:border-white/15 transition-all">
              <Pencil className="w-3 h-3" strokeWidth={1.5} />
              Edit day
            </button>
            <button className="flex items-center gap-1.5 rounded-xl border border-white/8 bg-white/[0.02] px-3.5 py-2 text-xs text-white/38 hover:text-white/65 hover:border-white/15 transition-all">
              <Plus className="w-3 h-3" strokeWidth={2} />
              Add data
            </button>
            <button className="flex items-center gap-1.5 rounded-xl border border-[#B48B40]/18 bg-[#B48B40]/5 px-3.5 py-2 text-xs text-[#B48B40]/60 hover:text-[#B48B40]/85 hover:border-[#B48B40]/30 transition-all ml-auto">
              <MessageSquare className="w-3 h-3" strokeWidth={1.5} />
              Message coach
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const { can } = useEntitlement();

  // Page-level gate — Core plan required
  if (!can(FEATURES.CALENDAR)) {
    return <LockedPageState feature={FEATURES.CALENDAR} />;
  }

  return <CalendarPageInner />;
}

function CalendarPageInner() {
  const [viewDate,   setViewDate  ] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected,   setSelected  ] = useState<string | null>(todayStr);
  const [synopsisKey, setSynopsisKey] = useState<string | null>(null);

  // Double-click discriminator
  const clickTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingKeyRef  = useRef<string | null>(null);

  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const cells = buildMonth(year, month);

  function prev() { setViewDate(new Date(year, month - 1, 1)); }
  function next() { setViewDate(new Date(year, month + 1, 1)); }

  function cellKey(day: number): string {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function handleDayClick(key: string) {
    if (pendingKeyRef.current === key && clickTimerRef.current) {
      // Second click on same key within 300ms = double-click
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      pendingKeyRef.current = null;
      setSelected(key);
      setSynopsisKey(key);
    } else {
      // First click: wait to see if double-click follows
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
      pendingKeyRef.current = key;
      clickTimerRef.current = setTimeout(() => {
        // Single click confirmed
        setSelected((prev) => prev === key ? null : key);
        pendingKeyRef.current  = null;
        clickTimerRef.current  = null;
      }, 280);
    }
  }

  const selectedEvents = selected ? (EVENTS[selected] ?? []) : [];

  return (
    <div className="px-5 md:px-8 py-6 max-w-2xl mx-auto text-white space-y-6">

      {/* Header */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.22em] text-white/22 mb-2">Schedule</p>
        <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
        <p className="text-sm text-white/30 mt-1">Training, nutrition, and recovery overview.</p>
      </div>

      {/* Month nav */}
      <div className="rounded-2xl border border-white/6 bg-[#111111] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.05]">
          <button onClick={prev} className="text-white/35 hover:text-white/65 transition-colors">
            <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
          </button>
          <span className="text-sm font-semibold text-white/80">{MONTHS[month]} {year}</span>
          <button onClick={next} className="text-white/35 hover:text-white/65 transition-colors">
            <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Weekday labels */}
        <div className="grid grid-cols-7 border-b border-white/[0.04]">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-2 text-center text-[10px] font-medium text-white/20 uppercase tracking-[0.1em]">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            if (!day) return <div key={`e-${i}`} className="aspect-square" />;

            const key       = cellKey(day);
            const events    = EVENTS[key] ?? [];
            const synopsis  = DAY_SYNOPSES[key];
            const isToday   = key === todayStr;
            const isSel     = key === selected;
            const isPast    = key < todayStr;
            const hasSynopsis = !!synopsis;

            return (
              <button
                key={key}
                onClick={() => handleDayClick(key)}
                title="Double-click for full breakdown"
                className={cn(
                  "aspect-square flex flex-col items-center justify-start pt-2 pb-1 px-1 border border-transparent transition-all",
                  isSel   && "bg-white/[0.04] border-white/8 rounded-xl",
                  isToday && !isSel && "bg-[#B48B40]/8"
                )}
              >
                <span className={cn(
                  "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1",
                  isToday ? "bg-[#B48B40] text-black font-semibold"
                           : isPast ? "text-white/30"
                           : "text-white/60"
                )}>
                  {day}
                </span>

                {/* Event dots */}
                <div className="flex gap-0.5 flex-wrap justify-center">
                  {events.slice(0, 2).map((ev, ei) => (
                    <span key={ei} className={cn("w-1 h-1 rounded-full", EVENT_STYLE[ev.type].dot)} />
                  ))}
                </div>

                {/* Synopsis score badge */}
                {hasSynopsis && isPast && (
                  <span className={cn(
                    "text-[8px] tabular-nums font-semibold mt-0.5 leading-none",
                    synopsis.won === true  ? "text-emerald-400/60"
                    : synopsis.won === false ? "text-red-400/45"
                    : "text-[#B48B40]/50"
                  )}>
                    {synopsis.score}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Double-click hint */}
      <p className="text-[10px] text-white/18 text-center -mt-3">
        Double-click any day to view full breakdown
      </p>

      {/* Selected day panel */}
      {selected && (
        <div className="rounded-2xl border border-white/6 bg-[#111111] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.05] flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/22">
              {new Date(selected + "T00:00:00").toLocaleDateString("en-US", {
                weekday: "long", month: "long", day: "numeric",
              })}
            </p>
            {DAY_SYNOPSES[selected] && (
              <button
                onClick={() => setSynopsisKey(selected)}
                className="text-[10px] text-[#B48B40]/60 hover:text-[#B48B40] transition-colors"
              >
                Full breakdown →
              </button>
            )}
          </div>

          {/* Quick score strip for days with synopsis */}
          {DAY_SYNOPSES[selected] && (
            <div className="px-5 py-3 border-b border-white/[0.04] flex items-center gap-4">
              {(() => {
                const s = DAY_SYNOPSES[selected]!;
                const g = scoreGrade(s.score);
                return (
                  <>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-semibold tabular-nums text-white/85">{s.score}</span>
                      <span className="text-xs text-white/25">/100</span>
                    </div>
                    <span className={cn("text-xs font-medium", g.color)}>{g.label}</span>
                    {s.won === true  && <span className="text-[10px] font-semibold uppercase tracking-[0.1em] px-2 py-0.5 rounded-md border border-emerald-400/25 bg-emerald-400/8 text-emerald-400">Win</span>}
                    {s.won === false && <span className="text-[10px] font-semibold uppercase tracking-[0.1em] px-2 py-0.5 rounded-md border border-red-400/20 bg-red-400/6 text-red-400/70">Miss</span>}
                    {s.won === null  && <span className="text-[10px] font-semibold uppercase tracking-[0.1em] px-2 py-0.5 rounded-md border border-[#B48B40]/25 bg-[#B48B40]/8 text-[#B48B40]/70">In progress</span>}
                    <div className={cn(
                      "flex items-center gap-1 text-[10px] ml-auto",
                      s.trend === "improving" ? "text-emerald-400/70" : s.trend === "declining" ? "text-orange-400/70" : "text-white/25"
                    )}>
                      {s.trend === "improving" ? <TrendingUp  className="w-3 h-3" strokeWidth={2} />
                        : s.trend === "declining" ? <TrendingDown className="w-3 h-3" strokeWidth={2} />
                        : <Minus className="w-3 h-3" strokeWidth={2} />}
                      <span className="capitalize">{s.trend}</span>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* Events list */}
          {selectedEvents.length > 0 ? (
            <div className="divide-y divide-white/[0.04]">
              {selectedEvents.map((ev, i) => {
                const style = EVENT_STYLE[ev.type];
                const Icon  = EVENT_ICON[ev.type];
                return (
                  <div key={i} className="flex items-center gap-3 px-5 py-3.5">
                    <div className={cn("w-7 h-7 rounded-xl flex items-center justify-center shrink-0", style.bg)}>
                      <Icon className={cn("w-3.5 h-3.5", style.text)} strokeWidth={1.5} />
                    </div>
                    <div>
                      <p className="text-sm text-white/75">{ev.label}</p>
                      <p className={cn("text-[10px] capitalize mt-0.5", style.text)}>{ev.type}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="px-5 py-5 text-center">
              <p className="text-sm text-white/22">No events scheduled.</p>
            </div>
          )}
        </div>
      )}

      {/* Synopsis modal */}
      {synopsisKey && (
        <DaySynopsisModal
          dateKey={synopsisKey}
          onClose={() => setSynopsisKey(null)}
        />
      )}

    </div>
  );
}
