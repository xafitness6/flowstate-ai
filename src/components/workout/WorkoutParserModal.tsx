"use client";

import { useState } from "react";
import { X, ClipboardList, AlertTriangle, Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ParsedWorkout, ParsedWorkoutExercise } from "@/lib/workout-parser/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExerciseRow {
  id:    string;
  name:  string;
  sets:  string;
  reps:  string;
  load:  string;
  notes: string;
}

interface ConfirmPayload {
  exercises:  ExerciseRow[];
  bodyFocus:  string;
  duration:   string;
  notes:      string;
  confidence: number;
}

interface WorkoutParserModalProps {
  onConfirm: (payload: ConfirmPayload) => void;
  onCancel:  () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeId() {
  return `ex_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
}

function toExerciseRow(ex: ParsedWorkoutExercise): ExerciseRow {
  const noteParts: string[] = [];
  if (ex.tempo) noteParts.push(`tempo ${ex.tempo}`);
  if (ex.rest)  noteParts.push(`${ex.rest}s rest`);
  if (ex.notes) noteParts.push(ex.notes);
  return {
    id:    makeId(),
    name:  ex.name,
    sets:  String(ex.sets),
    reps:  ex.reps,
    load:  ex.load ?? "",
    notes: noteParts.join(" · "),
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ExercisePreviewCard({ ex }: { ex: ParsedWorkoutExercise }) {
  const lowConf = ex.confidence < 0.7;
  return (
    <div className={cn(
      "rounded-xl border px-4 py-3 space-y-2 transition-colors",
      lowConf
        ? "border-amber-500/40 bg-amber-500/[0.04]"
        : "border-white/[0.07] bg-white/[0.02]",
    )}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-white/85">{ex.name}</span>
        {lowConf && (
          <span className="flex items-center gap-1 text-[10px] text-amber-400/80 shrink-0 mt-0.5">
            <AlertTriangle className="w-3 h-3" strokeWidth={2} />
            Verify
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Chip label="Sets" value={String(ex.sets)} />
        <Chip label="Reps" value={ex.reps} />
        {ex.load  && <Chip label="Load"  value={ex.load} />}
        {ex.tempo && <Chip label="Tempo" value={ex.tempo} />}
        {ex.rest  && <Chip label="Rest"  value={`${ex.rest}s`} />}
      </div>
      {ex.notes && (
        <p className="text-[11px] text-white/35 italic">{ex.notes}</p>
      )}
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1 bg-white/[0.05] border border-white/8 rounded-lg px-2 py-1">
      <span className="text-[9px] uppercase tracking-[0.12em] text-white/30">{label}</span>
      <span className="text-[11px] text-white/70">{value}</span>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export function WorkoutParserModal({ onConfirm, onCancel }: WorkoutParserModalProps) {
  const [step,    setStep   ] = useState<"input" | "loading" | "preview">("input");
  const [text,    setText   ] = useState("");
  const [parsed,  setParsed ] = useState<ParsedWorkout | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  async function handleParse() {
    if (!text.trim()) return;
    setApiError(null);
    setStep("loading");

    try {
      const res  = await fetch("/api/ai/workout-parser", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ mode: "parse", text: text.trim() }),
      });
      const data = await res.json() as ParsedWorkout & { error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "Parse failed");
      setParsed(data);
      setStep("preview");
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Something went wrong");
      setStep("input");
    }
  }

  function handleConfirm() {
    if (!parsed) return;
    onConfirm({
      exercises:  parsed.exercises.map(toExerciseRow),
      bodyFocus:  parsed.bodyFocus,
      duration:   parsed.duration ? String(parsed.duration) : "",
      notes:      parsed.notes ?? "",
      confidence: parsed.confidence,
    });
  }

  const lowOverallConf = parsed && parsed.confidence < 0.7;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-[#111111] border border-white/[0.08] rounded-2xl overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <ClipboardList className="w-4 h-4 text-[#5B8DEF]/70" strokeWidth={1.5} />
            <span className="text-sm font-semibold text-white/80">Paste Workout</span>
          </div>
          <button
            onClick={onCancel}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/[0.05] transition-all"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5">

          {/* ── Input step ── */}
          {step === "input" && (
            <div className="space-y-4">
              <p className="text-xs text-white/40">
                Paste any workout — plain English, app exports, Notes app format. AI will parse it into your form.
              </p>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={"Push day\nBench 4x8 @ 225\nOHP 3x10\nIncline DB press 3x12 tempo 3-1-1-0"}
                rows={8}
                autoFocus
                className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/22 outline-none focus:border-white/20 transition-all resize-none font-mono"
              />
              {apiError && (
                <p className="text-xs text-red-400/70">{apiError}</p>
              )}
              <button
                onClick={handleParse}
                disabled={!text.trim()}
                className={cn(
                  "w-full rounded-xl py-3 text-sm font-bold flex items-center justify-center gap-2 transition-all",
                  text.trim()
                    ? "bg-[#5B8DEF] text-white hover:bg-[#6b9aff] active:scale-[0.98]"
                    : "bg-white/5 text-white/25 cursor-not-allowed",
                )}
              >
                Parse Workout
                <ChevronRight className="w-4 h-4" strokeWidth={2.5} />
              </button>
            </div>
          )}

          {/* ── Loading step ── */}
          {step === "loading" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="w-8 h-8 rounded-full border-2 border-[#5B8DEF]/30 border-t-[#5B8DEF] animate-spin" />
              <p className="text-sm text-white/40">Parsing your workout…</p>
            </div>
          )}

          {/* ── Preview step ── */}
          {step === "preview" && parsed && (
            <div className="space-y-4">

              {/* Low confidence banner */}
              {lowOverallConf && (
                <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.06]">
                  <AlertTriangle className="w-4 h-4 text-amber-400/80 shrink-0 mt-0.5" strokeWidth={1.5} />
                  <p className="text-xs text-amber-400/80">
                    Low confidence ({Math.round(parsed.confidence * 100)}%) — review all exercises before saving.
                  </p>
                </div>
              )}

              {/* Workout meta */}
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-white/80">{parsed.workoutName}</p>
                  <p className="text-[11px] text-white/35 mt-0.5">
                    {parsed.bodyFocus}
                    {parsed.duration ? ` · ~${parsed.duration} min` : ""}
                    {!lowOverallConf ? ` · ${Math.round(parsed.confidence * 100)}% confidence` : ""}
                  </p>
                </div>
                <span className={cn(
                  "flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border",
                  lowOverallConf
                    ? "border-amber-500/30 bg-amber-500/[0.06] text-amber-400/70"
                    : "border-emerald-500/25 bg-emerald-500/[0.05] text-emerald-400/70",
                )}>
                  {lowOverallConf
                    ? <AlertTriangle className="w-3 h-3" strokeWidth={2} />
                    : <Check className="w-3 h-3" strokeWidth={2.5} />}
                  {Math.round(parsed.confidence * 100)}%
                </span>
              </div>

              {/* Exercise list */}
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {parsed.exercises.map((ex, i) => (
                  <ExercisePreviewCard key={i} ex={ex} />
                ))}
              </div>

              {parsed.notes && (
                <p className="text-xs text-white/35 italic px-1">{parsed.notes}</p>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setStep("input")}
                  className="flex-1 rounded-xl py-2.5 text-sm text-white/45 border border-white/8 hover:border-white/15 hover:text-white/60 transition-all"
                >
                  ← Edit
                </button>
                <button
                  onClick={handleConfirm}
                  className="flex-[2] rounded-xl py-2.5 text-sm font-bold bg-[#B48B40] text-black hover:bg-[#c99840] active:scale-[0.98] transition-all"
                >
                  Use this workout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
