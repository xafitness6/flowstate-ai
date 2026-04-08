"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Mic, Plus, Trash2, Check, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/context/UserContext";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { VoiceReviewModal } from "@/components/voice/VoiceReviewModal";
import { VoiceMic } from "@/components/voice/VoiceMic";
import { parseWorkoutFromTranscript, type ParsedExercise } from "@/lib/voiceParser";
import { saveVoiceEntry } from "@/lib/voiceLogs";
import { saveWorkoutLog, type WorkoutLog, type ExerciseLog } from "@/lib/workout";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExerciseRow {
  id:    string;
  name:  string;
  sets:  string;
  reps:  string;
  load:  string;
  notes: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeId() {
  return `ex_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
}

function blankRow(): ExerciseRow {
  return { id: makeId(), name: "", sets: "3", reps: "10", load: "", notes: "" };
}

const BODY_FOCUS_OPTIONS = [
  "Push / Chest", "Pull / Back", "Legs", "Shoulders", "Arms", "Core",
  "Full Body", "Cardio", "Upper Body", "Lower Body",
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function ExerciseRowUI({
  row, onChange, onRemove,
}: {
  row: ExerciseRow;
  onChange: (id: string, field: keyof ExerciseRow, value: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-4 space-y-3">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={row.name}
          onChange={(e) => onChange(row.id, "name", e.target.value)}
          placeholder="Exercise name"
          className="flex-1 bg-transparent text-sm text-white/80 placeholder:text-white/22 outline-none border-b border-white/10 focus:border-white/25 pb-0.5 transition-colors"
        />
        <button
          type="button"
          onClick={() => onRemove(row.id)}
          className="text-white/18 hover:text-red-400/60 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {(["sets", "reps", "load"] as const).map((field) => (
          <div key={field} className="space-y-1">
            <label className="text-[10px] uppercase tracking-[0.14em] text-white/25">
              {field === "load" ? "Load (kg)" : field}
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={row[field]}
              onChange={(e) => onChange(row.id, field, e.target.value)}
              placeholder={field === "load" ? "—" : field === "sets" ? "3" : "10"}
              className="w-full bg-white/[0.04] border border-white/8 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder:text-white/22 outline-none focus:border-white/20 transition-colors"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FreestyleWorkoutPage() {
  const router     = useRouter();
  const { user }   = useUser();
  const voice      = useVoiceInput();

  const [showVoice,   setShowVoice  ] = useState(false);
  const [bodyFocus,   setBodyFocus  ] = useState("Full Body");
  const [exercises,   setExercises  ] = useState<ExerciseRow[]>([blankRow()]);
  const [duration,    setDuration   ] = useState("");
  const [notes,       setNotes      ] = useState("");
  const [saving,      setSaving     ] = useState(false);
  const [saved,       setSaved      ] = useState(false);
  const [parseConf,   setParseConf  ] = useState<number | null>(null);

  // ── Voice confirm → populate form ──────────────────────────────────────────
  const handleVoiceConfirm = useCallback(() => {
    if (!voice.transcript.trim()) return;

    const parsed = parseWorkoutFromTranscript(voice.transcript);
    setParseConf(parsed.confidence);

    if (parsed.bodyFocus) setBodyFocus(parsed.bodyFocus);
    if (parsed.durationMins) setDuration(String(parsed.durationMins));
    if (parsed.notes) setNotes(parsed.notes);

    const rows: ExerciseRow[] = parsed.exercises.length > 0
      ? parsed.exercises.map((ex: ParsedExercise) => ({
          id:    makeId(),
          name:  ex.name,
          sets:  ex.sets ? String(ex.sets) : "3",
          reps:  ex.reps ?? "10",
          load:  ex.load ?? "",
          notes: ex.notes ?? "",
        }))
      : [blankRow()];

    setExercises(rows);
    setShowVoice(false);
    voice.reset();
  }, [voice]);

  // ── Exercise row edits ────────────────────────────────────────────────────
  function changeRow(id: string, field: keyof ExerciseRow, value: string) {
    setExercises((prev) => prev.map((r) => r.id === id ? { ...r, [field]: value } : r));
  }
  function removeRow(id: string) {
    setExercises((prev) => prev.filter((r) => r.id !== id));
  }
  function addRow() {
    setExercises((prev) => [...prev, blankRow()]);
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  function handleSave() {
    setSaving(true);

    // Save voice entry if we used voice
    let voiceEntryId: string | undefined;
    if (voice.transcript || notes) {
      const ve = saveVoiceEntry(user.id, {
        userId:    user.id,
        entryType: "freestyle_workout",
        transcript: voice.transcript || notes,
        confidence: voice.confidence,
        parsedData: voice.transcript
          ? parseWorkoutFromTranscript(voice.transcript)
          : null,
      });
      voiceEntryId = ve.id;
    }

    const now = Date.now();
    const setsCompleted = exercises.reduce((sum, r) => sum + (parseInt(r.sets) || 0), 0);

    const exerciseLogs: ExerciseLog[] = exercises
      .filter((r) => r.name.trim())
      .map((r, i) => ({
        exerciseId: `freestyle_${i}`,
        name:       r.name.trim(),
        setLogs:    Array.from({ length: parseInt(r.sets) || 1 }, (_, si) => ({
          setNumber:     si + 1,
          completedReps: r.reps,
          completedLoad: r.load,
          completed:     true,
        })),
        note: r.notes || undefined,
      }));

    const log: WorkoutLog = {
      logId:            `fws_${now}_${Math.random().toString(36).slice(2, 5)}`,
      workoutId:        "freestyle",
      workoutName:      `Freestyle — ${bodyFocus}`,
      userId:           user.id,
      startedAt:        now - (parseInt(duration) || 45) * 60000,
      completedAt:      now,
      durationMins:     parseInt(duration) || 45,
      setsCompleted,
      exercises:        exerciseLogs,
      notes:            notes || undefined,
      logType:          "freestyle",
      voiceTranscript:  voice.transcript || undefined,
      voiceEntryId,
      parsedConfidence: parseConf ?? undefined,
      bodyFocus,
    };

    saveWorkoutLog(user.id, log);
    setSaving(false);
    setSaved(true);
    setTimeout(() => router.replace("/program"), 1200);
  }

  const canSave = exercises.some((r) => r.name.trim()) && !saving && !saved;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white pb-24">

      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#0A0A0A]/95 backdrop-blur-sm border-b border-white/[0.05] px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="w-8 h-8 rounded-xl border border-white/[0.08] flex items-center justify-center"
        >
          <ArrowLeft className="w-4 h-4 text-white/50" strokeWidth={2} />
        </button>
        <div className="flex-1">
          <h1 className="text-sm font-bold text-white/80">Freestyle Workout</h1>
          <p className="text-[10px] text-white/30">Log any session — prescribed or not</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-white/25 uppercase tracking-[0.12em] px-2 py-1 rounded-lg bg-white/[0.04] border border-white/8">
            Freestyle
          </span>
        </div>
      </div>

      <div className="px-4 pt-5 space-y-4 max-w-lg mx-auto">

        {/* Voice entry banner */}
        <button
          onClick={() => setShowVoice(true)}
          className="w-full flex items-center gap-4 rounded-2xl border border-[#B48B40]/18 bg-[#B48B40]/[0.04] hover:bg-[#B48B40]/[0.07] hover:border-[#B48B40]/28 px-5 py-4 transition-all text-left group"
        >
          <div className="w-9 h-9 rounded-xl bg-[#B48B40]/10 border border-[#B48B40]/20 flex items-center justify-center shrink-0">
            <Mic className="w-4 h-4 text-[#B48B40]/70" strokeWidth={1.5} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-white/70 group-hover:text-white/85 transition-colors">
              Log by voice
            </p>
            <p className="text-xs text-white/28 mt-0.5">
              Describe what you did — form populates automatically
            </p>
          </div>
          <ChevronDown className="w-4 h-4 text-white/20 -rotate-90 shrink-0" strokeWidth={1.5} />
        </button>

        {parseConf !== null && (
          <div className={cn(
            "px-4 py-2.5 rounded-xl border text-xs",
            parseConf >= 0.6
              ? "border-emerald-400/20 bg-emerald-400/5 text-emerald-400/70"
              : "border-amber-400/20 bg-amber-400/5 text-amber-400/70",
          )}>
            Voice parsed ({Math.round(parseConf * 100)}% confidence) — review and edit below
          </div>
        )}

        {/* Body focus */}
        <div className="space-y-1.5">
          <label className="text-[11px] uppercase tracking-[0.18em] text-white/30">Body focus</label>
          <div className="relative">
            <select
              value={bodyFocus}
              onChange={(e) => setBodyFocus(e.target.value)}
              className="w-full appearance-none bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/22 transition-all cursor-pointer"
            >
              {BODY_FOCUS_OPTIONS.map((o) => (
                <option key={o} value={o} style={{ background: "#111" }}>{o}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25 pointer-events-none" strokeWidth={1.5} />
          </div>
        </div>

        {/* Duration */}
        <div className="space-y-1.5">
          <label className="text-[11px] uppercase tracking-[0.18em] text-white/30">Duration (minutes)</label>
          <input
            type="number"
            inputMode="numeric"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="45"
            className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/22 outline-none focus:border-white/22 transition-all"
          />
        </div>

        {/* Exercises */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/30">Exercises</p>
            <button
              type="button"
              onClick={addRow}
              className="flex items-center gap-1 text-[11px] text-white/35 hover:text-white/60 transition-colors"
            >
              <Plus className="w-3 h-3" strokeWidth={2} /> Add
            </button>
          </div>
          {exercises.map((row) => (
            <ExerciseRowUI
              key={row.id}
              row={row}
              onChange={changeRow}
              onRemove={removeRow}
            />
          ))}
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <label className="text-[11px] uppercase tracking-[0.18em] text-white/30">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="How did it feel? Any PRs or observations…"
            rows={3}
            className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/22 outline-none focus:border-white/22 transition-all resize-none"
          />
        </div>

        {/* Save */}
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className={cn(
            "w-full rounded-2xl py-4 text-sm font-bold flex items-center justify-center gap-2 transition-all",
            canSave
              ? "bg-[#B48B40] text-black hover:bg-[#c99840] active:scale-[0.98]"
              : saved
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : "bg-white/5 text-white/25 cursor-not-allowed",
          )}
        >
          {saved
            ? <><Check className="w-4 h-4" strokeWidth={2.5} /> Logged — nice work</>
            : "Save Freestyle Log"}
        </button>

        <p className="text-center text-[10px] text-white/18 pb-2">
          Freestyle logs are tracked separately from your prescribed program
        </p>
      </div>

      {/* Voice review modal */}
      {showVoice && (
        <VoiceReviewModal
          status={voice.status}
          transcript={voice.transcript}
          interim={voice.interim}
          confidence={voice.confidence}
          error={voice.error}
          isSupported={voice.isSupported}
          label="Log freestyle workout"
          placeholder="e.g. 'I did 3 sets of bench press at 80kg for 8 reps, then 4 sets of cable rows at 60kg…'"
          onStart={voice.start}
          onStop={voice.stop}
          onReset={voice.reset}
          onTranscriptChange={voice.setTranscript}
          onConfirm={handleVoiceConfirm}
          onCancel={() => { setShowVoice(false); voice.reset(); }}
        />
      )}
    </div>
  );
}
