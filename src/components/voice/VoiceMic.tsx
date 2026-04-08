"use client";

import { Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VoiceStatus } from "@/hooks/useVoiceInput";

interface VoiceMicProps {
  status:      VoiceStatus;
  isSupported: boolean;
  onStart:     () => void;
  onStop:      () => void;
  size?:       "sm" | "md" | "lg";
  className?:  string;
}

const SIZES = {
  sm: { btn: "w-8 h-8",   icon: "w-3.5 h-3.5" },
  md: { btn: "w-10 h-10", icon: "w-4 h-4"     },
  lg: { btn: "w-14 h-14", icon: "w-6 h-6"     },
};

export function VoiceMic({
  status, isSupported, onStart, onStop, size = "md", className,
}: VoiceMicProps) {
  if (!isSupported) return null;

  const isListening = status === "listening";
  const s = SIZES[size];

  return (
    <button
      type="button"
      onClick={isListening ? onStop : onStart}
      title={isListening ? "Stop recording" : "Voice input"}
      className={cn(
        s.btn,
        "relative rounded-xl flex items-center justify-center shrink-0 transition-all",
        isListening
          ? "bg-red-500/15 border border-red-500/30 text-red-400"
          : "bg-white/[0.04] border border-white/10 text-white/35 hover:text-white/65 hover:border-white/20",
        className,
      )}
    >
      {/* Pulse ring when listening */}
      {isListening && (
        <span className="absolute inset-0 rounded-xl animate-ping bg-red-500/20 pointer-events-none" />
      )}
      {isListening
        ? <MicOff className={cn(s.icon, "relative z-10")} strokeWidth={1.5} />
        : <Mic    className={s.icon}                       strokeWidth={1.5} />}
    </button>
  );
}
