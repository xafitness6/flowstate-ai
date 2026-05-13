"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Pause, Play } from "lucide-react";
import { useUser } from "@/context/UserContext";
import { recordActivity } from "@/lib/activity";

// ─── Types ────────────────────────────────────────────────────────────────────

type ModeId = "freestyle" | "basics" | "power" | "box" | "478" | "endurance";
type BreathPhase = "inhale" | "hold1" | "exhale" | "hold2";
// recovery = automatic 15s inhale between rounds
type Screen = "select" | "breathing" | "recovery" | "complete";

interface Mode {
  id: ModeId;
  name: string;
  description: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced" | "Custom";
  pattern: string;
  defaultBreaths: number;
  defaultRounds: number;
  inhaleMs: number;
  hold1Ms: number;
  exhaleMs: number;
  hold2Ms: number;
}

// Freestyle first so it appears at the top
const MODES: Mode[] = [
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
  },
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
  },
];

const RECOVERY_SECS = 15;

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
      style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)", pointerEvents: "none" }}
    >
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={sw} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke="#1a5c6b" strokeWidth={sw}
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.min(Math.max(progress, 0), 1))}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.5s ease" }}
      />
    </svg>
  );
}

// ─── Slider row ───────────────────────────────────────────────────────────────

function SliderRow({
  label, value, min, max, step, unit, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number;
  unit?: string; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs text-white/45">{label}</span>
        <span className="text-xs font-semibold text-white/70 tabular-nums">
          {value}{unit ?? ""}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1 rounded-full accent-[#1a5c6b]"
      />
      <div className="flex justify-between mt-1">
        <span className="text-[9px] text-white/20">{min}{unit ?? ""}</span>
        <span className="text-[9px] text-white/20">{max}{unit ?? ""}</span>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BreathworkPage() {
  const router = useRouter();
  const { user, isLoading, isSupabase } = useUser();
  const [ready, setReady] = useState(false);

  // Auth guard
  useEffect(() => {
    if (isLoading) return;
    if (isSupabase) {
      setReady(true);
      return;
    }
    try {
      const role = sessionStorage.getItem("flowstate-session-role") || localStorage.getItem("flowstate-active-role");
      if (!["master", "trainer", "client", "member"].includes(role ?? "")) { router.replace("/login"); return; }
    } catch { router.replace("/login"); return; }
    setReady(true);
  }, [isLoading, isSupabase, router]);

  // ── Selection state ───────────────────────────────────────────────────────────
  const [screen, setScreen]           = useState<Screen>("select");
  const [selectedMode, setSelectedMode] = useState<Mode>(MODES[0]);

  // Per-mode customisation (reset when mode changes)
  const [customBreaths, setCustomBreaths] = useState(MODES[0].defaultBreaths);
  const [customRounds, setCustomRounds]   = useState(MODES[0].defaultRounds);

  // Freestyle-specific timings
  const [fsInhale, setFsInhale] = useState(5);
  const [fsExhale, setFsExhale] = useState(5);
  const [fsHold1, setFsHold1]   = useState(0);
  const [fsHold2, setFsHold2]   = useState(0);

  function selectMode(mode: Mode) {
    setSelectedMode(mode);
    setCustomBreaths(mode.defaultBreaths);
    setCustomRounds(mode.defaultRounds);
  }

  // Build the effective Mode object for a session
  function buildEffectiveMode(): Mode {
    if (selectedMode.id === "freestyle") {
      const patternParts = [`${fsInhale}s in`];
      if (fsHold1 > 0) patternParts.push(`${fsHold1}s hold`);
      patternParts.push(`${fsExhale}s out`);
      if (fsHold2 > 0) patternParts.push(`${fsHold2}s hold`);
      return {
        ...selectedMode,
        pattern:       patternParts.join(" / "),
        defaultBreaths: customBreaths,
        inhaleMs:  fsInhale * 1000,
        hold1Ms:   fsHold1 * 1000,
        exhaleMs:  fsExhale * 1000,
        hold2Ms:   fsHold2 * 1000,
      };
    }
    return { ...selectedMode, defaultBreaths: customBreaths };
  }

  // ── Breathing session state ───────────────────────────────────────────────────
  const [subPhase, setSubPhase] = useState<BreathPhase>("inhale");
  const [breath, setBreath]     = useState(1);
  const [round, setRound]       = useState(1);
  const [paused, setPaused]     = useState(false);

  // Session-scoped refs — locked in at beginSession
  const modeRef         = useRef<Mode>(MODES[0]);
  const totalRoundsRef  = useRef(3);
  const timerRef        = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionStartRef = useRef(0);

  // ── Recovery (auto 15s inhale between rounds) ─────────────────────────────────
  const [recoverySec, setRecoverySec] = useState(RECOVERY_SECS);
  const recoveryRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Complete ──────────────────────────────────────────────────────────────────
  const [totalDuration, setTotalDuration] = useState(0);

  // ── Helpers ───────────────────────────────────────────────────────────────────
  function clearTimer() {
    if (timerRef.current !== null) { clearTimeout(timerRef.current); timerRef.current = null; }
  }
  function clearRecovery() {
    if (recoveryRef.current !== null) { clearInterval(recoveryRef.current); recoveryRef.current = null; }
  }

  function finishSession() {
    clearTimer();
    clearRecovery();
    setTotalDuration(Math.round((Date.now() - sessionStartRef.current) / 1000));
    setScreen("complete");
    try { if (user?.id) recordActivity(user.id, "Breathwork session"); } catch {}
  }

  // Called when exhale (or hold2) completes.
  function advanceFromExhale(curBreath: number, curRound: number) {
    if (curBreath < modeRef.current.defaultBreaths) {
      setBreath(curBreath + 1);
      setSubPhase("inhale");
    } else if (curRound < totalRoundsRef.current) {
      // Round done — go to auto-recovery inhale
      clearTimer();
      setRecoverySec(RECOVERY_SECS);
      setScreen("recovery");
    } else {
      finishSession();
    }
  }

  // ── Breathing timer ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== "breathing" || paused) { clearTimer(); return; }

    const mode = modeRef.current;
    let durationMs: number;
    if (subPhase === "inhale")      durationMs = mode.inhaleMs;
    else if (subPhase === "hold1")  durationMs = mode.hold1Ms;
    else if (subPhase === "exhale") durationMs = mode.exhaleMs;
    else                            durationMs = mode.hold2Ms;

    const curSubPhase = subPhase;
    const curBreath   = breath;
    const curRound    = round;

    timerRef.current = setTimeout(() => {
      if (curSubPhase === "inhale") { setSubPhase(mode.hold1Ms > 0 ? "hold1" : "exhale"); return; }
      if (curSubPhase === "hold1")  { setSubPhase("exhale"); return; }
      if (curSubPhase === "exhale") {
        if (mode.hold2Ms > 0) { setSubPhase("hold2"); return; }
        advanceFromExhale(curBreath, curRound); return;
      }
      advanceFromExhale(curBreath, curRound); // hold2 done
    }, durationMs);

    return clearTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, subPhase, breath, round, paused]);

  // ── Recovery timer (auto 15s countdown → next round) ─────────────────────────
  useEffect(() => {
    if (screen !== "recovery") { clearRecovery(); return; }

    let remaining = RECOVERY_SECS;
    recoveryRef.current = setInterval(() => {
      remaining -= 1;
      setRecoverySec(remaining);
      if (remaining <= 0) {
        clearInterval(recoveryRef.current!);
        recoveryRef.current = null;
        setRound((r) => r + 1);
        setBreath(1);
        setSubPhase("inhale");
        setScreen("breathing");
      }
    }, 1000);

    return clearRecovery;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  // ── Begin / End ───────────────────────────────────────────────────────────────
  function beginSession() {
    modeRef.current        = buildEffectiveMode();
    totalRoundsRef.current = customRounds;
    sessionStartRef.current = Date.now();
    setBreath(1);
    setRound(1);
    setSubPhase("inhale");
    setPaused(false);
    setScreen("breathing");
  }

  function handleEnd() {
    clearTimer();
    clearRecovery();
    setPaused(false);
    setScreen("select");
  }

  // ── Derived display ───────────────────────────────────────────────────────────
  const isHolding  = screen === "breathing" && (subPhase === "hold1" || subPhase === "hold2");
  const isInhaling = screen === "breathing" && subPhase === "inhale";

  const circleScale = (() => {
    if (screen === "recovery")  return 1.0;
    if (screen !== "breathing") return 0.72;
    if (subPhase === "inhale")  return 1.0;
    if (subPhase === "hold1")   return 1.0;
    if (subPhase === "hold2")   return 0.68;
    return 0.68;
  })();

  const circleTransMs = (() => {
    if (screen === "recovery")   return RECOVERY_SECS * 1000;
    if (screen !== "breathing")  return 600;
    if (subPhase === "inhale")   return modeRef.current.inhaleMs;
    if (subPhase === "exhale")   return modeRef.current.exhaleMs;
    return 300;
  })();

  const phaseLabel = (() => {
    if (screen === "recovery") return "Recovery Breath";
    if (paused)                return "Paused";
    if (screen !== "breathing") return "";
    if (subPhase === "inhale") return "Inhale";
    if (subPhase === "hold1" || subPhase === "hold2") return "Hold";
    return "Exhale";
  })();

  const ringProgress = screen === "breathing"
    ? (breath - 1) / modeRef.current.defaultBreaths : 0;

  if (!ready) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-5 text-white">
        <div className="text-center space-y-2">
          <div className="mx-auto h-6 w-6 rounded-full border border-[#B48B40]/25 border-t-[#B48B40] animate-spin" />
          <p className="text-sm text-white/55">Opening breathwork...</p>
        </div>
      </div>
    );
  }

  // ── SCREEN 1 — Mode Selection ─────────────────────────────────────────────────
  if (screen === "select") {
    const isFS = selectedMode.id === "freestyle";
    return (
      <div className="px-5 md:px-8 py-6 max-w-lg mx-auto">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.22em] text-white/25 mb-1.5">Recovery</p>
          <h1 className="text-3xl font-semibold tracking-tight text-white">Breathwork</h1>
        </div>

        {/* Mode cards */}
        <div className="space-y-2 mb-5">
          {MODES.map((mode) => {
            const isSelected = selectedMode.id === mode.id;
            return (
              <div key={mode.id}>
                {/* Card */}
                <button
                  onClick={() => selectMode(mode)}
                  className={[
                    "w-full text-left rounded-2xl border px-5 py-4 transition-all duration-200",
                    isSelected
                      ? "border-[#1a5c6b]/50 bg-[#1a5c6b]/10"
                      : "border-white/8 bg-[#111111] hover:border-white/14",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between mb-1">
                    <span className="text-sm font-semibold text-white/85">{mode.name}</span>
                    <span className={[
                      "text-[9px] uppercase tracking-[0.15em] px-2 py-0.5 rounded-full ml-2 shrink-0",
                      mode.difficulty === "Beginner"     ? "bg-emerald-500/15 text-emerald-400/70"
                      : mode.difficulty === "Intermediate" ? "bg-amber-500/15 text-amber-400/70"
                      : mode.difficulty === "Custom"       ? "bg-[#1a5c6b]/30 text-[#a8c8cf]/80"
                      : "bg-red-500/15 text-red-400/70",
                    ].join(" ")}>
                      {mode.difficulty}
                    </span>
                  </div>
                  <p className="text-xs text-white/38 mb-1.5">{mode.description}</p>
                  {mode.id !== "freestyle" && (
                    <p className="text-[10px] font-mono text-[#a8c8cf]/50">{mode.pattern}</p>
                  )}
                </button>

                {/* Expanded config — visible when this mode is selected */}
                {isSelected && (
                  <div
                    className="rounded-2xl border border-[#1a5c6b]/30 bg-[#1a5c6b]/5 px-5 py-4 mt-1 space-y-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Rounds picker (all modes) */}
                    <div>
                      <p className="text-xs text-white/45 mb-2.5">Rounds</p>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            onClick={() => setCustomRounds(n)}
                            className={[
                              "flex-1 py-2 rounded-xl text-sm font-medium transition-all",
                              customRounds === n
                                ? "bg-[#1a5c6b] text-white"
                                : "border border-white/8 text-white/35 hover:border-white/18 hover:text-white/60",
                            ].join(" ")}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Breaths per round (all modes) */}
                    <SliderRow
                      label="Breaths per round"
                      value={customBreaths}
                      min={mode.id === "box" || mode.id === "478" ? 1 : 5}
                      max={mode.id === "box" || mode.id === "478" ? 10 : 60}
                      step={mode.id === "box" || mode.id === "478" ? 1 : 5}
                      onChange={setCustomBreaths}
                    />

                    {/* Freestyle-only: timing sliders */}
                    {isFS && (
                      <>
                        <div className="border-t border-white/6 pt-3 space-y-4">
                          <div className="grid grid-cols-2 gap-3">
                            <SliderRow label="Inhale" value={fsInhale} min={1} max={12} step={1} unit="s" onChange={setFsInhale} />
                            <SliderRow label="Exhale" value={fsExhale} min={1} max={12} step={1} unit="s" onChange={setFsExhale} />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-xs text-white/45">Hold (after in)</span>
                                <span className="text-xs font-semibold text-white/70">{fsHold1 > 0 ? `${fsHold1}s` : "off"}</span>
                              </div>
                              <input type="range" min={0} max={10} step={1} value={fsHold1}
                                onChange={(e) => setFsHold1(Number(e.target.value))}
                                className="w-full h-1 rounded-full accent-[#1a5c6b]" />
                              <div className="flex justify-between mt-1">
                                <span className="text-[9px] text-white/20">off</span>
                                <span className="text-[9px] text-white/20">10s</span>
                              </div>
                            </div>
                            <div>
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-xs text-white/45">Hold (after out)</span>
                                <span className="text-xs font-semibold text-white/70">{fsHold2 > 0 ? `${fsHold2}s` : "off"}</span>
                              </div>
                              <input type="range" min={0} max={10} step={1} value={fsHold2}
                                onChange={(e) => setFsHold2(Number(e.target.value))}
                                className="w-full h-1 rounded-full accent-[#1a5c6b]" />
                              <div className="flex justify-between mt-1">
                                <span className="text-[9px] text-white/20">off</span>
                                <span className="text-[9px] text-white/20">10s</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Live pattern preview */}
                        <p className="text-[10px] font-mono text-[#a8c8cf]/45 text-center">
                          {[
                            `${fsInhale}s inhale`,
                            ...(fsHold1 > 0 ? [`${fsHold1}s hold`] : []),
                            `${fsExhale}s exhale`,
                            ...(fsHold2 > 0 ? [`${fsHold2}s hold`] : []),
                          ].join(" → ")}
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
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
            {paused
              ? <Play className="w-4 h-4 ml-0.5" strokeWidth={1.5} />
              : <Pause className="w-4 h-4" strokeWidth={1.5} />}
          </button>
        </div>

        {/* Phase label */}
        <p className={[
          "text-3xl font-light tracking-wide mb-8 min-h-[2.25rem] transition-colors duration-300",
          isHolding ? "text-[#a8c8cf]" : isInhaling ? "text-white/85" : "text-white/40",
        ].join(" ")}>
          {phaseLabel}
        </p>

        {/* Circle + progress ring */}
        <div className="relative flex items-center justify-center" style={{ width: RING, height: RING }}>
          <ProgressRing progress={ringProgress} size={RING} />
          <div
            className="rounded-full border border-white/[0.08] bg-white/[0.03]"
            style={{
              width: 216, height: 216,
              transform: `scale(${circleScale})`,
              transition: `transform ${circleTransMs}ms ease-in-out`,
              willChange: "transform",
              boxShadow: isHolding ? "0 0 64px 20px rgba(26,92,107,0.3)" : "none",
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

  // ── SCREEN 3 — Recovery Breath (auto 15s between rounds) ──────────────────────
  if (screen === "recovery") {
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
          <span className="text-xs text-white/28 tracking-wide">Recovery</span>
          <div className="w-10" />
        </div>

        {/* Label */}
        <p className="text-3xl font-light tracking-wide mb-8 text-[#a8c8cf]">
          Recovery Breath
        </p>

        {/* Circle — slowly expands over 15s */}
        <div className="relative flex items-center justify-center" style={{ width: RING, height: RING }}>
          <div
            className="rounded-full border border-white/[0.08] bg-white/[0.03]"
            style={{
              width: 216, height: 216,
              transform: `scale(${circleScale})`,
              transition: `transform ${circleTransMs}ms ease-in-out`,
              willChange: "transform",
              boxShadow: "0 0 64px 20px rgba(26,92,107,0.2)",
            }}
          />
        </div>

        {/* Countdown */}
        <div className="mt-8 text-center space-y-1">
          <p className="text-4xl font-extralight text-white/60 tabular-nums">
            {recoverySec}
          </p>
          <p className="text-xs text-white/25">
            Round {round + 1} of {totalRoundsRef.current} begins automatically
          </p>
        </div>
      </div>
    );
  }

  // ── SCREEN 4 — Session Complete ───────────────────────────────────────────────
  if (screen === "complete") {
    return (
      <div className="px-5 md:px-8 py-10 max-w-md mx-auto flex flex-col items-center">
        <p className="text-[10px] uppercase tracking-[0.22em] text-white/25 mb-2">Session Complete</p>
        <h2 className="text-3xl font-semibold text-white mb-1">Good job!</h2>
        <p className="text-sm text-white/35 mb-10">{fmtTime(totalDuration)} total</p>

        <div className="w-full rounded-2xl border border-white/8 bg-[#111111] px-5 py-5 mb-8 flex gap-8">
          <div>
            <p className="text-[9px] uppercase tracking-[0.18em] text-white/22 mb-1.5">Mode</p>
            <p className="text-base font-semibold text-white/80">{modeRef.current.name}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-[0.18em] text-white/22 mb-1.5">Rounds</p>
            <p className="text-2xl font-semibold text-white/80">{totalRoundsRef.current}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-[0.18em] text-white/22 mb-1.5">Duration</p>
            <p className="text-2xl font-semibold text-white/80">{fmtTime(totalDuration)}</p>
          </div>
        </div>

        <div className="flex gap-3 w-full">
          <button
            className="flex-1 py-[18px] rounded-[14px] border border-white/10 bg-white/[0.03] text-white/45 font-medium hover:bg-white/[0.06] transition-colors"
            onClick={() => {
              if (typeof navigator !== "undefined" && navigator.share) {
                navigator.share({
                  title: "Flowstate Breathwork",
                  text: `Completed ${modeRef.current.name} — ${fmtTime(totalDuration)} session!`,
                }).catch(() => {});
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
