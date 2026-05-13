"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  DragEndEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Copy,
  Users,
  Layers,
  ChevronRight,
  Film,
  Play,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { VideoPickerModal } from "@/components/library/VideoPickerModal";
import { VideoPreviewModal } from "@/components/library/VideoPreviewModal";
import { YTIcon } from "@/components/library/YTIcon";
import { VIDEO_LIBRARY, formatDuration } from "@/lib/videoLibrary";

// ─── Types ───────────────────────────────────────────────────────────────────

type Goal = "strength" | "hypertrophy" | "fat_loss";

type SectionItem = {
  id: string;
  type: "section";
  label: string;
};

type ExerciseItem = {
  id: string;
  type: "exercise";
  name: string;
  sets: string;
  reps: string;
  weight: string;
  rest: string;
  note: string;
  collapsed: boolean;
  videoId?: string | null;
};

type WorkoutItem = SectionItem | ExerciseItem;

// ─── Constants ───────────────────────────────────────────────────────────────

const GOAL_OPTIONS: { value: Goal; label: string; sub: string }[] = [
  { value: "strength",    label: "Strength",    sub: "Low rep, high load" },
  { value: "hypertrophy", label: "Hypertrophy", sub: "Moderate rep, volume" },
  { value: "fat_loss",    label: "Fat Loss",    sub: "High rep, density" },
];

const SECTION_PRESETS = ["Warm-up", "Main lifts", "Accessories", "Finisher"];

const STAT_FIELDS: { key: keyof Pick<ExerciseItem, "sets"|"reps"|"weight"|"rest">; label: string; placeholder: string }[] = [
  { key: "sets",   label: "Sets",   placeholder: "4" },
  { key: "reps",   label: "Reps",   placeholder: "8–10" },
  { key: "weight", label: "Weight", placeholder: "60kg" },
  { key: "rest",   label: "Rest",   placeholder: "90s" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function newExercise(partial: Partial<ExerciseItem> = {}): ExerciseItem {
  return {
    id: uid(),
    type: "exercise",
    name: "",
    sets: "",
    reps: "",
    weight: "",
    rest: "",
    note: "",
    collapsed: false,
    ...partial,
  };
}

function newSection(label = "Section"): SectionItem {
  return { id: uid(), type: "section", label };
}

// ─── SectionCard ─────────────────────────────────────────────────────────────

function SectionCard({
  item,
  isDragging = false,
  dragHandleProps,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  item: SectionItem;
  isDragging?: boolean;
  dragHandleProps?: Record<string, unknown>;
  onChange: (id: string, field: string, value: string) => void;
  onRemove: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-1 py-1 group",
        isDragging && "opacity-50"
      )}
    >
      {/* Drag handle */}
      <button
        {...dragHandleProps}
        className="cursor-grab active:cursor-grabbing text-white/15 hover:text-white/40 transition-colors touch-none"
      >
        <GripVertical className="w-4 h-4" strokeWidth={1.5} />
      </button>

      {/* Label */}
      <div className="flex items-center gap-2 flex-1">
        <Layers className="w-3 h-3 text-[#B48B40]/50 shrink-0" strokeWidth={1.5} />
        <input
          type="text"
          value={item.label}
          onChange={(e) => onChange(item.id, "label", e.target.value)}
          className="bg-transparent text-xs font-semibold uppercase tracking-[0.18em] text-white/40 placeholder:text-white/20 outline-none focus:text-white/65 transition-colors w-full"
        />
      </div>

      {/* Controls — show on hover */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onMoveUp(item.id)}
          disabled={isFirst}
          className="p-1 text-white/20 hover:text-white/50 disabled:opacity-0 transition-colors"
        >
          <ChevronUp className="w-3 h-3" strokeWidth={2} />
        </button>
        <button
          onClick={() => onMoveDown(item.id)}
          disabled={isLast}
          className="p-1 text-white/20 hover:text-white/50 disabled:opacity-0 transition-colors"
        >
          <ChevronDown className="w-3 h-3" strokeWidth={2} />
        </button>
        <button
          onClick={() => onRemove(item.id)}
          className="p-1 text-white/15 hover:text-[#F87171]/60 transition-colors ml-1"
        >
          <Trash2 className="w-3 h-3" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}

// ─── ExerciseCard ─────────────────────────────────────────────────────────────

function ExerciseCard({
  item,
  index,
  isDragging = false,
  dragHandleProps,
  onChange,
  onRemove,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  item: ExerciseItem;
  index: number;
  isDragging?: boolean;
  dragHandleProps?: Record<string, unknown>;
  onChange: (id: string, field: string, value: string | boolean | null) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [showVideoPicker, setShowVideoPicker] = useState(false);
  const [showVideoPreview, setShowVideoPreview] = useState(false);
  const [thumbError, setThumbError] = useState(false);
  const attachedVideo = item.videoId ? VIDEO_LIBRARY.find((v) => v.id === item.videoId) ?? null : null;
  const hasRealThumb = attachedVideo?.thumbnailUrl && !thumbError;
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/8 bg-[#111111] overflow-hidden transition-all",
        isDragging && "opacity-40 scale-[0.99]"
      )}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 px-4 py-3">
        {/* Drag handle */}
        <button
          {...dragHandleProps}
          className="cursor-grab active:cursor-grabbing text-white/15 hover:text-white/40 transition-colors touch-none shrink-0"
        >
          <GripVertical className="w-4 h-4" strokeWidth={1.5} />
        </button>

        {/* Index */}
        <span className="text-xs text-white/20 tabular-nums w-5 shrink-0">
          {String(index + 1).padStart(2, "0")}
        </span>

        {/* Name */}
        <input
          type="text"
          value={item.name}
          onChange={(e) => onChange(item.id, "name", e.target.value)}
          placeholder="Exercise name"
          className="flex-1 bg-transparent text-sm font-medium text-white/90 placeholder:text-white/20 outline-none min-w-0"
        />

        {/* Reorder */}
        <div className="flex gap-0.5 shrink-0">
          <button
            onClick={() => onMoveUp(item.id)}
            disabled={isFirst}
            className="p-1 text-white/15 hover:text-white/45 disabled:opacity-0 transition-colors"
          >
            <ChevronUp className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
          <button
            onClick={() => onMoveDown(item.id)}
            disabled={isLast}
            className="p-1 text-white/15 hover:text-white/45 disabled:opacity-0 transition-colors"
          >
            <ChevronDown className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
        </div>

        {/* Duplicate */}
        <button
          onClick={() => onDuplicate(item.id)}
          className="p-1 text-white/15 hover:text-white/45 transition-colors shrink-0"
        >
          <Copy className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>

        {/* Remove */}
        <button
          onClick={() => onRemove(item.id)}
          className="p-1 text-white/15 hover:text-[#F87171]/60 transition-colors shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>

        {/* Collapse toggle */}
        <button
          onClick={() => onChange(item.id, "collapsed", !item.collapsed)}
          className="p-1 text-white/20 hover:text-white/50 transition-colors shrink-0"
        >
          <ChevronRight
            className={cn("w-3.5 h-3.5 transition-transform", !item.collapsed && "rotate-90")}
            strokeWidth={2}
          />
        </button>
      </div>

      {/* Expanded body */}
      {!item.collapsed && (
        <>
          <div className="px-4 pb-4 ml-11">
            {/* Stat inputs */}
            <div className="flex gap-2 flex-wrap mb-3">
              {STAT_FIELDS.map(({ key, label, placeholder }) => (
                <div key={key} className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase tracking-[0.12em] text-white/25">
                    {label}
                  </label>
                  <input
                    type="text"
                    value={item[key]}
                    onChange={(e) => onChange(item.id, key, e.target.value)}
                    placeholder={placeholder}
                    className="w-16 bg-white/[0.03] border border-white/6 rounded-xl px-2.5 py-1.5 text-sm text-white/80 placeholder:text-white/20 outline-none focus:border-[#B48B40]/40 focus:bg-[#B48B40]/5 transition-all tabular-nums text-center"
                  />
                </div>
              ))}
            </div>

            {/* Note */}
            <textarea
              value={item.note}
              onChange={(e) => onChange(item.id, "note", e.target.value)}
              placeholder="Notes, cues, or reminders..."
              rows={1}
              className="w-full bg-transparent text-xs text-white/50 placeholder:text-white/20 resize-none outline-none border-b border-white/6 pb-1.5 focus:border-white/15 transition-colors leading-relaxed"
            />

            {/* Video attachment */}
            <div className="mt-3">
              {attachedVideo ? (
                <div className="flex items-stretch gap-3 p-2 rounded-xl bg-white/[0.03] border border-white/6">
                  {/* Thumbnail — click to preview */}
                  <button
                    onClick={() => setShowVideoPreview(true)}
                    className={cn(
                      "group relative w-24 aspect-video rounded-lg overflow-hidden bg-gradient-to-br shrink-0",
                      attachedVideo.thumbnailColor,
                    )}
                    aria-label={`Preview ${attachedVideo.title}`}
                  >
                    {hasRealThumb && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={attachedVideo.thumbnailUrl}
                        alt={attachedVideo.title}
                        className="absolute inset-0 w-full h-full object-cover"
                        onError={() => setThumbError(true)}
                      />
                    )}
                    {!hasRealThumb && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Film className="w-4 h-4 text-white/35" strokeWidth={1.5} />
                      </div>
                    )}
                    {/* Play overlay */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/30 transition-colors">
                      <div className="w-7 h-7 rounded-full bg-black/55 border border-white/25 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Play className="w-3 h-3 text-white fill-white ml-0.5" />
                      </div>
                    </div>
                    {attachedVideo.source === "youtube" && (
                      <div className="absolute top-1 left-1">
                        <YTIcon className="w-3 h-3 text-[#FF4444]" />
                      </div>
                    )}
                    {attachedVideo.duration > 0 && (
                      <div className="absolute bottom-1 right-1 text-[9px] text-white/75 tabular-nums font-mono bg-black/55 rounded px-1">
                        {formatDuration(attachedVideo.duration)}
                      </div>
                    )}
                  </button>

                  {/* Info + actions */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                    <p className="text-xs font-medium text-white/70 line-clamp-2 leading-snug">
                      {attachedVideo.title}
                    </p>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setShowVideoPicker(true)}
                        className="text-[10px] text-[#B48B40] hover:text-[#C99B50] transition-colors"
                      >
                        Change
                      </button>
                      <button
                        onClick={() => onChange(item.id, "videoId", null)}
                        className="text-[10px] text-white/30 hover:text-red-400/70 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowVideoPicker(true)}
                  className="flex items-center gap-2 text-[11px] text-white/25 hover:text-white/50 transition-colors"
                >
                  <Film className="w-3.5 h-3.5" strokeWidth={1.5} />
                  Attach video
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Video picker modal */}
      {showVideoPicker && (
        <VideoPickerModal
          currentVideoId={item.videoId}
          exerciseName={item.name || undefined}
          onSelect={(video) => onChange(item.id, "videoId", video.id)}
          onRemove={() => onChange(item.id, "videoId", null)}
          onClose={() => setShowVideoPicker(false)}
        />
      )}

      {/* Video preview modal */}
      {showVideoPreview && attachedVideo && (
        <VideoPreviewModal
          video={attachedVideo}
          onClose={() => setShowVideoPreview(false)}
        />
      )}
    </div>
  );
}

// ─── SortableWrapper ──────────────────────────────────────────────────────────

function SortableWrapper({
  id,
  children,
}: {
  id: string;
  children: (args: {
    dragHandleProps: Record<string, unknown>;
    isDragging: boolean;
  }) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {children({ dragHandleProps: { ...attributes, ...listeners }, isDragging })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const DEFAULT_ITEMS: WorkoutItem[] = [
  newSection("Warm-up"),
  newExercise({ name: "Lat Pulldown", sets: "4", reps: "10", weight: "60kg", rest: "90s" }),
  newSection("Main lifts"),
  newExercise({ name: "Seated Row", sets: "3", reps: "12", weight: "50kg", rest: "90s" }),
  newExercise({ name: "Face Pull", sets: "3", reps: "15", rest: "60s" }),
];

export default function WorkoutBuilderPage() {
  const [workoutName, setWorkoutName] = useState("");
  const [goal, setGoal] = useState<Goal>("hypertrophy");
  const [duration, setDuration] = useState("");
  const [items, setItems] = useState<WorkoutItem[]>(DEFAULT_ITEMS);
  const [saved, setSaved] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sectionMenuOpen, setSectionMenuOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  const activeItem = activeId ? items.find((i) => i.id === activeId) ?? null : null;

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveId(null);
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const from = prev.findIndex((i) => i.id === active.id);
      const to   = prev.findIndex((i) => i.id === over.id);
      return arrayMove(prev, from, to);
    });
    setSaved(false);
  }

  const updateItem = useCallback(
    (id: string, field: string, value: string | boolean | null) => {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
      );
      setSaved(false);
    },
    []
  );

  function moveItem(id: string, dir: -1 | 1) {
    setItems((prev) => {
      const i = prev.findIndex((item) => item.id === id);
      const target = i + dir;
      if (target < 0 || target >= prev.length) return prev;
      return arrayMove(prev, i, target);
    });
    setSaved(false);
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
    setSaved(false);
  }

  function duplicateExercise(id: string) {
    setItems((prev) => {
      const i = prev.findIndex((item) => item.id === id);
      const original = prev[i] as ExerciseItem;
      const copy: ExerciseItem = { ...original, id: uid(), name: `${original.name} (copy)` };
      const next = [...prev];
      next.splice(i + 1, 0, copy);
      return next;
    });
    setSaved(false);
  }

  function addExercise() {
    setItems((prev) => [...prev, newExercise()]);
    setSaved(false);
  }

  function addSection(label: string) {
    setItems((prev) => [...prev, newSection(label)]);
    setSectionMenuOpen(false);
    setSaved(false);
  }

  // Exercise-only index for display numbering
  const exerciseNumbers: Record<string, number> = {};
  let exCount = 0;
  items.forEach((item) => {
    if (item.type === "exercise") exerciseNumbers[item.id] = exCount++;
  });

  return (
    <div className="px-5 md:px-8 py-6 text-white max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.22em] text-white/30 mb-3">
          Program · Builder
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">New workout</h1>
      </div>

      {/* Meta card */}
      <div className="rounded-2xl border border-white/8 bg-[#111111] px-6 py-5 mb-4 space-y-6">
        {/* Name */}
        <div>
          <label className="text-[10px] uppercase tracking-[0.18em] text-white/25 block mb-2">
            Workout name
          </label>
          <input
            type="text"
            value={workoutName}
            onChange={(e) => { setWorkoutName(e.target.value); setSaved(false); }}
            placeholder="e.g. Upper Body Pull"
            className="w-full bg-transparent text-lg font-medium text-white/90 placeholder:text-white/20 outline-none border-b border-white/8 focus:border-[#B48B40]/40 transition-colors pb-2"
          />
        </div>

        {/* Goal */}
        <div>
          <label className="text-[10px] uppercase tracking-[0.18em] text-white/25 block mb-3">
            Goal
          </label>
          <div className="flex gap-2 flex-wrap">
            {GOAL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setGoal(opt.value); setSaved(false); }}
                className={cn(
                  "rounded-xl border px-4 py-2.5 text-left transition-all",
                  goal === opt.value
                    ? "border-[#B48B40]/40 bg-[#B48B40]/8"
                    : "border-white/8 bg-white/[0.02] hover:border-white/15"
                )}
              >
                <p className={cn(
                  "text-sm font-medium",
                  goal === opt.value ? "text-[#B48B40]" : "text-white/65"
                )}>
                  {opt.label}
                </p>
                <p className="text-xs text-white/25 mt-0.5">{opt.sub}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Duration */}
        <div className="w-32">
          <label className="text-[10px] uppercase tracking-[0.18em] text-white/25 block mb-2">
            Duration
          </label>
          <div className="relative">
            <input
              type="number"
              min="1"
              value={duration}
              onChange={(e) => { setDuration(e.target.value); setSaved(false); }}
              placeholder="45"
              className="w-full bg-white/[0.03] border border-white/6 rounded-xl px-3 py-2 text-sm text-white/80 placeholder:text-white/20 outline-none focus:border-[#B48B40]/40 focus:bg-[#B48B40]/5 transition-all tabular-nums"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/25 pointer-events-none">
              min
            </span>
          </div>
        </div>
      </div>

      {/* Drag-and-drop list */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2 mb-4">
            {items.map((item, index) => (
              <SortableWrapper key={item.id} id={item.id}>
                {({ dragHandleProps, isDragging }) =>
                  item.type === "section" ? (
                    <SectionCard
                      item={item}
                      isDragging={isDragging}
                      dragHandleProps={dragHandleProps}
                      onChange={(id, _field, value) => updateItem(id, "label", value)}
                      onRemove={removeItem}
                      onMoveUp={(id) => moveItem(id, -1)}
                      onMoveDown={(id) => moveItem(id, 1)}
                      isFirst={index === 0}
                      isLast={index === items.length - 1}
                    />
                  ) : (
                    <ExerciseCard
                      item={item}
                      index={exerciseNumbers[item.id]}
                      isDragging={isDragging}
                      dragHandleProps={dragHandleProps}
                      onChange={updateItem}
                      onRemove={removeItem}
                      onDuplicate={duplicateExercise}
                      onMoveUp={(id) => moveItem(id, -1)}
                      onMoveDown={(id) => moveItem(id, 1)}
                      isFirst={index === 0}
                      isLast={index === items.length - 1}
                    />
                  )
                }
              </SortableWrapper>
            ))}
          </div>
        </SortableContext>

        {/* Drag overlay — ghost card while dragging */}
        <DragOverlay dropAnimation={{ duration: 150, easing: "ease" }}>
          {activeItem ? (
            activeItem.type === "section" ? (
              <div className="flex items-center gap-2 px-1 py-1 opacity-90">
                <GripVertical className="w-4 h-4 text-[#B48B40]/50" strokeWidth={1.5} />
                <Layers className="w-3 h-3 text-[#B48B40]/50 shrink-0" strokeWidth={1.5} />
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
                  {activeItem.label}
                </span>
              </div>
            ) : (
              <div className="rounded-2xl border border-[#B48B40]/20 bg-[#161616] px-4 py-3 shadow-2xl">
                <div className="flex items-center gap-2">
                  <GripVertical className="w-4 h-4 text-[#B48B40]/50" strokeWidth={1.5} />
                  <span className="text-sm font-medium text-white/70">
                    {(activeItem as ExerciseItem).name || "Exercise"}
                  </span>
                </div>
              </div>
            )
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Add row */}
      <div className="flex gap-2 mb-8">
        <button
          onClick={addExercise}
          className="flex-1 rounded-2xl border border-dashed border-white/10 py-3 flex items-center justify-center gap-2 text-sm text-white/30 hover:text-white/55 hover:border-white/20 transition-all"
        >
          <Plus className="w-4 h-4" strokeWidth={1.5} />
          Add exercise
        </button>

        <div className="relative">
          <button
            onClick={() => setSectionMenuOpen((v) => !v)}
            className="h-full rounded-2xl border border-dashed border-white/10 px-4 flex items-center gap-2 text-sm text-white/30 hover:text-white/55 hover:border-white/20 transition-all"
          >
            <Layers className="w-4 h-4" strokeWidth={1.5} />
            Section
          </button>

          {sectionMenuOpen && (
            <div className="absolute bottom-full mb-2 right-0 rounded-xl border border-white/10 bg-[#161616] overflow-hidden shadow-2xl min-w-[160px] z-10">
              {SECTION_PRESETS.map((label) => (
                <button
                  key={label}
                  onClick={() => addSection(label)}
                  className="w-full text-left px-4 py-2.5 text-sm text-white/55 hover:text-white/85 hover:bg-white/[0.04] transition-colors"
                >
                  {label}
                </button>
              ))}
              <div className="h-px bg-white/6" />
              <button
                onClick={() => addSection("Custom")}
                className="w-full text-left px-4 py-2.5 text-sm text-white/35 hover:text-white/65 hover:bg-white/[0.04] transition-colors"
              >
                Custom…
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex items-center gap-3">
        <button className="flex items-center gap-2 rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3 text-sm text-white/45 hover:text-white/65 hover:border-white/15 transition-all">
          <Users className="w-4 h-4" strokeWidth={1.5} />
          Assign to client
        </button>

        <button
          onClick={() => setSaved(true)}
          className={cn(
            "ml-auto rounded-2xl px-6 py-3 text-sm font-semibold transition-all",
            saved
              ? "bg-white/5 text-white/35 cursor-default"
              : "bg-[#B48B40] text-black hover:bg-[#c99840]"
          )}
        >
          {saved ? "Saved ✓" : "Save workout"}
        </button>
      </div>

      {saved && (
        <p className="text-xs text-emerald-400/70 text-right mt-2">
          Workout saved.
        </p>
      )}
    </div>
  );
}
