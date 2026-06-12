"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowLeftRight,
  Camera, Image as ImageIcon, Loader2, Scale, Trash2,
  TrendingDown, TrendingUp, Upload,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/context/UserContext";
import { getOnboardingState } from "@/lib/db/onboarding";
import { getMeals } from "@/lib/nutrition/store";
import type { LoggedMeal } from "@/lib/nutrition/types";
import { getWorkoutLogsForUser, type WorkoutLog } from "@/lib/workout";
import { WorkoutMuscleRadar } from "@/components/progress/WorkoutMuscleRadar";
import {
  displayUnitToKg,
  inferUnitSystemFromRawAnswers,
  kgToDisplayUnit,
  readStoredUnitSystem,
  UNIT_STORAGE_KEY,
  weightUnitLabel,
  type UnitSystem,
} from "@/lib/units";

type WeightLog = {
  id: string;
  logged_at: string;
  weight_kg: number;
  note: string | null;
  created_at: string;
};

type ProgressPhoto = {
  id: string;
  caption: string | null;
  taken_at: string;
  created_at: string;
  signed_url: string | null;
};

type RangePreset = "30d" | "90d" | "6m" | "1y" | "all" | "custom";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function formatFullDate(iso: string | null | undefined) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatShortDate(iso: string | null | undefined) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function sortWeightLogs(logs: WeightLog[]) {
  return [...logs].sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime());
}

function rangeStart(preset: RangePreset, customStart: string): number | null {
  if (preset === "all") return null;
  if (preset === "custom") {
    const t = customStart ? new Date(`${customStart}T00:00:00`).getTime() : NaN;
    return Number.isNaN(t) ? null : t;
  }
  const days = preset === "30d" ? 30 : preset === "90d" ? 90 : preset === "6m" ? 183 : 365;
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function rangeEnd(preset: RangePreset, customEnd: string): number | null {
  if (preset !== "custom" || !customEnd) return null;
  const d = new Date(`${customEnd}T23:59:59`);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

type ComparisonTrend = "up" | "down" | "same" | "missing";

type ComparisonInsight = {
  label: string;
  before: string;
  after: string;
  summary: string;
  trend: ComparisonTrend;
};

function formatMonth(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Selected month";
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function monthWindow(iso: string) {
  const d = new Date(iso);
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return { startMs: start.getTime(), endMs: end.getTime(), label: formatMonth(iso) };
}

function inWindow(ms: number, startMs: number, endMs: number) {
  return Number.isFinite(ms) && ms >= startMs && ms < endMs;
}

function plural(count: number, singular: string, pluralLabel = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralLabel}`;
}

function average(values: number[]) {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return null;
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}

function localDayKey(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function countUniqueDays(values: string[]) {
  return new Set(values.map(localDayKey).filter(Boolean)).size;
}

function compareTrend(before: number, after: number): ComparisonTrend {
  if (before === 0 && after === 0) return "missing";
  if (after > before) return "up";
  if (after < before) return "down";
  return "same";
}

function countSummary(before: number, after: number, singular: string, pluralLabel: string, beforeLabel: string, afterLabel: string) {
  if (before === 0 && after === 0) return `No ${pluralLabel} logged in either month.`;
  const delta = after - before;
  if (delta > 0) return `${afterLabel} had ${plural(delta, `more ${singular}`, `more ${pluralLabel}`)} than ${beforeLabel}.`;
  if (delta < 0) return `${afterLabel} had ${plural(Math.abs(delta), `fewer ${singular}`, `fewer ${pluralLabel}`)} than ${beforeLabel}.`;
  return `Same ${pluralLabel} count in both months.`;
}

function formatWeight(weightKg: number, unitSystem: UnitSystem) {
  return `${kgToDisplayUnit(weightKg, unitSystem).toFixed(1)} ${weightUnitLabel(unitSystem)}`;
}

function formatWeightDelta(deltaKg: number, unitSystem: UnitSystem) {
  const value = kgToDisplayUnit(deltaKg, unitSystem);
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)} ${weightUnitLabel(unitSystem)}`;
}

function nearestWeightLog(logs: WeightLog[], targetMs: number) {
  const maxDistance = 45 * 24 * 60 * 60 * 1000;
  let best: { log: WeightLog; distance: number } | null = null;
  for (const log of logs) {
    const ms = new Date(log.logged_at).getTime();
    if (!Number.isFinite(ms)) continue;
    const distance = Math.abs(ms - targetMs);
    if (distance > maxDistance) continue;
    if (!best || distance < best.distance) best = { log, distance };
  }
  return best?.log ?? null;
}

function buildComparisonInsights({
  beforePhoto,
  afterPhoto,
  weightLogs,
  workoutLogs,
  meals,
  photos,
  unitSystem,
}: {
  beforePhoto: ProgressPhoto | null;
  afterPhoto: ProgressPhoto | null;
  weightLogs: WeightLog[];
  workoutLogs: WorkoutLog[];
  meals: LoggedMeal[];
  photos: ProgressPhoto[];
  unitSystem: UnitSystem;
}) {
  if (!beforePhoto || !afterPhoto) return null;

  const beforeWindow = monthWindow(beforePhoto.taken_at);
  const afterWindow = monthWindow(afterPhoto.taken_at);
  const beforeWorkoutLogs = workoutLogs.filter((log) => inWindow(log.completedAt, beforeWindow.startMs, beforeWindow.endMs));
  const afterWorkoutLogs = workoutLogs.filter((log) => inWindow(log.completedAt, afterWindow.startMs, afterWindow.endMs));
  const beforeMeals = meals.filter((meal) => !meal.deletedAt && inWindow(new Date(meal.eatenAt).getTime(), beforeWindow.startMs, beforeWindow.endMs));
  const afterMeals = meals.filter((meal) => !meal.deletedAt && inWindow(new Date(meal.eatenAt).getTime(), afterWindow.startMs, afterWindow.endMs));
  const beforeWeights = weightLogs.filter((log) => inWindow(new Date(log.logged_at).getTime(), beforeWindow.startMs, beforeWindow.endMs));
  const afterWeights = weightLogs.filter((log) => inWindow(new Date(log.logged_at).getTime(), afterWindow.startMs, afterWindow.endMs));
  const beforePhotos = photos.filter((photo) => inWindow(new Date(photo.taken_at).getTime(), beforeWindow.startMs, beforeWindow.endMs));
  const afterPhotos = photos.filter((photo) => inWindow(new Date(photo.taken_at).getTime(), afterWindow.startMs, afterWindow.endMs));

  const beforeVolume = beforeWorkoutLogs.reduce((sum, log) => sum + (log.setsCompleted || 0), 0);
  const afterVolume = afterWorkoutLogs.reduce((sum, log) => sum + (log.setsCompleted || 0), 0);
  const beforeDifficulty = average(beforeWorkoutLogs.map((log) => Number(log.difficulty)).filter(Number.isFinite));
  const afterDifficulty = average(afterWorkoutLogs.map((log) => Number(log.difficulty)).filter(Number.isFinite));
  const beforeNutritionDays = countUniqueDays(beforeMeals.map((meal) => meal.eatenAt));
  const afterNutritionDays = countUniqueDays(afterMeals.map((meal) => meal.eatenAt));
  const beforeTracking = beforeWeights.length + beforePhotos.length + beforeMeals.length + beforeWorkoutLogs.length;
  const afterTracking = afterWeights.length + afterPhotos.length + afterMeals.length + afterWorkoutLogs.length;

  const beforeWeight = nearestWeightLog(weightLogs, new Date(beforePhoto.taken_at).getTime());
  const afterWeight = nearestWeightLog(weightLogs, new Date(afterPhoto.taken_at).getTime());

  const insights: ComparisonInsight[] = [
    {
      label: "Workouts",
      before: plural(beforeWorkoutLogs.length, "session"),
      after: plural(afterWorkoutLogs.length, "session"),
      summary: countSummary(beforeWorkoutLogs.length, afterWorkoutLogs.length, "session", "sessions", beforeWindow.label, afterWindow.label),
      trend: compareTrend(beforeWorkoutLogs.length, afterWorkoutLogs.length),
    },
    {
      label: "Training volume",
      before: plural(beforeVolume, "set"),
      after: plural(afterVolume, "set"),
      summary: beforeVolume || afterVolume
        ? countSummary(beforeVolume, afterVolume, "set", "sets", beforeWindow.label, afterWindow.label)
        : "No completed-set volume logged in either month.",
      trend: compareTrend(beforeVolume, afterVolume),
    },
    {
      label: "Intensity",
      before: beforeDifficulty == null ? "No rating" : `${beforeDifficulty.toFixed(1)} avg`,
      after: afterDifficulty == null ? "No rating" : `${afterDifficulty.toFixed(1)} avg`,
      summary: beforeDifficulty == null || afterDifficulty == null
        ? "Workout difficulty ratings are not complete enough to compare."
        : afterDifficulty > beforeDifficulty
          ? `${afterWindow.label} averaged harder logged workouts.`
          : afterDifficulty < beforeDifficulty
            ? `${afterWindow.label} averaged easier logged workouts.`
            : "Average logged workout difficulty was the same.",
      trend: beforeDifficulty == null || afterDifficulty == null ? "missing" : compareTrend(beforeDifficulty, afterDifficulty),
    },
    {
      label: "Nutrition",
      before: plural(beforeNutritionDays, "day"),
      after: plural(afterNutritionDays, "day"),
      summary: countSummary(beforeNutritionDays, afterNutritionDays, "nutrition day", "nutrition days", beforeWindow.label, afterWindow.label),
      trend: compareTrend(beforeNutritionDays, afterNutritionDays),
    },
    {
      label: "Tracking",
      before: plural(beforeTracking, "entry", "entries"),
      after: plural(afterTracking, "entry", "entries"),
      summary: countSummary(beforeTracking, afterTracking, "entry", "entries", beforeWindow.label, afterWindow.label),
      trend: compareTrend(beforeTracking, afterTracking),
    },
    {
      label: "Body weight",
      before: beforeWeight ? formatWeight(beforeWeight.weight_kg, unitSystem) : "No nearby log",
      after: afterWeight ? formatWeight(afterWeight.weight_kg, unitSystem) : "No nearby log",
      summary: beforeWeight && afterWeight
        ? `Nearest logged weight changed ${formatWeightDelta(afterWeight.weight_kg - beforeWeight.weight_kg, unitSystem)}.`
        : "Add weight logs near both photos to compare scale change.",
      trend: beforeWeight && afterWeight ? compareTrend(beforeWeight.weight_kg, afterWeight.weight_kg) : "missing",
    },
    {
      label: "Steps",
      before: "Not connected",
      after: "Not connected",
      summary: "Steps are not connected to progress analytics yet.",
      trend: "missing",
    },
  ];

  return {
    beforeLabel: beforeWindow.label,
    afterLabel: afterWindow.label,
    sameMonth: beforeWindow.startMs === afterWindow.startMs,
    insights,
  };
}

export default function ProgressPage() {
  const { user } = useUser();
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [meals, setMeals] = useState<LoggedMeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unitSystem, setUnitSystem] = useState<UnitSystem>("metric");

  const [range, setRange] = useState<RangePreset>("90d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const [weightDraft, setWeightDraft] = useState("");
  const [weightDate, setWeightDate] = useState(todayInputValue);
  const [weightNote, setWeightNote] = useState("");
  const [weightSaving, setWeightSaving] = useState(false);
  const [selectedWeightId, setSelectedWeightId] = useState<string | null>(null);

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoCaption, setPhotoCaption] = useState("");
  const [photoDate, setPhotoDate] = useState(todayInputValue);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoInputKey, setPhotoInputKey] = useState(0);
  const [compareFromId, setCompareFromId] = useState("");
  const [compareToId, setCompareToId] = useState("");

  const isRealUser = UUID_RE.test(user.id);

  useEffect(() => {
    const local = readStoredUnitSystem(user.id);
    if (local) setUnitSystem(local);

    if (!isRealUser) return;
    let active = true;
    getOnboardingState(user.id)
      .then((state) => {
        if (!active) return;
        try {
          if (localStorage.getItem(UNIT_STORAGE_KEY(user.id))) return;
        } catch { /* ignore */ }
        const inferred = inferUnitSystemFromRawAnswers(state?.raw_answers);
        if (inferred) setUnitSystem(inferred);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [user.id, isRealUser]);

  async function loadProgress() {
    if (!isRealUser) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [weightRes, photoRes, workouts, loggedMeals] = await Promise.all([
        fetch(`/api/clients/${user.id}/weight`, { cache: "no-store" }),
        fetch(`/api/clients/${user.id}/photos`, { cache: "no-store" }),
        getWorkoutLogsForUser(user.id).catch(() => [] as WorkoutLog[]),
        getMeals(user.id).catch(() => [] as LoggedMeal[]),
      ]);
      const [weightJson, photoJson] = await Promise.all([weightRes.json(), photoRes.json()]);
      if (!weightRes.ok) throw new Error(weightJson.error ?? "Could not load weight logs.");
      if (!photoRes.ok) throw new Error(photoJson.error ?? "Could not load progress photos.");
      setWeightLogs(sortWeightLogs((weightJson.logs ?? []) as WeightLog[]));
      setPhotos((photoJson.photos ?? []) as ProgressPhoto[]);
      setWorkoutLogs(workouts);
      setMeals(loggedMeals.filter((meal) => !meal.deletedAt));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load progress.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadProgress(); }, [user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const start = rangeStart(range, customStart);
    const end = rangeEnd(range, customEnd);
    return weightLogs.filter((log) => {
      const t = new Date(log.logged_at).getTime();
      if (start != null && t < start) return false;
      if (end != null && t > end) return false;
      return true;
    });
  }, [weightLogs, range, customStart, customEnd]);

  const filteredPhotos = useMemo(() => {
    const start = rangeStart(range, customStart);
    const end = rangeEnd(range, customEnd);
    return photos.filter((photo) => {
      const t = new Date(photo.taken_at).getTime();
      if (start != null && t < start) return false;
      if (end != null && t > end) return false;
      return true;
    });
  }, [photos, range, customStart, customEnd]);

  const first = filtered[0] ?? null;
  const latest = filtered[filtered.length - 1] ?? null;
  const delta = first && latest ? Number(latest.weight_kg) - Number(first.weight_kg) : null;
  const selectedWeight = filtered.find((log) => log.id === selectedWeightId) ?? latest;
  const unitLabel = weightUnitLabel(unitSystem);
  const chronologicalPhotos = useMemo(
    () => [...photos].sort((a, b) => new Date(a.taken_at).getTime() - new Date(b.taken_at).getTime()),
    [photos],
  );
  const compareFromPhoto = chronologicalPhotos.find((photo) => photo.id === compareFromId) ?? chronologicalPhotos[0] ?? null;
  const compareToPhoto = chronologicalPhotos.find((photo) => photo.id === compareToId) ?? chronologicalPhotos[chronologicalPhotos.length - 1] ?? null;
  const comparison = useMemo(
    () => buildComparisonInsights({
      beforePhoto: compareFromPhoto,
      afterPhoto: compareToPhoto,
      weightLogs,
      workoutLogs,
      meals,
      photos,
      unitSystem,
    }),
    [compareFromPhoto, compareToPhoto, weightLogs, workoutLogs, meals, photos, unitSystem],
  );

  useEffect(() => {
    if (chronologicalPhotos.length === 0) {
      setCompareFromId("");
      setCompareToId("");
      return;
    }
    setCompareFromId((current) => chronologicalPhotos.some((photo) => photo.id === current) ? current : chronologicalPhotos[0].id);
    setCompareToId((current) => chronologicalPhotos.some((photo) => photo.id === current) ? current : chronologicalPhotos[chronologicalPhotos.length - 1].id);
  }, [chronologicalPhotos]);

  async function addWeightLog() {
    if (weightSaving) return;
    const weight = Number(weightDraft);
    if (!Number.isFinite(weight) || weight <= 0) return;
    setWeightSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${user.id}/weight`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weight_kg: displayUnitToKg(weight, unitSystem), logged_at: weightDate, note: weightNote }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not save weight.");
      const log = json.log as WeightLog;
      setWeightLogs((prev) => sortWeightLogs([...prev, log]));
      setSelectedWeightId(log.id);
      setWeightDraft("");
      setWeightNote("");
      setWeightDate(todayInputValue());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save weight.");
    } finally {
      setWeightSaving(false);
    }
  }

  async function deleteWeightLog(logId: string) {
    const prev = weightLogs;
    setWeightLogs((logs) => logs.filter((log) => log.id !== logId));
    if (selectedWeightId === logId) setSelectedWeightId(null);
    const res = await fetch(`/api/clients/${user.id}/weight?id=${encodeURIComponent(logId)}`, { method: "DELETE" });
    if (!res.ok) setWeightLogs(prev);
  }

  async function uploadPhoto() {
    if (!photoFile || photoUploading) return;
    setPhotoUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("file", photoFile);
      body.set("taken_at", photoDate);
      body.set("caption", photoCaption);
      const res = await fetch(`/api/clients/${user.id}/photos`, { method: "POST", body });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not upload photo.");
      setPhotos((prev) => [json.photo as ProgressPhoto, ...prev]);
      setPhotoFile(null);
      setPhotoCaption("");
      setPhotoDate(todayInputValue());
      setPhotoInputKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not upload photo.");
    } finally {
      setPhotoUploading(false);
    }
  }

  async function deletePhoto(photoId: string) {
    const prev = photos;
    setPhotos((p) => p.filter((photo) => photo.id !== photoId));
    const res = await fetch(`/api/clients/${user.id}/photos?id=${encodeURIComponent(photoId)}`, { method: "DELETE" });
    if (!res.ok) setPhotos(prev);
  }

  return (
    <div className="px-5 md:px-8 py-6 max-w-3xl mx-auto text-white space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[10px] text-white/22 mb-2">Body progress</p>
          <h1 className="text-2xl font-semibold tracking-tight">Progress</h1>
          <p className="text-sm text-white/35 mt-1">Track weight and private progress photos over any period.</p>
        </div>
        <RangeControls
          range={range}
          customStart={customStart}
          customEnd={customEnd}
          onRange={setRange}
          onCustomStart={setCustomStart}
          onCustomEnd={setCustomEnd}
        />
      </div>

      {/* Training map — muscle-group radar + volume stats (self-gates if empty) */}
      {isRealUser && <WorkoutMuscleRadar />}

      {!isRealUser && (
        <div className="rounded-2xl border border-white/[0.06] bg-[#111111] px-5 py-6 text-sm text-white/45">
          Progress tracking is available for signed-in Supabase accounts.
        </div>
      )}

      {error && (
        <p className="rounded-xl border border-red-400/15 bg-red-400/8 px-3 py-2 text-xs text-red-200/80">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-white/40 text-sm">
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading progress...
        </div>
      ) : isRealUser && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <SummaryCard
              icon={Scale}
              label="Current"
              value={latest ? formatWeight(latest.weight_kg, unitSystem) : "None"}
              detail={latest ? formatFullDate(latest.logged_at) : "no weight logs"}
            />
            <SummaryCard
              icon={delta != null && delta < 0 ? TrendingDown : TrendingUp}
              label="Change"
              value={delta == null ? "-" : formatWeightDelta(delta, unitSystem)}
              detail={filtered.length > 1 ? `${filtered.length} logs in range` : "need two logs"}
            />
            <SummaryCard
              icon={Camera}
              label="Photos"
              value={String(filteredPhotos.length)}
              detail={filteredPhotos[0] ? `last ${formatShortDate(filteredPhotos[0].taken_at)}` : "none in range"}
            />
          </div>

          <section className="rounded-2xl border border-white/[0.06] bg-[#111111] p-4">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-sm font-semibold text-white/85 flex items-center gap-2">
                  <Scale className="w-4 h-4 text-[#B48B40]" strokeWidth={1.8} /> Bodyweight
                </p>
                <p className="text-[11px] text-white/35 mt-0.5">{filtered.length} log{filtered.length === 1 ? "" : "s"} in range</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_9rem] gap-2 mb-3">
              <input
                value={weightDraft}
                onChange={(e) => setWeightDraft(e.target.value)}
                type="number"
                min="1"
                step="0.1"
                inputMode="decimal"
                placeholder={`Weight ${unitLabel}`}
                className="bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-white/85 placeholder:text-white/25 outline-none focus:border-[#B48B40]/50"
              />
              <input
                value={weightDate}
                onChange={(e) => setWeightDate(e.target.value)}
                type="date"
                className="bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-white/75 outline-none focus:border-[#B48B40]/50 [color-scheme:dark]"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-2 mb-5">
              <input
                value={weightNote}
                onChange={(e) => setWeightNote(e.target.value)}
                placeholder="Note"
                className="bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-white/85 placeholder:text-white/25 outline-none focus:border-[#B48B40]/50"
              />
              <button
                onClick={addWeightLog}
                disabled={!Number(weightDraft) || !weightDate || weightSaving}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#B48B40] text-black px-3.5 py-2 text-xs font-semibold hover:bg-[#c99840] disabled:opacity-50 transition-all"
              >
                {weightSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Scale className="w-3.5 h-3.5" strokeWidth={2} />}
                Add log
              </button>
            </div>

            <WeightChart
              logs={filtered}
              selectedId={selectedWeight?.id ?? null}
              onSelect={setSelectedWeightId}
              unitSystem={unitSystem}
            />

            {selectedWeight && (
              <div className="mt-3 rounded-xl border border-white/[0.06] bg-black/15 px-3 py-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white/85">
                    {formatWeight(selectedWeight.weight_kg, unitSystem)}
                    <span className="text-xs font-normal text-white/35"> - {formatFullDate(selectedWeight.logged_at)}</span>
                  </p>
                  {selectedWeight.note && <p className="text-xs text-white/50 mt-1 leading-relaxed">{selectedWeight.note}</p>}
                </div>
                <button
                  onClick={() => deleteWeightLog(selectedWeight.id)}
                  className="text-white/25 hover:text-red-300/80 transition-colors"
                  aria-label="Delete weight log"
                >
                  <Trash2 className="w-3.5 h-3.5" strokeWidth={1.7} />
                </button>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-white/[0.06] bg-[#111111] p-4">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-sm font-semibold text-white/85 flex items-center gap-2">
                  <Camera className="w-4 h-4 text-[#B48B40]" strokeWidth={1.8} /> Progress photos
                </p>
                <p className="text-[11px] text-white/35 mt-0.5">Private uploads with signed previews</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_9rem] gap-2 mb-2">
              <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/60 hover:border-white/20 transition-colors">
                <Upload className="w-4 h-4 text-white/35" strokeWidth={1.8} />
                <span className="truncate">{photoFile ? photoFile.name : "Upload image"}</span>
                <input
                  key={photoInputKey}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  className="sr-only"
                  onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <input
                value={photoDate}
                onChange={(e) => setPhotoDate(e.target.value)}
                type="date"
                className="bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-white/75 outline-none focus:border-[#B48B40]/50 [color-scheme:dark]"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-2 mb-5">
              <input
                value={photoCaption}
                onChange={(e) => setPhotoCaption(e.target.value)}
                placeholder="Caption"
                className="bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-white/85 placeholder:text-white/25 outline-none focus:border-[#B48B40]/50"
              />
              <button
                onClick={uploadPhoto}
                disabled={!photoFile || photoUploading}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#B48B40] text-black px-3.5 py-2 text-xs font-semibold hover:bg-[#c99840] disabled:opacity-50 transition-all"
              >
                {photoUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" strokeWidth={2} />}
                Add photo
              </button>
            </div>

            {chronologicalPhotos.length >= 2 ? (
              <PhotoComparison
                photos={chronologicalPhotos}
                fromId={compareFromPhoto?.id ?? ""}
                toId={compareToPhoto?.id ?? ""}
                onFrom={setCompareFromId}
                onTo={setCompareToId}
                fromPhoto={compareFromPhoto}
                toPhoto={compareToPhoto}
                comparison={comparison}
              />
            ) : chronologicalPhotos.length === 1 ? (
              <div className="mb-5 rounded-2xl border border-dashed border-white/[0.08] bg-black/10 px-4 py-5 text-center">
                <ArrowLeftRight className="mx-auto mb-2 h-5 w-5 text-white/18" strokeWidth={1.6} />
                <p className="text-sm text-white/55">Upload one more photo to compare months side by side.</p>
              </div>
            ) : null}

            {filteredPhotos.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/[0.08] bg-black/10 px-5 py-8 text-center">
                <ImageIcon className="w-7 h-7 text-white/15 mx-auto mb-3" strokeWidth={1.5} />
                <p className="text-sm text-white/55">No progress photos in this range</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {filteredPhotos.map((photo) => (
                  <div key={photo.id} className="group overflow-hidden rounded-xl border border-white/[0.06] bg-black/20">
                    <div className="aspect-[4/5] bg-white/[0.03]">
                      {photo.signed_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photo.signed_url} alt={photo.caption ?? "Progress photo"} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-white/25">
                          <ImageIcon className="w-6 h-6" strokeWidth={1.5} />
                        </div>
                      )}
                    </div>
                    <div className="px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] text-white/35">{formatFullDate(photo.taken_at)}</p>
                        <button
                          onClick={() => deletePhoto(photo.id)}
                          className="text-white/25 hover:text-red-300/80 opacity-0 group-hover:opacity-100 transition-all"
                          aria-label="Delete progress photo"
                        >
                          <Trash2 className="w-3.5 h-3.5" strokeWidth={1.7} />
                        </button>
                      </div>
                      {photo.caption && <p className="text-xs text-white/65 mt-1 truncate">{photo.caption}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function PhotoComparison({
  photos,
  fromId,
  toId,
  onFrom,
  onTo,
  fromPhoto,
  toPhoto,
  comparison,
}: {
  photos: ProgressPhoto[];
  fromId: string;
  toId: string;
  onFrom: (id: string) => void;
  onTo: (id: string) => void;
  fromPhoto: ProgressPhoto | null;
  toPhoto: ProgressPhoto | null;
  comparison: ReturnType<typeof buildComparisonInsights>;
}) {
  return (
    <div className="mb-5 rounded-2xl border border-white/[0.06] bg-black/12 p-3.5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-white/85">
            <ArrowLeftRight className="h-4 w-4 text-[#B48B40]" strokeWidth={1.8} />
            Compare photos
          </p>
          <p className="mt-0.5 text-[11px] text-white/35">Pick two photos. Metrics compare the calendar month around each one.</p>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <PhotoSelect label="From" value={fromId} photos={photos} onChange={onFrom} />
        <PhotoSelect label="To" value={toId} photos={photos} onChange={onTo} />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <PhotoCompareCard label="From" photo={fromPhoto} />
        <PhotoCompareCard label="To" photo={toPhoto} />
      </div>

      {comparison && (
        <div className="mt-3 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-xs font-semibold text-white/75">
              <Activity className="h-3.5 w-3.5 text-[#B48B40]" strokeWidth={1.8} />
              What changed
            </p>
            <p className="text-[10px] text-white/28">{comparison.beforeLabel} to {comparison.afterLabel}</p>
          </div>
          {comparison.sameMonth && (
            <p className="mb-2 rounded-lg border border-[#B48B40]/15 bg-[#B48B40]/8 px-2.5 py-2 text-[11px] text-[#E7C57A]/75">
              Both photos are in the same month, so the behavior comparison will match.
            </p>
          )}
          <div className="space-y-2">
            {comparison.insights.map((insight) => (
              <div key={insight.label} className="rounded-lg border border-white/[0.04] bg-black/12 px-3 py-2">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <TrendDot trend={insight.trend} />
                    <p className="truncate text-xs font-medium text-white/70">{insight.label}</p>
                  </div>
                  <p className="shrink-0 text-[10px] text-white/32">{insight.before} to {insight.after}</p>
                </div>
                <p className="text-[11px] leading-relaxed text-white/42">{insight.summary}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PhotoSelect({
  label,
  value,
  photos,
  onChange,
}: {
  label: string;
  value: string;
  photos: ProgressPhoto[];
  onChange: (id: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] text-white/28">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-[#111111] px-3 py-2 text-xs text-white/72 outline-none focus:border-[#B48B40]/50"
      >
        {photos.map((photo) => (
          <option key={photo.id} value={photo.id}>
            {formatFullDate(photo.taken_at)}{photo.caption ? ` - ${photo.caption}` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

function PhotoCompareCard({ label, photo }: { label: string; photo: ProgressPhoto | null }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-black/20">
      <div className="aspect-[4/5] bg-white/[0.03]">
        {photo?.signed_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.signed_url} alt={photo.caption ?? `${label} progress photo`} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-white/25">
            <ImageIcon className="h-6 w-6" strokeWidth={1.5} />
          </div>
        )}
      </div>
      <div className="px-3 py-2">
        <p className="text-[10px] text-white/25">{label}</p>
        <p className="mt-0.5 truncate text-[11px] text-white/58">{photo ? formatFullDate(photo.taken_at) : "No photo"}</p>
      </div>
    </div>
  );
}

function TrendDot({ trend }: { trend: ComparisonTrend }) {
  return (
    <span
      className={cn(
        "h-1.5 w-1.5 shrink-0 rounded-full",
        trend === "up" && "bg-emerald-400/70",
        trend === "down" && "bg-amber-400/70",
        trend === "same" && "bg-white/25",
        trend === "missing" && "bg-white/12",
      )}
    />
  );
}

function RangeControls({
  range, customStart, customEnd, onRange, onCustomStart, onCustomEnd,
}: {
  range: RangePreset;
  customStart: string;
  customEnd: string;
  onRange: (range: RangePreset) => void;
  onCustomStart: (value: string) => void;
  onCustomEnd: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap justify-end">
      <select
        value={range}
        onChange={(e) => onRange(e.target.value as RangePreset)}
        className="bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-xs text-white/75 outline-none focus:border-[#B48B40]/50"
      >
        <option value="30d">30 days</option>
        <option value="90d">90 days</option>
        <option value="6m">6 months</option>
        <option value="1y">1 year</option>
        <option value="all">All time</option>
        <option value="custom">Custom</option>
      </select>
      {range === "custom" && (
        <>
          <input
            type="date"
            value={customStart}
            onChange={(e) => onCustomStart(e.target.value)}
            className="bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-xs text-white/75 outline-none focus:border-[#B48B40]/50 [color-scheme:dark]"
          />
          <input
            type="date"
            value={customEnd}
            onChange={(e) => onCustomEnd(e.target.value)}
            className="bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-xs text-white/75 outline-none focus:border-[#B48B40]/50 [color-scheme:dark]"
          />
        </>
      )}
    </div>
  );
}

function SummaryCard({
  icon: Icon, label, value, detail,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#111111] px-3.5 py-3">
      <p className="text-[10px] text-white/30 mb-1 flex items-center gap-1.5">
        <Icon className="w-3 h-3 text-[#B48B40]/80" strokeWidth={1.8} /> {label}
      </p>
      <p className="text-sm font-semibold text-white/90">{value}</p>
      <p className="text-[11px] text-white/35 mt-0.5">{detail}</p>
    </div>
  );
}

function WeightChart({
  logs,
  selectedId,
  onSelect,
  unitSystem,
}: {
  logs: WeightLog[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  unitSystem: UnitSystem;
}) {
  // Hovered dot drives the rich tooltip (date + weight + note). Separate from
  // `selectedId` so clicking a different dot doesn't lose the hover preview.
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (logs.length === 0) {
    return (
      <div className="h-44 rounded-2xl border border-dashed border-white/[0.08] bg-black/10 flex flex-col items-center justify-center text-center">
        <Scale className="w-7 h-7 text-white/15 mb-3" strokeWidth={1.5} />
        <p className="text-sm text-white/55">No bodyweight logs in this range</p>
      </div>
    );
  }

  const values = logs.map((log) => kgToDisplayUnit(Number(log.weight_kg), unitSystem));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const width = 360;
  const height = 168;
  const pad = { top: 18, right: 18, bottom: 30, left: 40 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;
  const points = logs.map((log, index) => {
    const x = pad.left + (logs.length === 1 ? chartW / 2 : (index / (logs.length - 1)) * chartW);
    const y = pad.top + ((max - kgToDisplayUnit(Number(log.weight_kg), unitSystem)) / span) * chartH;
    return { log, x, y };
  });
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const hoveredPoint = hoveredId ? points.find((p) => p.log.id === hoveredId) : null;

  return (
    <div className="relative rounded-2xl border border-white/[0.06] bg-black/15 px-2 py-2">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-48 w-full overflow-visible"
        onMouseLeave={() => setHoveredId(null)}
      >
        <line x1={pad.left} x2={width - pad.right} y1={pad.top} y2={pad.top} className="stroke-white/5" />
        <line x1={pad.left} x2={width - pad.right} y1={pad.top + chartH / 2} y2={pad.top + chartH / 2} className="stroke-white/5" />
        <line x1={pad.left} x2={width - pad.right} y1={pad.top + chartH} y2={pad.top + chartH} className="stroke-white/5" />
        <text x={8} y={pad.top + 4} className="fill-white/30 text-[10px]">{max.toFixed(1)}</text>
        <text x={8} y={pad.top + chartH + 4} className="fill-white/30 text-[10px]">{min.toFixed(1)}</text>
        {logs.length > 1 && <path d={path} fill="none" className="stroke-[#B48B40]" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />}

        {/* Hover guideline + value tag drop down from the hovered dot. */}
        {hoveredPoint && (
          <>
            <line
              x1={hoveredPoint.x} x2={hoveredPoint.x}
              y1={hoveredPoint.y + 6} y2={pad.top + chartH}
              className="stroke-[#B48B40]/30"
              strokeDasharray="2 3"
            />
          </>
        )}

        {points.map(({ log, x, y }) => {
          const selected = selectedId === log.id;
          const hovered  = hoveredId === log.id;
          // Invisible target ring widens the tap/hover area so users don't
          // need to land precisely on the 4px dot.
          return (
            <g key={log.id}>
              <circle
                cx={x} cy={y} r={12}
                fill="transparent"
                role="button"
                tabIndex={0}
                aria-label={`${formatFullDate(log.logged_at)} — ${formatWeight(log.weight_kg, unitSystem)}`}
                className="cursor-pointer focus:outline-none"
                onClick={() => onSelect(log.id)}
                onMouseEnter={() => setHoveredId(log.id)}
                onFocus={() => setHoveredId(log.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") onSelect(log.id);
                }}
              />
              <circle
                cx={x} cy={y}
                r={selected || hovered ? 5.5 : 4}
                className={cn(
                  "stroke-[#0A0A0A] transition-all pointer-events-none",
                  selected || hovered ? "fill-[#F0C66E]" : "fill-[#B48B40]",
                )}
                strokeWidth={2}
              />
            </g>
          );
        })}

        {points.length > 0 && (
          <>
            <text x={pad.left} y={height - 8} className="fill-white/30 text-[10px]">{formatShortDate(points[0].log.logged_at)}</text>
            <text x={width - pad.right - 44} y={height - 8} className="fill-white/30 text-[10px]">{formatShortDate(points[points.length - 1].log.logged_at)}</text>
          </>
        )}
      </svg>

      {/* Rich hover tooltip — weight, date, and note (if any). HTML overlay
          positioned in SVG user coords, with smart edge avoidance so it never
          overflows the chart on either side. */}
      {hoveredPoint && (() => {
        const xPct = (hoveredPoint.x / width) * 100;
        const note = (hoveredPoint.log.note ?? "").trim();
        // Anchor: prefer center; flip to right-aligned when near the right edge.
        const nearRight = xPct > 78;
        const nearLeft  = xPct < 22;
        const transform = nearRight ? "translate(-100%, -100%)" :
                          nearLeft  ? "translate(0, -100%)"     :
                                      "translate(-50%, -100%)";
        const offsetY = ((hoveredPoint.y - 10) / height) * 100;
        return (
          <div
            className="pointer-events-none absolute z-20"
            style={{ left: `${xPct}%`, top: `${offsetY}%`, transform }}
          >
            <div className="rounded-xl border border-white/10 bg-[#0F0D0A]/95 backdrop-blur-sm shadow-[0_18px_36px_-18px_rgba(0,0,0,0.7)] px-3.5 py-2.5 min-w-[160px] max-w-[240px]">
              <p className="text-[15px] font-medium tabular-nums text-[#F0C66E] leading-none">
                {formatWeight(hoveredPoint.log.weight_kg, unitSystem)}
              </p>
              <p className="text-[11px] text-white/45 mt-1">
                {formatFullDate(hoveredPoint.log.logged_at)}
              </p>
              {note && (
                <p className="text-[12px] text-white/70 mt-2 leading-snug border-t border-white/[0.07] pt-2">
                  {note}
                </p>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
