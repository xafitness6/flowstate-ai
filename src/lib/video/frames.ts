// ─── Browser-side video frame extraction ────────────────────────────────────
// No server ffmpeg dep — we sample N evenly-spaced frames from a local Blob
// using <video> + canvas, then return them as data: URLs the API can hand to
// GPT-4o vision.

/** Sample `count` frames evenly across the video's duration. */
export async function extractFramesFromBlob(
  blob: Blob,
  count = 8,
  maxWidth = 640,
): Promise<string[]> {
  const url   = URL.createObjectURL(blob);
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted   = true;
  video.playsInline = true;
  video.src     = url;

  try {
    await new Promise<void>((resolve, reject) => {
      const onMeta = () => { video.removeEventListener("loadedmetadata", onMeta); resolve(); };
      const onErr  = () => { video.removeEventListener("error", onErr); reject(new Error("Couldn't read video")); };
      video.addEventListener("loadedmetadata", onMeta);
      video.addEventListener("error", onErr);
    });

    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    if (duration <= 0) throw new Error("Video has no duration");

    const ratio    = video.videoWidth > 0 ? maxWidth / video.videoWidth : 1;
    const targetW  = Math.min(video.videoWidth, maxWidth) || maxWidth;
    const targetH  = Math.round(video.videoHeight * Math.min(1, ratio)) || Math.round(maxWidth * 9 / 16);
    const canvas   = document.createElement("canvas");
    canvas.width   = targetW;
    canvas.height  = targetH;
    const ctx      = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D unavailable");

    // Sample N points across [0.05·dur, 0.95·dur] so we skip dead head/tail.
    const start = duration * 0.05;
    const end   = duration * 0.95;
    const times = Array.from({ length: count }, (_, i) =>
      count === 1 ? duration / 2 : start + ((end - start) * i) / (count - 1),
    );

    const frames: string[] = [];
    for (const t of times) {
      await seekTo(video, t);
      ctx.drawImage(video, 0, 0, targetW, targetH);
      frames.push(canvas.toDataURL("image/jpeg", 0.72));
    }
    return frames;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => { cleanup(); resolve(); };
    const onErr    = () => { cleanup(); reject(new Error("Seek failed")); };
    const cleanup  = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onErr);
    };
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onErr);
    try { video.currentTime = Math.max(0, time); } catch { onErr(); }
  });
}
