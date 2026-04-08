// ─── Voice entry storage ──────────────────────────────────────────────────────
//
// Transcript is always stored separately from parsed output.
// This lets you re-parse old transcripts if the parser improves,
// and gives a full audit trail of what was said vs what was stored.

import type { ParsedMeal, ParsedFreestyleWorkout } from "./voiceParser";

export type VoiceEntryType =
  | "chat_message"       // voice note sent to coach
  | "meal_log"           // nutrition voice entry
  | "freestyle_workout"  // voice-logged workout (not prescribed)
  | "coach_note";        // standalone voice memo

export interface VoiceEntry {
  id:          string;
  userId:      string;
  entryType:   VoiceEntryType;
  transcript:  string;   // raw transcript — always stored as-is
  confidence:  number;   // speech API confidence, 0–1 or -1 if unavailable
  parsedData:  ParsedMeal | ParsedFreestyleWorkout | null;
  createdAt:   number;
  // Future fields (ready for real backend):
  // rawAudioUrl?:    string;
  // durationSecs?:   number;
  // providerName?:   "web_speech" | "whisper" | "deepgram";
}

const KEY = (uid: string) => `flowstate-voice-logs-${uid}`;

function load(userId: string): VoiceEntry[] {
  try {
    const raw = localStorage.getItem(KEY(userId));
    return raw ? (JSON.parse(raw) as VoiceEntry[]) : [];
  } catch {
    return [];
  }
}

function persist(userId: string, entries: VoiceEntry[]): void {
  try { localStorage.setItem(KEY(userId), JSON.stringify(entries)); } catch { /* ignore */ }
}

export function saveVoiceEntry(
  userId: string,
  entry: Omit<VoiceEntry, "id" | "createdAt">,
): VoiceEntry {
  const full: VoiceEntry = {
    ...entry,
    id:        `ve_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    createdAt: Date.now(),
  };
  const entries = load(userId);
  entries.unshift(full);
  persist(userId, entries);
  return full;
}

export function getVoiceLogs(userId: string, type?: VoiceEntryType): VoiceEntry[] {
  const all = load(userId);
  return type ? all.filter((e) => e.entryType === type) : all;
}

export function deleteVoiceEntry(userId: string, entryId: string): void {
  const entries = load(userId).filter((e) => e.id !== entryId);
  persist(userId, entries);
}
