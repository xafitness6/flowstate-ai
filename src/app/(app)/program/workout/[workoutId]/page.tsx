"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft, ChevronDown, ChevronUp, Check, CheckCircle2,
  Timer, Zap, X, Flame, Play, Pause, Square, Headphones, Dumbbell, Clock, AlertTriangle, Mic, Send, Loader2,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/context/UserContext";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { FormCheckModal } from "@/components/workout/FormCheckModal";
import {
  loadActiveProgramForUser, getWorkoutLogsForUser, saveWorkoutLog, getPreviousPerf,
  formatDuration,
  type Workout, type WorkoutExercise, type WarmUpItem, type WorkoutLog, type Feel,
} from "@/lib/workout";
import { safeAlternative } from "@/lib/injuries";
import { loadIntake } from "@/lib/data/intake";

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
      <p className="text-[10px] text-white/30 mb-2">{title}</p>
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
  onSetTap, onInputChange, onFeel, onLogSet, onVoiceFill, voiceActiveKey, onCantDo, onFormCheck,
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
  onVoiceFill?:  (key: string) => void;
  voiceActiveKey?: string | null;
  onCantDo?:     (exerciseId: string, name: string) => void;
  onFormCheck?:  (exerciseId: string, name: string) => void;
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
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-bold text-white/90 leading-tight">{exercise.name}</h3>
          <div className="flex items-center gap-2 shrink-0">
            {onFormCheck && (
              <button
                onClick={() => onFormCheck(exercise.exerciseId, exercise.name)}
                className="flex items-center gap-1 text-[10px] font-medium text-[#B48B40]/80 hover:text-[#B48B40] border border-[#B48B40]/25 hover:border-[#B48B40]/45 bg-[#B48B40]/[0.04] rounded-lg px-2 py-1 transition-colors"
                title="Upload a video — AI form check"
              >
                <Video className="w-3 h-3" strokeWidth={1.5} />
                Form check
              </button>
            )}
            {onCantDo && (
              <button
                onClick={() => onCantDo(exercise.exerciseId, exercise.name)}
                className="text-[10px] font-medium text-white/35 hover:text-amber-300/80 border border-white/10 hover:border-amber-300/30 rounded-lg px-2 py-1 transition-colors"
                title="Swap this for something you can do"
              >
                Can&apos;t do — swap
              </button>
            )}
            {allDone && <CheckCircle2 className="w-5 h-5 text-[#B48B40] mt-0.5" strokeWidth={2} />}
          </div>
        </div>
      </div>

      {/* Two-column: log on the left, the how-to / explanation on the right */}
      <div className="grid lg:grid-cols-[1fr_240px] gap-3 px-3 pb-3">
        {/* LEFT — sets + logging */}
        <div className="min-w-0">
          <div className="grid grid-cols-[28px_1fr_1fr_44px] gap-2 px-1 pb-1">
            {["Set", "Target", "Prev", ""].map((h) => (
              <span key={h} className="text-[9px] text-white/20">{h}</span>
            ))}
          </div>
          <div className="space-y-0.5">
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
                      <label className="text-[11px] text-white/45 font-medium">Reps</label>
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
                      <label className="text-[11px] text-white/45 font-medium">Load (kg)</label>
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

                  {onVoiceFill && (
                    <button
                      onClick={() => onVoiceFill(key)}
                      className={cn(
                        "w-full py-2 rounded-xl border text-xs font-medium flex items-center justify-center gap-2 transition-all",
                        voiceActiveKey === key ? "border-[#B48B40]/50 bg-[#B48B40]/[0.1] text-[#B48B40] animate-pulse" : "border-white/[0.08] text-white/45 hover:text-white/75 hover:border-white/15",
                      )}
                    >
                      <Mic className="w-3.5 h-3.5" strokeWidth={1.8} /> {voiceActiveKey === key ? "Listening… say e.g. \"8 reps at 135\"" : "Say it instead"}
                    </button>
                  )}

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

        {/* RIGHT — how-to / explanation (stacks under on mobile) */}
        <div className="rounded-xl border border-white/[0.06] bg-black/15 overflow-hidden self-start">
          <div className="aspect-video bg-gradient-to-br from-[#B48B40]/[0.12] to-white/[0.02] flex items-center justify-center">
            <Dumbbell className="w-8 h-8 text-[#B48B40]/40" strokeWidth={1.5} />
          </div>
          <div className="p-3 space-y-2">
            <p className="text-[10px] text-white/30">How to do it</p>
            <p className="text-[12px] text-white/55 leading-relaxed">
              {exercise.notes || "Controlled tempo, full range of motion, brace your core. Stop a rep or two shy of failure."}
            </p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 pt-2 border-t border-white/[0.05] text-[11px] text-white/40">
              <span>Target <span className="text-white/65">{exercise.sets[0]?.targetReps ?? "—"}</span> reps</span>
              {prevPerf && <span className="flex items-center gap-1"><Flame className="w-3 h-3" strokeWidth={1.5} /> Last {prevPerf.reps} @ {prevPerf.load}kg</span>}
            </div>
          </div>
        </div>
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
  const [loaded,    setLoaded]    = useState(true);
  const [injuryAreas, setInjuryAreas] = useState<string[]>([]);

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

  // Session timer + flow
  const startRef    = useRef(Date.now());
  const [elapsed,   setElapsed]   = useState(0);
  const [finished,  setFinished]  = useState(false);
  // Pain / "felt off" feedback — surfaced to the coach (notes + notification).
  const [painNote,  setPainNote]  = useState("");
  const [painOpen,  setPainOpen]  = useState(false);
  const [painSending, setPainSending] = useState(false);
  const [painSent,    setPainSent]    = useState(false);
  // Flow: preview (see details, nothing running) → countdown (5..1) → active.
  // Freestyle skips the countdown + running clock + auto rest timers — just log.
  const [phase,     setPhase]     = useState<"preview" | "countdown" | "active">("preview");
  const [paused,    setPaused]    = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [freestyle, setFreestyle] = useState(false);
  const freestyleRef = useRef(false);

  // ── Load ──────────────────────────────────────────────────────────────────

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

  // Session timer — only ticks while active and not paused (so it never
  // auto-starts on open, and the pause button actually pauses).
  useEffect(() => {
    if (phase !== "active" || paused) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [phase, paused]);

  // 5-4-3-2-1 countdown, then start the session clock.
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) {
      startRef.current = Date.now();
      setElapsed(0);
      setPhase("active");
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 850);
    return () => clearTimeout(t);
  }, [phase, countdown]);

  function startWorkout() { freestyleRef.current = false; setFreestyle(false); setCountdown(5); setPhase("countdown"); }
  function startFreestyle() { freestyleRef.current = true; setFreestyle(true); setPhase("active"); }

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

  // ── Voice logging: speak a set, fill reps + load ──────────────────────────
  const voice = useVoiceInput();
  const [voiceKey, setVoiceKey] = useState<string | null>(null);
  const startVoiceForSet = useCallback((key: string) => { setVoiceKey(key); voice.start(); }, [voice]);
  useEffect(() => {
    if (!voiceKey || !voice.transcript) return;
    const t = voice.transcript.toLowerCase();
    // load: a number directly before kg/lb/pound/kilo, else the number after "at"/"@"
    const loadM = t.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilo|kilos|lb|lbs|pound|pounds)/) || t.match(/(?:at|@)\s*(\d+(?:\.\d+)?)/);
    // reps: a number before "rep(s)", else the first number that isn't the load
    const repsM = t.match(/(\d+)\s*(?:rep|reps|times|x)\b/) || t.match(/\b(\d+)\b/);
    if (repsM) handleInputChange(voiceKey, "reps", repsM[1]);
    if (loadM) handleInputChange(voiceKey, "load", loadM[1]);
  }, [voice.transcript, voiceKey, handleInputChange]);

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

    // Rest timer — skipped in freestyle (no-timer) mode.
    if (freestyleRef.current) return;
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

  // Load injuries (for the "Can't do" swap to pick an injury-appropriate sub).
  useEffect(() => {
    if (!user?.id) return;
    try {
      const intake = loadIntake(user.id) as { injuryAreas?: unknown } | null;
      if (Array.isArray(intake?.injuryAreas)) setInjuryAreas((intake!.injuryAreas as unknown[]).filter((x): x is string => typeof x === "string"));
    } catch { /* ignore */ }
  }, [user?.id]);

  // Form-check modal target — which exercise the user uploaded a video for.
  const [formCheck, setFormCheck] = useState<{ id: string; name: string } | null>(null);
  function handleFormCheck(exerciseId: string, name: string) {
    setFormCheck({ id: exerciseId, name });
  }

  // "Can't do this" → swap the exercise for a safe alternative + record it so
  // future generated plans avoid it.
  function handleCantDo(exerciseId: string, name: string) {
    if (!workout) return;
    const used = workout.exercises.map((e) => e.name);
    const alt = safeAlternative(injuryAreas, [name.toLowerCase()], used);
    if (alt) {
      setWorkout((w) => w ? {
        ...w,
        exercises: w.exercises.map((e) =>
          e.exerciseId === exerciseId ? { ...e, name: alt, notes: "Swapped — you flagged you can't do the original." } : e),
      } : w);
    }
    fetch("/api/me/injury-avoid", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exercise: name }),
    }).catch(() => {});
  }

  // Send the pain/feedback note to the coach RIGHT NOW (not just on finish), so
  // the athlete gets confirmation it went through.
  async function notifyCoachNow() {
    const note = painNote.trim();
    if (!note || painSending) return;
    setPainSending(true);
    try {
      const res = await fetch("/api/me/coach-message", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: `Workout feedback${workout ? ` (${workout.focus})` : ""}: ${note}` }),
      });
      if (res.ok) setPainSent(true);
    } catch { /* best-effort */ } finally { setPainSending(false); }
  }

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
      notes:         painNote.trim() ? `⚠️ Pain/feedback: ${painNote.trim()}` : undefined,
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
    // Ping the coach + feed accountability (best-effort, never blocks the finish).
    fetch("/api/me/workout-complete", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workoutName: workout.focus, sets: completedSetCount, durationMins: Math.ceil(elapsed / 60), painNote: painNote.trim() || undefined }),
    }).catch(() => {});
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

  // ── Pre-start: see the whole workout before the clock starts ──────────────
  if (phase === "preview") {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white pb-32">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-gradient-to-b from-[#0E0E0E] to-[#0A0A0A]/90 backdrop-blur-sm border-b border-white/[0.06] px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 rounded-xl border border-white/[0.08] flex items-center justify-center hover:border-white/15 transition-all"
          >
            <ArrowLeft className="w-4 h-4 text-white/50" strokeWidth={2} />
          </button>
          <p className="text-sm font-semibold text-white/70">Workout preview</p>
        </div>

        <div className="px-4 pt-5 space-y-5 max-w-lg mx-auto">
          {/* Title block */}
          <div>
            <p className="text-[11px] text-[#B48B40]/70 mb-1">{workout.dayLabel} · Today&apos;s focus</p>
            <h1 className="text-2xl font-bold tracking-tight text-white/90">{workout.focus}</h1>
            <div className="flex items-center gap-4 mt-2 text-xs text-white/40">
              <span className="flex items-center gap-1.5"><Dumbbell className="w-3.5 h-3.5" strokeWidth={1.5} /> {workout.exercises.length} exercises</span>
              <span className="flex items-center gap-1.5"><Flame className="w-3.5 h-3.5" strokeWidth={1.5} /> {totalSetCount} sets</span>
              <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" strokeWidth={1.5} /> ~{workout.estimatedDuration} min</span>
            </div>
          </div>

          {/* Warm-up summary */}
          {totalWarmupItems > 0 && (
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-[#B48B40]/15 border border-[#B48B40]/25 flex items-center justify-center shrink-0">
                <Zap className="w-3.5 h-3.5 text-[#B48B40]" strokeWidth={2.5} />
              </div>
              <p className="text-sm text-white/55">Warm-up first — {totalWarmupItems} quick movements to prime you.</p>
            </div>
          )}

          {/* Exercise list with sets/reps */}
          <div>
            <p className="text-[10px] text-white/25 mb-2 px-1">The work</p>
            <div className="space-y-2">
              {workout.exercises.map((ex, i) => (
                <div key={ex.exerciseId} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
                  <div className="flex items-start gap-3">
                    <span className="text-[11px] font-bold text-white/25 tabular-nums mt-0.5 w-5 shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white/80">{ex.name}</p>
                      <p className="text-xs text-white/40 mt-0.5">
                        {ex.sets.length} sets × {ex.sets[0]?.targetReps ?? "—"} reps
                        {ex.sets[0]?.restSeconds ? ` · ${ex.sets[0].restSeconds}s rest` : ""}
                      </p>
                      {ex.notes && <p className="text-[11px] text-white/28 mt-1 leading-relaxed">{ex.notes}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI coach in your ear — coming soon */}
          <button
            disabled
            className="w-full flex items-center gap-3 rounded-2xl border border-[#B48B40]/15 bg-[#B48B40]/[0.04] px-4 py-3 text-left cursor-default"
          >
            <div className="w-8 h-8 rounded-xl bg-[#B48B40]/10 border border-[#B48B40]/20 flex items-center justify-center shrink-0">
              <Headphones className="w-4 h-4 text-[#B48B40]/70" strokeWidth={1.5} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white/70">AI coach in your ear</p>
              <p className="text-[11px] text-white/35">Live, set-by-set voice coaching through your session.</p>
            </div>
            <span className="text-[9px] font-semibold px-2 py-1 rounded-lg border border-white/10 bg-white/[0.03] text-white/35 shrink-0">
              Coming soon
            </span>
          </button>
        </div>

        {/* Start button — fixed bottom */}
        <div
          className="fixed bottom-0 inset-x-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/95 to-transparent px-4 pt-6 pb-[calc(env(safe-area-inset-bottom)+1rem)]"
        >
          <div className="max-w-lg mx-auto space-y-2">
            <button
              onClick={startWorkout}
              className="w-full rounded-2xl bg-[#B48B40] text-black py-4 text-sm font-bold tracking-wide flex items-center justify-center gap-2 hover:bg-[#c99840] active:scale-[0.98] transition-all"
            >
              <Play className="w-4 h-4" strokeWidth={2.5} fill="currentColor" /> Start workout — guided + timer
            </button>
            <button
              onClick={startFreestyle}
              className="w-full rounded-2xl border border-white/12 bg-white/[0.03] text-white/70 py-3 text-sm font-semibold flex items-center justify-center gap-2 hover:text-white/90 hover:border-white/20 active:scale-[0.98] transition-all"
            >
              <Dumbbell className="w-4 h-4" strokeWidth={2} /> Log freestyle — no timer
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Countdown: 5-4-3-2-1 ──────────────────────────────────────────────────
  if (phase === "countdown") {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col items-center justify-center px-5">
        <p className="text-[11px] text-white/30 mb-6">{workout.focus}</p>
        <div
          key={countdown}
          className="text-[7rem] font-bold leading-none text-[#B48B40] tabular-nums"
          style={{ animation: "cd-pop 0.85s ease-out" }}
        >
          {countdown > 0 ? countdown : "GO"}
        </div>
        <style>{`@keyframes cd-pop { 0% { transform: scale(0.5); opacity: 0; } 30% { transform: scale(1.15); opacity: 1; } 100% { transform: scale(1); opacity: 0.85; } }`}</style>
        <button
          onClick={() => setPhase("preview")}
          className="mt-10 text-xs text-white/30 hover:text-white/55 transition-colors"
        >
          Cancel
        </button>
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

      {/* ── Sticky control bar ── */}
      <div className="sticky top-0 z-30 bg-gradient-to-b from-[#121212] to-[#0C0C0C] backdrop-blur-sm border-b border-white/[0.07] px-3 py-2.5 flex items-center gap-2.5">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-xl border border-white/[0.08] flex items-center justify-center hover:border-white/15 transition-all shrink-0"
        >
          <ArrowLeft className="w-4 h-4 text-white/50" strokeWidth={2} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white/80 truncate">{workout.focus}</p>
          <p className="text-[11px] text-white/35">{completedSetCount}/{totalSetCount} sets</p>
        </div>

        {/* Timer + pause — hidden in freestyle (no-timer) mode */}
        {!freestyle && (
          <>
            <div className={cn(
              "flex items-center gap-1.5 text-sm font-bold tabular-nums px-2.5 py-1.5 rounded-xl border",
              paused ? "text-white/40 border-white/10 bg-white/[0.02]" : "text-[#B48B40] border-[#B48B40]/20 bg-[#B48B40]/[0.06]",
            )}>
              <Timer className="w-3.5 h-3.5" strokeWidth={1.5} />
              {formatDuration(elapsed)}
            </div>
            <button
              onClick={() => setPaused((p) => !p)}
              className="w-9 h-9 rounded-xl border border-white/[0.1] bg-white/[0.03] flex items-center justify-center text-white/60 hover:text-white hover:border-white/20 transition-all shrink-0"
              title={paused ? "Resume" : "Pause"}
            >
              {paused
                ? <Play  className="w-4 h-4 text-[#B48B40]" strokeWidth={2} fill="currentColor" />
                : <Pause className="w-4 h-4" strokeWidth={2} />}
            </button>
          </>
        )}
        {freestyle && <span className="text-[10px] uppercase tracking-wider text-white/30 px-2 shrink-0">Freestyle</span>}

        {/* Finish / stop */}
        <button
          onClick={handleFinish}
          className="w-9 h-9 rounded-xl border border-[#EF4444]/25 bg-[#EF4444]/8 flex items-center justify-center text-[#EF4444]/80 hover:bg-[#EF4444]/15 transition-all shrink-0"
          title="Finish & log workout"
        >
          <Square className="w-3.5 h-3.5" strokeWidth={2.5} fill="currentColor" />
        </button>
      </div>

      {/* Paused overlay hint */}
      {paused && (
        <div className="px-4 pt-3">
          <div className="max-w-lg mx-auto rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 flex items-center justify-between gap-3">
            <p className="text-xs text-white/50">Paused — timer stopped.</p>
            <button
              onClick={() => setPaused(false)}
              className="text-xs font-semibold text-[#B48B40] hover:text-[#c99840] transition-colors flex items-center gap-1.5"
            >
              <Play className="w-3 h-3" strokeWidth={2} fill="currentColor" /> Resume
            </button>
          </div>
        </div>
      )}

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
          <p className="text-[10px] text-white/28 px-1">Exercises</p>
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
              onVoiceFill={voice.isSupported ? startVoiceForSet : undefined}
              voiceActiveKey={voice.status === "listening" ? voiceKey : null}
              onCantDo={handleCantDo}
              onFormCheck={handleFormCheck}
            />
          ))}
        </div>

        {/* ── Pain / feedback — goes to the coach ── */}
        <div className="pt-1">
          {!painOpen && !painNote && (
            <button
              onClick={() => setPainOpen(true)}
              className="w-full rounded-xl border border-amber-400/20 bg-amber-400/[0.04] py-2.5 text-xs font-medium text-amber-300/80 flex items-center justify-center gap-2 hover:bg-amber-400/[0.08] transition-all"
            >
              <AlertTriangle className="w-3.5 h-3.5" strokeWidth={1.8} /> Something hurt or felt off? Tell your coach
            </button>
          )}
          {(painOpen || painNote) && (
            <div className="rounded-xl border border-amber-400/25 bg-amber-400/[0.05] p-3">
              <p className="text-xs font-semibold text-amber-300/90 mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" strokeWidth={2} /> Pain / feedback for your coach
              </p>
              <textarea
                value={painNote}
                onChange={(e) => { setPainNote(e.target.value); if (painSent) setPainSent(false); }}
                rows={2}
                autoFocus={painOpen}
                placeholder="Which movement, where it hurt, and how it felt — e.g. 'sharp left knee on lunges, stopped early'."
                className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/85 placeholder:text-white/25 outline-none focus:border-amber-400/40 resize-none"
              />
              <div className="flex items-center justify-between gap-2 mt-2">
                <p className="text-[10px] text-white/35">Saved with this workout when you finish.</p>
                <button
                  onClick={notifyCoachNow}
                  disabled={!painNote.trim() || painSending || painSent}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all shrink-0",
                    painSent
                      ? "bg-emerald-400/15 border border-emerald-400/30 text-emerald-300"
                      : "bg-amber-400/15 border border-amber-400/30 text-amber-200 hover:bg-amber-400/25 disabled:opacity-40",
                  )}
                >
                  {painSending ? <Loader2 className="w-3 h-3 animate-spin" strokeWidth={2} />
                    : painSent ? <Check className="w-3 h-3" strokeWidth={2.5} />
                    : <Send className="w-3 h-3" strokeWidth={2} />}
                  {painSent ? "Sent to your coach" : painSending ? "Sending…" : "Notify coach now"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Finish ── */}
        {completedSetCount > 0 && (
          <div className="pt-2">
            <button
              onClick={handleFinish}
              className="w-full rounded-2xl bg-[#B48B40] text-black py-4 text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#c99840] active:scale-[0.98] transition-all"
            >
              <CheckCircle2 className="w-4 h-4" strokeWidth={2.5} />
              Workout complete · {completedSetCount}/{totalSetCount} sets
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

      {/* ── Form-check modal ── */}
      {formCheck && (
        <FormCheckModal
          exerciseName={formCheck.name}
          exerciseId={formCheck.id}
          onClose={() => setFormCheck(null)}
        />
      )}
    </div>
  );
}
