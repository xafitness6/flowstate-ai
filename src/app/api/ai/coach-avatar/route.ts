// ─── Coach avatar (talking head) ────────────────────────────────────────────
// POST { text, portraitUrl? } → generates a short lipsynced video of the coach
// reading the text. Two-step pipeline:
//   1. OpenAI TTS turns the text into a small mp3.
//   2. Higgsfield's seedance_2_0 model takes a portrait + the mp3 and produces
//      a lipsynced video clip.
//
// Both steps run server-side; the route returns { videoUrl, durationSec }.
//
// Setup required:
//   - OPENAI_API_KEY in env.
//   - `higgsfield` CLI installed on the host AND a valid auth session
//     (`higgsfield auth login` interactively, once). When the session is bad
//     this route returns 503 with a clear message instead of hanging.
//   - A default coach portrait at public/coach-portrait.jpg (override via
//     COACH_PORTRAIT_URL or pass portraitUrl in the request).

import { NextResponse } from "next/server";
import { writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import OpenAI from "openai";
import { generateAvatarVideo, isAvailable as higgsfieldAvailable } from "@/lib/avatar/higgsfield";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Trim coach replies before TTS so videos stay short and the user isn't
// waiting 30s+ for a long avatar render.
const MAX_TTS_CHARS = 350;

function condenseText(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= MAX_TTS_CHARS) return cleaned;
  // Cut at the last sentence boundary inside the budget so it doesn't end mid-word.
  const slice = cleaned.slice(0, MAX_TTS_CHARS);
  const lastDot = Math.max(slice.lastIndexOf("."), slice.lastIndexOf("!"), slice.lastIndexOf("?"));
  return lastDot > 80 ? slice.slice(0, lastDot + 1) : slice + "…";
}

function estimateDurationSeconds(text: string): number {
  // ~155 wpm conversational. Floor 4s (Seedance min), ceiling 15s (Seedance max).
  const words = text.split(/\s+/).filter(Boolean).length;
  const raw   = (words / 155) * 60;
  return Math.max(4, Math.min(15, Math.round(raw)));
}

async function fetchPortrait(req: Request, override: string | undefined): Promise<Buffer | null> {
  const envUrl   = process.env.COACH_PORTRAIT_URL;
  const fallback = "/coach-portrait.jpg";
  const target   = override || envUrl || fallback;

  // Allow absolute URLs (env / per-request override) and same-origin paths.
  const url = target.startsWith("http")
    ? target
    : new URL(target, req.url).toString();

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length > 0 ? buf : null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  let workDir: string | null = null;
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY not configured." }, { status: 503 });
    }

    const body = await req.json() as { text?: string; portraitUrl?: string };
    const rawText = body.text?.trim();
    if (!rawText) {
      return NextResponse.json({ error: "Missing text." }, { status: 400 });
    }

    if (!await higgsfieldAvailable()) {
      return NextResponse.json({
        error: "Higgsfield CLI not authenticated. Run `higgsfield auth login` on the server.",
      }, { status: 503 });
    }

    const text     = condenseText(rawText);
    const duration = estimateDurationSeconds(text);

    // 1. TTS → mp3 buffer
    const tts = await client.audio.speech.create({
      model:           "gpt-4o-mini-tts",
      voice:           "ash",  // warm male voice; swap via COACH_TTS_VOICE if needed
      input:           text,
      response_format: "mp3",
    });
    const audioBuf = Buffer.from(await tts.arrayBuffer());
    if (audioBuf.length === 0) {
      return NextResponse.json({ error: "TTS returned empty audio." }, { status: 502 });
    }

    // 2. Portrait — local file from public/, env URL, or per-request override
    const portraitBuf = await fetchPortrait(req, body.portraitUrl);
    if (!portraitBuf) {
      return NextResponse.json({
        error: "No coach portrait available. Place an image at public/coach-portrait.jpg or set COACH_PORTRAIT_URL.",
      }, { status: 503 });
    }

    // 3. Stage to a temp dir for the CLI
    workDir = await mkdtemp(path.join(tmpdir(), "coach-avatar-"));
    const audioPath    = path.join(workDir, "voice.mp3");
    const portraitPath = path.join(workDir, "portrait.jpg");
    await writeFile(audioPath,    audioBuf);
    await writeFile(portraitPath, portraitBuf);

    // 4. Run the Higgsfield CLI (returns the public mp4 URL)
    const { videoUrl } = await generateAvatarVideo({
      startImage:  portraitPath,
      audioPath,
      durationSec: duration,
    });

    return NextResponse.json({ videoUrl, durationSec: duration, spokenText: text });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[coach-avatar]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    if (workDir) {
      try { await rm(workDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  }
}
