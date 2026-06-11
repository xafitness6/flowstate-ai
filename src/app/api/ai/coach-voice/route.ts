// ─── Coach voice (TTS-only, always available) ──────────────────────────────
// Lightweight sibling of /api/ai/coach-avatar. Runs only the TTS step and
// returns an inline base64 mp3 data URL the chat can play in an <audio> tag.
//
// Why both routes:
//   - /coach-voice  → free, fast (≈1–3s), works for every user.
//   - /coach-avatar → richer (lipsynced video), but requires a Higgsfield Pro
//                     plan + the CLI authed on the host.
//
// The chat UI exposes both as separate buttons; users land on the fast path
// by default and reach for video only when they want it.

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { requireAiAccess } from "@/lib/server/security";
import { log } from "@/lib/server/log";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAX_TTS_CHARS = 600;

function condenseText(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= MAX_TTS_CHARS) return cleaned;
  const slice   = cleaned.slice(0, MAX_TTS_CHARS);
  const lastDot = Math.max(slice.lastIndexOf("."), slice.lastIndexOf("!"), slice.lastIndexOf("?"));
  return lastDot > 80 ? slice.slice(0, lastDot + 1) : slice + "…";
}

export async function POST(req: NextRequest) {
  const access = await requireAiAccess(req, { limit: 20, windowMs: 60_000 });
  if (!access.ok) return access.response;

  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY not configured." }, { status: 503 });
    }

    const body = await req.json() as { text?: string; voice?: string };
    const rawText = body.text?.trim();
    if (!rawText) {
      return NextResponse.json({ error: "Missing text." }, { status: 400 });
    }

    const text  = condenseText(rawText);
    // Default to the same voice the avatar route uses so the two playback modes
    // sound like the same coach.
    const voice = (body.voice ?? process.env.COACH_TTS_VOICE ?? "ash").trim();

    const tts = await client.audio.speech.create({
      model:           "gpt-4o-mini-tts",
      voice,
      input:           text,
      response_format: "mp3",
    });

    const audioBuf = Buffer.from(await tts.arrayBuffer());
    if (audioBuf.length === 0) {
      return NextResponse.json({ error: "TTS returned empty audio." }, { status: 502 });
    }

    const audioUrl = `data:audio/mpeg;base64,${audioBuf.toString("base64")}`;
    return NextResponse.json({ audioUrl, spokenText: text });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    log.error("[coach-voice]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
