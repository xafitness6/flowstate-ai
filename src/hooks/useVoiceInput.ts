"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { getDefaultProvider, type VoiceProvider, type TranscriptResult } from "@/lib/voice";

export type VoiceStatus = "idle" | "listening" | "done" | "error";

export interface UseVoiceInputReturn {
  status:      VoiceStatus;
  transcript:  string;     // accumulated final text
  interim:     string;     // live partial text (not yet committed)
  confidence:  number;     // 0–1 from speech API, -1 = not provided
  error:       string | null;
  isSupported: boolean;
  start:       () => void;
  stop:        () => void;
  reset:       () => void;
  setTranscript: (t: string) => void;  // user can edit before confirming
}

export function useVoiceInput(): UseVoiceInputReturn {
  const [status,     setStatus    ] = useState<VoiceStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [interim,    setInterim   ] = useState("");
  const [confidence, setConfidence] = useState(-1);
  const [error,      setError     ] = useState<string | null>(null);

  const providerRef    = useRef<VoiceProvider | null>(null);
  const accumulatedRef = useRef("");  // running final text across partial results

  const isSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const start = useCallback(() => {
    if (!providerRef.current) {
      providerRef.current = getDefaultProvider();
    }
    accumulatedRef.current = "";
    setTranscript("");
    setInterim("");
    setError(null);
    setConfidence(-1);
    setStatus("listening");

    providerRef.current.start(
      (result: TranscriptResult) => {
        if (result.isFinal) {
          accumulatedRef.current =
            accumulatedRef.current
              ? `${accumulatedRef.current} ${result.transcript.trim()}`
              : result.transcript.trim();
          setTranscript(accumulatedRef.current);
          if (result.confidence >= 0) setConfidence(result.confidence);
          setInterim("");
        } else {
          setInterim(result.transcript);
        }
      },
      (err: string) => {
        setError(err);
        setStatus("error");
        setInterim("");
      },
    );
  }, []);

  const stop = useCallback(() => {
    providerRef.current?.stop();
    setStatus("done");
    setInterim("");
  }, []);

  const reset = useCallback(() => {
    providerRef.current?.stop();
    accumulatedRef.current = "";
    setTranscript("");
    setInterim("");
    setConfidence(-1);
    setError(null);
    setStatus("idle");
  }, []);

  // Clean up provider on unmount
  useEffect(() => () => { providerRef.current?.stop(); }, []);

  return {
    status, transcript, interim, confidence, error, isSupported,
    start, stop, reset, setTranscript,
  };
}
