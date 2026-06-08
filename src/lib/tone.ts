"use client";

// App-wide personalized tone.
//
// The athlete's coaching voice is set in two localStorage keys (same ones the
// AI coach reads): `coach-intensity` (1 gentle → 5 militant) and
// `coach-strong-language` (opt-in profanity). This module turns those prefs
// into UI copy — loading screens, working states, encouragement — so the whole
// app speaks in the voice the athlete chose, not one flat default.
//
// Server code must NOT import this (localStorage). For AI prompts, pass
// intensity/allowStrongLanguage to the route instead.

import { useEffect, useState } from "react";

export interface Tone {
  intensity: number;        // 1–5
  strongLanguage: boolean;
}

export const DEFAULT_TONE: Tone = { intensity: 3, strongLanguage: false };

/** Read the tone prefs synchronously from localStorage (client only). */
export function readTone(): Tone {
  if (typeof window === "undefined") return DEFAULT_TONE;
  try {
    const rawI = localStorage.getItem("coach-intensity");
    const rawL = localStorage.getItem("coach-strong-language");
    const intensity = rawI != null ? Number(JSON.parse(rawI)) : 3;
    const strongLanguage = rawL != null ? JSON.parse(rawL) === true : false;
    return {
      intensity: Number.isFinite(intensity) ? Math.min(5, Math.max(1, Math.round(intensity))) : 3,
      strongLanguage,
    };
  } catch {
    return DEFAULT_TONE;
  }
}

/** React hook — hydrates after mount to avoid SSR mismatch. */
export function useTone(): Tone {
  const [tone, setTone] = useState<Tone>(DEFAULT_TONE);
  useEffect(() => { setTone(readTone()); }, []);
  return tone;
}

// ─── Loading / working copy ─────────────────────────────────────────────────

export type ToneContext = "buildProgram" | "analyzing" | "saving" | "thinking" | "generic";

// Tiered by intensity band: gentle (1–2), balanced (3), hard (4–5). Strong
// language only ever appears in the hard band and only when opted in.
type Band = "gentle" | "balanced" | "hard";
function band(intensity: number): Band {
  if (intensity <= 2) return "gentle";
  if (intensity === 3) return "balanced";
  return "hard";
}

const COPY: Record<ToneContext, Record<Band, { clean: string[]; strong: string[] }>> = {
  buildProgram: {
    gentle: {
      clean: [
        "Reading your answers, no rush…",
        "Shaping a plan that fits your life…",
        "Choosing movements you'll actually enjoy…",
        "Balancing effort with recovery…",
        "Almost there — making it sustainable…",
      ],
      strong: [],
    },
    balanced: {
      clean: [
        "Reading your calibration…",
        "Synthesizing your training split…",
        "Calibrating intensity to your push level…",
        "Balancing volume against recovery…",
        "Dialing in macros and meal timing…",
        "Stress-testing week 4…",
        "Polishing the final block…",
      ],
      strong: [],
    },
    hard: {
      clean: [
        "No fluff — building your split…",
        "Loading the volume you can actually handle…",
        "Setting progressions that won't let you coast…",
        "Hard-wiring week-over-week overload…",
        "Locking in the work. This one means business…",
        "Final block — no easy weeks hidden in here…",
      ],
      strong: [
        "No fluff — building your damn split…",
        "Loading the volume you can actually handle…",
        "These progressions won't let you coast, period…",
        "Hard-wiring the overload — no hiding now…",
        "Locking it in. Time to lock the fuck in…",
        "Final block. This is the one that builds you…",
      ],
    },
  },
  analyzing: {
    gentle: { clean: ["Taking a careful look…", "Reading the details…", "Making sense of it…"], strong: [] },
    balanced: { clean: ["Analyzing…", "Crunching the numbers…", "Reading the data…"], strong: [] },
    hard: {
      clean: ["Breaking it down — no guesswork…", "Reading every number…", "Pulling the real signal out…"],
      strong: ["Breaking it down — no bullshit…", "Reading every damn number…", "Pulling the real signal out…"],
    },
  },
  saving: {
    gentle: { clean: ["Saving your changes…", "Tucking that away…"], strong: [] },
    balanced: { clean: ["Saving…", "Locking it in…"], strong: [] },
    hard: { clean: ["Locking it in…", "Done deal — saving…"], strong: ["Locking it the hell in…", "Done deal — saving…"] },
  },
  thinking: {
    gentle: { clean: ["Thinking it through…", "One sec…"], strong: [] },
    balanced: { clean: ["Thinking…", "Working on it…"], strong: [] },
    hard: { clean: ["Working it out…", "On it…"], strong: ["Working it the hell out…", "On it…"] },
  },
  generic: {
    gentle: { clean: ["Just a moment…", "Almost there…"], strong: [] },
    balanced: { clean: ["Working…", "One moment…"], strong: [] },
    hard: { clean: ["On it — hang tight…", "Almost there…"], strong: ["On it — hang tight…", "Almost there…"] },
  },
};

/** Loading messages tuned to the athlete's tone. Always returns ≥1 line. */
export function toneLoadingMessages(context: ToneContext, tone: Tone = DEFAULT_TONE): string[] {
  const b = band(tone.intensity);
  const set = COPY[context][b];
  const lines = tone.strongLanguage && set.strong.length ? set.strong : set.clean;
  return lines.length ? lines : COPY[context].balanced.clean;
}

/** A single short working label for inline spinners. */
export function toneWorkingLabel(context: ToneContext, tone: Tone = DEFAULT_TONE): string {
  return toneLoadingMessages(context, tone)[0];
}
