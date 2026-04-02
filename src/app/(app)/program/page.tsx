"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowLeftRight, ChevronDown, ChevronUp, Timer, X, CheckCircle2, Sparkles, Wrench, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/context/UserContext";
import { hasAccess } from "@/lib/roles";
import { GreetingBanner } from "@/components/dashboard/GreetingBanner";

type Exercise = {
  id: string;
  name: string;
  sets: number;
  reps: string;
  weight: string;
  rest: string;
  adapted?: boolean;
  note?: string;
};

const EXERCISES: Exercise[] = [
  { id: "e1", name: "Lat Pulldown",  sets: 4, reps: "10",   weight: "60kg", rest: "90s" },
  { id: "e2", name: "Seated Row",    sets: 3, reps: "12",   weight: "50kg", rest: "90s", adapted: true },
  { id: "e3", name: "Face Pull",     sets: 3, reps: "15",   weight: "—",    rest: "60s" },
  { id: "e4", name: "Bicep Curl",    sets: 3, reps: "12",   weight: "20kg", rest: "60s" },
];

const SWAP_OPTIONS: Record<string, string[]> = {
  e1: ["Cable Pullover", "Band Pulldown", "Chest-Supported Row"],
  e2: ["Cable Row", "Dumbbell Row", "T-Bar Row"],
  e3: ["Band Pull-Apart", "Rear Delt Fly", "Cable Face Pull"],
  e4: ["Hammer Curl", "Incline Curl", "Cable Curl"],
};

function RestTimer({ seconds, onClose }: { seconds: number; onClose: () => void }) {
  const [remaining, setRemaining] = useState(seconds);
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setRemaining(seconds);
    interval.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(interval.current!);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(interval.current!);
  }, [seconds]);

  const pct = ((seconds - remaining) / seconds) * 100;
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  return (
    <div className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-50">
      <div className="rounded-2xl border border-[#6f4a17]/50 bg-[#0e0d0b] px-6 py-4 flex items-center gap-5 shadow-2xl min-w-[260px]">
        <div className="relative w-10 h-10 shrink-0">
          <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15" fill="none" stroke="#262626" strokeWidth="3" />
            <circle
              cx="18" cy="18" r="15"
              fill="none"
              stroke="#B48B40"
              strokeWidth="3"
              strokeDasharray={`${2 * Math.PI * 15}`}
              strokeDashoffset={`${2 * Math.PI * 15 * (1 - pct / 100)}`}
              strokeLinecap="round"
              className="transition-[stroke-dashoffset] duration-1000 ease-linear"
            />
          </svg>
          <Timer className="absolute inset-0 m-auto w-4 h-4 text-[#B48B40]" strokeWidth={1.5} />
        </div>

        <div className="flex-1">
          <p className="text-xs uppercase tracking-[0.18em] text-white/30 mb-0.5">Rest</p>
          <p className="text-2xl font-semibold tabular-nums text-white">
            {remaining === 0
              ? "Go."
              : `${mins > 0 ? `${mins}:` : ""}${String(secs).padStart(mins > 0 ? 2 : 1, "0")}s`}
          </p>
        </div>

        <button
          onClick={onClose}
          className="text-white/25 hover:text-white/60 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function ExerciseCard({
  exercise,
  index,
  onStartRest,
}: {
  exercise: Exercise;
  index: number;
  onStartRest: (secs: number) => void;
}) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState(exercise.note ?? "");
  const [swapOpen, setSwapOpen] = useState(false);
  const [name, setName] = useState(exercise.name);
  const [completed, setCompleted] = useState(false);

  const restSecs = parseInt(exercise.rest) || 60;

  return (
    <div
      className={cn(
        "rounded-2xl border bg-[#111111] overflow-hidden transition-all",
        completed ? "border-white/5 opacity-60" : "border-white/8"
      )}
    >
      {/* Exercise header */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-start gap-3">
            <span className="text-xs text-white/20 font-medium mt-0.5 w-4 shrink-0">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className={cn("font-semibold text-white/90", completed && "line-through decoration-white/20")}>
                  {name}
                </h3>
                {exercise.adapted && (
                  <span className="text-[10px] font-medium tracking-[0.08em] uppercase px-1.5 py-0.5 rounded-md bg-[#B48B40]/12 text-[#B48B40] border border-[#B48B40]/25">
                    Adapted
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={() => setCompleted((v) => !v)}
            className={cn(
              "shrink-0 w-6 h-6 rounded-full border flex items-center justify-center transition-all mt-0.5",
              completed
                ? "bg-[#B48B40] border-[#B48B40] text-black"
                : "border-white/15 hover:border-white/35"
            )}
          >
            {completed && (
              <svg viewBox="0 0 10 8" className="w-2.5 h-2.5" fill="none">
                <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { label: "Sets",   value: String(exercise.sets) },
            { label: "Reps",   value: exercise.reps },
            { label: "Weight", value: exercise.weight },
            { label: "Rest",   value: exercise.rest },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-white/6 bg-white/[0.03] px-3 py-1.5 flex items-center gap-1.5"
            >
              <span className="text-[10px] uppercase tracking-[0.1em] text-white/25">
                {stat.label}
              </span>
              <span className="text-sm font-medium text-white/80 tabular-nums">
                {stat.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Actions row */}
      <div className="px-5 pb-4 flex items-center gap-3">
        <button
          onClick={() => onStartRest(restSecs)}
          className="flex items-center gap-1.5 text-xs text-white/35 hover:text-white/60 transition-colors"
        >
          <Timer className="w-3.5 h-3.5" strokeWidth={1.5} />
          Start rest
        </button>

        <button
          onClick={() => { setSwapOpen((v) => !v); setNoteOpen(false); }}
          className="flex items-center gap-1.5 text-xs text-white/35 hover:text-white/60 transition-colors"
        >
          <ArrowLeftRight className="w-3.5 h-3.5" strokeWidth={1.5} />
          Swap
        </button>

        <button
          onClick={() => { setNoteOpen((v) => !v); setSwapOpen(false); }}
          className="flex items-center gap-1.5 text-xs text-white/35 hover:text-white/60 transition-colors ml-auto"
        >
          {noteOpen ? (
            <ChevronUp className="w-3.5 h-3.5" strokeWidth={1.5} />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" strokeWidth={1.5} />
          )}
          {note ? "Note" : "Add note"}
        </button>
      </div>

      {/* Swap panel */}
      {swapOpen && (
        <div className="border-t border-white/6 px-5 py-4 space-y-2">
          <p className="text-xs uppercase tracking-[0.15em] text-white/25 mb-3">
            Swap exercise
          </p>
          {SWAP_OPTIONS[exercise.id]?.map((opt) => (
            <button
              key={opt}
              onClick={() => { setName(opt); setSwapOpen(false); }}
              className="w-full text-left text-sm text-white/65 hover:text-white/90 py-2 px-3 rounded-xl hover:bg-white/[0.04] transition-colors"
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {/* Note panel */}
      {noteOpen && (
        <div className="border-t border-white/6 px-5 py-4">
          <p className="text-xs uppercase tracking-[0.15em] text-white/25 mb-3">
            Exercise note
          </p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Form cues, how it felt, anything relevant..."
            rows={2}
            className="w-full bg-transparent text-sm text-white/70 placeholder:text-white/20 resize-none outline-none border-b border-white/8 pb-2 focus:border-white/20 transition-colors"
          />
        </div>
      )}
    </div>
  );
}

// ─── Post-workout popup ───────────────────────────────────────────────────────

function WorkoutCompletePopup({
  sessionName,
  onLog,
  onDismiss,
}: {
  sessionName: string;
  onLog: (rpe: number, note: string) => void;
  onDismiss: () => void;
}) {
  const [rpe,  setRpe ] = useState(7);
  const [note, setNote] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center px-4 pb-8 md:pb-0">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onDismiss} />
      <div className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-[#0F0F0F] shadow-2xl shadow-black/60 overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-white/[0.06]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-4 h-4 text-[#B48B40]" strokeWidth={1.5} />
                <span className="text-[10px] uppercase tracking-[0.18em] text-[#B48B40]/70 font-medium">Session complete</span>
              </div>
              <p className="text-lg font-semibold text-white/90">{sessionName}</p>
            </div>
            <button onClick={onDismiss} className="text-white/25 hover:text-white/55 transition-colors shrink-0 mt-1">
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* RPE */}
        <div className="px-6 py-5 border-b border-white/[0.06]">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/22 mb-3">
            How hard was it? <span className="text-white/40 normal-case tracking-normal">(RPE {rpe}/10)</span>
          </p>
          <div className="flex gap-1.5">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => setRpe(n)}
                className={cn(
                  "flex-1 py-2 rounded-xl text-xs font-semibold border transition-all",
                  rpe === n
                    ? n >= 8
                      ? "bg-[#F87171]/15 border-[#F87171]/30 text-[#F87171]"
                      : n >= 6
                        ? "bg-[#B48B40]/15 border-[#B48B40]/30 text-[#B48B40]"
                        : "bg-emerald-400/12 border-emerald-400/25 text-emerald-400"
                    : "border-white/6 text-white/25 hover:border-white/15"
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Note */}
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Quick note — how it felt, any PRs, anything notable…"
            className="w-full bg-transparent text-sm text-white/65 placeholder:text-white/20 resize-none outline-none border-b border-white/8 focus:border-white/18 transition-colors pb-2 leading-relaxed"
          />
        </div>

        {/* Actions */}
        <div className="px-6 py-4 flex items-center gap-3">
          <button
            onClick={onDismiss}
            className="text-sm text-white/30 hover:text-white/55 transition-colors"
          >
            Skip
          </button>
          <button
            onClick={() => onLog(rpe, note)}
            className="ml-auto rounded-xl bg-[#B48B40] hover:bg-[#c99840] px-5 py-2.5 text-sm font-semibold text-black transition-colors"
          >
            Log session
          </button>
        </div>

      </div>
    </div>
  );
}

export default function ProgramPage() {
  const { user } = useUser();
  const isCoach = hasAccess(user.role, "trainer");

  const [restTimer,        setRestTimer       ] = useState<{ secs: number; key: number } | null>(null);
  const [sessionNote,      setSessionNote     ] = useState("");
  const [sessionNoteOpen,  setSessionNoteOpen ] = useState(false);
  const [showComplete,     setShowComplete    ] = useState(false);
  const [sessionLogged,    setSessionLogged   ] = useState(false);

  function startRest(secs: number) {
    setRestTimer({ secs, key: Date.now() });
  }

  function handleFinish() {
    setShowComplete(true);
  }

  function handleLogSession(rpe: number, note: string) {
    try {
      const existing = JSON.parse(localStorage.getItem("workout-logs") ?? "[]");
      const entry = {
        date:      new Date().toISOString().slice(0, 10),
        session:   "Upper Body · Pull",
        rpe,
        note,
        loggedAt:  new Date().toISOString(),
      };
      localStorage.setItem("workout-logs", JSON.stringify([entry, ...existing]));

      // Also mark training habit complete in accountability
      const today  = new Date().toISOString().slice(0, 10);
      const logs   = JSON.parse(localStorage.getItem("accountability-logs") ?? "{}");
      const todayLog = logs[today] ?? { completedHabits: [], identityState: null, energyNote: "", journalEntry: "", journalSaved: false };
      if (!todayLog.completedHabits.includes("training")) {
        todayLog.completedHabits = [...todayLog.completedHabits, "training"];
        logs[today] = todayLog;
        localStorage.setItem("accountability-logs", JSON.stringify(logs));
      }
    } catch { /* ignore */ }
    setShowComplete(false);
    setSessionLogged(true);
  }

  return (
    <div className="px-5 md:px-8 py-6 text-white max-w-2xl mx-auto">
      <GreetingBanner />

      {/* Session header */}
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.22em] text-white/30 mb-3">
          Week 3 of 8 · Phase 1
        </p>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight mb-1">
              Upper Body
            </h1>
            <p className="text-white/40 text-base">Pull · ~45 min · 4 exercises</p>
          </div>
          {isCoach && (
            <div className="flex items-center gap-1.5 shrink-0 mt-1">
              <Link
                href="/program/generate"
                className="flex items-center gap-1.5 rounded-xl border border-[#B48B40]/22 bg-[#B48B40]/6 px-3 py-1.5 text-xs font-medium text-[#B48B40]/75 hover:bg-[#B48B40]/10 hover:text-[#B48B40] transition-all"
              >
                <Sparkles className="w-3.5 h-3.5" strokeWidth={1.5} />
                Generate
              </Link>
              <Link
                href="/program/builder"
                className="flex items-center gap-1.5 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-1.5 text-xs font-medium text-white/40 hover:text-white/65 hover:bg-white/[0.05] transition-all"
              >
                <Wrench className="w-3.5 h-3.5" strokeWidth={1.5} />
                Builder
              </Link>
              <Link
                href="/program/assign"
                className="flex items-center gap-1.5 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-1.5 text-xs font-medium text-white/40 hover:text-white/65 hover:bg-white/[0.05] transition-all"
              >
                <Users className="w-3.5 h-3.5" strokeWidth={1.5} />
                Assign
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Exercise list */}
      <div className="space-y-3 mb-6">
        {EXERCISES.map((ex, i) => (
          <ExerciseCard
            key={ex.id}
            exercise={ex}
            index={i}
            onStartRest={startRest}
          />
        ))}
      </div>

      {/* Session note */}
      <div className="rounded-2xl border border-white/8 bg-[#111111] overflow-hidden mb-6">
        <button
          onClick={() => setSessionNoteOpen((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-4 text-sm text-white/40 hover:text-white/65 transition-colors"
        >
          <span className="text-xs uppercase tracking-[0.18em] text-white/30">
            Session note
          </span>
          {sessionNoteOpen ? (
            <ChevronUp className="w-4 h-4" strokeWidth={1.5} />
          ) : (
            <ChevronDown className="w-4 h-4" strokeWidth={1.5} />
          )}
        </button>

        {sessionNoteOpen && (
          <div className="px-5 pb-5">
            <textarea
              value={sessionNote}
              onChange={(e) => setSessionNote(e.target.value)}
              placeholder="How did the session go? Energy, performance, anything notable..."
              rows={3}
              className="w-full bg-transparent text-sm text-white/70 placeholder:text-white/20 resize-none outline-none border-b border-white/8 pb-2 focus:border-white/20 transition-colors"
            />
          </div>
        )}
      </div>

      {/* Finish session */}
      {sessionLogged ? (
        <div className="w-full rounded-2xl border border-emerald-400/20 bg-emerald-400/5 py-3.5 text-center">
          <div className="flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" strokeWidth={1.5} />
            <span className="text-sm font-semibold text-emerald-400">Session logged</span>
          </div>
        </div>
      ) : (
        <button
          onClick={handleFinish}
          className="w-full rounded-2xl bg-[#B48B40] py-3.5 text-sm font-semibold text-black hover:bg-[#c99840] transition-colors tracking-wide"
        >
          FINISH SESSION
        </button>
      )}

      {/* Rest timer */}
      {restTimer && (
        <RestTimer
          key={restTimer.key}
          seconds={restTimer.secs}
          onClose={() => setRestTimer(null)}
        />
      )}

      {/* Post-workout popup */}
      {showComplete && (
        <WorkoutCompletePopup
          sessionName="Upper Body · Pull"
          onLog={handleLogSession}
          onDismiss={() => setShowComplete(false)}
        />
      )}
    </div>
  );
}
