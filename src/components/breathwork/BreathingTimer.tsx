"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Pause, Play, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BreathworkSettings, BreathworkSession } from "@/lib/breathwork/types";
import { SPEED_INTERVAL_MS } from "@/lib/breathwork/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = "idle" | "breathing" | "hold" | "recovery" | "complete";

type SessionState = {
  phase: Phase;
  currentRound: number;
  currentBreath: number;    // 1-indexed; odd = inhale, even = exhale
  holdSeconds: number;      // elapsed seconds during hold
  recoverySeconds: number;  // remaining seconds during recovery
  paused: boolean;
  holdTimes: number[];
};

type Props = {
  settings: BreathworkSettings;
  onComplete: (session: Omit<BreathworkSession, "id" | "completedAt">) => void;
  onEnd: () => void;
};

const TICK_MS = 100;

// ─── Component ────────────────────────────────────────────────────────────────

export function BreathingTimer({ settings, onComplete, onEnd }: Props) {
  const { rounds, breathsPerRound, recoveryDuration, speed } = settings;
  const breathIntervalMs = SPEED_INTERVAL_MS[speed];

  const [state, setState] = useState<SessionState>({
    phase: "idle",
    currentRound: 1,
    currentBreath: 0,
    holdSeconds: 0,
    recoverySeconds: recoveryDuration,
    paused: false,
    holdTimes: [],
  });

  const intervalRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionStartRef = useRef<number>(Date.now());

  const clearTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // ─── Start ──────────────────────────────────────────────────────────────────
  const startSession = useCallback(() => {
    sessionStartRef.current = Date.now();
    setState((s) => ({ ...s, phase: "breathing", currentBreath: 1 }));
  }, []);

  // ─── Breathing phase ────────────────────────────────────────────────────────
  useEffect(() => {
    if (state.phase !== "breathing" || state.paused) { clearTimer(); return; }

    intervalRef.current = setInterval(() => {
      setState((s) => {
        if (s.paused || s.phase !== "breathing") return s;
        const next = s.currentBreath + 1;
        if (next > breathsPerRound) return { ...s, phase: "hold", holdSeconds: 0 };
        return { ...s, currentBreath: next };
      });
    }, breathIntervalMs);

    return clearTimer;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.paused, breathsPerRound, breathIntervalMs]);

  // ─── Hold phase ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (state.phase !== "hold" || state.paused) { clearTimer(); return; }

    intervalRef.current = setInterval(() => {
      setState((s) => {
        if (s.paused || s.phase !== "hold") return s;
        return { ...s, holdSeconds: s.holdSeconds + TICK_MS / 1000 };
      });
    }, TICK_MS);

    return clearTimer;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.paused]);

  // ─── Recovery phase ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (state.phase !== "recovery" || state.paused) { clearTimer(); return; }

    intervalRef.current = setInterval(() => {
      setState((s) => {
        if (s.paused || s.phase !== "recovery") return s;
        const next = s.recoverySeconds - TICK_MS / 1000;
        if (next <= 0) {
          if (s.currentRound >= rounds) return { ...s, phase: "complete", recoverySeconds: 0 };
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

  // ─── Complete ────────────────────────────────────────────────────────────────
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

  // ─── Controls ────────────────────────────────────────────────────────────────
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

  // ─── Derived display values ───────────────────────────────────────────────────
  const isInhale       = state.currentBreath % 2 !== 0;
  const holdDisplay    = Math.floor(state.holdSeconds);
  const recoveryDisplay = Math.ceil(state.recoverySeconds);
  const totalBreathsInRound = breathsPerRound;
  // Count of complete breath cycles (each cycle = 1 inhale + 1 exhale)
  const breathCycle    = Math.ceil(state.currentBreath / 2);
  const totalCycles    = Math.ceil(totalBreathsInRound / 2);

  // ─── Circle animation ─────────────────────────────────────────────────────────
  // Scale: idle=0.7, inhale=1.0, exhale/recovery=0.72, hold=1.0, complete=0.85
  const circleTarget = (() => {
    if (state.phase === "idle")      return 0.72;
    if (state.phase === "breathing") return isInhale ? 1.0 : 0.72;
    if (state.phase === "hold")      return 1.0;
    if (state.phase === "recovery")  return 0.72;
    if (state.phase === "complete")  return 0.85;
    return 0.72;
  })();

  const circleTransitionMs = (() => {
    // Use the full breath interval so the circle fills each phase without
    // a visible pause at peak/trough. CSS handles mid-transition state
    // changes gracefully — the next transition starts from current position.
    if (state.phase === "breathing") return breathIntervalMs;
    if (state.phase === "recovery")  return Math.min(recoveryDuration * 1000 * 0.5, 1800);
    return 700;
  })();

  const glowColor = (() => {
    if (state.phase === "hold")      return "rgba(180,139,64,0.20)";
    if (state.phase === "breathing" && isInhale) return "rgba(180,139,64,0.08)";
    if (state.phase === "complete")  return "rgba(74,222,128,0.12)";
    return "transparent";
  })();

  // ─── Phase label ─────────────────────────────────────────────────────────────
  const phaseLabel = (() => {
    if (state.phase === "idle")      return "Ready";
    if (state.phase === "breathing") return isInhale ? "Inhale" : "Exhale";
    if (state.phase === "hold")      return "Hold";
    if (state.phase === "recovery")  return "Recover";
    if (state.phase === "complete")  return "Complete";
    return "";
  })();

  const phaseLabelColor = (() => {
    if (state.phase === "hold")      return "text-[#B48B40]";
    if (state.phase === "complete")  return "text-emerald-400";
    return "text-white/50";
  })();

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center gap-8 py-6 select-none">

      {/* Round progress dots */}
      <div className="flex items-center gap-2">
        {Array.from({ length: rounds }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "rounded-full transition-all duration-500",
              i < state.currentRound - 1
                ? "w-6 h-1 bg-[#B48B40]/60"
                : i === state.currentRound - 1 && state.phase !== "idle"
                ? "w-8 h-1 bg-[#B48B40]"
                : "w-5 h-1 bg-white/8"
            )}
          />
        ))}
        {state.phase !== "idle" && (
          <span className="text-[10px] text-white/25 ml-1 tabular-nums">
            {state.phase === "complete"
              ? `${rounds}/${rounds}`
              : `${state.currentRound}/${rounds}`}
          </span>
        )}
      </div>

      {/* Breathing circle */}
      <div className="relative flex items-center justify-center">
        {/* Outer glow ring */}
        <div
          className="absolute inset-0 rounded-full transition-[box-shadow] duration-1000"
          style={{ boxShadow: `0 0 80px 20px ${glowColor}` }}
        />

        {/* Main circle — GPU-accelerated via will-change */}
        <div
          className="relative flex items-center justify-center w-56 h-56 rounded-full border border-white/[0.07] bg-white/[0.025]"
          style={{
            transform: `scale(${circleTarget})`,
            transition: `transform ${circleTransitionMs}ms cubic-bezier(0.4, 0, 0.2, 1)`,
            willChange: "transform",
          }}
        >
          {/* Inner ring */}
          <div className="absolute inset-5 rounded-full border border-white/[0.04] bg-white/[0.015]" />

          {/* Center content */}
          <div className="relative z-10 text-center px-4">
            {state.phase === "idle" && (
              <p className="text-xs text-white/22 tracking-[0.2em] uppercase">Press start</p>
            )}

            {state.phase === "breathing" && (
              <div>
                <p className={cn(
                  "text-[11px] uppercase tracking-[0.25em] font-medium mb-2",
                  isInhale ? "text-white/55" : "text-white/28"
                )}>
                  {isInhale ? "Inhale" : "Exhale"}
                </p>
                <p className="text-4xl font-extralight text-white/80 tabular-nums leading-none">
                  {breathCycle}
                  <span className="text-lg text-white/22">/{totalCycles}</span>
                </p>
              </div>
            )}

            {state.phase === "hold" && (
              <div>
                <p className="text-[11px] uppercase tracking-[0.25em] text-[#B48B40]/55 font-medium mb-2">
                  Hold
                </p>
                <p className="text-5xl font-extralight text-[#B48B40] tabular-nums leading-none">
                  {holdDisplay}
                  <span className="text-xl text-[#B48B40]/40">s</span>
                </p>
              </div>
            )}

            {state.phase === "recovery" && (
              <div>
                <p className="text-[11px] uppercase tracking-[0.25em] text-white/28 font-medium mb-2">
                  Recover
                </p>
                <p className="text-4xl font-extralight text-white/50 tabular-nums leading-none">
                  {recoveryDisplay}
                  <span className="text-xl text-white/22">s</span>
                </p>
              </div>
            )}

            {state.phase === "complete" && (
              <div>
                <p className="text-[11px] uppercase tracking-[0.25em] text-emerald-400/70 font-medium mb-1">
                  Done
                </p>
                <p className="text-sm text-white/30">Well done</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Phase label + context */}
      <div className="text-center -mt-2">
        <p className={cn("text-sm font-medium tracking-wide transition-colors duration-300", phaseLabelColor)}>
          {phaseLabel}
        </p>
        {state.phase === "breathing" && (
          <p className="text-[10px] text-white/20 mt-1">
            Round {state.currentRound} of {rounds}
          </p>
        )}
        {state.phase === "hold" && (
          <p className="text-[10px] text-white/20 mt-1">
            Tap Release when ready
          </p>
        )}
        {state.phase === "recovery" && (
          <p className="text-[10px] text-white/20 mt-1">
            Round {state.currentRound} of {rounds} complete
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        {state.phase === "idle" && (
          <button
            onClick={startSession}
            className="px-10 py-3.5 rounded-2xl bg-white/[0.06] border border-white/10 text-sm font-medium text-white/65 hover:bg-white/10 hover:text-white/90 hover:border-white/18 transition-all"
          >
            Start
          </button>
        )}

        {state.phase === "breathing" && (
          <>
            <button
              onClick={togglePause}
              className="flex items-center justify-center w-12 h-12 rounded-full border border-white/10 bg-white/[0.04] text-white/40 hover:text-white/70 hover:bg-white/[0.08] transition-all"
            >
              {state.paused
                ? <Play className="w-4 h-4 ml-0.5" strokeWidth={1.5} />
                : <Pause className="w-4 h-4" strokeWidth={1.5} />}
            </button>
            <button
              onClick={onEnd}
              className="flex items-center justify-center w-12 h-12 rounded-full border border-white/8 bg-white/[0.02] text-white/22 hover:text-white/50 hover:bg-white/[0.05] transition-all"
            >
              <Square className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
          </>
        )}

        {state.phase === "hold" && (
          <>
            <button
              onClick={endHold}
              className="px-8 py-3.5 rounded-2xl border border-[#B48B40]/30 bg-[#B48B40]/8 text-sm font-medium text-[#B48B40]/80 hover:bg-[#B48B40]/14 hover:text-[#B48B40] transition-all"
            >
              Release
            </button>
            <button
              onClick={onEnd}
              className="flex items-center justify-center w-12 h-12 rounded-full border border-white/8 bg-white/[0.02] text-white/22 hover:text-white/50 hover:bg-white/[0.05] transition-all"
            >
              <Square className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
          </>
        )}

        {state.phase === "recovery" && (
          <button
            onClick={onEnd}
            className="flex items-center justify-center w-12 h-12 rounded-full border border-white/8 bg-white/[0.02] text-white/22 hover:text-white/50 hover:bg-white/[0.05] transition-all"
          >
            <Square className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        )}

        {state.phase === "complete" && (
          <button
            onClick={onEnd}
            className="px-10 py-3.5 rounded-2xl bg-white/[0.06] border border-white/10 text-sm font-medium text-white/65 hover:bg-white/10 hover:text-white/90 transition-all"
          >
            Done
          </button>
        )}
      </div>

      {/* Hold times this session */}
      {state.holdTimes.length > 0 && (
        <div className="flex items-center gap-4">
          {state.holdTimes.map((t, i) => (
            <div key={i} className="text-center">
              <p className="text-base font-light text-[#B48B40]/65 tabular-nums leading-none">{t}s</p>
              <p className="text-[9px] text-white/18 mt-0.5">R{i + 1}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
