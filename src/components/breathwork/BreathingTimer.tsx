"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Pause, Play, Square } from "lucide-react";
import type { BreathworkSettings, BreathworkSession } from "@/lib/breathwork/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = "idle" | "breathing" | "hold" | "recovery" | "complete";

type SessionState = {
  phase: Phase;
  currentRound: number;      // 1-indexed
  currentBreath: number;     // 1-indexed, during breathing phase
  holdSeconds: number;       // elapsed seconds during hold
  recoverySeconds: number;   // remaining seconds during recovery
  paused: boolean;
  holdTimes: number[];       // finalized hold time per round
};

type Props = {
  settings: BreathworkSettings;
  onComplete: (session: Omit<BreathworkSession, "id" | "completedAt">) => void;
  onEnd: () => void;
};

// ─── Breath cycle timing ─────────────────────────────────────────────────────
// Each breath: ~1.5s inhale + ~1.5s exhale = 3s per breath
const BREATH_INTERVAL_MS = 3000;
const TICK_MS = 100;

// ─── Component ────────────────────────────────────────────────────────────────

export function BreathingTimer({ settings, onComplete, onEnd }: Props) {
  const { rounds, breathsPerRound, recoveryDuration } = settings;

  const [state, setState] = useState<SessionState>({
    phase: "idle",
    currentRound: 1,
    currentBreath: 0,
    holdSeconds: 0,
    recoverySeconds: recoveryDuration,
    paused: false,
    holdTimes: [],
  });

  // Refs for interval management
  const intervalRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef      = useRef(state);
  const startTimeRef  = useRef<number>(Date.now());
  const sessionStartRef = useRef<number>(Date.now());

  stateRef.current = state;

  const clearTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // ─── Start session ──────────────────────────────────────────────────────────
  const startSession = useCallback(() => {
    sessionStartRef.current = Date.now();
    setState((s) => ({ ...s, phase: "breathing", currentBreath: 1 }));
  }, []);

  // ─── Breathing phase: tick every breath ────────────────────────────────────
  useEffect(() => {
    if (state.phase !== "breathing" || state.paused) {
      clearTimer();
      return;
    }

    intervalRef.current = setInterval(() => {
      setState((s) => {
        if (s.paused || s.phase !== "breathing") return s;
        const nextBreath = s.currentBreath + 1;
        if (nextBreath > breathsPerRound) {
          // Done breathing — enter hold
          return { ...s, phase: "hold", holdSeconds: 0 };
        }
        return { ...s, currentBreath: nextBreath };
      });
    }, BREATH_INTERVAL_MS);

    return clearTimer;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.paused, breathsPerRound]);

  // ─── Hold phase: tick every 100ms ───────────────────────────────────────────
  useEffect(() => {
    if (state.phase !== "hold" || state.paused) {
      clearTimer();
      return;
    }

    intervalRef.current = setInterval(() => {
      setState((s) => {
        if (s.paused || s.phase !== "hold") return s;
        return { ...s, holdSeconds: s.holdSeconds + TICK_MS / 1000 };
      });
    }, TICK_MS);

    return clearTimer;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.paused]);

  // ─── Recovery phase: countdown ──────────────────────────────────────────────
  useEffect(() => {
    if (state.phase !== "recovery" || state.paused) {
      clearTimer();
      return;
    }

    intervalRef.current = setInterval(() => {
      setState((s) => {
        if (s.paused || s.phase !== "recovery") return s;
        const next = s.recoverySeconds - TICK_MS / 1000;
        if (next <= 0) {
          // Recovery done — next round or complete
          if (s.currentRound >= rounds) {
            return { ...s, phase: "complete", recoverySeconds: 0 };
          }
          return {
            ...s,
            phase: "breathing",
            currentRound: s.currentRound + 1,
            currentBreath: 1,
            recoverySeconds: recoveryDuration,
          };
        }
        return { ...s, recoverySeconds: next };
      });
    }, TICK_MS);

    return clearTimer;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.paused, rounds, recoveryDuration]);

  // ─── Finalize hold when leaving hold phase ──────────────────────────────────
  const prevPhaseRef = useRef<Phase>("idle");
  useEffect(() => {
    if (prevPhaseRef.current === "hold" && state.phase === "recovery") {
      // hold was finalized — already captured in holdTimes via endHold()
    }
    prevPhaseRef.current = state.phase;
  }, [state.phase]);

  // ─── Complete ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (state.phase !== "complete") return;
    const totalDuration = Math.round((Date.now() - sessionStartRef.current) / 1000);
    onComplete({
      date: new Date().toISOString().slice(0, 10),
      settings,
      roundsCompleted: state.currentRound,
      totalBreaths: state.currentRound * breathsPerRound,
      holdTimes: state.holdTimes,
      totalDuration,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]);

  // ─── Controls ───────────────────────────────────────────────────────────────

  const endHold = useCallback(() => {
    setState((s) => {
      if (s.phase !== "hold") return s;
      const holdTime = Math.round(s.holdSeconds);
      return {
        ...s,
        phase: "recovery",
        holdTimes: [...s.holdTimes, holdTime],
        recoverySeconds: recoveryDuration,
      };
    });
  }, [recoveryDuration]);

  const togglePause = useCallback(() => {
    setState((s) => ({ ...s, paused: !s.paused }));
  }, []);

  // ─── Animation ──────────────────────────────────────────────────────────────
  // Breathing: alternate expand/contract per breath
  const isInhale = state.currentBreath % 2 !== 0;

  const circleScale = (() => {
    if (state.phase === "idle") return "scale-75";
    if (state.phase === "breathing") return isInhale ? "scale-100" : "scale-75";
    if (state.phase === "hold") return "scale-100";
    if (state.phase === "recovery") return "scale-75";
    if (state.phase === "complete") return "scale-90";
    return "scale-75";
  })();

  const circleOpacity = state.phase === "complete" ? "opacity-30" : "opacity-100";

  // ─── Labels ─────────────────────────────────────────────────────────────────
  const phaseLabel = (() => {
    if (state.phase === "idle") return "Ready";
    if (state.phase === "breathing") return isInhale ? "Inhale" : "Exhale";
    if (state.phase === "hold") return "Hold";
    if (state.phase === "recovery") return "Recover";
    if (state.phase === "complete") return "Complete";
    return "";
  })();

  const holdDisplay = Math.floor(state.holdSeconds);
  const recoveryDisplay = Math.ceil(state.recoverySeconds);

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center gap-10 py-8 select-none">

      {/* Round / progress */}
      <div className="flex items-center gap-1.5">
        {Array.from({ length: rounds }).map((_, i) => (
          <div
            key={i}
            className={[
              "h-1 rounded-full transition-all duration-500",
              i < state.currentRound - 1
                ? "w-5 bg-[#B48B40]/70"
                : i === state.currentRound - 1
                ? "w-7 bg-[#B48B40]"
                : "w-5 bg-white/10",
            ].join(" ")}
          />
        ))}
      </div>

      {/* Breathing circle */}
      <div
        className={[
          "relative flex items-center justify-center",
          "w-52 h-52 rounded-full",
          "border border-white/8 bg-white/[0.03]",
          "transition-transform duration-[1400ms] ease-in-out",
          circleScale,
          circleOpacity,
        ].join(" ")}
        style={{ boxShadow: state.phase === "hold" ? "0 0 60px rgba(180,139,64,0.15)" : undefined }}
      >
        {/* Inner ring */}
        <div className="absolute inset-4 rounded-full border border-white/5 bg-white/[0.02]" />

        {/* Center content */}
        <div className="relative z-10 text-center">
          {state.phase === "idle" && (
            <p className="text-xs text-white/30 tracking-widest uppercase">Press start</p>
          )}
          {state.phase === "breathing" && (
            <>
              <p className="text-3xl font-light text-white/80 tabular-nums leading-none">
                {state.currentBreath}
                <span className="text-base text-white/30">/{breathsPerRound}</span>
              </p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/30 mt-1">
                {isInhale ? "inhale" : "exhale"}
              </p>
            </>
          )}
          {state.phase === "hold" && (
            <>
              <p className="text-4xl font-light text-[#B48B40] tabular-nums leading-none">
                {holdDisplay}
                <span className="text-sm text-[#B48B40]/50">s</span>
              </p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/30 mt-1">holding</p>
            </>
          )}
          {state.phase === "recovery" && (
            <>
              <p className="text-3xl font-light text-white/60 tabular-nums leading-none">
                {recoveryDisplay}
                <span className="text-sm text-white/25">s</span>
              </p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/25 mt-1">recovery</p>
            </>
          )}
          {state.phase === "complete" && (
            <p className="text-xs text-white/40 uppercase tracking-widest">Done</p>
          )}
        </div>
      </div>

      {/* Phase label */}
      <div className="text-center -mt-4">
        <p className="text-sm font-medium text-white/50 tracking-wide">{phaseLabel}</p>
        {state.phase !== "idle" && state.phase !== "complete" && (
          <p className="text-xs text-white/20 mt-0.5">
            Round {state.currentRound} of {rounds}
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        {state.phase === "idle" && (
          <button
            onClick={startSession}
            className="px-8 py-3 rounded-2xl bg-white/[0.06] border border-white/10 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white/90 transition-all"
          >
            Start
          </button>
        )}

        {state.phase === "breathing" && (
          <>
            <button
              onClick={togglePause}
              className="flex items-center justify-center w-11 h-11 rounded-full border border-white/10 bg-white/[0.04] text-white/40 hover:text-white/70 hover:bg-white/[0.08] transition-all"
            >
              {state.paused
                ? <Play className="w-4 h-4 ml-0.5" strokeWidth={1.5} />
                : <Pause className="w-4 h-4" strokeWidth={1.5} />}
            </button>
            <button
              onClick={onEnd}
              className="flex items-center justify-center w-11 h-11 rounded-full border border-white/8 bg-white/[0.02] text-white/25 hover:text-white/50 hover:bg-white/[0.05] transition-all"
            >
              <Square className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
          </>
        )}

        {state.phase === "hold" && (
          <>
            <button
              onClick={endHold}
              className="px-8 py-3 rounded-2xl border border-[#B48B40]/30 bg-[#B48B40]/10 text-sm font-medium text-[#B48B40]/80 hover:bg-[#B48B40]/15 hover:text-[#B48B40] transition-all"
            >
              Release
            </button>
            <button
              onClick={onEnd}
              className="flex items-center justify-center w-11 h-11 rounded-full border border-white/8 bg-white/[0.02] text-white/25 hover:text-white/50 hover:bg-white/[0.05] transition-all"
            >
              <Square className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
          </>
        )}

        {state.phase === "recovery" && (
          <button
            onClick={onEnd}
            className="flex items-center justify-center w-11 h-11 rounded-full border border-white/8 bg-white/[0.02] text-white/25 hover:text-white/50 hover:bg-white/[0.05] transition-all"
          >
            <Square className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        )}

        {state.phase === "complete" && (
          <button
            onClick={onEnd}
            className="px-8 py-3 rounded-2xl bg-white/[0.06] border border-white/10 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white/90 transition-all"
          >
            Done
          </button>
        )}
      </div>

      {/* Hold times this session */}
      {state.holdTimes.length > 0 && (
        <div className="flex items-center gap-3">
          {state.holdTimes.map((t, i) => (
            <div key={i} className="text-center">
              <p className="text-base font-light text-[#B48B40]/70 tabular-nums leading-none">{t}s</p>
              <p className="text-[9px] text-white/20 mt-0.5">R{i + 1}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
