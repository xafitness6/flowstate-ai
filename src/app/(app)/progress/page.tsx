"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Camera, Image as ImageIcon, Loader2, Scale, Trash2,
  TrendingDown, TrendingUp, Upload,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/context/UserContext";

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

export default function ProgressPage() {
  const { user } = useUser();
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const isRealUser = UUID_RE.test(user.id);

  async function loadProgress() {
    if (!isRealUser) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [weightRes, photoRes] = await Promise.all([
        fetch(`/api/clients/${user.id}/weight`, { cache: "no-store" }),
        fetch(`/api/clients/${user.id}/photos`, { cache: "no-store" }),
      ]);
      const [weightJson, photoJson] = await Promise.all([weightRes.json(), photoRes.json()]);
      if (!weightRes.ok) throw new Error(weightJson.error ?? "Could not load weight logs.");
      if (!photoRes.ok) throw new Error(photoJson.error ?? "Could not load progress photos.");
      setWeightLogs(sortWeightLogs((weightJson.logs ?? []) as WeightLog[]));
      setPhotos((photoJson.photos ?? []) as ProgressPhoto[]);
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
        body: JSON.stringify({ weight_kg: weight, logged_at: weightDate, note: weightNote }),
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
          <p className="text-[10px] uppercase tracking-[0.22em] text-white/22 mb-2">Body progress</p>
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
              value={latest ? `${Number(latest.weight_kg).toFixed(1)} kg` : "None"}
              detail={latest ? formatFullDate(latest.logged_at) : "no weight logs"}
            />
            <SummaryCard
              icon={delta != null && delta < 0 ? TrendingDown : TrendingUp}
              label="Change"
              value={delta == null ? "-" : `${delta >= 0 ? "+" : ""}${delta.toFixed(1)} kg`}
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
                placeholder="Weight kg"
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

            <WeightChart logs={filtered} selectedId={selectedWeight?.id ?? null} onSelect={setSelectedWeightId} />

            {selectedWeight && (
              <div className="mt-3 rounded-xl border border-white/[0.06] bg-black/15 px-3 py-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white/85">
                    {Number(selectedWeight.weight_kg).toFixed(1)} kg
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
      <p className="text-[10px] uppercase tracking-[0.16em] text-white/30 mb-1 flex items-center gap-1.5">
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
}: {
  logs: WeightLog[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (logs.length === 0) {
    return (
      <div className="h-44 rounded-2xl border border-dashed border-white/[0.08] bg-black/10 flex flex-col items-center justify-center text-center">
        <Scale className="w-7 h-7 text-white/15 mb-3" strokeWidth={1.5} />
        <p className="text-sm text-white/55">No bodyweight logs in this range</p>
      </div>
    );
  }

  const values = logs.map((log) => Number(log.weight_kg));
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
    const y = pad.top + ((max - Number(log.weight_kg)) / span) * chartH;
    return { log, x, y };
  });
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-black/15 px-2 py-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-48 w-full overflow-visible">
        <line x1={pad.left} x2={width - pad.right} y1={pad.top} y2={pad.top} className="stroke-white/5" />
        <line x1={pad.left} x2={width - pad.right} y1={pad.top + chartH / 2} y2={pad.top + chartH / 2} className="stroke-white/5" />
        <line x1={pad.left} x2={width - pad.right} y1={pad.top + chartH} y2={pad.top + chartH} className="stroke-white/5" />
        <text x={8} y={pad.top + 4} className="fill-white/30 text-[10px]">{max.toFixed(1)}</text>
        <text x={8} y={pad.top + chartH + 4} className="fill-white/30 text-[10px]">{min.toFixed(1)}</text>
        {logs.length > 1 && <path d={path} fill="none" className="stroke-[#B48B40]" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />}
        {points.map(({ log, x, y }) => {
          const selected = selectedId === log.id;
          return (
            <circle
              key={log.id}
              cx={x}
              cy={y}
              r={selected ? 5.5 : 4}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(log.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onSelect(log.id);
              }}
              className={cn(
                "cursor-pointer stroke-[#0A0A0A] transition-all",
                selected ? "fill-[#F0C66E]" : "fill-[#B48B40] hover:fill-[#F0C66E]",
              )}
              strokeWidth={2}
            >
              <title>{`${formatFullDate(log.logged_at)} - ${Number(log.weight_kg).toFixed(1)} kg`}</title>
            </circle>
          );
        })}
        {points.length > 0 && (
          <>
            <text x={pad.left} y={height - 8} className="fill-white/30 text-[10px]">{formatShortDate(points[0].log.logged_at)}</text>
            <text x={width - pad.right - 44} y={height - 8} className="fill-white/30 text-[10px]">{formatShortDate(points[points.length - 1].log.logged_at)}</text>
          </>
        )}
      </svg>
    </div>
  );
}
