"use client";

import { X, Film } from "lucide-react";
import { YTIcon } from "@/components/library/YTIcon";
import {
  type ExerciseVideo,
  youTubeEmbedUrl,
  formatDuration,
  MUSCLE_GROUP_LABELS,
  MOVEMENT_TYPE_LABELS,
} from "@/lib/videoLibrary";
import { cn } from "@/lib/utils";

export type VideoPreviewModalProps = {
  video: ExerciseVideo;
  onClose: () => void;
};

export function VideoPreviewModal({ video, onClose }: VideoPreviewModalProps) {
  const isYT = video.source === "youtube" && video.youtubeData?.videoId;
  const embedUrl = isYT
    ? youTubeEmbedUrl(video.youtubeData!.videoId, {
        loop: video.loop,
        start: video.trimStart,
      }) + "&autoplay=1"
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-[#111111] border border-white/8 rounded-3xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/6">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {isYT && <YTIcon className="w-3.5 h-3.5 text-[#FF4444] shrink-0" />}
              <h2 className="text-sm font-semibold text-white/90 truncate">{video.title}</h2>
            </div>
            <p className="text-xs text-white/35 mt-0.5 truncate">{video.description}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/30 hover:text-white/60 transition-colors shrink-0 ml-3"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Player */}
        <div className={cn("relative aspect-video bg-gradient-to-br", video.thumbnailColor)}>
          {embedUrl ? (
            <iframe
              src={embedUrl}
              title={video.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/40">
              <Film className="w-8 h-8" strokeWidth={1.2} />
              <p className="text-xs">Preview unavailable for uploaded videos in demo</p>
            </div>
          )}
        </div>

        {/* Meta */}
        <div className="px-5 py-4 space-y-3">
          <div className="flex gap-1.5 flex-wrap">
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-white/45">
              {MOVEMENT_TYPE_LABELS[video.movementType]}
            </span>
            {video.muscleGroups.map((mg) => (
              <span key={mg} className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-white/45">
                {MUSCLE_GROUP_LABELS[mg]}
              </span>
            ))}
            {video.duration > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-white/45 tabular-nums">
                {formatDuration(video.duration)}
              </span>
            )}
          </div>

          {video.cues.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/25 mb-1.5">Cues</p>
              <ul className="space-y-1">
                {video.cues.map((cue, i) => (
                  <li key={i} className="text-xs text-white/55 flex gap-2">
                    <span className="text-white/20">·</span>
                    <span>{cue}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
