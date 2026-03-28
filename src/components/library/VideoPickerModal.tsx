"use client";

import { useState, useMemo } from "react";
import { Search, Play, X, Check, Filter, ChevronDown } from "lucide-react";
import { YTIcon } from "@/components/library/YTIcon";
import { cn } from "@/lib/utils";
import {
  VIDEO_LIBRARY, filterVideos, formatDuration,
  MUSCLE_GROUP_LABELS, MOVEMENT_TYPE_LABELS,
  type ExerciseVideo, type MuscleGroup, type MovementType,
} from "@/lib/videoLibrary";

// ─── Types ────────────────────────────────────────────────────────────────────

export type VideoPickerProps = {
  currentVideoId?: string | null;
  exerciseName?: string;
  onSelect: (video: ExerciseVideo) => void;
  onRemove?: () => void;
  onClose: () => void;
};

// ─── PickerThumbnail ──────────────────────────────────────────────────────────

function PickerThumbnail({ video, selected }: { video: ExerciseVideo; selected: boolean }) {
  const [hovered, setHovered] = useState(false);
  const [imgError, setImgError] = useState(false);
  const isYT = video.source === "youtube";

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "relative aspect-video rounded-xl overflow-hidden bg-gradient-to-br flex-shrink-0 w-24",
        video.thumbnailColor
      )}
    >
      {/* YouTube real thumbnail */}
      {isYT && video.thumbnailUrl && !imgError && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={video.thumbnailUrl}
          alt={video.title}
          className="absolute inset-0 w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      )}

      {/* Play overlay */}
      <div className={cn(
        "absolute inset-0 flex items-center justify-center transition-all",
        hovered ? "opacity-100" : "opacity-60"
      )}>
        <div className="w-7 h-7 rounded-full bg-black/50 flex items-center justify-center border border-white/20">
          <Play className="w-3 h-3 text-white fill-white ml-0.5" />
        </div>
      </div>

      {/* Source badge */}
      {isYT && (
        <div className="absolute top-1 left-1">
          <YTIcon className="w-3 h-3 text-[#FF4444]" />
        </div>
      )}

      <div className="absolute bottom-1 right-1.5 text-[9px] text-white/70 tabular-nums font-mono bg-black/50 rounded px-1">
        {formatDuration(video.duration)}
      </div>

      {selected && (
        <div className="absolute inset-0 bg-[#B48B40]/20 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full bg-[#B48B40] flex items-center justify-center">
            <Check className="w-3 h-3 text-black" strokeWidth={2.5} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── VideoPickerModal ─────────────────────────────────────────────────────────

export function VideoPickerModal({
  currentVideoId,
  exerciseName,
  onSelect,
  onRemove,
  onClose,
}: VideoPickerProps) {
  const [query, setQuery] = useState(exerciseName ?? "");
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup | "all">("all");
  const [movementType, setMovementType] = useState<MovementType | "all">("all");
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() =>
    filterVideos(VIDEO_LIBRARY, {
      query,
      source: "all",
      muscleGroup,
      movementType,
      equipment: "all",
      difficulty: "all",
    }),
    [query, muscleGroup, movementType]
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4 md:p-6">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-[#111111] border border-white/8 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/6 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-white/90">Select Video</h2>
            {exerciseName && (
              <p className="text-xs text-white/35 mt-0.5">for {exerciseName}</p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 text-white/30 hover:text-white/60 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pt-4 pb-2 shrink-0">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25 pointer-events-none" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or exercise..."
                className="w-full bg-white/[0.04] border border-white/8 rounded-xl pl-9 pr-4 py-2 text-sm text-white/80 placeholder:text-white/25 outline-none focus:border-[#B48B40]/40 transition-all"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "p-2 rounded-xl border transition-all",
                showFilters
                  ? "border-[#B48B40]/40 bg-[#B48B40]/10 text-[#B48B40]"
                  : "border-white/8 text-white/35 hover:text-white/60 hover:border-white/15"
              )}
            >
              <Filter className="w-4 h-4" />
            </button>
          </div>

          {/* Quick filters */}
          {showFilters && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="relative">
                <select
                  value={muscleGroup}
                  onChange={(e) => setMuscleGroup(e.target.value as MuscleGroup | "all")}
                  className="w-full appearance-none bg-white/[0.03] border border-white/8 rounded-xl px-3 py-1.5 text-xs text-white/60 outline-none focus:border-[#B48B40]/40 transition-all"
                >
                  <option value="all">All muscles</option>
                  {Object.entries(MUSCLE_GROUP_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-white/25 pointer-events-none" />
              </div>
              <div className="relative">
                <select
                  value={movementType}
                  onChange={(e) => setMovementType(e.target.value as MovementType | "all")}
                  className="w-full appearance-none bg-white/[0.03] border border-white/8 rounded-xl px-3 py-1.5 text-xs text-white/60 outline-none focus:border-[#B48B40]/40 transition-all"
                >
                  <option value="all">All movements</option>
                  {Object.entries(MOVEMENT_TYPE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-white/25 pointer-events-none" />
              </div>
            </div>
          )}
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1 px-4 pb-4 space-y-1.5">
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-sm text-white/25">
              No videos match
            </div>
          ) : (
            filtered.map((video) => {
              const selected = video.id === currentVideoId;
              return (
                <button
                  key={video.id}
                  onClick={() => { onSelect(video); onClose(); }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl border text-left transition-all",
                    selected
                      ? "border-[#B48B40]/40 bg-[#B48B40]/8"
                      : "border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]"
                  )}
                >
                  <PickerThumbnail video={video} selected={selected} />
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-medium truncate", selected ? "text-[#B48B40]" : "text-white/80")}>
                      {video.title}
                    </p>
                    <p className="text-xs text-white/35 truncate">{video.description}</p>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-white/5 text-white/35">
                        {MOVEMENT_TYPE_LABELS[video.movementType]}
                      </span>
                      {video.muscleGroups.slice(0, 2).map((mg) => (
                        <span key={mg} className="text-[9px] px-1.5 py-0.5 rounded-md bg-white/5 text-white/35">
                          {MUSCLE_GROUP_LABELS[mg]}
                        </span>
                      ))}
                    </div>
                  </div>
                  {selected && (
                    <div className="shrink-0">
                      <div className="w-5 h-5 rounded-full bg-[#B48B40] flex items-center justify-center">
                        <Check className="w-3 h-3 text-black" strokeWidth={2.5} />
                      </div>
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        {currentVideoId && onRemove && (
          <div className="px-4 py-3 border-t border-white/6 shrink-0">
            <button
              onClick={() => { onRemove(); onClose(); }}
              className="w-full text-sm text-white/30 hover:text-red-400/60 transition-colors py-1.5"
            >
              Remove attached video
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
