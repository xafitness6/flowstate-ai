"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Search, Upload, Grid3X3, List, Play, Tag, X, Filter,
  Eye, Clock, Dumbbell, ChevronDown, Link2,
  AlertCircle, CheckCircle2,
} from "lucide-react";
import { YTIcon } from "@/components/library/YTIcon";
import { cn } from "@/lib/utils";
import { useUser } from "@/context/UserContext";
import { hasAccess } from "@/lib/roles";
import {
  VIDEO_LIBRARY, filterVideos, formatDuration, extractYouTubeId, youTubeThumbnailUrl,
  MUSCLE_GROUP_LABELS, MOVEMENT_TYPE_LABELS, EQUIPMENT_LABELS, DIFFICULTY_LABELS,
  type ExerciseVideo, type MuscleGroup, type MovementType, type Equipment, type Difficulty,
  type VideoSource,
} from "@/lib/videoLibrary";

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewMode = "grid" | "list";
type AddTab = "upload" | "youtube";

// ─── TagSelects ───────────────────────────────────────────────────────────────
// Shared inline helper so both tabs can reuse the same tag selects

function TagSelects({
  muscle, setMuscle,
  movement, setMovement,
  difficulty, setDifficulty,
}: {
  muscle: MuscleGroup | "";
  setMuscle: (v: MuscleGroup | "") => void;
  movement: MovementType | "";
  setMovement: (v: MovementType | "") => void;
  difficulty: Difficulty | "";
  setDifficulty: (v: Difficulty | "") => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <div>
        <label className="block text-[10px] uppercase tracking-[0.14em] text-white/30 mb-1.5">Muscle</label>
        <div className="relative">
          <select value={muscle} onChange={(e) => setMuscle(e.target.value as MuscleGroup | "")}
            className="w-full appearance-none bg-white/[0.03] border border-white/8 rounded-xl px-3 py-2.5 text-xs text-white/70 outline-none focus:border-[#B48B40]/40 transition-all">
            <option value="">Any</option>
            {Object.entries(MUSCLE_GROUP_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30 pointer-events-none" />
        </div>
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-[0.14em] text-white/30 mb-1.5">Movement</label>
        <div className="relative">
          <select value={movement} onChange={(e) => setMovement(e.target.value as MovementType | "")}
            className="w-full appearance-none bg-white/[0.03] border border-white/8 rounded-xl px-3 py-2.5 text-xs text-white/70 outline-none focus:border-[#B48B40]/40 transition-all">
            <option value="">Any</option>
            {Object.entries(MOVEMENT_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30 pointer-events-none" />
        </div>
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-[0.14em] text-white/30 mb-1.5">Difficulty</label>
        <div className="relative">
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty | "")}
            className="w-full appearance-none bg-white/[0.03] border border-white/8 rounded-xl px-3 py-2.5 text-xs text-white/70 outline-none focus:border-[#B48B40]/40 transition-all">
            <option value="">Any</option>
            {Object.entries(DIFFICULTY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30 pointer-events-none" />
        </div>
      </div>
    </div>
  );
}

// ─── AddVideoModal ─────────────────────────────────────────────────────────────

function AddVideoModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<AddTab>("upload");

  // Upload state
  const [dragOver, setDragOver] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadMuscle, setUploadMuscle] = useState<MuscleGroup | "">("");
  const [uploadMovement, setUploadMovement] = useState<MovementType | "">("");
  const [uploadDifficulty, setUploadDifficulty] = useState<Difficulty | "">("");

  // YouTube state
  const [ytUrl, setYtUrl] = useState("");
  const [ytId, setYtId] = useState<string | null>(null);
  const [ytParseError, setYtParseError] = useState(false);
  const [ytTitle, setYtTitle] = useState("");
  const [ytNotes, setYtNotes] = useState("");
  const [ytMuscle, setYtMuscle] = useState<MuscleGroup | "">("");
  const [ytMovement, setYtMovement] = useState<MovementType | "">("");
  const [ytDifficulty, setYtDifficulty] = useState<Difficulty | "">("");

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function handleYtUrlChange(val: string) {
    setYtUrl(val);
    setYtParseError(false);
    if (!val.trim()) { setYtId(null); return; }
    const id = extractYouTubeId(val);
    if (id) { setYtId(id); setYtParseError(false); }
    else if (val.length > 10) { setYtId(null); setYtParseError(true); }
  }

  function canSave() {
    if (tab === "upload") return !!uploadTitle;
    return !!ytId && !!ytTitle;
  }

  function handleSave() {
    if (!canSave()) return;
    setSaving(true);
    setTimeout(() => { setSaved(true); setTimeout(onClose, 900); }, 800);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4 md:p-6">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-[#111111] border border-white/8 rounded-3xl overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/6">
          <h2 className="text-sm font-semibold text-white/90">Add Video</h2>
          <button onClick={onClose} className="p-1.5 text-white/30 hover:text-white/60 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex px-6 pt-4 gap-1">
          <button
            onClick={() => setTab("upload")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
              tab === "upload"
                ? "bg-white/8 text-white/90"
                : "text-white/35 hover:text-white/60"
            )}
          >
            <Upload className="w-3.5 h-3.5" />
            Upload file
          </button>
          <button
            onClick={() => setTab("youtube")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
              tab === "youtube"
                ? "bg-[#FF0000]/10 text-[#FF4444] border border-[#FF0000]/15"
                : "text-white/35 hover:text-white/60"
            )}
          >
            <YTIcon className="w-3.5 h-3.5" />
            YouTube link
          </button>
        </div>

        <div className="px-6 py-4 space-y-4 max-h-[65vh] overflow-y-auto">

          {/* ── Upload tab ── */}
          {tab === "upload" && (
            <>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); }}
                className={cn(
                  "rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 py-9 cursor-pointer transition-all",
                  dragOver
                    ? "border-[#B48B40]/60 bg-[#B48B40]/5"
                    : "border-white/10 hover:border-white/20 hover:bg-white/[0.02]"
                )}
              >
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                  <Upload className="w-5 h-5 text-white/40" strokeWidth={1.5} />
                </div>
                <p className="text-sm text-white/40">Drag & drop or <span className="text-[#B48B40]">browse files</span></p>
                <p className="text-xs text-white/20">MP4, MOV, WebM — max 500 MB</p>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-[0.14em] text-white/30 mb-1.5">Exercise Title</label>
                <input value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="e.g. Barbell Back Squat"
                  className="w-full bg-white/[0.03] border border-white/8 rounded-xl px-3.5 py-2.5 text-sm text-white/85 placeholder:text-white/20 outline-none focus:border-[#B48B40]/40 focus:bg-[#B48B40]/5 transition-all" />
              </div>
              <TagSelects
                muscle={uploadMuscle} setMuscle={setUploadMuscle}
                movement={uploadMovement} setMovement={setUploadMovement}
                difficulty={uploadDifficulty} setDifficulty={setUploadDifficulty}
              />
            </>
          )}

          {/* ── YouTube tab ── */}
          {tab === "youtube" && (
            <>
              {/* URL input */}
              <div>
                <label className="block text-[10px] uppercase tracking-[0.14em] text-white/30 mb-1.5">YouTube URL</label>
                <div className="relative">
                  <Link2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25 pointer-events-none" />
                  <input
                    value={ytUrl}
                    onChange={(e) => handleYtUrlChange(e.target.value)}
                    placeholder="https://youtube.com/watch?v=..."
                    className={cn(
                      "w-full bg-white/[0.03] border rounded-xl pl-10 pr-10 py-2.5 text-sm text-white/85 placeholder:text-white/20 outline-none transition-all",
                      ytParseError
                        ? "border-red-500/40 bg-red-500/5 focus:border-red-500/60"
                        : ytId
                          ? "border-emerald-500/40 bg-emerald-500/5 focus:border-emerald-500/60"
                          : "border-white/8 focus:border-[#B48B40]/40 focus:bg-[#B48B40]/5"
                    )}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {ytParseError && <AlertCircle className="w-4 h-4 text-red-400/60" />}
                    {ytId && !ytParseError && <CheckCircle2 className="w-4 h-4 text-emerald-400/70" />}
                  </div>
                </div>
                {ytParseError && (
                  <p className="text-xs text-red-400/60 mt-1.5">
                    Couldn&apos;t detect a YouTube video ID. Try the full watch URL.
                  </p>
                )}
              </div>

              {/* Thumbnail preview — shows once ID is extracted */}
              {ytId && (
                <div className="rounded-2xl overflow-hidden border border-white/8 relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={youTubeThumbnailUrl(ytId)}
                    alt="YouTube thumbnail"
                    className="w-full aspect-video object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  {/* YouTube badge */}
                  <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/70 backdrop-blur-sm">
                    <YTIcon className="w-3 h-3 text-[#FF4444]" />
                    <span className="text-[10px] text-white/70 font-medium">YouTube</span>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/20">
                      <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                    </div>
                  </div>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-[10px] uppercase tracking-[0.14em] text-white/30 mb-1.5">Exercise Title</label>
                <input
                  value={ytTitle}
                  onChange={(e) => setYtTitle(e.target.value)}
                  placeholder="e.g. Squat Tutorial — Jeff Nippard"
                  className="w-full bg-white/[0.03] border border-white/8 rounded-xl px-3.5 py-2.5 text-sm text-white/85 placeholder:text-white/20 outline-none focus:border-[#B48B40]/40 focus:bg-[#B48B40]/5 transition-all"
                />
              </div>

              {/* Tags */}
              <TagSelects
                muscle={ytMuscle} setMuscle={setYtMuscle}
                movement={ytMovement} setMovement={setYtMovement}
                difficulty={ytDifficulty} setDifficulty={setYtDifficulty}
              />

              {/* Coaching notes */}
              <div>
                <label className="block text-[10px] uppercase tracking-[0.14em] text-white/30 mb-1.5">Coaching Notes</label>
                <textarea
                  value={ytNotes}
                  onChange={(e) => setYtNotes(e.target.value)}
                  placeholder="Context for clients — when to watch this, what to focus on..."
                  rows={3}
                  className="w-full bg-white/[0.03] border border-white/8 rounded-xl px-3.5 py-2.5 text-sm text-white/75 placeholder:text-white/20 outline-none focus:border-[#B48B40]/40 resize-none transition-all"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/6 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-white/40 hover:text-white/70 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave() || saving}
            className={cn(
              "px-5 py-2 rounded-xl text-sm font-medium transition-all",
              saved
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-400/20"
                : "bg-[#B48B40] text-black hover:bg-[#C99B50] disabled:opacity-40 disabled:cursor-not-allowed"
            )}
          >
            {saved ? "Added!" : saving ? "Saving…" : tab === "youtube" ? "Add YouTube video" : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── VideoThumbnail ────────────────────────────────────────────────────────────

function VideoThumbnail({ video, hovered }: { video: ExerciseVideo; hovered: boolean }) {
  const [imgError, setImgError] = useState(false);
  const isYT = video.source === "youtube";

  return (
    <div className={cn(
      "relative w-full aspect-video rounded-xl overflow-hidden bg-gradient-to-br",
      video.thumbnailColor
    )}>
      {/* Real thumbnail for YouTube */}
      {isYT && video.thumbnailUrl && !imgError && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={video.thumbnailUrl}
          alt={video.title}
          className="absolute inset-0 w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      )}

      {/* Gradient overlay on YouTube thumbnails */}
      {isYT && video.thumbnailUrl && !imgError && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
      )}

      {/* Grain for uploaded */}
      {!isYT && (
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E\")" }} />
      )}

      {/* Play button */}
      <div className={cn(
        "absolute inset-0 flex items-center justify-center transition-all duration-200",
        hovered ? "opacity-100" : "opacity-60"
      )}>
        <div className={cn(
          "w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/20 transition-transform duration-200",
          hovered && "scale-110"
        )}>
          <Play className="w-4 h-4 text-white fill-white ml-0.5" />
        </div>
      </div>

      {/* Duration badge */}
      <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[10px] text-white/80 tabular-nums font-mono">
        {formatDuration(video.duration)}
      </div>

      {/* Source badge */}
      {isYT ? (
        <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-sm">
          <YTIcon className="w-2.5 h-2.5 text-[#FF4444]" />
          <span className="text-[9px] text-white/60">YouTube</span>
        </div>
      ) : video.loop ? (
        <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-[#B48B40]/80 text-[9px] text-black font-semibold uppercase tracking-wider">
          Loop
        </div>
      ) : null}
    </div>
  );
}

// ─── DifficultyBadge ──────────────────────────────────────────────────────────

function DifficultyBadge({ level }: { level: ExerciseVideo["difficulty"] }) {
  const styles: Record<string, string> = {
    beginner:     "text-emerald-400/70 bg-emerald-400/10",
    intermediate: "text-amber-400/70 bg-amber-400/10",
    advanced:     "text-red-400/70 bg-red-400/10",
  };
  return (
    <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-md", styles[level])}>
      {DIFFICULTY_LABELS[level]}
    </span>
  );
}

// ─── GridCard ─────────────────────────────────────────────────────────────────

function GridCard({ video }: { video: ExerciseVideo }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Link
      href={`/library/${video.id}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group block rounded-2xl border border-white/6 bg-[#111111] overflow-hidden hover:border-white/12 transition-all hover:-translate-y-0.5"
    >
      <VideoThumbnail video={video} hovered={hovered} />
      <div className="px-3.5 py-3">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <p className="text-sm font-medium text-white/85 leading-snug">{video.title}</p>
          <DifficultyBadge level={video.difficulty} />
        </div>
        <p className="text-xs text-white/35 leading-snug line-clamp-2 mb-2.5">{video.description}</p>
        <div className="flex flex-wrap gap-1 mb-2.5">
          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 text-white/40">
            {MOVEMENT_TYPE_LABELS[video.movementType]}
          </span>
          {video.muscleGroups.slice(0, 2).map((mg) => (
            <span key={mg} className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 text-white/40">
              {MUSCLE_GROUP_LABELS[mg]}
            </span>
          ))}
          {video.muscleGroups.length > 2 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 text-white/30">
              +{video.muscleGroups.length - 2}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between text-[10px] text-white/25">
          <span className="flex items-center gap-1">
            {video.source === "youtube" ? (
              <YTIcon className="w-3 h-3 text-[#FF4444]/50" />
            ) : (
              <Eye className="w-3 h-3" />
            )}
            {video.source === "youtube"
              ? (video.youtubeData?.channelName ?? "YouTube")
              : video.viewCount.toLocaleString()}
          </span>
          <span>{video.uploadedBy}</span>
        </div>
      </div>
    </Link>
  );
}

// ─── ListRow ──────────────────────────────────────────────────────────────────

function ListRow({ video }: { video: ExerciseVideo }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Link
      href={`/library/${video.id}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center gap-4 px-4 py-3 rounded-2xl border border-white/5 bg-[#111111] hover:border-white/10 hover:bg-white/[0.02] transition-all"
    >
      <div className="w-28 shrink-0">
        <VideoThumbnail video={video} hovered={hovered} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-medium text-white/85 truncate">{video.title}</p>
          <DifficultyBadge level={video.difficulty} />
          {video.source === "youtube" && (
            <span className="flex items-center gap-1 text-[10px] text-[#FF4444]/60">
              <YTIcon className="w-3 h-3" />
            </span>
          )}
        </div>
        <p className="text-xs text-white/35 truncate mb-1.5">{video.description}</p>
        <div className="flex flex-wrap gap-1">
          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 text-white/40">
            {MOVEMENT_TYPE_LABELS[video.movementType]}
          </span>
          {video.muscleGroups.slice(0, 3).map((mg) => (
            <span key={mg} className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 text-white/40">
              {MUSCLE_GROUP_LABELS[mg]}
            </span>
          ))}
        </div>
      </div>
      <div className="shrink-0 text-right space-y-1">
        <div className="flex items-center gap-1 text-[11px] text-white/30 justify-end">
          <Clock className="w-3 h-3" />
          {formatDuration(video.duration)}
        </div>
        {video.source === "upload" && (
          <div className="flex items-center gap-1 text-[11px] text-white/25 justify-end">
            <Eye className="w-3 h-3" />
            {video.viewCount.toLocaleString()}
          </div>
        )}
        <p className="text-[10px] text-white/20">{video.uploadedBy}</p>
      </div>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LibraryPage() {
  const { user } = useUser();
  const canManage = hasAccess(user.role, "trainer");

  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [showAdd, setShowAdd] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<VideoSource | "all">("all");
  const [muscleGroup, setMuscleGroup] = useState<ExerciseVideo["muscleGroups"][number] | "all">("all");
  const [movementType, setMovementType] = useState<ExerciseVideo["movementType"] | "all">("all");
  const [equipment, setEquipment] = useState<ExerciseVideo["equipment"][number] | "all">("all");
  const [difficulty, setDifficulty] = useState<ExerciseVideo["difficulty"] | "all">("all");

  const filtered = useMemo(() =>
    filterVideos(VIDEO_LIBRARY, {
      query,
      source: sourceFilter,
      muscleGroup: muscleGroup as MuscleGroup | "all",
      movementType: movementType as MovementType | "all",
      equipment: equipment as Equipment | "all",
      difficulty: difficulty as Difficulty | "all",
    }),
    [query, sourceFilter, muscleGroup, movementType, equipment, difficulty]
  );

  const activeFilterCount = [muscleGroup, movementType, equipment, difficulty, sourceFilter]
    .filter((v) => v !== "all").length;

  function clearFilters() {
    setSourceFilter("all");
    setMuscleGroup("all");
    setMovementType("all");
    setEquipment("all");
    setDifficulty("all");
  }

  const ytCount = VIDEO_LIBRARY.filter((v) => v.source === "youtube").length;
  const uploadCount = VIDEO_LIBRARY.filter((v) => v.source === "upload").length;

  return (
    <div className="flex-1 min-h-screen bg-[#0A0A0A] px-6 py-8 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-white/90 tracking-tight mb-0.5">Exercise Library</h1>
          <div className="flex items-center gap-3 text-xs text-white/30">
            <span>{uploadCount} uploaded</span>
            <span className="w-px h-3 bg-white/10" />
            <span className="flex items-center gap-1">
              <YTIcon className="w-3 h-3 text-[#FF4444]/50" />
              {ytCount} YouTube
            </span>
            <span className="w-px h-3 bg-white/10" />
            <span>{filtered.length} shown</span>
          </div>
        </div>
        {canManage && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#B48B40] text-black text-sm font-medium hover:bg-[#C99B50] transition-all"
          >
            <Upload className="w-4 h-4" />
            Add Video
          </button>
        )}
      </div>

      {/* Source filter pills */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {(["all", "upload", "youtube"] as const).map((src) => (
          <button
            key={src}
            onClick={() => setSourceFilter(src)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all border",
              sourceFilter === src
                ? src === "youtube"
                  ? "border-[#FF4444]/30 bg-[#FF4444]/10 text-[#FF4444]"
                  : "border-[#B48B40]/40 bg-[#B48B40]/10 text-[#B48B40]"
                : "border-white/6 text-white/35 hover:text-white/60 hover:border-white/12"
            )}
          >
            {src === "youtube" && <YTIcon className="w-3 h-3" />}
            {src === "all" ? "All videos" : src === "youtube" ? "YouTube" : "Uploaded"}
          </button>
        ))}
      </div>

      {/* Search + Controls */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25 pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search exercises..."
            className="w-full bg-white/[0.04] border border-white/8 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white/80 placeholder:text-white/25 outline-none focus:border-[#B48B40]/40 focus:bg-[#B48B40]/5 transition-all"
          />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all",
            showFilters || activeFilterCount > 0
              ? "border-[#B48B40]/40 bg-[#B48B40]/10 text-[#B48B40]"
              : "border-white/8 bg-white/[0.03] text-white/50 hover:text-white/75 hover:border-white/15"
          )}
        >
          <Filter className="w-4 h-4" />
          Filters
          {activeFilterCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-[#B48B40] text-black text-[9px] font-bold flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
        <div className="flex rounded-xl border border-white/8 overflow-hidden bg-white/[0.02]">
          <button
            onClick={() => setViewMode("grid")}
            className={cn("p-2.5 transition-all", viewMode === "grid" ? "bg-white/8 text-white/80" : "text-white/30 hover:text-white/55")}
          >
            <Grid3X3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={cn("p-2.5 transition-all", viewMode === "list" ? "bg-white/8 text-white/80" : "text-white/30 hover:text-white/55")}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="mb-5 p-4 rounded-2xl border border-white/6 bg-[#111111]">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            {[
              { label: "Muscle Group", value: muscleGroup, setter: setMuscleGroup, options: MUSCLE_GROUP_LABELS, allLabel: "All muscles" },
              { label: "Movement", value: movementType, setter: setMovementType, options: MOVEMENT_TYPE_LABELS, allLabel: "All movements" },
              { label: "Equipment", value: equipment, setter: setEquipment, options: EQUIPMENT_LABELS, allLabel: "All equipment" },
              { label: "Difficulty", value: difficulty, setter: setDifficulty, options: DIFFICULTY_LABELS, allLabel: "All levels" },
            ].map(({ label, value, setter, options, allLabel }) => (
              <div key={label}>
                <label className="block text-[10px] uppercase tracking-[0.14em] text-white/30 mb-1.5">{label}</label>
                <div className="relative">
                  <select
                    value={value}
                    onChange={(e) => setter(e.target.value as never)}
                    className="w-full appearance-none bg-white/[0.03] border border-white/8 rounded-xl px-3 py-2 text-xs text-white/70 outline-none focus:border-[#B48B40]/40 transition-all"
                  >
                    <option value="all">{allLabel}</option>
                    {Object.entries(options).map(([v, l]) => <option key={v} value={v}>{l as string}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30 pointer-events-none" />
                </div>
              </div>
            ))}
          </div>
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="text-xs text-white/35 hover:text-white/60 flex items-center gap-1 transition-colors">
              <X className="w-3 h-3" />
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Active filter chips */}
      {activeFilterCount > 0 && !showFilters && (
        <div className="flex flex-wrap gap-2 mb-4">
          {muscleGroup !== "all" && (
            <button onClick={() => setMuscleGroup("all")}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#B48B40]/10 text-[#B48B40] text-[11px] font-medium border border-[#B48B40]/20">
              <Tag className="w-3 h-3" />{MUSCLE_GROUP_LABELS[muscleGroup as MuscleGroup]}<X className="w-3 h-3 opacity-60" />
            </button>
          )}
          {movementType !== "all" && (
            <button onClick={() => setMovementType("all")}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#B48B40]/10 text-[#B48B40] text-[11px] font-medium border border-[#B48B40]/20">
              <Tag className="w-3 h-3" />{MOVEMENT_TYPE_LABELS[movementType as MovementType]}<X className="w-3 h-3 opacity-60" />
            </button>
          )}
        </div>
      )}

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center">
            <Dumbbell className="w-6 h-6 text-white/20" strokeWidth={1.5} />
          </div>
          <p className="text-sm text-white/40">No videos match your filters</p>
          <button onClick={clearFilters} className="text-xs text-[#B48B40] hover:text-[#C99B50] transition-colors">
            Clear all filters
          </button>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((video) => <GridCard key={video.id} video={video} />)}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((video) => <ListRow key={video.id} video={video} />)}
        </div>
      )}

      {showAdd && <AddVideoModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}
