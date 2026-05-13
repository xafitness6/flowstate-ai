"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft, ChevronDown, ChevronUp, Check, CheckCircle2,
  Timer, Zap, X, Flame,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/context/UserContext";
import {
  loadActiveProgramForUser, getWorkoutLogsForUser, saveWorkoutLog, getPreviousPerf,
  formatDuration,
  type Workout, type WorkoutExercise, type WarmUpItem, type WorkoutLog, type Feel,
} from "@/lib/workout";

// ─── Types ────────────────────────────────────────────────────────────────────

type SetInput = {
  reps: string;
  load: string;
  feel: Feel | null;
  done: boolean;
};

type PrevPerf = { reps: string; load: string } | null;

type PBType = "heavier" | "more_reps" | "volume";

type PBCelebration = {
  type:         PBType;
  exerciseName: string;
  detail:       string;
};

// ─── PB particles (deterministic angles, no Math.random) ─────────────────────

const COLORS   = ["#B48B40", "#FFD700", "#FFFFFF", "#FF8C00", "#E5C876", "#FFEC8B", "#FFC107"];
const PARTICLES = Array.from({ length: 40 }, (_, i) => {
  const angle    = (i / 40) * 360 + (i % 3) * 9;
  const dist     = 55 + (i % 7) * 14;
  const rad      = (angle * Math.PI) / 180;
  return {
    id:       i,
    dx:       Math.cos(rad) * dist,
    dy:       Math.sin(rad) * dist,
    color:    COLORS[i % COLORS.length],
    size:     4 + (i % 4) * 1.5,
    delay:    (i % 6) * 0.035,
    isSquare: i % 5 === 0,
  };
});

// ─── Firework overlay ─────────────────────────────────────────────────────────

function Firework({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1600);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <>
      <style>{`
        @keyframes pb-burst {
          0%   { transform: translate(0,0) scale(1.2); opacity: 1; }
          70%  { opacity: 0.6; }
          100% { transform: translate(var(--pbdx), var(--pbdy)) scale(0); opacity: 0; }
        }
        @keyframes pb-flash {
          0%   { opacity: 0; }
          8%   { opacity: 0.18; }
          100% { opacity: 0; }
        }
      `}</style>

      {/* Screen flash */}
      <div
        className="fixed inset-0 z-[60] pointer-events-none bg-[#B48B40]"
        style={{ animation: "pb-flash 0.6s ease-out forwards" }}
      />

      {/* Particle burst */}
      <div className="fixed inset-0 z-[60] pointer-events-none flex items-center justify-center">
        {PARTICLES.map((p) => (
          <div
            key={p.id}
            style={{
              position:        "absolute",
              width:           p.size,
              height:          p.size,
              borderRadius:    p.isSquare ? "2px" : "50%",
              backgroundColor: p.color,
              "--pbdx":        `${p.dx}px`,
              "--pbdy":        `${p.dy}px`,
              animation:       `pb-burst 1.1s cubic-bezier(0.15,0.85,0.35,1) ${p.delay}s forwards`,
            } as React.CSSProperties}
          />
        ))}
      </div>
    </>
  );
}

// ─── PB toast ─────────────────────────────────────────────────────────────────

const PB_LABEL: Record<PBType, string> = {
  heavier:   "New weight record",
  more_reps: "New rep record",
  volume:    "New volume record",
};

const PB_EMOJI: Record<PBType, string> = {
  heavier:   "🏋️",
  more_reps: "🔥",
  volume:    "⚡",
};

function PBToast({ pb, onDismiss }: { pb: PBCelebration; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4500);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <>
      <style>{`
        @keyframes pb-toast-in {
          from { transform: translateY(-24px) scale(0.95); opacity: 0; }
          to   { transform: translateY(0)     scale(1);    opacity: 1; }
        }
      `}</style>
      <div className="fixed top-[68px] inset-x-0 z-[70] px-4 flex justify-center pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-sm rounded-2xl border border-[#B48B40]/50 bg-[#0C0C0C]/98 backdrop-blur-xl shadow-2xl shadow-[#B48B40]/15 flex items-center gap-3 px-4 py-3.5"
          style={{ animation: "pb-toast-in 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards" }}
        >
          {/* Pulsing glow ring */}
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-full bg-[#B48B40]/30 animate-ping" />
            <div className="relative w-10 h-10 rounded-full bg-[#B48B40]/15 border border-[#B48B40]/40 flex items-center justify-center text-lg">
              {PB_EMOJI[pb.type]}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-[#B48B40] tracking-wide">Personal Best!</p>
            <p className="text-xs text-white/65 truncate mt-0.5">{pb.exerciseName}</p>
            <p className="text-[11px] text-white/38 mt-0.5">
              {PB_LABEL[pb.type]} · {pb.detail}
            </p>
          </div>

          <button
            onClick={onDismiss}
            className="w-6 h-6 rounded-full border border-white/10 flex items-center justify-center hover:border-white/25 transition-all shrink-0"
          >
            <X className="w-3 h-3 text-white/30" strokeWidth={2} />
          </button>
        </div>
      </div>
    </>
  );
}

// ─── PB detection ─────────────────────────────────────────────────────────────

function detectPB(inp: SetInput, prev: PrevPerf): { type: PBType; detail: string } | null {
  if (!prev || !inp.reps) return null;
  const cr = parseFloat(inp.reps)  || 0;
  const cl = parseFloat(inp.load)  || 0;
  const pr = parseFloat(prev.reps) || 0;
  const pl = parseFloat(prev.load) || 0;
  if (cr <= 0) return null;

  // Heavier: more load with at least equal reps
  if (cl > pl && cl > 0 && cr >= pr) {
    return { type: "heavier", detail: `${cl} kg × ${cr} reps` };
  }
  // More reps: more reps with at least equal load
  if (cr > pr && cl >= pl) {
    return { type: "more_reps", detail: `${cr} reps${cl ? ` @ ${cl} kg` : ""}` };
  }
  // Volume PB: reps × load beats previous best
  if (cl > 0 && pl > 0 && cr * cl > pr * pl) {
    return { type: "volume", detail: `${(cr * cl).toFixed(0)} kg total` };
  }
  return null;
}

// ─── Warm-up section ─────────────────────────────────────────────────────────

function WarmUpSection({
  title, items, checked, onCheck,
}: {
  title:   string;
  items:   WarmUpItem[];
  checked: Set<string>;
  onCheck: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-[0.2em] text-white/30 mb-2">{title}</p>
      {items.map((item) => {
        const done   = checked.has(item.id);
        const isOpen = expanded === item.id;
        const detail = item.durationSecs ? formatDuration(item.durationSecs) : item.reps ?? "";

        return (
          <div
            key={item.id}
            className={cn(
              "rounded-xl border transition-all overflow-hidden",
              done ? "border-white/[0.05] bg-white/[0.015]" : "border-white/[0.08] bg-white/[0.03]"
            )}
          >
            <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => setExpanded(isOpen ? null : item.id)}>
              <button
                onClick={(e) => { e.stopPropagation(); onCheck(item.id); }}
                className={cn(
                  "w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all",
                  done ? "bg-[#B48B40]/20 border-[#B48B40]/50" : "border-white/20 hover:border-white/40"
                )}
              >
                {done && <Check className="w-3 h-3 text-[#B48B40]" strokeWidth={2.5} />}
              </button>

              <div className="flex-1 min-w-0">
                <p className={cn("text-sm font-medium transition-colors", done ? "text-white/35 line-through" : "text-white/80")}>
                  {item.name}
                </p>
                <p className="text-[11px] text-white/28 mt-0.5">{item.targetArea}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] text-white/35 font-medium">{detail}</span>
                {isOpen
                  ? <ChevronUp   className="w-3.5 h-3.5 text-white/20" strokeWidth={2} />
                  : <ChevronDown className="w-3.5 h-3.5 text-white/20" strokeWidth={2} />
                }
              </div>
            </div>

            {isOpen && (
              <div className="px-4 pb-3 border-t border-white/[0.05]">
                <p className="text-xs text-white/45 leading-relaxed pt-2">{item.description}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Exercise card ────────────────────────────────────────────────────────────

function ExerciseCard({
  exercise, setInputs, editingKey, prevPerf, pbSets,
  onSetTap, onInputChange, onFeel, onLogSet,
}: {
  exercise:      WorkoutExercise;
  setInputs:     Record<string, SetInput>;
  editingKey:    string | null;
  prevPerf:      PrevPerf;
  pbSets:        Set<string>;
  onSetTap:      (key: string) => void;
  onInputChange: (key: string, field: "reps" | "load", val: string) => void;
  onFeel:        (key: string, feel: Feel) => void;
  onLogSet:      (key: string, restSecs: number, exerciseId: string, exerciseName: string, inp: SetInput) => void;
}) {
  const completedCount = exercise.sets.filter(
    (s) => setInputs[`${exercise.exerciseId}_${s.setNumber}`]?.done
  ).length;
  const allDone = completedCount === exercise.sets.length;

  return (
    <div className={cn(
      "rounded-2xl border transition-all overflow-hidden",
      allDone ? "border-[#B48B40]/20 bg-[#B48B40]/[0.03]" : "border-white/[0.08] bg-white/[0.025]"
    )}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-white/90 leading-tight">{exercise.name}</h3>
            {exercise.notes && (
              <p className="text-[11px] text-white/35 mt-1 leading-relaxed">{exercise.notes}</p>
            )}
          </div>
          {allDone && <CheckCircle2 className="w-5 h-5 text-[#B48B40] shrink-0 mt-0.5" strokeWidth={2} />}
        </div>

        {prevPerf && (
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-white/30">
            <Flame className="w-3 h-3" strokeWidth={1.5} />
            <span>Last: {prevPerf.reps} reps @ {prevPerf.load} kg</span>
          </div>
        )}
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[28px_1fr_1fr_44px] gap-2 px-4 pb-1">
        {["Set", "Target", "Prev", ""].map((h) => (
          <span key={h} className="text-[9px] uppercase tracking-[0.18em] text-white/20">{h}</span>
        ))}
      </div>

      {/* Sets */}
      <div className="space-y-0.5 px-3 pb-3">
        {exercise.sets.map((s) => {
          const key    = `${exercise.exerciseId}_${s.setNumber}`;
          const inp    = setInputs[key] ?? { reps: "", load: "", feel: null, done: false };
          const isEdit = editingKey === key;
          const isPB   = inp.done && pbSets.has(key);

          return (
            <div key={key}>
              {/* Set row */}
              <button
                onClick={() => !inp.done && onSetTap(key)}
                disabled={inp.done}
                className={cn(
                  "w-full grid grid-cols-[28px_1fr_1fr_44px] gap-2 items-center px-1 py-2 rounded-xl transition-all",
                  inp.done ? "opacity-70" : isEdit ? "bg-white/[0.04]" : "hover:bg-white/[0.03] active:bg-white/[0.05]"
                )}
              >
                <span className={cn("text-xs font-bold text-center", inp.done ? "text-[#B48B40]" : "text-white/35")}>
                  {s.setNumber}
                </span>
                <span className="text-xs text-white/55 text-left font-medium">
                  {inp.done ? `${inp.reps} reps` : s.targetReps}
                </span>
                <span className="text-xs text-white/30 text-left">
                  {inp.done
                    ? (inp.load ? `${inp.load} kg` : "BW")
                    : (prevPerf?.load ? `${prevPerf.load}` : "—")
                  }
                </span>

                {/* Done indicator + PB badge */}
                <div className="flex items-center justify-end gap-1">
                  {isPB && (
                    <span className="text-[8px] font-black tracking-wide text-[#FFD700] bg-[#B48B40]/25 border border-[#B48B40]/40 px-1 py-0.5 rounded">
                      PB
                    </span>
                  )}
                  <div className={cn(
                    "w-6 h-6 rounded-full border flex items-center justify-center transition-all shrink-0",
                    inp.done
                      ? isPB
                        ? "bg-[#FFD700]/20 border-[#FFD700]/50"
                        : "bg-[#B48B40]/20 border-[#B48B40]/40"
                      : isEdit ? "border-white/30 bg-white/5" : "border-white/12"
                  )}>
                    {inp.done && <Check className={cn("w-3 h-3", isPB ? "text-[#FFD700]" : "text-[#B48B40]")} strokeWidth={2.5} />}
                  </div>
                </div>
              </button>

              {/* Inline input */}
              {isEdit && (
                <div className="mx-1 mb-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-3 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-[0.15em] text-white/30">Reps</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={inp.reps}
                        onChange={(e) => onInputChange(key, "reps", e.target.value)}
                        placeholder={s.targetReps.split(/[–\-]/)[0]}
                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20 transition-all"
                        autoFocus
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-[0.15em] text-white/30">Load (kg)</label>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={inp.load}
                        onChange={(e) => onInputChange(key, "load", e.target.value)}
                        placeholder={prevPerf?.load || "0"}
                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20 transition-all"
                      />
                    </div>
                  </div>

                  {/* Feel */}
                  <div className="flex gap-2">
                    {(["easy", "good", "hard"] as Feel[]).map((f) => (
                      <button
                        key={f}
                        onClick={() => onFeel(key, f)}
                        className={cn(
                          "flex-1 py-1.5 rounded-lg text-[11px] font-medium border capitalize transition-all",
                          inp.feel === f
                            ? f === "easy" ? "bg-emerald-400/15 border-emerald-400/40 text-emerald-400"
                              : f === "good" ? "bg-[#B48B40]/15 border-[#B48B40]/40 text-[#B48B40]"
                              : "bg-red-400/15 border-red-400/40 text-red-400"
                            : "border-white/[0.07] text-white/30 hover:border-white/15 hover:text-white/50"
                        )}
                      >
                        {f}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => onLogSet(key, s.restSeconds, exercise.exerciseId, exercise.name, inp)}
                    className="w-full py-2.5 rounded-xl bg-[#B48B40] text-black text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#c99840] active:scale-[0.98] transition-all"
                  >
                    <Check className="w-4 h-4" strokeWidth={2.5} /> Log Set
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Rest timer banner ────────────────────────────────────────────────────────

function RestBanner({ secs, total, onSkip }: { secs: number; total: number; onSkip: () => void }) {
  const pct = ((total - secs) / total) * 100;
  return (
    <div className="fixed bottom-[80px] inset-x-0 z-40 px-4">
      <div className="max-w-lg mx-auto rounded-2xl border border-[#B48B40]/25 bg-[#0A0A0A]/95 backdrop-blur-sm shadow-xl shadow-black/50 overflow-hidden">
        <div className="h-0.5 bg-white/[0.05]">
          <div className="h-full bg-[#B48B40]/60 transition-all duration-1000" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Timer className="w-4 h-4 text-[#B48B40]" strokeWidth={1.5} />
            <span className="text-sm font-bold text-white/80">Rest — {formatDuration(secs)}</span>
          </div>
          <button
            onClick={onSkip}
            className="text-xs text-white/35 hover:text-white/60 px-3 py-1 rounded-lg border border-white/[0.07] hover:border-white/15 transition-all"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WorkoutPage() {
  const router   = useRouter();
  const params   = useParams();
  const { user, isLoading: userLoading } = useUser();
  const wid      = params?.workoutId as string;

  const [workout,   setWorkout]   = useState<Workout | null>(null);
  const [prevPerfs, setPrevPerfs] = useState<Record<string, PrevPerf>>({});
  const [loaded,    setLoaded]    = useState(false);

  // Warm-up
  const [warmupPhase,   setWarmupPhase]   = useState<"active" | "done">("active");
  const [warmupChecked, setWarmupChecked] = useState<Set<string>>(new Set());

  // Set inputs
  const [setInputs,  setSetInputs]  = useState<Record<string, SetInput>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);

  // Personal best
  const [pbCelebration, setPbCelebration] = useState<PBCelebration | null>(null);
  const [showFirework,  setShowFirework]  = useState(false);
  const [pbSets,        setPbSets]        = useState<Set<string>>(new Set());

  // Rest timer
  const [restSecs,  setRestSecs]  = useState<number | null>(null);
  const [restTotal, setRestTotal] = useState(0);
  const restRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Session timer
  const startRef    = useRef(Date.now());
  const [elapsed,   setElapsed]   = useState(0);
  const [finished,  setFinished]  = useState(false);

  // ── Load ──────────────────────────────────────────────────────────────────

  // Failsafe — never hang on the spinner more than 4s.
  useEffect(() => {
    const t = window.setTimeout(() => setLoaded(true), 4000);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (userLoading) return;

    let active = true;

    async function load() {
      try {
        if (!user?.id) { router.replace("/program"); return; }
        const prog = await loadActiveProgramForUser(user.id).catch(() => null);
        if (!active) return;
        if (!prog) { router.replace("/program"); return; }

        const wo = prog.workouts.find((w) => w.workoutId === wid);
        if (!wo)  { router.replace("/program"); return; }
        setWorkout(wo);

        const logs = await getWorkoutLogsForUser(user.id).catch(() => [] as WorkoutLog[]);
        if (!active) return;
        const perfs: Record<string, PrevPerf> = {};
        wo.exercises.forEach((ex) => { perfs[ex.exerciseId] = getPreviousPerf(logs, ex.name); });
        setPrevPerfs(perfs);

        const inputs: Record<string, SetInput> = {};
        wo.exercises.forEach((ex) => {
          ex.sets.forEach((s) => {
            inputs[`${ex.exerciseId}_${s.setNumber}`] = { reps: "", load: "", feel: null, done: false };
          });
        });
        setSetInputs(inputs);
      } finally {
        if (active) setLoaded(true);
      }
    }

    void load();
    return () => { active = false; };
  }, [user?.id, wid, router, userLoading]);

  // Session timer
  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  // ── Warm-up handlers ─────────────────────────────────────────────────────

  const handleWarmupCheck = useCallback((id: string) => {
    setWarmupChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const totalWarmupItems = workout
    ? workout.warmup.general.length + workout.warmup.activation.length + workout.warmup.mobility.length
    : 0;

  // ── Set handlers ──────────────────────────────────────────────────────────

  const handleSetTap = useCallback((key: string) => {
    setEditingKey((prev) => prev === key ? null : key);
  }, []);

  const handleInputChange = useCallback((key: string, field: "reps" | "load", val: string) => {
    setSetInputs((prev) => ({ ...prev, [key]: { ...prev[key], [field]: val } }));
  }, []);

  const handleFeel = useCallback((key: string, feel: Feel) => {
    setSetInputs((prev) => ({
      ...prev,
      [key]: { ...prev[key], feel: prev[key]?.feel === feel ? null : feel },
    }));
  }, []);

  const handleLogSet = useCallback((
    key: string, restSeconds: number,
    exerciseId: string, exerciseName: string, inp: SetInput,
  ) => {
    // PB detection — compare against previous best
    const prev = prevPerfs[exerciseId];
    if (prev) {
      const pb = detectPB(inp, prev);
      if (pb) {
        setPbCelebration({ type: pb.type, exerciseName, detail: pb.detail });
        setShowFirework(true);
        setPbSets((s) => new Set([...s, key]));
      }
    }

    setSetInputs((prev) => ({ ...prev, [key]: { ...prev[key], done: true } }));
    setEditingKey(null);

    // Rest timer
    if (restRef.current) clearInterval(restRef.current);
    setRestSecs(restSeconds);
    setRestTotal(restSeconds);
    restRef.current = setInterval(() => {
      setRestSecs((s) => {
        if (s === null || s <= 1) { clearInterval(restRef.current!); return null; }
        return s - 1;
      });
    }, 1000);
  }, [prevPerfs]);

  const skipRest = useCallback(() => {
    if (restRef.current) clearInterval(restRef.current);
    setRestSecs(null);
  }, []);

  // ── Finish ────────────────────────────────────────────────────────────────

  const completedSetCount = Object.values(setInputs).filter((s) => s.done).length;
  const totalSetCount     = workout ? workout.exercises.reduce((sum, ex) => sum + ex.sets.length, 0) : 0;

  function handleFinish() {
    if (!user?.id || !workout) return;
    const log: WorkoutLog = {
      logId:         `log_${Date.now()}`,
      workoutId:     workout.workoutId,
      workoutName:   workout.focus,
      userId:        user.id,
      startedAt:     startRef.current,
      completedAt:   Date.now(),
      durationMins:  Math.ceil(elapsed / 60),
      setsCompleted: completedSetCount,
      exercises:     workout.exercises.map((ex) => ({
        exerciseId: ex.exerciseId,
        name:       ex.name,
        setLogs:    ex.sets.map((s) => {
          const key = `${ex.exerciseId}_${s.setNumber}`;
          const inp = setInputs[key];
          return {
            setNumber:     s.setNumber,
            completedReps: inp?.reps ?? "",
            completedLoad: inp?.load ?? "",
            feel:          inp?.feel ?? undefined,
            completed:     inp?.done ?? false,
          };
        }),
      })),
    };
    saveWorkoutLog(user.id, log);
    setFinished(true);
    setTimeout(() => router.replace("/program"), 2200);
  }

  // ── Loading / finished states ─────────────────────────────────────────────

  if (!loaded || !workout) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border-2 border-[#B48B40]/30 border-t-[#B48B40] animate-spin" />
      </div>
    );
  }

  if (finished) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center px-5 text-white">
        <div className="max-w-sm w-full text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-[#B48B40]/15 border border-[#B48B40]/30 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-[#B48B40]" strokeWidth={1.5} />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-white/85">Workout complete</h2>
            <p className="text-sm text-white/40">{completedSetCount} sets · {Math.ceil(elapsed / 60)} min</p>
          </div>
        </div>
      </div>
    );
  }

  const allSections = [
    { title: "General warm-up",   items: workout.warmup.general    },
    { title: "Activation",        items: workout.warmup.activation  },
    { title: "Dynamic mobility",  items: workout.warmup.mobility    },
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white pb-36">

      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-30 bg-[#0A0A0A]/95 backdrop-blur-sm border-b border-white/[0.05] px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="w-8 h-8 rounded-xl border border-white/[0.08] flex items-center justify-center hover:border-white/15 transition-all"
        >
          <ArrowLeft className="w-4 h-4 text-white/50" strokeWidth={2} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white/80 truncate">{workout.focus}</p>
          <p className="text-[11px] text-white/30">{completedSetCount}/{totalSetCount} sets</p>
        </div>
        <div className="flex items-center gap-1.5 text-sm font-bold text-[#B48B40]">
          <Timer className="w-3.5 h-3.5" strokeWidth={1.5} />
          {formatDuration(elapsed)}
        </div>
      </div>

      <div className="px-4 pt-5 space-y-4">

        {/* ── Warm-up ── */}
        {warmupPhase === "active" && (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
            <div className="px-5 pt-5 pb-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#B48B40]/15 border border-[#B48B40]/25 flex items-center justify-center">
                    <Zap className="w-3.5 h-3.5 text-[#B48B40]" strokeWidth={2.5} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white/80">Warm-Up</p>
                    <p className="text-[11px] text-white/30">{warmupChecked.size}/{totalWarmupItems} done</p>
                  </div>
                </div>
                <button
                  onClick={() => setWarmupPhase("done")}
                  className="text-xs text-white/30 hover:text-white/55 px-3 py-1 rounded-lg border border-white/[0.06] hover:border-white/12 transition-all"
                >
                  Skip
                </button>
              </div>

              <div className="h-1 bg-white/[0.05] rounded-full overflow-hidden mb-5">
                <div
                  className="h-full bg-[#B48B40]/60 rounded-full transition-all"
                  style={{ width: `${totalWarmupItems ? (warmupChecked.size / totalWarmupItems) * 100 : 0}%` }}
                />
              </div>

              <div className="space-y-5">
                {allSections.map(({ title, items }) => (
                  <WarmUpSection
                    key={title}
                    title={title}
                    items={items}
                    checked={warmupChecked}
                    onCheck={handleWarmupCheck}
                  />
                ))}
              </div>
            </div>

            <button
              onClick={() => setWarmupPhase("done")}
              className={cn(
                "w-full py-3.5 text-sm font-bold flex items-center justify-center gap-2 transition-all",
                warmupChecked.size === totalWarmupItems
                  ? "bg-[#B48B40] text-black hover:bg-[#c99840]"
                  : "bg-white/[0.04] text-white/40 hover:bg-white/[0.06]"
              )}
            >
              <Check className="w-4 h-4" strokeWidth={2.5} />
              {warmupChecked.size === totalWarmupItems ? "Warm-up complete — Start workout" : "Done warming up"}
            </button>
          </div>
        )}

        {warmupPhase === "done" && (
          <button
            onClick={() => setWarmupPhase("active")}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border border-[#B48B40]/15 bg-[#B48B40]/[0.04] hover:border-[#B48B40]/25 transition-all"
          >
            <CheckCircle2 className="w-4 h-4 text-[#B48B40]" strokeWidth={2} />
            <span className="text-sm text-[#B48B40]/70 font-medium">Warm-up complete</span>
            <span className="ml-auto text-[11px] text-white/25">Expand</span>
          </button>
        )}

        {/* ── Exercises ── */}
        <div className="space-y-3">
          <p className="text-[10px] uppercase tracking-[0.25em] text-white/28 px-1">Exercises</p>
          {workout.exercises.map((ex) => (
            <ExerciseCard
              key={ex.exerciseId}
              exercise={ex}
              setInputs={setInputs}
              editingKey={editingKey}
              prevPerf={prevPerfs[ex.exerciseId] ?? null}
              pbSets={pbSets}
              onSetTap={handleSetTap}
              onInputChange={handleInputChange}
              onFeel={handleFeel}
              onLogSet={handleLogSet}
            />
          ))}
        </div>

        {/* ── Finish ── */}
        {completedSetCount > 0 && (
          <div className="pt-2">
            <button
              onClick={handleFinish}
              className="w-full rounded-2xl bg-[#B48B40] text-black py-4 text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#c99840] active:scale-[0.98] transition-all"
            >
              <CheckCircle2 className="w-4 h-4" strokeWidth={2.5} />
              Finish Workout · {completedSetCount}/{totalSetCount} sets
            </button>
          </div>
        )}
      </div>

      {/* ── Rest timer ── */}
      {restSecs !== null && (
        <RestBanner secs={restSecs} total={restTotal} onSkip={skipRest} />
      )}

      {/* ── PB firework ── */}
      {showFirework && (
        <Firework onDone={() => setShowFirework(false)} />
      )}

      {/* ── PB toast ── */}
      {pbCelebration && (
        <PBToast pb={pbCelebration} onDismiss={() => setPbCelebration(null)} />
      )}
    </div>
  );
}
