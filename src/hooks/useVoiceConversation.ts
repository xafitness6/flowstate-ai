"use client";

// Live, hands-free voice conversation (for the AI coach).
//
// Unlike useVoiceInput (tap → dictate → stop → send), this keeps the mic open
// and turns natural speech into messages automatically: you talk, and when you
// pause for ~1.3s the utterance is flushed to onUtterance() — which the coach
// page sends as a chat message. The coach replies (and is spoken back), then
// listening resumes. The whole exchange reads as a normal chat thread.
//
// While the coach is replying / speaking, listening is PAUSED so the mic does
// not transcribe the coach's own voice (TTS) or a half-finished reply.

import { useCallback, useEffect, useRef, useState } from "react";
import { getDefaultProvider, type VoiceProvider, type TranscriptResult } from "@/lib/voice";

const SILENCE_MS = 1300;

export interface UseVoiceConversationReturn {
  active:      boolean;   // live mode on
  interim:     string;    // live partial text for display
  error:       string | null;
  isSupported: boolean;
  start:       () => void;
  stop:        () => void;
  setPaused:   (paused: boolean) => void;  // pause capture while the coach responds
}

export function useVoiceConversation(
  onUtterance: (text: string) => void,
): UseVoiceConversationReturn {
  const [active,  setActive]  = useState(false);
  const [interim, setInterim] = useState("");
  const [error,   setError]   = useState<string | null>(null);

  const providerRef = useRef<VoiceProvider | null>(null);
  const bufferRef   = useRef("");
  const silenceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pausedRef   = useRef(false);
  const activeRef   = useRef(false);
  const onUtteranceRef = useRef(onUtterance);
  useEffect(() => { onUtteranceRef.current = onUtterance; }, [onUtterance]);

  const isSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const clearSilence = () => {
    if (silenceRef.current) { clearTimeout(silenceRef.current); silenceRef.current = null; }
  };

  const flush = useCallback(() => {
    clearSilence();
    const text = bufferRef.current.trim();
    bufferRef.current = "";
    setInterim("");
    if (text && !pausedRef.current) onUtteranceRef.current(text);
  }, []);

  const handleResult = useCallback((r: TranscriptResult) => {
    if (pausedRef.current) return;
    if (r.isFinal) {
      bufferRef.current = bufferRef.current
        ? `${bufferRef.current} ${r.transcript.trim()}`
        : r.transcript.trim();
      setInterim(bufferRef.current);
      clearSilence();
      silenceRef.current = setTimeout(flush, SILENCE_MS);  // natural pause → send
    } else {
      // Still talking — show partial, hold off sending.
      setInterim(bufferRef.current ? `${bufferRef.current} ${r.transcript}` : r.transcript);
      clearSilence();
    }
  }, [flush]);

  const beginRecognition = useCallback(() => {
    if (!providerRef.current) providerRef.current = getDefaultProvider();
    providerRef.current.start(handleResult, (e) => {
      // "aborted" is an intentional stop; ignore. Otherwise surface + try to recover.
      if (e) setError(e);
      // Auto-restart if the engine stopped on its own while we're still live.
      if (activeRef.current && !pausedRef.current) {
        setTimeout(() => { if (activeRef.current && !pausedRef.current) beginRecognition(); }, 400);
      }
    });
  }, [handleResult]);

  const start = useCallback(() => {
    if (!isSupported) { setError("Voice isn't supported in this browser. Try Chrome or Safari."); return; }
    setError(null);
    bufferRef.current = "";
    setInterim("");
    pausedRef.current = false;
    activeRef.current = true;
    setActive(true);
    beginRecognition();
  }, [isSupported, beginRecognition]);

  const stop = useCallback(() => {
    activeRef.current = false;
    pausedRef.current = false;
    clearSilence();
    bufferRef.current = "";
    setInterim("");
    setActive(false);
    providerRef.current?.stop();
    providerRef.current = null;
  }, []);

  const setPaused = useCallback((paused: boolean) => {
    if (!activeRef.current) return;
    pausedRef.current = paused;
    if (paused) {
      clearSilence();
      bufferRef.current = "";
      setInterim("");
      providerRef.current?.stop();
      providerRef.current = null;
    } else {
      beginRecognition();
    }
  }, [beginRecognition]);

  useEffect(() => () => { providerRef.current?.stop(); clearSilence(); }, []);

  return { active, interim, error, isSupported, start, stop, setPaused };
}
