"use client";

import { use, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Play, RotateCcw, Type, Scissors, Link2,
  Eye, Clock, Upload, Trash2, Plus, X, Check,
  ExternalLink, FileText,
} from "lucide-react";
import { YTIcon } from "@/components/library/YTIcon";
import { cn } from "@/lib/utils";
import { useUser } from "@/context/UserContext";
import { hasAccess } from "@/lib/roles";
import {
  VIDEO_LIBRARY, formatDuration, youTubeEmbedUrl,
  MUSCLE_GROUP_LABELS, MOVEMENT_TYPE_LABELS, EQUIPMENT_LABELS, DIFFICULTY_LABELS,
  type ExerciseVideo,
} from "@/lib/videoLibrary";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function DifficultyBadge({ level }: { level: ExerciseVideo["difficulty"] }) {
  const styles = {
    beginner:     "text-emerald-400/70 bg-emerald-400/10 border-emerald-400/20",
    intermediate: "text-amber-400/70 bg-amber-400/10 border-amber-400/20",
    advanced:     "text-red-400/70 bg-red-400/10 border-red-400/20",
  } as const;
  return (
    <span className={cn("text-xs font-medium px-2.5 py-1 rounded-xl border", styles[level])}>
      {DIFFICULTY_LABELS[level]}
    </span>
  );
}

// ─── MockVideoPlayer ──────────────────────────────────────────────────────────

function MockVideoPlayer({
  video,
  activeCue,
  loop,
  trimStart,
  trimEnd,
}: {
  video: ExerciseVideo;
  activeCue: string | null;
  loop: boolean;
  trimStart: number;
  trimEnd: number;
}) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  function handleToggle() {
    setPlaying(!playing);
    if (!playing) {
      // Fake progress animation
      let p = (trimStart / video.duration) * 100;
      const maxP = trimEnd > 0 ? (trimEnd / video.duration) * 100 : 100;
      const interval = setInterval(() => {
        p += 0.5;
        if (p >= maxP) {
          if (loop) p = (trimStart / video.duration) * 100;
          else { clearInterval(interval); setPlaying(false); }
        }
        setProgress(p);
      }, 100);
    }
  }

  return (
    <div className={cn("relative w-full aspect-video rounded-2xl overflow-hidden bg-gradient-to-br", video.thumbnailColor)}>
      {/* Fake grain */}
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E\")" }} />

      {/* Cue overlay */}
      {activeCue && playing && (
        <div className="absolute top-4 inset-x-4 flex justify-center pointer-events-none">
          <div className="px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-sm border border-white/15 text-sm text-white/90 font-medium text-center max-w-xs">
            {activeCue}
          </div>
        </div>
      )}

      {/* Center play */}
      <button
        onClick={handleToggle}
        className="absolute inset-0 flex items-center justify-center"
      >
        <div className={cn(
          "w-14 h-14 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/20 transition-transform",
          playing && "scale-95"
        )}>
          {playing ? (
            <div className="flex gap-1">
              <div className="w-1 h-5 bg-white/80 rounded-full" />
              <div className="w-1 h-5 bg-white/80 rounded-full" />
            </div>
          ) : (
            <Play className="w-6 h-6 text-white fill-white ml-1" />
          )}
        </div>
      </button>

      {/* Loop badge */}
      {loop && (
        <div className="absolute top-4 right-4 px-2 py-0.5 rounded-lg bg-[#B48B40]/80 text-[10px] text-black font-semibold uppercase tracking-wider">
          Loop
        </div>
      )}

      {/* Progress bar */}
      <div className="absolute bottom-0 inset-x-0">
        {/* Trim range indicator */}
        <div className="h-0.5 bg-white/10 relative">
          <div
            className="absolute top-0 bottom-0 bg-white/20"
            style={{
              left: `${(trimStart / video.duration) * 100}%`,
              right: trimEnd > 0 ? `${100 - (trimEnd / video.duration) * 100}%` : "0%",
            }}
          />
          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 bg-[#B48B40] transition-all duration-100"
            style={{ left: 0, right: `${100 - progress}%` }}
          />
        </div>
        {/* Time */}
        <div className="flex justify-between items-center px-3 py-2 bg-gradient-to-t from-black/60 to-transparent">
          <span className="text-[10px] text-white/50 tabular-nums font-mono">
            {formatDuration(Math.round((progress / 100) * video.duration))}
          </span>
          <span className="text-[10px] text-white/35 tabular-nums font-mono">
            {formatDuration(trimEnd > 0 ? trimEnd : video.duration)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── TrimEditor ───────────────────────────────────────────────────────────────

function TrimEditor({
  video,
  trimStart,
  trimEnd,
  onChangeTrimStart,
  onChangeTrimEnd,
}: {
  video: ExerciseVideo;
  trimStart: number;
  trimEnd: number;
  onChangeTrimStart: (v: number) => void;
  onChangeTrimEnd: (v: number) => void;
}) {
  const effectiveEnd = trimEnd > 0 ? trimEnd : video.duration;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[10px] text-white/30 uppercase tracking-[0.14em]">
        <span>Trim Range</span>
        <span className="tabular-nums font-mono text-white/40">
          {formatDuration(trimStart)} → {formatDuration(effectiveEnd)}
        </span>
      </div>
      {/* Track */}
      <div className="relative h-6 flex items-center">
        <div className="absolute inset-x-0 h-1.5 bg-white/8 rounded-full" />
        {/* Active range */}
        <div
          className="absolute h-1.5 bg-[#B48B40]/50 rounded-full"
          style={{
            left: `${(trimStart / video.duration) * 100}%`,
            right: `${100 - (effectiveEnd / video.duration) * 100}%`,
          }}
        />
        {/* Start handle */}
        <input
          type="range"
          min={0}
          max={video.duration}
          value={trimStart}
          onChange={(e) => onChangeTrimStart(Math.min(Number(e.target.value), effectiveEnd - 1))}
          className="absolute w-full h-6 opacity-0 cursor-pointer"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] text-white/25 mb-1">Start</label>
          <input
            type="number"
            min={0}
            max={effectiveEnd - 1}
            value={trimStart}
            onChange={(e) => onChangeTrimStart(Number(e.target.value))}
            className="w-full bg-white/[0.03] border border-white/8 rounded-xl px-3 py-2 text-xs text-white/70 outline-none focus:border-[#B48B40]/40 tabular-nums text-center"
          />
        </div>
        <div>
          <label className="block text-[10px] text-white/25 mb-1">End (0 = full)</label>
          <input
            type="number"
            min={0}
            max={video.duration}
            value={trimEnd}
            onChange={(e) => onChangeTrimEnd(Number(e.target.value))}
            className="w-full bg-white/[0.03] border border-white/8 rounded-xl px-3 py-2 text-xs text-white/70 outline-none focus:border-[#B48B40]/40 tabular-nums text-center"
          />
        </div>
      </div>
    </div>
  );
}

// ─── CueEditor ────────────────────────────────────────────────────────────────

function CueEditor({
  cues,
  activeCue,
  onSetActiveCue,
  onAddCue,
  onRemoveCue,
  canManage,
}: {
  cues: string[];
  activeCue: string | null;
  onSetActiveCue: (c: string | null) => void;
  onAddCue: (c: string) => void;
  onRemoveCue: (i: number) => void;
  canManage: boolean;
}) {
  const [newCue, setNewCue] = useState("");

  function handleAdd() {
    const c = newCue.trim();
    if (!c) return;
    onAddCue(c);
    setNewCue("");
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] uppercase tracking-[0.14em] text-white/30">Coaching Cues</p>
      <div className="space-y-1.5">
        {cues.map((cue, i) => (
          <div
            key={i}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-xl border transition-all cursor-pointer",
              activeCue === cue
                ? "border-[#B48B40]/40 bg-[#B48B40]/8 text-[#B48B40]"
                : "border-white/6 bg-white/[0.02] text-white/60 hover:border-white/10 hover:text-white/75"
            )}
            onClick={() => onSetActiveCue(activeCue === cue ? null : cue)}
          >
            <div className={cn(
              "w-1.5 h-1.5 rounded-full shrink-0",
              activeCue === cue ? "bg-[#B48B40]" : "bg-white/20"
            )} />
            <span className="text-xs flex-1">{cue}</span>
            {canManage && (
              <button
                onClick={(e) => { e.stopPropagation(); onRemoveCue(i); }}
                className="text-white/20 hover:text-red-400/60 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
      </div>
      {canManage && (
        <div className="flex gap-2">
          <input
            value={newCue}
            onChange={(e) => setNewCue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Add a cue..."
            className="flex-1 bg-white/[0.03] border border-white/8 rounded-xl px-3 py-2 text-xs text-white/75 placeholder:text-white/20 outline-none focus:border-[#B48B40]/40 transition-all"
          />
          <button
            onClick={handleAdd}
            disabled={!newCue.trim()}
            className="p-2 rounded-xl bg-[#B48B40]/15 text-[#B48B40] hover:bg-[#B48B40]/25 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LibraryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useUser();
  const canManage = hasAccess(user.role, "trainer");

  const source = VIDEO_LIBRARY.find((v) => v.id === id);

  const [video, setVideo] = useState<ExerciseVideo | null>(source ?? null);
  const [activeCue, setActiveCue] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [newLinked, setNewLinked] = useState("");
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState(source?.notes ?? "");
  const isYouTube = video?.source === "youtube";

  if (!video) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-[#0A0A0A]">
        <div className="text-center space-y-3">
          <p className="text-white/40 text-sm">Video not found</p>
          <Link href="/library" className="text-[#B48B40] text-sm hover:text-[#C99B50] transition-colors">
            ← Back to library
          </Link>
        </div>
      </div>
    );
  }

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function addCue(cue: string) {
    setVideo({ ...video!, cues: [...video!.cues, cue] });
  }

  function removeCue(i: number) {
    setVideo({ ...video!, cues: video!.cues.filter((_, idx) => idx !== i) });
  }

  function addLinked() {
    const name = newLinked.trim();
    if (!name || video!.linkedExercises.includes(name)) return;
    setVideo({ ...video!, linkedExercises: [...video!.linkedExercises, name] });
    setNewLinked("");
  }

  function removeLinked(name: string) {
    setVideo({ ...video!, linkedExercises: video!.linkedExercises.filter((e) => e !== name) });
  }

  return (
    <div className="flex-1 min-h-screen bg-[#0A0A0A] px-6 py-8 max-w-5xl mx-auto w-full">
      {/* Back nav */}
      <Link
        href="/library"
        className="inline-flex items-center gap-2 text-sm text-white/35 hover:text-white/65 transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Library
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        {/* Left: Player + info */}
        <div className="space-y-5">
          {/* Player — YouTube iframe or mock upload player */}
          {isYouTube && video.youtubeData ? (
            <div className="rounded-2xl overflow-hidden border border-white/8 bg-black">
              <div className="relative w-full aspect-video">
                <iframe
                  src={youTubeEmbedUrl(video.youtubeData.videoId, { loop: video.loop, start: video.trimStart || undefined })}
                  title={video.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 w-full h-full"
                />
              </div>
              {/* YouTube attribution bar */}
              <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/6 bg-[#111111]">
                <div className="flex items-center gap-2">
                  <YTIcon className="w-3.5 h-3.5 text-[#FF4444]" />
                  <span className="text-xs text-white/40">
                    {video.youtubeData.channelName ?? "YouTube"}
                  </span>
                </div>
                <a
                  href={video.youtubeData.originalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-white/30 hover:text-white/60 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  Open on YouTube
                </a>
              </div>
            </div>
          ) : (
            <MockVideoPlayer
              video={video}
              activeCue={activeCue}
              loop={video.loop}
              trimStart={video.trimStart}
              trimEnd={video.trimEnd}
            />
          )}

          {/* Title + meta */}
          <div>
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-semibold text-white/90 tracking-tight leading-snug">
                  {video.title}
                </h1>
                {isYouTube && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#FF4444]/10 border border-[#FF4444]/20 text-[10px] text-[#FF4444] font-medium">
                    <YTIcon className="w-3 h-3" />
                    YouTube
                  </span>
                )}
              </div>
              <DifficultyBadge level={video.difficulty} />
            </div>
            <p className="text-sm text-white/45 leading-relaxed mb-4">{video.description}</p>

            {/* Stat row */}
            <div className="flex items-center gap-5 text-xs text-white/30 mb-4 flex-wrap">
              {!isYouTube && (
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  {formatDuration(video.duration)}
                </span>
              )}
              {!isYouTube && (
                <span className="flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5" />
                  {video.viewCount.toLocaleString()} views
                </span>
              )}
              <span>Added by {video.uploadedBy}</span>
              <span>{video.uploadedAt}</span>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2">
              <span className="text-xs px-2.5 py-1 rounded-xl bg-white/5 text-white/50 border border-white/6">
                {MOVEMENT_TYPE_LABELS[video.movementType]}
              </span>
              {video.muscleGroups.map((mg) => (
                <span key={mg} className="text-xs px-2.5 py-1 rounded-xl bg-white/5 text-white/50 border border-white/6">
                  {MUSCLE_GROUP_LABELS[mg]}
                </span>
              ))}
              {video.equipment.map((eq) => (
                <span key={eq} className="text-xs px-2.5 py-1 rounded-xl bg-white/5 text-white/40 border border-white/6">
                  {EQUIPMENT_LABELS[eq]}
                </span>
              ))}
            </div>
          </div>

          {/* Coaching notes */}
          <div className="rounded-2xl border border-white/6 bg-[#111111] px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-white/30" strokeWidth={1.5} />
                <p className="text-xs font-medium text-white/50 uppercase tracking-[0.12em]">Coaching Notes</p>
              </div>
              {canManage && !editingNotes && (
                <button
                  onClick={() => setEditingNotes(true)}
                  className="text-[11px] text-[#B48B40] hover:text-[#C99B50] transition-colors"
                >
                  {notesValue ? "Edit" : "Add note"}
                </button>
              )}
            </div>
            {editingNotes ? (
              <div className="space-y-2">
                <textarea
                  value={notesValue}
                  onChange={(e) => setNotesValue(e.target.value)}
                  placeholder="Context for clients — when to watch, what to focus on..."
                  rows={4}
                  autoFocus
                  className="w-full bg-white/[0.03] border border-white/8 rounded-xl px-3 py-2.5 text-sm text-white/75 placeholder:text-white/20 outline-none focus:border-[#B48B40]/40 resize-none transition-all leading-relaxed"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => { setNotesValue(video!.notes ?? ""); setEditingNotes(false); }}
                    className="px-3 py-1.5 text-xs text-white/35 hover:text-white/60 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => { setVideo({ ...video!, notes: notesValue }); setEditingNotes(false); }}
                    className="px-3 py-1.5 rounded-lg bg-[#B48B40]/15 text-[#B48B40] text-xs hover:bg-[#B48B40]/25 transition-all"
                  >
                    Save note
                  </button>
                </div>
              </div>
            ) : notesValue ? (
              <p className="text-sm text-white/55 leading-relaxed">{notesValue}</p>
            ) : (
              <p className="text-xs text-white/20 italic">No coaching notes added yet.</p>
            )}
          </div>

          {/* Linked exercises */}
          <div className="rounded-2xl border border-white/6 bg-[#111111] px-4 py-4">
            <div className="flex items-center gap-2 mb-3">
              <Link2 className="w-4 h-4 text-white/30" strokeWidth={1.5} />
              <p className="text-xs font-medium text-white/50 uppercase tracking-[0.12em]">Linked Exercises</p>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {video.linkedExercises.map((name) => (
                <div key={name} className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/5 border border-white/8 text-xs text-white/65">
                  {name}
                  {canManage && (
                    <button onClick={() => removeLinked(name)} className="text-white/25 hover:text-red-400/60 transition-colors ml-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
              {video.linkedExercises.length === 0 && (
                <p className="text-xs text-white/25">No exercises linked yet</p>
              )}
            </div>
            {canManage && (
              <div className="flex gap-2">
                <input
                  value={newLinked}
                  onChange={(e) => setNewLinked(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addLinked()}
                  placeholder="Link exercise name..."
                  className="flex-1 bg-white/[0.03] border border-white/8 rounded-xl px-3 py-2 text-xs text-white/75 placeholder:text-white/20 outline-none focus:border-[#B48B40]/40 transition-all"
                />
                <button
                  onClick={addLinked}
                  disabled={!newLinked.trim()}
                  className="p-2 rounded-xl bg-[#B48B40]/15 text-[#B48B40] hover:bg-[#B48B40]/25 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Controls */}
        <div className="space-y-4">
          {/* Playback options */}
          <div className="rounded-2xl border border-white/6 bg-[#111111] px-4 py-4">
            <p className="text-[10px] uppercase tracking-[0.14em] text-white/30 mb-3">Playback</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-white/35" strokeWidth={1.5} />
                <span className="text-sm text-white/65">Loop video</span>
              </div>
              <button
                onClick={() => canManage && setVideo({ ...video, loop: !video.loop })}
                className={cn(
                  "relative w-10 h-5 rounded-full transition-all",
                  video.loop ? "bg-[#B48B40]" : "bg-white/10",
                  !canManage && "opacity-50 cursor-not-allowed"
                )}
              >
                <div className={cn(
                  "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all",
                  video.loop ? "left-5" : "left-0.5"
                )} />
              </button>
            </div>
          </div>

          {/* Trim — upload only */}
          {canManage && !isYouTube && (
            <div className="rounded-2xl border border-white/6 bg-[#111111] px-4 py-4">
              <div className="flex items-center gap-2 mb-4">
                <Scissors className="w-4 h-4 text-white/35" strokeWidth={1.5} />
                <p className="text-[10px] uppercase tracking-[0.14em] text-white/30">Trim</p>
              </div>
              <TrimEditor
                video={video}
                trimStart={video.trimStart}
                trimEnd={video.trimEnd}
                onChangeTrimStart={(v) => setVideo({ ...video, trimStart: v })}
                onChangeTrimEnd={(v) => setVideo({ ...video, trimEnd: v })}
              />
            </div>
          )}

          {/* Cues */}
          <div className="rounded-2xl border border-white/6 bg-[#111111] px-4 py-4">
            <div className="flex items-center gap-2 mb-4">
              <Type className="w-4 h-4 text-white/35" strokeWidth={1.5} />
              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-white/30">Cues</p>
                <p className="text-[9px] text-white/20 mt-0.5">Tap a cue to preview overlay</p>
              </div>
            </div>
            <CueEditor
              cues={video.cues}
              activeCue={activeCue}
              onSetActiveCue={setActiveCue}
              onAddCue={addCue}
              onRemoveCue={removeCue}
              canManage={canManage}
            />
          </div>

          {/* Actions */}
          {canManage && (
            <div className="space-y-2">
              <button
                onClick={handleSave}
                className={cn(
                  "w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all",
                  saved
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-400/20"
                    : "bg-[#B48B40] text-black hover:bg-[#C99B50]"
                )}
              >
                {saved ? <><Check className="w-4 h-4" /> Saved</> : "Save Changes"}
              </button>

              {isYouTube && video.youtubeData ? (
                <a
                  href={video.youtubeData.originalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/8 text-sm text-white/35 hover:text-white/60 hover:border-white/15 transition-all"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open on YouTube
                </a>
              ) : (
                <button className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/8 text-sm text-white/35 hover:text-white/60 hover:border-white/15 transition-all">
                  <Upload className="w-4 h-4" />
                  Replace Video
                </button>
              )}

              <button className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-500/15 text-sm text-red-400/50 hover:text-red-400/75 hover:border-red-500/25 transition-all">
                <Trash2 className="w-4 h-4" />
                {isYouTube ? "Remove from Library" : "Delete Video"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
