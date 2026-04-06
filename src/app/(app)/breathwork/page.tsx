"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Pause, Play } from "lucide-react";
import { useUser } from "@/context/UserContext";
import { recordActivity } from "@/lib/activity";

// ─── Types ────────────────────────────────────────────────────────────────────

type ModeId = "basics" | "power" | "box" | "478" | "endurance" | "freestyle";
type BreathPhase = "inhale" | "hold1" | "exhale" | "hold2";
type Screen = "select" | "breathing" | "retention" | "complete";

interface Mode {
  id: ModeId;
  name: string;
  description: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced" | "Custom";
  pattern: string;
  defaultBreaths: number;
  defaultRounds: number;
  inhaleMs: number;
  hold1Ms: number; // 0 = no hold after inhale
  exhaleMs: number;
  hold2Ms: number; // 0 = no hold after exhale
  hasRetention: boolean; // separate breath-hold screen after each round
}

const MODES: Mode[] = [
  {
    id: "basics",
    name: "Breathing Basics",
    description: "Classic Wim Hof-style rhythmic breathing.",
    difficulty: "Beginner",
    pattern: "5s inhale / 5s exhale",
    defaultBreaths: 30,
    defaultRounds: 3,
    inhaleMs: 5000,
    hold1Ms: 0,
    exhaleMs: 5000,
    hold2Ms: 0,
    hasRetention: true,
  },
  {
    id: "power",
    name: "Power Breathing",
    description: "Faster pace to charge the body quickly.",
    difficulty: "Intermediate",
    pattern: "3s inhale / 3s exhale",
    defaultBreaths: 40,
    defaultRounds: 4,
    inhaleMs: 3000,
    hold1Ms: 0,
    exhaleMs: 3000,
    hold2Ms: 0,
    hasRetention: true,
  },
  {
    id: "box",
    name: "Box Breathing",
    description: "Used by Navy SEALs for stress control.",
    difficulty: "Beginner",
    pattern: "4s in / 4s hold / 4s out / 4s hold",
    defaultBreaths: 4,
    defaultRounds: 4,
    inhaleMs: 4000,
    hold1Ms: 4000,
    exhaleMs: 4000,
    hold2Ms: 4000,
    hasRetention: false,
  },
  {
    id: "478",
    name: "4-7-8 Breathing",
    description: "Best for sleep and calming the nervous system.",
    difficulty: "Intermediate",
    pattern: "4s inhale / 7s hold / 8s exhale",
    defaultBreaths: 4,
    defaultRounds: 4,
    inhaleMs: 4000,
    hold1Ms: 7000,
    exhaleMs: 8000,
    hold2Ms: 0,
    hasRetention: false,
  },
  {
    id: "endurance",
    name: "Endurance",
    description: "Long slow deep breathing to build CO2 tolerance.",
    difficulty: "Advanced",
    pattern: "7s inhale / 7s exhale",
    defaultBreaths: 30,
    defaultRounds: 5,
    inhaleMs: 7000,
    hold1Ms: 0,
    exhaleMs: 7000,
    hold2Ms: 0,
    hasRetention: true,
  },
  {
    id: "freestyle",
    name: "Free Style",
    description: "Build your own pattern — full control over every timing.",
    difficulty: "Custom",
    pattern: "your rules",
    defaultBreaths: 20,
    defaultRounds: 3,
    inhaleMs: 5000,
    hold1Ms: 0,
    exhaleMs: 5000,
    hold2Ms: 0,
    hasRetention: false,
  },
];

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// ─── SVG Progress Ring ────────────────────────────────────────────────────────

function ProgressRing({ progress, size = 280 }: { progress: number; size?: number }) {
  const sw = 2;
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg
      width={size}
      height={size}
      style={{
        position: "absolute",
        inset: 0,
        transform: "rotate(-90deg)",
        pointerEvents: "none",
      }}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.05)"
        strokeWidth={sw}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#1a5c6b"
        strokeWidth={sw}
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.min(Math.max(progress, 0), 1))}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.5s ease" }}
      />
    </svg>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BreathworkPage() {
  const router = useRouter();
  const { user } = useUser();
  const [ready, setReady] = useState(false);

  // Auth guard
  useEffect(() => {
    try {
      const role =
        sessionStorage.getItem("flowstate-session-role") ||
        localStorage.getItem("flowstate-active-role");
      if (!["master", "trainer", "client", "member"].includes(role ?? "")) {
        router.replace("/login");
        return;
      }
    } catch {
      router.replace("/login");
      return;
    }
    setReady(true);
  }, [router]);

  // ── Screen & config ───────────────────────────────────────────────────────────
  const [screen, setScreen] = useState<Screen>("select");
  const [selectedMode, setSelectedMode] = useState<Mode>(MODES[0]);
  const [rounds, setRounds] = useState(MODES[0].defaultRounds);

  // ── Freestyle config ──────────────────────────────────────────────────────────
  const [fsBreaths, setFsBreaths]   = useState(20);
  const [fsInhale, setFsInhale]     = useState(5);   // seconds
  const [fsExhale, setFsExhale]     = useState(5);
  const [fsHold1, setFsHold1]       = useState(0);   // hold after inhale
  const [fsHold2, setFsHold2]       = useState(0);   // hold after exhale
  const [fsRetention, setFsRetention] = useState(false);

  // Builds a Mode object from current freestyle config
  function buildFreestyleMode(): Mode {
    const patternParts = [`${fsInhale}s in`];
    if (fsHold1 > 0) patternParts.push(`${fsHold1}s hold`);
    patternParts.push(`${fsExhale}s out`);
    if (fsHold2 > 0) patternParts.push(`${fsHold2}s hold`);
    return {
      id: "freestyle",
      name: "Free Style",
      description: "Custom",
      difficulty: "Custom",
      pattern: patternParts.join(" / "),
      defaultBreaths: fsBreaths,
      defaultRounds: rounds,
      inhaleMs:  fsInhale * 1000,
      hold1Ms:   fsHold1 * 1000,
      exhaleMs:  fsExhale * 1000,
      hold2Ms:   fsHold2 * 1000,
      hasRetention: fsRetention,
    };
  }

  // ── Breathing session state ───────────────────────────────────────────────────
  const [subPhase, setSubPhase] = useState<BreathPhase>("inhale");
  const [breath, setBreath] = useState(1);
  const [round, setRound] = useState(1);
  const [paused, setPaused] = useState(false);

  // Session-scoped refs — set on beginSession, stable inside callbacks
  const modeRef = useRef<Mode>(MODES[0]);
  const totalRoundsRef = useRef(3);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionStartRef = useRef(0);
  const holdTimesRef = useRef<number[]>([]);

  // ── Retention ─────────────────────────────────────────────────────────────────
  const [retentionSec, setRetentionSec] = useState(0);
  const retentionRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Complete ──────────────────────────────────────────────────────────────────
  const [totalDuration, setTotalDuration] = useState(0);

  // ── Timer helpers ─────────────────────────────────────────────────────────────
  function clearTimer() {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }
  function clearRetention() {
    if (retentionRef.current !== null) {
      clearInterval(retentionRef.current);
      retentionRef.current = null;
    }
  }

  function finishSession() {
    clearTimer();
    clearRetention();
    setTotalDuration(Math.round((Date.now() - sessionStartRef.current) / 1000));
    setScreen("complete");
    try {
      if (user?.id) recordActivity(user.id, "Breathwork session");
    } catch {}
  }

  // Called when exhale (or hold2) completes — decides what comes next.
  // curBreath / curRound are passed explicitly from the closure to avoid staleness.
  function advanceFromExhale(curBreath: number, curRound: number) {
    const mode = modeRef.current;
    const totalRounds = totalRoundsRef.current;

    if (curBreath < mode.defaultBreaths) {
      setBreath(curBreath + 1);
      setSubPhase("inhale");
    } else if (mode.hasRetention) {
      // Breathing Basics / Power / Endurance → retention screen
      clearTimer();
      setRetentionSec(0);
      setScreen("retention");
    } else if (curRound < totalRounds) {
      // Box / 4-7-8 → next round immediately
      setRound(curRound + 1);
      setBreath(1);
      setSubPhase("inhale");
    } else {
      finishSession();
    }
  }

  // ── Breathing timer ───────────────────────────────────────────────────────────
  // Each subPhase change creates a fresh setTimeout that starts only after the
  // previous state has committed to the DOM, guaranteeing CSS transitions fire
  // from a stable painted value.
  useEffect(() => {
    if (screen !== "breathing" || paused) {
      clearTimer();
      return;
    }

    const mode = modeRef.current;
    let durationMs: number;
    if (subPhase === "inhale") durationMs = mode.inhaleMs;
    else if (subPhase === "hold1") durationMs = mode.hold1Ms;
    else if (subPhase === "exhale") durationMs = mode.exhaleMs;
    else durationMs = mode.hold2Ms;

    // Capture snapshot of mutable values for use inside callback
    const curSubPhase = subPhase;
    const curBreath = breath;
    const curRound = round;

    timerRef.current = setTimeout(() => {
      if (curSubPhase === "inhale") {
        setSubPhase(mode.hold1Ms > 0 ? "hold1" : "exhale");
        return;
      }
      if (curSubPhase === "hold1") {
        setSubPhase("exhale");
        return;
      }
      if (curSubPhase === "exhale") {
        if (mode.hold2Ms > 0) {
          setSubPhase("hold2");
          return;
        }
        advanceFromExhale(curBreath, curRound);
        return;
      }
      // hold2
      advanceFromExhale(curBreath, curRound);
    }, durationMs);

    return clearTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, subPhase, breath, round, paused]);

  // ── Retention timer ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== "retention") {
      clearRetention();
      return;
    }
    retentionRef.current = setInterval(
      () => setRetentionSec((s) => s + 1),
      1000
    );
    return clearRetention;
  }, [screen]);

  // ── Begin / Release / End ─────────────────────────────────────────────────────
  function beginSession() {
    modeRef.current = selectedMode.id === "freestyle" ? buildFreestyleMode() : selectedMode;
    totalRoundsRef.current = rounds;
    holdTimesRef.current = [];
    sessionStartRef.current = Date.now();
    setBreath(1);
    setRound(1);
    setSubPhase("inhale");
    setPaused(false);
    setScreen("breathing");
  }

  function handleRelease() {
    clearRetention();
    holdTimesRef.current = [...holdTimesRef.current, retentionSec];
    if (round < totalRoundsRef.current) {
      setRound((r) => r + 1);
      setBreath(1);
      setSubPhase("inhale");
      setScreen("breathing");
    } else {
      finishSession();
    }
  }

  function handleEnd() {
    clearTimer();
    clearRetention();
    setPaused(false);
    setScreen("select");
  }

  // ── Derived display ───────────────────────────────────────────────────────────
  const isHolding =
    screen === "breathing" && (subPhase === "hold1" || subPhase === "hold2");
  const isInhaling = screen === "breathing" && subPhase === "inhale";

  const circleScale = (() => {
    if (screen !== "breathing") return 0.72;
    if (subPhase === "inhale") return 1.0;
    if (subPhase === "hold1") return 1.0;  // stay expanded
    if (subPhase === "hold2") return 0.68; // stay contracted
    return 0.68; // exhale
  })();

  const circleTransMs = (() => {
    if (screen !== "breathing") return 600;
    if (subPhase === "inhale") return modeRef.current.inhaleMs;
    if (subPhase === "exhale") return modeRef.current.exhaleMs;
    return 300;
  })();

  const phaseLabel = (() => {
    if (paused) return "Paused";
    if (screen !== "breathing") return "";
    if (subPhase === "inhale") return "Inhale";
    if (subPhase === "hold1" || subPhase === "hold2") return "Hold";
    return "Exhale";
  })();

  const ringProgress =
    screen === "breathing"
      ? (breath - 1) / modeRef.current.defaultBreaths
      : 0;

  // ─────────────────────────────────────────────────────────────────────────────

  if (!ready) return null;

  // ── SCREEN 1 — Mode Selection ─────────────────────────────────────────────────
  if (screen === "select") {
    return (
      <div className="px-5 md:px-8 py-6 max-w-lg mx-auto">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.22em] text-white/25 mb-1.5">
            Recovery
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            Breathwork
          </h1>
        </div>

        {/* Mode cards */}
        <div className="space-y-3 mb-6">
          {MODES.map((mode) => (
          <div key={mode.id} className="flex flex-col gap-0">
            <button
              onClick={() => {
                setSelectedMode(mode);
                setRounds(mode.defaultRounds);
              }}
              className={[
                "w-full text-left rounded-2xl border px-5 py-4 transition-all duration-200",
                selectedMode.id === mode.id
                  ? "border-[#1a5c6b]/50 bg-[#1a5c6b]/10"
                  : "border-white/8 bg-[#111111] hover:border-white/14",
              ].join(" ")}
            >
              <div className="flex items-start justify-between mb-1">
                <span className="text-sm font-semibold text-white/85">
                  {mode.name}
                </span>
                <span
                  className={[
                    "text-[9px] uppercase tracking-[0.15em] px-2 py-0.5 rounded-full ml-2 shrink-0",
                    mode.difficulty === "Beginner"
                      ? "bg-emerald-500/15 text-emerald-400/70"
                      : mode.difficulty === "Intermediate"
                      ? "bg-amber-500/15 text-amber-400/70"
                      : mode.difficulty === "Custom"
                      ? "bg-[#1a5c6b]/30 text-[#a8c8cf]/80"
                      : "bg-red-500/15 text-red-400/70",
                  ].join(" ")}
                >
                  {mode.difficulty}
                </span>
              </div>
              <p className="text-xs text-white/38 mb-1.5">{mode.description}</p>
              {mode.id !== "freestyle" && (
                <p className="text-[10px] font-mono text-[#a8c8cf]/50">
                  {mode.pattern}
                </p>
              )}
            </button>

            {/* Freestyle inline config — shown when freestyle is selected */}
            {mode.id === "freestyle" && selectedMode.id === "freestyle" && (
              <div
                className="rounded-2xl border border-[#1a5c6b]/30 bg-[#1a5c6b]/5 px-5 py-4 -mt-1 space-y-4"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Breaths per round */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-white/45">Breaths per round</span>
                    <span className="text-xs font-semibold text-white/70 tabular-nums w-6 text-right">{fsBreaths}</span>
                  </div>
                  <input
                    type="range" min={5} max={60} step={5}
                    value={fsBreaths}
                    onChange={(e) => setFsBreaths(Number(e.target.value))}
                    className="w-full h-1 rounded-full accent-[#1a5c6b]"
                  />
                  <div className="flex justify-between mt-1">
                    <span className="text-[9px] text-white/20">5</span>
                    <span className="text-[9px] text-white/20">60</span>
                  </div>
                </div>

                {/* Inhale / Exhale durations */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-white/45">Inhale</span>
                      <span className="text-xs font-semibold text-white/70 tabular-nums">{fsInhale}s</span>
                    </div>
                    <input
                      type="range" min={1} max={12} step={1}
                      value={fsInhale}
                      onChange={(e) => setFsInhale(Number(e.target.value))}
                      className="w-full h-1 rounded-full accent-[#1a5c6b]"
                    />
                    <div className="flex justify-between mt-1">
                      <span className="text-[9px] text-white/20">1s</span>
                      <span className="text-[9px] text-white/20">12s</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-white/45">Exhale</span>
                      <span className="text-xs font-semibold text-white/70 tabular-nums">{fsExhale}s</span>
                    </div>
                    <input
                      type="range" min={1} max={12} step={1}
                      value={fsExhale}
                      onChange={(e) => setFsExhale(Number(e.target.value))}
                      className="w-full h-1 rounded-full accent-[#1a5c6b]"
                    />
                    <div className="flex justify-between mt-1">
                      <span className="text-[9px] text-white/20">1s</span>
                      <span className="text-[9px] text-white/20">12s</span>
                    </div>
                  </div>
                </div>

                {/* Hold after inhale / Hold after exhale */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-white/45">Hold (after in)</span>
                      <span className="text-xs font-semibold text-white/70 tabular-nums">
                        {fsHold1 > 0 ? `${fsHold1}s` : "off"}
                      </span>
                    </div>
                    <input
                      type="range" min={0} max={10} step={1}
                      value={fsHold1}
                      onChange={(e) => setFsHold1(Number(e.target.value))}
                      className="w-full h-1 rounded-full accent-[#1a5c6b]"
                    />
                    <div className="flex justify-between mt-1">
                      <span className="text-[9px] text-white/20">off</span>
                      <span className="text-[9px] text-white/20">10s</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-white/45">Hold (after out)</span>
                      <span className="text-xs font-semibold text-white/70 tabular-nums">
                        {fsHold2 > 0 ? `${fsHold2}s` : "off"}
                      </span>
                    </div>
                    <input
                      type="range" min={0} max={10} step={1}
                      value={fsHold2}
                      onChange={(e) => setFsHold2(Number(e.target.value))}
                      className="w-full h-1 rounded-full accent-[#1a5c6b]"
                    />
                    <div className="flex justify-between mt-1">
                      <span className="text-[9px] text-white/20">off</span>
                      <span className="text-[9px] text-white/20">10s</span>
                    </div>
                  </div>
                </div>

                {/* Retention hold toggle */}
                <div className="flex items-center justify-between pt-1 border-t border-white/6">
                  <div>
                    <p className="text-xs text-white/50">Breath retention hold</p>
                    <p className="text-[10px] text-white/25 mt-0.5">Hold after each round, tap to release</p>
                  </div>
                  <button
                    onClick={() => setFsRetention((v) => !v)}
                    className={[
                      "relative w-10 h-5.5 rounded-full transition-colors duration-200 shrink-0 ml-4",
                      fsRetention ? "bg-[#1a5c6b]" : "bg-white/10",
                    ].join(" ")}
                    style={{ height: 22, width: 40 }}
                  >
                    <span
                      className="absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white transition-transform duration-200"
                      style={{ transform: fsRetention ? "translateX(18px)" : "translateX(0px)" }}
                    />
                  </button>
                </div>

                {/* Live pattern preview */}
                <p className="text-[10px] font-mono text-[#a8c8cf]/45 text-center pt-1">
                  {[
                    `${fsInhale}s inhale`,
                    ...(fsHold1 > 0 ? [`${fsHold1}s hold`] : []),
                    `${fsExhale}s exhale`,
                    ...(fsHold2 > 0 ? [`${fsHold2}s hold`] : []),
                    ...(fsRetention ? ["retention hold"] : []),
                  ].join(" → ")}
                </p>
              </div>
            )}
          </div>
        ))}
        </div>

        {/* Rounds selector */}
        <div className="rounded-2xl border border-white/8 bg-[#111111] px-5 py-4 mb-5">
          <p className="text-xs text-white/40 mb-3">Rounds</p>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setRounds(n)}
                className={[
                  "flex-1 py-2.5 rounded-xl text-sm font-medium transition-all",
                  rounds === n
                    ? "bg-[#1a5c6b] text-white"
                    : "border border-white/8 text-white/35 hover:border-white/18 hover:text-white/60",
                ].join(" ")}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={beginSession}
          className="w-full py-[18px] rounded-[14px] bg-[#1a5c6b] text-white font-semibold text-base hover:bg-[#1f6d80] active:bg-[#16505d] transition-colors"
        >
          Begin Session
        </button>
      </div>
    );
  }

  // ── SCREEN 2 — Active Breathing ───────────────────────────────────────────────
  if (screen === "breathing") {
    const RING = 280;
    return (
      <div className="flex flex-col items-center px-5 py-8 select-none">
        {/* Top row */}
        <div className="w-full max-w-xs flex items-center justify-between mb-10">
          <button
            onClick={handleEnd}
            className="w-10 h-10 flex items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white/40 hover:text-white/70 transition-colors"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
          <span className="text-xs text-white/28 tracking-wide">
            Round {round} of {totalRoundsRef.current}
          </span>
          <button
            onClick={() => setPaused((p) => !p)}
            className="w-10 h-10 flex items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white/40 hover:text-white/70 transition-colors"
          >
            {paused ? (
              <Play className="w-4 h-4 ml-0.5" strokeWidth={1.5} />
            ) : (
              <Pause className="w-4 h-4" strokeWidth={1.5} />
            )}
          </button>
        </div>

        {/* Phase label */}
        <p
          className={[
            "text-3xl font-light tracking-wide mb-8 min-h-[2.25rem] transition-colors duration-300",
            isHolding
              ? "text-[#a8c8cf]"
              : isInhaling
              ? "text-white/85"
              : "text-white/40",
          ].join(" ")}
        >
          {phaseLabel}
        </p>

        {/* Circle + progress ring */}
        <div
          className="relative flex items-center justify-center"
          style={{ width: RING, height: RING }}
        >
          <ProgressRing progress={ringProgress} size={RING} />
          <div
            className="rounded-full border border-white/[0.08] bg-white/[0.03]"
            style={{
              width: 216,
              height: 216,
              transform: `scale(${circleScale})`,
              transition: `transform ${circleTransMs}ms ease-in-out`,
              willChange: "transform",
              boxShadow: isHolding
                ? "0 0 64px 20px rgba(26,92,107,0.3)"
                : "none",
            }}
          />
        </div>

        {/* Counters */}
        <div className="mt-8 text-center space-y-1">
          <p className="text-sm text-white/30 tabular-nums">
            Breath {breath} / {modeRef.current.defaultBreaths}
          </p>
          <p className="text-xs text-white/18">
            Round {round} of {totalRoundsRef.current}
          </p>
        </div>
      </div>
    );
  }

  // ── SCREEN 3 — Breath Retention ───────────────────────────────────────────────
  if (screen === "retention") {
    return (
      <div
        className="flex flex-col items-center justify-center px-5 py-16 min-h-[75vh] select-none rounded-3xl mx-4 mt-4"
        style={{
          background: "linear-gradient(160deg, #0c3340 0%, #081e28 100%)",
        }}
      >
        <p className="text-[11px] uppercase tracking-[0.28em] text-[#a8c8cf]/55 mb-10">
          Hold your breath
        </p>
        <p className="text-8xl font-extralight text-white tabular-nums mb-14 leading-none">
          {fmtTime(retentionSec)}
        </p>
        <button
          onClick={handleRelease}
          className="px-14 py-5 rounded-[14px] bg-[#1a5c6b] text-white font-semibold text-base hover:bg-[#1f6d80] active:bg-[#16505d] transition-colors"
        >
          Release
        </button>
        <p className="text-xs text-white/20 mt-8">
          Round {round} of {totalRoundsRef.current}
        </p>
      </div>
    );
  }

  // ── SCREEN 4 — Session Complete ───────────────────────────────────────────────
  if (screen === "complete") {
    const holdTimes = holdTimesRef.current;
    const hasHolds = holdTimes.length > 0;
    const maxHold = hasHolds ? Math.max(...holdTimes, 1) : 1;
    const bestIdx = hasHolds
      ? holdTimes.indexOf(Math.max(...holdTimes))
      : -1;

    return (
      <div className="px-5 md:px-8 py-10 max-w-md mx-auto flex flex-col items-center">
        <p className="text-[10px] uppercase tracking-[0.22em] text-white/25 mb-2">
          Session Complete
        </p>
        <h2 className="text-3xl font-semibold text-white mb-1">Good job!</h2>
        <p className="text-sm text-white/35 mb-10">{fmtTime(totalDuration)} total</p>

        {hasHolds ? (
          /* Bar chart — one bar per round's retention hold */
          <div className="w-full rounded-2xl border border-white/8 bg-[#111111] px-5 pt-5 pb-4 mb-8">
            <p className="text-xs text-white/35 mb-5">Retention hold times</p>
            <div className="flex items-end gap-3" style={{ height: 100 }}>
              {holdTimes.map((t, i) => {
                const pct = t / maxHold;
                const isBest = i === bestIdx;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center">
                    <div
                      className="w-full flex items-end"
                      style={{ height: 72 }}
                    >
                      <div
                        className="w-full rounded-t-sm"
                        style={{
                          height: `${Math.max(pct * 100, 5)}%`,
                          backgroundColor: isBest ? "#1a5c6b" : "#a8c8cf",
                          opacity: isBest ? 1 : 0.45,
                        }}
                      />
                    </div>
                    <p className="text-[9px] text-white/28 mt-1.5 tabular-nums">
                      {fmtTime(t)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Box / 4-7-8 — show rounds + duration instead */
          <div className="w-full rounded-2xl border border-white/8 bg-[#111111] px-5 py-5 mb-8 flex gap-8">
            <div>
              <p className="text-[9px] uppercase tracking-[0.18em] text-white/22 mb-1.5">
                Rounds
              </p>
              <p className="text-2xl font-semibold text-white/80">
                {totalRoundsRef.current}
              </p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-[0.18em] text-white/22 mb-1.5">
                Duration
              </p>
              <p className="text-2xl font-semibold text-white/80">
                {fmtTime(totalDuration)}
              </p>
            </div>
          </div>
        )}

        <div className="flex gap-3 w-full">
          <button
            className="flex-1 py-[18px] rounded-[14px] border border-white/10 bg-white/[0.03] text-white/45 font-medium hover:bg-white/[0.06] transition-colors"
            onClick={() => {
              if (typeof navigator !== "undefined" && navigator.share) {
                navigator
                  .share({
                    title: "Flowstate Breathwork",
                    text: `Completed ${selectedMode.name} — ${fmtTime(totalDuration)} session!`,
                  })
                  .catch(() => {});
              }
            }}
          >
            Share
          </button>
          <button
            onClick={() => setScreen("select")}
            className="flex-1 py-[18px] rounded-[14px] bg-[#1a5c6b] text-white font-semibold hover:bg-[#1f6d80] transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return null;
}
