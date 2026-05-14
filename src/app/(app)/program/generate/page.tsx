"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Sparkles, Loader2, ChevronLeft, ChevronDown, AlertCircle, CheckCircle2,
  Users, TrendingUp, Plus, Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import { useUser } from "@/context/UserContext";
import { saveBuilderWorkoutForSelf, type BuilderProgramPayload } from "@/lib/db/programs";
import { resolveWeek, type WeekTemplate, type DayWorkout, type PlannedExercise } from "@/lib/program/types";
import { AssignClientModal } from "@/components/program/AssignClientModal";
import { ExercisePickerDrawer } from "@/components/program/ExercisePickerDrawer";
import { DayCard, newTrainingDay, newRestDay } from "@/components/program/DayCard";
import type { Exercise } from "@/lib/db/exercises";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Goal = "hypertrophy" | "strength" | "fat_loss" | "performance";

const GOAL_OPTIONS: { value: Goal; label: string; sub: string }[] = [
  { value: "hypertrophy", label: "Hypertrophy", sub: "Moderate reps, volume"     },
  { value: "strength",    label: "Strength",    sub: "Heavy compound, low reps"  },
  { value: "fat_loss",    label: "Fat Loss",    sub: "High density, circuits"    },
  { value: "performance", label: "Performance", sub: "Power, athletic patterns"  },
];

const EXPERIENCE_OPTIONS = ["beginner", "intermediate", "advanced"] as const;
type Experience = typeof EXPERIENCE_OPTIONS[number];

// Equipment: grouped so users can see structure at a glance instead of a wall of chips.
const EQUIPMENT_GROUPS: { label: string; options: string[] }[] = [
  { label: "Quick presets", options: ["Full gym", "Home gym", "Garage gym", "Hotel gym", "Bodyweight only", "Travel"] },
  { label: "Free weights",  options: ["Barbell + plates", "Dumbbells (light)", "Dumbbells (full set)", "Kettlebells", "EZ-curl bar", "Adjustable dumbbells"] },
  { label: "Racks & benches", options: ["Squat rack", "Power rack", "Flat bench", "Adjustable bench", "Bench press station"] },
  { label: "Machines",      options: ["Cable / pulley", "Smith machine", "Leg press", "Lat pulldown", "Leg curl / extension", "Hack squat", "Pec deck", "Hip thrust machine"] },
  { label: "Cardio",        options: ["Treadmill", "Assault bike", "Rower", "Elliptical", "Stationary bike", "Stair climber"] },
  { label: "Functional",    options: ["Pull-up bar", "Dip station", "Resistance bands", "TRX / suspension", "Plyo box", "Medicine ball", "Slam ball", "Sled / prowler", "Battle ropes", "Sandbag"] },
  { label: "Outdoor / track", options: ["Track / field", "Hills / stairs", "Park rig", "Open trail"] },
];
const EQUIPMENT_OPTIONS = EQUIPMENT_GROUPS.flatMap((g) => g.options);

const BODY_FOCUS_GROUPS: { label: string; options: string[] }[] = [
  { label: "Upper body — push", options: ["Chest (upper)", "Chest (mid/lower)", "Front delts", "Side delts", "Triceps"] },
  { label: "Upper body — pull", options: ["Lats", "Mid back / rhomboids", "Upper traps", "Rear delts", "Biceps", "Forearms / grip"] },
  { label: "Lower body",        options: ["Quads", "Hamstrings", "Glutes", "Adductors", "Abductors", "Calves"] },
  { label: "Core",              options: ["Abs (rectus)", "Obliques", "Core stability / anti-rotation", "Lower back / erectors"] },
  { label: "Qualities",         options: ["Conditioning", "Power / explosive", "Mobility / flexibility", "Athletic / sport", "Posture", "Mind-muscle / hypertrophy"] },
];
const BODY_FOCUS_OPTIONS = BODY_FOCUS_GROUPS.flatMap((g) => g.options);

const INJURY_OPTIONS = [
  { id: "knee_left",          label: "Knee (left)" },
  { id: "knee_right",         label: "Knee (right)" },
  { id: "knee",               label: "Knee (both / general)" },
  { id: "hip_left",           label: "Hip (left)" },
  { id: "hip_right",          label: "Hip (right)" },
  { id: "hip",                label: "Hip (both / general)" },
  { id: "lower_back",         label: "Lower back" },
  { id: "mid_back",           label: "Mid / upper back" },
  { id: "neck",               label: "Neck" },
  { id: "shoulder_left",      label: "Shoulder (left)" },
  { id: "shoulder_right",     label: "Shoulder (right)" },
  { id: "shoulder",           label: "Shoulder (both / general)" },
  { id: "elbow",              label: "Elbow" },
  { id: "wrist",              label: "Wrist" },
  { id: "foot",               label: "Foot" },
  { id: "ankle",              label: "Ankle" },
  { id: "achilles",           label: "Achilles / calf" },
  { id: "hernia",             label: "Hernia / abdominal" },
  { id: "cardiac_caution",    label: "Cardiac caution" },
  { id: "pregnancy",          label: "Pregnancy (modified)" },
  { id: "post_surgery",       label: "Post-surgery recovery" },
];

const DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type GenState = "idle" | "generating" | "preview" | "saving" | "saved" | "error";

export default function ProgramGeneratePage() {
  const router = useRouter();
  const { user } = useUser();

  // Inputs
  const [goal,           setGoal]           = useState<Goal>("hypertrophy");
  const [weeks,          setWeeks]          = useState(4);
  const [daysPerWeek,    setDaysPerWeek]    = useState(4);
  const [sessionMinutes, setSessionMinutes] = useState(60);
  const [experience,     setExperience]     = useState<Experience>("intermediate");
  const [equipment,      setEquipment]      = useState<string[]>(["Full gym"]);
  const [bodyFocus,      setBodyFocus]      = useState<string[]>([]);
  const [injuries,       setInjuries]       = useState<string[]>([]);
  const [style,          setStyle]          = useState("");

  // Output
  const [state,    setState]    = useState<GenState>("idle");
  const [payload,  setPayload]  = useState<BuilderProgramPayload | null>(null);
  const [error,    setError]    = useState<string | null>(null);
  const [setActive,   setSetActive]   = useState(true);
  const [assignOpen,  setAssignOpen]  = useState(false);
  const [assignBusy,  setAssignBusy]  = useState(false);

  // Preview / edit UI
  const [previewWeek, setPreviewWeek] = useState(1);
  const [pickerOpen,  setPickerOpen]  = useState(false);
  const [pickerTarget, setPickerTarget] = useState<number | null>(null);
  const [showDowPicker, setShowDowPicker] = useState(false);

  const isAdmin    = user?.role === "master" || !!user?.isAdmin;
  const canPersist = !!user?.id && UUID_RE.test(user.id);

  async function handleGenerate() {
    setState("generating");
    setError(null);
    try {
      const res = await fetch("/api/ai/program-generator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal,
          weeks,
          daysPerWeek,
          sessionMinutes,
          experience,
          equipment,
          bodyFocus,
          injuries,
          style: style.trim() || null,
          athlete: null,
        }),
      });
      const data = await res.json() as { payload?: BuilderProgramPayload; error?: string };
      if (!res.ok || data.error || !data.payload) {
        throw new Error(data.error ?? `Generation failed (${res.status})`);
      }
      setPayload(data.payload);
      setPreviewWeek(1);
      setState("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
      setState("error");
    }
  }

  async function handleSave() {
    if (!payload || !user?.id) return;
    setState("saving");
    if (!canPersist) {
      setTimeout(() => {
        setState("saved");
        setError("Demo account — programs persist only for real signed-in users.");
      }, 250);
      return;
    }
    try {
      const program = await saveBuilderWorkoutForSelf(user.id, payload, setActive);
      if (!program) throw new Error("Save returned no row");
      setState("saved");
      if (setActive) router.push("/program");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
      setState("error");
    }
  }

  async function handleAssign(target: { id: string; email: string }, activate: boolean) {
    if (!payload) return;
    setAssignBusy(true);
    try {
      const res = await fetch("/api/admin/assign-workout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ targetUserId: target.id, payload, activate }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? `Send failed (${res.status})`);
      setAssignOpen(false);
      setState("saved");
      setError(`Sent to ${target.email}${activate ? " and set active." : " as a template."}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
      setState("error");
    } finally {
      setAssignBusy(false);
    }
  }

  function toggleArr(list: string[], setter: (v: string[]) => void, value: string) {
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  const currentWeekTemplate: WeekTemplate | null = useMemo(() => {
    if (!payload) return null;
    return resolveWeek(payload.split, previewWeek);
  }, [payload, previewWeek]);

  // ── Inline edits ────────────────────────────────────────────────────────
  // Edits to Week 1 mutate baseWeek. Edits to Week 2+ create a per-week override.
  function updateCurrentWeek(updater: (w: WeekTemplate) => WeekTemplate) {
    if (!payload) return;
    setPayload((prev) => {
      if (!prev) return prev;
      const split = prev.split;
      if (previewWeek === 1) {
        return { ...prev, split: { ...split, baseWeek: updater(split.baseWeek) } };
      }
      const existing = split.weekOverrides[previewWeek] ?? {
        ...split.baseWeek,
        days: split.baseWeek.days.map((d) => ({ ...d, exercises: d.exercises.map((e) => ({ ...e })) })),
      };
      return {
        ...prev,
        split: {
          ...split,
          weekOverrides: { ...split.weekOverrides, [previewWeek]: updater(existing) },
        },
      };
    });
  }

  function patchDay(dayIdx: number, patch: Partial<DayWorkout>) {
    updateCurrentWeek((w) => ({
      ...w,
      days: w.days.map((d, i) => i === dayIdx ? { ...d, ...patch } : d),
    }));
  }

  function removeDay(dayIdx: number) {
    updateCurrentWeek((w) => ({ ...w, days: w.days.filter((_, i) => i !== dayIdx) }));
    // Recompute daysPerWeek when removing
    setPayload((prev) => {
      if (!prev) return prev;
      const trainingCount = (resolveWeek(prev.split, 1).days)
        .filter((d) => (d.kind ?? "training") === "training").length;
      return { ...prev, daysPerWeek: trainingCount };
    });
  }

  function addDay(dow: number, kind: "training" | "rest") {
    if (!currentWeekTemplate) return;
    if (currentWeekTemplate.days.some((d) => d.dayOfWeek === dow)) return;
    updateCurrentWeek((w) => ({
      ...w,
      days: [...w.days, kind === "training" ? newTrainingDay(dow) : newRestDay(dow)]
        .sort((a, b) => a.dayOfWeek - b.dayOfWeek),
    }));
  }

  function revertOverride() {
    if (!payload || previewWeek === 1) return;
    setPayload((prev) => {
      if (!prev) return prev;
      const next = { ...prev.split.weekOverrides };
      delete next[previewWeek];
      return { ...prev, split: { ...prev.split, weekOverrides: next } };
    });
  }

  function onPickerSelect(ex: Exercise) {
    if (pickerTarget === null) return;
    const exercise: PlannedExercise = {
      exerciseId: ex.id,
      name:       ex.name,
      sets:       3,
      reps:       "8-12",
      rest:       "90s",
      weight:     "",
      note:       "",
      videoId:    null,
    };
    updateCurrentWeek((w) => ({
      ...w,
      days: w.days.map((d, i) => i === pickerTarget
        ? { ...d, exercises: [...d.exercises, exercise] }
        : d),
    }));
  }

  const isOverride = previewWeek > 1 && !!payload?.split.weekOverrides[previewWeek];

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

        <div className="mb-6">
          <p className="text-[10px] uppercase tracking-[0.28em] text-[#B48B40]/85 mb-2 flex items-center gap-2">
            <Sparkles className="w-3 h-3" strokeWidth={2} /> AI · Program generator
          </p>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Build me a full phase</h1>
          <p className="text-xs text-white/45 mt-2 max-w-xl leading-relaxed">
            Give me the constraints, get a full multi-week phase: base week + per-week progressions. Review, tweak in the builder if needed, then activate.
          </p>
        </div>

        {state !== "preview" && state !== "saving" && state !== "saved" && (
          <>
            {/* ── Inputs ── */}
            <Card className="mb-4">
              <div className="px-5 py-5 space-y-5">
                <div>
                  <label className="text-[10px] uppercase tracking-[0.18em] text-white/30 block mb-2">Goal</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {GOAL_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setGoal(opt.value)}
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

                <div className="grid grid-cols-3 gap-3">
                  <NumberField label="Phase length" value={weeks} onChange={setWeeks} min={1} max={8} unit="weeks" />
                  <NumberField label="Days/week" value={daysPerWeek} onChange={setDaysPerWeek} min={1} max={7} />
                  <NumberField label="Session" value={sessionMinutes} onChange={setSessionMinutes} min={20} max={150} unit="min" />
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-[0.18em] text-white/30 block mb-2">Experience</label>
                  <div className="flex gap-2">
                    {EXPERIENCE_OPTIONS.map((e) => (
                      <button
                        key={e}
                        onClick={() => setExperience(e)}
                        className={cn(
                          "rounded-xl border px-4 py-2 text-xs font-medium capitalize transition-all",
                          experience === e
                            ? "border-[#B48B40]/40 bg-[#B48B40]/[0.06] text-[#B48B40]"
                            : "border-white/8 bg-white/[0.02] text-white/65 hover:border-white/15",
                        )}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>

                <GroupedChipMulti label="Equipment"  groups={EQUIPMENT_GROUPS}  value={equipment} onChange={setEquipment} defaultOpen="Quick presets" />
                <GroupedChipMulti label="Body focus" groups={BODY_FOCUS_GROUPS} value={bodyFocus} onChange={setBodyFocus} defaultOpen="Qualities" />

                <div>
                  <label className="text-[10px] uppercase tracking-[0.18em] text-white/30 block mb-2">Injuries / limitations</label>
                  <div className="flex flex-wrap gap-1.5">
                    {INJURY_OPTIONS.map((opt) => {
                      const active = injuries.includes(opt.id);
                      return (
                        <button
                          key={opt.id}
                          onClick={() => toggleArr(injuries, setInjuries, opt.id)}
                          className={cn(
                            "rounded-full px-3 py-1 text-[11px] border transition-all",
                            active
                              ? "border-amber-400/40 bg-amber-400/[0.08] text-amber-300"
                              : "border-white/10 bg-white/[0.02] text-white/55 hover:border-white/20 hover:text-white/80",
                          )}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-white/30 mt-1.5">
                    Selected injuries get contraindicated lifts substituted automatically.
                  </p>
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-[0.18em] text-white/30 block mb-2">Style notes (optional)</label>
                  <textarea
                    value={style}
                    onChange={(e) => setStyle(e.target.value)}
                    placeholder="e.g. love RDLs, hate burpees, want PR-focused, training for ski season"
                    rows={2}
                    className="w-full bg-white/[0.03] border border-white/8 rounded-xl px-3 py-2 text-xs text-white/85 placeholder:text-white/25 outline-none focus:border-[#B48B40]/40 transition-colors resize-none leading-relaxed"
                  />
                </div>
              </div>
            </Card>

            <button
              onClick={handleGenerate}
              disabled={state === "generating"}
              className={cn(
                "w-full rounded-2xl py-4 text-sm font-semibold transition-all flex items-center justify-center gap-2",
                state === "generating"
                  ? "bg-white/5 text-white/45 cursor-wait"
                  : "bg-[#B48B40] text-black hover:bg-[#c99840]",
              )}
            >
              {state === "generating" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" strokeWidth={2.5} />}
              {state === "generating" ? "Generating your phase…" : `Generate a ${weeks}-week phase`}
            </button>

            {state === "error" && error && (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-400/20 bg-red-400/5 px-3 py-2.5">
                <AlertCircle className="w-4 h-4 text-red-400/80 shrink-0 mt-0.5" strokeWidth={2} />
                <p className="text-xs text-red-300/85 leading-relaxed">{error}</p>
              </div>
            )}
          </>
        )}

        {/* ── Preview ── */}
        {payload && (state === "preview" || state === "saving" || state === "saved" || state === "error") && (
          <>
            <Card className="mb-4 border-[#B48B40]/15">
              <div className="px-5 py-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.28em] text-[#B48B40]/80 mb-1">Generated</p>
                    <h2 className="text-xl font-semibold text-white/95 leading-tight">{payload.name}</h2>
                    <p className="text-xs text-white/45 mt-1">
                      {payload.split.phase.name} · {payload.weeks} weeks · {payload.daysPerWeek} days/wk
                    </p>
                  </div>
                  <button
                    onClick={() => { setState("idle"); setPayload(null); }}
                    className="text-[11px] text-white/40 hover:text-white/75 transition-colors"
                  >
                    Discard
                  </button>
                </div>

                {payload.split.phase.progression && (
                  <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] px-3 py-2.5 flex items-start gap-2.5">
                    <TrendingUp className="w-3.5 h-3.5 text-[#B48B40]/80 shrink-0 mt-0.5" strokeWidth={1.8} />
                    <div className="text-[11px] leading-relaxed">
                      <span className="text-white/70 font-medium capitalize">{payload.split.phase.progression.type.replace("_", " ")}</span>
                      {payload.split.phase.progression.notes && (
                        <span className="text-white/45"> — {payload.split.phase.progression.notes}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Week tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-3">
              <span className="text-[10px] uppercase tracking-[0.22em] text-white/30 shrink-0 mr-1">Week</span>
              {Array.from({ length: payload.weeks }, (_, i) => i + 1).map((w) => {
                const isActive = w === previewWeek;
                const isOverride = w > 1 && !!payload.split.weekOverrides[w];
                return (
                  <button
                    key={w}
                    onClick={() => setPreviewWeek(w)}
                    className={cn(
                      "shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all flex items-center gap-1.5 border",
                      isActive
                        ? "bg-[#B48B40] text-black border-[#B48B40]"
                        : "bg-white/[0.03] text-white/70 border-white/8 hover:border-white/15",
                    )}
                  >
                    W{w}
                    {isOverride && (
                      <span className={cn("w-1.5 h-1.5 rounded-full", isActive ? "bg-black/40" : "bg-[#B48B40]")} />
                    )}
                  </button>
                );
              })}
            </div>

            {currentWeekTemplate && (
              <>
                {/* Week brief / override status */}
                <Card className="mb-3">
                  <div className="px-5 py-3 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-3.5 h-3.5 text-[#B48B40]/70" strokeWidth={1.8} />
                        <span className="text-[10px] uppercase tracking-[0.18em] text-white/40">
                          Week {previewWeek} of {payload.weeks}
                        </span>
                        {previewWeek > 1 && (
                          <span className={cn(
                            "text-[10px] uppercase tracking-[0.15em] px-2 py-0.5 rounded-full border",
                            isOverride
                              ? "border-[#B48B40]/30 bg-[#B48B40]/[0.06] text-[#B48B40]"
                              : "border-white/10 bg-white/[0.02] text-white/50",
                          )}>
                            {isOverride ? "Customized" : "Inheriting base"}
                          </span>
                        )}
                      </div>
                      {isOverride && (
                        <button
                          onClick={revertOverride}
                          className="text-[11px] text-white/40 hover:text-red-300/80 transition-colors"
                        >
                          Revert to base
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[9px] uppercase tracking-[0.15em] text-white/35 block mb-1">Week intent</label>
                        <input
                          type="text"
                          value={currentWeekTemplate.intent ?? ""}
                          onChange={(e) => updateCurrentWeek((w) => ({ ...w, intent: e.target.value }))}
                          placeholder="Volume accumulation, deload, peaking…"
                          className="w-full bg-transparent text-sm text-white/80 placeholder:text-white/25 outline-none border-b border-white/[0.06] focus:border-[#B48B40]/40 transition-colors pb-1.5"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] uppercase tracking-[0.15em] text-white/35 block mb-1">Progression this week</label>
                        <input
                          type="text"
                          value={currentWeekTemplate.progressionThisWeek ?? ""}
                          onChange={(e) => updateCurrentWeek((w) => ({ ...w, progressionThisWeek: e.target.value }))}
                          placeholder={previewWeek === 1 ? "Starting load reference" : "What's different vs last week"}
                          className="w-full bg-transparent text-sm text-white/80 placeholder:text-white/25 outline-none border-b border-white/[0.06] focus:border-[#B48B40]/40 transition-colors pb-1.5"
                        />
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Day cards — editable */}
                <div className="space-y-3">
                  {currentWeekTemplate.days.map((day, dayIdx) => (
                    <DayCard
                      key={`${day.dayOfWeek}-${dayIdx}`}
                      day={day}
                      onChange={(patch) => patchDay(dayIdx, patch)}
                      onRemove={() => removeDay(dayIdx)}
                      onOpenPicker={() => { setPickerTarget(dayIdx); setPickerOpen(true); }}
                    />
                  ))}
                </div>

                {/* Add day */}
                <Card className="mt-3 border-dashed border-white/[0.08]">
                  <button
                    onClick={() => setShowDowPicker((v) => !v)}
                    className="w-full px-5 py-3 flex items-center justify-center gap-2 text-xs text-white/45 hover:text-white/80 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" strokeWidth={1.7} />
                    Add a day to Week {previewWeek}
                  </button>
                  {showDowPicker && (
                    <div className="px-5 pb-4 space-y-2">
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-white/35">
                        <Calendar className="w-3 h-3" strokeWidth={1.8} />
                        Which day, and what kind?
                      </div>
                      <div className="grid grid-cols-7 gap-1.5">
                        {DOW_SHORT.map((s, i) => {
                          const used = currentWeekTemplate.days.some((d) => d.dayOfWeek === i);
                          return (
                            <div key={i} className={cn(
                              "rounded-xl border text-[10px] flex flex-col",
                              used ? "border-white/[0.04] bg-white/[0.01] opacity-40" : "border-white/8 bg-white/[0.02]",
                            )}>
                              <div className="text-center py-1 text-white/45 font-semibold">{s}</div>
                              <button
                                disabled={used}
                                onClick={() => { addDay(i, "training"); setShowDowPicker(false); }}
                                className="border-t border-white/[0.05] py-1 text-[9px] text-[#B48B40]/80 hover:text-[#B48B40] hover:bg-[#B48B40]/[0.06] transition-colors disabled:cursor-not-allowed disabled:text-white/15 disabled:hover:bg-transparent"
                              >
                                Train
                              </button>
                              <button
                                disabled={used}
                                onClick={() => { addDay(i, "rest"); setShowDowPicker(false); }}
                                className="border-t border-white/[0.05] py-1 text-[9px] text-white/45 hover:text-white/85 hover:bg-white/[0.04] transition-colors disabled:cursor-not-allowed disabled:text-white/15 disabled:hover:bg-transparent"
                              >
                                Rest
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </Card>
              </>
            )}

            {/* Footer */}
            <div className="mt-6 space-y-3">
              <label className="flex items-center gap-2.5 cursor-pointer select-none px-1">
                <input
                  type="checkbox"
                  checked={setActive}
                  onChange={(e) => setSetActive(e.target.checked)}
                  className="w-4 h-4 rounded border-white/15 bg-white/[0.04] accent-[#B48B40]"
                />
                <span className="text-xs text-white/65">Set as my active program after saving</span>
              </label>

              <div className="flex items-center gap-3 flex-wrap">
                {isAdmin && (
                  <button
                    onClick={() => setAssignOpen(true)}
                    disabled={state === "saving" || assignBusy}
                    className="flex items-center gap-2 rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3 text-sm text-white/65 hover:text-white/90 hover:border-white/15 transition-all disabled:opacity-40"
                  >
                    <Users className="w-4 h-4" strokeWidth={1.7} />
                    Send to user
                  </button>
                )}

                <button
                  onClick={() => void handleSave()}
                  disabled={state === "saving" || state === "saved"}
                  className={cn(
                    "ml-auto rounded-2xl px-6 py-3 text-sm font-semibold transition-all flex items-center gap-2",
                    state === "saving" ? "bg-white/5 text-white/45 cursor-wait"
                    : state === "saved" ? "bg-emerald-500/15 text-emerald-300 border border-emerald-400/20"
                    : "bg-[#B48B40] text-black hover:bg-[#c99840]",
                  )}
                >
                  {state === "saving" && <Loader2 className="w-4 h-4 animate-spin" />}
                  {state === "saved"  && <CheckCircle2 className="w-4 h-4" strokeWidth={2} />}
                  {state === "saving" ? "Saving…"
                    : state === "saved" ? "Saved"
                    : setActive ? "Save & activate" : "Save as template"}
                </button>
              </div>

              {error && state === "error" && (
                <div className="flex items-start gap-2 rounded-xl border border-red-400/20 bg-red-400/5 px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 text-red-400/80 shrink-0 mt-0.5" strokeWidth={2} />
                  <p className="text-xs text-red-300/85 leading-relaxed">{error}</p>
                </div>
              )}
              {error && state === "saved" && (
                <p className="text-xs text-emerald-400/80 text-right">{error}</p>
              )}
            </div>
          </>
        )}

        {/* Footer links visible always */}
        <div className="mt-10 flex items-center gap-3 text-[11px] text-white/30 justify-center">
          <Link href="/program/builder" className="hover:text-white/60 transition-colors">Build manually</Link>
          <span className="text-white/15">·</span>
          <Link href="/program/library" className="hover:text-white/60 transition-colors">My library</Link>
          <span className="text-white/15">·</span>
          <Link href="/program" className="hover:text-white/60 transition-colors">Active program</Link>
        </div>
      </div>

      <ExercisePickerDrawer
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={onPickerSelect}
      />

      <AssignClientModal
        open={assignOpen}
        onClose={() => !assignBusy && setAssignOpen(false)}
        onConfirm={(target, activate) => handleAssign(target, activate)}
        busy={assignBusy}
      />
    </div>
  );
}

// ─── Small inputs ────────────────────────────────────────────────────────────

function NumberField({
  label, value, onChange, min, max, unit,
}: {
  label:   string;
  value:   number;
  onChange: (v: number) => void;
  min:     number;
  max:     number;
  unit?:   string;
}) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-[0.18em] text-white/30 block mb-2">{label}</label>
      <div className="relative">
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Math.max(min, Math.min(max, parseInt(e.target.value) || min)))}
          className="w-full bg-white/[0.03] border border-white/8 rounded-xl px-3 py-2 text-sm text-white/85 outline-none focus:border-[#B48B40]/40 transition-colors tabular-nums pr-12"
        />
        {unit && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-white/30">{unit}</span>}
      </div>
    </div>
  );
}

function ChipMulti({
  label, value, options, onChange,
}: {
  label:   string;
  value:   string[];
  options: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-[0.18em] text-white/30 block mb-2">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = value.includes(opt);
          return (
            <button
              key={opt}
              onClick={() => onChange(active ? value.filter((v) => v !== opt) : [...value, opt])}
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

function GroupedChipMulti({
  label, groups, value, onChange, defaultOpen,
}: {
  label:   string;
  groups:  { label: string; options: string[] }[];
  value:   string[];
  onChange: (v: string[]) => void;
  defaultOpen?: string;
}) {
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (defaultOpen) initial.add(defaultOpen);
    // Auto-open any group that has a selected item
    for (const g of groups) {
      if (g.options.some((o) => value.includes(o))) initial.add(g.label);
    }
    return initial;
  });

  function toggleGroup(name: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }

  function selectedInGroup(group: { options: string[] }) {
    return group.options.filter((o) => value.includes(o)).length;
  }

  const totalSelected = value.length;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-[10px] uppercase tracking-[0.18em] text-white/30">{label}</label>
        {totalSelected > 0 && (
          <button
            onClick={() => onChange([])}
            className="text-[10px] text-white/35 hover:text-white/70 transition-colors"
          >
            Clear {totalSelected}
          </button>
        )}
      </div>
      <div className="space-y-1.5">
        {groups.map((g) => {
          const open  = openGroups.has(g.label);
          const count = selectedInGroup(g);
          return (
            <div key={g.label} className="rounded-xl border border-white/[0.06] bg-white/[0.015] overflow-hidden">
              <button
                onClick={() => toggleGroup(g.label)}
                className="w-full px-3 py-2 flex items-center justify-between hover:bg-white/[0.02] transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[11px] uppercase tracking-[0.18em] text-white/60 font-medium">{g.label}</span>
                  {count > 0 && (
                    <span className="text-[10px] tabular-nums text-[#B48B40] bg-[#B48B40]/[0.08] border border-[#B48B40]/25 rounded-full px-1.5 py-0.5">
                      {count}
                    </span>
                  )}
                </div>
                <ChevronDown
                  className={cn("w-3.5 h-3.5 text-white/30 transition-transform", open && "rotate-180")}
                  strokeWidth={2}
                />
              </button>
              {open && (
                <div className="px-3 pb-3 pt-1 border-t border-white/[0.04]">
                  <div className="flex flex-wrap gap-1.5">
                    {g.options.map((opt) => {
                      const active = value.includes(opt);
                      return (
                        <button
                          key={opt}
                          onClick={() => onChange(active ? value.filter((v) => v !== opt) : [...value, opt])}
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
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
