"use client";

import { useState, useMemo, useEffect } from "react";
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates, useSortable,
  arrayMove, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical, Check, Pencil, X, Eye, EyeOff,
  Flame, ChevronDown, ChevronUp, AlertTriangle, BookOpen,
  ArrowRight, SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useUser } from "@/context/UserContext";
import { computeActivityScore, scoreToIntensity } from "@/lib/data/activity";

const _UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isRealUser(id: string) { return _UUID_RE.test(id) && !!process.env.NEXT_PUBLIC_SUPABASE_URL; }

// ─── Types ────────────────────────────────────────────────────────────────────

type HabitCategory = "body" | "mind" | "nutrition" | "business" | "lifestyle" | "custom";
type IdentityState = "locked" | "focused" | "tired" | "off" | null;

type Habit = {
  id: string;
  label: string;
  category: HabitCategory;
  visible: boolean;
  weight: 1 | 2 | 3;
  hint?: string;
};

type FocusCategoryConfig = {
  id: HabitCategory;
  active: boolean;
  required: boolean;
  customLabel?: string;
};

type DailyLog = {
  completedHabits: string[];
  identityState: IdentityState;
  energyNote: string;
  journalEntry: string;
  journalSaved: boolean;
};

type Logs = Record<string, DailyLog>;

type JournalEntry = {
  date: string;
  text: string;
  score: number;
  identityState: IdentityState;
  savedAt: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const QUOTES = [
  { text: "The standard you walk past is the standard you accept.", author: "David Morrison" },
  { text: "You don't rise to the level of your goals. You fall to the level of your systems.", author: "James Clear" },
  { text: "Discipline is choosing between what you want now and what you want most.", author: "" },
  { text: "The pain of discipline is far less than the pain of regret.", author: "Jim Rohn" },
  { text: "Champions are made in the hours nobody is watching.", author: "" },
  { text: "Small moves, compounded daily, become impossible to ignore.", author: "" },
  { text: "Hard days build hard people.", author: "" },
  { text: "Every time you do the hard thing, you vote for the person you're becoming.", author: "" },
  { text: "Execution is the strategy.", author: "" },
  { text: "The body keeps the score. So does the calendar.", author: "" },
  { text: "Show up clean. Do the work. Repeat.", author: "" },
  { text: "You are what you repeatedly do.", author: "Aristotle" },
  { text: "The goal is not to be better than the other person, but your previous self.", author: "" },
  { text: "Momentum doesn't care about motivation.", author: "" },
];

const CATEGORY_CONFIG: Record<HabitCategory, {
  label: string; color: string; dot: string; bar: string; description: string;
}> = {
  body:      { label: "Body",      color: "text-[#B48B40]",   dot: "bg-[#B48B40]",   bar: "bg-[#B48B40]",   description: "Training, sleep, movement"          },
  mind:      { label: "Mind",      color: "text-[#93C5FD]",   dot: "bg-[#93C5FD]",   bar: "bg-[#93C5FD]",   description: "Focus, reading, mental habits"       },
  nutrition: { label: "Nutrition", color: "text-teal-400",    dot: "bg-teal-400",    bar: "bg-teal-400",    description: "Diet, macros, food quality"          },
  business:  { label: "Business",  color: "text-emerald-400", dot: "bg-emerald-400", bar: "bg-emerald-400", description: "Revenue, output, professional work"  },
  lifestyle: { label: "Lifestyle", color: "text-violet-400",  dot: "bg-violet-400",  bar: "bg-violet-400",  description: "Environment and foundation habits"   },
  custom:    { label: "Custom",    color: "text-white/50",    dot: "bg-white/25",    bar: "bg-white/25",    description: "Define your own focus area"          },
};

const DEFAULT_FOCUS_CONFIG: FocusCategoryConfig[] = [
  { id: "body",      active: true,  required: true  },
  { id: "mind",      active: true,  required: true  },
  { id: "nutrition", active: true,  required: false },
  { id: "business",  active: true,  required: false },
  { id: "lifestyle", active: true,  required: false },
  { id: "custom",    active: false, required: false, customLabel: "Custom" },
];

const IDENTITY_OPTIONS: Array<{
  value: NonNullable<IdentityState>;
  label: string; sub: string;
  border: string; bg: string; text: string;
}> = [
  { value: "locked",  label: "Locked in",       sub: "Everything is aligned.",    border: "border-[#B48B40]/40",  bg: "bg-[#B48B40]/8",  text: "text-[#B48B40]"      },
  { value: "focused", label: "Focused",          sub: "Steady and clear.",         border: "border-[#93C5FD]/30",  bg: "bg-[#93C5FD]/6",  text: "text-[#93C5FD]/80"   },
  { value: "tired",   label: "Tired but moving", sub: "Showing up despite it.",    border: "border-orange-400/30", bg: "bg-orange-400/6", text: "text-orange-400/80"  },
  { value: "off",     label: "Off today",        sub: "Honest. Reset starts now.", border: "border-red-400/20",    bg: "bg-red-400/5",    text: "text-red-400/60"     },
];

const DEFAULT_HABITS: Habit[] = [
  { id: "training",   label: "Training",         category: "body",      visible: true,  weight: 3, hint: "session"  },
  { id: "steps",      label: "10k steps",        category: "body",      visible: true,  weight: 2, hint: "walk"     },
  { id: "sleep",      label: "8h sleep",         category: "body",      visible: true,  weight: 3, hint: "priority" },
  { id: "water",      label: "Water",            category: "body",      visible: true,  weight: 1, hint: "3L"       },
  { id: "deep-work",  label: "Deep work",        category: "mind",      visible: true,  weight: 3, hint: "4h block" },
  { id: "reading",    label: "Reading",          category: "mind",      visible: true,  weight: 2, hint: "30 min"   },
  { id: "meditation", label: "Meditation",       category: "mind",      visible: false, weight: 1, hint: "10 min"   },
  { id: "journaling", label: "Journaling",       category: "mind",      visible: false, weight: 1, hint: "reflect"  },
  { id: "protein",    label: "Protein target",   category: "nutrition", visible: true,  weight: 3, hint: "150g+"    },
  { id: "calories",   label: "Calories on track",category: "nutrition", visible: true,  weight: 2, hint: "track"    },
  { id: "no-junk",    label: "No junk food",     category: "nutrition", visible: true,  weight: 1, hint: "clean"    },
  { id: "rev-calls",  label: "Revenue calls",    category: "business",  visible: true,  weight: 3, hint: "3+ calls" },
  { id: "content",    label: "Content",          category: "business",  visible: true,  weight: 2, hint: "publish"  },
  { id: "metrics",    label: "Review metrics",   category: "business",  visible: true,  weight: 1, hint: "daily"    },
  { id: "no-alcohol", label: "No alcohol",       category: "lifestyle", visible: true,  weight: 2, hint: "clean"    },
  { id: "sunlight",   label: "Morning sun",      category: "lifestyle", visible: true,  weight: 1, hint: "10 min"   },
  { id: "cold",       label: "Cold exposure",    category: "lifestyle", visible: false, weight: 1, hint: "plunge"   },
  { id: "custom-1",   label: "Custom habit",     category: "custom",    visible: true,  weight: 2, hint: ""         },
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

function computeScore(habits: Habit[], completedIds: string[], activeCats: HabitCategory[]): number {
  const visible = habits.filter((h) => h.visible && activeCats.includes(h.category));
  const max = visible.reduce((s, h) => s + h.weight, 0);
  if (!max) return 0;
  const earned = visible.filter((h) => completedIds.includes(h.id)).reduce((s, h) => s + h.weight, 0);
  return Math.round((earned / max) * 100);
}

function computeStreaks(habits: Habit[], logs: Logs, activeCats: HabitCategory[]) {
  let training = 0; let movement = 0; let consistency = 0;
  for (let i = 0; i < 90; i++) {
    const c = logs[pastKey(i)]?.completedHabits ?? [];
    if (c.includes("training")) training++; else break;
  }
  for (let i = 0; i < 90; i++) {
    const c = logs[pastKey(i)]?.completedHabits ?? [];
    if (c.includes("steps") || c.includes("training")) movement++; else break;
  }
  for (let i = 0; i < 90; i++) {
    const log = logs[pastKey(i)];
    if (log && computeScore(habits, log.completedHabits, activeCats) >= 60) consistency++; else break;
  }
  return { training, movement, consistency };
}

function scoreGrade(score: number) {
  if (score >= 90) return { label: "Elite",    color: "text-[#B48B40]"     };
  if (score >= 75) return { label: "Strong",   color: "text-emerald-400"   };
  if (score >= 60) return { label: "Solid",    color: "text-[#93C5FD]/80"  };
  if (score >= 40) return { label: "Moving",   color: "text-orange-400/80" };
  return               { label: "Get going", color: "text-white/35"      };
}

function getDailyQuote() {
  const day = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  return QUOTES[day % QUOTES.length];
}

function formatDate() {
  return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function compute7DayStats(habits: Habit[], logs: Logs, activeCats: HabitCategory[]) {
  const days   = Array.from({ length: 7 }, (_, i) => pastKey(i));
  const scores = days.map((d) => {
    const log = logs[d];
    if (!log || !log.completedHabits.length) return null;
    return computeScore(habits, log.completedHabits, activeCats);
  });

  const withData = scores.filter((s): s is number => s !== null);
  const won    = scores.filter((s) => s !== null && s >= 60).length;
  const missed = scores.filter((s) => s === null || (s as number) < 30).length;
  const avg    = withData.length ? Math.round(withData.reduce((a, b) => a + b, 0) / withData.length) : 0;

  const cats = activeCats.map((cat) => {
    const catHabits = habits.filter((h) => h.visible && h.category === cat);
    if (!catHabits.length) return { cat, pct: 0 };
    const total = days.reduce((sum, d) => {
      const done = (logs[d]?.completedHabits ?? []).filter((id) => catHabits.some((h) => h.id === id)).length;
      return sum + (done / catHabits.length) * 100;
    }, 0);
    return { cat, pct: Math.round(total / 7) };
  }).filter((c) => c.pct > 0 || habits.filter((h) => h.visible && h.category === c.cat).length > 0);

  const sorted     = [...cats].sort((a, b) => b.pct - a.pct);
  const strongest  = sorted[0]  ?? { cat: activeCats[0] ?? "body", pct: 0 };
  const weakest    = sorted[sorted.length - 1] ?? { cat: activeCats[0] ?? "body", pct: 0 };

  return { won, missed, avg, strongest: strongest as { cat: HabitCategory; pct: number }, weakest: weakest as { cat: HabitCategory; pct: number }, hasData: withData.length > 0 };
}

function getRecoveryPanel(habits: Habit[], logs: Logs, activeCats: HabitCategory[]) {
  const yLog = logs[pastKey(1)];
  if (!yLog || !yLog.completedHabits.length) return null;
  const score = computeScore(habits, yLog.completedHabits, activeCats);
  if (score >= 55) return null;

  const missedCats = activeCats.filter((cat) => {
    const catHabits = habits.filter((h) => h.visible && h.category === cat && h.weight >= 2);
    return catHabits.some((h) => !yLog.completedHabits.includes(h.id));
  });

  const INSIGHTS: Partial<Record<HabitCategory, { wrong: string; fix: string }>> = {
    body:      { wrong: "Physical inputs were inconsistent — training or sleep slipped.",       fix: "Lock sleep and one training block as non-negotiable anchors for tomorrow."  },
    mind:      { wrong: "Focus blocks weren't protected. Shallow tasks crowded out deep work.", fix: "Schedule your deep work block first in the day. Close everything else."      },
    nutrition: { wrong: "Nutrition targets were missed. Protein or calorie tracking lapsed.",   fix: "Prep one high-protein meal in advance. Remove the friction point."           },
    business:  { wrong: "Revenue-driving activities were skipped or pushed to end of day.",     fix: "Front-load your most valuable business task before any reactive work."       },
    lifestyle: { wrong: "Foundation habits dropped — likely an environment or friction issue.", fix: "Reduce compliance cost. Lay out what you need the night before."            },
    custom:    { wrong: "Your custom focus area slipped yesterday.",                            fix: "Identify the friction and remove it before tomorrow starts."                },
  };

  const primary = missedCats[0] ?? "body";
  const insight = INSIGHTS[primary] ?? INSIGHTS.body!;

  return {
    score,
    missedCats,
    likelyWrong: insight.wrong,
    shouldChange: insight.fix,
    nextAction: "Name one task you will start within the first 60 minutes of tomorrow.",
  };
}

// ─── Trajectory chart (SVG) ───────────────────────────────────────────────────

function TrajectoryChart({ habits, logs, activeCats }: {
  habits: Habit[]; logs: Logs; activeCats: HabitCategory[];
}) {
  const W = 600; const H = 90;
  const PAD = 6;
  const chartH = H - PAD * 2;

  const days = Array.from({ length: 30 }, (_, i) => {
    const key   = pastKey(29 - i);
    const log   = logs[key];
    const score = log ? computeScore(habits, log.completedHabits, activeCats) : null;
    return { i, score, isToday: i === 29 };
  });

  const plotted = days.filter((d) => d.score !== null);
  const coords  = plotted.map((d) => ({
    x:       (d.i / 29) * W,
    y:       PAD + chartH - ((d.score! / 100) * chartH),
    score:   d.score!,
    isToday: d.isToday,
  }));

  const goalY = PAD + chartH - (0.8 * chartH);

  if (coords.length < 2) {
    return (
      <div className="h-[90px] flex items-center justify-center">
        <p className="text-xs text-white/18 italic">Trajectory builds as you log more days.</p>
      </div>
    );
  }

  const pathD = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");
  const areaD = `${pathD} L ${coords[coords.length - 1].x.toFixed(1)} ${H} L ${coords[0].x.toFixed(1)} ${H} Z`;

  return (
    <div className="relative">
      <div
        className="absolute right-0 flex items-center gap-1 pointer-events-none"
        style={{ top: `${(goalY / H) * 100}%`, transform: "translateY(-50%)" }}
      >
        <span className="text-[9px] text-[#B48B40]/40 tabular-nums">80</span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 90 }} preserveAspectRatio="none">
        <defs>
          <linearGradient id="traj-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#B48B40" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#B48B40" stopOpacity="0.00" />
          </linearGradient>
        </defs>
        <line x1="0" y1={H - PAD / 2} x2={W} y2={H - PAD / 2} stroke="white" strokeOpacity="0.05" strokeWidth="1" />
        <line x1="0" y1={goalY} x2={W} y2={goalY} stroke="#B48B40" strokeOpacity="0.18" strokeWidth="1" strokeDasharray="5 5" />
        <path d={areaD} fill="url(#traj-area)" />
        <path d={pathD} fill="none" stroke="#B48B40" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
        {coords.map((c, i) => (
          c.isToday ? (
            <g key={i}>
              <circle cx={c.x} cy={c.y} r="5" fill="#B48B40" fillOpacity="0.15" />
              <circle cx={c.x} cy={c.y} r="2.5" fill="#B48B40" />
            </g>
          ) : (
            <circle key={i} cx={c.x} cy={c.y} r="1.5" fill="#B48B40" fillOpacity="0.45" />
          )
        ))}
      </svg>

      <div className="flex justify-between mt-1 px-0.5">
        <span className="text-[9px] text-white/18">30d ago</span>
        <span className="text-[9px] text-white/18">Today</span>
      </div>
    </div>
  );
}

// ─── Activity Heatmap ─────────────────────────────────────────────────────────
// Scoring: workout completed +40 · steps goal hit +20 · calories logged +20 ·
//          check-in (journal saved) +20.  Cap: 100 per day.
// Intensity bands: 0=empty · 1–30=low · 31–70=medium · 71–100=high
//
// Role-visibility note: trainer/master views that show client heatmaps will
// require DB-backed activity records (GET /api/activity/:userId).
// Currently only the active user's own logs are shown.

function activityScoreFromLog(log: DailyLog | undefined): number {
  if (!log) return -1;
  const actions = {
    workoutCompleted: log.completedHabits.includes("training"),
    stepsGoalHit:     log.completedHabits.includes("steps"),
    caloriesLogged:   log.completedHabits.includes("calories"),
    checkInCompleted: log.journalSaved === true,
  };
  const score = computeActivityScore(actions);
  // No actions → -1 (empty cell)
  if (score === 0 && !Object.values(actions).some(Boolean)) return -1;
  return score;
}

function ActivityHeatmap({ logs }: { habits: Habit[]; logs: Logs; activeCats: HabitCategory[] }) {
  const [tip, setTip] = useState<{
    dateKey: string; score: number; actions: string[]; x: number; y: number;
  } | null>(null);

  // Build 52-week grid aligned to Sunday
  const end   = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - 364);
  const startDow = start.getDay();
  if (startDow > 0) start.setDate(start.getDate() - startDow);

  const weeks: Array<Array<{ dateKey: string; score: number; isFuture: boolean }>> = [];
  const cur = new Date(start);
  const endMs = end.getTime();

  while (cur.getTime() <= endMs + 6 * 86400000) {
    const week: Array<{ dateKey: string; score: number; isFuture: boolean }> = [];
    for (let d = 0; d < 7; d++) {
      const dateKey  = cur.toISOString().slice(0, 10);
      const isFuture = cur.getTime() > endMs;
      const score    = isFuture ? -1 : activityScoreFromLog(logs[dateKey]);
      week.push({ dateKey, score, isFuture });
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
  }

  // Month labels: mark the first week a new month starts
  const monthLabels: Array<{ weekIdx: number; label: string }> = [];
  let lastMonth = -1;
  weeks.forEach((week, wi) => {
    const m = new Date(week[0].dateKey + "T00:00:00").getMonth();
    if (m !== lastMonth) {
      monthLabels.push({
        weekIdx: wi,
        label: new Date(week[0].dateKey + "T00:00:00").toLocaleDateString("en-US", { month: "short" }),
      });
      lastMonth = m;
    }
  });

  function cellColor(score: number, isFuture: boolean): string {
    if (isFuture) return "bg-white/[0.04]";
    const band = scoreToIntensity(score);
    if (band === "empty")  return "bg-white/[0.04]";
    if (band === "low")    return "bg-[#B48B40]/20";
    if (band === "medium") return "bg-[#B48B40]/50";
    return "bg-[#B48B40]";
  }

  function tipActions(log: DailyLog | undefined): string[] {
    if (!log) return [];
    const parts: string[] = [];
    if (log.completedHabits.includes("training")) parts.push("Workout +40");
    if (log.completedHabits.includes("steps"))    parts.push("Steps +20");
    if (log.completedHabits.includes("calories")) parts.push("Calories +20");
    if (log.journalSaved)                         parts.push("Check-in +20");
    return parts;
  }

  const DOW_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

  return (
    <div className="relative">
      {tip && (
        <div
          className="fixed z-50 pointer-events-none bg-[#1A1A1A] border border-white/10 rounded-lg px-3 py-2 shadow-xl"
          style={{ left: tip.x + 14, top: tip.y - 52 }}
        >
          <p className="text-xs font-medium text-white/80">{tip.dateKey}</p>
          {tip.score >= 0 ? (
            <>
              <p className={cn("text-[11px] font-semibold mt-0.5", scoreGrade(tip.score).color)}>
                Score {tip.score}
              </p>
              {tip.actions.length > 0 && (
                <p className="text-[10px] text-white/35 mt-0.5">{tip.actions.join(" · ")}</p>
              )}
            </>
          ) : (
            <p className="text-[11px] text-white/35 mt-0.5">No activity</p>
          )}
        </div>
      )}

      <div className="overflow-x-auto pb-1">
        <div className="inline-flex gap-0">
          {/* Day-of-week labels */}
          <div className="flex flex-col gap-[3px] mr-[7px] pt-5">
            {DOW_LABELS.map((d, i) => (
              <div key={i} className="h-[10px] flex items-center justify-end">
                {[1, 3, 5].includes(i)
                  ? <span className="text-[8px] text-white/20 leading-none">{d}</span>
                  : <span className="text-[8px] leading-none invisible">{d}</span>
                }
              </div>
            ))}
          </div>

          <div>
            {/* Month labels */}
            <div className="flex gap-[3px] mb-[5px] h-4 items-end">
              {weeks.map((week, wi) => {
                const ml = monthLabels.find((m) => m.weekIdx === wi);
                return (
                  <div key={wi} className="w-[10px] shrink-0 relative">
                    {ml && (
                      <span className="absolute left-0 text-[8px] text-white/25 whitespace-nowrap leading-none">
                        {ml.label}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Cell grid */}
            <div className="flex gap-[3px]">
              {weeks.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-[3px]">
                  {week.map((day) => {
                    const log = logs[day.dateKey];
                    return (
                      <div
                        key={day.dateKey}
                        className={cn(
                          "w-[10px] h-[10px] rounded-[2px] transition-opacity",
                          cellColor(day.score, day.isFuture),
                          !day.isFuture && "cursor-default hover:opacity-70"
                        )}
                        onMouseEnter={(e) => {
                          if (day.isFuture) return;
                          setTip({ dateKey: day.dateKey, score: day.score, actions: tipActions(log), x: e.clientX, y: e.clientY });
                        }}
                        onMouseLeave={() => setTip(null)}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-3 justify-end">
        {([
          { label: "None",   cls: "bg-white/[0.04]"   },
          { label: "Low",    cls: "bg-[#B48B40]/20"   },
          { label: "Medium", cls: "bg-[#B48B40]/50"   },
          { label: "High",   cls: "bg-[#B48B40]"      },
        ] as const).map(({ label, cls }) => (
          <div key={label} className="flex items-center gap-1">
            <div className={cn("w-[10px] h-[10px] rounded-[2px]", cls)} />
            <span className="text-[9px] text-white/20">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={cn(
        "relative rounded-full transition-all duration-200 shrink-0",
        enabled ? "bg-[#B48B40]" : "bg-white/10"
      )}
      style={{ height: 22, width: 40 }}
    >
      <span
        className={cn(
          "absolute top-0.5 rounded-full bg-white shadow transition-all duration-200",
          enabled ? "left-[18px]" : "left-0.5"
        )}
        style={{ width: 18, height: 18 }}
      />
    </button>
  );
}

// ─── FocusModal ───────────────────────────────────────────────────────────────

function FocusModal({
  focusConfig,
  onUpdate,
  onClose,
}: {
  focusConfig: FocusCategoryConfig[];
  onUpdate: (cfg: FocusCategoryConfig[]) => void;
  onClose: () => void;
}) {
  const [draft,   setDraft  ] = useState(focusConfig);
  const [warning, setWarning] = useState<string | null>(null);

  const activeCount   = draft.filter((c) => c.active).length;
  const requiredCount = draft.filter((c) => c.active && c.required).length;

  function toggleActive(id: HabitCategory) {
    const current = draft.find((c) => c.id === id)!;
    if (current.active) {
      if (activeCount <= 2) {
        setWarning("You need at least 2 active focus categories to maintain a meaningful system.");
        return;
      }
      if (current.required && requiredCount <= 1) {
        setWarning("This is your only required category. Set another as required before disabling it.");
        return;
      }
    }
    setWarning(null);
    setDraft((prev) => prev.map((c) =>
      c.id === id ? { ...c, active: !c.active, required: c.active ? false : c.required } : c
    ));
  }

  function toggleRequired(id: HabitCategory) {
    const current = draft.find((c) => c.id === id)!;
    if (current.required && requiredCount <= 1) {
      setWarning("At least one category must be required. Your daily win needs something to measure against.");
      return;
    }
    setWarning(null);
    setDraft((prev) => prev.map((c) =>
      c.id === id ? { ...c, required: !c.required } : c
    ));
  }

  function handleSave() {
    onUpdate(draft);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Card */}
      <div className="relative w-full sm:max-w-md bg-[#0F0F0F] border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="px-6 py-5 border-b border-white/[0.06] flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-white/90 tracking-tight">Focus configuration</h2>
            <p className="text-xs text-white/35 mt-1 leading-relaxed">
              Required categories determine your daily win. Optional categories are tracked but don&apos;t affect the outcome.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/25 hover:text-white/55 transition-colors mt-0.5 ml-4 shrink-0"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Category list */}
        <div className="px-4 py-3 space-y-1.5 max-h-[55vh] overflow-y-auto" style={{ scrollbarWidth: "none" }}>
          {draft.map((cfg) => {
            const meta  = CATEGORY_CONFIG[cfg.id];
            const label = cfg.id === "custom" && cfg.customLabel ? cfg.customLabel : meta.label;
            return (
              <div
                key={cfg.id}
                className={cn(
                  "rounded-xl border px-4 py-3.5 transition-all duration-150",
                  cfg.active
                    ? "border-white/8 bg-white/[0.025]"
                    : "border-white/[0.04] bg-transparent"
                )}
              >
                {/* Top row: name + active toggle */}
                <div className="flex items-center justify-between gap-4">
                  <div className={cn("flex items-center gap-2.5 min-w-0 transition-opacity", !cfg.active && "opacity-40")}>
                    <span className={cn("w-1.5 h-1.5 rounded-full shrink-0 transition-colors", cfg.active ? meta.dot : "bg-white/15")} />
                    <div className="min-w-0">
                      <p className={cn("text-sm font-medium leading-none", cfg.active ? "text-white/80" : "text-white/35")}>
                        {label}
                      </p>
                      <p className="text-[11px] text-white/28 mt-0.5 leading-snug">{meta.description}</p>
                    </div>
                  </div>
                  <Toggle enabled={cfg.active} onChange={() => toggleActive(cfg.id)} />
                </div>

                {/* Required / Optional selector — only when active */}
                {cfg.active && (
                  <div className="mt-3 flex items-center gap-2.5 pl-4">
                    <span className="text-[10px] text-white/22 uppercase tracking-[0.12em] shrink-0">Impact</span>
                    <div className="flex items-center gap-0.5 rounded-lg border border-white/8 bg-white/[0.02] p-0.5">
                      <button
                        onClick={() => { if (!cfg.required) toggleRequired(cfg.id); }}
                        className={cn(
                          "rounded-md px-3 py-1 text-[11px] font-medium transition-all",
                          cfg.required
                            ? "bg-[#B48B40] text-black"
                            : "text-white/32 hover:text-white/60"
                        )}
                      >
                        Required
                      </button>
                      <button
                        onClick={() => { if (cfg.required) toggleRequired(cfg.id); }}
                        className={cn(
                          "rounded-md px-3 py-1 text-[11px] font-medium transition-all",
                          !cfg.required
                            ? "bg-white/10 text-white/65"
                            : "text-white/32 hover:text-white/60"
                        )}
                      >
                        Optional
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Guidance / warning */}
        <div className="px-6 pb-3">
          {warning ? (
            <div className="flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/[0.05] px-3.5 py-3">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400/70 mt-0.5 shrink-0" strokeWidth={1.5} />
              <p className="text-xs text-amber-400/80 leading-relaxed">{warning}</p>
            </div>
          ) : requiredCount < 2 ? (
            <p className="text-[11px] text-white/25 px-0.5 leading-relaxed">
              Tip: Setting at least 2 categories as required creates a more complete daily commitment.
            </p>
          ) : (
            <p className="text-[11px] text-white/22 px-0.5">
              {requiredCount} required · {activeCount - requiredCount} optional
              {6 - activeCount > 0 ? ` · ${6 - activeCount} inactive` : ""}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-3 border-t border-white/[0.06] flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="text-sm text-white/30 hover:text-white/55 transition-colors px-2"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="rounded-xl bg-[#B48B40] hover:bg-[#c99840] text-black text-sm font-semibold px-6 py-2.5 transition-colors"
          >
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SortableHabitRow ─────────────────────────────────────────────────────────

function SortableHabitRow({
  habit, completed, editMode, isRequired,
  onToggle, onToggleVisible, onRename,
}: {
  habit: Habit; completed: boolean; editMode: boolean; isRequired: boolean;
  onToggle: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onRename: (id: string, label: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: habit.id, disabled: !editMode });

  const [editing, setEditing] = useState(false);
  const [draft,   setDraft  ] = useState(habit.label);
  const cfg = CATEGORY_CONFIG[habit.category];

  function confirmRename() {
    if (draft.trim()) onRename(habit.id, draft.trim());
    setEditing(false);
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all duration-150",
        isDragging
          ? "border-white/15 bg-[#1A1A1A] shadow-lg shadow-black/40 z-50"
          : editMode ? "border-white/6 bg-white/[0.015]" : "border-transparent bg-transparent",
        !habit.visible && editMode && "opacity-40"
      )}
    >
      {editMode && (
        <button {...attributes} {...listeners}
          className="text-white/18 hover:text-white/40 transition-colors cursor-grab active:cursor-grabbing shrink-0"
        >
          <GripVertical className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>
      )}

      {!editMode ? (
        <button
          onClick={() => onToggle(habit.id)}
          className={cn(
            "w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all duration-150",
            completed ? `border-transparent ${cfg.bar} text-black` : "border-white/15 hover:border-white/30"
          )}
        >
          {completed && <Check className="w-3 h-3" strokeWidth={2.5} />}
        </button>
      ) : (
        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", cfg.dot)} />
      )}

      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmRename();
              if (e.key === "Escape") setEditing(false);
            }}
            className="w-full bg-transparent border-b border-[#B48B40]/40 text-sm text-white/80 outline-none pb-0.5"
          />
        ) : (
          <span className={cn(
            "text-sm truncate",
            completed && !editMode ? "text-white/30 line-through" : "text-white/70"
          )}>
            {habit.label}
          </span>
        )}
      </div>

      {/* KEY badge: weight-3 habit in a required category, not yet done */}
      {!editMode && habit.weight === 3 && isRequired && !completed && (
        <span className="text-[9px] text-[#B48B40]/55 shrink-0 uppercase tracking-[0.1em]">key</span>
      )}
      {!editMode && habit.hint && !(habit.weight === 3 && isRequired && !completed) && (
        <span className="text-[10px] text-white/18 shrink-0">{habit.hint}</span>
      )}

      {editMode && (
        <div className="flex items-center gap-1.5 shrink-0">
          {editing ? (
            <>
              <button onClick={confirmRename} className="text-emerald-400/70 hover:text-emerald-400 transition-colors">
                <Check className="w-3.5 h-3.5" strokeWidth={2} />
              </button>
              <button onClick={() => setEditing(false)} className="text-white/25 hover:text-white/50 transition-colors">
                <X className="w-3.5 h-3.5" strokeWidth={2} />
              </button>
            </>
          ) : (
            <button
              onClick={() => { setDraft(habit.label); setEditing(true); }}
              className="text-white/18 hover:text-white/45 transition-colors"
            >
              <Pencil className="w-3 h-3" strokeWidth={1.5} />
            </button>
          )}
          <button onClick={() => onToggleVisible(habit.id)} className="text-white/22 hover:text-white/55 transition-colors">
            {habit.visible
              ? <Eye    className="w-3.5 h-3.5" strokeWidth={1.5} />
              : <EyeOff className="w-3.5 h-3.5" strokeWidth={1.5} />}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Category group ───────────────────────────────────────────────────────────

function CategoryGroup({
  category, habits, completedIds, editMode, isRequired,
  onToggle, onToggleVisible, onRename, onReorder,
}: {
  category: HabitCategory; habits: Habit[]; completedIds: string[];
  editMode: boolean; isRequired: boolean;
  onToggle:        (id: string) => void;
  onToggleVisible: (id: string) => void;
  onRename:        (id: string, label: string) => void;
  onReorder:       (cat: HabitCategory, old: number, nw: number) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const cfg       = CATEGORY_CONFIG[category];
  const visible   = editMode ? habits : habits.filter((h) => h.visible);
  const doneCount = habits.filter((h) => h.visible && completedIds.includes(h.id)).length;
  const total     = habits.filter((h) => h.visible).length;

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids  = habits.map((h) => h.id);
    const oldI = ids.indexOf(active.id as string);
    const newI = ids.indexOf(over.id as string);
    if (oldI !== -1 && newI !== -1) onReorder(category, oldI, newI);
  }

  if (!visible.length) return null;

  const allDone = total > 0 && doneCount === total;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between px-1 mb-2">
        <div className="flex items-center gap-2">
          <span className={cn("text-[10px] font-semibold uppercase tracking-[0.18em]", cfg.color)}>
            {cfg.label}
          </span>
          {isRequired && !editMode && (
            <span className="text-[9px] uppercase tracking-[0.1em] text-white/20 border border-white/10 rounded px-1 py-px">
              required
            </span>
          )}
          {!editMode && total > 0 && (
            <span className={cn("text-[10px]", allDone ? "text-white/40" : "text-white/20")}>
              {doneCount}/{total}
            </span>
          )}
        </div>
        {!editMode && total > 0 && (
          <div className="flex gap-0.5">
            {habits.filter((h) => h.visible).map((h) => (
              <span
                key={h.id}
                className={cn(
                  "w-1.5 h-1.5 rounded-full transition-all duration-200",
                  completedIds.includes(h.id) ? cfg.dot : "bg-white/10"
                )}
              />
            ))}
          </div>
        )}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={habits.map((h) => h.id)} strategy={verticalListSortingStrategy}>
          {visible.map((h) => (
            <SortableHabitRow
              key={h.id}
              habit={h}
              completed={completedIds.includes(h.id)}
              editMode={editMode}
              isRequired={isRequired}
              onToggle={onToggle}
              onToggleVisible={onToggleVisible}
              onRename={onRename}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AccountabilityPage() {
  const { user } = useUser();

  const [habits,      setHabits     ] = useLocalStorage<Habit[]             >("accountability-habits-v2",       DEFAULT_HABITS);
  const [logs,        setLogs       ] = useLocalStorage<Logs                >("accountability-logs",             {});
  const [journal,     setJournal    ] = useLocalStorage<JournalEntry[]      >("accountability-journal",          []);
  const [focusConfig, setFocusConfig] = useLocalStorage<FocusCategoryConfig[]>("accountability-focus-config",   DEFAULT_FOCUS_CONFIG);

  const [editMode,      setEditMode     ] = useState(false);
  const [showHistory,   setShowHistory  ] = useState(false);
  const [showFocusModal,setShowFocusModal] = useState(false);
  const [journalDraft,  setJournalDraft ] = useState("");
  const [lockInSaved,   setLockInSaved  ] = useState(false);

  const today    = todayKey();
  const todayLog: DailyLog = logs[today] ?? BLANK_LOG;
  const quote    = useMemo(() => getDailyQuote(), []);

  // Derived category lists from focus config
  const activeCats   = useMemo(
    () => (focusConfig ?? DEFAULT_FOCUS_CONFIG).filter((c) => c.active).map((c) => c.id),
    [focusConfig]
  );
  const requiredCats = useMemo(
    () => (focusConfig ?? DEFAULT_FOCUS_CONFIG).filter((c) => c.active && c.required).map((c) => c.id),
    [focusConfig]
  );

  const streaks  = useMemo(() => computeStreaks(habits, logs, activeCats), [habits, logs, activeCats]);
  const score    = computeScore(habits, todayLog.completedHabits, activeCats);
  const grade    = scoreGrade(score);
  const stats7   = useMemo(() => compute7DayStats(habits, logs, activeCats), [habits, logs, activeCats]);
  const recovery = useMemo(() => getRecoveryPanel(habits, logs, activeCats), [habits, logs, activeCats]);

  // Key habits: weight-3, visible, in a required active category
  const keyHabits    = habits.filter((h) => h.visible && h.weight === 3 && requiredCats.includes(h.category));
  const keyDone      = keyHabits.length > 0 && keyHabits.every((h) => todayLog.completedHabits.includes(h.id));
  const keyRemaining = keyHabits.filter((h) => !todayLog.completedHabits.includes(h.id)).length;

  // ── Log helpers ──────────────────────────────────────────────────────────────

  function updateLog(updates: Partial<DailyLog>) {
    setLogs((prev) => ({ ...prev, [today]: { ...(prev[today] ?? BLANK_LOG), ...updates } }));
  }

  function toggleHabit(id: string) {
    const next = todayLog.completedHabits.includes(id)
      ? todayLog.completedHabits.filter((x) => x !== id)
      : [...todayLog.completedHabits, id];
    updateLog({ completedHabits: next });
  }

  // ── Supabase hydration on mount ──────────────────────────────────────────────

  useEffect(() => {
    if (!isRealUser(user.id)) return;
    // Only hydrate if localStorage has no data for today — avoids overwriting fresh interactions
    if (logs[today] && logs[today].completedHabits.length > 0) return;
    import("@/lib/db/dailyCheckins").then(({ getDailyCheckin }) => {
      getDailyCheckin(user.id, today).then((row) => {
        if (!row) return;
        setLogs((prev) => ({
          ...prev,
          [today]: {
            ...(prev[today] ?? BLANK_LOG),
            completedHabits: row.completed_habits,
            identityState:   row.identity_state as IdentityState ?? null,
            energyNote:      row.energy_note ?? "",
          },
        }));
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  // ── Save daily check-in to Supabase ─────────────────────────────────────────

  async function saveLockIn() {
    if (!isRealUser(user.id)) return;
    const { upsertDailyCheckin } = await import("@/lib/db/dailyCheckins");
    await upsertDailyCheckin(user.id, today, {
      completed_habits: todayLog.completedHabits,
      identity_state:   todayLog.identityState,
      energy_note:      todayLog.energyNote,
      key_done:         keyDone,
      score,
    });
    setLockInSaved(true);
    setTimeout(() => setLockInSaved(false), 2500);
  }

  function saveJournal() {
    const text = journalDraft.trim();
    if (!text) return;
    const entry: JournalEntry = {
      date: today, text, score,
      identityState: todayLog.identityState,
      savedAt: new Date().toISOString(),
    };
    setJournal((prev) => [entry, ...prev.filter((e) => e.date !== today)]);
    updateLog({ journalEntry: text, journalSaved: true });
    setJournalDraft("");
  }

  // ── Habit mutations ──────────────────────────────────────────────────────────

  function toggleVisible(id: string) {
    setHabits((prev) => prev.map((h) => h.id === id ? { ...h, visible: !h.visible } : h));
  }
  function renameHabit(id: string, label: string) {
    setHabits((prev) => prev.map((h) => h.id === id ? { ...h, label } : h));
  }
  function reorderCategory(cat: HabitCategory, oldI: number, newI: number) {
    setHabits((prev) => {
      const catHabits = prev.filter((h) => h.category === cat);
      const reordered = arrayMove(catHabits, oldI, newI);
      let idx = 0;
      return prev.map((h) => h.category !== cat ? h : reordered[idx++]);
    });
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="px-5 md:px-8 py-6 max-w-2xl mx-auto text-white space-y-7">

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-white/22 mb-2">Daily execution</p>
          <h1 className="text-2xl font-semibold tracking-tight">Accountability</h1>
          <p className="text-sm text-white/30 mt-1">{formatDate()}</p>
        </div>
        <div className="text-right shrink-0 pt-1">
          <div className="flex items-baseline gap-1 justify-end">
            <span className="text-3xl font-semibold tabular-nums text-white/90">{score}</span>
            <span className="text-sm text-white/25">/100</span>
          </div>
          <span className={cn("text-[11px] font-medium", grade.color)}>{grade.label}</span>
        </div>
      </div>

      {/* Score bar */}
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden -mt-4">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700",
            score >= 75 ? "bg-[#B48B40]" : score >= 50 ? "bg-white/30" : "bg-white/12"
          )}
          style={{ width: `${score}%` }}
        />
      </div>

      {/* ── Quote ────────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/6 bg-white/[0.015] px-5 py-4">
        <p className="text-sm text-white/50 leading-relaxed italic">&ldquo;{quote.text}&rdquo;</p>
        {quote.author && <p className="text-[11px] text-white/20 mt-2">— {quote.author}</p>}
      </div>

      {/* ── Recovery panel ───────────────────────────────────────────────────── */}
      {recovery && (
        <div className="rounded-2xl border border-red-400/15 bg-red-400/[0.03] overflow-hidden">
          <div className="px-5 py-4 border-b border-red-400/10">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400/60" strokeWidth={1.5} />
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-red-400/60">
                Yesterday — {recovery.score}%
              </span>
            </div>
            <p className="text-sm font-medium text-white/65">Correction needed</p>
          </div>
          <div className="px-5 py-4 space-y-3.5">
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] text-white/22 mb-1">What likely went wrong</p>
              <p className="text-xs text-white/50 leading-relaxed">{recovery.likelyWrong}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] text-white/22 mb-1">What to change</p>
              <p className="text-xs text-white/50 leading-relaxed">{recovery.shouldChange}</p>
            </div>
            <div className="flex items-start gap-2.5 rounded-xl border border-white/6 bg-white/[0.025] px-3.5 py-3">
              <ArrowRight className="w-3.5 h-3.5 text-[#B48B40]/70 mt-0.5 shrink-0" strokeWidth={1.5} />
              <p className="text-xs text-white/65 leading-relaxed">{recovery.nextAction}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── 7-Day analytics ──────────────────────────────────────────────────── */}
      {stats7.hasData && (
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/22 mb-3">Last 7 days</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              {
                label: "Days won",
                value: `${stats7.won}/7`,
                sub:   `${Math.round((stats7.won / 7) * 100)}% of the week`,
                color: stats7.won >= 5 ? "text-emerald-400" : stats7.won >= 3 ? "text-[#B48B40]" : "text-[#F87171]/70",
              },
              {
                label: "Avg score",
                value: `${stats7.avg}`,
                sub:   scoreGrade(stats7.avg).label,
                color: scoreGrade(stats7.avg).color,
              },
              {
                label: "Strongest",
                value: CATEGORY_CONFIG[stats7.strongest.cat].label,
                sub:   `${stats7.strongest.pct}% completion`,
                color: CATEGORY_CONFIG[stats7.strongest.cat].color,
              },
              {
                label: "Needs work",
                value: CATEGORY_CONFIG[stats7.weakest.cat].label,
                sub:   `${stats7.weakest.pct}% completion`,
                color: "text-white/45",
              },
            ].map(({ label, value, sub, color }) => (
              <div key={label} className="rounded-xl border border-white/6 bg-white/[0.02] px-4 py-3.5">
                <p className="text-[9px] uppercase tracking-[0.14em] text-white/22 mb-1.5">{label}</p>
                <p className={cn("text-xl font-semibold tabular-nums leading-none", color)}>{value}</p>
                <p className="text-[10px] text-white/22 mt-1">{sub}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Trajectory chart ─────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/22">Trajectory</p>
          <span className="text-[10px] text-white/18">30-day · goal 80</span>
        </div>
        <div className="rounded-2xl border border-white/6 bg-white/[0.015] px-4 pt-4 pb-2">
          <TrajectoryChart habits={habits} logs={logs} activeCats={activeCats} />
        </div>
      </div>

      {/* ── Streaks ──────────────────────────────────────────────────────────── */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.18em] text-white/22 mb-3">Streaks</p>
        <div className="flex gap-2">
          {[
            { label: "Training",    count: streaks.training,    color: "text-[#B48B40]",   dot: "bg-[#B48B40]"   },
            { label: "Movement",    count: streaks.movement,    color: "text-emerald-400", dot: "bg-emerald-400" },
            { label: "Consistency", count: streaks.consistency, color: "text-[#93C5FD]",   dot: "bg-[#93C5FD]"   },
          ].map(({ label, count, color }) => (
            <div key={label} className="flex-1 rounded-xl border border-white/6 bg-white/[0.02] px-3.5 py-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Flame className={cn("w-3 h-3 shrink-0", color)} strokeWidth={1.5} />
                <span className="text-[10px] uppercase tracking-[0.14em] text-white/25 truncate">{label}</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className={cn("text-2xl font-semibold tabular-nums leading-none", count > 0 ? color : "text-white/15")}>
                  {count}
                </span>
                <span className="text-[10px] text-white/20">d</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Activity heatmap ─────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/22">Activity</p>
          <span className="text-[10px] text-white/18">Past 12 months</span>
        </div>
        <div className="rounded-2xl border border-white/6 bg-white/[0.015] px-4 pt-4 pb-3">
          <ActivityHeatmap habits={habits} logs={logs} activeCats={activeCats} />
        </div>
      </div>

      {/* ── Execution tracker ────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/22">Execution</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFocusModal(true)}
              className="flex items-center gap-1.5 text-xs text-white/28 hover:text-white/55 px-2 py-1 rounded-lg border border-transparent hover:border-white/8 transition-all"
            >
              <SlidersHorizontal className="w-3 h-3" strokeWidth={1.5} />
              <span>Edit Focus</span>
            </button>
            <button
              onClick={() => setEditMode((v) => !v)}
              className={cn(
                "text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors",
                editMode
                  ? "text-[#B48B40] bg-[#B48B40]/8 border-[#B48B40]/20"
                  : "text-white/30 hover:text-white/55 border-transparent"
              )}
            >
              {editMode ? "Done" : "Edit"}
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {activeCats.map((cat) => (
            <CategoryGroup
              key={cat}
              category={cat}
              habits={habits.filter((h) => h.category === cat)}
              completedIds={todayLog.completedHabits}
              editMode={editMode}
              isRequired={requiredCats.includes(cat)}
              onToggle={toggleHabit}
              onToggleVisible={toggleVisible}
              onRename={renameHabit}
              onReorder={reorderCategory}
            />
          ))}
        </div>
      </div>

      {/* ── Journal / reflection ─────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/22">Reflection</p>
          {journal.length > 0 && (
            <button
              onClick={() => setShowHistory((v) => !v)}
              className="flex items-center gap-1 text-[10px] text-white/22 hover:text-white/45 transition-colors"
            >
              <BookOpen className="w-3 h-3" strokeWidth={1.5} />
              <span>{showHistory ? "Hide" : "History"}</span>
              {showHistory
                ? <ChevronUp   className="w-3 h-3" strokeWidth={1.5} />
                : <ChevronDown className="w-3 h-3" strokeWidth={1.5} />}
            </button>
          )}
        </div>

        {todayLog.journalSaved && !journalDraft ? (
          <div className="rounded-xl border border-white/6 bg-white/[0.015] px-4 py-3 mb-2">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm text-white/55 leading-relaxed">{todayLog.journalEntry}</p>
              <button
                onClick={() => setJournalDraft(todayLog.journalEntry)}
                className="text-[10px] text-white/20 hover:text-white/45 transition-colors shrink-0"
              >
                Edit
              </button>
            </div>
            <p className="text-[10px] text-white/18 mt-2">Saved · visible to your AI coach</p>
          </div>
        ) : (
          <div className="space-y-2">
            <textarea
              rows={3}
              value={journalDraft || todayLog.journalEntry}
              onChange={(e) => setJournalDraft(e.target.value)}
              placeholder="What happened today? What's on your mind? Be specific — this feeds your AI coach."
              className="w-full bg-white/[0.02] border border-white/6 rounded-xl px-4 py-3 text-sm text-white/65 placeholder:text-white/18 outline-none focus:border-white/15 transition-colors resize-none leading-relaxed"
            />
            <button
              onClick={saveJournal}
              disabled={!journalDraft.trim()}
              className={cn(
                "text-xs font-medium px-3.5 py-2 rounded-xl border transition-all",
                journalDraft.trim()
                  ? "text-[#B48B40]/80 border-[#B48B40]/20 bg-[#B48B40]/5 hover:bg-[#B48B40]/10 hover:text-[#B48B40]"
                  : "text-white/20 border-white/6 cursor-default"
              )}
            >
              Save entry
            </button>
          </div>
        )}

        {showHistory && journal.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-[10px] text-white/18 mb-3">
              {journal.length} entr{journal.length === 1 ? "y" : "ies"} · accessible by AI coach
            </p>
            {journal.slice(0, 14).map((entry) => {
              const g = scoreGrade(entry.score);
              const dateLabel = new Date(entry.date + "T00:00:00").toLocaleDateString("en-US", {
                weekday: "short", month: "short", day: "numeric",
              });
              return (
                <div key={entry.date} className="rounded-xl border border-white/[0.05] bg-white/[0.012] px-4 py-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] text-white/30">{dateLabel}</span>
                    <span className="text-white/10">·</span>
                    <span className={cn("text-[10px] font-medium tabular-nums", g.color)}>{entry.score}</span>
                    {entry.identityState && (
                      <>
                        <span className="text-white/10">·</span>
                        <span className="text-[10px] text-white/25 capitalize">{entry.identityState}</span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-white/45 leading-relaxed line-clamp-3">{entry.text}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Identity / end-of-day reflection ─────────────────────────────────── */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.18em] text-white/22 mb-3">State</p>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {IDENTITY_OPTIONS.map((opt) => {
            const sel = todayLog.identityState === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => updateLog({ identityState: sel ? null : opt.value })}
                className={cn(
                  "rounded-xl border px-3.5 py-3 text-left transition-all duration-150",
                  sel ? `${opt.border} ${opt.bg}` : "border-white/6 bg-white/[0.015] hover:border-white/12"
                )}
              >
                <p className={cn("text-sm font-medium", sel ? opt.text : "text-white/50")}>{opt.label}</p>
                <p className="text-[11px] text-white/22 mt-0.5 leading-snug">{opt.sub}</p>
              </button>
            );
          })}
        </div>
        <input
          value={todayLog.energyNote}
          onChange={(e) => updateLog({ energyNote: e.target.value })}
          placeholder="How did today go? Where's your head tonight?"
          className="w-full bg-white/[0.02] border border-white/6 rounded-xl px-4 py-2.5 text-sm text-white/65 placeholder:text-white/18 outline-none focus:border-white/15 transition-colors"
        />
      </div>

      {/* ── Day outcome button ────────────────────────────────────────────────── */}
      <div className="pb-4">
        <button
          onClick={keyDone ? saveLockIn : undefined}
          className={cn(
            "w-full py-4 rounded-2xl text-sm font-semibold tracking-wide transition-all duration-300",
            keyHabits.length === 0
              ? "bg-white/5 text-white/25 border border-white/8 cursor-default"
              : keyDone
                ? lockInSaved
                  ? "bg-emerald-400 text-white shadow-lg shadow-emerald-900/30"
                  : "bg-emerald-500/90 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30"
                : "bg-[#EF4444]/80 hover:bg-[#EF4444]/90 text-white shadow-lg shadow-red-900/30"
          )}
        >
          {keyHabits.length === 0
            ? "No key tasks configured"
            : keyDone
              ? lockInSaved ? "Saved ✓" : "Day locked in — all required tasks complete"
              : `${keyRemaining} required task${keyRemaining !== 1 ? "s" : ""} remaining`}
        </button>
        {!keyDone && keyHabits.length > 0 && (
          <p className="text-[10px] text-white/18 text-center mt-2">
            {keyHabits.filter((h) => !todayLog.completedHabits.includes(h.id)).map((h) => h.label).join(" · ")}
          </p>
        )}
      </div>

      {/* ── Focus modal ──────────────────────────────────────────────────────── */}
      {showFocusModal && (
        <FocusModal
          focusConfig={focusConfig ?? DEFAULT_FOCUS_CONFIG}
          onUpdate={setFocusConfig}
          onClose={() => setShowFocusModal(false)}
        />
      )}

    </div>
  );
}
