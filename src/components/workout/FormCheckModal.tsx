"use client";

import { useState, useRef, useEffect } from "react";
import {
  X, Upload, Loader2, AlertTriangle, CheckCircle2, Sparkles, RotateCcw, Video,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { extractFramesFromBlob } from "@/lib/video/frames";

type Severity = "ok" | "watch" | "fix";

type FormCheckResult = {
  overall:  Severity;
  headline: string;
  cues: Array<{
    phase:    "setup" | "descent" | "bottom" | "ascent" | "lockout" | "global";
    severity: Severity;
    message:  string;
  }>;
  oneThingToFix: string | null;
  encouragement: string;
};

type Stage = "idle" | "extracting" | "analyzing" | "done" | "error";

/**
 * Upload (or record) a set, extract ~8 frames in the browser, ship them to
 * /api/ai/form-check, render the coach's cues.
 */
export function FormCheckModal({
  exerciseName, exerciseId, onClose,
}: {
  exerciseName: string;
  exerciseId:   string;
  onClose:      () => void;
}) {
  const [file,    setFile]    = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [stage,   setStage]   = useState<Stage>("idle");
  const [error,   setError]   = useState<string | null>(null);
  const [note,    setNote]    = useState("");
  const [result,  setResult]  = useState<FormCheckResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  function reset() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null); setPreviewUrl(null); setResult(null);
    setStage("idle"); setError(null); setNote("");
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("video/")) {
      setError("That's not a video. Try an mp4 or mov."); return;
    }
    if (f.size > 80 * 1024 * 1024) {
      setError("Video over 80 MB — trim to one set first."); return;
    }
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setError(null);
  }

  async function analyze() {
    if (!file) return;
    setError(null); setStage("extracting");
    try {
      const frames = await extractFramesFromBlob(file, 8, 640);
      setStage("analyzing");
      const res = await fetch("/api/ai/form-check", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exerciseName, exerciseId, frames, note: note.trim() || undefined }),
      });
      const json = await res.json() as FormCheckResult & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Couldn't analyze that set.");
      setResult(json);
      setStage("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't analyze that set.");
      setStage("error");
    }
  }

  const busy = stage === "extracting" || stage === "analyzing";

  return (
    <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-xl bg-[#0D0D0D] border border-white/10 rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#B48B40]" strokeWidth={1.8} />
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">Form check</p>
              <p className="text-sm font-semibold text-white/90">{exerciseName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/[0.08] flex items-center justify-center text-white/55"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {!result && (
            <>
              {!file ? (
                <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-5 py-8 text-center space-y-3">
                  <Video className="w-8 h-8 text-white/25 mx-auto" strokeWidth={1.5} />
                  <div>
                    <p className="text-sm font-medium text-white/75">Upload one set</p>
                    <p className="text-[11px] text-white/40 mt-1 leading-relaxed">
                      A side-on view, full body in frame, one rep cycle visible.<br />
                      Up to ~30 seconds works best.
                    </p>
                  </div>
                  <input
                    ref={inputRef}
                    type="file"
                    accept="video/*"
                    capture="environment"
                    onChange={onPick}
                    className="hidden"
                  />
                  <button
                    onClick={() => inputRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#B48B40] text-black px-4 py-2 text-xs font-semibold hover:bg-[#c99840] transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" strokeWidth={2} />
                    Choose / record video
                  </button>
                </div>
              ) : (
                <>
                  {previewUrl && (
                    <video
                      src={previewUrl}
                      controls
                      playsInline
                      className="w-full rounded-2xl border border-white/[0.07] bg-black"
                    />
                  )}
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    placeholder="Optional note for the coach — e.g. 'left knee tweaked at the bottom'…"
                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white/85 placeholder:text-white/25 outline-none focus:border-[#B48B40]/40 resize-none leading-relaxed"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={analyze}
                      disabled={busy}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#B48B40] text-black px-4 py-2.5 text-sm font-semibold hover:bg-[#c99840] disabled:opacity-50 transition-colors"
                    >
                      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" strokeWidth={2} />}
                      {stage === "extracting" ? "Reading frames…" : stage === "analyzing" ? "Coach reviewing…" : "Get form check"}
                    </button>
                    <button
                      onClick={reset}
                      disabled={busy}
                      className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-xs font-medium text-white/55 hover:text-white/85 disabled:opacity-50"
                    >
                      <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </button>
                  </div>
                </>
              )}
              {error && (
                <div className="rounded-xl border border-red-400/20 bg-red-400/[0.04] px-3 py-2.5 flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-300/80 mt-0.5 shrink-0" strokeWidth={1.5} />
                  <p className="text-xs text-red-200/80 leading-relaxed">{error}</p>
                </div>
              )}
            </>
          )}

          {result && (
            <div className="space-y-4">
              <div className={cn(
                "rounded-2xl border px-4 py-3 flex items-start gap-3",
                result.overall === "ok"    ? "border-emerald-400/25 bg-emerald-400/[0.04]" :
                result.overall === "watch" ? "border-amber-400/25 bg-amber-400/[0.04]"     :
                                              "border-red-400/25 bg-red-400/[0.04]",
              )}>
                {result.overall === "ok"
                  ? <CheckCircle2 className="w-5 h-5 text-emerald-400/85 shrink-0 mt-0.5" strokeWidth={1.8} />
                  : <AlertTriangle className="w-5 h-5 text-amber-400/85 shrink-0 mt-0.5" strokeWidth={1.8} />}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white/90">{result.headline}</p>
                  <p className="text-[11px] text-white/55 mt-1 leading-relaxed">{result.encouragement}</p>
                </div>
              </div>

              <div className="space-y-2">
                {result.cues.map((c, i) => (
                  <div
                    key={i}
                    className={cn(
                      "rounded-xl border px-3.5 py-2.5 flex items-start gap-2.5",
                      c.severity === "ok"    ? "border-emerald-400/20 bg-emerald-400/[0.03]" :
                      c.severity === "watch" ? "border-amber-400/20 bg-amber-400/[0.03]"     :
                                                "border-red-400/20 bg-red-400/[0.03]",
                    )}
                  >
                    <span className={cn(
                      "text-[9px] font-bold uppercase tracking-[0.14em] px-1.5 py-0.5 rounded-md mt-0.5 shrink-0",
                      c.severity === "ok"    ? "bg-emerald-400/15 text-emerald-300/85" :
                      c.severity === "watch" ? "bg-amber-400/15  text-amber-300/85"   :
                                                "bg-red-400/15    text-red-300/85",
                    )}>
                      {c.phase}
                    </span>
                    <p className="text-[12px] text-white/75 leading-relaxed flex-1">{c.message}</p>
                  </div>
                ))}
              </div>

              {result.oneThingToFix && (
                <div className="rounded-2xl border border-[#B48B40]/25 bg-[#B48B40]/[0.05] px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#B48B40]/75 mb-1">One thing for next set</p>
                  <p className="text-sm font-medium text-white/85 leading-relaxed">{result.oneThingToFix}</p>
                </div>
              )}

              <button
                onClick={reset}
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-xs font-semibold text-white/55 hover:text-white/85"
              >
                Check another set
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
