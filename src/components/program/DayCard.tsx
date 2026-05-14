"use client";

import { useMemo } from "react";
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical, Plus, Trash2, ChevronUp, ChevronDown, Copy, Library, Moon, Dumbbell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import type { DayWorkout, PlannedExercise } from "@/lib/program/types";

const DOW_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function blankExercise(): PlannedExercise {
  return { name: "", sets: 3, reps: "8-12", rest: "90s", weight: "", note: "", videoId: null };
}

export function newTrainingDay(dow: number): DayWorkout {
  return {
    dayOfWeek:        dow,
    kind:             "training",
    name:             `${DOW_LONG[dow]} session`,
    focus:            "",
    estimatedMinutes: 60,
    exercises:        [],
  };
}

export function newRestDay(dow: number): DayWorkout {
  return {
    dayOfWeek:        dow,
    kind:             "rest",
    name:             "Rest",
    focus:            "Full rest",
    estimatedMinutes: 0,
    exercises:        [],
  };
}

// ─── Inline field ────────────────────────────────────────────────────────────

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

// ─── Exercise row (DnD sortable) ─────────────────────────────────────────────

function ExerciseRow({
  id, index, exercise, onChange, onRemove, onDuplicate, onMoveUp, onMoveDown, isFirst, isLast,
}: {
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
}) {
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
          aria-label="Drag"
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
          <button onClick={onMoveUp}    disabled={isFirst} className="p-1 text-white/15 hover:text-white/45 disabled:opacity-0 transition-colors"><ChevronUp   className="w-3.5 h-3.5" strokeWidth={2} /></button>
          <button onClick={onMoveDown}  disabled={isLast}  className="p-1 text-white/15 hover:text-white/45 disabled:opacity-0 transition-colors"><ChevronDown className="w-3.5 h-3.5" strokeWidth={2} /></button>
          <button onClick={onDuplicate} className="p-1 text-white/15 hover:text-white/45 transition-colors"><Copy   className="w-3.5 h-3.5" strokeWidth={1.5} /></button>
          <button onClick={onRemove}    className="p-1 text-white/15 hover:text-red-400/70 transition-colors"><Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} /></button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 ml-8">
        <InlineField label="Sets"  value={String(exercise.sets)}  onChange={(v) => onChange({ sets: Math.max(0, parseInt(v) || 0) })} type="number" />
        <InlineField label="Reps"  value={exercise.reps}            onChange={(v) => onChange({ reps: v })}    placeholder="8-10" />
        <InlineField label="Load"  value={exercise.weight ?? ""}    onChange={(v) => onChange({ weight: v })}  placeholder="60kg / RPE 8" />
        <InlineField label="Rest"  value={exercise.rest ?? ""}      onChange={(v) => onChange({ rest: v })}    placeholder="90s" />
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

// ─── DayCard — training or rest ──────────────────────────────────────────────

export function DayCard({
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

  const isRest = (day.kind ?? "training") === "rest";

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

  function toggleKind() {
    if (isRest) {
      onChange({
        kind: "training",
        name: `${DOW_LONG[day.dayOfWeek]} session`,
        focus: "",
        estimatedMinutes: 60,
        exercises: [],
      });
    } else {
      onChange({
        kind: "rest",
        name: "Rest",
        focus: "Full rest",
        estimatedMinutes: 0,
        exercises: [],
      });
    }
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
          <div className="flex items-center gap-2 min-w-0">
            <span className={cn(
              "text-[10px] uppercase tracking-[0.25em] px-2 py-0.5 rounded-full border whitespace-nowrap",
              isRest
                ? "text-white/45 border-white/12 bg-white/[0.03]"
                : "text-[#B48B40]/80 border-[#B48B40]/25 bg-[#B48B40]/[0.06]",
            )}>
              {DOW_LONG[day.dayOfWeek]}
            </span>
            {isRest ? (
              <span className="flex items-center gap-1 text-[11px] text-white/40">
                <Moon className="w-3 h-3" strokeWidth={1.7} /> Rest day
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] text-white/40">
                <Dumbbell className="w-3 h-3" strokeWidth={1.7} />
                {day.exercises.length} exercises
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={toggleKind}
              className="text-[11px] text-white/35 hover:text-white/75 transition-colors flex items-center gap-1"
              title={isRest ? "Convert to training day" : "Convert to rest day"}
            >
              {isRest ? <Dumbbell className="w-3 h-3" strokeWidth={1.7} /> : <Moon className="w-3 h-3" strokeWidth={1.7} />}
              {isRest ? "Train" : "Rest"}
            </button>
            <button
              onClick={onRemove}
              className="text-[11px] text-white/35 hover:text-red-300/80 transition-colors flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" strokeWidth={1.7} />
              Remove
            </button>
          </div>
        </div>

        {!isRest ? (
          <>
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
          </>
        ) : (
          <div>
            <label className="text-[9px] uppercase tracking-[0.15em] text-white/35 block mb-1">Recovery note</label>
            <input
              type="text"
              value={day.focus}
              onChange={(e) => onChange({ focus: e.target.value })}
              placeholder="Full rest · Walk 30 min · Mobility flow"
              className="w-full bg-transparent text-sm text-white/80 placeholder:text-white/22 outline-none border-b border-white/[0.05] focus:border-white/15 transition-colors pb-1.5"
            />
          </div>
        )}
      </div>

      {!isRest && (
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
      )}
    </Card>
  );
}
