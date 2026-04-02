"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  ChevronDown,
  ChevronUp,
  Timer,
  X,
  CheckCircle2,
  Sparkles,
  Wrench,
  Users,
  Target,
  Zap,
  AlertCircle,
  StickyNote,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Minus,
  Plus,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/context/UserContext";
import { hasAccess } from "@/lib/roles";

// ─── Types ────────────────────────────────────────────────────────────────────

type Feel = "easy" | "good" | "hard" | null;

type SetLog = {
  weight: string;
  reps: string;
  feel: Feel;
  done: boolean;
};

type ExerciseLog = {
  exerciseId: string;
  exerciseName: string; // tracks swaps
  setLogs: SetLog[];
  note: string;
};

// Keyed by exerciseId
type WorkoutLogs = Record<string, ExerciseLog>;

type Exercise = {
  id: string;
  name: string;
  sets: number;
  reps: string;
  weight: string;
  tempo?: string;
  rest: string;
  rpeTarget?: number;
  adapted?: boolean;
  cue?: string;
  section: string;
};

type PostFeedback = {
  difficulty: number;
  energy: number;
  pain: boolean;
  painNote: string;
  workoutRating: "too_easy" | "just_right" | "too_hard" | null;
  reflection: string;
};

// ─── AI-ready workout log shape ───────────────────────────────────────────────
// This is what gets written to storage. Structure is intentionally future-proof
// so the AI pipeline can consume it without schema changes.

type WorkoutLogEntry = {
  id: string;
  userId: string;
  programId: string;    // "prog_upper_pull" — real ID once backend exists
  workoutId: string;    // "wod_upper_pull_w3"
  date: string;         // "2026-04-02"
  loggedAt: string;     // ISO timestamp
  session: string;      // display name
  sessionNote: string;
  feedback: PostFeedback;
  exercises: {
    exerciseId: string;
    exerciseName: string;
    sets: SetLog[];
    completed: boolean;
    note: string;
  }[];
};

// ─── Session config ───────────────────────────────────────────────────────────

const SESSION = {
  name: "Upper Body · Pull",
  phase: "Phase 1",
  week: 3,
  totalWeeks: 8,
  day: "Wednesday",
  duration: "~45 min",
  goal: "Build lat width and rear delt thickness through controlled, high-quality pulling.",
  coachNotes: [
    "Prioritise scapular control — initiate every pull by depressing your shoulder blades before your arms take over.",
    "If the lat pulldown feels heavy today, drop 5 kg and focus on full range of motion over load.",
    "Seated row is adapted for your shoulder — keep it completely pain-free. Stop the set if anything feels off.",
  ],
};

const SECTIONS = ["Warm-up", "Main Work", "Accessory"];

const EXERCISES: Exercise[] = [
  {
    id: "e0",
    name: "Dead Hang",
    sets: 2,
    reps: "30s",
    weight: "BW",
    rest: "60s",
    rpeTarget: 4,
    section: "Warm-up",
    cue: "Full lat stretch — relax into the hang. Don't fight gravity.",
  },
  {
    id: "e1",
    name: "Lat Pulldown",
    sets: 4,
    reps: "8–10",
    weight: "60–65 kg",
    tempo: "3-1-1-0",
    rest: "90s",
    rpeTarget: 8,
    section: "Main Work",
    cue: "Drive elbows down to your pockets. Chest tall throughout the rep.",
  },
  {
    id: "e2",
    name: "Seated Cable Row",
    sets: 3,
    reps: "10–12",
    weight: "50 kg",
    tempo: "2-1-2-0",
    rest: "90s",
    rpeTarget: 7,
    section: "Main Work",
    adapted: true,
    cue: "Pause and squeeze at the top. Don't let your shoulders shrug.",
  },
  {
    id: "e3",
    name: "Face Pull",
    sets: 3,
    reps: "15",
    weight: "Light",
    rest: "60s",
    rpeTarget: 6,
    section: "Accessory",
    cue: "Think 'hands to ears'. Rotate externally hard at the top position.",
  },
  {
    id: "e4",
    name: "Bicep Curl",
    sets: 3,
    reps: "12",
    weight: "20 kg",
    rest: "60s",
    rpeTarget: 7,
    section: "Accessory",
    cue: "Slow eccentric — 3 seconds down. No swinging at the top.",
  },
];

const SWAP_OPTIONS: Record<string, string[]> = {
  e0: ["Banded Lat Stretch", "Cat-Cow", "Thoracic Extension"],
  e1: ["Cable Pullover", "Band Pulldown", "Chest-Supported Row"],
  e2: ["Dumbbell Row", "T-Bar Row", "Meadows Row"],
  e3: ["Band Pull-Apart", "Rear Delt Fly", "Cable Face Pull"],
  e4: ["Hammer Curl", "Incline Curl", "Cable Curl"],
};

// ─── Storage keys ─────────────────────────────────────────────────────────────

const WIP_KEY  = "flowstate-workout-wip";   // in-progress workout (autosave)
const LOGS_KEY = "workout-logs";             // completed workout history

// ─── State initialiser ────────────────────────────────────────────────────────

function blankSetLog(): SetLog {
  return { weight: "", reps: "", feel: null, done: false };
}

function initWorkoutLogs(): WorkoutLogs {
  return Object.fromEntries(
    EXERCISES.map((ex) => [
      ex.id,
      {
        exerciseId: ex.id,
        exerciseName: ex.name,
        setLogs: Array.from({ length: ex.sets }, blankSetLog),
        note: "",
      },
    ])
  );
}

function loadWIP(): WorkoutLogs | null {
  try {
    const raw = localStorage.getItem(WIP_KEY);
    return raw ? (JSON.parse(raw) as WorkoutLogs) : null;
  } catch {
    return null;
  }
}

function saveWIP(logs: WorkoutLogs) {
  try {
    localStorage.setItem(WIP_KEY, JSON.stringify(logs));
  } catch { /* ignore */ }
}

function clearWIP() {
  try {
    localStorage.removeItem(WIP_KEY);
  } catch { /* ignore */ }
}

// ─── Rest Timer ───────────────────────────────────────────────────────────────

function RestTimer({ seconds, onClose }: { seconds: number; onClose: () => void }) {
  const [remaining, setRemaining] = useState(seconds);
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setRemaining(seconds);
    interval.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) { clearInterval(interval.current!); return 0; }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(interval.current!);
  }, [seconds]);

  const pct  = ((seconds - remaining) / seconds) * 100;
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const done = remaining === 0;

  return (
    <div className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-xs">
      <div className={cn(
        "rounded-2xl border px-6 py-4 flex items-center gap-5 shadow-2xl shadow-black/60 backdrop-blur-md",
        done ? "border-emerald-400/30 bg-[#0a0f0a]/95" : "border-[#B48B40]/25 bg-[#0e0d0b]/95"
      )}>
        <div className="relative w-12 h-12 shrink-0">
          <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15" fill="none" stroke="#1a1a1a" strokeWidth="2.5" />
            <circle
              cx="18" cy="18" r="15" fill="none"
              stroke={done ? "#4ade80" : "#B48B40"}
              strokeWidth="2.5"
              strokeDasharray={`${2 * Math.PI * 15}`}
              strokeDashoffset={`${2 * Math.PI * 15 * (1 - pct / 100)}`}
              strokeLinecap="round"
              className="transition-[stroke-dashoffset] duration-1000 ease-linear"
            />
          </svg>
          <Timer
            className={cn("absolute inset-0 m-auto w-4 h-4", done ? "text-emerald-400" : "text-[#B48B40]")}
            strokeWidth={1.5}
          />
        </div>
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/30 mb-0.5">Rest</p>
          <p className={cn("text-2xl font-semibold tabular-nums", done ? "text-emerald-400" : "text-white")}>
            {done
              ? "Go."
              : `${mins > 0 ? `${mins}:` : ""}${String(secs).padStart(mins > 0 ? 2 : 1, "0")}s`}
          </p>
        </div>
        <button onClick={onClose} className="text-white/25 hover:text-white/60 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Set row ──────────────────────────────────────────────────────────────────

function SetRow({
  setNum,
  log,
  targetWeight,
  targetReps,
  onChange,
  onRemove,
  canRemove,
}: {
  setNum: number;
  log: SetLog;
  targetWeight: string;
  targetReps: string;
  onChange: (log: SetLog) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  return (
    <div className={cn(
      "flex items-center gap-2 py-1.5 rounded-xl px-2 -mx-2 group/row transition-colors",
      log.done ? "bg-[#B48B40]/[0.06]" : "hover:bg-white/[0.015]"
    )}>
      {/* Set number */}
      <span className="text-[10px] text-white/20 font-medium w-4 shrink-0 text-center tabular-nums">
        {setNum}
      </span>

      {/* Weight */}
      <div className="flex-1 relative">
        <input
          type="text"
          inputMode="decimal"
          value={log.weight}
          onChange={(e) => onChange({ ...log, weight: e.target.value })}
          onFocus={(e) => e.target.select()}
          placeholder={targetWeight}
          className={cn(
            "w-full bg-white/[0.04] border rounded-lg px-2.5 py-2 text-sm text-center tabular-nums outline-none transition-all pr-6",
            log.done
              ? "border-[#B48B40]/20 text-[#B48B40] placeholder:text-[#B48B40]/30"
              : "border-white/8 text-white/75 placeholder:text-white/18 focus:border-white/20 focus:bg-white/[0.06]"
          )}
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] text-white/18 pointer-events-none">
          kg
        </span>
      </div>

      {/* Reps */}
      <div className="flex-1 relative">
        <input
          type="text"
          inputMode="numeric"
          value={log.reps}
          onChange={(e) => onChange({ ...log, reps: e.target.value })}
          onFocus={(e) => e.target.select()}
          placeholder={targetReps.split("–")[0] ?? targetReps}
          className={cn(
            "w-full bg-white/[0.04] border rounded-lg px-2.5 py-2 text-sm text-center tabular-nums outline-none transition-all pr-8",
            log.done
              ? "border-[#B48B40]/20 text-[#B48B40] placeholder:text-[#B48B40]/30"
              : "border-white/8 text-white/75 placeholder:text-white/18 focus:border-white/20 focus:bg-white/[0.06]"
          )}
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] text-white/18 pointer-events-none">
          reps
        </span>
      </div>

      {/* Feel */}
      <div className="flex items-center gap-1 shrink-0">
        {(["easy", "good", "hard"] as const).map((f) => (
          <button
            key={f}
            onClick={() => onChange({ ...log, feel: log.feel === f ? null : f })}
            title={f.charAt(0).toUpperCase() + f.slice(1)}
            className={cn(
              "w-5 h-5 rounded-full border transition-all text-[8px] font-bold flex items-center justify-center",
              log.feel === f
                ? f === "easy" ? "bg-sky-400/20 border-sky-400/40 text-sky-400"
                : f === "good" ? "bg-emerald-400/20 border-emerald-400/35 text-emerald-400"
                :               "bg-[#F87171]/20 border-[#F87171]/35 text-[#F87171]"
                : "border-white/10 text-white/18 hover:border-white/25 hover:text-white/35"
            )}
          >
            {f[0].toUpperCase()}
          </button>
        ))}
      </div>

      {/* Done */}
      <button
        onClick={() => onChange({ ...log, done: !log.done })}
        className={cn(
          "shrink-0 w-6 h-6 rounded-full border flex items-center justify-center transition-all",
          log.done
            ? "bg-[#B48B40] border-[#B48B40] text-black"
            : "border-white/15 hover:border-white/35"
        )}
      >
        {log.done && (
          <svg viewBox="0 0 10 8" className="w-2.5 h-2.5" fill="none">
            <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Remove (only shown on hover when canRemove) */}
      {canRemove && (
        <button
          onClick={onRemove}
          className="shrink-0 opacity-0 group-hover/row:opacity-100 transition-opacity text-white/18 hover:text-[#F87171]/60 ml-0.5"
          title="Remove set"
        >
          <Trash2 className="w-3 h-3" strokeWidth={1.5} />
        </button>
      )}
    </div>
  );
}

// ─── Exercise Card ────────────────────────────────────────────────────────────

function ExerciseCard({
  exercise,
  globalIndex,
  log,
  onLogsChange,
  onStartRest,
}: {
  exercise: Exercise;
  globalIndex: number;
  log: ExerciseLog;
  onLogsChange: (updated: ExerciseLog) => void;
  onStartRest: (secs: number) => void;
}) {
  const [swapOpen, setSwapOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);

  const setLogs      = log.setLogs;
  const note         = log.note;
  const currentName  = log.exerciseName;
  const restSecs     = parseInt(exercise.rest) || 60;
  const completedSets = setLogs.filter((s) => s.done).length;
  const allDone      = completedSets === setLogs.length && setLogs.length > 0;

  const rpeColorClass =
    !exercise.rpeTarget ? "text-white/60"
    : exercise.rpeTarget >= 9 ? "text-[#F87171]"
    : exercise.rpeTarget >= 7 ? "text-[#B48B40]"
    : "text-emerald-400";

  function updateSet(i: number, updated: SetLog) {
    const next = [...setLogs];
    next[i] = updated;
    onLogsChange({ ...log, setLogs: next });
  }

  function addSet() {
    onLogsChange({ ...log, setLogs: [...setLogs, blankSetLog()] });
  }

  function removeSet(i: number) {
    if (setLogs.length <= 1) return;
    const next = setLogs.filter((_, idx) => idx !== i);
    onLogsChange({ ...log, setLogs: next });
  }

  function swapExercise(name: string) {
    onLogsChange({ ...log, exerciseName: name });
    setSwapOpen(false);
  }

  return (
    <div className={cn(
      "rounded-2xl border overflow-hidden transition-all duration-300",
      allDone ? "border-[#B48B40]/18 bg-[#0f0e0c]" : "border-white/7 bg-[#111111]"
    )}>
      {/* ── Header ── */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-start justify-between gap-3 mb-3.5">
          <div className="flex items-start gap-3 min-w-0">
            <span className="text-[10px] text-white/18 font-medium mt-0.5 w-5 shrink-0 tabular-nums">
              {String(globalIndex + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className={cn(
                  "font-semibold text-base leading-snug",
                  allDone ? "text-white/35 line-through decoration-white/15" : "text-white/90"
                )}>
                  {currentName}
                </h3>
                {exercise.adapted && (
                  <span className="text-[9px] font-medium tracking-[0.08em] uppercase px-1.5 py-0.5 rounded-md bg-[#B48B40]/10 text-[#B48B40] border border-[#B48B40]/20 shrink-0">
                    Adapted
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Progress */}
          <div className="shrink-0">
            {allDone ? (
              <div className="flex items-center gap-1.5 text-[#B48B40]">
                <CheckCircle2 className="w-4 h-4" strokeWidth={1.5} />
                <span className="text-xs font-medium">Done</span>
              </div>
            ) : (
              <span className="text-xs text-white/25 tabular-nums">
                {completedSets}/{setLogs.length}
              </span>
            )}
          </div>
        </div>

        {/* Stats chips */}
        <div className="flex items-center gap-1.5 flex-wrap mb-3.5">
          {[
            { label: "Target", value: `${exercise.sets} × ${exercise.reps}` },
            { label: "Load",   value: exercise.weight },
            { label: "Rest",   value: exercise.rest },
            ...(exercise.tempo ? [{ label: "Tempo", value: exercise.tempo }] : []),
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg border border-white/6 bg-white/[0.025] px-2.5 py-1 flex items-center gap-1.5"
            >
              <span className="text-[9px] uppercase tracking-[0.1em] text-white/20">{stat.label}</span>
              <span className="text-[11px] font-medium text-white/70 tabular-nums">{stat.value}</span>
            </div>
          ))}
          {exercise.rpeTarget !== undefined && (
            <div className="rounded-lg border border-white/6 bg-white/[0.025] px-2.5 py-1 flex items-center gap-1.5">
              <span className="text-[9px] uppercase tracking-[0.1em] text-white/20">RPE</span>
              <span className={cn("text-[11px] font-semibold tabular-nums", rpeColorClass)}>
                {exercise.rpeTarget}
              </span>
            </div>
          )}
        </div>

        {/* Coaching cue */}
        {exercise.cue && (
          <div className="flex items-start gap-2.5">
            <div className="w-[2px] rounded-full bg-[#B48B40]/22 shrink-0 self-stretch min-h-[1rem]" />
            <p className="text-xs text-white/38 italic leading-relaxed">{exercise.cue}</p>
          </div>
        )}
      </div>

      {/* ── Set logging ── */}
      <div className="px-5 pb-3 border-t border-white/[0.04] pt-3">
        {/* Column headers */}
        <div className="flex items-center gap-2 mb-1.5 px-2">
          <span className="w-4 shrink-0" />
          <span className="flex-1 text-[9px] uppercase tracking-[0.12em] text-white/18 text-center">Weight</span>
          <span className="flex-1 text-[9px] uppercase tracking-[0.12em] text-white/18 text-center">Reps</span>
          <span className="w-[52px] shrink-0 text-[9px] uppercase tracking-[0.12em] text-white/18 text-center">Feel</span>
          <span className="w-6 shrink-0" />
        </div>

        {setLogs.map((sl, i) => (
          <SetRow
            key={i}
            setNum={i + 1}
            log={sl}
            targetWeight={exercise.weight}
            targetReps={exercise.reps}
            onChange={(updated) => updateSet(i, updated)}
            onRemove={() => removeSet(i)}
            canRemove={setLogs.length > 1}
          />
        ))}

        {/* Add set */}
        <button
          onClick={addSet}
          className="mt-2 flex items-center gap-1.5 text-[11px] text-white/22 hover:text-white/50 transition-colors px-2"
        >
          <Plus className="w-3 h-3" strokeWidth={2} />
          Add set
        </button>
      </div>

      {/* ── Action row ── */}
      <div className="px-5 pb-4 flex items-center gap-3 border-t border-white/[0.04] pt-3">
        <button
          onClick={() => onStartRest(restSecs)}
          className="flex items-center gap-1.5 text-xs text-white/28 hover:text-white/60 transition-colors"
        >
          <Timer className="w-3.5 h-3.5" strokeWidth={1.5} />
          Rest {exercise.rest}
        </button>

        <button
          onClick={() => { setSwapOpen((v) => !v); setNoteOpen(false); }}
          className="flex items-center gap-1.5 text-xs text-white/28 hover:text-white/60 transition-colors"
        >
          <ArrowLeftRight className="w-3.5 h-3.5" strokeWidth={1.5} />
          Swap
        </button>

        <button
          onClick={() => { setNoteOpen((v) => !v); setSwapOpen(false); }}
          className="flex items-center gap-1.5 text-xs text-white/28 hover:text-white/60 transition-colors ml-auto"
        >
          <StickyNote className="w-3.5 h-3.5" strokeWidth={1.5} />
          {note ? "Note ·" : "Note"}
          {noteOpen
            ? <ChevronUp className="w-3 h-3" strokeWidth={1.5} />
            : <ChevronDown className="w-3 h-3" strokeWidth={1.5} />}
        </button>
      </div>

      {/* ── Swap panel ── */}
      {swapOpen && (
        <div className="border-t border-white/5 px-5 py-4 space-y-0.5">
          <p className="text-[10px] uppercase tracking-[0.15em] text-white/20 mb-3">Swap exercise</p>
          {SWAP_OPTIONS[exercise.id]?.map((opt) => (
            <button
              key={opt}
              onClick={() => swapExercise(opt)}
              className="w-full text-left text-sm text-white/50 hover:text-white/85 py-2 px-3 rounded-xl hover:bg-white/[0.04] transition-colors flex items-center justify-between group"
            >
              {opt}
              <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-white/35" strokeWidth={1.5} />
            </button>
          ))}
        </div>
      )}

      {/* ── Note panel ── */}
      {noteOpen && (
        <div className="border-t border-white/5 px-5 py-4">
          <p className="text-[10px] uppercase tracking-[0.15em] text-white/20 mb-3">Exercise note</p>
          <textarea
            value={note}
            onChange={(e) => onLogsChange({ ...log, note: e.target.value })}
            placeholder="Form cues, how it felt, anything relevant..."
            rows={2}
            className="w-full bg-transparent text-sm text-white/60 placeholder:text-white/18 resize-none outline-none border-b border-white/8 pb-2 focus:border-white/18 transition-colors leading-relaxed"
          />
        </div>
      )}
    </div>
  );
}

// ─── Post-workout modal ───────────────────────────────────────────────────────

function PostWorkoutModal({
  sessionName,
  onLog,
  onDismiss,
}: {
  sessionName: string;
  onLog: (feedback: PostFeedback) => void;
  onDismiss: () => void;
}) {
  const [feedback, setFeedback] = useState<PostFeedback>({
    difficulty: 0,
    energy: 0,
    pain: false,
    painNote: "",
    workoutRating: null,
    reflection: "",
  });

  const update = (partial: Partial<PostFeedback>) =>
    setFeedback((f) => ({ ...f, ...partial }));

  const canLog =
    feedback.difficulty > 0 && feedback.energy > 0 && feedback.workoutRating !== null;

  const DIFFICULTY_LABELS = ["", "Very Easy", "Easy", "Moderate", "Hard", "Max Effort"];
  const ENERGY_LABELS     = ["", "Depleted",  "Low",  "Okay",     "Good", "Energised"];

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center px-4 pb-4 md:pb-0">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onDismiss} />
      <div className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-[#0F0F0F] shadow-2xl shadow-black/70 overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-white/[0.06]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-4 h-4 text-[#B48B40]" strokeWidth={1.5} />
                <span className="text-[10px] uppercase tracking-[0.18em] text-[#B48B40]/65 font-medium">
                  Session complete
                </span>
              </div>
              <p className="text-base font-semibold text-white/88">{sessionName}</p>
            </div>
            <button onClick={onDismiss} className="text-white/20 hover:text-white/50 transition-colors shrink-0 mt-1">
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto max-h-[72vh]">

          {/* Difficulty */}
          <div className="px-6 py-4 border-b border-white/[0.06]">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/22">How hard was it?</p>
              {feedback.difficulty > 0 && (
                <span className="text-xs text-white/38">{DIFFICULTY_LABELS[feedback.difficulty]}</span>
              )}
            </div>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => update({ difficulty: n })}
                  className={cn(
                    "flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-all",
                    feedback.difficulty === n
                      ? n >= 4 ? "bg-[#F87171]/15 border-[#F87171]/30 text-[#F87171]"
                        : n === 3 ? "bg-[#B48B40]/15 border-[#B48B40]/30 text-[#B48B40]"
                        : "bg-emerald-400/12 border-emerald-400/25 text-emerald-400"
                      : "border-white/6 text-white/22 hover:border-white/15 hover:text-white/40"
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Energy */}
          <div className="px-6 py-4 border-b border-white/[0.06]">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/22">Energy levels</p>
              {feedback.energy > 0 && (
                <span className="text-xs text-white/38">{ENERGY_LABELS[feedback.energy]}</span>
              )}
            </div>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => update({ energy: n })}
                  className={cn(
                    "flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-all",
                    feedback.energy === n
                      ? n <= 2 ? "bg-[#F87171]/15 border-[#F87171]/30 text-[#F87171]"
                        : n === 3 ? "bg-[#B48B40]/15 border-[#B48B40]/30 text-[#B48B40]"
                        : "bg-emerald-400/12 border-emerald-400/25 text-emerald-400"
                      : "border-white/6 text-white/22 hover:border-white/15 hover:text-white/40"
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Workout rating */}
          <div className="px-6 py-4 border-b border-white/[0.06]">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/22 mb-3">Workout felt…</p>
            <div className="flex gap-2">
              {([
                { id: "too_easy",   label: "Too easy",   Icon: TrendingDown },
                { id: "just_right", label: "Just right",  Icon: Minus       },
                { id: "too_hard",   label: "Too hard",    Icon: TrendingUp  },
              ] as const).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => update({ workoutRating: id })}
                  className={cn(
                    "flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border text-[11px] font-medium transition-all",
                    feedback.workoutRating === id
                      ? id === "too_easy"   ? "border-sky-400/30 bg-sky-400/8 text-sky-400"
                        : id === "just_right" ? "border-emerald-400/30 bg-emerald-400/8 text-emerald-400"
                        :                       "border-[#F87171]/30 bg-[#F87171]/8 text-[#F87171]"
                      : "border-white/6 text-white/28 hover:border-white/15 hover:text-white/45"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Pain */}
          <div className="px-6 py-4 border-b border-white/[0.06]">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/22">Any pain or discomfort?</p>
              <button
                onClick={() => update({ pain: !feedback.pain, painNote: "" })}
                className={cn(
                  "flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all",
                  feedback.pain
                    ? "border-[#F87171]/30 bg-[#F87171]/8 text-[#F87171]"
                    : "border-white/8 text-white/28 hover:border-white/20"
                )}
              >
                {feedback.pain ? <><AlertCircle className="w-3 h-3" strokeWidth={1.5} /> Yes</> : "No"}
              </button>
            </div>
            {feedback.pain && (
              <input
                type="text"
                value={feedback.painNote}
                onChange={(e) => update({ painNote: e.target.value })}
                placeholder="Where and what kind? (optional)"
                className="mt-3 w-full bg-white/[0.03] border border-white/8 rounded-lg px-3 py-2 text-sm text-white/60 placeholder:text-white/18 outline-none focus:border-white/18 transition-colors"
              />
            )}
          </div>

          {/* Reflection */}
          <div className="px-6 py-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/22 mb-3">Quick reflection</p>
            <textarea
              value={feedback.reflection}
              onChange={(e) => update({ reflection: e.target.value })}
              placeholder="What went well? Anything to adjust next session..."
              rows={2}
              className="w-full bg-transparent text-sm text-white/60 placeholder:text-white/18 resize-none outline-none border-b border-white/8 pb-2 focus:border-white/18 transition-colors leading-relaxed"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-white/[0.06] flex items-center gap-3">
          <button onClick={onDismiss} className="text-sm text-white/22 hover:text-white/50 transition-colors">
            Skip
          </button>
          <button
            onClick={() => onLog(feedback)}
            disabled={!canLog}
            className={cn(
              "ml-auto rounded-xl px-5 py-2.5 text-sm font-semibold transition-all",
              canLog
                ? "bg-[#B48B40] hover:bg-[#c99840] text-black"
                : "bg-white/[0.05] text-white/20 cursor-not-allowed"
            )}
          >
            Log session
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProgramPage() {
  const { user } = useUser();
  const isCoach = hasAccess(user.role, "trainer");

  // ── Workout log state — owned at page level for full access on save ──────────
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLogs>(() => {
    // Always start from a fresh init so every exercise has a log entry.
    // Merge any saved WIP on top — WIP wins for exercises it covers,
    // but new/added exercises get blank logs rather than crashing.
    const fresh = initWorkoutLogs();
    try {
      const wip = loadWIP();
      if (wip) return { ...fresh, ...wip };
    } catch { /* ignore */ }
    return fresh;
  });

  const [sessionNote,     setSessionNote    ] = useState("");
  const [coachNotesOpen,  setCoachNotesOpen ] = useState(true);
  const [sessionNoteOpen, setSessionNoteOpen] = useState(false);
  const [restTimer,       setRestTimer      ] = useState<{ secs: number; key: number } | null>(null);
  const [showComplete,    setShowComplete   ] = useState(false);
  const [sessionLogged,   setSessionLogged  ] = useState(false);

  // ── Autosave in-progress workout ─────────────────────────────────────────────
  // Debounced so rapid typing doesn't hammer localStorage
  const wipSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (sessionLogged) return; // don't overwrite after completion
    if (wipSaveTimer.current) clearTimeout(wipSaveTimer.current);
    wipSaveTimer.current = setTimeout(() => saveWIP(workoutLogs), 400);
    return () => {
      if (wipSaveTimer.current) clearTimeout(wipSaveTimer.current);
    };
  }, [workoutLogs, sessionLogged]);

  // ── Update a single exercise log ─────────────────────────────────────────────
  const updateExerciseLog = useCallback(
    (exerciseId: string, updated: ExerciseLog) => {
      setWorkoutLogs((prev) => ({ ...prev, [exerciseId]: updated }));
    },
    []
  );

  // ── Save completed workout ────────────────────────────────────────────────────
  function handleLogSession(feedback: PostFeedback) {
    try {
      const entry: WorkoutLogEntry = {
        id:           `wl_${Date.now()}`,
        userId:       user.id,
        programId:    "prog_upper_pull",   // static for now; replace with real ID
        workoutId:    "wod_upper_pull_w3",
        date:         new Date().toISOString().slice(0, 10),
        loggedAt:     new Date().toISOString(),
        session:      SESSION.name,
        sessionNote,
        feedback,
        exercises: EXERCISES.map((ex) => {
          const log = workoutLogs[ex.id];
          return {
            exerciseId:   ex.id,
            exerciseName: log.exerciseName,
            sets:         log.setLogs,
            completed:    log.setLogs.length > 0 && log.setLogs.every((s) => s.done),
            note:         log.note,
          };
        }),
      };

      // Append to workout history
      const history = JSON.parse(localStorage.getItem(LOGS_KEY) ?? "[]");
      localStorage.setItem(LOGS_KEY, JSON.stringify([entry, ...history]));

      // Mark training habit complete in accountability tracker
      const today    = entry.date;
      const accLogs  = JSON.parse(localStorage.getItem("accountability-logs") ?? "{}");
      const todayLog = accLogs[today] ?? {
        completedHabits: [], identityState: null,
        energyNote: "", journalEntry: "", journalSaved: false,
      };
      if (!todayLog.completedHabits.includes("training")) {
        todayLog.completedHabits = [...todayLog.completedHabits, "training"];
        accLogs[today] = todayLog;
        localStorage.setItem("accountability-logs", JSON.stringify(accLogs));
      }

      clearWIP(); // discard in-progress snapshot
    } catch { /* ignore */ }

    setShowComplete(false);
    setSessionLogged(true);
  }

  // ── Precompute section groupings ─────────────────────────────────────────────
  const sectionData = SECTIONS.map((section) => ({
    section,
    exercises: EXERCISES.filter((e) => e.section === section),
  }));
  const sectionStartIndices: number[] = [];
  let idx = 0;
  for (const { exercises } of sectionData) {
    sectionStartIndices.push(idx);
    idx += exercises.length;
  }

  // ── Summary stats ─────────────────────────────────────────────────────────────
  const totalExercises   = EXERCISES.length;
  const completedExercises = EXERCISES.filter((ex) =>
    workoutLogs[ex.id]?.setLogs.every((s) => s.done) &&
    (workoutLogs[ex.id]?.setLogs.length ?? 0) > 0
  ).length;

  return (
    <div className="px-5 md:px-8 py-6 pb-28 md:pb-12 text-white max-w-2xl mx-auto">

      {/* ── Session header ─────────────────────────────────────────────────────── */}
      <div className="mb-7">
        <p className="text-[10px] uppercase tracking-[0.25em] text-white/22 mb-2">
          {SESSION.phase} · Week {SESSION.week} of {SESSION.totalWeeks}
        </p>

        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white/95 mb-1 leading-tight">
              {SESSION.name}
            </h1>
            <p className="text-sm text-white/32">
              {SESSION.day} · {SESSION.duration} ·{" "}
              <span className={cn(
                "tabular-nums",
                completedExercises === totalExercises && totalExercises > 0
                  ? "text-[#B48B40]"
                  : "text-white/32"
              )}>
                {completedExercises}/{totalExercises} exercises
              </span>
            </p>
          </div>

          {isCoach && (
            <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
              <Link
                href="/program/generate"
                className="flex items-center gap-1.5 rounded-xl border border-[#B48B40]/22 bg-[#B48B40]/6 px-3 py-1.5 text-xs font-medium text-[#B48B40]/70 hover:bg-[#B48B40]/10 hover:text-[#B48B40] transition-all"
              >
                <Sparkles className="w-3.5 h-3.5" strokeWidth={1.5} />
                Generate
              </Link>
              <Link
                href="/program/builder"
                className="flex items-center gap-1.5 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-1.5 text-xs font-medium text-white/32 hover:text-white/60 hover:bg-white/[0.05] transition-all"
              >
                <Wrench className="w-3.5 h-3.5" strokeWidth={1.5} />
                Builder
              </Link>
              <Link
                href="/program/assign"
                className="flex items-center gap-1.5 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-1.5 text-xs font-medium text-white/32 hover:text-white/60 hover:bg-white/[0.05] transition-all"
              >
                <Users className="w-3.5 h-3.5" strokeWidth={1.5} />
                Assign
              </Link>
            </div>
          )}
        </div>

        {/* Goal card */}
        <div className="rounded-2xl border border-[#B48B40]/14 bg-[#B48B40]/[0.035] px-4 py-3.5 flex items-start gap-3">
          <Target className="w-4 h-4 text-[#B48B40]/50 shrink-0 mt-0.5" strokeWidth={1.5} />
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-[#B48B40]/45 mb-1">
              Today&apos;s goal
            </p>
            <p className="text-sm text-white/62 leading-relaxed">{SESSION.goal}</p>
          </div>
        </div>
      </div>

      {/* ── Coaching notes ─────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/6 bg-[#111111] overflow-hidden mb-6">
        <button
          onClick={() => setCoachNotesOpen((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-3.5 text-white/30 hover:text-white/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-[#B48B40]/45" strokeWidth={1.5} />
            <span className="text-xs uppercase tracking-[0.18em]">Coaching notes</span>
          </div>
          {coachNotesOpen
            ? <ChevronUp className="w-4 h-4" strokeWidth={1.5} />
            : <ChevronDown className="w-4 h-4" strokeWidth={1.5} />}
        </button>
        {coachNotesOpen && (
          <div className="px-5 pb-5 space-y-3">
            {SESSION.coachNotes.map((note, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-1 h-1 rounded-full bg-[#B48B40]/35 shrink-0 mt-1.5" />
                <p className="text-sm text-white/45 leading-relaxed">{note}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Exercise sections ──────────────────────────────────────────────────── */}
      <div className="space-y-7 mb-6">
        {sectionData.map(({ section, exercises }, si) => {
          if (exercises.length === 0) return null;
          const startIdx = sectionStartIndices[si];
          return (
            <div key={section}>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-[10px] uppercase tracking-[0.22em] text-white/20 font-medium shrink-0">
                  {section}
                </span>
                <div className="flex-1 border-t border-white/[0.045]" />
              </div>

              <div className="space-y-3">
                {exercises.map((ex, ei) => (
                  <ExerciseCard
                    key={ex.id}
                    exercise={ex}
                    globalIndex={startIdx + ei}
                    log={workoutLogs[ex.id]}
                    onLogsChange={(updated) => updateExerciseLog(ex.id, updated)}
                    onStartRest={(secs) => setRestTimer({ secs, key: Date.now() })}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Session notes ──────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/6 bg-[#111111] overflow-hidden mb-5">
        <button
          onClick={() => setSessionNoteOpen((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.01] transition-colors"
        >
          <div className="flex items-center gap-2">
            <StickyNote className="w-3.5 h-3.5 text-white/22" strokeWidth={1.5} />
            <span className="text-xs uppercase tracking-[0.18em] text-white/26">Session notes</span>
          </div>
          {sessionNoteOpen
            ? <ChevronUp className="w-4 h-4 text-white/22" strokeWidth={1.5} />
            : <ChevronDown className="w-4 h-4 text-white/22" strokeWidth={1.5} />}
        </button>
        {sessionNoteOpen && (
          <div className="px-5 pb-5">
            <textarea
              value={sessionNote}
              onChange={(e) => setSessionNote(e.target.value)}
              placeholder="How did the session feel? Energy, PRs, anything worth remembering..."
              rows={3}
              className="w-full bg-transparent text-sm text-white/60 placeholder:text-white/18 resize-none outline-none border-b border-white/8 pb-2 focus:border-white/18 transition-colors leading-relaxed"
            />
          </div>
        )}
      </div>

      {/* ── Finish ────────────────────────────────────────────────────────────── */}
      {sessionLogged ? (
        <div className="w-full rounded-2xl border border-emerald-400/18 bg-emerald-400/[0.04] py-4 text-center">
          <div className="flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" strokeWidth={1.5} />
            <span className="text-sm font-semibold text-emerald-400">Session logged</span>
          </div>
          <p className="text-xs text-white/22 mt-1">Great work. See you next time.</p>
        </div>
      ) : (
        <button
          onClick={() => setShowComplete(true)}
          className="w-full rounded-2xl bg-[#B48B40] hover:bg-[#c99840] active:bg-[#a07530] py-4 text-sm font-semibold text-black transition-colors tracking-widest"
        >
          FINISH SESSION
        </button>
      )}

      {/* ── Rest timer ────────────────────────────────────────────────────────── */}
      {restTimer && (
        <RestTimer
          key={restTimer.key}
          seconds={restTimer.secs}
          onClose={() => setRestTimer(null)}
        />
      )}

      {/* ── Post-workout modal ────────────────────────────────────────────────── */}
      {showComplete && (
        <PostWorkoutModal
          sessionName={SESSION.name}
          onLog={handleLogSession}
          onDismiss={() => setShowComplete(false)}
        />
      )}
    </div>
  );
}
