"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Sparkles, Loader2, ChevronLeft, ChevronDown, AlertCircle, CheckCircle2,
  Users, Edit3, TrendingUp, Dumbbell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useUser } from "@/context/UserContext";
import { saveBuilderWorkoutForSelf, type BuilderProgramPayload } from "@/lib/db/programs";
import { resolveWeek, type WeekTemplate } from "@/lib/program/types";
import { AssignClientModal } from "@/components/program/AssignClientModal";

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

const EQUIPMENT_OPTIONS = ["Full gym", "Home gym", "Dumbbells only", "Bodyweight", "Bands", "Travel"];
const BODY_FOCUS_OPTIONS = ["Chest", "Back", "Shoulders", "Arms", "Legs", "Glutes", "Core", "Conditioning"];
const INJURY_OPTIONS = [
  { id: "knee",        label: "Knee" },
  { id: "lower_back",  label: "Lower back" },
  { id: "shoulder",    label: "Shoulder" },
  { id: "foot",        label: "Foot / ankle" },
  { id: "hip",         label: "Hip" },
];

const DOW_LONG = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

  // Preview UI
  const [previewWeek, setPreviewWeek] = useState(1);
  const [expandedDay, setExpandedDay] = useState<number | null>(0);

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
      setExpandedDay(0);
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

                <ChipMulti label="Equipment" value={equipment} options={EQUIPMENT_OPTIONS} onChange={setEquipment} />
                <ChipMulti label="Body focus" value={bodyFocus} options={BODY_FOCUS_OPTIONS} onChange={setBodyFocus} />

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
                {(currentWeekTemplate.intent || currentWeekTemplate.progressionThisWeek) && (
                  <Card className="mb-3">
                    <div className="px-5 py-3 space-y-1">
                      {currentWeekTemplate.intent && (
                        <p className="text-xs text-white/80">
                          <span className="text-[10px] uppercase tracking-[0.18em] text-white/35 mr-2">Intent</span>
                          {currentWeekTemplate.intent}
                        </p>
                      )}
                      {currentWeekTemplate.progressionThisWeek && (
                        <p className="text-xs text-[#B48B40]/85">
                          <span className="text-[10px] uppercase tracking-[0.18em] text-[#B48B40]/60 mr-2">Progression</span>
                          {currentWeekTemplate.progressionThisWeek}
                        </p>
                      )}
                    </div>
                  </Card>
                )}

                <div className="space-y-2">
                  {currentWeekTemplate.days.map((day, dayIdx) => {
                    const expanded = expandedDay === dayIdx;
                    return (
                      <Card key={`${day.dayOfWeek}-${dayIdx}`}>
                        <button
                          onClick={() => setExpandedDay(expanded ? null : dayIdx)}
                          className="w-full text-left px-5 py-3 flex items-center justify-between gap-3 hover:bg-white/[0.02] transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-[#B48B40]/10 border border-[#B48B40]/20 flex items-center justify-center shrink-0">
                              <Dumbbell className="w-3.5 h-3.5 text-[#B48B40]" strokeWidth={2} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-white/90 truncate">{day.name}</p>
                              <p className="text-[11px] text-white/40 truncate">
                                {DOW_LONG[day.dayOfWeek]} · {day.exercises.length} exercises · ~{day.estimatedMinutes}min
                                {day.focus && ` · ${day.focus}`}
                              </p>
                            </div>
                          </div>
                          <ChevronDown className={cn("w-4 h-4 text-white/30 transition-transform shrink-0", expanded && "rotate-180")} strokeWidth={2} />
                        </button>

                        {expanded && (
                          <div className="px-5 pb-4 border-t border-white/[0.05]">
                            <div className="mt-3 space-y-1.5">
                              {day.exercises.map((ex, exIdx) => (
                                <div key={exIdx} className="grid grid-cols-12 gap-2 items-center py-1.5 border-b border-white/[0.04] last:border-0 text-xs">
                                  <span className="col-span-1 text-white/25 tabular-nums">{String(exIdx + 1).padStart(2, "0")}</span>
                                  <span className="col-span-5 text-white/85 truncate">{ex.name}</span>
                                  <span className="col-span-2 text-white/55 tabular-nums">{ex.sets} × {ex.reps}</span>
                                  <span className="col-span-2 text-white/45">{ex.weight || "—"}</span>
                                  <span className="col-span-2 text-white/45">{ex.rest || "—"}</span>
                                  {ex.note && <p className="col-span-12 col-start-2 text-[11px] text-white/40 italic mt-0.5">{ex.note}</p>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
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
                  onClick={() => router.push("/program/builder")}
                  disabled={state === "saving"}
                  className="flex items-center gap-2 rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3 text-sm text-white/65 hover:text-white/90 hover:border-white/15 transition-all"
                >
                  <Edit3 className="w-4 h-4" strokeWidth={1.7} />
                  Open in builder
                </button>

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
