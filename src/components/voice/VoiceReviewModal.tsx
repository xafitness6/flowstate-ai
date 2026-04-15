"use client";

import { useEffect, useRef } from "react";
import { X, Check, RotateCcw, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { VoiceMic } from "./VoiceMic";
import { cleanTranscriptText } from "@/lib/voice";
import type { VoiceStatus } from "@/hooks/useVoiceInput";

interface VoiceReviewModalProps {
  // Voice state
  status:     VoiceStatus;
  transcript: string;
  interim?:   string;
  confidence: number;
  error?:     string | null;
  isSupported: boolean;

  // Content
  label?:       string;
  placeholder?: string;

  // When true, filler words are stripped from the transcript automatically
  // when the user stops recording. The raw transcript is captured separately
  // via onRawTranscript before cleaning is applied.
  autoClean?:       boolean;
  onRawTranscript?: (raw: string) => void;

  // Callbacks
  onStart:            () => void;
  onStop:             () => void;
  onReset:            () => void;
  onTranscriptChange: (t: string) => void;
  onConfirm:          () => void;
  onCancel:           () => void;

  disabled?: boolean;
}

export function VoiceReviewModal({
  status, transcript, interim, confidence, error, isSupported,
  label = "Voice input", placeholder = "Tap the mic and speak…",
  autoClean = false, onRawTranscript,
  onStart, onStop, onReset, onTranscriptChange, onConfirm, onCancel,
  disabled,
}: VoiceReviewModalProps) {
  const isListening    = status === "listening";
  const hasTranscript  = transcript.trim().length > 0;
  const displayText    = transcript + (interim ? ` ${interim}` : "");

  // Capture the raw transcript the moment recording stops, then apply cleaning.
  // prevStatus lets us detect the listening→done transition exactly once.
  const prevStatusRef = useRef<VoiceStatus>(status);

  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;

    if (autoClean && prev === "listening" && status === "done" && transcript.trim()) {
      // Store raw before cleaning
      onRawTranscript?.(transcript);
      // Apply cleaning — user sees cleaned text and can still edit
      const cleaned = cleanTranscriptText(transcript);
      if (cleaned !== transcript) {
        onTranscriptChange(cleaned);
      }
    }
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#111111] border border-white/10 rounded-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            {isListening ? (
              <div className="flex items-end gap-0.5 h-4">
                {[6, 10, 14, 10, 6, 14, 8].map((h, i) => (
                  <div
                    key={i}
                    className="w-1 rounded-full bg-red-400 animate-bounce"
                    style={{ height: `${h}px`, animationDelay: `${i * 80}ms`, animationDuration: "600ms" }}
                  />
                ))}
              </div>
            ) : (
              <div className="w-2 h-2 rounded-full bg-[#B48B40]" />
            )}
            <p className="text-sm font-semibold text-white/80">{label}</p>
          </div>
          <button onClick={onCancel} className="text-white/30 hover:text-white/60 transition-colors">
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">

          {/* Transcript edit area */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] uppercase tracking-[0.18em] text-white/30">
                {isListening ? "Listening…" : "What you said"}
              </label>
              {confidence >= 0 && !isListening && (
                <span className="text-[10px] text-white/22">
                  {Math.round(confidence * 100)}% mic confidence
                </span>
              )}
            </div>
            <textarea
              value={displayText}
              onChange={(e) => onTranscriptChange(e.target.value)}
              placeholder={isListening ? "Recording…" : placeholder}
              rows={4}
              disabled={isListening}
              className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/22 outline-none focus:border-white/20 transition-all resize-none disabled:opacity-50"
            />
            {isListening && (
              <p className="text-[10px] text-red-400/70">
                Listening — tap <MicOff className="inline w-3 h-3" strokeWidth={1.5} /> when done
              </p>
            )}
            {!isListening && hasTranscript && (
              <p className="text-[10px] text-white/20">Edit above if anything was missed, then confirm.</p>
            )}
            {error && <p className="text-[10px] text-red-400/70">{error}</p>}
          </div>

          {/* Action row */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onReset}
              className="w-9 h-9 rounded-xl border border-white/10 flex items-center justify-center text-white/30 hover:text-white/60 transition-colors shrink-0"
              title="Clear and restart"
            >
              <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>

            <VoiceMic
              status={status}
              isSupported={isSupported}
              onStart={onStart}
              onStop={onStop}
              size="sm"
            />

            <button
              type="button"
              onClick={onConfirm}
              disabled={!hasTranscript || isListening || disabled}
              className={cn(
                "flex-1 h-9 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-all",
                hasTranscript && !isListening && !disabled
                  ? "bg-[#B48B40] text-black hover:bg-[#c99840] active:scale-[0.98]"
                  : "bg-white/5 text-white/25 cursor-not-allowed",
              )}
            >
              <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
