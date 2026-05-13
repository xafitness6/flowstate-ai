"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronLeft, ChevronUp, ChevronDown, GripVertical, Trash2, Copy, Plus,
  Library, Users, Loader2, AlertCircle, CheckCircle2, Layers,
  TrendingUp, Settings2, Sparkles, Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useUser } from "@/context/UserContext";
import { saveBuilderWorkoutForSelf, type BuilderProgramPayload } from "@/lib/db/programs";
import type {
  ProgramSplitV2, WeekTemplate, DayWorkout, PlannedExercise, ProgressionType,
} from "@/lib/program/types";
import { ExercisePickerDrawer } from "@/components/program/ExercisePickerDrawer";
import { AssignClientModal } from "@/components/program/AssignClientModal";
import type { Exercise } from "@/lib/db/exercises";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── Constants ───────────────────────────────────────────────────────────────

type Goal = "strength" | "hypertrophy" | "fat_loss" | "performance";

const GOAL_OPTIONS: { value: Goal; label: string; sub: string }[] = [
  { value: "strength",    label: "Strength",    sub: "Heavy compound, low reps"  },
  { value: "hypertrophy", label: "Hypertrophy", sub: "Moderate reps, volume"     },
  { value: "fat_loss",    label: "Fat Loss",    sub: "High density, circuits"    },
  { value: "performance", label: "Performance", sub: "Power, athletic patterns"  },
];

const PROGRESSION_OPTIONS: { value: ProgressionType; label: string; sub: string }[] = [
  { value: "linear",              label: "Linear",            sub: "Add load each week"          },
  { value: "double_progression",  label: "Double progression",sub: "Hit top reps, then add load" },
  { value: "rpe",                 label: "RPE-based",         sub: "Effort-driven autoregulate"  },
  { value: "manual",              label: "Manual",            sub: "I'll edit each week myself"  },
];

const DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DOW_LONG  = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const EQUIPMENT_OPTIONS = [
  "Full gym", "Home gym", "Dumbbells only", "Bodyweight", "Bands", "Travel",
];

const BODY_FOCUS_OPTIONS = [
  "Chest", "Back", "Shoulders", "Arms", "Legs", "Glutes", "Core", "Conditioning",
];

function uid() { return Math.random().toString(36).slice(2, 9); }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function newDay(dow: number): DayWorkout {
  return {
    dayOfWeek:        dow,
    name:             `${DOW_LONG[dow]} session`,
    focus:            "",
    estimatedMinutes: 60,
    exercises:        [],
  };
}

function exerciseFromLibrary(ex: Exercise): PlannedExercise {
  return {
    exerciseId: ex.id,
    name:       ex.name,
    sets:       3,
    reps:       "8-12",
    rest:       "90s",
    weight:     "",
    note:       "",
    videoId:    null,
  };
}

function blankExercise(): PlannedExercise {
  return {
    name:    "",
    sets:    3,
    reps:    "8-12",
    rest:    "90s",
    weight:  "",
    note:    "",
    videoId: null,
  };
}

// ─── Sortable exercise row ────────────────────────────────────────────────────

type ExerciseRowProps = {
  id:          string;
  index:       number;
  exercise:    PlannedExercise;
  onChange:    (patch: Partial<PlannedExercise>) => void;
  onRemove:    () => void;
  onDuplicate: () => void;
  onMoveUp:    () => void;
  onMoveDown:  () => void;
  isFirst:     boolean;
  isLast:      boolean;
};

function ExerciseRow({
  id, index, exercise, onChange, onRemove, onDuplicate, onMoveUp, onMoveDown, isFirst, isLast,
}: ExerciseRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5",
        isDragging && "opacity-40",
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-white/15 hover:text-white/40 touch-none shrink-0"
        >
          <GripVertical className="w-4 h-4" strokeWidth={1.5} />
        </button>
        <span className="text-[11px] tabular-nums text-white/30 w-5 shrink-0">{String(index + 1).padStart(2, "0")}</span>
        <input
          type="text"
          value={exercise.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Exercise name"
          className="flex-1 bg-transparent text-sm font-medium text-white/90 placeholder:text-white/25 outline-none min-w-0"
        />
        <div className="flex gap-0.5 shrink-0">
          <button onClick={onMoveUp}   disabled={isFirst} className="p-1 text-white/15 hover:text-white/45 disabled:opacity-0 transition-colors"><ChevronUp className="w-3.5 h-3.5" strokeWidth={2} /></button>
          <button onClick={onMoveDown} disabled={isLast}  className="p-1 text-white/15 hover:text-white/45 disabled:opacity-0 transition-colors"><ChevronDown className="w-3.5 h-3.5" strokeWidth={2} /></button>
          <button onClick={onDuplicate} className="p-1 text-white/15 hover:text-white/45 transition-colors"><Copy className="w-3.5 h-3.5" strokeWidth={1.5} /></button>
          <button onClick={onRemove}   className="p-1 text-white/15 hover:text-red-400/70 transition-colors"><Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} /></button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 ml-8">
        <InlineField label="Sets" value={String(exercise.sets)} onChange={(v) => onChange({ sets: Math.max(1, parseInt(v) || 0) })} type="number" />
        <InlineField label="Reps" value={exercise.reps} onChange={(v) => onChange({ reps: v })} placeholder="8-10" />
        <InlineField label="Load" value={exercise.weight ?? ""} onChange={(v) => onChange({ weight: v })} placeholder="60kg / RPE 8" />
        <InlineField label="Rest" value={exercise.rest ?? ""} onChange={(v) => onChange({ rest: v })} placeholder="90s" />
      </div>

      <input
        type="text"
        value={exercise.note ?? ""}
        onChange={(e) => onChange({ note: e.target.value })}
        placeholder="Cue, tempo, or substitute…"
        className="w-full bg-transparent text-xs text-white/55 placeholder:text-white/22 outline-none border-b border-white/[0.05] pb-1.5 mt-2 ml-8 focus:border-white/15 transition-colors"
        style={{ width: "calc(100% - 2rem)" }}
      />
    </div>
  );
}

function InlineField({
  label, value, onChange, placeholder, type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-[9px] uppercase tracking-[0.12em] text-white/28">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white/[0.03] border border-white/8 rounded-lg px-2 py-1 text-xs text-white/85 placeholder:text-white/25 outline-none focus:border-[#B48B40]/40 transition-colors tabular-nums"
      />
    </div>
  );
}

// ─── Day card ────────────────────────────────────────────────────────────────

function DayCard({
  day, onChange, onRemove, onOpenPicker,
}: {
  day:          DayWorkout;
  onChange:     (patch: Partial<DayWorkout>) => void;
  onRemove:     () => void;
  onOpenPicker: () => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  const exerciseIds = useMemo(
    () => day.exercises.map((_, i) => `${day.dayOfWeek}-${i}`),
    [day.exercises, day.dayOfWeek],
  );

  function patchExercise(idx: number, patch: Partial<PlannedExercise>) {
    onChange({
      exercises: day.exercises.map((ex, i) => i === idx ? { ...ex, ...patch } : ex),
    });
  }

  function removeExercise(idx: number) {
    onChange({ exercises: day.exercises.filter((_, i) => i !== idx) });
  }

  function duplicateExercise(idx: number) {
    const copy = { ...day.exercises[idx] };
    const next = [...day.exercises];
    next.splice(idx + 1, 0, copy);
    onChange({ exercises: next });
  }

  function moveExercise(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= day.exercises.length) return;
    onChange({ exercises: arrayMove(day.exercises, idx, target) });
  }

  function addBlank() {
    onChange({ exercises: [...day.exercises, blankExercise()] });
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = exerciseIds.indexOf(String(active.id));
    const to   = exerciseIds.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onChange({ exercises: arrayMove(day.exercises, from, to) });
  }

  return (
    <Card>
      <div className="px-5 py-4 border-b border-white/[0.05]">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.25em] text-[#B48B40]/80 px-2 py-0.5 rounded-full border border-[#B48B40]/25 bg-[#B48B40]/[0.06]">
              {DOW_LONG[day.dayOfWeek]}
            </span>
            <span className="text-[11px] text-white/40">{day.exercises.length} exercises</span>
          </div>
          <button onClick={onRemove} className="text-[11px] text-white/35 hover:text-red-300/80 transition-colors flex items-center gap-1">
            <Trash2 className="w-3 h-3" strokeWidth={1.7} />
            Remove day
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="text-[9px] uppercase tracking-[0.15em] text-white/35 block mb-1">Session name</label>
            <input
              type="text"
              value={day.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="e.g. Push A"
              className="w-full bg-transparent text-sm font-semibold text-white/95 placeholder:text-white/25 outline-none border-b border-white/8 focus:border-[#B48B40]/40 transition-colors pb-1.5"
            />
          </div>
          <div>
            <label className="text-[9px] uppercase tracking-[0.15em] text-white/35 block mb-1">Target duration</label>
            <div className="relative">
              <input
                type="number"
                value={day.estimatedMinutes}
                onChange={(e) => onChange({ estimatedMinutes: Math.max(10, parseInt(e.target.value) || 60) })}
                className="w-full bg-white/[0.03] border border-white/8 rounded-lg px-2.5 py-1.5 text-sm text-white/85 outline-none focus:border-[#B48B40]/40 transition-colors tabular-nums pr-10"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-white/30">min</span>
            </div>
          </div>
        </div>
        <div className="mt-3">
          <label className="text-[9px] uppercase tracking-[0.15em] text-white/35 block mb-1">Focus / muscle groups</label>
          <input
            type="text"
            value={day.focus}
            onChange={(e) => onChange({ focus: e.target.value })}
            placeholder="e.g. Chest, shoulders, triceps"
            className="w-full bg-transparent text-xs text-white/75 placeholder:text-white/22 outline-none border-b border-white/[0.05] focus:border-white/15 transition-colors pb-1"
          />
        </div>
      </div>

      <div className="px-5 py-4">
        {day.exercises.length === 0 ? (
          <div className="py-6 text-center text-white/30 text-xs">No exercises yet.</div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={exerciseIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {day.exercises.map((ex, idx) => (
                  <ExerciseRow
                    key={`${day.dayOfWeek}-${idx}`}
                    id={`${day.dayOfWeek}-${idx}`}
                    index={idx}
                    exercise={ex}
                    onChange={(patch) => patchExercise(idx, patch)}
                    onRemove={() => removeExercise(idx)}
                    onDuplicate={() => duplicateExercise(idx)}
                    onMoveUp={() => moveExercise(idx, -1)}
                    onMoveDown={() => moveExercise(idx, 1)}
                    isFirst={idx === 0}
                    isLast={idx === day.exercises.length - 1}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        <div className="flex gap-2 mt-3">
          <button
            onClick={onOpenPicker}
            className="flex-1 rounded-xl border border-dashed border-white/15 py-2.5 flex items-center justify-center gap-2 text-xs text-white/55 hover:text-white/85 hover:border-[#B48B40]/40 transition-all"
          >
            <Library className="w-3.5 h-3.5" strokeWidth={1.7} />
            Pick from library
          </button>
          <button
            onClick={addBlank}
            className="rounded-xl border border-dashed border-white/10 px-4 py-2.5 text-xs text-white/40 hover:text-white/70 hover:border-white/20 transition-all"
          >
            <Plus className="w-3.5 h-3.5 inline mr-1" strokeWidth={1.7} />
            Custom
          </button>
        </div>
      </div>
    </Card>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

type SaveState = "idle" | "saving" | "saved" | "error";

export default function ProgramBuilderPage() {
  const router = useRouter();
  const { user } = useUser();

  // ── Program meta ──
  const [name,             setName]             = useState("");
  const [goal,             setGoal]             = useState<Goal>("hypertrophy");
  const [weeks,            setWeeks]            = useState(4);
  const [sessionMin,       setSessionMin]       = useState(60);
  const [coachingNotes,    setCoachingNotes]    = useState("");
  const [bodyFocus,        setBodyFocus]        = useState<string[]>([]);
  const [equipment,        setEquipment]        = useState<string[]>(["Full gym"]);
  const [progressionType,  setProgressionType]  = useState<ProgressionType>("linear");
  const [progressionNotes, setProgressionNotes] = useState("");

  // ── Program structure ──
  const [baseWeek, setBaseWeek] = useState<WeekTemplate>({
    intent: "",
    days:   [],
  });
  const [weekOverrides, setWeekOverrides] = useState<Record<number, WeekTemplate>>({});

  // ── UI state ──
  const [editingWeek, setEditingWeek]  = useState(1);
  const [pickerOpen,  setPickerOpen]   = useState(false);
  const [pickerTarget, setPickerTarget] = useState<number | null>(null);   // day index in the current editing week
  const [saveState,   setSaveState]    = useState<SaveState>("idle");
  const [saveError,   setSaveError]    = useState<string | null>(null);
  const [setActive,   setSetActive]    = useState(true);
  const [assignOpen,  setAssignOpen]   = useState(false);
  const [assignBusy,  setAssignBusy]   = useState(false);

  const isAdmin    = user?.role === "master" || !!user?.isAdmin;
  const canPersist = !!user?.id && UUID_RE.test(user.id);

  // ── Computed: the week currently shown ──
  // For week 1, edits go to baseWeek.
  // For weeks 2+, edits go to weekOverrides[week] (created on first edit).
  const currentWeek: WeekTemplate = useMemo(() => {
    if (editingWeek === 1) return baseWeek;
    return weekOverrides[editingWeek] ?? baseWeek;
  }, [editingWeek, baseWeek, weekOverrides]);

  const isOverride = editingWeek > 1 && !!weekOverrides[editingWeek];

  function markDirty() {
    setSaveState((prev) => (prev === "saved" || prev === "error" ? "idle" : prev));
    setSaveError(null);
  }

  function updateCurrentWeek(updater: (w: WeekTemplate) => WeekTemplate) {
    markDirty();
    if (editingWeek === 1) {
      setBaseWeek(updater);
    } else {
      // Lazily create the override from baseWeek snapshot
      const existing = weekOverrides[editingWeek] ?? { ...baseWeek, days: baseWeek.days.map((d) => ({ ...d, exercises: d.exercises.map((e) => ({ ...e })) })) };
      setWeekOverrides({ ...weekOverrides, [editingWeek]: updater(existing) });
    }
  }

  function revertOverride() {
    if (editingWeek === 1) return;
    const next = { ...weekOverrides };
    delete next[editingWeek];
    setWeekOverrides(next);
    markDirty();
  }

  function patchDay(dayIdx: number, patch: Partial<DayWorkout>) {
    updateCurrentWeek((w) => ({
      ...w,
      days: w.days.map((d, i) => i === dayIdx ? { ...d, ...patch } : d),
    }));
  }

  function removeDay(dayIdx: number) {
    updateCurrentWeek((w) => ({ ...w, days: w.days.filter((_, i) => i !== dayIdx) }));
  }

  function addDay(dow: number) {
    if (currentWeek.days.some((d) => d.dayOfWeek === dow)) return;
    updateCurrentWeek((w) => ({
      ...w,
      days: [...w.days, newDay(dow)].sort((a, b) => a.dayOfWeek - b.dayOfWeek),
    }));
  }

  function patchWeek(patch: Partial<WeekTemplate>) {
    updateCurrentWeek((w) => ({ ...w, ...patch }));
  }

  function onPickerSelect(ex: Exercise) {
    if (pickerTarget === null) return;
    const exercise = exerciseFromLibrary(ex);
    updateCurrentWeek((w) => ({
      ...w,
      days: w.days.map((d, i) => i === pickerTarget
        ? { ...d, exercises: [...d.exercises, exercise] }
        : d),
    }));
  }

  // ── Build payload ──
  const validation = useMemo(() => {
    if (!name.trim()) return "Add a program name.";
    if (weeks < 1 || weeks > 12) return "Phase must be 1–12 weeks.";
    if (baseWeek.days.length === 0) return "Add at least one training day to Week 1.";
    for (const d of baseWeek.days) {
      if (d.exercises.length === 0) return `Week 1 ${DOW_LONG[d.dayOfWeek]} has no exercises.`;
      if (d.exercises.some((e) => !e.name.trim())) return `Every exercise needs a name (${DOW_LONG[d.dayOfWeek]}).`;
    }
    return null;
  }, [name, weeks, baseWeek]);

  const buildPayload = useCallback((): BuilderProgramPayload => {
    const split: ProgramSplitV2 = {
      version: 2,
      phase: {
        name: name || "Custom phase",
        weeks,
        progression: progressionType === "manual"
          ? { type: "manual", notes: progressionNotes.trim() || undefined }
          : { type: progressionType, notes: progressionNotes.trim() || undefined },
      },
      baseWeek,
      weekOverrides,
    };

    return {
      name:           name.trim() || "Custom program",
      goal,
      weeks,
      daysPerWeek:    baseWeek.days.length,
      sessionMinutes: sessionMin,
      bodyFocus,
      equipment,
      coachingNotes:  coachingNotes.trim() || null,
      split,
    };
  }, [name, goal, weeks, sessionMin, bodyFocus, equipment, coachingNotes, progressionType, progressionNotes, baseWeek, weekOverrides]);

  async function handleSave() {
    if (validation) { setSaveError(validation); setSaveState("error"); return; }
    if (!user?.id)  { setSaveError("Sign in to save."); setSaveState("error"); return; }

    setSaveState("saving");
    setSaveError(null);

    if (!canPersist) {
      setTimeout(() => {
        setSaveState("saved");
        setSaveError("Demo account — programs persist only for real signed-in users.");
      }, 250);
      return;
    }

    try {
      const program = await saveBuilderWorkoutForSelf(user.id, buildPayload(), setActive);
      if (!program) throw new Error("Save returned no row");
      setSaveState("saved");
      if (setActive) setTimeout(() => router.push("/program"), 600);
    } catch (e) {
      console.error("[builder] save failed", e);
      setSaveError(e instanceof Error ? e.message : "Save failed");
      setSaveState("error");
    }
  }

  async function handleAssignToClient(target: { id: string; email: string }, activate: boolean) {
    if (validation) { setSaveError(validation); setSaveState("error"); setAssignOpen(false); return; }

    setAssignBusy(true);
    setSaveError(null);

    try {
      const res = await fetch("/api/admin/assign-workout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ targetUserId: target.id, payload: buildPayload(), activate }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? `Send failed (${res.status})`);
      setAssignOpen(false);
      setSaveState("saved");
      setSaveError(`Sent to ${target.email}${activate ? " — set as their active program." : " — saved as a template."}`);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Send failed");
      setSaveState("error");
    } finally {
      setAssignBusy(false);
    }
  }

  // Auto-default day-of-week picker visibility based on whether we have days yet
  const [showDowPicker, setShowDowPicker] = useState(true);
  useEffect(() => {
    if (currentWeek.days.length > 0) setShowDowPicker(false);
  }, [currentWeek.days.length]);

  // ── Render ──
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white pb-32">
      <div className="px-5 md:px-8 pt-6 max-w-4xl mx-auto">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/80 transition-colors mb-4"
        >
          <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2} />
          Back
        </button>

        {/* Header */}
        <div className="mb-6">
          <p className="text-[10px] uppercase tracking-[0.28em] text-white/35 mb-2">Program · Builder</p>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">New program</h1>
          <p className="text-xs text-white/40 mt-2 max-w-xl leading-relaxed">
            Build a full multi-week phase. Edit Week 1 first — it&apos;s the base pattern. Weeks 2+ inherit by default; override any week to introduce progressive overload, deloads, or peak weeks.
          </p>
        </div>

        {/* ── Phase metadata card ── */}
        <Card className="mb-4">
          <div className="px-5 py-5 space-y-5">
            <div>
              <label className="text-[10px] uppercase tracking-[0.18em] text-white/30 block mb-2">Program name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); markDirty(); }}
                placeholder="e.g. Hypertrophy Phase 1"
                className="w-full bg-transparent text-lg font-medium text-white/95 placeholder:text-white/25 outline-none border-b border-white/8 focus:border-[#B48B40]/40 transition-colors pb-2"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="text-[10px] uppercase tracking-[0.18em] text-white/30 block mb-2">Goal</label>
                <div className="grid grid-cols-2 gap-2">
                  {GOAL_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => { setGoal(opt.value); markDirty(); }}
                      className={cn(
                        "rounded-xl border px-3 py-2 text-left transition-all",
                        goal === opt.value
                          ? "border-[#B48B40]/40 bg-[#B48B40]/[0.06]"
                          : "border-white/8 bg-white/[0.02] hover:border-white/15",
                      )}
                    >
                      <p className={cn("text-sm font-medium", goal === opt.value ? "text-[#B48B40]" : "text-white/75")}>{opt.label}</p>
                      <p className="text-[10px] text-white/35 mt-0.5">{opt.sub}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-[0.18em] text-white/30 block mb-2">Phase length</label>
                  <div className="relative">
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={weeks}
                      onChange={(e) => { setWeeks(Math.max(1, Math.min(12, parseInt(e.target.value) || 4))); markDirty(); }}
                      className="w-full bg-white/[0.03] border border-white/8 rounded-xl px-3 py-2 text-sm text-white/85 outline-none focus:border-[#B48B40]/40 transition-colors tabular-nums pr-12"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-white/30">weeks</span>
                  </div>
                  <p className="text-[10px] text-white/30 mt-1">Typically 3–6 per phase</p>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-[0.18em] text-white/30 block mb-2">Session target</label>
                  <div className="relative">
                    <input
                      type="number"
                      min={20}
                      value={sessionMin}
                      onChange={(e) => { setSessionMin(Math.max(20, parseInt(e.target.value) || 60)); markDirty(); }}
                      className="w-full bg-white/[0.03] border border-white/8 rounded-xl px-3 py-2 text-sm text-white/85 outline-none focus:border-[#B48B40]/40 transition-colors tabular-nums pr-10"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-white/30">min</span>
                  </div>
                </div>
              </div>
            </div>

            <details className="group">
              <summary className="cursor-pointer text-[10px] uppercase tracking-[0.18em] text-white/35 hover:text-white/65 transition-colors flex items-center gap-2 select-none">
                <Settings2 className="w-3 h-3" strokeWidth={2} />
                Equipment, focus &amp; notes
                <ChevronDown className="w-3 h-3 group-open:rotate-180 transition-transform" strokeWidth={2} />
              </summary>
              <div className="mt-3 space-y-4 pl-5 border-l border-white/[0.05]">
                <ChipMultiselect
                  label="Equipment available"
                  value={equipment}
                  options={EQUIPMENT_OPTIONS}
                  onChange={(v) => { setEquipment(v); markDirty(); }}
                />
                <ChipMultiselect
                  label="Body focus"
                  value={bodyFocus}
                  options={BODY_FOCUS_OPTIONS}
                  onChange={(v) => { setBodyFocus(v); markDirty(); }}
                />
                <div>
                  <label className="text-[10px] uppercase tracking-[0.18em] text-white/30 block mb-2">Coaching notes</label>
                  <textarea
                    value={coachingNotes}
                    onChange={(e) => { setCoachingNotes(e.target.value); markDirty(); }}
                    placeholder="What this phase is for, cues to remember, deload rules…"
                    rows={2}
                    className="w-full bg-white/[0.03] border border-white/8 rounded-xl px-3 py-2 text-xs text-white/80 placeholder:text-white/25 outline-none focus:border-[#B48B40]/40 transition-colors resize-none leading-relaxed"
                  />
                </div>
              </div>
            </details>
          </div>
        </Card>

        {/* ── Progression rule ── */}
        <Card className="mb-4">
          <div className="px-5 py-4 space-y-3">
            <SectionHeader className="mb-1">Progression strategy</SectionHeader>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {PROGRESSION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setProgressionType(opt.value); markDirty(); }}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-left transition-all",
                    progressionType === opt.value
                      ? "border-[#B48B40]/40 bg-[#B48B40]/[0.06]"
                      : "border-white/8 bg-white/[0.02] hover:border-white/15",
                  )}
                >
                  <p className={cn("text-xs font-semibold", progressionType === opt.value ? "text-[#B48B40]" : "text-white/80")}>{opt.label}</p>
                  <p className="text-[10px] text-white/35 mt-0.5">{opt.sub}</p>
                </button>
              ))}
            </div>
            <input
              type="text"
              value={progressionNotes}
              onChange={(e) => { setProgressionNotes(e.target.value); markDirty(); }}
              placeholder={progressionType === "manual" ? "Optional notes" : "e.g. +2.5kg main lifts each week"}
              className="w-full bg-transparent text-xs text-white/65 placeholder:text-white/25 outline-none border-b border-white/[0.05] focus:border-white/15 transition-colors pb-1"
            />
          </div>
        </Card>

        {/* ── Week tabs ── */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-3">
          <span className="text-[10px] uppercase tracking-[0.22em] text-white/30 shrink-0 mr-1">Edit week</span>
          {Array.from({ length: weeks }, (_, i) => i + 1).map((w) => {
            const isActive   = w === editingWeek;
            const hasOverride = w > 1 && !!weekOverrides[w];
            return (
              <button
                key={w}
                onClick={() => setEditingWeek(w)}
                className={cn(
                  "shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all flex items-center gap-1.5 border",
                  isActive
                    ? "bg-[#B48B40] text-black border-[#B48B40]"
                    : "bg-white/[0.03] text-white/70 border-white/8 hover:border-white/15 hover:bg-white/[0.05]",
                )}
              >
                W{w}
                {hasOverride && (
                  <span className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    isActive ? "bg-black/40" : "bg-[#B48B40]",
                  )} />
                )}
              </button>
            );
          })}
        </div>

        {/* ── Week brief / override status ── */}
        <Card className="mb-4">
          <div className="px-5 py-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-white/35 mb-0.5">
                  Week {editingWeek} of {weeks}
                </p>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-white/90">
                    {editingWeek === 1 ? "Base pattern" : isOverride ? "Customized week" : "Inheriting base pattern"}
                  </h3>
                  {isOverride && (
                    <button
                      onClick={revertOverride}
                      className="text-[10px] text-white/40 hover:text-red-300/80 transition-colors flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" strokeWidth={1.7} /> Revert
                    </button>
                  )}
                </div>
              </div>
              <TrendingUp className="w-4 h-4 text-[#B48B40]/60" strokeWidth={1.8} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] uppercase tracking-[0.15em] text-white/35 block mb-1">Week intent</label>
                <input
                  type="text"
                  value={currentWeek.intent ?? ""}
                  onChange={(e) => patchWeek({ intent: e.target.value })}
                  placeholder="e.g. Volume accumulation, deload, peaking"
                  className="w-full bg-transparent text-sm text-white/80 placeholder:text-white/25 outline-none border-b border-white/[0.06] focus:border-[#B48B40]/40 transition-colors pb-1.5"
                />
              </div>
              <div>
                <label className="text-[9px] uppercase tracking-[0.15em] text-white/35 block mb-1">Progression this week</label>
                <input
                  type="text"
                  value={currentWeek.progressionThisWeek ?? ""}
                  onChange={(e) => patchWeek({ progressionThisWeek: e.target.value })}
                  placeholder={editingWeek === 1 ? "Starting load reference" : "What's different vs last week"}
                  className="w-full bg-transparent text-sm text-white/80 placeholder:text-white/25 outline-none border-b border-white/[0.06] focus:border-[#B48B40]/40 transition-colors pb-1.5"
                />
              </div>
            </div>

            {editingWeek > 1 && !isOverride && (
              <p className="text-[11px] text-white/40 italic">
                Tip: any edit to this week creates a per-week override that supersedes the base pattern.
              </p>
            )}
          </div>
        </Card>

        {/* ── Day-of-week picker ── */}
        {(showDowPicker || currentWeek.days.length < 7) && (
          <Card className="mb-4">
            <div className="px-5 py-4">
              <SectionHeader className="mb-2">
                <span className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-white/40" strokeWidth={1.8} />
                  Training days
                </span>
              </SectionHeader>
              <div className="grid grid-cols-7 gap-1.5">
                {DOW_SHORT.map((short, i) => {
                  const used = currentWeek.days.some((d) => d.dayOfWeek === i);
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        if (used) {
                          const idx = currentWeek.days.findIndex((d) => d.dayOfWeek === i);
                          if (idx >= 0) removeDay(idx);
                        } else {
                          addDay(i);
                        }
                      }}
                      className={cn(
                        "rounded-xl px-2 py-2 text-xs font-semibold border transition-all",
                        used
                          ? "border-[#B48B40]/40 bg-[#B48B40]/[0.08] text-[#B48B40]"
                          : "border-white/8 bg-white/[0.02] text-white/55 hover:border-white/20 hover:text-white/85",
                      )}
                    >
                      {short}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-white/30 mt-2">
                {currentWeek.days.length} training day{currentWeek.days.length === 1 ? "" : "s"} selected
                {editingWeek > 1 && " (this week)"}
              </p>
            </div>
          </Card>
        )}

        {/* ── Day cards ── */}
        <div className="space-y-3">
          {currentWeek.days.map((day, idx) => (
            <DayCard
              key={`${day.dayOfWeek}-${idx}`}
              day={day}
              onChange={(patch) => patchDay(idx, patch)}
              onRemove={() => removeDay(idx)}
              onOpenPicker={() => { setPickerTarget(idx); setPickerOpen(true); }}
            />
          ))}
        </div>

        {currentWeek.days.length === 0 && (
          <Card>
            <div className="px-6 py-12 flex flex-col items-center gap-3 text-center text-white/35">
              <Layers className="w-7 h-7 text-white/15" strokeWidth={1.5} />
              <p className="text-sm">Pick training days above to start adding sessions.</p>
            </div>
          </Card>
        )}

        {/* ── Footer ── */}
        <div className="mt-8 space-y-3">
          <label className="flex items-center gap-2.5 cursor-pointer select-none px-1">
            <input
              type="checkbox"
              checked={setActive}
              onChange={(e) => { setSetActive(e.target.checked); markDirty(); }}
              className="w-4 h-4 rounded border-white/15 bg-white/[0.04] accent-[#B48B40]"
            />
            <span className="text-xs text-white/65">Set as my active program after saving</span>
          </label>

          <div className="flex items-center gap-3 flex-wrap">
            {isAdmin && (
              <button
                onClick={() => { setSaveError(null); setAssignOpen(true); }}
                disabled={saveState === "saving" || assignBusy}
                className="flex items-center gap-2 rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3 text-sm text-white/65 hover:text-white/90 hover:border-white/15 transition-all disabled:opacity-40"
              >
                <Users className="w-4 h-4" strokeWidth={1.7} />
                Send to user
              </button>
            )}

            <Link
              href="/program/generate"
              className="flex items-center gap-2 rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3 text-sm text-white/55 hover:text-[#B48B40] hover:border-[#B48B40]/30 transition-all"
            >
              <Sparkles className="w-4 h-4" strokeWidth={1.7} />
              Generate with AI
            </Link>

            <button
              onClick={() => void handleSave()}
              disabled={saveState === "saving"}
              className={cn(
                "ml-auto rounded-2xl px-6 py-3 text-sm font-semibold transition-all flex items-center gap-2",
                saveState === "saving"
                  ? "bg-white/5 text-white/45 cursor-wait"
                  : saveState === "saved"
                    ? "bg-emerald-500/15 text-emerald-300 border border-emerald-400/20"
                    : "bg-[#B48B40] text-black hover:bg-[#c99840]",
              )}
            >
              {saveState === "saving" && <Loader2 className="w-4 h-4 animate-spin" />}
              {saveState === "saved"  && <CheckCircle2 className="w-4 h-4" strokeWidth={2} />}
              {saveState === "saving" ? "Saving…"
                : saveState === "saved" ? "Saved"
                : setActive ? "Save & activate" : "Save as template"}
            </button>
          </div>

          {saveError && saveState === "error" && (
            <div className="flex items-start gap-2 rounded-xl border border-red-400/20 bg-red-400/5 px-3 py-2.5">
              <AlertCircle className="w-4 h-4 text-red-400/80 shrink-0 mt-0.5" strokeWidth={2} />
              <p className="text-xs text-red-300/85 leading-relaxed">{saveError}</p>
            </div>
          )}
          {saveError && saveState === "saved" && (
            <p className="text-xs text-emerald-400/80 text-right">{saveError}</p>
          )}
        </div>
      </div>

      {/* ── Exercise picker drawer ── */}
      <ExercisePickerDrawer
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={onPickerSelect}
      />

      {/* ── Assign-to-user modal ── */}
      <AssignClientModal
        open={assignOpen}
        onClose={() => !assignBusy && setAssignOpen(false)}
        onConfirm={(target, activate) => handleAssignToClient(target, activate)}
        busy={assignBusy}
      />
    </div>
  );
}

// ─── Chip multiselect ────────────────────────────────────────────────────────

function ChipMultiselect({
  label, value, options, onChange,
}: {
  label:   string;
  value:   string[];
  options: string[];
  onChange: (v: string[]) => void;
}) {
  function toggle(opt: string) {
    onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]);
  }
  return (
    <div>
      <label className="text-[10px] uppercase tracking-[0.18em] text-white/30 block mb-2">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = value.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className={cn(
                "rounded-full px-3 py-1 text-[11px] border transition-all",
                active
                  ? "border-[#B48B40]/40 bg-[#B48B40]/[0.08] text-[#B48B40]"
                  : "border-white/10 bg-white/[0.02] text-white/55 hover:border-white/20 hover:text-white/80",
              )}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
