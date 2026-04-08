// ─── Voice provider abstraction ───────────────────────────────────────────────
//
// Swap the provider by changing getDefaultProvider(). All product logic
// (coach, nutrition, workout) calls this — nothing is hardwired to one vendor.
//
// To add Whisper / Deepgram / AssemblyAI:
//   1. Create a class implementing VoiceProvider
//   2. Return it from getDefaultProvider()
//   That is the only change needed.

export interface TranscriptResult {
  transcript: string;
  confidence: number;  // 0–1, or -1 when the API does not provide it
  isFinal:    boolean;
}

export interface VoiceProvider {
  isSupported(): boolean;
  start(onResult: (r: TranscriptResult) => void, onError: (e: string) => void): void;
  stop(): void;
}

// ─── Web Speech API provider (real, browser-native) ──────────────────────────
// Works in Chrome, Edge, Safari ≥ 14.1. Not available in Firefox.

export class WebSpeechProvider implements VoiceProvider {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private rec: any = null;

  isSupported(): boolean {
    if (typeof window === "undefined") return false;
    return "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
  }

  start(
    onResult: (r: TranscriptResult) => void,
    onError:  (e: string)            => void,
  ): void {
    if (!this.isSupported()) {
      onError("Speech recognition is not supported in this browser. Try Chrome or Safari.");
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition) as
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      new () => {
        continuous:      boolean;
        interimResults:  boolean;
        lang:            string;
        maxAlternatives: number;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onresult:        ((e: any) => void) | null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onerror:         ((e: any) => void) | null;
        onend:           (() => void) | null;
        start():         void;
        stop():          void;
      };

    this.rec = new SR();
    this.rec.continuous      = true;
    this.rec.interimResults  = true;
    this.rec.lang            = "en-US";
    this.rec.maxAlternatives = 1;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.rec.onresult = (event: any) => {
      let finalText   = "";
      let interimText = "";
      let conf        = -1;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) {
          finalText += r[0].transcript;
          conf       = r[0].confidence ?? -1;
        } else {
          interimText += r[0].transcript;
        }
      }

      if (finalText) {
        onResult({ transcript: finalText, confidence: conf, isFinal: true });
      } else if (interimText) {
        onResult({ transcript: interimText, confidence: -1, isFinal: false });
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.rec.onerror = (event: any) => {
      const MESSAGES: Record<string, string> = {
        "not-allowed":         "Microphone access denied. Enable it in browser settings.",
        "no-speech":           "No speech detected. Try again.",
        "network":             "Network error during transcription.",
        "aborted":             "",   // intentional stop — not an error
        "audio-capture":       "No microphone found.",
        "service-not-allowed": "Speech service not allowed.",
      };
      const msg = MESSAGES[event.error as string];
      if (msg !== "") onError(msg ?? `Speech error: ${event.error as string}`);
    };

    this.rec.onend = () => {
      // Fired when recognition stops — either by .stop() or naturally
    };

    this.rec.start();
  }

  stop(): void {
    try { this.rec?.stop(); } catch { /* ignore */ }
    this.rec = null;
  }
}

// ─── Null provider (silent fallback when API unavailable) ────────────────────

export class NullVoiceProvider implements VoiceProvider {
  isSupported() { return false; }
  start(_: (r: TranscriptResult) => void, onError: (e: string) => void) {
    onError("Voice input is not available in this environment.");
  }
  stop() { /* no-op */ }
}

// ─── Default provider (swap here to change vendor globally) ──────────────────

export function getDefaultProvider(): VoiceProvider {
  if (typeof window === "undefined") return new NullVoiceProvider();
  const supported = "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
  return supported ? new WebSpeechProvider() : new NullVoiceProvider();
}
